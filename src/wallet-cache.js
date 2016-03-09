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
  , create  = require('./create');

var randomBytes = crypto.randomBytes(BYTES_PER_HASH);

function WalletCache() {
  this.loggingIn = {};
  this.instanceStore = {};
  this.pwHashStore = {};
  this.refreshTimeStore = {};
}

WalletCache.prototype.login = function (guid, options) {
  if (this.loggingIn[guid]) return q.reject('ERR_LOGIN_BUSY');

  var deferred  = q.defer()
    , needs2FA  = deferred.reject.bind(null, 'ERR_2FA')
    , needsAuth = deferred.reject.bind(null, 'ERR_AUTH')
    , error     = deferred.reject
    , fetched   = deferred.resolve.bind(null, { guid: guid, success: true })
    , timeout   = setTimeout(deferred.reject.bind(null, 'ERR_TIMEOUT'), TIMEOUT_MS);

  var success = function () {
    var pwHash = generatePwHash(options.password);
    this.pwHashStore[guid] = pwHash;
    this.instanceStore[guid].MyWallet.wallet.getHistory().then(fetched).catch(error);
  }.bind(this);

  var done = function () {
    clearTimeout(timeout);
    this.loggingIn[guid] = false;
  }.bind(this);

  this.loggingIn[guid] = true;
  var instance = generateInstance();
  instance.API.API_CODE = options.api_code;
  instance.WalletStore.setAPICode(options.api_code);
  instance.WalletStore.isLogoutDisabled = function () { return true; };
  handleSocketErrors(instance.MyWallet.ws);
  instance.MyWallet.login(guid, null, options.password, null, success, needs2FA, null, needsAuth, error);
  this.instanceStore[guid] = instance;

  return deferred.promise.fin(done);
};

WalletCache.prototype.createWallet = function (options) {
  return create(options.password, {
    email       : options.email,
    firstLabel  : options.label,
    privateKey  : options.priv
  });
};

WalletCache.prototype.getWallet = function (guid, options) {
  var inst    = this.instanceStore[guid]
    , exists  = inst && inst.MyWallet.wallet && inst.MyWallet.wallet.guid === guid
    , getFromStore = function (guid) { return this.instanceStore[guid].MyWallet.wallet; };

  if (exists) {
    if (validatePassword(this.pwHashStore[guid], options.password)) {
      if (this.refreshTimeStore[guid] > getProcessSeconds()) {
        return q(inst.MyWallet.wallet);
      } else {
        this.refreshTimeStore[guid] = getProcessSeconds() + REFRESH_SEC;
        return inst.MyWallet.wallet.getHistory().then(getFromStore.bind(this, guid));
      }
    } else {
      return q.reject('ERR_PASSWORD');
    }
  } else {
    return this.login(guid, options).then(getFromStore.bind(this, guid));
  }
};

WalletCache.prototype.walletPayment = function (guid) {
  var instance = this.instanceStore[guid];
  if (!instance || !instance.Payment) throw 'ERR_PAYMENT';
  return new instance.Payment();
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

function handleSocketErrors(ws) {
  var connectOnce = ws.connectOnce.bind(ws);
  ws.connectOnce = function () {
    connectOnce.apply(this, arguments);
    this.socket.on('error', function (err) { winston.error('WebSocketError', { code: err.code }); });
  };
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
