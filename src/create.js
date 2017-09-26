'use strict'

var crypto = require('crypto')
var BIP39 = require('bip39')
var winston = require('winston')
var overrides = require('./overrides')
var warnings = require('./warnings')

overrides.clearModuleRequireCache()

var Blockchain = require('blockchain-wallet-client')
var Address = Blockchain.Address
var WalletNetwork = Blockchain.WalletNetwork
var Wallet = require('blockchain-wallet-client/lib/blockchain-wallet')
var HDWallet = require('blockchain-wallet-client/lib/hd-wallet')

overrides.configureApiUrls(Blockchain.API)
overrides.substituteWithCryptoRNG(Blockchain.RNG)
overrides.disableSyncWallet(Blockchain.MyWallet)

/**
 *  email: String (optional)
 *  firstLabel: String (optional)
 *  privateKey: String (optional)
 *  secondPassword: String (optional)
 *  hd: Boolean (default: false)
 */

function createWallet (password, options) {
  if (!password || password.length > 255) {
    return Promise.reject('Password must exist and be shorter than 256 characters')
  }

  options = options || {}
  var email = options.email
  var firstLabel = options.firstLabel
  var privateKey = options.privateKey
  var secPass = options.secondPassword
  var isHdWallet = Boolean(options.hd)

  Blockchain.API.API_CODE = options.api_code

  // Handle response from WalletNetwork
  var generatedUUIDs = function (uuids) {
    var guid = uuids[0]
    var sharedKey = uuids[1]

    if (!guid || !sharedKey || guid.length !== 36 || sharedKey.length !== 36) {
      throw 'Error generating wallet identifier'
    }

    return { guid: guid, sharedKey: sharedKey }
  }

  // Generate new Wallet JSON, add first key
  var newWallet = function (uuids) {
    var walletJSON = {
      guid: uuids.guid,
      sharedKey: uuids.sharedKey,
      double_encryption: false,
      options: {
        pbkdf2_iterations: 5000,
        html5_notifications: false,
        fee_per_kb: 10000,
        logout_time: 600000
      }
    }

    var createHdWallet = function (label) {
      label = label == null ? 'My Bitcoin Wallet' : label
      var mnemonic = BIP39.generateMnemonic(undefined, Blockchain.RNG.run.bind(Blockchain.RNG))
      var hd = HDWallet.new(mnemonic)
      hd.newAccount(label)
      return hd
    }

    var createLegacyAddress = function (priv, label) {
      return priv ? Address.import(priv, label) : Address.new(label)
    }

    if (isHdWallet) {
      var hdJSON = createHdWallet(firstLabel).toJSON()
      hdJSON.accounts = hdJSON.accounts.map(function (a) { return a.toJSON() })
      walletJSON.hd_wallets = [hdJSON]
    } else {
      winston.warn(warnings.CREATED_NON_HD)
      var firstAddress = createLegacyAddress(privateKey, firstLabel)
      walletJSON.keys = [firstAddress.toJSON()]
    }

    if (typeof secPass === 'string' && secPass.length) {
      walletJSON = JSON.parse(JSON.stringify(new Wallet(walletJSON).encrypt(secPass)))
    }

    return walletJSON
  }

  // Encrypt and push new wallet to server
  var insertWallet = function (wallet) {
    var data = JSON.stringify(wallet, null, 2)
    var enc = Blockchain.WalletCrypto.encryptWallet(data, password, wallet.options.pbkdf2_iterations, 2.0)
    var check = sha256(enc).toString('hex')

    // Throws if there is an encryption error
    Blockchain.WalletCrypto.decryptWallet(enc, password, function () {}, function () {
      throw 'Failed to confirm successful encryption when generating new wallet'
    })

    var postData = {
      guid: wallet.guid,
      sharedKey: wallet.sharedKey,
      length: enc.length,
      payload: enc,
      checksum: check,
      method: 'insert',
      format: 'plain'
    }

    if (email) postData.email = email

    return Blockchain.API.securePost('wallet', postData).then(function () {
      if (isHdWallet) {
        var account = wallet.hd_wallets[0].accounts[0]
        return { guid: wallet.guid, address: account.xpub, label: account.label }
      } else {
        var firstKey = wallet.keys[0]
        return { guid: wallet.guid, address: firstKey.addr, label: firstKey.label, warning: warnings.CREATED_NON_HD }
      }
    })
  }

  return WalletNetwork.generateUUIDs(2)
    .then(generatedUUIDs)
    .then(newWallet)
    .then(insertWallet)
    .catch(function (err) { throw err === 'Unknown API Key' ? 'ERR_API_KEY' : err })
}

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest()
}

module.exports = createWallet
