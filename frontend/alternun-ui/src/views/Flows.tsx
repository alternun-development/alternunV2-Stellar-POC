import { useEffect, useMemo, useState } from "react";
import { ACCOUNTS, CONTRACTS, MAX_MINE_ID, MINE_META, TREASURY_SPLIT, type PoolKey } from "../config";
import { fmtNum, fmtUsd } from "../format";
import { useApp } from "../state/app";
import { invoke, sv, toUsd1e7 } from "../stellar/client";
import { POOL_ADDRESS, estimateMint, loadAll, previewMint, type AccountState, type MintPreview, type ProtocolState } from "../stellar/protocol";
import { IconCheck, IconCoins, IconGold, IconMine, IconRefresh, IconShield, IconWallet } from "../components/icons";
import { ExplorerLink } from "../components/ui";

const PRESETS = [1000, 10000, 50000];
const COLORS: Record<PoolKey | "fee", string> = {
  projects: "var(--mint)",
  recovery: "var(--indigo-300)",
  miners: "var(--gold)",
  exploration: "#7fd1ff",
  marketing: "#c79bff",
  tax: "#ff9f7a",
  fee: "#9aa3c7",
};

/** Every balance the demo follows, read from Stellar at one moment. */
interface Ledger {
  buyerUsdc: number;
  buyerGbt: number;
  fee: number;
  pools: Record<Exclude<PoolKey, "miners">, number>;
  owners: Record<number, number>;
  minedG: Record<number, number>;
  gbtSupply: number;
}

function toLedger(p: ProtocolState, a: AccountState | null): Ledger {
  return {
    buyerUsdc: a?.usdc ?? 0,
    buyerGbt: a?.gbt ?? 0,
    fee: p.pools.fees,
    pools: {
      projects: p.pools.projects,
      recovery: p.pools.recovery,
      exploration: p.pools.exploration,
      marketing: p.pools.marketing,
      tax: p.pools.tax,
    },
    owners: Object.fromEntries(p.mines.map((m) => [m.id, m.ownerUsdc])),
    minedG: Object.fromEntries(p.mines.map((m) => [m.id, m.mintedG])),
    gbtSupply: p.gbtSupply,
  };
}

const r7 = (n: number) => Math.round(n * 1e7) / 1e7;
const same = (a: number, b: number) => Math.abs(r7(a) - r7(b)) < 1e-6;

type Phase = "idle" | "running" | "settling" | "done" | "error";

interface Trace {
  amount: number;
  plan: MintPreview;
  before: Ledger;
  after?: Ledger;
  hash?: string;
}

export function Flows() {
  const { protocol: p, account, signer, runTx, refresh, loading } = useApp();
  const [amount, setAmount] = useState("10000");
  const [preview, setPreview] = useState<MintPreview | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [trace, setTrace] = useState<Trace | null>(null);
  const amt = Number(amount) || 0;

  useEffect(() => {
    if (amt <= 0 || !p) return setPreview(null);
    setPreview(estimateMint(amt, p));
    let live = true;
    const t = setTimeout(() => previewMint(amt, p).then((pv) => live && setPreview(pv)).catch(() => {}), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amt, p?.mintedG, p?.goldPrice]);

  const canRun = !!signer && !!preview?.meetsMin && !preview.exceedsCapacity && (account?.usdc ?? 0) >= amt && phase !== "running" && phase !== "settling";

  const run = async () => {
    if (!signer || !preview) return;
    setPhase("running");
    // Fresh read right before the transaction, so the "before" column is exact.
    const fresh = await loadAll(signer.address);
    const plan = await previewMint(amt, fresh.protocol).catch(() => estimateMint(amt, fresh.protocol));
    const t: Trace = { amount: amt, plan, before: toLedger(fresh.protocol, fresh.account) };
    setTrace(t);
    let hash = "";
    const ok = await runTx("Minting GBT (traced)", async (onPhase) => {
      const res = await invoke(signer, CONTRACTS.minter, "mint", [sv.addr(signer.address), sv.i128(toUsd1e7(amt)), sv.u32(MAX_MINE_ID)], onPhase);
      hash = res.hash;
      setTrace({ ...t, hash });
      setPhase("settling");
      return res;
    });
    if (!ok) return setPhase("error");
    // Wait until the public nodes show the new balances (usually 1-5 s after confirmation).
    for (let i = 0; i < 20; i++) {
      const now = await loadAll(signer.address);
      const after = toLedger(now.protocol, now.account);
      if (same(t.before.buyerUsdc - after.buyerUsdc, amt) && after.gbtSupply > t.before.gbtSupply) {
        setTrace({ ...t, hash, after });
        setPhase("done");
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setPhase("error");
  };

  // Rows of the split: expected (from the contract math) vs. what changed on-chain.
  const rows = useMemo(() => {
    const plan = trace?.plan ?? preview;
    if (!plan) return [];
    const b = trace?.before;
    const a = trace?.after;
    const delta = (f: (l: Ledger) => number) => (a && b ? f(a) - f(b) : undefined);
    const out: { key: string; color: string; label: string; rule: string; address: string; expected: number; actual?: number; indent?: boolean; grams?: number; gramsActual?: number }[] = [
      { key: "fee", color: COLORS.fee, label: "Alternun protocol fee", rule: `${(p?.feeBps ?? 200) / 100}% of the payment`, address: ACCOUNTS.admin, expected: plan.feeUsd, actual: delta((l) => l.fee) },
    ];
    for (const s of TREASURY_SPLIT) {
      if (s.key === "miners") {
        out.push({ key: "miners", color: COLORS.miners, label: "Mine owners", rule: "8% of net · pro-rata to GBT backed", address: "", expected: plan.split.miners, actual: a && b ? Object.keys(a.owners).reduce((sum, id) => sum + a.owners[+id] - (b.owners[+id] ?? 0), 0) : undefined });
        for (const m of plan.mines) {
          out.push({
            key: `mine-${m.id}`,
            color: COLORS.miners,
            label: MINE_META[m.id]?.owner ?? `Mine ${m.id} owner`,
            rule: `backs ${fmtNum(m.grams, 3)} g`,
            address: m.owner,
            expected: m.usd,
            actual: delta((l) => l.owners[m.id] ?? 0),
            indent: true,
            grams: m.grams,
            gramsActual: delta((l) => l.minedG[m.id] ?? 0),
          });
        }
      } else {
        const k = s.key;
        out.push({ key: k, color: COLORS[k], label: s.label, rule: `${+(s.share * 100).toFixed(1)}% of net`, address: POOL_ADDRESS[k], expected: plan.split[k], actual: delta((l) => l.pools[k]) });
      }
    }
    return out;
  }, [trace, preview, p?.feeBps]);

  const plan = trace?.plan ?? preview;
  const shown = trace?.amount ?? amt;
  const done = phase === "done" && !!trace?.after;
  const credited = done ? rows.filter((r) => !r.indent).reduce((s, r) => s + (r.actual ?? 0), 0) : 0;
  const debited = done ? trace!.before.buyerUsdc - trace!.after!.buyerUsdc : 0;
  const allMatch = done && rows.every((r) => r.actual !== undefined && same(r.actual, r.expected)) && same(credited, debited);
  const gbtIn = done ? trace!.after!.buyerGbt - trace!.before.buyerGbt : 0;

  return (
    <div className="page">
      <div className="section-head">
        <div className="stack-sm">
          <span className="kicker">Money flow</span>
          <h2>Follow every dollar of a mint</h2>
          <p className="muted">
            One Stellar transaction charges the buyer, pays Alternun's fee, pays each mine owner for the gold it backs,
            funds every pool and mints the GBT. Either all of it happens or none of it does. Balances below are read live
            from the network.
          </p>
        </div>
      </div>

      {/* Trace a mint */}
      <div className="card stack" style={{ gap: 18 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>
          <h3><IconCoins /> Trace a mint</h3>
          {trace?.hash && (
            <span className="small muted row" style={{ gap: 6 }}>
              Transaction <ExplorerLink kind="tx" id={trace.hash} />
            </span>
          )}
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="input-wrap" style={{ maxWidth: 240 }}>
            <input className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Amount in USDC" />
            <span className="input-suffix small">USDC</span>
          </div>
          {PRESETS.map((v) => (
            <button key={v} className={`chip ${amt === v ? "on" : ""}`} onClick={() => setAmount(String(v))}>{fmtUsd(v, 0)}</button>
          ))}
          <button className="btn btn-primary" disabled={!canRun} onClick={run} style={{ marginLeft: "auto" }}>
            {phase === "running" ? "Sending…" : phase === "settling" ? "Reading balances…" : "Mint and trace"}
          </button>
        </div>
        {!signer && <div className="notice info">Connect a wallet (top right) to run a traced mint.</div>}
        {preview?.exceedsCapacity && <div className="notice">This amount exceeds the reserve capacity left.</div>}
        {phase === "error" && <div className="notice error">The transaction did not complete or the balances did not update in time. Nothing was charged if it failed; try again.</div>}

        <div className="flow">
          {/* Buyer */}
          <div className="flow-node">
            <span className="icon-tile"><IconWallet /></span>
            <div className="xs muted">Buyer pays</div>
            <div className="title num" style={{ fontSize: "1.7rem" }}>{fmtUsd(shown, 2)}</div>
            <div className="xs faint">USDC</div>
            <div className="flow-receive">
              <IconGold size={15} />
              <span className="num gold">{plan ? fmtNum(done ? gbtIn : plan.gbtOutG, 3) : "—"} GBT</span>
              {done && same(gbtIn, plan!.gbtOutG) && <IconCheck size={14} className="mint" />}
            </div>
            <div className="xs faint">received by the buyer</div>
          </div>

          {/* Transaction */}
          <div className={`flow-tx ${phase}`}>
            <div className="flow-pipe"><i /></div>
            <div className="flow-tx-box">
              <IconShield size={18} />
              <b>1 atomic transaction</b>
              <span className="xs muted">
                {phase === "running" ? "Signing and submitting…" : phase === "settling" ? "Confirmed · reading balances" : done ? "Settled on Stellar" : "Ready"}
              </span>
            </div>
            <div className="flow-pipe"><i /></div>
          </div>

          {/* Destinations */}
          <div className="flow-dests">
            <div className="flow-head xs faint">
              <span>Destination</span>
              <span className="r">Contract rule</span>
              <span className="r">On-chain change</span>
            </div>
            {rows.map((r) => {
              const ok = r.actual !== undefined && same(r.actual, r.expected);
              return (
                <div key={r.key} className={`flow-row ${r.indent ? "indent" : ""} ${done ? (ok ? "ok" : "bad") : ""}`}>
                  <span className="row" style={{ gap: 8, minWidth: 0 }}>
                    <i className="swatch" style={{ background: r.color }} />
                    <span style={{ minWidth: 0 }}>
                      <span className="small">{r.label}</span>
                      <span className="xs faint block">
                        {r.rule}
                        {r.address && <> · <ExplorerLink kind="account" id={r.address} label={r.address.slice(0, 4) + "…" + r.address.slice(-4)} /></>}
                      </span>
                    </span>
                  </span>
                  <span className="num r small">{fmtUsd(r.expected, 2)}</span>
                  <span className="num r">
                    {r.actual === undefined ? (
                      <span className="faint">{phase === "running" || phase === "settling" ? "…" : "—"}</span>
                    ) : (
                      <span className={ok ? "mint" : "danger"}>
                        +{fmtUsd(r.actual, 2)} {ok && <IconCheck size={13} />}
                      </span>
                    )}
                  </span>
                  <span className="flow-bar" style={{ ["--w" as string]: `${shown > 0 ? Math.max((r.expected / shown) * 100, 0.6) : 0}%`, ["--c" as string]: r.color }} />
                </div>
              );
            })}
          </div>
        </div>

        {done && (
          <div className={`notice ${allMatch ? "success" : "error"}`}>
            {allMatch ? (
              <>
                <b>Every cent accounted for.</b> The buyer paid {fmtUsd(debited, 2)} and the destinations received {fmtUsd(credited, 2)}, exactly as
                the contracts prescribe. {plan?.mines.map((m) => `${MINE_META[m.id]?.code ?? m.id}: ${fmtNum(m.grams, 3)} g booked`).join(" · ")}.
              </>
            ) : (
              <>Some balances differ from the contract rule. Refresh and compare with the transaction in the explorer.</>
            )}
          </div>
        )}
      </div>

      {/* Live balances */}
      <div className="grid g-main">
        <div className="card">
          <div className="card-title">
            <h3><IconWallet /> Live balances on Stellar</h3>
            <button className="icon-btn" onClick={refresh} title="Refresh" disabled={loading}>
              <IconRefresh className={loading ? "spin" : ""} />
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Wallet</th><th>Address</th><th className="r">USDC</th>{done && <th className="r">Last mint</th>}</tr>
              </thead>
              <tbody>
                {[
                  { k: "buyer", label: "Buyer (demo wallet)", addr: account?.address ?? "", v: account?.usdc, d: done ? trace!.after!.buyerUsdc - trace!.before.buyerUsdc : undefined },
                  { k: "fee", label: "Alternun fee wallet", addr: ACCOUNTS.admin, v: p?.pools.fees, d: done ? trace!.after!.fee - trace!.before.fee : undefined },
                  ...(p?.mines ?? []).map((m) => ({ k: `m${m.id}`, label: MINE_META[m.id]?.owner ?? `Mine ${m.id} owner`, addr: m.owner, v: m.ownerUsdc as number | undefined, d: done ? (trace!.after!.owners[m.id] ?? 0) - (trace!.before.owners[m.id] ?? 0) : undefined })),
                  ...TREASURY_SPLIT.filter((s) => s.key !== "miners").map((s) => {
                    const k = s.key as Exclude<PoolKey, "miners">;
                    return { k, label: `${s.label} pool`, addr: POOL_ADDRESS[k], v: p?.pools[k], d: done ? trace!.after!.pools[k] - trace!.before.pools[k] : undefined };
                  }),
                ].map((w) => (
                  <tr key={w.k}>
                    <td className="small">{w.label}</td>
                    <td>{w.addr ? <ExplorerLink kind="account" id={w.addr} /> : "—"}</td>
                    <td className="r num">{w.v === undefined ? "…" : fmtUsd(w.v, 2)}</td>
                    {done && <td className={`r num ${w.d! < 0 ? "danger" : w.d! > 0 ? "mint" : "faint"}`}>{w.d! > 0 ? "+" : ""}{fmtUsd(w.d!, 2)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="xs faint" style={{ marginTop: 12 }}>
            The treasury contract never holds funds: it moves the buyer's USDC straight to each destination inside the mint
            transaction.
          </p>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-title"><h3><IconMine /> Reserve capacity per mine</h3></div>
            {(p?.mines ?? []).map((m) => (
              <div key={m.id} className="stack-sm" style={{ marginBottom: 14 }}>
                <div className="row between small">
                  <b>{MINE_META[m.id]?.code ?? `Mine ${m.id}`}</b>
                  <span className="num muted">{fmtNum(m.mintedG, 1)} g of {fmtNum(m.capacityG, 0)} g</span>
                </div>
                <div className="bar thin"><i style={{ width: `${Math.max((m.mintedG / Math.max(m.capacityG, 1)) * 100, 0.6)}%` }} /></div>
                <div className="row between xs faint">
                  <span>Owner <ExplorerLink kind="account" id={m.owner} /></span>
                  <span className="num">{fmtNum(m.leftG, 0)} g left</span>
                </div>
              </div>
            ))}
            <p className="xs faint">Each mint draws from every mine in proportion to the capacity it has left, and each owner is paid for exactly those grams.</p>
          </div>

          <div className="card">
            <div className="card-title"><h3><IconShield /> Contracts</h3></div>
            <div className="kv"><span>GBT token · supply</span><span className="num">{p ? `${fmtNum(p.gbtSupply, 3)} GBT` : "…"}</span></div>
            <div className="kv"><span>GBT minter · total minted</span><span className="num">{p ? `${fmtNum(p.mintedG, 3)} g` : "…"}</span></div>
            <div className="kv"><span>Project vaults · GBT locked</span><span className="num">{p ? `${fmtNum(p.lockedInVaultsG, 3)} GBT` : "…"}</span></div>
            <div className="kv"><span>Treasury · USDC held</span><span className="num">$0.00</span></div>
            <div className="row wrap xs" style={{ gap: 12, marginTop: 10 }}>
              <span>Minter <ExplorerLink kind="contract" id={CONTRACTS.minter} /></span>
              <span>Treasury <ExplorerLink kind="contract" id={CONTRACTS.treasury} /></span>
              <span>GBT <ExplorerLink kind="contract" id={CONTRACTS.gbt} /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
