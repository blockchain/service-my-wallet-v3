
var WS_URL = 'wss://ws.blockchain.info/inv'

var path = require('path')
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
  var walletModule = 'blockchain-wallet-client' + path.sep + 'lib'
  Object.keys(require.cache)
    .filter(function (m) { return m.indexOf(walletModule) > -1 })
    .forEach(function (m) { delete require.cache[m] })
}

exports.configureApiUrls = function (api) {
  api.ROOT_URL = process.env.ROOT_URL || 'https://blockchain.info/'
  api.API_ROOT_URL = process.env.API_ROOT_URL || 'https://api.blockchain.info/'
}
