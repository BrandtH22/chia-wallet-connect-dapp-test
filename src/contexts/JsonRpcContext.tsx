import { BigNumber, utils } from "ethers";
import { createContext, ReactNode, useContext, useState } from "react";
import * as encoding from "@walletconnect/encoding";
import { TypedDataField } from "@ethersproject/abstract-signer";
import { Transaction as EthTransaction } from "@ethereumjs/tx";
import {
  formatDirectSignDoc,
  stringifySignDocValues,
  verifyAminoSignature,
  verifyDirectSignature,
} from "cosmos-wallet";
import bs58 from "bs58";
import { verifyMessageSignature } from "solana-wallet";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  SystemProgram,
  Transaction as SolanaTransaction,
} from "@solana/web3.js";

import {
  eip712,
  formatTestTransaction,
  getLocalStorageTestnetFlag,
} from "../helpers";
import { useWalletConnectClient } from "./ClientContext";
import {
  DEFAULT_COSMOS_METHODS,
  DEFAULT_EIP155_METHODS,
  DEFAULT_SOLANA_METHODS,
  DEFAULT_POLKADOT_METHODS,
  DEFAULT_NEAR_METHODS,
  DEFAULT_ELROND_METHODS,
  DEFAULT_CHIA_METHODS,
} from "../constants";
import { useChainData } from "./ChainDataContext";
import { signatureVerify, cryptoWaitReady } from "@polkadot/util-crypto";

import {
  Transaction as ElrondTransaction,
  TransactionPayload,
  Address,
  SignableMessage,
  ISignature,
} from "@elrondnetwork/erdjs";

import { UserVerifier } from "@elrondnetwork/erdjs-walletcore/out/userVerifier";
import { Signature } from "@elrondnetwork/erdjs-walletcore/out/signature";
import { IVerifiable } from "@elrondnetwork/erdjs-walletcore/out/interface";

/**
 * Types
 */
interface IFormattedRpcResponse {
  method?: string;
  address?: string;
  valid: boolean;
  result: string;
}

type TRpcRequestCallback = (chainId: string, address: string) => Promise<void>;

interface IContext {
  ping: () => Promise<void>;
  ethereumRpc: {
    testSendTransaction: TRpcRequestCallback;
    testSignTransaction: TRpcRequestCallback;
    testEthSign: TRpcRequestCallback;
    testSignPersonalMessage: TRpcRequestCallback;
    testSignTypedData: TRpcRequestCallback;
  };
  cosmosRpc: {
    testSignDirect: TRpcRequestCallback;
    testSignAmino: TRpcRequestCallback;
  };
  solanaRpc: {
    testSignMessage: TRpcRequestCallback;
    testSignTransaction: TRpcRequestCallback;
  };
  polkadotRpc: {
    testSignMessage: TRpcRequestCallback;
    testSignTransaction: TRpcRequestCallback;
  };
  nearRpc: {
    testSignAndSendTransaction: TRpcRequestCallback;
    testSignAndSendTransactions: TRpcRequestCallback;
  };
  elrondRpc: {
    testSignMessage: TRpcRequestCallback;
    testSignTransaction: TRpcRequestCallback;
    testSignTransactions: TRpcRequestCallback;
  };
  chiaRpc: {
    testGetWallets: TRpcRequestCallback;
    testGetCATWalletInfo: TRpcRequestCallback;
    testSendTransaction: TRpcRequestCallback;
    testSpendCAT: TRpcRequestCallback;
    testNewAddress: TRpcRequestCallback;
    testLogIn: TRpcRequestCallback;
    testSignMessageByAddress: TRpcRequestCallback;
    testSignMessageById: TRpcRequestCallback;
    testGetWalletSyncStatus: TRpcRequestCallback;
    testGetNFTInfo: TRpcRequestCallback;
    testGetNFTs: TRpcRequestCallback;
    testTakeOffer: TRpcRequestCallback;
    testCreateOfferForIds: TRpcRequestCallback;
    testUnknownTestCommand: TRpcRequestCallback;
    testShowOfferDataNotification: TRpcRequestCallback;
    testShowAnnouncementNotification: TRpcRequestCallback;
  };
  rpcResult?: IFormattedRpcResponse | null;
  isRpcRequestPending: boolean;
  isTestnet: boolean;
  setIsTestnet: (isTestnet: boolean) => void;
}

/**
 * Context
 */
export const JsonRpcContext = createContext<IContext>({} as IContext);

/**
 * Provider
 */
export function JsonRpcContextProvider({
  children,
}: {
  children: ReactNode | ReactNode[];
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<IFormattedRpcResponse | null>();
  const [isTestnet, setIsTestnet] = useState(getLocalStorageTestnetFlag());

  const { client, session, accounts, balances, solanaPublicKeys } =
    useWalletConnectClient();

  const { chainData } = useChainData();

  const _createJsonRpcRequestHandler =
    (
      rpcRequest: (
        chainId: string,
        address: string
      ) => Promise<IFormattedRpcResponse>
    ) =>
    async (chainId: string, address: string) => {
      if (typeof client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }
      if (typeof session === "undefined") {
        throw new Error("Session is not connected");
      }

      try {
        setPending(true);
        const result = await rpcRequest(chainId, address);
        setResult(result);
      } catch (err: any) {
        console.error("RPC request failed: ", err);
        setResult({
          address,
          valid: false,
          result: err?.message ?? err,
        });
      } finally {
        setPending(false);
      }
    };

  const _verifyEip155MessageSignature = (
    message: string,
    signature: string,
    address: string
  ) =>
    utils.verifyMessage(message, signature).toLowerCase() ===
    address.toLowerCase();

  const ping = async () => {
    if (typeof client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      setPending(true);

      let valid = false;

      try {
        await client.ping({ topic: session.topic });
        valid = true;
      } catch (e) {
        valid = false;
      }

      // display result
      setResult({
        method: "ping",
        valid,
        result: valid ? "Ping succeeded" : "Ping failed",
      });
    } catch (e) {
      console.error(e);
      setResult(null);
    } finally {
      setPending(false);
    }
  };

  // -------- ETHEREUM/EIP155 RPC METHODS --------

  const ethereumRpc = {
    testSendTransaction: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        const caipAccountAddress = `${chainId}:${address}`;
        const account = accounts.find(
          (account) => account === caipAccountAddress
        );
        if (account === undefined)
          throw new Error(`Account for ${caipAccountAddress} not found`);

        const tx = await formatTestTransaction(account);

        const balance = BigNumber.from(balances[account][0].balance || "0");
        if (balance.lt(BigNumber.from(tx.gasPrice).mul(tx.gasLimit))) {
          return {
            method: DEFAULT_EIP155_METHODS.ETH_SEND_TRANSACTION,
            address,
            valid: false,
            result: "Insufficient funds for intrinsic transaction cost",
          };
        }

        const result = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SEND_TRANSACTION,
            params: [tx],
          },
        });

        // format displayed result
        return {
          method: DEFAULT_EIP155_METHODS.ETH_SEND_TRANSACTION,
          address,
          valid: true,
          result,
        };
      }
    ),
    testSignTransaction: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        const caipAccountAddress = `${chainId}:${address}`;
        const account = accounts.find(
          (account) => account === caipAccountAddress
        );
        if (account === undefined)
          throw new Error(`Account for ${caipAccountAddress} not found`);

        const tx = await formatTestTransaction(account);

        const signedTx = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SIGN_TRANSACTION,
            params: [tx],
          },
        });

        const valid = EthTransaction.fromSerializedTx(
          signedTx as any
        ).verifySignature();

        return {
          method: DEFAULT_EIP155_METHODS.ETH_SIGN_TRANSACTION,
          address,
          valid,
          result: signedTx,
        };
      }
    ),
    testSignPersonalMessage: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // test message
        const message = `My email is john@doe.com - ${Date.now()}`;

        // encode message (hex)
        const hexMsg = encoding.utf8ToHex(message, true);

        // personal_sign params
        const params = [hexMsg, address];

        // send message
        const signature = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.PERSONAL_SIGN,
            params,
          },
        });

        //  split chainId
        const [namespace, reference] = chainId.split(":");

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = _verifyEip155MessageSignature(
          message,
          signature,
          address
        );

        // format displayed result
        return {
          method: DEFAULT_EIP155_METHODS.PERSONAL_SIGN,
          address,
          valid,
          result: signature,
        };
      }
    ),
    testEthSign: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // test message
        const message = `My email is john@doe.com - ${Date.now()}`;
        // encode message (hex)
        const hexMsg = encoding.utf8ToHex(message, true);
        // eth_sign params
        const params = [address, hexMsg];

        // send message
        const signature = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SIGN,
            params,
          },
        });

        //  split chainId
        const [namespace, reference] = chainId.split(":");

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = _verifyEip155MessageSignature(
          message,
          signature,
          address
        );

        // format displayed result
        return {
          method: DEFAULT_EIP155_METHODS.ETH_SIGN + " (standard)",
          address,
          valid,
          result: signature,
        };
      }
    ),
    testSignTypedData: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        const message = JSON.stringify(eip712.example);

        // eth_signTypedData params
        const params = [address, message];

        // send message
        const signature = await client!.request<string>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_EIP155_METHODS.ETH_SIGN_TYPED_DATA,
            params,
          },
        });

        // Separate `EIP712Domain` type from remaining types to verify, otherwise `ethers.utils.verifyTypedData`
        // will throw due to "unused" `EIP712Domain` type.
        // See: https://github.com/ethers-io/ethers.js/issues/687#issuecomment-714069471
        const {
          EIP712Domain,
          ...nonDomainTypes
        }: Record<string, TypedDataField[]> = eip712.example.types;

        const valid =
          utils
            .verifyTypedData(
              eip712.example.domain,
              nonDomainTypes,
              eip712.example.message,
              signature
            )
            .toLowerCase() === address.toLowerCase();

        return {
          method: DEFAULT_EIP155_METHODS.ETH_SIGN_TYPED_DATA,
          address,
          valid,
          result: signature,
        };
      }
    ),
  };

  // -------- COSMOS RPC METHODS --------

  const cosmosRpc = {
    testSignDirect: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // test direct sign doc inputs
        const inputs = {
          fee: [{ amount: "2000", denom: "ucosm" }],
          pubkey: "AgSEjOuOr991QlHCORRmdE5ahVKeyBrmtgoYepCpQGOW",
          gasLimit: 200000,
          accountNumber: 1,
          sequence: 1,
          bodyBytes:
            "0a90010a1c2f636f736d6f732e62616e6b2e763162657461312e4d736753656e6412700a2d636f736d6f7331706b707472653766646b6c366766727a6c65736a6a766878686c63337234676d6d6b38727336122d636f736d6f7331717970717870713971637273737a673270767871367273307a716733797963356c7a763778751a100a0575636f736d120731323334353637",
          authInfoBytes:
            "0a500a460a1f2f636f736d6f732e63727970746f2e736563703235366b312e5075624b657912230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801180112130a0d0a0575636f736d12043230303010c09a0c",
        };

        // split chainId
        const [namespace, reference] = chainId.split(":");

        // format sign doc
        const signDoc = formatDirectSignDoc(
          inputs.fee,
          inputs.pubkey,
          inputs.gasLimit,
          inputs.accountNumber,
          inputs.sequence,
          inputs.bodyBytes,
          reference
        );

        // cosmos_signDirect params
        const params = {
          signerAddress: address,
          signDoc: stringifySignDocValues(signDoc),
        };

        // send message
        const result = await client!.request<{ signature: string }>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_DIRECT,
            params,
          },
        });

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = await verifyDirectSignature(
          address,
          result.signature,
          signDoc
        );

        // format displayed result
        return {
          method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_DIRECT,
          address,
          valid,
          result: result.signature,
        };
      }
    ),
    testSignAmino: _createJsonRpcRequestHandler(
      async (chainId: string, address: string) => {
        // split chainId
        const [namespace, reference] = chainId.split(":");

        // test amino sign doc
        const signDoc = {
          msgs: [],
          fee: { amount: [], gas: "23" },
          chain_id: "foochain",
          memo: "hello, world",
          account_number: "7",
          sequence: "54",
        };

        // cosmos_signAmino params
        const params = { signerAddress: address, signDoc };

        // send message
        const result = await client!.request<{ signature: string }>({
          topic: session!.topic,
          chainId,
          request: {
            method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_AMINO,
            params,
          },
        });

        const targetChainData = chainData[namespace][reference];

        if (typeof targetChainData === "undefined") {
          throw new Error(`Missing chain data for chainId: ${chainId}`);
        }

        const valid = await verifyAminoSignature(
          address,
          result.signature,
          signDoc
        );

        // format displayed result
        return {
          method: DEFAULT_COSMOS_METHODS.COSMOS_SIGN_AMINO,
          address,
          valid,
          result: result.signature,
        };
      }
    ),
  };

  // -------- SOLANA RPC METHODS --------

  const solanaRpc = {
    testSignTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        if (!solanaPublicKeys) {
          throw new Error("Could not find Solana PublicKeys.");
        }

        const senderPublicKey = solanaPublicKeys[address];

        const connection = new Connection(
          clusterApiUrl(isTestnet ? "testnet" : "mainnet-beta")
        );

        // Using deprecated `getRecentBlockhash` over `getLatestBlockhash` here, since `mainnet-beta`
        // cluster only seems to support `connection.getRecentBlockhash` currently.
        const { blockhash } = await connection.getRecentBlockhash();

        const transaction = new SolanaTransaction({
          feePayer: senderPublicKey,
          recentBlockhash: blockhash,
        }).add(
          SystemProgram.transfer({
            fromPubkey: senderPublicKey,
            toPubkey: Keypair.generate().publicKey,
            lamports: 1,
          })
        );

        try {
          const result = await client!.request<{ signature: string }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_SOLANA_METHODS.SOL_SIGN_TRANSACTION,
              params: {
                feePayer: transaction.feePayer!.toBase58(),
                recentBlockhash: transaction.recentBlockhash,
                instructions: transaction.instructions.map((i) => ({
                  programId: i.programId.toBase58(),
                  data: bs58.encode(i.data),
                  keys: i.keys.map((k) => ({
                    isSigner: k.isSigner,
                    isWritable: k.isWritable,
                    pubkey: k.pubkey.toBase58(),
                  })),
                })),
              },
            },
          });

          // We only need `Buffer.from` here to satisfy the `Buffer` param type for `addSignature`.
          // The resulting `UInt8Array` is equivalent to just `bs58.decode(...)`.
          transaction.addSignature(
            senderPublicKey,
            Buffer.from(bs58.decode(result.signature))
          );

          const valid = transaction.verifySignatures();

          return {
            method: DEFAULT_SOLANA_METHODS.SOL_SIGN_TRANSACTION,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
    testSignMessage: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        if (!solanaPublicKeys) {
          throw new Error("Could not find Solana PublicKeys.");
        }

        const senderPublicKey = solanaPublicKeys[address];

        // Encode message to `UInt8Array` first via `TextEncoder` so we can pass it to `bs58.encode`.
        const message = bs58.encode(
          new TextEncoder().encode(
            `This is an example message to be signed - ${Date.now()}`
          )
        );

        try {
          const result = await client!.request<{ signature: string }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_SOLANA_METHODS.SOL_SIGN_MESSAGE,
              params: {
                pubkey: senderPublicKey.toBase58(),
                message,
              },
            },
          });

          const valid = verifyMessageSignature(
            senderPublicKey.toBase58(),
            result.signature,
            message
          );

          return {
            method: DEFAULT_SOLANA_METHODS.SOL_SIGN_MESSAGE,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
  };
  // -------- POLKADOT RPC METHODS --------

  const polkadotRpc = {
    testSignTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        // Below example is a scale encoded payload for system.remark("this is a test wallet-connect remark") transaction.
        // decode url: https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Frpc.polkadot.io#/extrinsics/decode/0x00019074686973206973206120746573742077616c6c65742d636f6e6e6563742072656d61726b
        const transactionPayload =
          "0x00019074686973206973206120746573742077616c6c65742d636f6e6e6563742072656d61726b05010000222400000d00000091b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3dc1f37ce7899cf20f63f5ea343f33e9e7b229c7e245049c2a7afc236861fc8b4";
        try {
          const result = await client!.request<{
            payload: string;
            signature: string;
          }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_TRANSACTION,
              params: {
                address,
                transactionPayload,
              },
            },
          });

          // sr25519 signatures need to wait for WASM to load
          await cryptoWaitReady();
          const { isValid: valid } = signatureVerify(
            transactionPayload,
            result.signature,
            address
          );

          return {
            method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_TRANSACTION,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
    testSignMessage: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const message = `This is an example message to be signed - ${Date.now()}`;

        try {
          const result = await client!.request<{ signature: string }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_MESSAGE,
              params: {
                address,
                message,
              },
            },
          });

          // sr25519 signatures need to wait for WASM to load
          await cryptoWaitReady();
          const { isValid: valid } = signatureVerify(
            message,
            result.signature,
            address
          );

          return {
            method: DEFAULT_POLKADOT_METHODS.POLKADOT_SIGN_MESSAGE,
            address,
            valid,
            result: result.signature,
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
  };

  const chiaRpc = {
    testGetWallets: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_GET_WALLETS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              includeData: false,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testGetCATWalletInfo: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_GET_CAT_WALLET_INFO;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              assetId:
                "f17f88130c63522821f1a75466849354eee69c414c774bd9f3873ab643e9574d",
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testSendTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_SEND_TRANSACTION;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              address:
                "txch1l8pwa9v3kphxr50vtgpc0dz2atvemryxzlngav9xnraxm39cxt2sxvpe3m",
              amount: "10",
              fee: "1",
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testSpendCAT: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_SPEND_CAT;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              walletId: 17,
              address:
                "txch1tnevlkzj9tlg84prxs4674pjtrzepuw2cqr0zg6qud8nfj0nk9yql3umcu",
              amount: "1000",
              fee: "6500000",
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testNewAddress: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_NEW_ADDRESS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testLogIn: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_LOG_IN;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testSignMessageByAddress: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_SIGN_MESSAGE_BY_ADDRESS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              message: "This is a testsign in message by address",
              address:
                "txch1l8pwa9v3kphxr50vtgpc0dz2atvemryxzlngav9xnraxm39cxt2sxvpe3m",
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testSignMessageById: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_SIGN_MESSAGE_BY_ID;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              message: "This is a test sign in message by id",
              id: "nft1049g9t9ts9qrc9nsd7ta0kez847le6wz59d28zrkrmhj8xu7ucgq7uqa7z",
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testGetWalletSyncStatus: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_GET_WALLET_SYNC_STATUS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testGetNFTInfo: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_GET_NFT_INFO;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              coinId:
                "0xcbca6b5c01d25273a1d173fd6ea759e0db42a6551d66143bab0be61df7e2e74f",
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testGetNFTs: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_GET_NFTS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              walletIds: [3, 4, 5, 8],
              num: 100,
              startIndex: 0,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testTakeOffer: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_TAKE_OFFER;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              offer:
                "offer1qqr83wcuu2rykcmqvpsxvgqqcfz3ax9lz9sshv6f87766v9elfvk4mq7pu94rhtr0dm4ehmp0xf0xtzvrk7f6wj6lw8adl4rkhlk3mflttacl4h7lur64as8zlhqhn8h04883476dz7x6mny6jzdcga33n4s8n884cxcekcemz6mk3jk4v924mrr0krnqnmjjzrw93l9y95jmy6rmc7ehclg20h8mumnh02ndeuhuxldp2nzk3z5z38hnugj9v6qjw54su6lh6a92e586jpultw4z9a7uz4dl09kz7dvwhraaxt83e08gqe2exx6l0dkxjrhxg2mh0jfd2vd0a3k684lnkvwd0hmwluu4300x3veuvgz607sug55sykzf4ygv8gvl7auxuhdpft96wa9d8clpww5605ux9vp0039k0cs05l8rdcawka3xe3yd9ct3shp0qx8ln58yqvcuzg9jtsqf8dsh6jhryz7l0mm78qmm5uudjd7uf9eaul8y04p8lpzg4kuafm09zedxhel7tastpct0jtkg0rrrvtewf6kclzezcycvwehhgr0y3kdwcf4q4rwlm7h9s0mp7j548sppyra90h9rwknnd9uem92aw822nmm5fghjluj6wtm6pmz26s979lhfygza5fvp6pzshsmkjqpnnspwt8sn504aeslktzvastqmaha7p4xh3m9dj24ewfym4haxrcg7ev70syfvt62lu053npg9y5j3dkj6a855n9tf39v6n90ff82e2jg95657twge56jj27f9ex5c2f24vkzuvehe9y642j2egc55tfteq5yjnp4evmrtt7vfzhuc2es689jcjpt6m95k2ef9myj7jjvfl2uhjwve0ttwdpjxrfjhjztquaz5c7pkv579es9hua3f0l0daydaajx8036c7hh42nyjje53cnfjm90xz2wn7hlhu5306y6yndt5f4t8qlsl6quepxxv5m3re5p4t9cq3zwve3vwrltae8yz78fffa7h984x9jhsc000nlppyl63mnn302hl4vj048egmkpqtm4l9ahnla2y3an0nkcl8umrd28t775n9wah43wnes88hn6uhevcj7hhdg5hvk35chvrf3wss32asvmk0pv8dlll38fm3hla3nndupa4h6shtz7mvnpt0humn5ek92x8jx2tg9qyk5qse98mmlyld7r0wkktj5kpyz3ey8gm5m7lzdacqtej7afe8yswnn9hykz5jrmxfa7j38p4s62rt0t0xhfmxd3jm6l4qs46gfkd06c7hswpdhze7e0dsyka69jkjc9xzdthsmktu9d3cqd35qm4rehuhx7xdsj07nkrjmk07g6r6dlruu3nd7t4hkpcwuyt46acppxf4vu7akneezy5gmc607csrq4krtqvjy2l7l7pl870dhkxlqkmke7tl42kremfalkzg4a8kvhnck7ewpculul60u2j70l7murqs49pq7dluzlchtxjdm0lctnlx5nml0pzs0e85l4clj6c48rnc937wt6vhau9f4xj4q9tahlz7zrcwwgl3jw9em89098tynym90l5frdeflvmadx24eujpgltlgcstcazp26dthzqunr4tlvpvgdea2vvl3lm46mdem460m7keqh4nmk9wmh3f0ermstqhzse73dqahlaek7w4llp7k3d4w2mmjzd70p2kgt9jx956v0hl39cfzs0aj2f9hdmwwqldqdcg47zcejxzuwa08ju0pu89nsmxaqunmpgl68fxhrwkdhjchn4gt6yv4826v7fvhc7e8ntlwm4zn8d0tjw80xlh3vd2s2qp3wtwtsu27etv",
              fee: 0,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testCreateOfferForIds: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_CREATE_OFFER_FOR_IDS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              walletIdsAndAmounts: {
                17: -1_234,
                "38a0dd823db068c6169e1e7e060e6a386031b9b145510d5a9b4610212383fbe9": 1,
              },
              driverDict: {},
              disableJSONFormatting: true,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testUnknownTestCommand: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_UNKNOWN_TEST_COMMAND;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              test: {
                "amount": 1,
                "38a0dd823db068c6169e1e7e060e6a386031b9b145510d5a9b4610212383fbe9": 1,
              },
              driverDict: {},
              disableJSONFormatting: true,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testShowOfferDataNotification: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const offers = [
          'offer1qqr83wcuu2rykcmqvpsxzgqqemhmlaekcenaz02ma6hs5w600dhjlvfjn477nkwz369h88kll73h37fefnwk3qqnz8s0lle0urdv0ntp27et7m86s8rmywl8rvld5udz2axnsnlxdwx7lw5a6erdh25pf24x5alshmgfv0rpwe5majfhahf7wf60vnc8elw3afaf3aw7cqsvv8v3lad5tvche3sqqkanl457a4ancgw4hqnhyumme7evh9mva7j8p6alefs6886x5xwuu8d0t9lnn9rt0urtu6w3jwcvkck4wkld009kemm0k76ecr26cxv5whq7wh7cw3y7mqe93aydxm0yvxm05wxm05wxmd5wxrfa8kxndhhg6auqx9lwp0x0wl2w0rta569ud4hxf4yyms3mrr8tq0xw0tsd3nd3nk94hdr9d2c24tkgdms9lwh9n9m78qrel8t2u0akeylv4m6mtrmhm8aaa8d4elcvmt5xkhg25q4esgduu6lscqrxlk8eftwv5jldm00xsuadjd9j8he7wadwykn3ud34tnfjcw8jk9e72kk7vh4jhnhu3kmd59rrk0g096ude9strwls2xwsqp5mpl2lgz5wmaaln8s3pvycyk5que9gxyg7mx3x6c25p9fklut6culrv57z0mtsndslvarpk67uhdnnwd5ylhc7ncjmw2yy58gjtr43qk5v4lhls247lc5l5jkdnhxt77jcg46anjpajcvjanwzkmsaka9kvwg5j749kwjzztl07pgd39ul4rv0d66waravu8l09s3xvne5hpwadg7axmghxyhkz9agmrslvlup04q7xn5p4lus7kpeg00mshe62lew3lkku4a3mnfle3ll4edqa6sc4z8lf58rxxl79u5ts6lqlx8rh68jn2pdj0f0h0z43pgvvs095txax707kmkh8tqhw6dhspmpz650l405p2z9qckyf95ptjke2u4lllxnkl2f7hx9k3m7ez28kvnnax7drk4l2wnls75z8z9lhjmuytpt8xtp5d5q8xqyqczzrucjutnk0ppa87me0u7sk7fwvmm6rwlnzj8086mxnnw23573lkexmpd7ss263fq2x3jm323jm3w3jm3xsjm3kjjlsla555ud55suagkut60p6fxz5vu9977nms7ya46djs6nvhw3cwd3zz25k5uu9lh0ut4a0hpfnxp9hkf2w6enhawne7hrerz7725c94zahlcttnpftaf8qmkus7ajland0d48uek6nn39ghue0h6xlmul6u0278mnm89s5evw8eyt000maepewml2r8u042fvswh3ykeavzk70elw6w4h5w389h7mz0l3wjpdeex0lmhms7ah2ek74ndcl84er4jalm8xwtcxz20r75yehxmm7a0gzdn2zewpylnflmmhx602ucfe2um843jrk2dmd0hgtkylvkrmetyjeueyadlsy64q23dge5pmtrycvcw5zaurnd66qcqsupuf4m0sk768k7mel0sul7lc3772lyh7x4ghqsk8ta6mmj0uf6ptrpzvq2mv9wq0w8wxgxrpax22c8sdhs45x7zvj4acjagfqdgtmj0lzmvm82gvjz8y3qls5mldhklkradtvwucx4rh2k7alhnpdzd4hk0dzvhmavlnlen9d34jq0h4fuuh968ljwszcfkkje9576c5wuwahnghlcj7z5pq37xwd55t5uw5ktaap0wnva7nhnwd2dmhe36rnerp7ad7cka7s7x8lsvyraxd0xqrs490mf6d0eed4ukjmn5vw7mdstnz0dc7hhcruvf2tlt55c6tnx6hnm7f9d4szl6ru8cqr0k6j6',
          'offer1qqr83wcuu2rykcmqvpsxygqqemhmlaekcenaz02ma6hs5w600dhjlvfjn477nkwz369h88kll73h37fefnwk3qqnz8s0lle0lzshdh4w3z5jnfd9vr922ag9t0z2dmwuhjn03fzx463wze5w5q7cvs8tzeug3m7wwvkmqnhw24uay8fwmeldh2hcsfe3ymmdel9d5hw6p4n98jh7k7txgpt4xzq2mxwhmq66xkwn395nw7mx0ntwlwz8fn495jn7fy83n63auajfgk60a0c4ck097sew5900fal3dduurk895jtnu7cc34wywn78cvx96xzgjvgzrfacev8ggvd0yxua9qve628e8ua9zvsyya9zq6tmg87j4glql4mj704cw7dfxmwnn5j00h28ecnlg3uccj99hh2w06c62eh7luzs7zjwr00q50ch6n6w9uwpnmhm7nelzmma46hwvty20jlexruc40l5ssz770u59fusvfqufraevma5umg0yw3th032557aawt9ch8xkljwcswmj4g2hyqt3lg7jxw6yjqdr6veuyan6q6w7q93d7xwpuhlxr6evtnkpv80kahsx5678w47f2n9eynwklsclrrnyne7qn930f0lpujxf9y5zs29h60tu7je29yhustjtf48atjkfen9adn3dfq4avnjtfj4y6jkvfjhrzteg4g65u27v9nyvu2esfyhu7jpvxuejsjkwfexyudfnf5mu6vj0x4yza2jfxnxzcj7wfcerxv4dx2ka2d43x8fzhj2tleluqznyzngqv2scqm6xp35zsw04ewer7g27k437zku98se3gxvwm88t565muml7s4je6y0w6wvhla07l6n9mgx0zf574v4vut7mmls8hj57gdvsd9qmusg8j6dc4u6pywfugfppxvmk8sxulafg7yx8ld35gul6vm2tul850rn2ah6ajr455r7z5ujx5ttezmcq79l2l6amelw4zc7ehet20m7deh9p40d2dnhvm2mhdug9nteaw2ukve0thhuv5ky3e8w8g0y5ngkn0x3dy7q9mhe8uag63mv8ngkwxs02tmp6h0a4fe062sxayg0t7ctf6w8ww54dlcm23d6utn7vs6pc4mfhm4f4dqefsw2xx6za6hgwnvwsaxc5z0sa760u7hdsq4xa7tla2twxn4hxuwjl0t4ge8ttgder9zsluuxmvkxkwdtga87qlnjpj56rzlcp8xhsq3kkrwmp54xpqeh4s4m8t870kewmht739hc7um6vlhrwn67djud98mfm8y6ms5xh6r9lmahasxth3f8av0pja6ma8k0er0t0ds22csr9t6e7u9vl40lqlqdnldfz2hmu5vhzja4wucj3z3ljyh4xr3eh0l6pjhfkvqhxe4alyqhvxtgrs9wccrq7vxvfqyd7qkjqd86ptys4sq7r4qe2gxr3yc7a0laluzj0r70mhr077nhea7fz7thkuygs6f2033tk2ak723vawhvurjmzngmcdsnjaj8mnlff9a2vmm9km30uexlk5ajaeh0slkdxahnvjrm95kkc7jjjrgl2mdeye8l0tdau54kwhcdwpvm9aguwlamv6fu89mgjreuryemdevx4m7e8al566yjhrlx735nexd0zp3nx3wptm3eryhj8amtm6m6uykhjkd8qzs7m72mk7wz6c',
          'offer1qqr83wcuu2rykcmqvpsxygqqemhmlaekcenaz02ma6hs5w600dhjlvfjn477nkwz369h88kll73h37fefnwk3qqnz8s0lle0npc0fqmxvh9emwaxm9a7ak28agj7uenvvwlkchjk0m3d3s30354n80cqj4z02dfytuu8a8jmgfkhhl7zllmm6tp8yat5mc96cen4zknmdehkz6k0lltf9t9qpcrtqdfmhy3799j8etzhy98m8jal2mdkekv6yntmqve3y6a9nyu84l0ke22cw7w73wv8ckh2wxnh49awt8t0mtejmunff255hecapnk6de6xe7lx38gdscuyg50a9yxlapzvn6zye8larzvjyyu9zqjfmv9754ceqhhm77l3cx7a88rvn0hzfw008eeragflcgj9dh82wmegktf470lj7kr42dsgyn7akvxlealu3u6y4h90hel7f5g8xejudr29a654xl7aktltec8asafztnuqsspknhlj3htpckj7vaj4whr44faamy5te07fd8padza3y6s4wtsnzw3agwdsgvp685ehefm8cqyhasgzmlu7ze07y997c8qv7m7lvmtqef4k092uk5kdjexapupl7k8xexrkp7dz7nlcrpyvj2fgyc3t0h7medyju2f0egky732tm8xvh3k0mnyzk330mfxykn92f4xvus9w8y4jft3mfskustk2cq5nunefe4rzywfm9e8vcnjygg7nwnfneu6yj0629zjy60x29e8uys3j85e26d986y6txw7c9085lurmcszxq9k6pqnpgq8kvtrckcjvawf4el9n9pf485slgl0ssmr2v06lue2vcmrlnfu9mctdecwkpap5u5p8m9jg2w0k2908ul7nlczdykhcznqrlgxn9wxu2jwqwx5e9shqrydery9kv44apmltl25fxwn74dl5mus087j0dxcc2zs4923yyryhx349dff7snzl40ewdull23v0vmua58elxum636hk4yemhd4dt57vre4u7h9wtxvh4emkx2tzg7nlz5rj6t5rfhhgxs0qralur7wuvgeknm5r8rg898acatn72kuhu9vrwjy04lg9yl8rh8w2klud5gja79el8gdqv2a5ma7565sv5c89rpdpwat58fk8gwnv6p8c0ld8wdtkcqwn7a9l74phnt6mjw8fl44j4vn44kx5sj4g07wrvk0rt9x45whlsde3qe2d3305pnntczgmtphdqc2mpsgm6624j4hl8mvlvm4lcjmuwwdax0mekfe0xewwnna5anj9vc2rtlp6la6mw6rdmc5nwk8cewadw3m0a3h48kc99vgpjhay7wxklchaslavte7g6j5uu2kcjdacwm4uuly3uqttfqdtuahyvl464n0df9v7gfsf0qwx58qqup3keaqqekqgmupy9ga0jzkqpmx3z92qjv5urr3laklltuswadhs70k7u9tl3uyd66ymk6407ku6hhjhcnhre36svm8na7wl548crxtxxemxaylwav866d6la6g346jsaqt278la0afat8ad22tp49h022akz6g30aart9z4ndnta0u6caygjhsjec6uztlmnj7dajcdd3urv4a6dee50lcqjlrng9jx2fqh00aset4gdwa79rhxnqvzm9w30f29hg04ml6gyvcqtqhl64q078tkf',
        ];

        const method = DEFAULT_CHIA_METHODS.CHIA_SHOW_NOTIFICATION;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              type: 'offer',
              // use random item from offers list
              offerData: offers[Math.floor(Math.random() * offers.length)],
              driverDict: {},
              disableJSONFormatting: true,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    testShowAnnouncementNotification: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_CHIA_METHODS.CHIA_SHOW_NOTIFICATION;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              fingerprint: address,
              type: 'announcement',
              message: 'This is a test announcement',
              url: 'https://www.chia.net',
              allFingerprints: true,
              driverDict: {},
              disableJSONFormatting: true,
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(result),
        };
      }
    ),
    
  };

  // -------- NEAR RPC METHODS --------

  const nearRpc = {
    testSignAndSendTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_NEAR_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              transaction: {
                signerId: address,
                receiverId: "guest-book.testnet",
                actions: [
                  {
                    type: "FunctionCall",
                    params: {
                      methodName: "addMessage",
                      args: { text: "Hello from Wallet Connect!" },
                      gas: "30000000000000",
                      deposit: "0",
                    },
                  },
                ],
              },
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify((result as any).transaction),
        };
      }
    ),
    testSignAndSendTransactions: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const method = DEFAULT_NEAR_METHODS.NEAR_SIGN_AND_SEND_TRANSACTIONS;
        const result = await client!.request({
          topic: session!.topic,
          chainId,
          request: {
            method,
            params: {
              transactions: [
                {
                  signerId: address,
                  receiverId: "guest-book.testnet",
                  actions: [
                    {
                      type: "FunctionCall",
                      params: {
                        methodName: "addMessage",
                        args: { text: "Hello from Wallet Connect! (1/2)" },
                        gas: "30000000000000",
                        deposit: "0",
                      },
                    },
                  ],
                },
                {
                  signerId: address,
                  receiverId: "guest-book.testnet",
                  actions: [
                    {
                      type: "FunctionCall",
                      params: {
                        methodName: "addMessage",
                        args: { text: "Hello from Wallet Connect! (2/2)" },
                        gas: "30000000000000",
                        deposit: "0",
                      },
                    },
                  ],
                },
              ],
            },
          },
        });

        return {
          method,
          address,
          valid: true,
          result: JSON.stringify(
            (result as any).map((r: any) => r.transaction)
          ),
        };
      }
    ),
  };

  // -------- ELROND RPC METHODS --------

  const elrondRpc = {
    testSignTransaction: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const reference = chainId.split(":")[1];

        const userAddress = new Address(address);
        const verifier = UserVerifier.fromAddress(userAddress);
        const transactionPayload = new TransactionPayload("testdata");

        const testTransaction = new ElrondTransaction({
          nonce: 1,
          value: "10000000000000000000",
          receiver: Address.fromBech32(address),
          sender: userAddress,
          gasPrice: 1000000000,
          gasLimit: 50000,
          chainID: reference,
          data: transactionPayload,
        });
        const transaction = testTransaction.toPlainObject();

        try {
          const result = await client!.request<{ signature: Buffer }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_ELROND_METHODS.ELROND_SIGN_TRANSACTION,
              params: {
                transaction,
              },
            },
          });

          testTransaction.applySignature(
            new Signature(result.signature),
            userAddress
          );

          const valid = verifier.verify(testTransaction as IVerifiable);

          return {
            method: DEFAULT_ELROND_METHODS.ELROND_SIGN_TRANSACTION,
            address,
            valid,
            result: result.signature.toString(),
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
    testSignTransactions: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const reference = chainId.split(":")[1];

        const userAddress = new Address(address);
        const verifier = UserVerifier.fromAddress(userAddress);
        const testTransactionPayload = new TransactionPayload("testdata");

        const testTransaction = new ElrondTransaction({
          nonce: 1,
          value: "10000000000000000000",
          receiver: Address.fromBech32(address),
          sender: userAddress,
          gasPrice: 1000000000,
          gasLimit: 50000,
          chainID: reference,
          data: testTransactionPayload,
        });

        // no data for this Transaction
        const testTransaction2 = new ElrondTransaction({
          nonce: 2,
          value: "20000000000000000000",
          receiver: Address.fromBech32(address),
          sender: userAddress,
          gasPrice: 1000000000,
          gasLimit: 50000,
          chainID: reference,
        });

        const testTransaction3Payload = new TransactionPayload("third");
        const testTransaction3 = new ElrondTransaction({
          nonce: 3,
          value: "300000000000000000",
          receiver: Address.fromBech32(address),
          sender: userAddress,
          gasPrice: 1000000000,
          gasLimit: 50000,
          chainID: reference,
          data: testTransaction3Payload,
        });

        const transactions = [
          testTransaction,
          testTransaction2,
          testTransaction3,
        ].map((transaction) => transaction.toPlainObject());

        try {
          const result = await client!.request<{
            signatures: { signature: Buffer }[];
          }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_ELROND_METHODS.ELROND_SIGN_TRANSACTIONS,
              params: {
                transactions,
              },
            },
          });

          const valid = [
            testTransaction,
            testTransaction2,
            testTransaction3,
          ].reduce((acc, current, index) => {
            current.applySignature(
              new Signature(result.signatures[index].signature),
              userAddress
            );

            return acc && verifier.verify(current as IVerifiable);
          }, true);

          const resultSignatures = result.signatures.map(
            (signature: any) => signature.signature
          );

          return {
            method: DEFAULT_ELROND_METHODS.ELROND_SIGN_TRANSACTIONS,
            address,
            valid,
            result: resultSignatures.join(", "),
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
    testSignMessage: _createJsonRpcRequestHandler(
      async (
        chainId: string,
        address: string
      ): Promise<IFormattedRpcResponse> => {
        const userAddress = new Address(address);
        const verifier = UserVerifier.fromAddress(userAddress);

        const testMessage = new SignableMessage({
          address: userAddress,
          message: Buffer.from(`Sign this message - ${Date.now()}`, "ascii"),
        });

        try {
          const result = await client!.request<{ signature: Buffer }>({
            chainId,
            topic: session!.topic,
            request: {
              method: DEFAULT_ELROND_METHODS.ELROND_SIGN_MESSAGE,
              params: {
                address,
                message: testMessage.message.toString(),
              },
            },
          });

          testMessage.applySignature(new Signature(result.signature));

          const valid = verifier.verify(testMessage);

          return {
            method: DEFAULT_ELROND_METHODS.ELROND_SIGN_MESSAGE,
            address,
            valid,
            result: result.signature.toString(),
          };
        } catch (error: any) {
          throw new Error(error);
        }
      }
    ),
  };

  return (
    <JsonRpcContext.Provider
      value={{
        ping,
        ethereumRpc,
        cosmosRpc,
        solanaRpc,
        polkadotRpc,
        nearRpc,
        elrondRpc,
        chiaRpc,
        rpcResult: result,
        isRpcRequestPending: pending,
        isTestnet,
        setIsTestnet,
      }}
    >
      {children}
    </JsonRpcContext.Provider>
  );
}

export function useJsonRpc() {
  const context = useContext(JsonRpcContext);
  if (context === undefined) {
    throw new Error("useJsonRpc must be used within a JsonRpcContextProvider");
  }
  return context;
}
