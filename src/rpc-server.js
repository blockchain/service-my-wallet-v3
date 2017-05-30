'use strict'

var SATOSHI_PER_BTC = 100000000

var rpc = require('json-rpc2')
var auth = require('basic-auth')
var bci = require('blockchain.info')
var api = require('./api')
var pkg = require('../package')
var metrics = require('./metrics')
var request = require('request-promise')
var bitcoin = require('bitcoinjs-lib')
var winston = require('winston')
var helpers = require('blockchain-wallet-client/lib/helpers')
var wcrypto = require('blockchain-wallet-client/lib/wallet-crypto')

var apiCode = ''
var secondPasswordStore = new TimedStore()

module.exports = {
  start: start
}

function start (options) {
  options = options || {}
  options.rpcport = options.rpcport || 8000
  options.bind = options.bind || '127.0.0.1'
  apiCode = options.api_code

  var server = rpc.Server.$create()

  var methods = [
    getinfo,
    walletlock,
    settxfee,
    walletpassphrase,
    setaccount,
    getaccount,
    getaccountaddress,
    getaddressesbyaccount,
    getbalance,
    getblock,
    getblockcount,
    getblockhash,
    getconnectioncount,
    getdifficulty,
    getgenerate,
    gethashespersec,
    gettransaction,
    listaccounts,
    listreceivedbyaccount,
    listreceivedbyaddress,
    listsinceblock,
    listtransactions,
    importprivkey,
    move,
    sendfrom,
    sendmany,
    sendtoaddress,
    validateaddress,
    getnewaddress,
    signmessage,
    verifymessage
  ]

  methods.forEach(function (f) {
    server.expose(f.name, parseArgs(f))
  })

  server.listen(options.rpcport, options.bind)
  var msg = 'blockchain.info rpc server v%s running on %s:%d'
  var warn = 'WARNING - Binding this service to any ip other than localhost (127.0.0.1) can lead to security vulnerabilities!'
  if (options.bind !== '127.0.0.1') winston.warn(warn)
  winston.info(msg, pkg.version, options.bind, options.rpcport)
  setInterval(metrics.recordHeartbeat, metrics.getHeartbeatInterval())
}

// RPC methods
getinfo.$params = []
function getinfo (params, wallet) {
  return Promise.all([
    bci.statistics.get(),
    request('https://blockchain.info/q/nconnected')
  ])
  .then(function (responses) {
    var stats = responses[0]
    var connected = responses[1]
    return {
      connected: parseInt(connected),
      difficulty: stats.difficulty,
      proxy: '',
      balance: satoshiToBTC(wallet.finalBalance),
      blocks: stats.n_blocks_total,
      testnet: false,
      errors: '',
      paytxfee: satoshiToBTC(wallet.fee_per_kb)
    }
  })
}

walletlock.$params = []
function walletlock (params, wallet) {
  secondPasswordStore.remove(wallet.guid)
  return true
}

settxfee.$params = ['amount']
function settxfee (params, wallet) {
  wallet.fee_per_kb = btcToSatoshi(params.amount)
  return true
}

walletpassphrase.$params = ['password', 'timeout']
function walletpassphrase (params, wallet) {
  if (!wallet.isDoubleEncrypted) {
    throw 'Error: running with an unencrypted wallet, but walletpassphrase was used'
  }
  if (!wallet.validateSecondPassword(params.password)) {
    throw 'The wallet passphrase entered was incorrect.'
  }
  secondPasswordStore.set(wallet.guid, params.password, params.timeout)
  return true
}

setaccount.$params = ['bitcoinAddress', 'label']
function setaccount (params, wallet) {
  var key = wallet.key(params.bitcoinAddress)
  if (!key) throw 'Address not found'
  key.label = params.label
  return key.label === params.label
}

getaccount.$params = ['bitcoinAddress']
function getaccount (params, wallet) {
  var key = wallet.key(params.bitcoinAddress)
  if (!key) throw 'Address not found'
  if (!key.label) throw 'Address is not in an account'
  return key.label
}

getaccountaddress.$params = ['label']
function getaccountaddress (params, wallet) {
  var labelFilter = filterBy('label', params.label)
  var key = wallet.keys.filter(labelFilter)[0] || wallet.key(params.label)
  if (!key) {
    var secondPassword = getSecondPasswordForWallet(wallet)
    key = wallet.newLegacyAddress(params.label, secondPassword)
  }
  return key.address
}

getaddressesbyaccount.$params = ['label']
function getaddressesbyaccount (params, wallet) {
  return getAccountKeys(wallet, params.label).map(pluck('address'))
}

getbalance.$params = ['account?']
function getbalance (params, wallet) {
  var balance = params.account
    ? getAccountKeys(wallet, params.account).map(pluck('balance')).reduce(add, 0)
    : wallet.finalBalance
  return satoshiToBTC(balance)
}

getblock.$params = ['blockHash']
getblock.$nowallet = true
function getblock (params) {
  return bci.blockexplorer.getBlock(params.blockHash).then(function (block) {
    return {
      tx: block.tx.map(pluck('hash')),
      time: block.time,
      height: block.height,
      nonce: block.nonce,
      hash: block.hash,
      bits: block.bits,
      merkleroot: block.mrkl_root,
      version: block.ver,
      size: block.size
    }
  })
}

getblockcount.$params = []
getblockcount.$nowallet = true
function getblockcount (params) {
  return bci.statistics.get({ stat: 'n_blocks_total' })
}

getblockhash.$params = ['blockHeight']
getblockhash.$nowallet = true
function getblockhash (params) {
  return bci.blockexplorer.getBlockHeight(params.blockHeight).then(function (r) {
    return r.blocks[0].hash
  })
}

getconnectioncount.$params = []
getconnectioncount.$nowallet = true
function getconnectioncount (params) {
  return request('https://blockchain.info/q/nconnected')
}

getdifficulty.$params = []
getdifficulty.$nowallet = true
function getdifficulty (params) {
  return bci.statistics.get({ stat: 'difficulty' })
}

getgenerate.$params = []
getgenerate.$nowallet = true
function getgenerate (params) {
  return false
}

gethashespersec.$params = []
gethashespersec.$nowallet = true
function gethashespersec (params) {
  return 0
}

gettransaction.$params = ['hash']
gettransaction.$nowallet = true
function gettransaction (params) {
  return bci.blockexplorer.getTx(params.hash)
}

listaccounts.$params = []
function listaccounts (params, wallet) {
  return wallet.keys.reduce(function (acc, key) {
    acc[key.address] = satoshiToBTC(key.balance)
    return acc
  }, {})
}

listreceivedbyaccount.$params = ['includeempty?']
function listreceivedbyaccount (params, wallet) {
  var accountMap = wallet.keys
    .map(function (key) {
      return { amount: key.totalReceived, address: key.address, account: key.label }
    })
    .reduce(function (acc, key) {
      var account = acc[key.account] || { amount: 0, addresses: [], label: key.account, account: key.account }
      account.addresses.push(key.address)
      account.amount += key.amount
      acc[key.account] = account
      return acc
    }, {})
  return Object.keys(accountMap)
    .map(function (key) {
      var keyObj = accountMap[key]
      keyObj.addresses = '[' + keyObj.addresses.join(', ') + ']'
      keyObj.amount = satoshiToBTC(keyObj.amount)
      return keyObj
    })
    .filter(function (key) { return key.amount !== 0 || params.includeempty })
}

listreceivedbyaddress.$params = ['includeempty?']
function listreceivedbyaddress (params, wallet) {
  return wallet.keys
    .map(function (key) { return { amount: key.totalReceived, address: key.address, account: key.label } })
    .filter(function (key) { return key.amount !== 0 || params.includeempty })
}

listsinceblock.$params = []
listsinceblock.$nowallet = true
function listsinceblock (params) {
  throw 'Unsupported method'
}

listtransactions.$params = ['account?', 'limit?', 'offset?']
function listtransactions (params, wallet) {
  if (!params.limit || params.limit > 25) params.limit = 25
  var addresses = params.account
    ? getAccountAddresses(wallet, params.account)
    : wallet.activeAddresses
  return bci.blockexplorer.getMultiAddress(addresses, params)
    .then(function (result) {
      return {
        lastblock: result.info.latest_block.hash,
        transactions: result.txs
      }
    })
}

importprivkey.$params = ['privateKey']
function importprivkey (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  return wallet.importLegacyAddress(params.privateKey, null, pass)
    .then(function (key) { return true })
    .catch(function (e) { return e === 'presentInWallet' })
}

move.$params = ['fromAccount', 'toAccount', 'amount']
function move (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  var from = getAccountAddresses(wallet, params.fromAccount)
  var to = getAccountAddresses(wallet, params.toAccount)[0]
  var amt = btcToSatoshi(params.amount)
  var fee = isNaN(wallet.fee_per_kb) ? 10000 : wallet.fee_per_kb

  var payment = wallet.createPayment().from(from).to(to).amount(amt).fee(fee)
  return publishPayment(payment, pass)
}

sendfrom.$params = ['fromAccount', 'bitcoinAddress', 'amount']
function sendfrom (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  var from = getAccountAddresses(wallet, params.fromAccount)
  var to = params.bitcoinAddress
  var amt = btcToSatoshi(params.amount)
  var fee = isNaN(wallet.fee_per_kb) ? 10000 : wallet.fee_per_kb

  var payment = wallet.createPayment().from(from).to(to).amount(amt).fee(fee)
  return publishPayment(payment, pass)
}

sendmany.$params = ['fromAccount', 'addressAmountPairs']
function sendmany (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  var from = getAccountAddresses(wallet, params.fromAccount)
  var fee = isNaN(wallet.fee_per_kb) ? 10000 : wallet.fee_per_kb
  var to = []
  var amts = []

  Object.keys(params.addressAmountPairs).forEach(function (address) {
    to.push(address)
    amts.push(btcToSatoshi(params.addressAmountPairs[address]))
  })

  var payment = wallet.createPayment().from(from).to(to).amount(amts).fee(fee)
  return publishPayment(payment, pass)
}

sendtoaddress.$params = ['bitcoinAddress', 'amount']
function sendtoaddress (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  var from = wallet.spendableActiveAddresses
  var to = params.bitcoinAddress
  var amt = btcToSatoshi(params.amount)
  var fee = isNaN(wallet.fee_per_kb) ? 10000 : wallet.fee_per_kb

  var payment = wallet.createPayment().from(from).to(to).amount(amt).fee(fee)
  return publishPayment(payment, pass)
}

validateaddress.$params = ['bitcoinAddress']
function validateaddress (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  var decipher = wcrypto.cipherFunction(pass, wallet.sharedKey, wallet.pbkdf2_iterations, 'dec')
  var key = wallet.key(params.bitcoinAddress)

  var compressed = false
  var pubkey = ''

  if (key && key.priv) {
    var priv = wallet.isDoubleEncrypted ? decipher(key.priv) : key.priv
    var format = helpers.detectPrivateKeyFormat(priv)
    var keypair = bitcoin.ECPair.fromWIF(helpers.privateKeyStringToKey(priv, format).toWIF())
    compressed = keypair.compressed
    pubkey = keypair.getPublicKeyBuffer().toString('hex')
  }

  return {
    address: params.bitcoinAddress,
    iscompressed: compressed,
    ismine: !!key && !!key.priv,
    isvalid: helpers.isBitcoinAddress(params.bitcoinAddress),
    account: key ? key.label : null,
    pubkey: pubkey
  }
}

getnewaddress.$params = ['label?']
function getnewaddress (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  var key = wallet.newLegacyAddress(params.label, pass)
  return key.address
}

signmessage.$params = ['bitcoinAddress', 'message']
function signmessage (params, wallet) {
  var pass = getSecondPasswordForWallet(wallet)
  var dec = wcrypto.cipherFunction(pass, wallet.sharedKey, wallet.pbkdf2_iterations, 'dec')
  var key = wallet.key(params.bitcoinAddress)

  if (!key) throw 'Private key is not known'

  var priv = wallet.isDoubleEncrypted ? dec(key.priv) : key.priv
  var format = helpers.detectPrivateKeyFormat(priv)
  var wif = helpers.privateKeyStringToKey(priv, format).toWIF()
  var keypair = bitcoin.ECPair.fromWIF(wif)

  return bitcoin.message.sign(keypair, params.message).toString('base64')
}

verifymessage.$params = ['bitcoinAddress', 'signature', 'message']
function verifymessage (params, wallet) {
  try {
    return bitcoin.message.verify(params.bitcoinAddress, params.signature, params.message)
  } catch (e) {
    return false
  }
}

// Helper functions
function parseArgs (f) {
  return function (args, opts, callback) {
    var credentials = auth(opts.req)
    var guid = credentials.name
    var walletOpts = { password: credentials.pass, apiCode: apiCode }

    if (!guid) throw 'Missing wallet guid'
    if (!walletOpts.password) throw 'Missing wallet password'

    if (args.length > f.$params.length) {
      throw 'Expected max of ' + f.$params.length + ' parameters, received ' + args.length
    }

    var params = f.$params
      .map(function (param, i) {
        return {
          name: param.split('?')[0],
          value: args[i],
          required: !~param.indexOf('?')
        }
      })
      .reduce(function (acc, param) {
        if (param.value == null && param.required) throw 'Missing parameter: ' + param.name
        acc[param.name] = param.value
        return acc
      }, {})

    var action = f.$nowallet
      ? Promise.resolve(f(params))
      : api.getWallet(guid, walletOpts).then(f.bind(f, params))

    action
      .then(callback.bind(null, null))
      .catch(callback)
  }
}

function satoshiToBTC (satoshi) {
  return parseFloat((satoshi / SATOSHI_PER_BTC).toFixed(8))
}

function btcToSatoshi (btc) {
  return parseInt(btc * SATOSHI_PER_BTC)
}

function pluck (p) {
  return function (o) { return o[p] }
}

function filterBy (p, val) {
  return function (o) { return o[p] === val }
}

function add (a, b) {
  return a + b
}

function getAccountKeys (wallet, account) {
  return helpers.isBitcoinAddress(account)
    ? [wallet.key(account)]
    : wallet.keys.filter(filterBy('label', account))
}

function getAccountAddresses (wallet, account) {
  return helpers.isBitcoinAddress(account)
    ? [account]
    : wallet.keys.filter(filterBy('label', account)).map(pluck('address'))
}

function publishPayment (payment, password) {
  return new Promise(function (resolve, reject) {
    payment.build()
      .then(function (p) {
        resolve(payment.sign(password).publish().payment)
        return p
      })
      .catch(function (e) {
        reject(e.error ? (e.error.message || e.error) : 'Failed to build transaction')
        return e.payment
      })
  }).then(function (tx) {
    metrics.recordSend()
    return pluck('txid')(tx)
  })
}

function getSecondPasswordForWallet (wallet) {
  var pass = secondPasswordStore.get(wallet.guid)
  if (wallet.isDoubleEncrypted && !pass) throw 'Second Password Expired'
  return pass
}

function TimedStore () {
  var store = {}
  this.set = function (key, val, seconds) {
    var unsetTimer = setTimeout(this.remove.bind(this, key), seconds * 1000)
    store[key] = { value: val, timer: unsetTimer }
  }
  this.get = function (key) {
    return store[key] && store[key].value
  }
  this.remove = function (key) {
    if (store[key] && store[key].timer) clearTimeout(store[key].timer)
    store[key] = undefined
  }
}
