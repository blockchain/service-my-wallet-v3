'use strict';

var server  = require('./src/server')
  , rpc     = require('./src/rpc-server');

module.exports = {
  start: server.start,
  startRPC: rpc.start
};
