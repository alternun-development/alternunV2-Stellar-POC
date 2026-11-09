import { AIRS_PER_GBT, AIRS_URL, MINE_META, RESOURCE_WEIGHTS, TREASURY_SPLIT } from "../config";
import { fmtGrams, fmtGramsCompact, fmtNum, fmtPct, fmtUsd, fmtUsdCompact } from "../format";
import { useApp } from "../state/app";
import { CategoryIcon, IconArrow, IconCoins, IconExternal, IconGold, IconLayers, IconMine, IconRefresh, IconShield } from "../components/icons";
import { Progress, Stat } from "../components/ui";
import type { View } from "../App";

const SPLIT_COLORS = ["var(--mint)", "var(--indigo-300)", "var(--gold)", "#7fd1ff", "#c79bff", "#ff9f7a"];

export function Overview({ go }: { go: (v: View) => void }) {
  const { protocol: p, loading, refresh } = useApp();
  const L = !p;
  const capacityUsed = p ? p.mintedG / Math.max(p.totalCapacityG, 1) : 0;
  const backedUsd = p ? p.projects.reduce((s, x) => s + x.raisedUsd, 0) : 0;
  const poolTotal = p ? TREASURY_SPLIT.reduce((s, x) => s + p.pools[x.key], 0) : 0;

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="stack">
          <span className="kicker">Alternun Protocol · Built on Stellar</span>
          <h1>Underground gold reserves, tokenized to fund regenerative projects.</h1>
          <p className="lead">
            GBT is a gold-backed token whose supply is capped by mineral resources registered on-chain. Every mint
            settles in USDC, funds a treasury split by smart contract, and GBT can be committed as collateral to finance
            solar, water and reforestation projects.
          </p>
          <div className="row wrap">
            <button className="btn btn-primary btn-lg" onClick={() => go("mint")}>
              Mint GBT <IconArrow size={18} />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => go("projects")}>Explore projects</button>
          </div>
          <a className="airs-line" href={AIRS_URL} target="_blank" rel="noreferrer">
            <img src="/brand/airs-symbol.png" alt="" />
            <span>Stake GBT in solar or reforestation projects and earn <b>20 Airs per GBT</b>.</span>
            <span className="mint">Discover Airs <IconExternal /></span>
          </a>
        </div>

        <div className="card indigo live-card">
          <div className="card-title">
            <span className="badge mint"><span className="dot live" /> Live from Stellar testnet</span>
            <button className="icon-btn" onClick={refresh} title="Refresh" disabled={loading}>
              <IconRefresh className={loading ? "spin" : ""} />
            </button>
          </div>
          <div className="grid g-2" style={{ gap: 22 }}>
            <Stat label={<><IconGold size={15} /> Gold price (oracle)</>} value={p ? fmtUsd(p.goldPrice, 2) : ""} sub="per gram" loading={L} tone="gold" />
            <Stat label={<><IconCoins size={15} /> GBT in circulation</>} value={p ? fmtGrams(p.gbtSupply, 1) : ""} sub={p ? `≈ ${fmtUsdCompact(p.gbtSupply * p.goldPrice)}` : ""} loading={L} />
            <Stat label={<><IconMine size={15} /> Mintable capacity</>} value={p ? fmtGramsCompact(p.availableG) : ""} sub={p ? `≈ ${fmtUsdCompact(p.availableG * p.goldPrice)} left` : ""} loading={L} tone="mint" />
            <Stat label={<><IconLayers size={15} /> Committed to projects</>} value={p ? fmtUsdCompact(backedUsd) : ""} sub={p ? `${fmtGrams(p.lockedInVaultsG, 0)} GBT locked` : ""} loading={L} />
          </div>
          <div className="xs faint" style={{ marginTop: 18 }}>
            {p ? `Ledger #${fmtNum(p.ledger, 0)} · refreshes every 20 s` : "Connecting to Soroban RPC…"}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="stack">
        <div className="section-head">
          <div className="stack-sm">
            <span className="kicker">How it works</span>
            <h2>From reserves in the ground to impact on the ground</h2>
          </div>
        </div>
        <div className="grid g-3">
          {[
            {
              icon: <IconMine />,
              title: "Reserves on-chain",
              text: "Each mine is registered with its NI 43-101 resource categories. The contract weights them by confidence and applies a commercial factor, which caps how much GBT can ever exist.",
            },
            {
              icon: <IconCoins />,
              title: "Mint GBT with USDC",
              text: "Buyers pay in USDC at the oracle gold price. A 2% fee applies and the net amount is split by the treasury contract: 50% projects, 30% recovery reserve, 8% mine owners, 5% exploration, 5% marketing and 2% tax reserve.",
            },
            {
              icon: <IconShield />,
              title: "Back regenerative projects",
              text: "Holders commit GBT as collateral to projects at a maximum 50% loan-to-value. They receive pGBT as a receipt and ePT, the project's impact token, once the loan is repaid.",
            },
          ].map((s, i) => (
            <div className="card stack" key={s.title}>
              <div className="row between">
                <span className="icon-tile">{s.icon}</span>
                <span className="step-num">{i + 1}</span>
              </div>
              <h3>{s.title}</h3>
              <p className="muted small">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Airs */}
      <section className="card airs-card">
        <div className="stack">
          <img className="airs-logo" src="/brand/airs-logo.png" alt="Airs by Alternun" />
          <h2>Your positive impact, recognized with Airs</h2>
          <p className="muted">
            Airs is Alternun's reputation program. It recognizes people and companies for their positive impact and builds a
            track record that stays with them. When you stake GBT in a solar farm or a reforestation project, your support
            earns Airs.
          </p>
          <div className="row wrap">
            <a className="btn btn-primary" href={AIRS_URL} target="_blank" rel="noreferrer">
              Discover Airs <IconExternal />
            </a>
            <button className="btn btn-ghost" onClick={() => go("projects")}>See eligible projects</button>
          </div>
        </div>
        <div className="airs-rates">
          {(Object.keys(AIRS_PER_GBT) as (keyof typeof AIRS_PER_GBT)[]).map((c) => (
            <div className="airs-rate" key={c}>
              <span className="icon-tile mint"><CategoryIcon category={c} /></span>
              <div>
                <div className="small muted">{c === "Solar" ? "Solar farms" : "Reforestation"}</div>
                <div className="title num"><span className="mint">{AIRS_PER_GBT[c]} Airs</span> <span className="small muted">per GBT staked</span></div>
              </div>
            </div>
          ))}
          <p className="xs faint">Airs are credited to your Airs profile for the GBT you keep staked in the project.</p>
        </div>
      </section>

      {/* Reserves + treasury */}
      <section className="grid g-main">
        <div className="card">
          <div className="card-title">
            <h3><IconMine /> Reserve backing</h3>
            <span className="badge grey">Commercial factor {p ? fmtPct(p.fcBps / 10000) : "—"}</span>
          </div>
          <div className="stack">
            <div>
              <div className="row between small" style={{ marginBottom: 8 }}>
                <span className="muted">Capacity used</span>
                <span className="num">
                  {p ? `${fmtGrams(p.mintedG, 1)} of ${fmtGramsCompact(p.totalCapacityG)}` : "…"}{" "}
                  <span className="faint">({fmtPct(capacityUsed, 2)})</span>
                </span>
              </div>
              <Progress value={Math.max(capacityUsed, 0.004)} />
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mine</th>
                    <th>Resources registered</th>
                    <th className="r">Mintable capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {(p?.mines ?? []).map((m) => {
                    const meta = MINE_META[m.id];
                    const parts = RESOURCE_WEIGHTS.filter((w) => m[w.key] > 0);
                    return (
                      <tr key={m.id}>
                        <td>
                          <b>{meta?.code ?? `Mine ${m.id}`}</b>
                          <div className="xs faint">{meta?.location}</div>
                        </td>
                        <td>
                          {parts.map((w) => (
                            <div key={w.key} className="small">
                              {fmtGramsCompact(m[w.key])} <span className="faint">{w.label.toLowerCase()} · weight {fmtPct(w.weight)}</span>
                            </div>
                          ))}
                        </td>
                        <td className="r">
                          <b className="num mint">{fmtGramsCompact(m.capacityG)}</b>
                          <div className="xs faint num">{p && `≈ ${fmtUsdCompact(m.capacityG * p.goldPrice)}`}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <h3><IconCoins /> Treasury split</h3>
            <span className="badge grey">USDC · on-chain</span>
          </div>
          <div className="stack">
            <div className="bar split" style={{ height: 14 }}>
              {TREASURY_SPLIT.map((s, i) => (
                <i key={s.key} style={{ width: `${s.share * 100}%`, background: SPLIT_COLORS[i] }} />
              ))}
            </div>
            {TREASURY_SPLIT.map((s, i) => (
              <div className="kv" key={s.key}>
                <span className="row" style={{ gap: 8 }}>
                  <i style={{ width: 10, height: 10, borderRadius: 3, background: SPLIT_COLORS[i], display: "inline-block" }} />
                  {s.label} <span className="faint">{fmtPct(s.share, 1)}</span>
                </span>
                <span className="num">{p ? fmtUsd(p.pools[s.key], 0) : "…"}</span>
              </div>
            ))}
            <div className="kv">
              <span>Mint fees collected</span>
              <span className="num">{p ? fmtUsd(p.pools.fees, 0) : "…"}</span>
            </div>
            <div className="inset small muted">
              {p ? fmtUsd(poolTotal, 0) : "…"} routed by the treasury contract so far. Every split is executed in the same
              transaction as the mint.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
