'use strict';

var fs          = require('fs')
  , http        = require('http')
  , https       = require('https')
  , express     = require('express')
  , bodyParser  = require('body-parser')
  , q           = require('q')
  , winston     = require('winston')
  , ecodes      = require('./error-codes')
  , api         = require('./api');

module.exports = {
  start: start
};

var app         = express()
  , v2API       = express()
  , merchantAPI = express()
  , legacyAPI   = express()
  , accountsAPI = express();

// Configuration
app.use('/merchant/:guid', merchantAPI);
app.use('/api/v2', v2API);
merchantAPI.use('/', legacyAPI);
merchantAPI.use('/accounts', accountsAPI);

app.param('guid', setParam('guid'));
accountsAPI.param('account', setParam('account'));

app.use(function (req, res) {
  res.status(404).json({ error: 'Not found' });
});

legacyAPI.use(bodyParser.json());
legacyAPI.use(bodyParser.urlencoded({ extended: true }));
legacyAPI.use(parseOptions({
  password        : String,
  api_code        : String,
  address         : String,
  to              : String,
  from            : String,
  label           : String,
  recipients      : Identity,
  second_password : String,
  amount          : Number,
  fee             : Number,
  unsafe          : Boolean
}));

merchantAPI.all(
  '/login',
  required(['password']),
  callApi('login')
);

merchantAPI.all(
  '/enableHD',
  required(['password']),
  callApi('upgradeWallet')
);

// Routing: Legacy Wallet API
legacyAPI.all(
  '/balance',
  required(['password']),
  callApi('getBalance')
);

legacyAPI.all(
  '/list',
  required(['password']),
  callApi('listAddresses')
);

legacyAPI.all(
  '/address_balance',
  required(['address', 'password']),
  callApi('getAddressBalance')
);

legacyAPI.all(
  '/sendmany',
  required(['recipients', 'password']),
  callApi('sendMany')
);

legacyAPI.all(
  '/payment',
  required(['to', 'amount', 'password']),
  callApi('makePayment')
);

legacyAPI.all(
  '/new_address',
  required(['password']),
  callApi('generateAddress')
);

legacyAPI.all(
  '/archive_address',
  required(['address', 'password']),
  callApi('archiveAddress')
);

legacyAPI.all(
  '/unarchive_address',
  required(['address', 'password']),
  callApi('unarchiveAddress')
);

// Routing: HD Accounts API
accountsAPI.all(
  '/xpubs',
  required(['password']),
  callApi('listxPubs')
);

accountsAPI.all(
  '/create',
  required(['password']),
  callApi('createAccount')
);

accountsAPI.all(
  '/:account?',
  required(['password']),
  callApi('listAccounts')
);

accountsAPI.all(
  '/:account/receiveAddress',
  required(['password']),
  callApi('getReceiveAddress')
);

accountsAPI.all(
  '/:account/balance',
  required(['password']),
  callApi('getAccountBalance')
);

accountsAPI.all(
  '/:account/archive',
  required(['password']),
  callApi('archiveAccount')
);

accountsAPI.all(
  '/:account/unarchive',
  required(['password']),
  callApi('unarchiveAccount')
);

// v2 API
v2API.use(bodyParser.json());
v2API.use(bodyParser.urlencoded({ extended: true }));
v2API.use(parseOptions({
  password  : String,
  api_code  : String,
  priv      : String,
  label     : MaybeString,
  email     : MaybeString
}));

v2API.all(
  /\/create|\/create_wallet/,
  required(['password', 'api_code']),
  function (req, res) {
    var apiAction = api.createWallet(req.options);
    handleResponse(apiAction, res);
  }
);

// Custom middleware
function callApi(method) {
  return function (req, res) {
    var apiAction = api[method](req.guid, req.options);
    handleResponse(apiAction, res);
  };
}

function required(props) {
  props = props instanceof Array ? props : [props];
  return function (req, res, next) {
    for (var i = 0; i < props.length; i++) {
      var propExists = req.options[props[i]] != null;
      var err = interpretError('ERR_PARAM', { param: props[i] });
      if (!propExists) return handleResponse(q.reject(err), res, 400);
    }
    next();
  };
}

function parseOptions(whitelist) {
  return function (req, res, next) {
    req.options = {};
    Object.keys(whitelist).forEach(function (key) {
      var value = getParam(req, key);
      if (value !== undefined) value = whitelist[key](value);
      if (value !== undefined) req.options[key] = value;
    });
    next();
  };
  function getParam(req, key) {
    return req.query[key] == undefined ? req.body[key] : req.query[key];
  }
}

function setParam(paramName) {
  return function (req, res, next, value) {
    if (req.options) req.options[paramName] = value;
    req[paramName] = value;
    next();
  };
}

// Helper functions
function Identity(a) { return a; }
function MaybeString(s) { return s ? String(s) : undefined; }

function handleResponse(apiAction, res, errCode) {
  apiAction
    .then(function (data) { res.status(200).json(data); })
    .catch(function (e) {
      winston.error(e);
      var err = ecodes[e] || ecodes['ERR_UNEXPECT'];
      if (stringContains(e, 'Insufficient funds. Value Needed')) {
        var rgx = /Insufficient funds. Value Needed ([^\^]+)BTC. Available amount ([^\^]+)BTC/;
        var errData = e.match(rgx);
        return res.status(400).json({
          error: 'Insufficient funds',
          needed: errData ? parseFloat(errData[1]) : undefined,
          available: errData ? parseFloat(errData[2]) : undefined
        })
      }
      if (
        stringContains(e, 'Missing query parameter') ||
        stringContains(e, 'Error Decrypting Wallet')
      ) err = e;
      res.status(errCode || 500).json({ error: err });
    });
}

function stringContains(str0, str1) {
  if (!str0 || !str1) return false;
  return str0.toString().indexOf(str1) > -1;
}

function interpretError(code, bindings) {
  var template = ecodes[code];
  Object.keys(bindings).forEach(function (key) {
    template = template.replace('{'+key+'}', bindings[key]);
  });
  return template;
}

function start(options) {
  var deferred = q.defer();

  var ssl = options.sslKey && options.sslCert;
  var sslOpts = !ssl ? {} :
    { key : fs.readFileSync(options.sslKey)
    , cert: fs.readFileSync(options.sslCert) };

  var initApp = function () {
    var pkg   = require('../package.json')
      , msg   = 'blockchain.info wallet service v%s running on http%s://%s:%d'
      , warn  = 'WARNING - Binding this service to any ip other than localhost (127.0.0.1) can lead to security vulnerabilities!';

    if (options.bind !== '127.0.0.1') winston.warn(warn);
    winston.info(msg, pkg.version, ssl ? 's' : '', options.bind, options.port);
    deferred.resolve(true);
  };

  var handleStartError = function (err) { winston.error(err.message); };

  var server = ssl ? https.createServer(sslOpts, app) : http.createServer(app);
  server.listen(options.port, options.bind, initApp).on('error', handleStartError);

  return deferred.promise;
}
