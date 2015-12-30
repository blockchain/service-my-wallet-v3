'use strict';

var bc, validatePassword = function () { return false; };
var q       = require('q')
  , request = require('request-promise')
  , bcrypt  = require('bcrypt');

function MerchantAPI() {}

MerchantAPI.prototype.login = function (guid, options) {
  var deferred  = q.defer()
    , needs2FA  = deferred.reject.bind(null, 'ERR_2FA')
    , error     = deferred.reject;
  function success() {
    var resolve = deferred.resolve.bind(null, { guid: guid, success: true })
      , pwHash  = bcrypt.hashSync(options.password, 13);
    validatePassword = function (p) { return bcrypt.compareSync(p, pwHash); };
    bc.API.API_CODE = options.api_code;
    bc.WalletStore.setAPICode(options.api_code);
    bc.WalletStore.isLogoutDisabled = function () { return true; };
    bc.MyWallet.wallet.getHistory().then(resolve).catch(deferred.reject);
  }
  safeReset().then(function () {
    bc.MyWallet.login(guid, null, options.password, null, success, needs2FA, null, null, error);
  });
  return deferred.promise;
};

MerchantAPI.prototype.getBalance = function (guid, options) {
  return this.getWallet(guid, options).then(function (wallet) {
    return { balance: wallet.finalBalance };
  });
};

MerchantAPI.prototype.listAddresses = function (guid, options) {
  return this.getWallet(guid, options).then(function (wallet) {
    var addresses = wallet.activeKeys.map(addressFactory);
    return { addresses: addresses };
  });
  function addressFactory(a) {
    return {address: a.address, label: a.label, balance: a.balance, total_received: a.totalReceived};
  }
};

MerchantAPI.prototype.getAddressBalance = function (guid, options) {
  return this.getWallet(guid, options).then(function (wallet) {
    var addr = wallet.key(options.address);
    return { balance: addr.balance, address: addr.address, total_received: addr.totalReceived };
  }).catch(function () { throw 'ERR_ADDRESS'; });
};

MerchantAPI.prototype.sendMany = function (guid, options) {
  var recipients;

  try {
    var r = options.recipients;
    recipients = 'object' === typeof r ? r : JSON.parse(r);
  } catch (e) {
    return q.reject('ERR_JSON');
  }

  options.amount  = [];
  options.to      = [];

  Object.keys(recipients).forEach(function (r) {
    options.to.push(r);
    options.amount.push(recipients[r]);
  });

  delete options.recipients;
  return this.makePayment(guid, options);
};

MerchantAPI.prototype.makePayment = function (guid, options) {
  return this.getWallet(guid, options)
    .then(requireSecondPassword(options))
    .then(function (wallet) {
      var payment = new bc.Payment()
        .to(options.to)
        .amount(options.amount)
        .from(options.from);

      var password = options.second_password;
      if (options.fee) payment.fee(options.fee);
      if (options.note) payment.note(options.note);

      function success(tx) {
        return {
          to      : tx.to,
          amounts : tx.amounts,
          from    : tx.from,
          fee     : tx.fee,
          txid    : tx.txid,
          success : true
        };
      }

      function error(e) {
        console.log(e);
        throw e || 'ERR_PUSHTX';
      }

      return payment.build().sign(password).publish()
        .payment.then(success).catch(error);
    });
};

MerchantAPI.prototype.generateAddress = function (guid, options) {
  return this.getWallet(guid, options)
    .then(requireSecondPassword(options))
    .then(function (wallet) {
      var a = wallet.newLegacyAddress(options.label, options.second_password);
      return { address: a.address, label: a.label };
    }).catch(function (e) {
      throw e.message || e;
    });
};

MerchantAPI.prototype.archiveAddress = function (guid, options) {
  return this.getWallet(guid, options).then(function (wallet) {
    wallet.key(options.address).archived = true;
    return { archived: options.address };
  }).catch(function (e) { throw e || 'ERR_ADDRESS'; });
};

MerchantAPI.prototype.unarchiveAddress = function (guid, options) {
  return this.getWallet(guid, options).then(function (wallet) {
    wallet.key(options.address).archived = false;
    return { active: options.address };
  }).catch(function (e) { throw e || 'ERR_ADDRESS'; });
};

MerchantAPI.prototype.getWallet = function (guid, options) {
  var exists  = bc && bc.MyWallet && bc.MyWallet.wallet
    , validpw = validatePassword(options.password)
    , err     = !exists && 'ERR_WALLET_ID' || !validpw && 'ERR_PASSWORD';
  return err ? q.reject(err) : q(bc.MyWallet.wallet);
};

module.exports = new MerchantAPI();

// Helper functions
function requireSecondPassword(options) {
  return function (wallet) {
    if (wallet.isDoubleEncrypted && !wallet.validateSecondPassword(options.second_password))
      throw 'ERR_SECPASS';
    return wallet;
  };
}

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
      Object.keys(require.cache).forEach(function (module) {
        delete require.cache[module];
      });
    }
    bc = require('blockchain-wallet-client');
    deferred.resolve(true);
  }
  return deferred.promise;
}
