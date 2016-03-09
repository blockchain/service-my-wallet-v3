'use strict';

var winston = require('winston');
winston.level = process.env.LOGLEVEL || 'info';
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { timestamp: Date.now });

var server  = require('./src/server')
  , rpc     = require('./src/rpc-server');

var extractWsError = /Websocket error: could not parse message data as JSON: ([^\^]+)/;
var consolelog = console.log.bind(console);

console.log = function (msg) {
  if (
    // "noise" messages, do not log
    stringContains(msg, 'Server Time offset') ||
    stringContains(msg, 'SAVE CALLED...')
  ) return;

  if (stringContains(msg, 'Websocket error:')) {
    winston.error('WebSocketError', { msg: msg.match(extractWsError)[1] });
    return;
  }

  if (stringContains(msg, 'Maximum concurrent requests')) {
    winston.error(msg.slice(0, msg.indexOf('. Please try again shortly')));
    return;
  }

  consolelog.apply(this, arguments);
};

function stringContains(str0, str1) {
  if (!str0 || !str1) return false;
  return str0.toString().indexOf(str1) > -1;
}

module.exports = {
  start: server.start,
  startRPC: rpc.start
};
