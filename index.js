'use strict'

var colors = require('colors/safe')
var request = require('request-promise')
var semver = require('semver')
var registryUrl = require('registry-url')

var pkg = require('./package.json')
var format = require('./src/format')

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

function outputUpgradeWarning (latest) {
  var lines = [
    'This version is outdated! Latest version: ' + colors.bold.green(latest),
    'To upgrade, run: ' + colors.grey('npm install -g ' + pkg.name + '@' + latest)
  ]
  let warning = format.boxMessage(lines, { borderChar: colors.blue('*') })
  winston.warn('\n\n' + warning + '\n')
}

function checkForUpgrade () {
  var packageLatestUrl = registryUrl() + pkg.name + '/latest'
  request(packageLatestUrl).then(function (res) {
    var latest = JSON.parse(res).version
    if (semver.gt(latest, pkg.version)) { outputUpgradeWarning(latest) }
  })
}

checkForUpgrade()

module.exports = {
  start: server.start,
  startRPC: rpc.start
}
