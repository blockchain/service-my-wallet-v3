'use strict'

// Hack to get around my-wallet-v3 usage of browser globals
global.navigator = { userAgent: 'nodejs' }

var BYTES_PER_HASH = 32
var TIMEOUT_MS = 60000
var REFRESH_SEC = 120

var crypto = require('crypto')
var q = require('q')
var winston = require('winston')
var create = require('./create')
var overrides = require('./overrides')
var metrics = require('./metrics')

var randomBytes = crypto.randomBytes(BYTES_PER_HASH)

function WalletCache () {
  this.instanceStore = {}
  this.pwHashStore = {}
  this.refreshTimeStore = {}
}

WalletCache.prototype.login = function (guid, options) {
  winston.debug('Logging in')

  var instance = generateInstance()
  var pwHash = generatePwHash(options.password)
  var deferred = q.defer()
  var needs2FA = deferred.reject.bind(null, 'ERR_2FA')
  var needsAuth = deferred.reject.bind(null, 'ERR_AUTH')
  var timeout = setTimeout(deferred.reject.bind(null, 'ERR_TIMEOUT'), TIMEOUT_MS)
  var done = clearTimeout.bind(null, timeout)
  var removeFromStore = function () { this.instanceStore[guid] = this.pwHashStore[guid] = undefined }.bind(this)

  var handleLoginError = function (error) {
    if (error.indexOf('Error decrypting wallet') > -1) {
      return q.reject('ERR_PASSWORD')
    }

    if (error.indexOf('Unable to establish session') > -1 && !options.sessionToken) {
      winston.debug('Failed to establish session, retrying...')
      return instance.WalletNetwork.establishSession().then(function (token) {
        winston.debug('Established session, retrying login...')
        return this.login(guid, Object.assign({}, options, { sessionToken: token }))
      }.bind(this), function (error) {
        winston.debug('Failed to establish session, reason: ' + error)
        return q.reject('ERR_SESSION')
      })
    }

    return q.reject(error)
  }.bind(this)

  instance.API.API_CODE = options.api_code
  instance.MyWallet.logout = removeFromStore
  instance.WalletStore.isLogoutDisabled = function () { return true }
  overrides.configureApiUrls(instance.API)
  overrides.handleSocketErrors(instance.MyWallet.ws)
  overrides.substituteWithCryptoRNG(instance.RNG)

  var callbacks = {
    authorizationRequired: needsAuth,
    needsTwoFactorCode: needs2FA,
    newSessionToken: function () { winston.debug('Created new session token') },
    didFetch: function () { winston.debug('Fetched wallet') },
    didDecrypt: function () { winston.debug('Decrypted wallet') }
  }

  var credentials = {
    twoFactor: null,
    sessionToken: options.sessionToken
  }

  var loginP = instance.MyWallet.login(guid, options.password, credentials, callbacks)

  var startupPromise = q.race([
    deferred.promise,
    loginP.then(function () { return instance }).catch(handleLoginError)
  ])

  this.instanceStore[guid] = startupPromise

  startupPromise.then(function (instance) {
    this.pwHashStore[guid] = pwHash
    var listener = createEventListener('on_tx', function () {
      var tx = instance.MyWallet.wallet.txList.transactions()[0]
      if (tx.result > 0 && tx.txType === 'received') metrics.recordReceive()
    })
    instance.WalletStore.addEventListener(listener)
  }.bind(this))

  return startupPromise.catch(removeFromStore).fin(done)
}

WalletCache.prototype.createWallet = function (options) {
  return create(options.password, {
    email: options.email,
    firstLabel: options.label,
    privateKey: options.priv,
    secondPassword: options.second_password,
    hd: options.hd,
    api_code: options.api_code
  })
}

WalletCache.prototype.getWallet = function (guid, options) {
  var _fetchWalletHistory = fetchWalletHistory.bind(this)
  var _walletFromInstance = walletFromInstance.bind(this, options.password)
  var shouldRefresh = getProcessSeconds() > this.refreshTimeStore[guid]

  if (this.instanceStore[guid] == null) {
    shouldRefresh = true
    this.login(guid, options)
  }

  var maybeWallet = this.instanceStore[guid].then(_walletFromInstance)
  return shouldRefresh ? maybeWallet.then(_fetchWalletHistory) : maybeWallet
}

module.exports = WalletCache

function generateInstance () {
  overrides.clearModuleRequireCache()
  return require('blockchain-wallet-client')
}

function walletFromInstance (maybePw, instance) {
  if (!(this instanceof WalletCache)) throw 'ERR_UNEXPECT'
  var w = instance.MyWallet.wallet
  if (!validatePassword(this.pwHashStore[w.guid], maybePw)) throw 'ERR_PASSWORD'

  w.waitForSync = function (value) {
    winston.debug('Waiting for wallet sync')
    return new Promise(instance.MyWallet.syncWallet).then(function () {
      if (instance.WalletStore.isSynchronizedWithServer()) {
        winston.debug('Sync successful')
        return value
      } else {
        winston.error('Failed to sync wallet')
        return Promise.reject('ERR_SYNC')
      }
    }, function (error) {
      winston.error(error)
      return Promise.reject('ERR_SYNC')
    })
  }

  return w
}

function fetchWalletHistory (wallet) {
  winston.debug('Fetching wallet history')
  if (!(this instanceof WalletCache)) throw 'ERR_HISTORY'
  return wallet.getHistory().then(function () {
    this.refreshTimeStore[wallet.guid] = getProcessSeconds() + REFRESH_SEC
    return wallet
  }.bind(this))
}

function generatePwHash (pw) {
  var iterations = 5000
  return crypto.pbkdf2Sync(pw, randomBytes, iterations, BYTES_PER_HASH, 'sha256')
}

function validatePassword (hash, maybePw) {
  if (!Buffer.isBuffer(hash) || !maybePw) return false
  return generatePwHash(maybePw).compare(hash) === 0
}

function getProcessSeconds () {
  return process.hrtime()[0]
}

function createEventListener (eventName, f) {
  return function (event, data) {
    if (event === eventName) { f(data) }
  }
}
