#!/usr/bin/env node

'use strict';

var pkg     = require('../package.json')
  , program = require('commander')
  , path    = require('path')
  , timers  = require('timers');

program
  .version(pkg.version)
  .usage('[command] [options]')
  .option('-c, --cwd', 'use the current directory as the wallet service (dev)');

program
  .command('start')
  .description('start a wallet api service server')
  .option('-p, --port <n>', 'port number', parseInt)
  .action(postpone(start));

program.parse(process.argv);

var wallet = require(program.cwd ? process.cwd() : '..');

// Command functions
function start(options) {
  var startOptions = {
    port: options.port
  };
  wallet.start(startOptions);
}

// Helper functions
function postpone(f) {
  return function (options) {
    timers.setTimeout(f.bind(null, options));
  };
}
