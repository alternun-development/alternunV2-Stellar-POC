import { AIRS_URL, CONTRACTS, PROJECT_META, airsFor } from "../config";
import { fmtGrams, fmtNum, fmtUsd, statusLabel } from "../format";
import { useApp } from "../state/app";
import { invoke, sv } from "../stellar/client";
import { CategoryIcon, IconCoins, IconGold, IconLayers, IconLeaf } from "../components/icons";
import { CopyButton, ExplorerLink, Stat } from "../components/ui";
import type { View } from "../App";

export function Portfolio({ go }: { go: (v: View) => void }) {
  const { protocol: p, account: a, signer, runTx } = useApp();

  if (!signer) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", padding: 56 }}>
          <h2>Connect a wallet to see your portfolio</h2>
          <p className="muted" style={{ marginTop: 8 }}>Use the demo wallet or Freighter from the top-right menu.</p>
        </div>
      </div>
    );
  }

  const price = p?.goldPrice ?? 0;
  const L = !a;
  const stakedG = a ? a.positions.reduce((s, x) => s + x.stakedG, 0) : 0;
  const debt = a ? a.positions.reduce((s, x) => s + (x.debtOwedUsd - x.debtPaidUsd), 0) : 0;
  const total = a ? a.usdc + (a.gbt + stakedG) * price : 0;
  const airs = a ? a.positions.reduce((s, x) => s + airsFor(PROJECT_META[x.projectId]?.category, x.stakedG), 0) : 0;

  const unstake = (projectId: number, units: number, name: string) =>
    runTx(`Withdrawing from ${name}`, (onPhase) =>
      invoke(signer, CONTRACTS.vaults, "unstake_with_penalty", [sv.addr(signer.address), sv.u32(projectId), sv.u32(units)], onPhase),
    );

  return (
    <div className="page">
      <div className="section-head">
        <div className="stack-sm">
          <span className="kicker">Portfolio</span>
          <h2>Your holdings</h2>
          <div className="row small muted">
            <ExplorerLink kind="account" id={signer.address} label={signer.address} />
            <CopyButton text={signer.address} />
          </div>
        </div>
        <div className="row wrap" style={{ alignItems: "stretch" }}>
          <a className="card tight airs-stat" href={AIRS_URL} target="_blank" rel="noreferrer">
            <Stat label={<><img src="/brand/airs-symbol.png" alt="" width={15} height={15} /> Airs earned</>} value={a ? fmtNum(airs, 0) : ""} loading={L} tone="mint" sub="From solar and reforestation stakes ↗" />
          </a>
          <div className="card tight indigo" style={{ minWidth: 260 }}>
            <Stat label="Total value at oracle price" value={fmtUsd(total, 0)} loading={L} sub={a && debt > 0 ? `Loan share outstanding ${fmtUsd(debt, 0)}` : undefined} />
          </div>
        </div>
      </div>

      <div className="grid g-4">
        <div className="card tight">
          <Stat label={<><IconCoins size={15} /> USDC</>} value={a ? fmtNum(a.usdc, 2) : ""} sub="Stablecoin (testnet)" loading={L} />
        </div>
        <div className="card tight">
          <Stat label={<><IconGold size={15} /> GBT available</>} value={a ? fmtNum(a.gbt, 3) : ""} sub={a ? `≈ ${fmtUsd(a.gbt * price, 0)}` : ""} loading={L} tone="gold" />
        </div>
        <div className="card tight">
          <Stat label={<><IconLayers size={15} /> pGBT (staked receipt)</>} value={a ? fmtNum(a.pgbt, 3) : ""} sub={a ? `≈ ${fmtUsd(stakedG * price, 0)} committed` : ""} loading={L} tone="indigo" />
        </div>
        <div className="card tight">
          <Stat label={<><IconLeaf size={15} /> ePT (impact token)</>} value={a ? fmtNum(a.ept, 3) : ""} sub="Issued when a loan share is repaid" loading={L} tone="mint" />
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3><IconLayers /> Project positions</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => go("projects")}>Browse projects</button>
        </div>
        {a && a.positions.length === 0 ? (
          <div className="inset muted small" style={{ textAlign: "center", padding: 28 }}>
            No positions yet. {a.gbt > 0 ? "Stake GBT in an open project to start." : "Mint GBT, then stake it in an open project."}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => go(a.gbt > 0 ? "projects" : "mint")}>
                {a.gbt > 0 ? "Go to projects" : "Mint GBT"}
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th className="r">Units</th>
                  <th className="r">GBT staked</th>
                  <th className="r">Value now</th>
                  <th className="r">Loan share</th>
                  <th className="r">Airs</th>
                  <th className="r"></th>
                </tr>
              </thead>
              <tbody>
                {(a?.positions ?? []).map((pos) => {
                  const proj = p?.projects.find((x) => x.id === pos.projectId);
                  const meta = PROJECT_META[pos.projectId];
                  const name = meta?.name ?? proj?.name ?? `Project ${pos.projectId}`;
                  return (
                    <tr key={pos.projectId}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <span className="icon-tile" style={{ width: 34, height: 34 }}><CategoryIcon category={meta?.category ?? "Solar"} size={16} /></span>
                          <div>
                            <b>{name}</b>
                            <div className="xs faint">{meta?.location}</div>
                          </div>
                        </div>
                      </td>
                      <td>{proj && <span className="badge grey">{statusLabel(proj.status)}</span>}</td>
                      <td className="r num">{pos.units}</td>
                      <td className="r num">{fmtGrams(pos.stakedG, 0)}</td>
                      <td className="r num">{fmtUsd(pos.stakedG * price, 0)}</td>
                      <td className="r num">{fmtUsd(pos.debtOwedUsd - pos.debtPaidUsd, 0)}</td>
                      <td className="r num mint">{airsFor(meta?.category, pos.stakedG) > 0 ? fmtNum(airsFor(meta?.category, pos.stakedG), 0) : <span className="faint">—</span>}</td>
                      <td className="r">
                        {proj && !proj.finalized && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Withdraw one unit (5% penalty stays in the vault)"
                            onClick={() => unstake(pos.projectId, 1, name)}
                          >
                            Withdraw 1 unit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="xs faint" style={{ marginTop: 12 }}>
          Withdrawing before a project is funded returns the GBT minus a 5% penalty that stays in the project vault.
        </p>
      </div>
    </div>
  );
}
