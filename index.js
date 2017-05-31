'use strict'

var winston = require('winston')
winston.level = process.env.LOGLEVEL || 'info'
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, { timestamp: Date.now })

// handle top level exceptions
process.on('uncaughtException', winston.error)

var server = require('./src/server')
var rpc = require('./src/rpc-server')

var extractWsError = /Websocket error: could not parse message data as JSON: ([^]+)/
var consolelog = console.log.bind(console)

console.log = function (msg) {
  if (
    // "noise" messages, do not log
    stringContains(msg, 'Server Time offset') ||
    stringContains(msg, 'SAVE CALLED...') ||
    stringContains(msg, 'published') ||
    stringContains(msg, 'No free outputs to spend') ||
    stringContains(msg && msg.initial_error, 'Connectivity error')
  ) return

  if (stringContains(msg, 'Websocket error:')) {
    winston.error('WebSocketError', { message: msg.match(extractWsError)[1] })
    return
  }

  if (
    stringContains(msg, 'Maximum concurrent requests') ||
    stringContains(msg, 'Unknown API Key')
  ) {
    winston.error(msg)
    return
  }

  consolelog.apply(this, arguments)
}

function stringContains (str0, str1) {
  if (!str0 || !str1) return false
  return str0.toString().indexOf(str1) > -1
}

module.exports = {
  start: function (options) {
    winston.level = options.logLevel || winston.level
    return server.start(options)
  },
  startRPC: rpc.start
}
