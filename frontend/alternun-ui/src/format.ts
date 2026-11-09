import type { ProjectStatus } from "./stellar/protocol";

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const fmtUsd = (n: number, decimals = n < 1000 ? 2 : 0) => (decimals === 0 ? usd0 : usd2).format(n);
export const fmtUsdCompact = (n: number) => "$" + compact.format(n);
export const fmtNum = (n: number, max = 2) => n.toLocaleString("en-US", { maximumFractionDigits: max });
export const fmtGrams = (g: number, max = 2) => `${fmtNum(g, max)} g`;
export const fmtGramsCompact = (g: number) => (g >= 10_000 ? `${compact.format(g)} g` : fmtGrams(g, 1));
export const fmtPct = (n: number, max = 0) => `${(n * 100).toLocaleString("en-US", { maximumFractionDigits: max })}%`;
export const short = (a: string, n = 4) => (a ? `${a.slice(0, n)}…${a.slice(-n)}` : "");

const STATUS_LABEL: Record<ProjectStatus, string> = {
  Proposed: "Under review",
  Active: "Open for funding",
  Funded: "Fully funded",
  InConstruction: "In construction",
  Operational: "Operational",
  Completed: "Completed",
  Failed: "Closed",
};
export const statusLabel = (s: ProjectStatus) => STATUS_LABEL[s];
