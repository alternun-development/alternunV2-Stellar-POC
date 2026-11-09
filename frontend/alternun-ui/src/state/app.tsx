import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ADMIN_SECRET, CONTRACTS, DEMO_SECRET } from "../config";
import type { TxPhase } from "../stellar/client";
import { connectFreighter, keypairSigner, type Signer } from "../stellar/signers";
import { loadAll, type AccountState, type ProtocolState } from "../stellar/protocol";

export interface Toast {
  id: number;
  title: string;
  status: "pending" | "success" | "error";
  detail?: string;
  hash?: string;
  phase?: TxPhase;
}

interface AppState {
  protocol: ProtocolState | null;
  protocolError: string | null;
  account: AccountState | null;
  signer: Signer | null;
  admin: Signer | null;
  loading: boolean;
  refresh: () => Promise<void>;
  selectDemoWallet: () => void;
  connectFreighterWallet: () => Promise<void>;
  disconnect: () => void;
  runTx: <T>(title: string, fn: (onPhase: (p: TxPhase) => void) => Promise<{ hash: string; value?: T } | string>) => Promise<boolean>;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppState | null>(null);

const demoSigner = DEMO_SECRET ? keypairSigner(DEMO_SECRET, "demo") : null;
const adminSigner = ADMIN_SECRET ? keypairSigner(ADMIN_SECRET, "admin") : null;

// Last known state, so the page paints instantly and then refreshes from the network.
const CACHE_KEY = `alternun.v2.cache.${CONTRACTS.vaults}`;
type Cache = { protocol: ProtocolState; accounts: Record<string, AccountState> };
function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}
function writeCache(protocol: ProtocolState, account: AccountState | null) {
  try {
    const prev = readCache();
    const accounts = { ...(prev?.accounts ?? {}) };
    if (account) accounts[account.address] = account;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ protocol, accounts }));
  } catch {
    /* storage unavailable */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const cache = useMemo(readCache, []);
  const [protocol, setProtocol] = useState<ProtocolState | null>(cache?.protocol ?? null);
  const [protocolError, setProtocolError] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(demoSigner);
  const [account, setAccount] = useState<AccountState | null>(
    demoSigner ? (cache?.accounts[demoSigner.address] ?? null) : null,
  );
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const signerRef = useRef(signer);
  signerRef.current = signer;
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (inflight.current) return inflight.current;
    const run = (async () => {
      setLoading(true);
      try {
        const s = signerRef.current;
        const { protocol: p, account: a } = await loadAll(s?.address);
        if (signerRef.current?.address !== s?.address) return; // wallet switched meanwhile
        setProtocol(p);
        setAccount(a);
        setProtocolError(null);
        writeCache(p, a);
      } catch (e) {
        setProtocolError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    setAccount(signer ? (readCache()?.accounts[signer.address] ?? null) : null);
    inflight.current = null;
    refresh();
  }, [signer, refresh]);

  const pushToast = (t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((xs) => [...xs, { ...t, id }]);
    return id;
  };
  const patchToast = (id: number, patch: Partial<Toast>) =>
    setToasts((xs) => xs.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const dismissToast = (id: number) => setToasts((xs) => xs.filter((t) => t.id !== id));

  const runTx: AppState["runTx"] = async (title, fn) => {
    const id = pushToast({ title, status: "pending", phase: "building" });
    try {
      const res = await fn((phase) => patchToast(id, { phase }));
      const hash = typeof res === "string" ? res : res.hash;
      patchToast(id, { status: "success", hash, phase: undefined });
      setTimeout(() => dismissToast(id), 12_000);
      // The RPC node may lag a ledger behind the confirmed transaction: refresh now and again shortly after.
      await new Promise((r) => setTimeout(r, 1500));
      await refresh();
      setTimeout(refresh, 5000);
      return true;
    } catch (e) {
      patchToast(id, { status: "error", detail: e instanceof Error ? e.message : String(e), phase: undefined });
      return false;
    }
  };

  const value = useMemo<AppState>(
    () => ({
      protocol,
      protocolError,
      account,
      signer,
      admin: adminSigner,
      loading,
      refresh,
      selectDemoWallet: () => setSigner(demoSigner),
      connectFreighterWallet: async () => {
        const s = await connectFreighter();
        setSigner(s);
      },
      disconnect: () => setSigner(null),
      runTx,
      toasts,
      dismissToast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [protocol, protocolError, account, signer, loading, toasts, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
