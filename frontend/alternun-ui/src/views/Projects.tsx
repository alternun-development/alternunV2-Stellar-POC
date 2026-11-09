import { useMemo, useState } from "react";
import { CONTRACTS, PROJECT_META } from "../config";
import { fmtGrams, fmtNum, fmtPct, fmtUsd } from "../format";
import { useApp } from "../state/app";
import { invoke, sv } from "../stellar/client";
import type { Project } from "../stellar/protocol";
import { CategoryIcon, IconLayers, IconShield } from "../components/icons";
import { ConfirmModal, Progress, StatusBadge } from "../components/ui";

type Filter = "all" | "open" | "progress" | "review";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All projects" },
  { key: "open", label: "Open for funding" },
  { key: "progress", label: "Funded & building" },
  { key: "review", label: "Under review" },
];

const matches = (p: Project, f: Filter) =>
  f === "all" ||
  (f === "open" && p.status === "Active") ||
  (f === "progress" && ["Funded", "InConstruction", "Operational", "Completed"].includes(p.status)) ||
  (f === "review" && p.status === "Proposed");

export function Projects() {
  const { protocol: p } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const list = useMemo(() => (p?.projects ?? []).filter((x) => matches(x, filter)), [p, filter]);

  return (
    <div className="page">
      <div className="section-head">
        <div className="stack-sm">
          <span className="kicker">Projects</span>
          <h2>Regenerative projects backed by GBT</h2>
          <p className="muted">
            Commit GBT as collateral to a project. Each stake unit is valued at the oracle gold price and carries a
            pro-rata share of the project loan, up to a 50% loan-to-value.
          </p>
        </div>
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pipeline">
        {[
          { n: 1, t: "Funding", d: "GBT is staked in units. Stakers receive pGBT as a receipt and carry 50% of their stake value as their share of the loan." },
          { n: 2, t: "Build & operate", d: "Once collateral reaches 2× the loan, the project is funded, built and operated. Profits are booked on-chain." },
          { n: 3, t: "Repay & release", d: "Profits repay each staker's share of the loan first. Then the GBT is released and the staker receives ePT." },
        ].map((s) => (
          <div className="pipe" key={s.n}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="step-num">{s.n}</span>
              <b>{s.t}</b>
            </div>
            <p className="small muted">{s.d}</p>
          </div>
        ))}
      </div>

      {!p ? (
        <div className="grid g-2">
          {[0, 1].map((i) => (
            <div key={i} className="card skeleton" style={{ height: 420 }} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="card muted" style={{ textAlign: "center", padding: 48 }}>No projects in this category yet.</div>
      ) : (
        <div className="grid g-2">
          {list.map((x) => (
            <ProjectCard key={x.id} project={x} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project: x }: { project: Project }) {
  const { protocol: p, account, signer, runTx } = useApp();
  const [units, setUnits] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const meta = PROJECT_META[x.id];
  const price = p?.goldPrice ?? 0;
  const unitUsd = x.stakeUnitG * price;
  const progress = x.raisedUsd / x.targetUsd;
  const position = account?.positions.find((q) => q.projectId === x.id);
  const remainingUnits = Math.max(1, Math.ceil((x.targetUsd - x.raisedUsd) / Math.max(unitUsd, 1)));
  const maxByBalance = account ? Math.floor(account.gbt / x.stakeUnitG) : 0;
  const maxUnits = Math.max(1, Math.min(remainingUnits, maxByBalance || 1, 50));
  const open = x.status === "Active";
  const needGbt = units * x.stakeUnitG;
  const enough = !!account && account.gbt + 1e-9 >= needGbt;

  const stake = () =>
    runTx(`Staking in ${meta?.name ?? x.name}`, (onPhase) =>
      invoke(signer!, CONTRACTS.vaults, "stake_gbt", [sv.addr(signer!.address), sv.u32(x.id), sv.u32(units)], onPhase),
    );

  return (
    <div className="card project">
      <div className={`project-cover ${meta?.category ?? "Solar"}`}>
        <span className="bg"><CategoryIcon category={meta?.category ?? "Solar"} size={64} /></span>
        <span className="badge solid">
          <CategoryIcon category={meta?.category ?? "Solar"} size={13} /> {meta?.category ?? "Project"} · {meta?.location}
        </span>
        <StatusBadge status={x.status} />
      </div>

      <div className="stack-sm">
        <h3 style={{ fontSize: "1.4rem" }}>{meta?.name ?? x.name}</h3>
        <p className="small muted">{x.description}</p>
      </div>

      {meta && (
        <div className="facts">
          {meta.facts.map((f) => (
            <div className="fact" key={f.label}>
              <b>{f.value}</b>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="row between small" style={{ marginBottom: 8 }}>
          <span className="num">
            <b>{fmtUsd(x.raisedUsd, 0)}</b> <span className="muted">of {fmtUsd(x.targetUsd, 0)} collateral</span>
          </span>
          <span className="num mint"><b>{fmtPct(Math.min(progress, 1))}</b></span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="grid g-2" style={{ gap: 0, columnGap: 20 }}>
        <div className="kv"><span>Project loan</span><span className="num">{fmtUsd(x.loanUsd, 0)}</span></div>
        <div className="kv"><span>Max LTV</span><span className="num">50%</span></div>
        <div className="kv"><span>Stake unit</span><span className="num">{fmtGrams(x.stakeUnitG, 0)} GBT</span></div>
        <div className="kv"><span>Unit value</span><span className="num">{fmtUsd(unitUsd, 0)}</span></div>
        <div className="kv"><span>Units issued</span><span className="num">{fmtNum(x.unitsIssued, 0)}</span></div>
        <div className="kv"><span>GBT locked</span><span className="num">{fmtGrams(x.stakedG, 0)}</span></div>
      </div>

      {position && position.units > 0 && (
        <div className="position-box">
          <div className="row between small">
            <b className="mint"><IconShield size={15} /> Your position</b>
            <span className="badge mint">{position.units} unit{position.units > 1 ? "s" : ""}</span>
          </div>
          <div className="grid g-3 small" style={{ marginTop: 8, gap: 8 }}>
            <div><div className="xs faint">GBT staked</div><b className="num">{fmtGrams(position.stakedG, 0)}</b></div>
            <div><div className="xs faint">Loan share</div><b className="num">{fmtUsd(position.debtOwedUsd - position.debtPaidUsd, 0)}</b></div>
            <div><div className="xs faint">pGBT receipt</div><b className="num">{fmtNum(position.stakedG, 0)}</b></div>
          </div>
        </div>
      )}

      {open ? (
        <div className="row between wrap" style={{ marginTop: "auto" }}>
          <div className="row">
            <div className="stepper" aria-label="Stake units">
              <button onClick={() => setUnits((u) => Math.max(1, u - 1))} disabled={units <= 1}>−</button>
              <span className="num">{units}</span>
              <button onClick={() => setUnits((u) => Math.min(maxUnits, u + 1))} disabled={units >= maxUnits}>+</button>
            </div>
            <span className="small muted num">{fmtGrams(needGbt, 0)} · {fmtUsd(units * unitUsd, 0)}</span>
          </div>
          <button className="btn btn-primary" disabled={!signer || !enough} onClick={() => setConfirming(true)}>
            <IconLayers size={17} /> {!signer ? "Connect wallet" : !account ? "Loading…" : enough ? "Stake GBT" : "Mint GBT first"}
          </button>
        </div>
      ) : (
        <div className="inset small muted" style={{ marginTop: "auto" }}>
          {x.status === "Proposed"
            ? "This project is under review and will open for funding once approved by the protocol."
            : "Funding is closed. Collateral is locked until the loan is repaid from project profits."}
        </div>
      )}

      {confirming && (
        <ConfirmModal
          title={`Stake in ${meta?.name ?? x.name}`}
          rows={[
            { label: "Stake units", value: units },
            { label: "GBT committed", value: fmtGrams(needGbt, 0) },
            { label: "Value at oracle price", value: fmtUsd(units * unitUsd, 0) },
            { label: "Your loan share (50%)", value: fmtUsd((units * unitUsd) / 2, 0) },
            { label: "pGBT receipt", value: `${fmtNum(needGbt, 0)} pGBT` },
          ]}
          note="Your GBT is locked in the project vault. Project profits repay your loan share first; then the GBT is released together with ePT."
          confirmLabel="Stake GBT"
          onConfirm={stake}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
