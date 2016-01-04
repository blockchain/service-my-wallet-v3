'use strict';

var q       = require('q')
  , request = require('request-promise')
  , bcrypt  = require('bcrypt');

var bc
  , loggingIn = false
  , validatePassword = function () { return false; };

function WalletCache() {}

WalletCache.prototype.login = function (guid, options) {
  if (loggingIn) return q.reject('ERR_LOGIN_BUSY');

  var finishThen = function (cb) {
    return function (res) {
      loggingIn = false;
      cb(res);
    };
  };

  var deferred  = q.defer()
    , needs2FA  = finishThen(deferred.reject.bind(null, 'ERR_2FA'))
    , error     = finishThen(deferred.reject);

  var success = function () {
    var fetchedHistory = finishThen(deferred.resolve.bind(null, { guid: guid, success: true }))
      , pwHash = bcrypt.hashSync(options.password, 13);
    validatePassword = function (p) { return bcrypt.compareSync(p, pwHash); };
    bc.API.API_CODE = options.api_code;
    bc.WalletStore.setAPICode(options.api_code);
    bc.WalletStore.isLogoutDisabled = function () { return true; };
    bc.MyWallet.wallet.getHistory().then(fetchedHistory).catch(error);
  };

  var login = function () {
    loggingIn = true;
    safeReset().then(function () {
      bc.MyWallet.login(guid, null, options.password, null, success, needs2FA, null, null, error);
    });
  };

  this.getWallet(guid, options).then(function (wallet) {
    var successMsg = { guid: guid, success: true };
    wallet.guid === guid ? deferred.resolve(successMsg) : login();
  }).catch(login);

  return deferred.promise;
};

WalletCache.prototype.getWallet = function (guid, options) {
  var exists  = bc && bc.MyWallet && bc.MyWallet.wallet
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
        .filter(function (module) { return module.indexOf('blockchain-wallet-client/src') > -1; })
        .forEach(function (module) { delete require.cache[module]; });
    }
    bc = require('blockchain-wallet-client');
    deferred.resolve(true);
  }
  return deferred.promise;
}
