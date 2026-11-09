import { useState } from "react";
import { ACCOUNTS, CONTRACTS, DEPLOYED_AT, MINE_META, PROJECT_META, RESOURCE_WEIGHTS } from "../config";
import { fmtNum, fmtPct, fmtUsd, statusLabel } from "../format";
import { useApp } from "../state/app";
import { invoke, sv, toUsd1e7 } from "../stellar/client";
import type { ProjectStatus } from "../stellar/protocol";
import { IconKey, IconLayers, IconShield } from "../components/icons";
import { CopyButton, ExplorerLink } from "../components/ui";

const CONTRACT_ROWS: { key: keyof typeof CONTRACTS; name: string; role: string }[] = [
  { key: "minter", name: "GBT Minter", role: "Checks reserve capacity, prices at the oracle and issues GBT" },
  { key: "gbt", name: "GBT Token", role: "Gold-backed token (SEP-41, 7 decimals = grams)" },
  { key: "vaults", name: "Project Vaults", role: "Project funding, collateral, loan shares and exits" },
  { key: "pgbt", name: "pGBT Token", role: "Receipt for GBT staked in projects" },
  { key: "ept", name: "ePT Token", role: "Impact token issued when a loan share is repaid" },
  { key: "treasury", name: "Treasury", role: "Splits mint proceeds 50 / 30 / 20" },
  { key: "oracle", name: "Gold Price Oracle", role: "USD per gram (mock oracle on testnet)" },
  { key: "usdc", name: "USDC (test asset)", role: "Stellar Asset Contract for the demo stablecoin" },
];

const NEXT_STATUS: ProjectStatus[] = ["InConstruction", "Operational", "Completed"];

export function Protocol() {
  const { protocol: p, admin, runTx } = useApp();
  const [price, setPrice] = useState("");
  const [projectId, setProjectId] = useState(4);
  const [status, setStatus] = useState<ProjectStatus>("InConstruction");

  const setOraclePrice = () =>
    runTx("Updating gold price", (onPhase) =>
      invoke(admin!, CONTRACTS.oracle, "set_price", [sv.addr(admin!.address), sv.i128(toUsd1e7(Number(price)))], onPhase),
    );
  const approve = (id: number) =>
    runTx(`Approving ${PROJECT_META[id]?.name ?? `project ${id}`}`, (onPhase) =>
      invoke(admin!, CONTRACTS.vaults, "approve_project", [sv.addr(admin!.address), sv.u32(id)], onPhase),
    );
  const changeStatus = () =>
    runTx(`Moving project to ${statusLabel(status)}`, (onPhase) =>
      invoke(admin!, CONTRACTS.vaults, "set_status", [sv.addr(admin!.address), sv.u32(projectId), sv.enumUnit(status)], onPhase),
    );

  const proposed = (p?.projects ?? []).filter((x) => x.status === "Proposed");

  return (
    <div className="page">
      <div className="section-head">
        <div className="stack-sm">
          <span className="kicker">Protocol</span>
          <h2>Smart contracts and parameters</h2>
          <p className="muted">
            Every number in this app is read directly from Soroban contracts on Stellar testnet. Each contract can be
            inspected on the public explorer.
          </p>
        </div>
        <span className="badge grey">Deployed {new Date(DEPLOYED_AT).toLocaleDateString("en-US", { dateStyle: "medium" })}</span>
      </div>

      <div className="card">
        <div className="card-title"><h3><IconLayers /> Contracts</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Contract</th><th>Role</th><th className="r">Address</th></tr>
            </thead>
            <tbody>
              {CONTRACT_ROWS.map((c) => (
                <tr key={c.key}>
                  <td><b>{c.name}</b></td>
                  <td className="small muted">{c.role}</td>
                  <td className="r">
                    <span className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                      <ExplorerLink kind="contract" id={CONTRACTS[c.key]} />
                      <CopyButton text={CONTRACTS[c.key]} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-title"><h3><IconShield /> Parameters</h3></div>
          <div className="kv"><span>Mint fee</span><span className="num">{p ? fmtPct(p.feeBps / 10000, 2) : "…"}</span></div>
          <div className="kv"><span>Commercial factor on resources</span><span className="num">{p ? fmtPct(p.fcBps / 10000) : "…"}</span></div>
          {RESOURCE_WEIGHTS.map((w) => (
            <div className="kv" key={w.key}><span>Weight · {w.label}</span><span className="num">{fmtPct(w.weight)}</span></div>
          ))}
          <div className="kv"><span>Project max loan-to-value</span><span className="num">50%</span></div>
          <div className="kv"><span>Early withdrawal penalty</span><span className="num">5%</span></div>
          <div className="kv"><span>Minting status</span><span className={p?.paused ? "danger" : "mint"}>{p ? (p.paused ? "Paused" : "Active") : "…"}</span></div>
        </div>

        <div className="card">
          <div className="card-title"><h3><IconShield /> Supply</h3></div>
          <div className="kv"><span>GBT total supply</span><span className="num">{p ? `${fmtNum(p.gbtSupply, 3)} GBT` : "…"}</span></div>
          <div className="kv"><span>GBT locked in project vaults</span><span className="num">{p ? `${fmtNum(p.lockedInVaultsG, 3)} GBT` : "…"}</span></div>
          <div className="kv"><span>pGBT outstanding</span><span className="num">{p ? fmtNum(p.pgbtSupply, 3) : "…"}</span></div>
          <div className="kv"><span>ePT issued</span><span className="num">{p ? fmtNum(p.eptSupply, 3) : "…"}</span></div>
          <div className="kv"><span>Registered mines</span><span className="num">{p ? p.mines.filter((m) => m.enabled).map((m) => MINE_META[m.id]?.code ?? m.id).join(", ") : "…"}</span></div>
          <div className="kv"><span>Treasury pools</span><span className="mono small">{[ACCOUNTS.poolProjects, ACCOUNTS.poolRecovery, ACCOUNTS.poolExploration, ACCOUNTS.poolMarketing, ACCOUNTS.poolTax].map((a) => a.slice(0, 4)).join(" · ")}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3><IconKey /> Admin console</h3>
          <span className="badge gold">Signed with the testnet admin key</span>
        </div>
        {!admin ? (
          <div className="notice">Admin key not configured (.env.local). Admin actions are disabled.</div>
        ) : (
          <div className="grid g-3">
            <div className="inset stack">
              <b>Gold price oracle</b>
              <p className="xs muted">Current: {p ? `${fmtUsd(p.goldPrice, 2)} / g` : "…"}</p>
              <div className="input-wrap">
                <input className="input num" placeholder="e.g. 168.50" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
                <span className="input-suffix small">USD/g</span>
              </div>
              <button className="btn btn-indigo btn-sm" disabled={!(Number(price) > 0)} onClick={setOraclePrice}>Update price</button>
            </div>

            <div className="inset stack">
              <b>Projects under review</b>
              {proposed.length === 0 ? (
                <p className="xs muted">No projects waiting for approval.</p>
              ) : (
                proposed.map((x) => (
                  <div key={x.id} className="row between">
                    <span className="small">{PROJECT_META[x.id]?.name ?? x.name}</span>
                    <button className="btn btn-primary btn-sm" onClick={() => approve(x.id)}>Approve</button>
                  </div>
                ))
              )}
            </div>

            <div className="inset stack">
              <b>Project lifecycle</b>
              <select className="input" value={projectId} onChange={(e) => setProjectId(Number(e.target.value))}>
                {(p?.projects ?? []).map((x) => (
                  <option key={x.id} value={x.id}>{PROJECT_META[x.id]?.name ?? x.name} · {statusLabel(x.status)}</option>
                ))}
              </select>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                {NEXT_STATUS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <button className="btn btn-indigo btn-sm" onClick={changeStatus}>Update status</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
