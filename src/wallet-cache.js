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
  this.instanceStore = {};
  this.pwHashStore = {};
  this.refreshTimeStore = {};
}

WalletCache.prototype.login = function (guid, options) {
  winston.debug('Logging in');

  var instance  = generateInstance()
    , deferred  = q.defer()
    , success   = deferred.resolve.bind(null, instance)
    , error     = deferred.reject
    , needs2FA  = deferred.reject.bind(null, 'ERR_2FA')
    , needsAuth = deferred.reject.bind(null, 'ERR_AUTH')
    , timeout   = setTimeout(deferred.reject.bind(null, 'ERR_TIMEOUT'), TIMEOUT_MS)
    , done      = clearTimeout.bind(null, timeout)
    , remove    = function () { this.instanceStore[guid] = undefined; }.bind(this);

  this.instanceStore[guid] = deferred.promise;

  var pwHash = generatePwHash(options.password);
  this.pwHashStore[guid] = pwHash;

  instance.API.API_CODE = options.api_code;
  instance.WalletStore.isLogoutDisabled = function () { return true; };
  handleSocketErrors(instance.MyWallet.ws);
  instance.MyWallet.login(guid, null, options.password, null, success, needs2FA, null, needsAuth, error);

  deferred.promise.then(function (instance) {
    instance.MyWallet.wallet.createPayment = function (p) { return new instance.Payment(p); };
  });

  return deferred.promise.catch(remove).fin(done);
};

WalletCache.prototype.createWallet = function (options) {
  return create(options.password, {
    email       : options.email,
    firstLabel  : options.label,
    privateKey  : options.priv
  });
};

WalletCache.prototype.getWallet = function (guid, options) {
  var instance = this.instanceStore[guid];
  var fetchHistory = fetchWalletHistory.bind(this);

  if (instance != null) {
    if (validatePassword(this.pwHashStore[guid], options.password)) {
      var walletP = instance.then(walletFromInstance);
      var shouldRefresh = getProcessSeconds() > this.refreshTimeStore[guid];
      return shouldRefresh ? walletP.then(fetchHistory) : walletP;
    } else {
      return q.reject('ERR_PASSWORD');
    }
  } else {
    this.login(guid, options);
    return this.instanceStore[guid].then(walletFromInstance).then(fetchHistory);
  }
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

function walletFromInstance(instance) {
  return instance.MyWallet.wallet;
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
