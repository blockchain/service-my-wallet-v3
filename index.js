'use strict';

var winston = require('winston');
winston.level = process.env.LOGLEVEL || 'info';
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { timestamp: Date.now });

// handle top level exceptions
process.on('uncaughtException', winston.error);

var server  = require('./src/server')
  , rpc     = require('./src/rpc-server');

var extractWsError = /Websocket error: could not parse message data as JSON: ([^\^]+)/;
var consolelog = console.log.bind(console);
var consolewarn = console.warn.bind(console);
var consoleerror = console.error.bind(console);

console.log = function (msg) {
  if (
    // "noise" messages, do not log
    stringContains(msg, 'Server Time offset') ||
    stringContains(msg, 'SAVE CALLED...') ||
    stringContains(msg, 'published') ||
    stringContains(msg, 'No free outputs to spend')
  ) return;

  if (stringContains(msg, 'Websocket error:')) {
    winston.error('WebSocketError', { msg: msg.match(extractWsError)[1] });
    return;
  }

  if (
    stringContains(msg, 'Maximum concurrent requests') ||
    stringContains(msg, 'Unknown API Key')
  ) {
    winston.error(msg);
    return;
  }

  consolelog.apply(this, arguments);
};

console.warn = function (msg) {
  if (
    // bitcoinjs deprecation warning, safe to ignore
    stringContains(msg, 'Transaction.prototype.')
  ) return;

  consolewarn.apply(this, arguments);
};

console.error = function (msg) {
  if (
    stringContains(msg, 'Unknown Key Format')
  ) return;

  consoleerror.apply(this, arguments);
};

function stringContains(str0, str1) {
  if (!str0 || !str1) return false;
  return str0.toString().indexOf(str1) > -1;
}

module.exports = {
  start: server.start,
  startRPC: rpc.start
};
