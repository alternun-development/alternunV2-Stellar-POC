import { useEffect, useRef, useState, type ReactNode } from "react";
import { EXPLORER } from "../config";
import { short, statusLabel } from "../format";
import { useApp } from "../state/app";
import type { TxPhase } from "../stellar/client";
import type { ProjectStatus } from "../stellar/protocol";
import { IconAlert, IconCheck, IconClose, IconCopy, IconExternal, IconKey, IconWallet } from "./icons";

export function Stat({ label, value, sub, loading, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; loading?: boolean; tone?: "mint" | "gold" | "indigo" }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value num ${tone ?? ""} ${loading ? "skeleton" : ""}`}>{loading ? "000" : value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Progress({ value, thin }: { value: number; thin?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`bar ${thin ? "thin" : ""}`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ExplorerLink({ kind, id, label }: { kind: "tx" | "contract" | "account"; id: string; label?: string }) {
  return (
    <a href={`${EXPLORER}/${kind}/${id}`} target="_blank" rel="noreferrer" className="row" style={{ display: "inline-flex", gap: 5 }}>
      <span className="mono">{label ?? short(id, 6)}</span>
      <IconExternal />
    </a>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="icon-btn"
      title="Copy"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
    >
      {ok ? <IconCheck size={14} /> : <IconCopy />}
    </button>
  );
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const tone = status === "Active" ? "mint" : status === "Proposed" ? "grey" : status === "Funded" ? "gold" : "";
  return (
    <span className={`badge ${tone} solid`}>
      <span className="dot" /> {statusLabel(status)}
    </span>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

export function ConfirmModal({
  title,
  rows,
  note,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  rows: { label: string; value: ReactNode }[];
  note?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { signer } = useApp();
  return (
    <Modal onClose={onClose}>
      <div className="stack">
        <h2 style={{ fontSize: "1.45rem" }}>{title}</h2>
        <div className="inset">
          {rows.map((r) => (
            <div className="kv" key={r.label}>
              <span>{r.label}</span>
              <span className="num">{r.value}</span>
            </div>
          ))}
        </div>
        {note && <p className="small muted">{note}</p>}
        <p className="xs faint">
          Signed by {signer?.kind === "freighter" ? "Freighter" : "the demo wallet"} · {short(signer?.address ?? "", 5)} · Stellar testnet
        </p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const PHASES: TxPhase[] = ["building", "signing", "submitting", "confirming"];
const PHASE_LABEL: Record<TxPhase, string> = {
  building: "Simulating on Soroban…",
  signing: "Waiting for signature…",
  submitting: "Submitting to Stellar…",
  confirming: "Confirming on ledger…",
};

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const idx = t.phase ? PHASES.indexOf(t.phase) : -1;
        return (
          <div key={t.id} className={`toast ${t.status}`}>
            {t.status === "pending" ? (
              <div className="spinner" />
            ) : t.status === "success" ? (
              <span className="mint"><IconCheck /></span>
            ) : (
              <span className="danger"><IconAlert /></span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between">
                <b>{t.title}</b>
                {t.status !== "pending" && (
                  <button className="icon-btn" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><IconClose /></button>
                )}
              </div>
              {t.status === "pending" && t.phase && (
                <>
                  <div className="small muted">{PHASE_LABEL[t.phase]}</div>
                  <div className="phases">
                    {PHASES.map((p, i) => (
                      <span key={p} className={i < idx ? "done" : i === idx ? "now" : ""} />
                    ))}
                  </div>
                </>
              )}
              {t.status === "success" && (
                <div className="small muted">
                  Confirmed on Stellar · {t.hash && <ExplorerLink kind="tx" id={t.hash} label="view transaction" />}
                </div>
              )}
              {t.status === "error" && <div className="small danger" style={{ wordBreak: "break-word" }}>{t.detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WalletMenu() {
  const { signer, selectDemoWallet, connectFreighterWallet, disconnect, account } = useApp();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="wallet" ref={ref}>
      <button className="btn btn-indigo wallet-btn" onClick={() => setOpen((o) => !o)}>
        {signer ? (
          <>
            <span className="avatar" />
            <span style={{ textAlign: "left", lineHeight: 1.1 }}>
              <span className="small" style={{ display: "block" }}>{short(signer.address, 4)}</span>
              <span className="xs muted">{signer.kind === "freighter" ? "Freighter" : "Demo wallet"}</span>
            </span>
          </>
        ) : (
          <>
            <IconWallet size={18} /> Connect wallet
          </>
        )}
      </button>
      {open && (
        <div className="menu">
          {signer && (
            <div className="menu-head">
              <div className="xs faint">Connected account</div>
              <div className="row between">
                <ExplorerLink kind="account" id={signer.address} label={short(signer.address, 8)} />
                <CopyButton text={signer.address} />
              </div>
              {account && (
                <div className="row small muted" style={{ marginTop: 6, gap: 14 }}>
                  <span className="num">{account.usdc.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC</span>
                  <span className="num gold">{account.gbt.toLocaleString("en-US", { maximumFractionDigits: 2 })} GBT</span>
                </div>
              )}
            </div>
          )}
          <button className={`menu-item ${signer?.kind === "demo" ? "on" : ""}`} onClick={() => { selectDemoWallet(); setOpen(false); }}>
            <span className="icon-tile mint"><IconKey size={18} /></span>
            <span>
              <b>Demo wallet</b>
              <div className="xs muted">Pre-funded testnet account, signs instantly</div>
            </span>
          </button>
          <button
            className={`menu-item ${signer?.kind === "freighter" ? "on" : ""}`}
            onClick={async () => {
              setErr(null);
              try {
                await connectFreighterWallet();
                setOpen(false);
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            <span className="icon-tile"><IconWallet size={18} /></span>
            <span>
              <b>Freighter</b>
              <div className="xs muted">Sign each transaction in the browser extension</div>
            </span>
          </button>
          {err && <div className="notice error small" style={{ margin: 8 }}>{err}</div>}
          {signer && (
            <button className="menu-item small muted" onClick={() => { disconnect(); setOpen(false); }}>
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  );
}
