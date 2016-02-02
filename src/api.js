'use strict';

var WalletCache = require('./wallet-cache')
  , q           = require('q')

var cache = new WalletCache();

function MerchantAPI() {}

MerchantAPI.prototype.login = function (guid, options) {
  return cache.login(guid, options);
};

MerchantAPI.prototype.getWallet = function (guid, options) {
  return cache.getWallet(guid, options);
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
      var payment = cache.walletPayment()
        .to(options.to)
        .amount(options.amount)
        .from(options.from);

      var password;
      if (wallet.isDoubleEncrypted) {
        password = options.second_password;
      }

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

      var deferred = q.defer();

      // NOTE: payment.buildbeta() does NOT return a promise
      payment.buildbeta()
        .then(function (p) {
          deferred.resolve(payment.sign(password).publish().payment);
          return p;
        })
        .catch(function (e) {
          deferred.reject(e.error.message || e.error);
        });

      return deferred.promise
        .then(success).catch(error);
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

module.exports = new MerchantAPI();

// Helper functions
function requireSecondPassword(options) {
  return function (wallet) {
    if (wallet.isDoubleEncrypted && !wallet.validateSecondPassword(options.second_password))
      throw 'ERR_SECPASS';
    return wallet;
  };
}
