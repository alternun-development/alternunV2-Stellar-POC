import { useEffect, useState } from "react";
import { CONTRACTS, MAX_MINE_ID, MINE_META, TREASURY_SPLIT, USDC_ISSUER_SECRET } from "../config";
import { fmtGrams, fmtGramsCompact, fmtNum, fmtUsd } from "../format";
import { useApp } from "../state/app";
import { addUsdcTrustline, accountExists, fundWithFriendbot, invoke, requestTestUsdc, sv, toUsd1e7 } from "../stellar/client";
import { estimateMint, previewMint, type MintPreview } from "../stellar/protocol";
import { IconCoins, IconGold, IconMine } from "../components/icons";
import { ConfirmModal, ExplorerLink, Progress } from "../components/ui";

const PRESETS = [1000, 5000, 10000, 25000];

export function Mint() {
  const { protocol: p, account, signer, runTx } = useApp();
  const [amount, setAmount] = useState("10000");
  const [preview, setPreview] = useState<MintPreview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [lastMint, setLastMint] = useState<{ hash: string; grams: number } | null>(null);

  const amt = Number(amount) || 0;

  useEffect(() => {
    if (amt <= 0) {
      setPreview(null);
      return;
    }
    if (p) setPreview(estimateMint(amt, p)); // instant, then exact from the contract
    let live = true;
    const t = setTimeout(async () => {
      try {
        const pv = await previewMint(amt, p);
        if (live) {
          setPreview(pv);
          setPreviewErr(null);
        }
      } catch (e) {
        if (live) setPreviewErr(e instanceof Error ? e.message : String(e));
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amt, p?.mintedG, p?.goldPrice]);

  const needsSetup = !!account && (!account.trustline || account.usdc < 1);
  const insufficient = !!account && account.usdc < amt;
  const canMint = !!signer && !!preview?.meetsMin && !preview?.exceedsCapacity && !insufficient && amt > 0 && !p?.paused;

  const doMint = () =>
    runTx("Minting GBT", async (onPhase) => {
      const res = await invoke(signer!, CONTRACTS.minter, "mint", [sv.addr(signer!.address), sv.i128(toUsd1e7(amt)), sv.u32(MAX_MINE_ID)], onPhase);
      setLastMint({ hash: res.hash, grams: preview?.gbtOutG ?? 0 });
      return res;
    });

  const setupAccount = () =>
    runTx("Preparing account", async () => {
      if (!signer) throw new Error("Connect a wallet first.");
      if (!(await accountExists(signer.address))) await fundWithFriendbot(signer.address);
      let hash = "";
      if (!account?.trustline) hash = await addUsdcTrustline(signer);
      if (USDC_ISSUER_SECRET) hash = await requestTestUsdc(signer.address, 50_000);
      return hash;
    });

  return (
    <div className="page">
      <div className="section-head">
        <div className="stack-sm">
          <span className="kicker">Mint</span>
          <h2>Mint gold-backed tokens</h2>
          <p className="muted">
            Pay in USDC and receive GBT at the oracle gold price. Issuance is checked against the registered reserve
            capacity in the same transaction.
          </p>
        </div>
      </div>

      <div className="grid g-main">
        <div className="card stack" style={{ gap: 20 }}>
          {!signer && <div className="notice info">Connect a wallet (top right) to mint.</div>}
          {signer && needsSetup && (
            <div className="notice info row between wrap">
              <span>This account needs a USDC trustline and test USDC before minting.</span>
              <button className="btn btn-indigo btn-sm" onClick={setupAccount}>Set up account</button>
            </div>
          )}

          <div className="field">
            <div className="row between">
              <label>You pay</label>
              {account && (
                <span className="xs muted num">
                  Balance {fmtNum(account.usdc, 2)} USDC{" "}
                  <button className="chip" style={{ padding: "2px 8px", marginLeft: 6 }} onClick={() => setAmount(String(Math.floor(account.usdc)))}>
                    Max
                  </button>
                </span>
              )}
            </div>
            <div className="input-wrap">
              <input
                className="input big num"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                aria-label="Amount in USDC"
              />
              <span className="input-suffix">USDC</span>
            </div>
            <div className="chips" style={{ marginTop: 10 }}>
              {PRESETS.map((v) => (
                <button key={v} className={`chip ${amt === v ? "on" : ""}`} onClick={() => setAmount(String(v))}>
                  {fmtUsd(v, 0)}
                </button>
              ))}
            </div>
          </div>

          <div className="inset" style={{ background: "rgba(246,215,124,0.06)", borderColor: "rgba(246,215,124,0.25)" }}>
            <div className="xs muted">You receive</div>
            <div className="row between" style={{ marginTop: 4 }}>
              <span className="title gold num" style={{ fontSize: "2.2rem" }}>
                {preview ? fmtNum(preview.gbtOutG, 3) : "—"} <span style={{ fontSize: "1.1rem" }}>GBT</span>
              </span>
              <span className="icon-tile gold"><IconGold /></span>
            </div>
            <div className="xs faint">1 GBT = 1 gram of gold-equivalent reserve value</div>
          </div>

          <div>
            <div className="kv"><span>Gold price (oracle)</span><span className="num">{preview ? `${fmtUsd(preview.price, 2)} / g` : "…"}</span></div>
            <div className="kv"><span>Protocol fee ({p ? p.feeBps / 100 : 2}%)</span><span className="num">{preview ? fmtUsd(preview.feeUsd, 2) : "…"}</span></div>
            <div className="kv"><span>Net to treasury</span><span className="num">{preview ? fmtUsd(preview.netUsd, 2) : "…"}</span></div>
            <div className="kv"><span>Capacity left after mint</span><span className="num">{preview ? fmtGramsCompact(preview.capacityLeftG) : "…"}</span></div>
          </div>

          {preview && !preview.meetsMin && amt > 0 && <div className="notice">The minimum mint is 1 gram of GBT.</div>}
          {preview?.exceedsCapacity && <div className="notice">This amount exceeds the reserve capacity left. The contract rejects it rather than charging for grams it cannot mint.</div>}
          {insufficient && account?.trustline && <div className="notice">Not enough USDC in this account.</div>}
          {previewErr && <div className="notice error">{previewErr}</div>}

          <button className="btn btn-primary btn-lg btn-block" disabled={!canMint} onClick={() => setConfirming(true)}>
            <IconCoins size={18} /> Mint {preview ? fmtNum(preview.gbtOutG, 3) : ""} GBT
          </button>

          {lastMint && (
            <div className="position-box small">
              <b className="mint">Minted {fmtNum(lastMint.grams, 3)} GBT.</b>{" "}
              <span className="muted">Transaction </span>
              <ExplorerLink kind="tx" id={lastMint.hash} />
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-title">
              <h3><IconCoins /> Where the USDC goes</h3>
            </div>
            {TREASURY_SPLIT.map((s) => (
              <div key={s.key}>
                <div className="kv">
                  <span>{s.label} <span className="faint">{+(s.share * 100).toFixed(1)}%</span></span>
                  <span className="num">{preview ? fmtUsd(preview.split[s.key], 2) : "…"}</span>
                </div>
                {s.key === "miners" &&
                  preview?.mines.map((m) => (
                    <div className="kv sub-kv" key={m.id}>
                      <span>↳ {MINE_META[m.id]?.owner ?? `Mine ${m.id} owner`} <span className="faint">backs {fmtNum(m.grams, 3)} g</span></span>
                      <span className="num">{fmtUsd(m.usd, 2)}</span>
                    </div>
                  ))}
              </div>
            ))}
            <div className="kv"><span>Alternun protocol fee</span><span className="num">{preview ? fmtUsd(preview.feeUsd, 2) : "…"}</span></div>
            <p className="xs faint" style={{ marginTop: 10 }}>
              Executed atomically in the mint transaction. Each mine owner is paid in proportion to the GBT its mine backs.
            </p>
          </div>

          <div className="card">
            <div className="card-title">
              <h3><IconMine /> Backing capacity</h3>
            </div>
            {p && (
              <div className="stack">
                <Progress value={Math.max(p.mintedG / p.totalCapacityG, 0.004)} />
                <div className="kv"><span>Total capacity</span><span className="num">{fmtGramsCompact(p.totalCapacityG)}</span></div>
                <div className="kv"><span>Already minted</span><span className="num">{fmtGrams(p.mintedG, 1)}</span></div>
                <div className="kv"><span>Available</span><span className="num mint">{fmtGramsCompact(p.availableG)}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirming && preview && (
        <ConfirmModal
          title="Confirm mint"
          rows={[
            { label: "You pay", value: `${fmtNum(amt, 2)} USDC` },
            { label: "Fee", value: fmtUsd(preview.feeUsd, 2) },
            { label: "Gold price", value: `${fmtUsd(preview.price, 2)} / g` },
            { label: "You receive", value: <span className="gold">{fmtNum(preview.gbtOutG, 3)} GBT</span> },
          ]}
          confirmLabel="Mint GBT"
          onConfirm={doMint}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
