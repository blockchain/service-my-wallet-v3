'use strict';

var WalletCache = require('./wallet-cache')
  , q           = require('q')
  , winston     = require('winston');

function MerchantAPI() {
  this.cache = new WalletCache();
}

MerchantAPI.prototype.getWallet = function (guid, options) {
  return this.cache.getWallet(guid, options);
};

MerchantAPI.prototype.getWalletHD = function (guid, options) {
  return this.cache.getWallet(guid, options).then(function (wallet) {
    return wallet.isUpgradedToHD ? wallet.hdwallet : q.reject('ERR_NO_HD');
  });
};

MerchantAPI.prototype.login = function (guid, options) {
  var successResponse = {
    guid    : guid,
    success : true,
    message : 'This endpoint has been deprecated. You no longer have to call /login before accessing a wallet.'
  };
  return this.getWallet(guid, options).then(function () { return successResponse; });
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
      var from = isNaN(options.from) ?
        options.from : parseInt(options.from);

      var payment = wallet.createPayment()
        .to(options.to)
        .amount(options.amount)
        .from(from);

      var password;
      if (wallet.isDoubleEncrypted) {
        password = options.second_password;
      }

      if (options.fee) payment.fee(options.fee);
      if (options.note) payment.note(options.note);

      function success(tx) {
        winston.debug('Transaction published', { hash: tx.txid });
        return {
          to      : tx.to,
          amounts : tx.amounts,
          from    : tx.from,
          fee     : tx.fee,
          txid    : tx.txid,
          tx_hash : tx.txid,
          message : 'Sent to Multiple Recipients',
          success : true
        };
      }

      function error(e) {
        return q.reject(e || 'ERR_PUSHTX');
      }

      var deferred = q.defer();

      // NOTE: payment.buildbeta() does NOT return a promise
      payment.buildbeta()
        .then(function (p) {
          deferred.resolve(payment.sign(password).publish().payment);
          return p;
        })
        .catch(function (e) {
          var errMsg = e.error ? (e.error.message || e.error) : 'ERR_BUILDTX';
          deferred.reject(errMsg);
        });

      return deferred.promise
        .then(success).catch(error);
    }.bind(this));
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

MerchantAPI.prototype.createWallet = function (options) {
  return this.cache.createWallet(options);
};

// HD Accounts API
MerchantAPI.prototype.upgradeWallet = function (guid, options) {
  return this.getWallet(guid, options)
    .then(requireSecondPassword(options))
    .then(function (wallet) {
      if (wallet.isUpgradedToHD) return q.reject('ERR_IS_HD');
      var deferred  = q.defer()
        , error     = deferred.reject.bind(null, 'ERR_SYNC')
        , hdwallet  = wallet.newHDWallet(options.label, options.second_password, success, error);
      function success(s) { deferred.resolve(formatAcct(hdwallet.accounts[0])); }
      return deferred.promise;
    });
};

MerchantAPI.prototype.listxPubs = function (guid, options) {
  return this.getWalletHD(guid, options).then(function (hdwallet) {
    return hdwallet.xpubs;
  });
};

MerchantAPI.prototype.createAccount = function (guid, options) {
  return this.getWallet(guid, options)
    .then(requireSecondPassword(options))
    .then(function (wallet) {
      if (!wallet.isUpgradedToHD) return q.reject('ERR_NO_HD');
      return wallet.newAccount(options.label, options.second_password);
    });
};

MerchantAPI.prototype.listAccounts = function (guid, options) {
  return this.getWalletHD(guid, options).then(function (hdwallet) {
    var byId = function (acct) {
      return acct.index === parseInt(options.account);
    };
    var notFound = q.reject('ERR_ACCT_IDX');
    return hdwallet.isValidAccountIndex(parseInt(options.account)) ?
      (formatAcct(hdwallet.accounts.filter(byId)[0]) || notFound):
      (options.account ?
        (formatAcct(hdwallet.account(options.account)) || notFound):
        (hdwallet.activeAccounts.map(formatAcct))
      );
  });
};

MerchantAPI.prototype.getReceiveAddress = function (guid, options) {
  return this.listAccounts(guid, options).then(function (account) {
    return { address: account.receiveAddress };
  });
};

MerchantAPI.prototype.getAccountBalance = function (guid, options) {
  return this.listAccounts(guid, options).then(function (account) {
    return { balance: account.balance };
  });
};

MerchantAPI.prototype.archiveAccount = function (guid, options) {
  return this.listAccounts(guid, options).then(function (account) {
    account.archived = true;
    return account;
  });
};

MerchantAPI.prototype.unarchiveAccount = function (guid, options) {
  return this.listAccounts(guid, options).then(function (account) {
    account.archived = false;
    return account;
  });
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

function formatAcct(a) {
  return !(a instanceof Object) ? undefined : {
    balance: a.balance, label: a.label, index: a.index, archived: a.archived,
    extendedPublicKey: a.extendedPublicKey, extendedPrivateKey: a.extendedPrivateKey,
    receiveIndex: a.receiveIndex, lastUsedReceiveIndex: a.lastUsedReceiveIndex,
    receivingAddressLabels: a.receivingAddressesLabels
  };
}
