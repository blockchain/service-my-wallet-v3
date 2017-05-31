#!/usr/bin/env node

'use strict'

var pkg = require('../package.json')
var format = require('../src/format')

var program = require('commander')
var timers = require('timers')
var winston = require('winston')
var colors = require('colors/safe')
var request = require('request-promise')
var semver = require('semver')
var registryUrl = require('registry-url')

var defaults = {
  port: 3000,
  rpcport: 8000,
  bind: '127.0.0.1'
}

program
  .version(pkg.version)
  .usage('[command] [options]')
  .option('-c, --cwd', 'use the current directory as the wallet service (dev)')

program
  .command('start')
  .description('start a wallet api service server')
  .option('-p, --port <n>', 'port number - defaults to 3000', parseInt)
  .option('-b, --bind [ip]', 'bind to a specific ip - defaults to 127.0.0.1')
  .option('--log-level [level]', 'log level to use - defaults to \'info\'')
  .option('--ssl-key <path>', 'path to ssl key')
  .option('--ssl-cert <path>', 'path to ssl certificate')
  .action(postpone(start))

program
  .command('start-rpc')
  .description('start the rpc api server')
  .option('-k, --key [apikey]', 'api key to use for server requests - required')
  .option('-p, --rpcport <n>', 'port number - defaults to 8000', parseInt)
  .option('-b, --bind [ip]', 'bind to a specific ip - defaults to 127.0.0.1')
  .action(postpone(startrpc))

program.parse(process.argv)

var wallet = require(program.cwd ? process.cwd() : '..')

function start (options) {
  var startOptions = {
    port: options.port || defaults.port,
    bind: options.bind || defaults.bind,
    logLevel: options.logLevel,
    sslKey: options.sslKey,
    sslCert: options.sslCert
  }
  checkForUpgrade()
  wallet.start(startOptions)
}

function startrpc (options) {
  var startOptions = {
    api_code: options.key,
    rpcport: options.rpcport || defaults.rpcport,
    bind: options.bind || defaults.bind
  }
  checkForUpgrade()
  wallet.startRPC(startOptions)
}

function postpone (f) {
  return function (options) {
    timers.setTimeout(f.bind(null, options))
  }
}

function checkForUpgrade () {
  var packageLatestUrl = registryUrl() + pkg.name + '/latest'
  request(packageLatestUrl).then(function (res) {
    var latest = JSON.parse(res).version
    if (semver.gt(latest, pkg.version)) { outputUpgradeWarning(latest) }
  })
}

function outputUpgradeWarning (latest) {
  var lines = [
    'This version is outdated! Latest version: ' + colors.bold.green(latest),
    'To upgrade, run: ' + colors.grey('npm install -g ' + pkg.name + '@' + latest)
  ]
  var warning = format.boxMessage(lines, { borderChar: colors.blue('*') })
  winston.warn('\n\n' + warning + '\n')
}
