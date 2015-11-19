'use strict';

module.exports = {
  // Original blockchain error messages
  ERR_DECRYPT   : 'Error Decrypting Wallet',
  ERR_DECODE    : 'Error decoding private key for address x',
  ERR_SECPASS   : 'Second password incorrect',
  ERR_ADDR_AMT  : 'You must provide an address and amount',
  ERR_CHECKSUM  : 'Wallet Checksum did not validate. Serious error: Restore a backup if necessary.',
  ERR_2FA       : 'Two factor authentication currently not enabled in the Merchant API',
  ERR_LABEL     : 'Label must be between 0 & 255 characters',
  ERR_SAVING    : 'Error saving wallet',
  ERR_TX_LIMIT  : 'Wallets are currently restricted to 5000 transactions',
  ERR_WALLET_ID : 'Wallet identifier not found',
  ERR_UNKNOWN   : 'Uknown method',
  ERR_ACCESS    : 'Api access is disabled. Enable it in Account Settings',
  // Custom error messages
  ERR_PARAM     : 'Missing query parameter: {param}',
  ERR_HISTORY   : 'Experienced an error while fetching wallet history',
  ERR_UNEXPECT  : 'Unexpected error, please try again',
  ERR_PUSHTX    : 'Error creating and pushing transaction',
  ERR_JSON      : 'Invalid JSON',
  ERR_ADDRESS   : 'Address not found in this wallet',
  ERR_PASSWORD  : 'Main wallet password incorrect'
};
