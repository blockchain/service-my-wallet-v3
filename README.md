
# service-my-wallet-v3

Service for running the [Blockchain.info Wallet API](https://blockchain.info/api/blockchain_wallet_api) on your own server.

## Development

  1. Clone this repo
  2. Run `npm install`
  3. Install globally `npm install -g .`
  4. Use the [CLI](#cli) to develop

## CLI

When service-my-wallet-v3 is installed globally, it can be accessed via the `wallet-service` command.

Installing globally:

```sh
$ npm install -g .
```

Accessing the CLI help menu:

```sh
wallet-service --help
# or
wallet-service [command] --help
```

### Options

  * `-h, --help` - output usage information
  * `-V, --version` - output the version number
  * `-c, --cwd` - use the current directory as the wallet service module

### Commands

#### start

Usage: `wallet-service start [options]`

Command options:

  * `-h, --help` - output usage information
  * `-p, --port` - port number to run the server on

### Examples

To start the wallet service on port 3000:

```sh
$ wallet-service start --port 3000
```

To start the wallet service on port 3000 using the current directory as the module:

```sh
$ wallet-service --cwd start --port 3000
```

Why? Using `--cwd` is great for development, since it allows you to make changes in the current directory, and then see those changes without having to reinstall globally.
