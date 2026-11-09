import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import { NETWORK_PASSPHRASE } from "../config";

export type SignerKind = "demo" | "freighter" | "admin";

export interface Signer {
  kind: SignerKind;
  address: string;
  sign: (xdr: string) => Promise<string>;
}

export function keypairSigner(secret: string, kind: SignerKind): Signer {
  const kp = Keypair.fromSecret(secret);
  return {
    kind,
    address: kp.publicKey(),
    sign: async (xdr) => {
      const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
      tx.sign(kp);
      return tx.toXDR();
    },
  };
}

export async function connectFreighter(): Promise<Signer> {
  const installed = await isConnected();
  if (!installed.isConnected) {
    throw new Error("Freighter is not installed. Get it at freighter.app and reload the page.");
  }
  const access = await requestAccess();
  if (access.error || !access.address) {
    throw new Error(access.error?.message || "Access to Freighter was declined.");
  }
  const net = await getNetworkDetails();
  if (net.networkPassphrase && net.networkPassphrase !== NETWORK_PASSPHRASE) {
    throw new Error("Switch Freighter to Testnet and try again.");
  }
  const address = access.address;
  return {
    kind: "freighter",
    address,
    sign: async (xdr) => {
      const res = await signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE, address });
      if (res.error) throw new Error(res.error.message || "Signature rejected in Freighter.");
      return res.signedTxXdr;
    },
  };
}
