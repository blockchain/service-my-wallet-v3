'use strict';

var q = require('q');

function Cache() {
  this._wallets = {};
}

Object.defineProperties(Cache.prototype, {
  guids: {
    configurable: false,
    get: function () { return Object.keys(this._wallets); }
  },
  wallet: {
    configurable: false,
    value: function (guid) {
      return this._wallets[guid] != null ?
        this._wallets[guid] : { walletReady: q.reject(9) };
    }
  }
});

Cache.prototype.save = function (wallet) {
  this._wallets[wallet.guid] = wallet;
};

Cache.prototype.remove = function (guid) {
  delete this._wallets[guid];
};

module.exports = Cache;
