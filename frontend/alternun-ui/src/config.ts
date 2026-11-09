import { Networks } from "@stellar/stellar-sdk";
import deployment from "./deployment.testnet.json";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URLS = [
  "https://rpc.ankr.com/stellar_testnet_soroban",
  "https://soroban-testnet.stellar.org",
];
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const EXPLORER = "https://stellar.expert/explorer/testnet";

export const CONTRACTS = deployment.contracts;
export const ACCOUNTS = deployment.accounts;
export const DEPLOYED_AT = deployment.deployedAt;

// Testnet-only demo keys, loaded from .env.local (written by scripts/deploy-demo.sh).
export const DEMO_SECRET = import.meta.env.VITE_DEMO_SECRET as string | undefined;
export const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET as string | undefined;
export const USDC_ISSUER_SECRET = import.meta.env.VITE_USDC_ISSUER_SECRET as string | undefined;

export const USDC_CODE = "USDC";
export const MAX_MINE_ID = 2;

// Protocol constants mirrored from the contracts (for explanations only; live values are read on-chain).
export const RESOURCE_WEIGHTS = [
  { key: "probadas_gm", label: "Proven reserves", weight: 0.7 },
  { key: "medidos_gm", label: "Measured resources", weight: 0.6 },
  { key: "probables_gm", label: "Probable reserves", weight: 0.5 },
  { key: "indicados_gm", label: "Indicated resources", weight: 0.3 },
  { key: "inferidos_gm", label: "Inferred resources", weight: 0.15 },
] as const;

// Mirrors contracts/treasury: split of the net USDC of every mint.
export const TREASURY_SPLIT = [
  { key: "projects", label: "Regenerative projects", share: 0.5 },
  { key: "recovery", label: "Recovery reserve", share: 0.3 },
  { key: "miners", label: "Mine owners", share: 0.08 },
  { key: "exploration", label: "Exploration", share: 0.05 },
  { key: "marketing", label: "Marketing", share: 0.05 },
  { key: "tax", label: "Tax reserve", share: 0.02 },
] as const;
export type PoolKey = (typeof TREASURY_SPLIT)[number]["key"];

// Illustrative metadata shown next to on-chain data.
export const MINE_META: Record<number, { code: string; location: string; note: string; owner: string }> = {
  1: { code: "AL-1", location: "Rionegro, Santander · Colombia", note: "Inferred resources reported under NI 43-101", owner: "AL-1 mine owner" },
  2: { code: "AL-2", location: "Antioquia · Colombia", note: "Indicated and measured resources", owner: "AL-2 mine owner" },
};

export type ProjectCategory = "Solar" | "Reforestation" | "Water";

// Airs, Alternun's reputation program: staking GBT in eligible projects earns Airs.
export const AIRS_URL = "https://airs.alternun.co";
export const AIRS_PER_GBT: Partial<Record<ProjectCategory, number>> = { Solar: 20, Reforestation: 20 };
export const airsFor = (category: ProjectCategory | undefined, gbt: number) =>
  category ? Math.round((AIRS_PER_GBT[category] ?? 0) * gbt) : 0;

export const PROJECT_META: Record<
  number,
  { name: string; location: string; category: ProjectCategory; facts: { label: string; value: string }[] }
> = {
  1: {
    name: "Rionegro Solar Farm",
    location: "Rionegro, Santander",
    category: "Solar",
    facts: [
      { label: "Capacity", value: "2.4 MW" },
      { label: "Panels", value: "6,000" },
      { label: "Est. output", value: "3,456 MWh/yr" },
    ],
  },
  2: {
    name: "Amalfi Reforestation",
    location: "Amalfi, Antioquia",
    category: "Reforestation",
    facts: [
      { label: "Area", value: "500 ha" },
      { label: "Species", value: "Native" },
      { label: "Focus", value: "Watershed" },
    ],
  },
  3: {
    name: "Girardota Water Treatment",
    location: "Girardota, Antioquia",
    category: "Water",
    facts: [
      { label: "Capacity", value: "10,000 L/day" },
      { label: "Type", value: "Community plant" },
      { label: "Stage", value: "Construction" },
    ],
  },
  4: {
    name: "Nechí Solar Farm",
    location: "Nechí, Antioquia",
    category: "Solar",
    facts: [
      { label: "Scale", value: "Utility" },
      { label: "Stage", value: "Proposal" },
      { label: "Review", value: "Pending" },
    ],
  },
};
