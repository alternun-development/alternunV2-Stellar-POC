import { Address, Contract, scValToNative } from "@stellar/stellar-sdk";
import { ACCOUNTS, CONTRACTS, MAX_MINE_ID, USDC_CODE } from "../config";
import { fromGm, fromUnits, fromUsd1e7, horizon, read, resetRpc, rpcServer, sv } from "./client";

export type ProjectStatus =
  | "Proposed"
  | "Active"
  | "Funded"
  | "InConstruction"
  | "Operational"
  | "Completed"
  | "Failed";

export interface Mine {
  id: number;
  enabled: boolean;
  inferidos_gm: number;
  indicados_gm: number;
  medidos_gm: number;
  probables_gm: number;
  probadas_gm: number;
  capacityG: number;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  stakeUnitG: number;
  loanUsd: number;
  targetUsd: number;
  raisedUsd: number;
  debtUsd: number;
  unitsIssued: number;
  stakedG: number;
  status: ProjectStatus;
  goldPrice: number;
  finalized: boolean;
  fundingDeadline: number;
}

export interface Position {
  projectId: number;
  stakedG: number;
  units: number;
  debtOwedUsd: number;
  debtPaidUsd: number;
  eptClaimed: boolean;
  kycVerified: boolean;
}

export interface ProtocolState {
  ledger: number;
  goldPrice: number; // USD per gram
  feeBps: number;
  fcBps: number;
  paused: boolean;
  totalCapacityG: number;
  availableG: number;
  mintedG: number;
  gbtSupply: number;
  pgbtSupply: number;
  eptSupply: number;
  lockedInVaultsG: number;
  mines: Mine[];
  projects: Project[];
  pools: { projects: number; recovery: number; alternun: number; fees: number };
}

export interface AccountState {
  address: string;
  trustline: boolean;
  usdc: number;
  gbt: number;
  pgbt: number;
  ept: number;
  positions: Position[];
}

// ---------------------------------------------------------------------------
// Snapshot: every contract keeps its state in instance storage, so a single
// getLedgerEntries call returns the whole protocol. Keys are normalized to JSON
// strings, e.g. '["Mine",1]', '"price"', '["Bal","G..."]'.
// ---------------------------------------------------------------------------
type Store = Map<string, unknown>;
const keyOf = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

const SNAPSHOT_CONTRACTS = ["oracle", "minter", "gbt", "pgbt", "ept", "vaults"] as const;
type SnapName = (typeof SNAPSHOT_CONTRACTS)[number];

async function snapshot(): Promise<{ ledger: number; stores: Record<SnapName, Store> }> {
  const keys = SNAPSHOT_CONTRACTS.map((k) => new Contract(CONTRACTS[k]).getFootprint());
  let res;
  try {
    res = await (await rpcServer()).getLedgerEntries(...keys);
  } catch {
    resetRpc();
    res = await (await rpcServer()).getLedgerEntries(...keys);
  }
  const byId: Record<string, Store> = {};
  for (const e of res.entries) {
    // stellar-sdk 17 returns plain XDR objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cd = (e.val as any).contractData;
    const id = Address.fromScAddress(cd.contract).toString();
    const store: Store = new Map();
    for (const m of cd.val.instance.storage ?? []) store.set(keyOf(scValToNative(m.key)), scValToNative(m.val));
    byId[id] = store;
  }
  const stores = Object.fromEntries(SNAPSHOT_CONTRACTS.map((k) => [k, byId[CONTRACTS[k]] ?? new Map()])) as Record<SnapName, Store>;
  return { ledger: res.latestLedger, stores };
}

const big = (v: unknown) => (typeof v === "bigint" ? v : BigInt((v as number | string | undefined) ?? 0));
const statusOf = (v: unknown): ProjectStatus => (Array.isArray(v) ? v[0] : v) as ProjectStatus;

// Mirrors gbt_minter::capacity_of_mine (weights in bps, commercial factor in bps).
const W = { inferidos_gm: 1500n, indicados_gm: 3000n, medidos_gm: 6000n, probables_gm: 5000n, probadas_gm: 7000n };
function capacityGm(m: Record<string, unknown>, fcBps: bigint) {
  if (!m.enabled) return 0n;
  const sum = (Object.keys(W) as (keyof typeof W)[]).reduce((s, k) => s + big(m[k]) * W[k], 0n);
  return (sum * fcBps) / 100_000_000n;
}

async function usdcOf(address: string): Promise<{ trustline: boolean; balance: number }> {
  try {
    const acc = await horizon.loadAccount(address);
    const line = acc.balances.find(
      (b) => "asset_code" in b && b.asset_code === USDC_CODE && b.asset_issuer === ACCOUNTS.usdcIssuer,
    );
    return { trustline: !!line, balance: line ? Number(line.balance) : 0 };
  } catch {
    return { trustline: false, balance: 0 };
  }
}

export async function loadAll(address?: string): Promise<{ protocol: ProtocolState; account: AccountState | null }> {
  const [snap, pP, pR, pA, fees, user] = await Promise.all([
    snapshot(),
    usdcOf(ACCOUNTS.poolProjects),
    usdcOf(ACCOUNTS.poolRecovery),
    usdcOf(ACCOUNTS.poolAlternun),
    usdcOf(ACCOUNTS.admin),
    address ? usdcOf(address) : Promise.resolve(null),
  ]);
  const { oracle, minter, gbt, pgbt, ept, vaults } = snap.stores;

  const fcBps = big(minter.get('["FcBps"]') ?? 8000);
  const mines: Mine[] = [];
  let totalGm = 0n;
  for (let id = 0; id <= MAX_MINE_ID; id++) {
    const m = minter.get(keyOf(["Mine", id])) as Record<string, unknown> | undefined;
    if (!m) continue;
    const cap = capacityGm(m, fcBps);
    totalGm += cap;
    mines.push({
      id,
      enabled: Boolean(m.enabled),
      inferidos_gm: fromGm(big(m.inferidos_gm)),
      indicados_gm: fromGm(big(m.indicados_gm)),
      medidos_gm: fromGm(big(m.medidos_gm)),
      probables_gm: fromGm(big(m.probables_gm)),
      probadas_gm: fromGm(big(m.probadas_gm)),
      capacityG: fromGm(cap),
    });
  }
  const mintedGm = big(minter.get('["MintedGm"]'));
  const availGm = totalGm - mintedGm > 0n ? totalGm - mintedGm : 0n;

  const count = Number(vaults.get('["ProjectCount"]') ?? 0);
  const projects: Project[] = [];
  for (let id = 1; id <= count; id++) {
    const p = vaults.get(keyOf(["Project", id])) as Record<string, unknown> | undefined;
    if (!p) continue;
    projects.push({
      id,
      name: String(p.name),
      description: String(p.description),
      stakeUnitG: fromGm(big(p.min_stake_unit_gm)),
      loanUsd: fromUsd1e7(big(p.loan_amount_usd_1e7)),
      targetUsd: fromUsd1e7(big(p.target_collateral_usd_1e7)),
      raisedUsd: fromUsd1e7(big(p.total_raised_usd_1e7)),
      debtUsd: fromUsd1e7(big(p.total_debt_usd_1e7)),
      unitsIssued: Number(p.stake_units_issued),
      stakedG: fromGm(big(p.total_staked_gm)),
      status: statusOf(p.status),
      goldPrice: fromUsd1e7(big(p.gold_price_1e7)),
      finalized: Boolean(p.is_finalized),
      fundingDeadline: Number(p.funding_deadline),
    });
  }

  const protocol: ProtocolState = {
    ledger: snap.ledger,
    goldPrice: fromUsd1e7(big(oracle.get('"price"'))),
    feeBps: Number(minter.get('["FeeBps"]') ?? 0),
    fcBps: Number(fcBps),
    paused: Boolean(minter.get('["Paused"]')),
    totalCapacityG: fromGm(totalGm),
    availableG: fromGm(availGm),
    mintedG: fromGm(mintedGm),
    gbtSupply: fromUnits(big(gbt.get('["Supply"]'))),
    pgbtSupply: fromUnits(big(pgbt.get('["Supply"]'))),
    eptSupply: fromUnits(big(ept.get('["Supply"]'))),
    lockedInVaultsG: fromUnits(big(gbt.get(keyOf(["Bal", CONTRACTS.vaults])))),
    mines,
    projects,
    pools: { projects: pP.balance, recovery: pR.balance, alternun: pA.balance, fees: fees.balance },
  };

  let account: AccountState | null = null;
  if (address && user) {
    const positions: Position[] = [];
    for (const proj of projects) {
      const u = vaults.get(keyOf(["UserProject", address, proj.id])) as Record<string, unknown> | undefined;
      if (!u) continue;
      const pos: Position = {
        projectId: proj.id,
        stakedG: fromGm(big(u.gbt_staked_gm)),
        units: Number(u.stake_units),
        debtOwedUsd: fromUsd1e7(big(u.debt_owed_usd_1e7)),
        debtPaidUsd: fromUsd1e7(big(u.debt_paid_usd_1e7)),
        eptClaimed: Boolean(u.ept_claimed),
        kycVerified: Boolean(u.kyc_verified),
      };
      if (pos.units > 0 || pos.eptClaimed) positions.push(pos);
    }
    account = {
      address,
      trustline: user.trustline,
      usdc: user.balance,
      gbt: fromUnits(big(gbt.get(keyOf(["Bal", address])))),
      pgbt: fromUnits(big(pgbt.get(keyOf(["Bal", address])))),
      ept: fromUnits(big(ept.get(keyOf(["Bal", address])))),
      positions,
    };
  }
  return { protocol, account };
}

export interface MintPreview {
  gbtOutG: number;
  netUsd: number;
  feeUsd: number;
  price: number;
  meetsMin: boolean;
  capacityLeftG: number;
}

/** Exact preview from the contract (simulation). */
export async function previewMint(amountUsd: number): Promise<MintPreview> {
  const p = await read<Record<string, unknown>>(
    CONTRACTS.minter,
    "preview_mint",
    sv.i128(BigInt(Math.round(amountUsd * 1e7))),
    sv.u32(MAX_MINE_ID),
  );
  return {
    gbtOutG: fromGm(p.gbt_out_gm as bigint),
    netUsd: fromUsd1e7(p.net_stable_1e7 as bigint),
    feeUsd: fromUsd1e7(p.fee_stable_1e7 as bigint),
    price: fromUsd1e7(p.price_1e7 as bigint),
    meetsMin: Boolean(p.meets_min),
    capacityLeftG: fromGm(p.capacity_left_gm as bigint),
  };
}

/** Instant local estimate with the same integer math as the minter (used while the exact preview loads). */
export function estimateMint(amountUsd: number, p: ProtocolState): MintPreview {
  const fee = (amountUsd * p.feeBps) / 10_000;
  const net = amountUsd - fee;
  let out = p.goldPrice > 0 ? Math.floor((net / p.goldPrice) * 1000) / 1000 : 0;
  const meetsMin = out >= 1;
  if (!meetsMin) out = 0;
  out = Math.min(out, p.availableG);
  return { gbtOutG: out, netUsd: net, feeUsd: fee, price: p.goldPrice, meetsMin, capacityLeftG: Math.max(p.availableG - out, 0) };
}
