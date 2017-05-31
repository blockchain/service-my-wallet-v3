'use strict'

module.exports = {
  // Original blockchain error messages
  ERR_DECRYPT: 'Error Decrypting Wallet',
  ERR_DECODE: 'Error decoding private key for address x',
  ERR_SECPASS: 'Second password incorrect',
  ERR_ADDR_AMT: 'You must provide an address and amount',
  ERR_CHECKSUM: 'Wallet Checksum did not validate. Serious error: Restore a backup if necessary.',
  ERR_2FA: 'Two factor authentication currently not enabled in the Merchant API',
  ERR_LABEL: 'Label must be between 0 & 255 characters',
  ERR_SAVING: 'Error saving wallet',
  ERR_TX_LIMIT: 'Wallets are currently restricted to 5000 transactions',
  ERR_WALLET_ID: 'Wallet identifier not found, be sure to call /login before trying to access a wallet',
  ERR_UNKNOWN: 'Uknown method',
  ERR_ACCESS: 'Api access is disabled. Enable it in Account Settings',
  // Custom error messages
  ERR_PARAM: 'Missing query parameter: {param}',
  ERR_HISTORY: 'Experienced an error while fetching wallet history',
  ERR_UNEXPECT: 'Unexpected error, please try again',
  ERR_BUILDTX: 'Error building transaction',
  ERR_PAYMENT: 'Failed to create wallet payment',
  ERR_PUSHTX: 'Error signing and pushing transaction',
  ERR_BALANCE: 'Not enough available funds',
  ERR_JSON: 'Invalid JSON',
  ERR_ADDRESS: 'Address not found in this wallet',
  ERR_PASSWORD: 'Main wallet password incorrect',
  ERR_TIMEOUT: 'Request to fetch wallet timed out, check that your API key is correct',
  ERR_API_KEY: 'Unknown API key',
  ERR_NO_HD: 'Current wallet is not an HD wallet. To upgrade, call `/merchant/:guid/enableHD`',
  ERR_IS_HD: 'Current wallet is already an HD wallet. To see your accounts, call `/merchant/:guid/accounts`',
  ERR_ACCT_IDX: 'Account nonexistent, check that your account xpub or index is correct',
  ERR_SYNC: 'Attempt to save wallet to server failed',
  ERR_SESSION: 'Unable to establish session',
  ERR_AUTH: 'Wallets that require email authorization are currently not supported in the Wallet API. Please disable this in your wallet settings, or add the IP address of this server to your wallet IP whitelist.'
}
