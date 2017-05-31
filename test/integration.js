let clientservice = require('../index')
let config = require('../spec.config')
let request = require('request-promise')
let chai = require('chai')
let expect = chai.expect

before((done) => {
  clientservice.start({ port: config.port }).then(() => {
    done()
  })
})

describe('service-integration-testing', () => {
  let randString = () => Math.random().toString(36).slice(2)

  config.testWallets.forEach((wallet) => {
    let address
    let url = 'http://localhost:' + config.port + '/merchant/' + wallet.guid

    let makeRequest = (api, qs = {}) => request({
      url: url + api,
      method: 'GET',
      qs: Object.assign({}, wallet, qs),
      json: true
    })

    describe('testing: ' + wallet.guid, () => {
      it('should login', (done) => {
        makeRequest('/login')
          .then((result) => {
            expect(result.success).to.equal(true)
            expect(result.message).to.not.be.undefined
            done()
          })
      })

      it('should get the balance', (done) => {
        makeRequest('/balance')
          .then((result) => {
            expect(result.balance).to.be.at.least(0)
            done()
          })
      })

      it('should generate a new address', (done) => {
        makeRequest('/new_address', { label: 'new_address_label' })
          .then((result) => {
            expect(result.address).to.not.be.undefined
            expect(result.label).to.equal('new_address_label')
            done()
          })
      })

      it('should list the addresses', (done) => {
        makeRequest('/list')
          .then((result) => {
            expect(result.addresses).to.have.length.above(0)
            address = result.addresses[0].address
            done()
          })
      })

      it('should get the balance of an address', (done) => {
        makeRequest('/address_balance', { address: address })
          .then((result) => {
            expect(result.balance).to.be.at.least(0)
            expect(result.total_received).to.be.at.least(0)
            expect(result.address).to.equal(address)
            done()
          })
      })

      it('should archive an address', (done) => {
        makeRequest('/archive_address', { address: address })
          .then((result) => {
            expect(result.archived).to.not.be.undefined
            done()
          })
      })

      it('should unarchive an address', (done) => {
        makeRequest('/unarchive_address', { address: address })
          .then((result) => {
            expect(result.active).to.not.be.undefined
            done()
          })
      })

      it('should list hd accounts', (done) => {
        makeRequest('/accounts')
          .then((result) => {
            expect(result).to.have.length.above(0)
            expect(result[0]).to.not.be.undefined
            done()
          })
      })

      it('should list hd xpubs', (done) => {
        makeRequest('/accounts/xpubs')
          .then((result) => {
            expect(result).to.have.length.above(0)
            expect(result[0]).to.not.be.undefined
            done()
          })
      })

      it('should create a new hd account', (done) => {
        let label = randString()
        makeRequest('/accounts/create', { label })
          .then((result) => {
            expect(result.label).to.equal(label)
            expect(result.archived).to.equal(false)
            expect(result.address_labels).to.have.length.of(0)
            done()
          })
      })

      it('should get account by index', (done) => {
        makeRequest('/accounts/0')
          .then((result) => {
            expect(result.balance).to.be.at.least(0)
            expect(result.index).to.equal(0)
            expect(result.archived).to.not.be.undefined
            expect(result.extendedPublicKey).to.not.be.undefined
            expect(result.extendedPrivateKey).to.not.be.undefined
            expect(result.receiveIndex).to.not.be.undefined
            expect(result.lastUsedReceiveIndex).to.not.be.undefined
            expect(result.receiveAddress).to.not.be.undefined
            done()
          })
      })

      it('should get account balance by index', (done) => {
        makeRequest('/accounts/0/balance')
          .then((result) => {
            expect(result.balance).to.be.at.least(0)
            done()
          })
      })
    })
  })
})
