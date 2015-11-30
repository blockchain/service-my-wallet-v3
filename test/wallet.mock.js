
var key = {
  address: 'address1',
  label: 'first address',
  balance: 3000,
  totalReceived: 10000
};

var newKey = {
  address: 'generated',
  label: 'my new address'
};

var wallet = {
  finalBalance: 9000,
  activeKeys: [key],
  key: function () { return key; },
  newLegacyAddress: function () { return newKey; }
};

module.exports = wallet;
