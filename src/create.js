'use strict';

var assert        = require('assert')
  , crypto        = require('crypto')
  , overrides     = require('./overrides')
  , Blockchain    = require('blockchain-wallet-client-prebuilt')
  , Address       = require('blockchain-wallet-client-prebuilt/src/address')
  , WalletNetwork = require('blockchain-wallet-client-prebuilt/src/wallet-network');

// options { email: String, firstLabel: String, privateKey: String }
function createWallet(password, options) {
  if (!password || password.length > 255) {
    return Promise.reject('Password must exist and be shorter than 256 characters'); }

  options = options || {};
  var email       = options.email
    , firstLabel  = options.firstLabel
    , privateKey  = options.privateKey;

  Blockchain.API.API_CODE = options.api_code;

  // Handle response from WalletNetwork
  var generatedUUIDs = function (uuids) {
    var guid      = uuids[0]
      , sharedKey = uuids[1];

    if (!guid || !sharedKey || guid.length !== 36 || sharedKey.length !== 36) {
      throw 'Error generating wallet identifier'; }

    return { guid: guid, sharedKey: sharedKey };
  };

  // Generate new Wallet JSON, add first key
  var newWallet = function (uuids) {
    var walletJSON = {
      guid              : uuids.guid,
      sharedKey         : uuids.sharedKey,
      double_encryption : false,
      options: {
        pbkdf2_iterations   : 5000,
        html5_notifications : false,
        fee_per_kb          : 10000,
        logout_time         : 600000
      }
    };

    var firstAddressJSON = (privateKey ?
      Address.import(privateKey, firstLabel) : Address.new(firstLabel)
    ).toJSON();

    walletJSON.keys = [firstAddressJSON];
    return walletJSON;
  };

  // Encrypt and push new wallet to server
  var insertWallet = function (wallet) {
    var data  = JSON.stringify(wallet, null, 2)
      , enc   = Blockchain.WalletCrypto.encryptWallet(data, password, wallet.options.pbkdf2_iterations, 2.0)
      , check = sha256(enc).toString('hex');

    // Throws if there is an encryption error
    Blockchain.WalletCrypto.decryptWallet(enc, password, function () {}, function () {
      throw 'Failed to confirm successful encryption when generating new wallet';
    });

    var postData = {
      guid      : wallet.guid,
      sharedKey : wallet.sharedKey,
      length    : enc.length,
      payload   : enc,
      checksum  : check,
      method    : 'insert',
      format    : 'plain'
    };

    if (email) postData.email = email;

    return Blockchain.API.securePost('wallet', postData).then(function () {
      var firstKey = wallet.keys[0];
      return { guid: wallet.guid, address: firstKey.addr, label: firstKey.label };
    });
  };

  return WalletNetwork.generateUUIDs(2)
    .then(generatedUUIDs)
    .then(newWallet)
    .then(insertWallet)
    .catch(function (err) { throw err === 'Unknown API Key' ? 'ERR_API_KEY' : err; });
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

overrides.substituteWithCryptoRNG(Blockchain.RNG);

module.exports = createWallet;
