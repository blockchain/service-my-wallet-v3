
var WS_URL = 'wss://ws.blockchain.info/inv'

var winston = require('winston')
var crypto = require('crypto')

exports.handleSocketErrors = function (ws) {
  ws.wsUrl = WS_URL
  var initialize = ws._initialize.bind(ws)
  var handler = function (err) {
    winston.error('WebSocketError', { message: err.message, code: err.code })
  }
  ws._initialize = function () {
    initialize.apply(this, arguments)
    this.socket.on('error', handler)
  }
}

exports.substituteWithCryptoRNG = function (rng) {
  rng.run = crypto.randomBytes.bind(crypto)
}

exports.disableSyncWallet = function (instance) {
  instance.syncWallet = function () {
    winston.debug('prevented syncWallet')
  }
}

exports.clearModuleRequireCache = function () {
  var walletModule = 'blockchain-wallet-client-prebuilt'
  var walletModuleR = new RegExp(walletModule + '.(index|src)')
  Object.keys(require.cache)
    .filter(function (m) { return walletModuleR.test(m) })
    .forEach(function (m) { delete require.cache[m] })
}
