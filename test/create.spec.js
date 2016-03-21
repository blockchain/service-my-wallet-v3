'use strict';

var chai    = require('chai')
  , sinon   = require('sinon')
  , sinonChai       = require('sinon-chai')
  , chaiAsPromised  = require('chai-as-promised')
  , q       = require('q');

chai.use(sinonChai);
chai.use(chaiAsPromised);
var expect  = chai.expect;

var api = require('../src/api');
var create = require('../src/create');
var Blockchain = require('blockchain-wallet-client-prebuilt');
var WalletNetwork = require('blockchain-wallet-client-prebuilt/src/wallet-network');

var overrides = require('../src/overrides');
overrides.substituteWithCryptoRNG(Blockchain.RNG);

describe('create', function () {
  var uuid = 'asdfasdf-asdf-asdf-asdf-asdfasdfasdf';
  var mockAPI, mockNetwork;

  beforeEach(function () {
    mockAPI = sinon.mock(Blockchain.API);
    mockNetwork = sinon.mock(WalletNetwork);
    mockAPI.expects('securePost').once().returns(Promise.resolve());
  });

  afterEach(function () {
    mockAPI.restore();
    mockNetwork.restore();
  });

  describe('uuid generation', function () {

    var correct = Promise.resolve([uuid, uuid])
      , incorrect = Promise.resolve([uuid.slice(0, -1), uuid])
      , empty = Promise.resolve([]);

    it('should succeed with the proper uuids', function (done) {
      mockNetwork.expects('generateUUIDs').once().returns(correct);
      var p = create('password');
      expect(p).to.be.fulfilled.and.notify(done);
    });

    it('should fail when no uuids are returned', function (done) {
      mockNetwork.expects('generateUUIDs').once().returns(incorrect);
      var p = create('password');
      expect(p).to.be.rejectedWith('Error generating wallet identifier').and.notify(done);
    });

    it('should fail when an uuid is an improper length', function (done) {
      mockNetwork.expects('generateUUIDs').once().returns(empty);
      var p = create('password');
      expect(p).to.be.rejectedWith('Error generating wallet identifier').and.notify(done);
    });

  });

  describe('wallet', function () {

    var priv = 'L1tho6MMiuXdnZB8zJqKJ1Q7eTRRqQEnDGo5Zxnc6LhSaaAAnHAc'
      , addr = '1DxXgzLeXn3UxQKjBDhSX7kupt7AgS9UrJ';

    beforeEach(function () {
      mockAPI.expects('securePost').once().returns(Promise.resolve());
      mockNetwork.expects('generateUUIDs').once().returns(Promise.resolve([uuid, uuid]));
    });

    it('should fail when there is no password', function (done) {
      var p = create('');
      expect(p).to.be.rejectedWith('Password must exist and be shorter than 256 characters').and.notify(done);
    });

    it('should create with no options', function (done) {
      var p = create('password');
      expect(p).to.eventually.contain({ guid: uuid }).and.notify(done);
    });

    it('should create with a label', function (done) {
      var p = create('password', { firstLabel: 'some_label' });
      expect(p).to.eventually.contain({ label: 'some_label' }).and.notify(done);
    });

    it('should create with a private key', function (done) {
      var p = create('password', { privateKey: priv });
      expect(p).to.eventually.contain({ address: addr }).and.notify(done);
    });

  });

});
