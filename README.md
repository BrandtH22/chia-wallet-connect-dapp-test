# Reminder
Before using this repo, please make sure **DEFAULT_CHIA_METHODS** in `src/constants/default.ts` is a subset of exposed methods of the Chia wallet. Otherwise, the dApp will fail to connect the Chia wallet without throwing any exceptions.

For the Chia wallet 1.7.1, please refer to [WalletConnectCommands](https://github.com/Chia-Network/chia-blockchain-gui/blob/5702b3f60c92aa68c30676179b79c94e2192247c/packages/gui/src/constants/WalletConnectCommands.tsx).

# Warning
This sample project is intended for demonstration purposes only and should not be used for production code.

The dependencies used in this sample project may be outdated and may contain known security vulnerabilities. It is highly recommended that you only use the code as a reference when developing your own project.

# React dApp (with standalone v2 client)

🔗 Live dapp demo - https://react-app.walletconnect.com/ <br />
🔗 Live wallet demo - https://react-wallet.walletconnect.com/ <br />
📚 WalletConnect v2 Docs - https://docs.walletconnect.com/2.0

## Overview

This is an example implementation of a React dApp (generated via `create-react-app`) using the standalone
client for WalletConnect v2 to:

- handle pairings
- manage sessions
- send JSON-RPC requests to a paired wallet

## Running locally

Install the app's dependencies:

```bash
yarn
```

Set up your local environment variables by copying the example into your own `.env.local` file:

```bash
cp .env.local.example .env.local
```

Your `.env.local` now contains the following environment variables:

- `NEXT_PUBLIC_PROJECT_ID` (placeholder) - You can generate your own ProjectId at https://cloud.walletconnect.com
- `NEXT_PUBLIC_RELAY_URL` (already set)

## Develop

```bash
yarn dev
```

## Test

```bash
yarn test
```

## Build

```bash
yarn build
```
