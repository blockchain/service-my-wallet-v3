'use strict';

var clientservice = require('../index')
  , config        = require('../spec.config')
  , request       = require('request-promise')
  , chai          = require('chai')
  , expect        = chai.expect;


before(function (done) {
  clientservice.start({ port: config.port }).then(function () {
    done();
  });
});

describe('service-integration-testing', function () {
  config.testWallets.forEach(function (wallet) {

    var address;
    var url = 'http://localhost:' + config.port + '/merchant/' + wallet.guid;

    describe('testing: ' + wallet.guid, function () {

      it('should login', function (done) {
        makeRequest('/login', { password: wallet.password, api_code: wallet.api_code })
          .then(function (result) {
            expect(result.success).to.equal(true);
            expect(result.message).to.not.be.undefined;
            done()
          });
      });

      it('should get the balance', function (done) {
        makeRequest('/balance', { password: wallet.password, api_code: wallet.api_code })
          .then(function (result) {
            expect(result.balance).to.be.at.least(0);
            done();
          });
      });

      it('should list the addresses', function (done) {
        makeRequest('/list', { password: wallet.password, api_code: wallet.api_code })
          .then(function (result) {
            console.log(result);
            expect(result.addresses).to.have.length.above(0);
            address = result.addresses[0].address;
            done();
          });
      });

      it('should get the balance of an address', function (done) {
        makeRequest('/address_balance', { password: wallet.password, address: address, api_code: wallet.api_code })
          .then(function (result) {
            expect(result.balance).to.be.at.least(0);
            expect(result.total_received).to.be.at.least(0);
            expect(result.address).to.equal(address);
            done();
          });
      });

      it('should generate a new address', function (done) {
        makeRequest('/new_address', { password: wallet.password, label: 'new_address_label', api_code: wallet.api_code })
          .then(function (result) {
            console.log(result);
            expect(result.address).to.not.be.undefined;
            expect(result.label).to.equal('new_address_label');
            done();
          });
      });

      it('should archive an address', function (done) {
        makeRequest('/archive_address', { password: wallet.password, address: address, api_code: wallet.api_code })
          .then(function (result) {
            expect(result.archived).to.not.be.undefined;
            done();
          });
      });

      it('should unarchive an address', function (done) {
        makeRequest('/unarchive_address', { password: wallet.password, address: address, api_code: wallet.api_code })
          .then(function (result) {
            expect(result.active).to.not.be.undefined;
            done();
          });
      });

    });

    // Helper functions
    function makeRequest(api, qs) {
      return request({
        url: url + api,
        method: 'GET',
        qs: qs,
        json: true
      });
    }

  });
});
