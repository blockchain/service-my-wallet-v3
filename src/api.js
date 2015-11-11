'use strict';

var MyWallet  = require('blockchain-wallet-client/src/wallet')
  , q         = require('q')
  , request   = require('request-promise')
  , Wallet    = require('./wallet')
  , Cache     = require('./cache');

var cache = new Cache();

module.exports = {
  login             : login,
  getBalance        : getBalance,
  listAddresses     : listAddresses,
  getAddressBalance : getAddressBalance
};

function login(guid, options) {
  var wallet = new Wallet(guid, options.password, options.api_code);
  cache.save(wallet);
  function success() { return { guid: guid, success: true }; }
  function error(e) { throw 'ERR_SAVING'; }
  return wallet.walletReady.then(success).catch(error);
}

function getBalance(guid, options) {
  return cache.wallet(guid).walletReady.then(function (wallet) {
    return { balance: wallet.final_balance };
  });
}

function listAddresses(guid, options) {
  return cache.wallet(guid).walletReady.then(function (wallet) {
    var addresses = wallet.addresses.map(addressFactory);
    return { addresses: addresses };
  });
  function addressFactory(addr) {
    return {
      address       : addr.addr,
      label         : addr.label,
      balance       : addr.final_balance,
      total_received: addr.total_received
    };
  }
}

function getAddressBalance(guid, options) {
  return cache.wallet(guid).walletReady.then(function (wallet) {
    var addr = wallet.address(options.address);
    return { balance: addr.final_balance, address: addr.addr, total_received: addr.total_received };
  });
}
