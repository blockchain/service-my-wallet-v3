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
  var apiAction = api.login(req.params.guid, req.bc_options);
  handleResponse(apiAction, res);
});

merchantAPI.all('/:guid/balance', function (req, res) {
  var apiAction = api.getBalance(req.params.guid, req.bc_options);
  handleResponse(apiAction, res);
});

// Helper functions
function handleResponse(apiAction, res) {
  apiAction
    .then(function (data) { res.status(200).json(data); })
    .catch(function (err) { res.status(500).json({ error: ecodes[err] }); })
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
