'use strict';

try {
  require('node-env-file')('env');
} catch (e) {
  console.log(e);
} finally {
  var merchantAPI = require('../index.js');
  merchantAPI.start({ port: process.env.PORT || 5000 });
}
