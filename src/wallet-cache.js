'use strict';

// Hack to get around my-wallet-v3 usage of browser globals
global.navigator = { userAgent: 'nodejs' };

var BYTES_PER_HASH = 32;
var TIMEOUT_MS = 60000;
var REFRESH_SEC = 120;

var crypto  = require('crypto')
  , q       = require('q')
  , winston = require('winston')
  , request = require('request-promise')
  , create  = require('./create')
  , overrides = require('./overrides');

var randomBytes = crypto.randomBytes(BYTES_PER_HASH);

function WalletCache() {
  this.instanceStore = {};
  this.pwHashStore = {};
  this.refreshTimeStore = {};
}

WalletCache.prototype.login = function (guid, options) {
  winston.debug('Logging in');

  var instance  = generateInstance()
    , pwHash    = generatePwHash(options.password)
    , deferred  = q.defer()
    , error     = deferred.reject
    , needs2FA  = deferred.reject.bind(null, 'ERR_2FA')
    , needsAuth = deferred.reject.bind(null, 'ERR_AUTH')
    , timeout   = setTimeout(deferred.reject.bind(null, 'ERR_TIMEOUT'), TIMEOUT_MS)
    , done      = clearTimeout.bind(null, timeout)
    , remove    = function () { this.instanceStore[guid] = undefined; }.bind(this);

  instance.API.API_CODE = options.api_code;
  instance.WalletStore.isLogoutDisabled = function () { return true; };
  overrides.handleSocketErrors(instance.MyWallet.ws);
  overrides.substituteWithCryptoRNG(instance.RNG);

  var callbacks = { authorizationRequired: needsAuth, needsTwoFactorCode: needs2FA };
  var loginP = instance.MyWallet.login(guid, options.password, { twoFactor: null }, callbacks);
  var startupPromise = q.race([ deferred.promise, loginP.then(function () { return instance; }) ]);

  this.instanceStore[guid] = startupPromise;
  startupPromise.then(function () { this.pwHashStore[guid] = pwHash; }.bind(this));

  return startupPromise.catch(remove).fin(done);
};

WalletCache.prototype.createWallet = function (options) {
  return create(options.password, {
    email       : options.email,
    firstLabel  : options.label,
    privateKey  : options.priv,
    api_code    : options.api_code
  });
};

WalletCache.prototype.getWallet = function (guid, options) {
  var _fetchWalletHistory = fetchWalletHistory.bind(this);
  var _walletFromInstance = walletFromInstance.bind(this, options.password);
  var shouldRefresh       = getProcessSeconds() > this.refreshTimeStore[guid];

  if (this.instanceStore[guid] == null) {
    shouldRefresh = true;
    this.login(guid, options);
  }

  var maybeWallet = this.instanceStore[guid].then(_walletFromInstance);
  return shouldRefresh ? maybeWallet.then(_fetchWalletHistory) : maybeWallet;
};

module.exports = WalletCache;

function generateInstance() {
  Object.keys(require.cache)
    .filter(function (module) {
      return (module.indexOf('blockchain-wallet-client-prebuilt/index') > -1 ||
              module.indexOf('blockchain-wallet-client-prebuilt/src') > -1);
    })
    .forEach(function (module) { require.cache[module] = undefined; });
  return require('blockchain-wallet-client-prebuilt');
}

function walletFromInstance(maybePw, instance) {
  if (!this instanceof WalletCache) throw 'ERR_UNEXPECT';
  var w = instance.MyWallet.wallet;
  if (!validatePassword(this.pwHashStore[w.guid], maybePw)) throw 'ERR_PASSWORD';
  w.createPayment = function (p) { return new instance.Payment(p); };
  return w;
}

function fetchWalletHistory(wallet) {
  winston.debug('Fetching wallet history');
  if (!this instanceof WalletCache) throw 'ERR_HISTORY';
  return wallet.getHistory().then(function () {
    this.refreshTimeStore[wallet.guid] = getProcessSeconds() + REFRESH_SEC;
    return wallet;
  }.bind(this));
}

function generatePwHash(pw) {
  var iterations = 5000;
  return crypto.pbkdf2Sync(pw, randomBytes, iterations, BYTES_PER_HASH, 'sha256');
}

function validatePassword(hash, maybePw) {
  if (!Buffer.isBuffer(hash) || !maybePw) return false;
  return generatePwHash(maybePw).compare(hash) === 0;
}

function getProcessSeconds() {
  return process.hrtime()[0];
}
