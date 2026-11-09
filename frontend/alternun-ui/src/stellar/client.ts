import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  ACCOUNTS,
  CONTRACTS,
  FRIENDBOT_URL,
  HORIZON_URL,
  NETWORK_PASSPHRASE,
  RPC_URLS,
  USDC_CODE,
  USDC_ISSUER_SECRET,
} from "../config";
import type { Signer } from "./signers";

// Several public testnet RPC nodes: use whichever answers first, fall back to the next on errors.
let chosen: Promise<rpc.Server> | null = null;
export function rpcServer(): Promise<rpc.Server> {
  if (!chosen) {
    chosen = Promise.any(
      RPC_URLS.map(async (url) => {
        const s = new rpc.Server(url);
        await s.getLatestLedger();
        return s;
      }),
    ).catch(() => new rpc.Server(RPC_URLS[RPC_URLS.length - 1]));
  }
  return chosen;
}
export function resetRpc() {
  chosen = null;
}
export const horizon = new Horizon.Server(HORIZON_URL);

// ---------- ScVal helpers ----------
export const sv = {
  u32: (n: number) => nativeToScVal(n, { type: "u32" }),
  i128: (n: bigint | number) => nativeToScVal(BigInt(n), { type: "i128" }),
  bool: (b: boolean) => nativeToScVal(b, { type: "bool" }),
  str: (s: string) => nativeToScVal(s, { type: "string" }),
  addr: (a: string) => new Address(a).toScVal(),
  enumUnit: (variant: string) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variant)]),
};

// ---------- Unit conversions ----------
export const fromUsd1e7 = (v: bigint | number) => Number(v) / 1e7;
export const fromGm = (v: bigint | number) => Number(v) / 1000; // grams*1000 -> grams
export const fromUnits = (v: bigint | number) => Number(v) / 1e7; // 7-decimal token -> whole
export const toUsd1e7 = (usd: number) => BigInt(Math.round(usd * 1e7));

// ---------- Reads (simulation, no signature) ----------
// Simulations don't need a real or funded source account.
const READ_SOURCE = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");

export async function read<T = unknown>(contractId: string, method: string, ...args: xdr.ScVal[]): Promise<T> {
  const tx = new TransactionBuilder(READ_SOURCE, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await (await rpcServer()).simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const ret = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
  return (ret ? scValToNative(ret) : undefined) as T;
}

export async function readOr<T>(fallback: T, contractId: string, method: string, ...args: xdr.ScVal[]): Promise<T> {
  try {
    return await read<T>(contractId, method, ...args);
  } catch {
    return fallback;
  }
}

// ---------- Writes ----------
export type TxPhase = "building" | "signing" | "submitting" | "confirming";

export interface TxResult<T = unknown> {
  hash: string;
  value?: T;
}

export async function invoke<T = unknown>(
  signer: Signer,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  onPhase?: (p: TxPhase) => void,
): Promise<TxResult<T>> {
  onPhase?.("building");
  const server = await rpcServer();
  const account = await server.getAccount(signer.address);
  const raw = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();
  let prepared;
  try {
    prepared = await server.prepareTransaction(raw);
  } catch (e) {
    throw new Error(friendlyError(method, e));
  }
  onPhase?.("signing");
  const signedXdr = await signer.sign(prepared.toXDR());
  onPhase?.("submitting");
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    throw new Error(`The network rejected the transaction (${sent.status}).`);
  }
  onPhase?.("confirming");
  const res = await waitFor(server, sent.hash);
  const value = res.returnValue ? (scValToNative(res.returnValue) as T) : undefined;
  return { hash: sent.hash, value };
}

async function waitFor(server: rpc.Server, hash: string) {
  for (let i = 0; i < 40; i++) {
    const r = await server.getTransaction(hash);
    if (r.status === rpc.Api.GetTransactionStatus.SUCCESS) return r;
    if (r.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error("The transaction failed on-chain.");
    await new Promise((res) => setTimeout(res, 1200));
  }
  throw new Error("Timed out waiting for confirmation. Check the explorer.");
}

const VAULT_ERRORS: Record<number, string> = {
  1: "Only the protocol admin can do this.",
  2: "Project not found.",
  3: "This project is not open for funding.",
  4: "Choose at least one stake unit.",
  5: "Debt must be fully repaid first.",
  6: "No profits booked for this project yet.",
  7: "Invalid amount.",
  8: "This project is already fully funded.",
  9: "ePT already claimed.",
  10: "KYC verification is required.",
  12: "You have no position in this project.",
  14: "The project is finalized; positions are locked.",
};

export function friendlyError(method: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const contract = msg.match(/Error\(Contract, #(\d+)\)/);
  if (contract) {
    const code = Number(contract[1]);
    if (method === "stake_gbt" || method.includes("project") || method.includes("ept") || method.includes("profit")) {
      if (VAULT_ERRORS[code]) return VAULT_ERRORS[code];
    }
    if (code === 10) return "Insufficient USDC balance.";
    if (code === 13) return "Your account needs a USDC trustline first.";
  }
  if (msg.includes("insufficient balance")) return "Insufficient GBT balance for this operation.";
  if (msg.includes("below minimum")) return "The minimum mint is 1 gram of GBT.";
  if (msg.includes("mint paused")) return "Minting is paused by the protocol admin.";
  if (msg.includes("trustline")) return "Your account needs a USDC trustline first.";
  return msg.length > 220 ? msg.slice(0, 220) + "…" : msg;
}

// ---------- Classic Stellar (USDC trustline, test faucet, XLM friendbot) ----------
export const usdcAsset = () => new Asset(USDC_CODE, ACCOUNTS.usdcIssuer);

export async function accountExists(address: string) {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch {
    return false;
  }
}

export async function hasUsdcTrustline(address: string) {
  try {
    const acc = await horizon.loadAccount(address);
    return acc.balances.some(
      (b) => "asset_code" in b && b.asset_code === USDC_CODE && b.asset_issuer === ACCOUNTS.usdcIssuer,
    );
  } catch {
    return false;
  }
}

export async function fundWithFriendbot(address: string) {
  const r = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(address)}`);
  if (!r.ok && r.status !== 400) throw new Error("Friendbot could not fund the account.");
}

export async function addUsdcTrustline(signer: Signer) {
  const acc = await horizon.loadAccount(signer.address);
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: usdcAsset() }))
    .setTimeout(120)
    .build();
  const signed = TransactionBuilder.fromXDR(await signer.sign(tx.toXDR()), NETWORK_PASSPHRASE);
  const res = await horizon.submitTransaction(signed);
  return res.hash;
}

export async function requestTestUsdc(destination: string, amount: number) {
  if (!USDC_ISSUER_SECRET) throw new Error("Test USDC faucet is not configured (.env.local).");
  const issuer = Keypair.fromSecret(USDC_ISSUER_SECRET);
  const acc = await horizon.loadAccount(issuer.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.payment({ destination, asset: usdcAsset(), amount: amount.toFixed(7) }))
    .setTimeout(120)
    .build();
  tx.sign(issuer);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

export async function latestLedger() {
  return (await (await rpcServer()).getLatestLedger()).sequence;
}

export { CONTRACTS };
