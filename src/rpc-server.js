'use strict';

var SATOSHI_PER_BTC = 100000000;

var rpc   = require('json-rpc2')
  , auth  = require('basic-auth')
  , bci   = require('blockchain.info')
  , api   = require('./api');

var api_code = '';
var secondPasswordStore = new TimedStore();

module.exports = {
  start: start
};

function start(options) {
  options = options || {};
  options.rpcport = options.rpcport || 8000;
  api_code = options.api_code;

  var server = rpc.Server.$create();

  var methods = [
    getinfo,
    walletlock,
    settxfee,
    walletpassphrase,
    setaccount,
    getaccount,
    getaccountaddress,
    getaddressesbyaccount,
    getbalance,
    getblock,
    getblockcount,
    getblockhash,
    getdifficulty,
    getgenerate,
    gethashespersec,
    gettransaction,
    listaccounts,
    listreceivedbyaccount,
    listreceivedbyaddress
  ];

  methods.forEach(function (f) {
    server.expose(f.name, parseArgs(f));
  });

  server.listen(options.rpcport, function () {
    var msg = 'blockchain.info rpc server running on %d';
    console.log(msg, options.rpcport);
  });
}

// RPC methods
getinfo.$params = [];
function getinfo(params, wallet) {
  return bci.statistics.get().then(function (stats) {
    return {
      difficulty: stats.difficulty,
      proxy: '',
      balance: satoshiToBTC(wallet.finalBalance),
      blocks: stats.n_blocks_total,
      testnet: false,
      errors: '',
      paytxfee: satoshiToBTC(wallet.fee_per_kb)
    };
  });
}

walletlock.$params = [];
function walletlock(params, wallet) {
  secondPasswordStore.remove(wallet.guid);
  return true;
}

settxfee.$params = ['amount'];
function settxfee(params, wallet) {
  wallet.fee_per_kb = btcToSatoshi(params.amount);
  return true;
}

walletpassphrase.$params = ['password', 'timeout'];
function walletpassphrase(params, wallet) {
  if(!wallet.isDoubleEncrypted)
    throw 'Error: running with an unencrypted wallet, but walletpassphrase was used';
  if(!wallet.validateSecondPassword(params.password))
    throw 'The wallet passphrase entered was incorrect.';
  secondPasswordStore.set(wallet.guid, params.password, params.timeout);
  return true;
}

setaccount.$params = ['bitcoinAddress', 'label'];
function setaccount(params, wallet) {
  var key = wallet.key(params.bitcoinAddress);
  key.label = params.label;
  return key.label === params.label;
}

getaccount.$params = ['bitcoinAddress'];
function getaccount(params, wallet) {
  var key = wallet.key(params.bitcoinAddress);
  if (!key) throw 'Address not found';
  return key.label;
}

getaccountaddress.$params = ['label'];
function getaccountaddress(params, wallet) {
  var labelFilter = filterBy('label', params.label);
  var key = wallet.keys.filter(labelFilter)[0] || wallet.key(params.label);
  if (!key) {
    var secondPassword = secondPasswordStore.get(wallet.guid);
    if (wallet.isDoubleEncrypted && !secondPassword) throw 'Second Password Expired';
    key = wallet.newLegacyAddress(params.label, secondPassword);
  }
  return key.address;
}

getaddressesbyaccount.$params = ['label'];
function getaddressesbyaccount(params, wallet) {
  var labelFilter = filterBy('label', params.label);
  return wallet.keys.filter(labelFilter).map(pluck('address'));
}

getbalance.$params = ['account?'];
function getbalance(params, wallet) {
  var labelFilter = filterBy('label', params.account);
  var balance = params.account ?
    wallet.keys.filter(labelFilter).map(pluck('balance')).reduce(add, 0):
    wallet.finalBalance;
  return satoshiToBTC(balance);
}

getblock.$params = ['blockHash'];
getblock.$nowallet = true;
function getblock(params) {
  return bci.blockexplorer.getBlock(params.blockHash).then(function (block) {
    return {
      tx: block.tx.map(pluck('hash')),
      time: block.time,
      height: block.height,
      nonce: block.nonce,
      hash: block.hash,
      bits: block.bits,
      merkleroot: block.mrkl_root,
      version: block.ver,
      size: block.size
    };
  });
}

getblockcount.$params = [];
getblockcount.$nowallet = true;
function getblockcount(params) {
  return bci.statistics.get({ stat: 'n_blocks_total' });
}

getblockhash.$params = ['blockHeight'];
getblockhash.$nowallet = true;
function getblockhash(params) {
  return bci.blockexplorer.getBlockHeight(params.blockHeight).then(function (r) {
    return r.blocks[0].hash;
  });
}

getdifficulty.$params = [];
getdifficulty.$nowallet = true;
function getdifficulty(params) {
  return bci.statistics.get({ stat: 'difficulty' });
}

getgenerate.$params = [];
getgenerate.$nowallet = true;
function getgenerate(params) {
  return false;
}

gethashespersec.$params = [];
gethashespersec.$nowallet = true;
function gethashespersec(params) {
  return 0;
}

gettransaction.$params = ['hash'];
gettransaction.$nowallet = true;
function gettransaction(params) {
  return bci.blockexplorer.getTx(params.hash);
}

listaccounts.$params = [];
function listaccounts(params, wallet) {
  return wallet.keys.reduce(function (acc, key) {
    acc[key.address] = satoshiToBTC(key.balance);
    return acc;
  }, {});
}

listreceivedbyaccount.$params = ['includeempty?'];
function listreceivedbyaccount(params, wallet) {
  var accountMap = wallet.keys
    .map(function (key) {
      return { amount: key.totalReceived, address: key.address, account: key.label };
    })
    .reduce(function (acc, key) {
      var account = acc[key.account] || { amount: 0, addresses: [], label: key.account, account: key.account };
      account.addresses.push(key.address);
      account.amount += key.amount;
      acc[key.account] = account;
      return acc;
    }, {});
  return Object.keys(accountMap)
    .map(function (key) {
      var keyObj = accountMap[key];
      keyObj.addresses = '[' + keyObj.addresses.join(', ') + ']';
      keyObj.amount = satoshiToBTC(keyObj.amount);
      return keyObj;
    })
    .filter(function (key) { return key.amount !== 0 || params.includeempty; });
}

listreceivedbyaddress.$params = ['includeempty?'];
function listreceivedbyaddress(params, wallet) {
  return wallet.keys
    .map(function (key) { return { amount: key.totalReceived, address: key.address, account: key.label }; })
    .filter(function (key) { return key.amount !== 0 || params.includeempty; });
}

// Helper functions
function parseArgs(f) {
  return function (args, opts, callback) {
    var credentials = auth(opts.req)
      , guid        = credentials.name
      , walletOpts  = { password: credentials.pass, api_code: api_code };

    if (args.length > f.$params.length)
      throw 'Expected max of ' + f.$params.length + ' parameters, received ' + args.length;

    var params = f.$params
      .map(function (param, i) {
        return  { name      : param.split('?')[0]
                , value     : args[i]
                , required  : !~param.indexOf('?')  };
      })
      .reduce(function (acc, param) {
        if(param.value == null && param.required) throw 'Missing parameter: ' + param.name;
        acc[param.name] = param.value;
        return acc;
      }, {});

    (f.$nowallet ?
      Promise.resolve(f(params)):
      api.login(guid, walletOpts)
        .then(api.getWallet.bind(api, guid, walletOpts))
        .then(f.bind(f, params)))
      .then(callback.bind(null, null))
      .catch(callback);
  };
}

function satoshiToBTC(satoshi) {
  return parseFloat((satoshi / SATOSHI_PER_BTC).toFixed(8));
}

function btcToSatoshi(btc) {
  return parseInt(btc * SATOSHI_PER_BTC);
}

function pluck(p) {
  return function (o) { return o[p]; };
}

function filterBy(p, val) {
  return function (o) { return o[p] === val; };
}

function add(a, b) {
  return a + b;
}

function TimedStore() {
  var store = {};
  this.set = function (key, val, seconds) {
    var unsetTimer = setTimeout(this.remove.bind(this, key), seconds * 1000);
    store[key] = { value: val, timer: unsetTimer };
  };
  this.get = function (key) {
    return store[key] && store[key].value;
  };
  this.remove = function (key) {
    if (store[key] && store[key].timer) clearTimeout(store[key].timer);
    store[key] = undefined;
  };
}
