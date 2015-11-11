'use strict';

var request = require('request-promise')
  , url     = require('url');

var BLOCKCHAIN_URL  = 'https://blockchain.info'
  , MULTIADDR_URL   = url.resolve(BLOCKCHAIN_URL, 'multiaddr')
  , WALLET_URL      = url.resolve(BLOCKCHAIN_URL, 'wallet');

module.exports = {
  fetchWalletHistory: fetchWalletHistory,
  fetchEncryptedWalletData: fetchEncryptedWalletData
};

function fetchWalletHistory(addresses, options) {
  addresses = addresses.join('|');
  var requestOptions = {
    url: MULTIADDR_URL,
    qs: { active: addresses, format: 'json', api_code: options.api_code },
    json: true
  };
  return request(requestOptions)
}

function fetchEncryptedWalletData(guid, options) {
  var walletUrl = WALLET_URL + '/' + guid;
  var requestOptions = {
    url: walletUrl,
    qs: { format: 'json', api_code: options.api_code },
    json: true
  };
  return request(requestOptions);
};
