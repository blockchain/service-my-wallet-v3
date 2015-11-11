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
  addresses: {
    configurable: false,
    get: function () { return Object.keys(this._addresses); }
  },
  key: {
    configurable: false,
    value: function (address) { return this._addresses[address]; }
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
    var addr = this.key(addressHistory.address);
    addr.nTx            = addressHistory.n_tx;
    addr.totalReceived  = addressHistory.total_received;
    addr.totalSent      = addressHistory.total_sent;
    addr.finalBalance   = addressHistory.final_balance;
  }.bind(this);
  var processHistory = function (history) {
    this.nTx            = history.wallet.n_tx;
    this.totalReceived  = history.wallet.total_received;
    this.totalSent      = history.wallet.total_sent;
    this.finalBalance   = history.wallet.final_balance;
    history.addresses.forEach(processAddress);
  }.bind(this);
  var requestP = bcAPI.fetchWalletHistory(this.addresses, {api_code: this.api_code});
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
