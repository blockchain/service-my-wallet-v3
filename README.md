
# Blockchain Wallet API V2

Programmatically interface with your Blockchain.info wallet.

## Contents

  * [Getting Started](#getting-started)
  * [Upgrading](#upgrading)
  * [API Documentation](#api-documentation)
  * [RPC API](#rpc)
  * [Installation](#installation)
  * [Troubleshooting](#troubleshooting)
  * [Usage](#usage)
  * [Development](#development)
  * [Deployment](#deployment)

## Getting Started

To use this API, you will need to run small local service which be responsible for managing your Blockchain.info wallet. Your application interacts with this service locally via HTTP API calls.

Start by completing the following steps:

  1. Follow the [installation instructions](#installation)
  2. Start the server: `$ blockchain-wallet-service start --port 3000`
  3. Reference the [documentation](#api-documentation) and start interacting with your wallet programmatically!

Note that `blockchain-wallet-service` is designed to be run locally on the same machine as your application and therefore will only accept connections from `localhost`. If you modify this service to accept external connections, be sure to add the appropriate firewall rules to prevent unauthorized use.

An API code is required for wallet creation and higher request limits. For basic usage, no API code is required. Request an API code [here](https://blockchain.info/api/api_create_code).

## Upgrading

If you already have an application that uses [Blockchain.info's Wallet API](https://blockchain.info/api/blockchain_wallet_api), you will need to complete the steps in the Getting Started section above and then, in your application code, replace calls to `blockchain.info/merchant/...` with `localhost:<port>/merchant/...`.

## API Documentation

View the [original documentation](https://blockchain.info/api/blockchain_wallet_api).

All endpoints present in the API documentation above are supported in Blockchain Wallet API V2. The differences between two are:

  * The "consolidate addresses" endpoint has been omitted

All endpoints can be called with `GET` or `POST`, and can only be accessed from `localhost`.

### Creating a new Blockchain Wallet

Endpoint: `/api/v2/create`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (required)
  * `priv` - private key to import into wallet as first address (optional)
  * `label` - label to give to the first address generated in the wallet (optional)
  * `email` - email to associate with the newly created wallet (optional)

Sample Response:

```json
{
  "guid": "05f290be-dbef-4636-a809-868893c51711",
  "address": "13R9dBgKwBP29JKo11zhfi74YuBsMxJ4qY",
  "label": "Main address"
}
```

### Make Payment

Endpoint: `/merchant/:guid/payment`

Query Parameters:

  * `to` - bitcoin address to send to (required)
  * `amount` - amount **in satoshi** to send (required)
  * `password` - main wallet password (required)
  * `second_password` - second wallet password (required, only if second password is enabled)
  * `api_code` - blockchain.info wallet api code (optional)
  * `from` - bitcoin address or account index to send from (optional)
  * `fee` - specify transaction fee **in satoshi**
  * `fee_per_byte` - specify transaction fee-per-byte **in satoshi**

*It is recommended that transaction fees are specified using the `fee_per_byte` parameter, which will compute your final fee based on the size of the transaction. You can also set a static fee using the `fee` parameter, but doing so may result in a low fee-per-byte, leading to longer confirmation times.*

Sample Response:

```json
{
  "to" : ["1A8JiWcwvpY7tAopUkSnGuEYHmzGYfZPiq"],
  "from": ["17p49XUC2fw4Fn53WjZqYAm4APKqhNPEkY"],
  "amounts": [200000],
  "fee": 1000,
  "txid": "f322d01ad784e5deeb25464a5781c3b20971c1863679ca506e702e3e33c18e9c",
  "success": true
}
```

### Send to Many

Endpoint: `/merchant/:guid/sendmany`

Query Parameters:

  * `recipients` - a *URI encoded* [JSON object](http://json.org/example.html), with bitcoin addresses as keys and the **satoshi** amounts as values (required, see example below)
  * `password` - main wallet password (required)
  * `second_password` - second wallet password (required, only if second password is enabled)
  * `api_code` - blockchain.info wallet api code (optional)
  * `from` - bitcoin address or account index to send from (optional)
  * `fee` - specify transaction fee **in satoshi**
  * `fee_per_byte` - specify transaction fee-per-byte **in satoshi**

*It is recommended that transaction fees are specified using the `fee_per_byte` parameter, which will compute your final fee based on the size of the transaction. You can also set a static fee using the `fee` parameter, but doing so may result in a low fee-per-byte, leading to longer confirmation times.*

URI Encoding a JSON object in JavaScript:

```js
var myObject = { address1: 10000, address2: 50000 };
var myJSONString = JSON.stringify(myObject);
// `encodeURIComponent` is a global function
var myURIEncodedJSONString = encodeURIComponent(myJSONString);
// use `myURIEncodedJSONString` as the `recipients` parameter
```

Sample Response:

```json
{
  "to" : ["1A8JiWcwvpY7tAopUkSnGuEYHmzGYfZPiq", "18fyqiZzndTxdVo7g9ouRogB4uFj86JJiy"],
  "from": ["17p49XUC2fw4Fn53WjZqYAm4APKqhNPEkY"],
  "amounts": [16000, 5400030],
  "fee": 2000,
  "txid": "f322d01ad784e5deeb25464a5781c3b20971c1863679ca506e702e3e33c18e9c",
  "success": true
}
```

### Fetch Wallet Balance

Endpoint: `/merchant/:guid/balance`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (required)

Sample Response:

```json
{ "balance": 10000 }
```

### Enable HD Functionality

Endpoint: `/merchant/:guid/enableHD`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

This will upgrade a wallet to an HD (Hierarchical Deterministic) Wallet, which allows the use of accounts. See [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) for more information on HD wallets and accounts.

### List Active HD Accounts

Endpoint: `/merchant/:guid/accounts`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### List HD xPubs

Endpoint: `/merchant/:guid/accounts/xpubs`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### Create New HD Account

Endpoint: `/merchant/:guid/accounts/create`

Query Parameters:

  * `label` - label to assign to the newly created account (optional)
  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### Get Single HD Account

Endpoint: `/merchant/:guid/accounts/:xpub_or_index`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### Get HD Account Receiving Address

Endpoint: `/merchant/:guid/accounts/:xpub_or_index/receiveAddress`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### Check HD Account Balance

Endpoint: `/merchant/:guid/accounts/:xpub_or_index/balance`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### Archive HD Account

Endpoint: `/merchant/:guid/accounts/:xpub_or_index/archive`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### Unarchive HD Account

Endpoint: `/merchant/:guid/accounts/:xpub_or_index/unarchive`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

### List Addresses (deprecated, use the HD API instead)

Endpoint: `/merchant/:guid/list`

Query Parameters:

  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

Sample Response:

```json
{
  "addresses": [
    {
        "balance": 79434360,
        "address": "1A8JiWcwvpY7tAopUkSnGuEYHmzGYfZPiq",
        "label": "My Wallet",
        "total_received": 453300048335
    },
    {
        "balance": 0,
        "address": "17p49XUC2fw4Fn53WjZqYAm4APKqhNPEkY",
        "total_received": 0
    }
  ]
}
```

### Fetch Address Balance (deprecated, use the HD API instead)

Endpoint: `/merchant/:guid/address_balance`

Query Parameters:

  * `address` - address to fetch balance for (required)
  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

Note: unlike the hosted API, there is no option of a `confirmations` parameter for specifying minimum confirmations.

Sample Response:

```json
{ "balance": 129043, "address": "19r7jAbPDtfTKQ9VJpvDzFFxCjUJFKesVZ", "total_received": 53645423 }
```

### Generate Address (deprecated, use the HD API instead)

Endpoint: `/merchant/:guid/new_address`

Query Parameters:

  * `password` - main wallet password (required)
  * `label` - label to give to the address (optional)
  * `api_code` - blockchain.info wallet api code (optional)

Sample Response:

```json
{ "address" : "18fyqiZzndTxdVo7g9ouRogB4uFj86JJiy" , "label":  "My New Address" }
```

### Archive Address (deprecated, use the HD API instead)

Endpoint: `/merchant/:guid/archive_address`

Query Parameters:

  * `address` - address to archive (required)
  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

Sample Response:

```json
{ "archived" : "18fyqiZzndTxdVo7g9ouRogB4uFj86JJiy" }
```

### Unarchive Address (deprecated, use the HD API instead)

Endpoint: `/merchant/:guid/unarchive_address`

Query Parameters:

  * `address` - address to unarchive (required)
  * `password` - main wallet password (required)
  * `api_code` - blockchain.info wallet api code (optional)

Sample Response:

```json
{ "active" : "18fyqiZzndTxdVo7g9ouRogB4uFj86JJiy" }
```

## RPC

Bitcoind compatible RPC API. Full documentation available [here](https://blockchain.info/api/json_rpc_api).

Starting the RPC server:

```
$ blockchain-wallet-service start-rpc [options]
```

View additional options and instructions under [Usage](#usage).

Differences from server API:

  * Option `-rpcssl` is not supported
  * Method `listsinceblock` is not supported
  * Param `minConfimations` is not supported for methods `listreceivedbyaccount` and `listreceivedbyaddress`
  * Param `minimumConfirmations` is not supported for method `getbalance`
  * Param `confirmations` is not supported for method `listaccounts`
  * Responses representing transactions have a different format

## Installation

[`nodejs`](https://nodejs.org) and [`npm`](https://npmjs.com) are required to install and use this API service. Installation:

```sh
$ npm install -g blockchain-wallet-service
```

For the best stability and performance, make sure you are always using the latest version.

To check your version:

```sh
$ blockchain-wallet-service -V
```

To update to the latest version:

```sh
$ npm update -g blockchain-wallet-service
```

Requires:

  * node >= 6.0.0
  * npm >= 3.0.0

If you have issues with the installation process, see the troubleshooting section below.

## Troubleshooting

Installation errors:

  * If you are getting `EACCESS` or permissions-related errors, it might be necessary to run the install as root, using the `sudo` command.

  * If you are getting errors concerning node-gyp or python, install with `npm install --no-optional`

Startup errors:

  * If startup fails with `/usr/bin/env: node: No such file or directory`, it's possible node is not installed, or was installed with a different name (Ubuntu, for example, installs node as nodejs). If node was installed with a different name, create a symlink to your node binary: `sudo ln -s /usr/bin/nodejs /usr/bin/node`, or install node through [Node Version Manager](https://github.com/creationix/nvm).

Runtime errors:

  * If you are seeing a `TypeError` claiming that an object `has no method 'compare'`, it is because you are on a version of Node older than 0.12, before the `compare` method was added to Buffers. Try upgrading to at least Node version 0.12.

  * If you are getting wallet decryption errors despite having correct credentials, then it's possible that you do not have Java installed, which is required by a dependency of the my-wallet-v3 module. Not having Java installed during the `npm install` process can result in the inability to decrypt wallets. Download the JDK from [here for Mac](https://support.apple.com/kb/DL1572) or by running `apt-get install default-jdk` on debian-based linux systems.

Timeout Errors:

  * If you are getting a timeout response, additional authorization from your blockchain wallet may be required. This can occur when using an unrecognized browser or IP address. An email authorizing the API access attempt will be sent to the registered user that will require action in order to authorize future requests.

If this section did not help, please open a github issue or visit our [support center](https://blockchain.zendesk.com).

## Usage

After installing the service, the command `blockchain-wallet-service` will be available for use.

### Options

  * `-h, --help` - output usage information
  * `-V, --version` - output the version number
  * `-c, --cwd` - use the current directory as the wallet service module (development only)

### Commands

#### start

Usage: `blockchain-wallet-service start [options]`

This command will start the service, making Blockchain Wallet API V2 available on a specified port.

Command options:

  * `-h, --help` - output usage information
  * `-p, --port` - port number to run the server on (defaults to `3000`)
  * `-b, --bind` - bind to a specific ip (defaults to `127.0.0.1`, note that binding to an ip other than this can lead to security vulnerabilities)
  * `--ssl-key` - the path to your ssl key (optional)
  * `--ssl-cert` - the path to your ssl certificate (optional)

To open the service to all incoming connections, bind to `0.0.0.0`.

#### start-rpc

Usage: `blockchain-wallet-service start-rpc [options]`

This command will start the JSON RPC server.

Options:

  * `-k, --key` - api code to use for server requests (required option)
  * `-p, --rpcport` - rpc server port (default: 8000)
  * `-b, --bind` - bind to a specific ip (defaults to `127.0.0.1`, note that binding to an ip other than this can lead to security vulnerabilities)

Get an API code [here](https://blockchain.info/api/api_create_code).

### Examples

To start the Wallet API service on port 3000:

```sh
$ blockchain-wallet-service start --port 3000
```

## Development

  1. Clone this repo
  2. Run `yarn --ignore-engines`
  3. Run `yarn start`
  4. Dev server is now running on port 3000

If you are developing `blockchain-wallet-client` alongside this module, it is useful to create a symlink to `my-wallet-v3`:

```sh
$ ln -s ../path/to/my-wallet-v3 node_modules/blockchain-wallet-client
```

### Testing

```sh
$ yarn test
```

### Configuration

Optional parameters can be configured in a `.env` file:

  * `PORT` - port number for running dev server (default: `3000`)
  * `BIND` - ip address to bind the service to (default: `127.0.0.1`)

## Deployment

If you want to use blockchain-wallet-service in your UNIX production server, you just have to run:

```sh
$ nohup blockchain-wallet-service start --port 3000 &
```
