import { useEffect, useState } from "react";
import { useApp } from "./state/app";
import { Toasts, WalletMenu } from "./components/ui";
import { IconExternal } from "./components/icons";
import { AIRS_URL } from "./config";
import { Overview } from "./views/Overview";
import { Mint } from "./views/Mint";
import { Projects } from "./views/Projects";
import { Portfolio } from "./views/Portfolio";
import { Protocol } from "./views/Protocol";
import { Flows } from "./views/Flows";

export type View = "overview" | "mint" | "flows" | "projects" | "portfolio" | "protocol";

const NAV: { key: View; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "mint", label: "Mint GBT" },
  { key: "flows", label: "Money flow" },
  { key: "projects", label: "Projects" },
  { key: "portfolio", label: "Portfolio" },
  { key: "protocol", label: "Protocol" },
];

const fromHash = (): View => {
  const h = window.location.hash.replace("#", "") as View;
  return NAV.some((n) => n.key === h) ? h : "overview";
};

export default function App() {
  const [view, setView] = useState<View>(fromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const { protocolError } = useApp();

  useEffect(() => {
    const h = () => setView(fromHash());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const go = (v: View) => {
    window.location.hash = v;
    setView(v);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <button className="brand" onClick={() => go("overview")} aria-label="Alternun home">
            <img src="/brand/alternun-indigo.png" alt="Alternun" />
            <small>Gold reserve<br />tokenization</small>
          </button>
          <nav className={`nav ${menuOpen ? "open" : ""}`} id="main-nav">
            {NAV.map((n) => (
              <button key={n.key} className={view === n.key ? "active" : ""} onClick={() => go(n.key)}>
                {n.label}
              </button>
            ))}
            <a className="nav-airs" href={AIRS_URL} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>
              <img src="/brand/airs-symbol.png" alt="" /> Airs <IconExternal />
            </a>
          </nav>
          <WalletMenu />
          <button
            className={`menu-toggle ${menuOpen ? "open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>
      <div className="demo-strip">
        <div className="shell">
          <span className="badge mint"><span className="dot live" /> Stellar testnet</span>
          <span>Live smart contracts. Mine and project data are illustrative for this pilot.</span>
        </div>
      </div>

      <main className="shell">
        {protocolError && (
          <div className="notice error" style={{ marginTop: 24 }}>
            Could not read the contracts from Stellar: {protocolError}
          </div>
        )}
        {view === "overview" && <Overview go={go} />}
        {view === "mint" && <Mint />}
        {view === "flows" && <Flows />}
        {view === "projects" && <Projects />}
        {view === "portfolio" && <Portfolio go={go} />}
        {view === "protocol" && <Protocol />}
      </main>

      <footer className="footer">
        <div className="shell row between wrap">
          <span>© {new Date().getFullYear()} Alternun · Gold-backed tokenization on Stellar</span>
          <span>Pilot environment · Stellar testnet · Soroban smart contracts</span>
        </div>
      </footer>
      <Toasts />
    </>
  );
}
