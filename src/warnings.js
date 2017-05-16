
module.exports = {
  LOGIN_DEPRECATED: 'This endpoint has been deprecated. You no longer have to call /login before accessing a wallet',
  BIND_TO_LOCALHOST: 'WARNING - Binding this service to any ip other than localhost (127.0.0.1) can lead to security vulnerabilities!',
  LEGACY_DECPRECATED: 'This endpoint has been deprecated, for the best safety and security, use the HD API instead: https://github.com/blockchain/service-my-wallet-v3#enable-hd-functionality',
  CREATED_NON_HD: 'Created non-HD wallet, for privacy and security, it is recommended that new wallets are created with hd=true',
  LOW_FEE_PER_BYTE: 'Setting a fee_per_byte value below 50 satoshi/byte is not recommended, and may lead to long confirmation times',
  STATIC_FEE_AMOUNT: 'Using a static fee amount may cause large transactions to confirm slowly',
  USING_DEFAULT_FEE: 'It is recommended to specify a custom fee using the fee_per_byte parameter, transactions using the default 10000 satoshi fee may not confirm'
}
