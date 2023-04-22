export const DEFAULT_MAIN_CHAINS = [
  // mainnets
  "eip155:1",
  "eip155:10",
  "eip155:100",
  "eip155:137",
  "eip155:42161",
  "eip155:42220",
  "cosmos:cosmoshub-4",
  "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
  "polkadot:91b171bb158e2d3848fa23a9f1c25182",
  "chia:mainnet",
  "hddcoin:mainnet",
  "elrond:1",
];

export const DEFAULT_TEST_CHAINS = [
  // testnets
  "eip155:5",
  "eip155:420",
  "eip155:80001",
  "eip155:421611",
  "eip155:44787",
  "solana:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K",
  "polkadot:e143f23803ac50e8f6f8e62695d1ce9e",
  "near:testnet",
  "chia:testnet",
  "hddcoin:testnet",
  "elrond:D",
];

export const DEFAULT_CHAINS = [...DEFAULT_MAIN_CHAINS, ...DEFAULT_TEST_CHAINS];

export const DEFAULT_PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID;
export const DEFAULT_RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL;

export const DEFAULT_LOGGER = "debug";

export const DEFAULT_APP_METADATA = {
  name: "Test Wallet Connect Dapp",
  description: "React App for WalletConnect",
  url: "https://walletconnect.com/",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

/**
 * EIP155
 */
export enum DEFAULT_EIP155_METHODS {
  ETH_SEND_TRANSACTION = "eth_sendTransaction",
  ETH_SIGN_TRANSACTION = "eth_signTransaction",
  ETH_SIGN = "eth_sign",
  PERSONAL_SIGN = "personal_sign",
  ETH_SIGN_TYPED_DATA = "eth_signTypedData",
}

export enum DEFAULT_EIP_155_EVENTS {
  ETH_CHAIN_CHANGED = "chainChanged",
  ETH_ACCOUNTS_CHANGED = "accountsChanged",
}

/**
 * COSMOS
 */
export enum DEFAULT_COSMOS_METHODS {
  COSMOS_SIGN_DIRECT = "cosmos_signDirect",
  COSMOS_SIGN_AMINO = "cosmos_signAmino",
}

export enum DEFAULT_COSMOS_EVENTS {}

/**
 * SOLANA
 */
export enum DEFAULT_SOLANA_METHODS {
  SOL_SIGN_TRANSACTION = "solana_signTransaction",
  SOL_SIGN_MESSAGE = "solana_signMessage",
}

export enum DEFAULT_SOLANA_EVENTS {}

/**
 * CHIA
 */

export enum DEFAULT_CHIA_METHODS {
  CHIA_GET_WALLETS = "chia_getWallets",
  CHIA_GET_CAT_WALLET_INFO = "chia_getCATWalletInfo",
  CHIA_SEND_TRANSACTION = "chia_sendTransaction",
  CHIA_SPEND_CAT = "chia_spendCAT",
  CHIA_NEW_ADDRESS = "chia_getNextAddress",
  CHIA_LOG_IN = "chia_logIn",
  CHIA_SIGN_MESSAGE_BY_ADDRESS = "chia_signMessageByAddress",
  CHIA_SIGN_MESSAGE_BY_ID = "chia_signMessageById",
  CHIA_GET_WALLET_SYNC_STATUS = "chia_getSyncStatus",
  CHIA_GET_NFT_INFO = "chia_getNFTInfo",
  CHIA_GET_NFTS = "chia_getNFTs",
  CHIA_TAKE_OFFER = "chia_takeOffer",
  CHIA_CREATE_OFFER_FOR_IDS = "chia_createOfferForIds",
}

export enum DEFAULT_CHIA_EVENTS {}

/**
 * HDDCOIN
 */

export enum DEFAULT_HDDCOIN_METHODS {
  HDDCOIN_GET_WALLETS = "hddcoin_getWallets",
  HDDCOIN_GET_CAT_WALLET_INFO = "hddcoin_getCATWalletInfo",
  HDDCOIN_SEND_TRANSACTION = "hddcoin_sendTransaction",
  HDDCOIN_SPEND_CAT = "hddcoin_spendCAT",
  HDDCOIN_NEW_ADDRESS = "hddcoin_getNextAddress",
  HDDCOIN_LOG_IN = "hddcoin_logIn",
  HDDCOIN_SIGN_MESSAGE_BY_ADDRESS = "hddcoin_signMessageByAddress",
  HDDCOIN_SIGN_MESSAGE_BY_ID = "hddcoin_signMessageById",
  HDDCOIN_GET_WALLET_SYNC_STATUS = "hddcoin_getSyncStatus",
  HDDCOIN_GET_NFT_INFO = "hddcoin_getNFTInfo",
  HDDCOIN_GET_NFTS = "hddcoin_getNFTs",
  HDDCOIN_TAKE_OFFER = "hddcoin_takeOffer",
  HDDCOIN_CREATE_OFFER_FOR_IDS = "hddcoin_createOfferForIds",
}

export enum DEFAULT_HDDCOIN_EVENTS {}

/**
 * POLKADOT
 */
export enum DEFAULT_POLKADOT_METHODS {
  POLKADOT_SIGN_TRANSACTION = "polkadot_signTransaction",
  POLKADOT_SIGN_MESSAGE = "polkadot_signMessage",
}

export enum DEFAULT_POLKADOT_EVENTS {}

/**
 * NEAR
 */
export enum DEFAULT_NEAR_METHODS {
  NEAR_SIGN_IN = "near_signIn",
  NEAR_SIGN_OUT = "near_signOut",
  NEAR_GET_ACCOUNTS = "near_getAccounts",
  NEAR_SIGN_AND_SEND_TRANSACTION = "near_signAndSendTransaction",
  NEAR_SIGN_AND_SEND_TRANSACTIONS = "near_signAndSendTransactions",
}

export enum DEFAULT_NEAR_EVENTS {}

/**
 * ELROND
 */
export enum DEFAULT_ELROND_METHODS {
  ELROND_SIGN_TRANSACTION = "erd_signTransaction",
  ELROND_SIGN_TRANSACTIONS = "erd_signTransactions",
  ELROND_SIGN_MESSAGE = "erd_signMessage",
  ELROND_SIGN_LOGIN_TOKEN = "erd_signLoginToken",
}

export enum DEFAULT_ELROND_EVENTS {}

export const DEFAULT_GITHUB_REPO_URL =
  "https://github.com/WalletConnect/web-examples/tree/main/dapps/react-dapp-v2";

type RelayerType = {
  value: string | undefined;
  label: string;
};

export const REGIONALIZED_RELAYER_ENDPOINTS: RelayerType[] = [
  {
    value: DEFAULT_RELAY_URL,
    label: "Default",
  },

  {
    value: "wss://us-east-1.relay.walletconnect.com/",
    label: "US",
  },
  {
    value: "wss://eu-central-1.relay.walletconnect.com/",
    label: "EU",
  },
  {
    value: "wss://ap-southeast-1.relay.walletconnect.com/",
    label: "Asia Pacific",
  },
];
