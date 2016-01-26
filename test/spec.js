'use strict';

var chai    = require('chai')
  , spies   = require('chai-spies')
  , q       = require('q');

chai.use(spies);
var expect  = chai.expect;

var api     = require('../src/api')
  , wallet  = require('./wallet.mock');

api.getWallet = function (guid, options) {
  return q(wallet);
};

api.getWalletHD = function (guid, options) {
  return q(wallet.hdwallet);
};

describe('service-my-wallet-v3', function () {

  var guid = 'guidguid-guid-guid-guid-guidguidguid';
  var options = {
    password: 'pass123',
    address: 'address1',
    label: 'address_label',
    second_password: '2pass'
  };

  describe('getBalance', function () {
    it('should get the right balance', function (done) {
      api.getBalance(guid, options).then(function (result) {
        expect(result.balance).to.equal(wallet.finalBalance);
        done();
      });
    });
  });

  describe('listAddresses', function () {
    it('should list the active keys', function (done) {
      api.listAddresses(guid, options).then(function (result) {
        var firstKey = wallet.activeKeys[0];
        expect(result.addresses.length).to.equal(wallet.activeKeys.length);
        expect(result.addresses[0]).to.deep.equal({
          address: firstKey.address,
          label: firstKey.label,
          balance: firstKey.balance,
          total_received: firstKey.totalReceived
        });
        done();
      });
    });
  });

  describe('getAddressBalance', function () {
    it('should get the first address balance', function (done) {
      api.getAddressBalance(guid, options).then(function (result) {
        var firstKey = wallet.activeKeys[0];
        expect(result).to.deep.equal({
          balance: firstKey.balance,
          address: firstKey.address,
          total_received: firstKey.totalReceived
        });
        done();
      });
    });
  });

  describe('generateAddress', function () {
    it('should call wallet.newLegacyAddress', function (done) {
      chai.spy.on(wallet, 'newLegacyAddress');
      api.generateAddress(guid, options).then(function (result) {
        expect(wallet.newLegacyAddress).to.have.been.called.with(options.label, options.second_password);
        done();
      });
    });
    it('should send the new address information', function (done) {
      api.generateAddress(guid, options).then(function (result) {
        expect(result).to.deep.equal({
          address: 'generated',
          label: 'my new address'
        });
        done();
      });
    });
  });

  describe('archiveAddress', function () {
    it('should archive the address', function (done) {
      api.archiveAddress(guid, options).then(function (result) {
        expect(result.archived).to.equal(options.address);
        done();
      });
    });
  });

  describe('unarchiveAddress', function () {
    it('should unarchive the address', function (done) {
      api.unarchiveAddress(guid, options).then(function (result) {
        expect(result.active).to.equal(options.address);
        done();
      });
    });
  });

  describe('listxPubs', function () {
    it('should list xpubs', function (done) {
      api.listxPubs(guid, options).then(function (result) {
        expect(result[0]).to.equal('xpub123456');
        done();
      });
    });
  });

  describe('createAccount', function () {
    it('should create an account', function (done) {
      api.createAccount(guid, options).then(function (result) {
        expect(result.label).to.equal('my new account');
        done();
      });
    });
  });

});
