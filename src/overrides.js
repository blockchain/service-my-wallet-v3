
var winston = require('winston')
  , crypto  = require('crypto');

exports.handleSocketErrors = function (ws) {
  var initialize = ws._initialize.bind(ws);
  var handler = function (err) {
    winston.error('WebSocketError', { message: err.message, code: err.code });
  };
  ws._initialize = function () {
    initialize.apply(this, arguments);
    this.socket.on('error', handler);
  };
};

exports.substituteWithCryptoRNG = function (rng) {
  rng.run = crypto.randomBytes.bind(crypto);
};
