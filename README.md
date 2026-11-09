# Alternun V2 — Gold-backed tokenization on Stellar

Pilot of the Alternun protocol on Stellar (Soroban). Underground gold resources reported under NI 43-101 cap the
issuance of **GBT**, a gold-backed token minted with USDC. Mint proceeds are split on-chain by the treasury, and GBT
can be committed as collateral to finance regenerative projects (solar, water, reforestation).

## Contracts (`contracts/`, soroban-sdk 22)

| Contract | Role |
|---|---|
| `oracle_mock` | Gold price in USD per gram (1e7 scale). Admin-set on testnet. |
| `gbt_minter` | Registers mines (inferred / indicated / measured / probable / proven), weights them (15/30/60/50/70%) with a commercial factor (80%), prices at the oracle, charges a 2% fee and mints GBT. |
| `treasury` | Splits the net USDC: 50% projects, 30% recovery reserve, 20% Alternun. |
| `gbt_token`, `pgbt_token`, `ept_token` | SEP-41 tokens, 7 decimals (1 GBT = 1 gram). Mint restricted to the controlling contract. |
| `project_vaults` | Projects are funded with GBT stake units valued at the oracle price, up to 2x the loan (50% LTV). Stakers get pGBT as a receipt and carry 50% of their stake value as loan share; profits repay it, then GBT is released with ePT. |

## Deploy to testnet

Requirements: Rust with the `wasm32v1-none` target and Stellar CLI ≥ 25.

```bash
./scripts/deploy-demo.sh
```

The script builds and deploys all contracts, issues a test USDC (classic asset + SAC), registers two mines, creates
four projects, seeds activity and writes:

- `frontend/alternun-ui/src/deployment.testnet.json` — public contract ids
- `frontend/alternun-ui/.env.local` — testnet-only demo keys (git-ignored)

Testnet is reset periodically by the Stellar Development Foundation; rerun the script after a reset.

## Run the app

```bash
cd frontend/alternun-ui
npm install
npm run dev
```

The app opens with a pre-funded **demo wallet** (testnet). Freighter can be connected from the wallet menu.
Mine and project metadata shown in the UI are illustrative for the pilot.
