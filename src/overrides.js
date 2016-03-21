
var winston = require('winston')
  , crypto  = require('crypto');

exports.handleSocketErrors = function (ws) {
  var connectOnce = ws.connectOnce.bind(ws);
  ws.connectOnce = function () {
    connectOnce.apply(this, arguments);
    this.socket.on('error', function (err) { winston.error('WebSocketError', { code: err.code }); });
  };
};

exports.substituteWithCryptoRNG = function (rng) {
  rng.run = crypto.randomBytes.bind(crypto);
};
