'use strict'

var fs = require('fs')
var http = require('http')
var https = require('https')
var express = require('express')
var bodyParser = require('body-parser')
var q = require('q')
var winston = require('winston')
var ecodes = require('./error-codes')
var api = require('./api')
var metrics = require('./metrics')
var warnings = require('./warnings')

module.exports = {
  start: start
}

var app = express()
var v2API = express()
var merchantAPI = express()
var legacyAPI = express()
var accountsAPI = express()

// Configuration
app.use('/merchant/:guid', merchantAPI)
app.use('/api/v2', v2API)
merchantAPI.use('/', legacyAPI)
merchantAPI.use('/accounts', accountsAPI)

app.param('guid', setParam('guid'))
accountsAPI.param('account', setParam('account'))

app.use(function (req, res) {
  res.status(404).json({ error: 'Not found' })
})

legacyAPI.use(bodyParser.json())
legacyAPI.use(bodyParser.urlencoded({ extended: true }))
legacyAPI.use(parseOptions({
  password: String,
  api_code: String,
  address: String,
  to: String,
  from: String,
  label: String,
  recipients: Identity,
  fee_per_byte: Number,
  second_password: String,
  amount: Number,
  fee: Number,
  unsafe: Boolean
}))

merchantAPI.all(
  '/login',
  required(['password']),
  callApi('login')
)

merchantAPI.all(
  '/enableHD',
  required(['password']),
  callApi('upgradeWallet')
)

// Routing: Legacy Wallet API
legacyAPI.all(
  '/balance',
  required(['password']),
  callApi('getBalance')
)

legacyAPI.all(
  '/list',
  deprecate(),
  required(['password']),
  callApi('listAddresses')
)

legacyAPI.all(
  '/address_balance',
  deprecate(),
  required(['address', 'password']),
  callApi('getAddressBalance')
)

legacyAPI.all(
  '/sendmany',
  required(['recipients', 'password']),
  callApi('sendMany')
)

legacyAPI.all(
  '/payment',
  required(['to', 'amount', 'password']),
  callApi('makePayment')
)

legacyAPI.all(
  '/new_address',
  deprecate(),
  required(['password']),
  callApi('generateAddress')
)

legacyAPI.all(
  '/archive_address',
  deprecate(),
  required(['address', 'password']),
  callApi('archiveAddress')
)

legacyAPI.all(
  '/unarchive_address',
  deprecate(),
  required(['address', 'password']),
  callApi('unarchiveAddress')
)

// Routing: HD Accounts API
accountsAPI.all(
  '/xpubs',
  required(['password']),
  callApi('listxPubs')
)

accountsAPI.all(
  '/create',
  required(['password']),
  callApi('createAccount')
)

accountsAPI.all(
  '/:account?',
  required(['password']),
  callApi('listAccounts')
)

accountsAPI.all(
  '/:account/receiveAddress',
  required(['password']),
  callApi('getReceiveAddress')
)

accountsAPI.all(
  '/:account/balance',
  required(['password']),
  callApi('getAccountBalance')
)

accountsAPI.all(
  '/:account/archive',
  required(['password']),
  callApi('archiveAccount')
)

accountsAPI.all(
  '/:account/unarchive',
  required(['password']),
  callApi('unarchiveAccount')
)

// v2 API
v2API.use(bodyParser.json())
v2API.use(bodyParser.urlencoded({ extended: true }))
v2API.use(parseOptions({
  password: String,
  hd: Boolean,
  api_code: String,
  priv: String,
  second_password: MaybeString,
  label: MaybeString,
  email: MaybeString
}))

v2API.all(
  ['/create', '/create_wallet'],
  required(['password', 'api_code']),
  function (req, res) {
    var apiAction = api.createWallet(req.options)
    handleResponse(apiAction, res)
  }
)

// Custom middleware
function callApi (method) {
  return function (req, res) {
    var apiAction = api[method](req.guid, req.options)
    handleResponse(apiAction, res)
  }
}

function deprecate () {
  return function (req, res, next) {
    res.deprecationWarning = warnings.LEGACY_DECPRECATED
    next()
  }
}

function required (props) {
  props = props instanceof Array ? props : [props]
  return function (req, res, next) {
    for (var i = 0; i < props.length; i++) {
      var propExists = req.options[props[i]] != null
      var err = interpretError('ERR_PARAM', { param: props[i] })
      if (!propExists) return handleResponse(q.reject(err), res, 400)
    }
    next()
  }
}

function parseOptions (whitelist) {
  return function (req, res, next) {
    req.options = {}
    Object.keys(whitelist).forEach(function (key) {
      var value = getParam(req, key)
      if (value !== undefined) value = whitelist[key](value)
      if (value !== undefined) req.options[key] = value
    })
    next()
  }
  function getParam (req, key) {
    return req.query[key] == null ? req.body[key] : req.query[key]
  }
}

function setParam (paramName) {
  return function (req, res, next, value) {
    if (req.options) req.options[paramName] = value
    req[paramName] = value
    next()
  }
}

// Helper functions
function Identity (a) { return a }
function MaybeString (s) { return s ? String(s) : undefined }

function handleResponse (apiAction, res, errCode) {
  var addWarning = function (data) {
    var warning = res.deprecationWarning
    return warning ? Object.assign({}, data, { warning: warning }) : data
  }

  apiAction
    .then(function (data) { res.status(200).json(addWarning(data)) })
    .catch(function (e) {
      if (typeof e === 'object') {
        winston.error(e.error, e)
        res.status(errCode || 500).json(addWarning(e))
      } else {
        winston.error(e)
        var err = ecodes[e] || ecodes['ERR_UNEXPECT']
        if (
          stringContains(e, 'Missing query parameter') ||
          stringContains(e, 'Error Decrypting Wallet')
        ) err = e
        res.status(errCode || 500).json(addWarning({ error: err }))
      }
    })
}

function stringContains (str0, str1) {
  if (!str0 || !str1) return false
  return str0.toString().indexOf(str1) > -1
}

function interpretError (code, bindings) {
  var template = ecodes[code]
  Object.keys(bindings).forEach(function (key) {
    template = template.replace('{' + key + '}', bindings[key])
  })
  return template
}

function start (options) {
  var deferred = q.defer()

  var ssl = options.sslKey && options.sslCert
  var sslOpts = !ssl ? {} : {
    key: fs.readFileSync(options.sslKey),
    cert: fs.readFileSync(options.sslCert)
  }

  var initApp = function () {
    var pkg = require('../package.json')
    var msg = 'blockchain.info wallet service v%s running on http%s://%s:%d'

    if (options.bind !== '127.0.0.1') winston.warn(warnings.BIND_TO_LOCALHOST)
    winston.debug('Debug messages are enabled')
    winston.info(msg, pkg.version, ssl ? 's' : '', options.bind, options.port)
    setInterval(metrics.recordHeartbeat, metrics.getHeartbeatInterval())
    deferred.resolve(true)
  }

  var handleStartError = function (err) { winston.error(err.message) }

  var server = ssl ? https.createServer(sslOpts, app) : http.createServer(app)
  server.listen(options.port, options.bind, initApp).on('error', handleStartError)

  return deferred.promise
}
