
var ONE_MINUTE = 60000
var HEARTBEAT_INTERVAL = 10 * ONE_MINUTE
var EVENT_URL = 'https://blockchain.info/event'

var request = require('request-promise')
var winston = require('winston')

function recordEvent (name) {
  winston.debug('Recording smwv3 event', { name: name })
  request(EVENT_URL + '?name=' + smwv3Event(name))
}

function smwv3Event (name) {
  return 'wallet_smwv3_' + name
}

module.exports = {
  recordHeartbeat: recordEvent.bind(null, 'heartbeat_10m'),
  recordSend: recordEvent.bind(null, 'send'),
  recordReceive: recordEvent.bind(null, 'recv'),
  getHeartbeatInterval: function () { return HEARTBEAT_INTERVAL }
}
