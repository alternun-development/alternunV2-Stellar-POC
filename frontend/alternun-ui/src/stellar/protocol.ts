import { Address, Contract, scValToNative } from "@stellar/stellar-sdk";
import { ACCOUNTS, CONTRACTS, MAX_MINE_ID, TREASURY_SPLIT, USDC_CODE, type PoolKey } from "../config";
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
  owner: string;
  mintedG: number; // GBT already backed by this mine
  leftG: number; // capacity still available
  ownerUsdc: number; // USDC balance of the mine owner's wallet
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
  /** USDC balances: treasury destinations ("miners" = sum of all mine owners) plus the Alternun fee wallet. */
  pools: Record<PoolKey | "fees", number>;
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

export const POOL_ADDRESS: Record<Exclude<PoolKey, "miners">, string> = {
  projects: ACCOUNTS.poolProjects,
  recovery: ACCOUNTS.poolRecovery,
  exploration: ACCOUNTS.poolExploration,
  marketing: ACCOUNTS.poolMarketing,
  tax: ACCOUNTS.poolTax,
};

export async function loadAll(address?: string): Promise<{ protocol: ProtocolState; account: AccountState | null }> {
  const poolKeys = Object.keys(POOL_ADDRESS) as Exclude<PoolKey, "miners">[];
  const [snap, fees, user, ...poolBalances] = await Promise.all([
    snapshot(),
    usdcOf(ACCOUNTS.admin),
    address ? usdcOf(address) : Promise.resolve(null),
    ...poolKeys.map((k) => usdcOf(POOL_ADDRESS[k])),
  ]);
  const { oracle, minter, gbt, pgbt, ept, vaults } = snap.stores;

  const fcBps = big(minter.get('["FcBps"]') ?? 8000);
  const mines: Mine[] = [];
  let totalGm = 0n;
  for (let id = 0; id <= MAX_MINE_ID; id++) {
    const m = minter.get(keyOf(["Mine", id])) as Record<string, unknown> | undefined;
    if (!m) continue;
    const cap = capacityGm(m, fcBps);
    const minted = big(minter.get(keyOf(["MineMinted", id])));
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
      owner: String(m.owner ?? ""),
      mintedG: fromGm(minted),
      leftG: fromGm(cap - minted > 0n ? cap - minted : 0n),
      ownerUsdc: 0,
    });
  }
  const ownerBalances = await Promise.all(
    mines.map((m) => (m.owner ? usdcOf(m.owner) : Promise.resolve({ trustline: false, balance: 0 }))),
  );
  mines.forEach((m, i) => (m.ownerUsdc = ownerBalances[i].balance));
  const mintedGm = big(minter.get('["MintedGm"]'));
  const availGm = BigInt(Math.round(mines.reduce((s, m) => s + m.leftG, 0) * 1000));

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
    pools: {
      ...(Object.fromEntries(poolKeys.map((k, i) => [k, poolBalances[i].balance])) as Record<Exclude<PoolKey, "miners">, number>),
      miners: mines.reduce((s, m) => s + m.ownerUsdc, 0),
      fees: fees.balance,
    },
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

export interface MineShare {
  id: number;
  owner: string;
  grams: number; // GBT backed by this mine in the mint
  usd: number; // USDC paid to the mine owner
}

export interface MintPreview {
  gbtOutG: number;
  netUsd: number;
  feeUsd: number;
  price: number;
  meetsMin: boolean;
  exceedsCapacity: boolean;
  capacityLeftG: number;
  /** Destination -> USDC, mirroring the treasury contract's integer math. */
  split: Record<PoolKey, number>;
  mines: MineShare[];
}

/** Mirrors gbt_minter::allocate and treasury::route (integer math in 1e7 / grams*1000 units). */
export function distribute(gbtOutGm: bigint, net1e7: bigint, mines: Mine[]): { split: Record<PoolKey, number>; mines: MineShare[] } {
  const open = mines.filter((m) => m.enabled && m.leftG > 0).map((m) => ({ m, left: BigInt(Math.round(m.leftG * 1000)) }));
  const total = open.reduce((s, x) => s + x.left, 0n);
  const alloc = open.map((x) => ({ m: x.m, gm: total > 0n ? (gbtOutGm * x.left) / total : 0n }));
  if (alloc.length && total > 0n) {
    const rest = gbtOutGm - alloc.reduce((s, a) => s + a.gm, 0n);
    let bi = 0;
    open.forEach((x, i) => {
      if (x.left > open[bi].left) bi = i;
    });
    alloc[bi].gm += rest;
  }
  const backing = alloc.filter((a) => a.gm > 0n);
  const bps = (k: PoolKey) => BigInt(Math.round(TREASURY_SPLIT.find((t) => t.key === k)!.share * 10_000));
  const part = (k: PoolKey) => (net1e7 * bps(k)) / 10_000n;
  const toMiners = part("miners");
  const weight = backing.reduce((s, a) => s + a.gm, 0n);
  let paid = 0n;
  const shares: MineShare[] = backing.map((a, i) => {
    const v = i === backing.length - 1 ? toMiners - paid : weight > 0n ? (toMiners * a.gm) / weight : 0n;
    paid += v;
    return { id: a.m.id, owner: a.m.owner, grams: fromGm(a.gm), usd: fromUsd1e7(v) };
  });
  const projects = part("projects");
  const exploration = part("exploration");
  const marketing = part("marketing");
  const tax = part("tax");
  const recovery = net1e7 - projects - paid - exploration - marketing - tax;
  return {
    split: {
      projects: fromUsd1e7(projects),
      recovery: fromUsd1e7(recovery),
      miners: fromUsd1e7(paid),
      exploration: fromUsd1e7(exploration),
      marketing: fromUsd1e7(marketing),
      tax: fromUsd1e7(tax),
    },
    mines: shares,
  };
}

/** Exact preview from the contract (simulation); the per-destination split mirrors the treasury math. */
export async function previewMint(amountUsd: number, p: ProtocolState | null): Promise<MintPreview> {
  const r = await read<Record<string, unknown>>(
    CONTRACTS.minter,
    "preview_mint",
    sv.i128(BigInt(Math.round(amountUsd * 1e7))),
    sv.u32(MAX_MINE_ID),
  );
  const gm = big(r.gbt_out_gm);
  const net = big(r.net_stable_1e7);
  const exceeds = Boolean(r.exceeds_capacity);
  return {
    gbtOutG: fromGm(gm),
    netUsd: fromUsd1e7(net),
    feeUsd: fromUsd1e7(big(r.fee_stable_1e7)),
    price: fromUsd1e7(big(r.price_1e7)),
    meetsMin: Boolean(r.meets_min),
    exceedsCapacity: exceeds,
    capacityLeftG: fromGm(big(r.capacity_left_gm)),
    ...distribute(exceeds ? 0n : gm, net, p?.mines ?? []),
  };
}

/** Instant local estimate with the same integer math as the minter (used while the exact preview loads). */
export function estimateMint(amountUsd: number, p: ProtocolState): MintPreview {
  const amount = BigInt(Math.round(amountUsd * 1e7));
  const fee = (amount * BigInt(p.feeBps)) / 10_000n;
  const net = amount - fee;
  const price = BigInt(Math.round(p.goldPrice * 1e7));
  const gm = price > 0n ? (net * 1000n) / price : 0n;
  const availGm = BigInt(Math.round(p.availableG * 1000));
  const exceeds = gm > availGm;
  return {
    gbtOutG: fromGm(gm),
    netUsd: fromUsd1e7(net),
    feeUsd: fromUsd1e7(fee),
    price: p.goldPrice,
    meetsMin: gm >= 1000n,
    exceedsCapacity: exceeds,
    capacityLeftG: fromGm(exceeds ? availGm : availGm - gm),
    ...distribute(exceeds ? 0n : gm, net, p.mines),
  };
}
