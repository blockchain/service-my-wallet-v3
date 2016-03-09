'use strict';

var winston = require('winston');
winston.level = process.env.LOGLEVEL || 'info';
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { timestamp: Date.now });

var server  = require('./src/server')
  , rpc     = require('./src/rpc-server');

// catch excessive logging from my-wallet-v3
var loglist = [
  'Server Time offset',
  'SAVE CALLED...'
];

var log = console.log.bind(console);
console.log = function (text) {
  if (loglist.some(stringContains.bind(null, text))) return;
  log.apply(this, arguments);
};

function stringContains(str0, str1) {
  if (!str0 || !str1) return false;
  return str0.toString().indexOf(str1) > -1;
}

module.exports = {
  start: server.start,
  startRPC: rpc.start
};
