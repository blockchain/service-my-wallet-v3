'use strict';

var q       = require('q')
  , crypto  = require('blockchain-wallet-client/src/wallet-crypto')
  , bcAPI   = require('./blockchain-api');

function Wallet(guid, password, api_code) {
  this.api_code     = api_code;
  this.guid         = guid;
  this.password     = password;

  this._addresses   = {};

  this.walletReady  = this.initializeWallet();
}

Object.defineProperties(Wallet.prototype, {
  keys: {
    configurable: false,
    get: function () { return Object.keys(this._addresses); }
  },
  address: {
    configurable: false,
    value: function (address) { return this._addresses[address]; }
  },
  addresses: {
    configurable: false,
    get: function () { return this._addresses; }
  }
});

Wallet.prototype.initializeWallet = function () {
  var processWallet = function (data) {
    data.keys
      .filter(function (key) { return key.priv != null; })
      .forEach(function (key) { this._addresses[key.addr] = key; }.bind(this));
  }.bind(this);
  var returnWallet = function () { return this; }.bind(this);
  return this.fetchWallet()
    .then(processWallet)
    .then(this.fetchHistory.bind(this))
    .then(returnWallet);
};

Wallet.prototype.fetchHistory = function () {
  var processAddress = function (addressHistory) {
    var addr = this.address(addressHistory.address);
    addr.n_tx           = addressHistory.n_tx;
    addr.total_received = addressHistory.total_received;
    addr.total_sent     = addressHistory.total_sent;
    addr.final_balance  = addressHistory.final_balance;
  }.bind(this);
  var processHistory = function (history) {
    this.n_tx           = history.wallet.n_tx;
    this.total_received = history.wallet.total_received;
    this.total_sent     = history.wallet.total_sent;
    this.final_balance  = history.wallet.final_balance;
    history.addresses.forEach(processAddress);
  }.bind(this);
  var requestP = bcAPI.fetchWalletHistory(this.keys, {api_code: this.api_code});
  return requestP.then(processHistory);
};

Wallet.prototype.fetchWallet = function () {
  var fetchSuccess = function(data) {
    var deferred = q.defer();
    crypto.decryptWallet(data.payload, this.password, deferred.resolve, deferred.reject);
    return deferred.promise;
  }.bind(this);
  var requestP = bcAPI.fetchEncryptedWalletData(this.guid, {api_code: this.api_code});
  return requestP.then(fetchSuccess);
};

module.exports = Wallet;
