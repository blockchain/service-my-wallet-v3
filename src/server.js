'use strict';

var express     = require('express')
  , bodyParser  = require('body-parser')
  , ecodes      = require('./error-codes')
  , api         = require('./api');

module.exports = {
  start: start
};

var app         = express()
  , merchantAPI = express();

// Configuration
app.use('/merchant', merchantAPI);
merchantAPI.use(bodyParser.json());
merchantAPI.use(parseOptions());

// Routing
merchantAPI.all('/:guid/login', function (req, res) {
  api.login(req.params.guid, req.bc_options)
    .then(handleResponse(res))
    .catch(handleError(res));
});

merchantAPI.all('/:guid/balance', function (req, res) {
  api.getBalance(req.params.guid, req.bc_options)
    .then(handleResponse(res))
    .catch(handleError(res));
});

// Helper functions
function handleResponse(res) {
  return function (data) { res.status(200).json(data); };
}

function handleError(res) {
  return function (err) { res.status(500).json({ error: ecodes[err] }); };
}

function start(port) {
  app.listen(port, function () {
    console.log('blockchain.info wallet api running on port %d', port);
  });
}

// Custom middleware
function parseOptions() {
  return function (req, res, next) {
    var _q = req.query
      , _b = req.body;
    req.bc_options = {
      password  : _q.password || _b.password,
      api_code  : _q.api_code || _b.api_code
    };
    next();
  };
}
