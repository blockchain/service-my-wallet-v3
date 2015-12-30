'use strict';

var express     = require('express')
  , bodyParser  = require('body-parser')
  , q           = require('q')
  , ecodes      = require('./error-codes')
  , api         = require('./api');

module.exports = {
  start: start
};

var app         = express()
  , merchantAPI = express();

// Configuration
app.use('/merchant', merchantAPI);
app.use(function (req, res) {
  res.status(404).json({ error: 'Not found' });
});

merchantAPI.use(bodyParser.json());
merchantAPI.use(parseOptions({
  password        : String,
  api_code        : String,
  address         : String,
  to              : String,
  from            : String,
  note            : String,
  label           : String,
  recipients      : Identity,
  second_password : String,
  amount          : Number,
  fee             : Number,
  unsafe          : Boolean
}));

// Routing
merchantAPI.all(
  '/:guid/login',
  required(['password', 'api_code']),
  callApi('login')
);

merchantAPI.all(
  '/:guid/balance',
  required('password'),
  callApi('getBalance')
);

merchantAPI.all(
  '/:guid/list',
  required('password'),
  callApi('listAddresses')
);

merchantAPI.all(
  '/:guid/address_balance',
  required(['address', 'password']),
  callApi('getAddressBalance')
);

merchantAPI.all(
  '/:guid/sendmany',
  required(['recipients', 'password']),
  callApi('sendMany')
);

merchantAPI.all(
  '/:guid/payment',
  required(['to', 'amount', 'password']),
  callApi('makePayment')
);

merchantAPI.all(
  '/:guid/new_address',
  required('password'),
  callApi('generateAddress')
);

merchantAPI.all(
  '/:guid/archive_address',
  required(['address', 'password']),
  callApi('archiveAddress')
);

merchantAPI.all(
  '/:guid/unarchive_address',
  required(['address', 'password']),
  callApi('unarchiveAddress')
);

// Custom middleware
function callApi(method) {
  return function (req, res) {
    var apiAction = api[method](req.params.guid, req.bc_options);
    handleResponse(apiAction, res);
  };
}

function required(props) {
  props = props instanceof Array ? props : [props];
  return function (req, res, next) {
    for (var i = 0; i < props.length; i++) {
      var propExists = req.bc_options[props[i]] != null;
      var err = interpretError('ERR_PARAM', { param: props[i] });
      if (!propExists) return handleResponse(q.reject(err), res, 400);
    }
    next();
  };
}

function parseOptions(whitelist) {
  return function (req, res, next) {
    req.bc_options = {};
    Object.keys(whitelist).forEach(function (key) {
      var value = whitelist[key](req.query[key] || req.body[key] || '') || undefined;
      if (value !== undefined) req.bc_options[key] = value;
    });
    next();
  };
}

// Helper functions
function Identity(a) { return a; }

function handleResponse(apiAction, res, errCode) {
  apiAction
    .then(function (data) { res.status(200).json(data); })
    .catch(function (e) {
      console.log(e);
      var err = ecodes[e] || e || ecodes['ERR_UNEXPECT'];
      res.status(errCode || 500).json({ error: err });
    });
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
  app.listen(options.port, options.bind, function () {
    var msg   = 'blockchain.info wallet service running on %s:%d'
      , warn  = 'WARNING - Binding this service to any ip other than localhost (127.0.0.1) can lead to security vulnerabilities!';
    if (options.bind !== '127.0.0.1') console.log(warn);
    console.log(msg, options.bind, options.port);
    deferred.resolve(true);
  });
  return deferred.promise;
}
