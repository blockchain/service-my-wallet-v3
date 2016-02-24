'use strict';

// Hack to get around my-wallet-v3 usage of browser globals
global.navigator = { userAgent: 'nodejs' };

var BYTES_PER_HASH = 32;
var TIMEOUT_MS = 60000;

var crypto  = require('crypto')
  , q       = require('q')
  , request = require('request-promise');

var bc
  , validatePassword = function () { return false; }
  , randomBytes = crypto.randomBytes(BYTES_PER_HASH);

function WalletCache() {
  this.loggingIn = false;
}

WalletCache.prototype.login = function (guid, options) {
  if (this.loggingIn) return q.reject('ERR_LOGIN_BUSY');

  var deferred  = q.defer()
    , needs2FA  = deferred.reject.bind(null, 'ERR_2FA')
    , needsAuth = deferred.reject.bind(null, 'ERR_AUTH')
    , error     = deferred.reject
    , timeout   = setTimeout(deferred.reject.bind(null, 'ERR_TIMEOUT'), TIMEOUT_MS);

  var success = function () {
    var fetchedHistory = deferred.resolve.bind(null, { guid: guid, success: true })
      , pwHash = generatePwHash(options.password);
    validatePassword = function (p) { return generatePwHash(p).compare(pwHash) === 0; };
    bc.MyWallet.wallet.getHistory().then(fetchedHistory).catch(error);
  };

  var login = function () {
    this.loggingIn = true;
    safeReset().then(function () {
      bc.API.API_CODE = options.api_code;
      bc.WalletStore.setAPICode(options.api_code);
      bc.WalletStore.isLogoutDisabled = function () { return true; };
      bc.MyWallet.login(guid, null, options.password, null, success, needs2FA, null, needsAuth, error);
    });
  }.bind(this);

  var done = function () {
    clearTimeout(timeout);
    this.loggingIn = false;
  }.bind(this);

  this.getWallet(guid, options).then(function (wallet) {
    var fetchedHistory = deferred.resolve.bind(null, { guid: guid, success: true });
    wallet.guid === guid ? wallet.getHistory().then(fetchedHistory) : login();
  }).catch(login);

  return deferred.promise.fin(done);
};

WalletCache.prototype.createWallet = function (options) {
  if (this.loggingIn) return q.reject('ERR_LOGIN_BUSY');

  var lang, currency
    , email = options.email || ''
    , pass  = options.password
    , label = options.label || 'First Address'
    , isHD  = false
    , deferred  = q.defer()
    , timeout   = setTimeout(deferred.reject.bind(null, 'ERR_TIMEOUT'), TIMEOUT_MS);

  var success = function (guid, sharedKey, password) {
    var fetchedHistory  = deferred.resolve.bind(null, guid)
      , errorHistory    = deferred.reject.bind(null, 'ERR_HISTORY')
      , pwHash = generatePwHash(password);

    if (bc.MyWallet.detectPrivateKeyFormat(options.priv) !== null) {
      bc.MyWallet.wallet.deleteLegacyAddress(bc.MyWallet.wallet.keys[0]);
      bc.MyWallet.wallet.importLegacyAddress(options.priv, options.label);
    }

    validatePassword = function (p) { return generatePwHash(p).compare(pwHash) === 0; };
    bc.MyWallet.wallet.getHistory().then(fetchedHistory).catch(errorHistory);
  };

  var done = function () {
    clearTimeout(timeout);
    this.loggingIn = false;
  }.bind(this);

  safeReset().then(function () {
    this.loggingIn = true;
    bc.API.API_CODE = options.api_code;
    bc.WalletStore.setAPICode(options.api_code);
    bc.WalletStore.isLogoutDisabled = function () { return true; };
    bc.MyWallet.createNewWallet(email, pass, label, lang, currency, success, deferred.reject, isHD);
  }.bind(this));

  return deferred.promise.fin(done);
};

WalletCache.prototype.getWallet = function (guid, options) {
  var exists  = bc && bc.MyWallet && bc.MyWallet.wallet && bc.MyWallet.wallet.guid === guid
    , validpw = validatePassword(options.password)
    , err     = !exists && 'ERR_WALLET_ID' || !validpw && 'ERR_PASSWORD';
  return err ? q.reject(err) : q(bc.MyWallet.wallet);
};

WalletCache.prototype.walletPayment = function () {
  return new bc.Payment();
};

module.exports = WalletCache;

function safeReset() {
  var deferred = q.defer();
  if (bc && bc.MyWallet && bc.MyWallet.wallet) {
    if (!bc.WalletStore.isSynchronizedWithServer()) {
      bc.MyWallet.syncWallet(refreshCache, deferred.reject);
    } else {
      refreshCache();
    }
  } else {
    refreshCache();
  }
  function refreshCache() {
    if (require.cache) {
      Object.keys(require.cache)
        .filter(function (module) {
          return (module.indexOf('blockchain-wallet-client-prebuilt/index') > -1 ||
                  module.indexOf('blockchain-wallet-client-prebuilt/src') > -1);
        })
        .forEach(function (module) { delete require.cache[module]; });
    }
    bc = require('blockchain-wallet-client-prebuilt');
    deferred.resolve(true);
  }
  return deferred.promise;
}

function generatePwHash(pw) {
  var iterations = 5000;
  return crypto.pbkdf2Sync(pw, randomBytes, iterations, BYTES_PER_HASH, 'sha256');
}
