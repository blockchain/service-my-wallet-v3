#!/usr/bin/env node

'use strict';

var pkg     = require('../package.json')
  , program = require('commander')
  , path    = require('path')
  , timers  = require('timers');

var defaults = {
  port: 3000,
  rpcport: 8000,
  bind: '127.0.0.1'
};

program
  .version(pkg.version)
  .usage('[command] [options]')
  .option('-c, --cwd', 'use the current directory as the wallet service (dev)');

program
  .command('start')
  .description('start a wallet api service server')
  .option('-p, --port <n>', 'port number - defaults to 3000', parseInt)
  .option('-b, --bind [ip]', 'bind to a specific ip - defaults to 127.0.0.1')
  .option('--ssl-key <path>', 'path to ssl key')
  .option('--ssl-cert <path>', 'path to ssl certificate')
  .action(postpone(start));

program
  .command('start-rpc')
  .description('start the rpc api server')
  .option('-k, --key [apikey]', 'api key to use for server requests - required')
  .option('-p, --rpcport <n>', 'port number - defaults to 8000', parseInt)
  .option('-b, --bind [ip]', 'bind to a specific ip - defaults to 127.0.0.1')
  .action(postpone(startrpc));

program.parse(process.argv);

var wallet = require(program.cwd ? process.cwd() : '..');

// Command functions
function start(options) {
  var startOptions = {
    port: options.port || defaults.port,
    bind: options.bind || defaults.bind,
    sslKey: options.sslKey,
    sslCert: options.sslCert
  };
  wallet.start(startOptions);
}

function startrpc(options) {
  var startOptions = {
    api_code: options.key,
    rpcport: options.rpcport || defaults.rpcport,
    bind: options.bind || defaults.bind
  };
  if (!startOptions.api_code) throw 'Missing required option: --key';
  wallet.startRPC(startOptions);
}

// Helper functions
function postpone(f) {
  return function (options) {
    timers.setTimeout(f.bind(null, options));
  };
}
