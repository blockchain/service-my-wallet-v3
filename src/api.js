'use strict';

var MyWallet  = require('blockchain-wallet-client/src/wallet')
  , q         = require('q')
  , request   = require('request-promise')
  , Wallet    = require('./wallet')
  , Cache     = require('./cache');

var cache = new Cache();

module.exports = {
  login     : login,
  getBalance: getBalance
};

function login(guid, options) {
  var wallet = new Wallet(guid, options.password, options.api_code);
  cache.save(wallet);
  function success() { return { guid: guid, success: true }; }
  function error() { return 7; }
  return wallet.walletReady.then(success).catch(error);
}

function getBalance(guid, options) {
  return cache.wallet(guid).walletReady.then(function (wallet) {
    return { balance: wallet.finalBalance };
  });
}
