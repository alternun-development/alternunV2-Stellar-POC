#!/usr/bin/env bash
# Alternun V2 — full testnet deployment for the demo (Stellar CLI >= 25, Git Bash or Linux/macOS).
# Builds, deploys and initializes the 7 contracts, issues a demo USDC, registers mines,
# creates projects and seeds activity. Writes:
#   frontend/alternun-ui/src/deployment.testnet.json   (public contract ids, committed)
#   frontend/alternun-ui/.env.local                    (testnet demo secrets, NOT committed)
set -euo pipefail
cd "$(dirname "$0")/.."
NET="--network testnet"
WASM=target/wasm32v1-none/release
GOLD_PRICE_1E7=${GOLD_PRICE_1E7:-1672000000}   # USD 167.20 per gram

log() { printf "\n\033[1;35m▸ %s\033[0m\n" "$*"; }
key() { stellar keys address "$1"; }
ensure_key() { stellar keys address "$1" >/dev/null 2>&1 || stellar keys generate "$1" $NET --fund >/dev/null; stellar keys fund "$1" $NET >/dev/null 2>&1 || true; }
inv() { local id=$1 src=$2; shift 2; stellar contract invoke --id "$id" --source "$src" $NET -- "$@"; }
deploy() {
  local id; id=$(stellar contract deploy --wasm "$WASM/$1.wasm" --source admin $NET 2>/dev/null | tail -1)
  [[ "$id" =~ ^C[A-Z0-9]{55}$ ]] || { echo "Deploy of $1 failed" >&2; exit 1; }
  echo "$id"
}

log "Building contracts"
cargo build --target wasm32v1-none --release -q 2>/dev/null

log "Accounts"
ACCTS="admin demo-user usdc-issuer pool-projects pool-recovery pool-exploration pool-marketing pool-tax mine-owner-1 mine-owner-2 seed-investor"
for k in $ACCTS; do ensure_key $k; echo "  $k = $(key $k)"; done

log "Demo USDC (classic asset + Stellar Asset Contract)"
USDC_ASSET="USDC:$(key usdc-issuer)"
USDC_ID=$(stellar contract asset deploy --asset "$USDC_ASSET" --source admin $NET 2>/dev/null | tail -1 || true)
[[ "$USDC_ID" =~ ^C[A-Z0-9]{55}$ ]] || USDC_ID=$(stellar contract id asset --asset "$USDC_ASSET" $NET)
echo "  USDC SAC = $USDC_ID"
for k in $ACCTS; do
  [[ $k == usdc-issuer ]] && continue
  stellar tx new change-trust --source $k --line "$USDC_ASSET" $NET >/dev/null 2>&1 || true
done
pay() { stellar tx new payment --source usdc-issuer --destination "$(key $1)" --asset "$USDC_ASSET" --amount "$2" $NET >/dev/null; }
pay demo-user     1000000000000   # 100,000 USDC
pay seed-investor 8000000000000   # 800,000 USDC

log "Deploying contracts"
ORACLE=$(deploy oracle_mock);      echo "  oracle   $ORACLE"
TREASURY=$(deploy treasury);       echo "  treasury $TREASURY"
GBT=$(deploy gbt_token);           echo "  gbt      $GBT"
PGBT=$(deploy pgbt_token);         echo "  pgbt     $PGBT"
EPT=$(deploy ept_token);           echo "  ept      $EPT"
MINTER=$(deploy gbt_minter);       echo "  minter   $MINTER"
VAULTS=$(deploy project_vaults);   echo "  vaults   $VAULTS"

log "Initializing"
inv $ORACLE admin init --admin admin --initial_price_scaled_1e7 $GOLD_PRICE_1E7
POOLS=$(printf '{"projects":"%s","recovery":"%s","exploration":"%s","marketing":"%s","tax":"%s"}' "$(key pool-projects)" "$(key pool-recovery)" "$(key pool-exploration)" "$(key pool-marketing)" "$(key pool-tax)")
inv $TREASURY admin init --admin admin --pools "$POOLS"
inv $GBT admin initialize --admin $MINTER
inv $PGBT admin initialize --admin $VAULTS
inv $EPT admin initialize --admin $VAULTS
inv $MINTER admin init --admin admin --token_gbt $GBT --token_stable $USDC_ID --treasury $TREASURY --oracle $ORACLE --fee_bps 200 --fc_bps 8000
inv $VAULTS admin init --admin admin --oracle $ORACLE --token_gbt $GBT --token_pgbt $PGBT --token_ept $EPT --unstake_penalty_bps 500

log "Registering mines (grams x 1000)"
inv $MINTER admin upsert_mine --id 1 --owner mine-owner-1 --inferidos_gm 435400000 --indicados_gm 0 --medidos_gm 0 --probables_gm 0 --probadas_gm 0 --enabled true
inv $MINTER admin upsert_mine --id 2 --owner mine-owner-2 --inferidos_gm 0 --indicados_gm 120000000 --medidos_gm 40000000 --probables_gm 0 --probadas_gm 0 --enabled true

log "Creating projects"
LEDGER=$(curl -s -X POST https://soroban-testnet.stellar.org -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' | sed -E 's/.*"sequence":([0-9]+).*/\1/')
DEADLINE=$((LEDGER + 518400))   # ~30 days
mk() { inv $VAULTS admin create_project --admin admin --name "$1" --description "$2" --min_stake_unit_gm 5000 --loan_amount_usd_1e7 "$3" --funding_deadline $DEADLINE >/dev/null; }
mk "Rionegro Solar Farm" "Pilot solar farm: 6,000 panels, 2.4 MW on 2 hectares in the AL-1 area." 240000000000
mk "Amalfi Reforestation" "Native-species reforestation and watershed protection." 150000000000
mk "Girardota Water Treatment" "Community water treatment plant, 10,000 L/day." 100000000000
mk "Nechi Solar Farm" "Utility-scale solar farm proposal for the Nechi region." 400000000000
for id in 1 2 3; do inv $VAULTS admin approve_project --admin admin --project_id $id >/dev/null; done

log "Seeding activity (seed investor mints GBT and stakes)"
inv $MINTER seed-investor mint --payer seed-investor --amount_stable_1e7 700000000000 --max_id_inclusive 2 >/dev/null
inv $VAULTS seed-investor stake_gbt --user seed-investor --project_id 1 --units 34 >/dev/null
inv $VAULTS seed-investor stake_gbt --user seed-investor --project_id 2 --units 12 >/dev/null
inv $VAULTS seed-investor stake_gbt --user seed-investor --project_id 3 --units 24 >/dev/null
inv $VAULTS admin set_status --admin admin --project_id 3 --status '"InConstruction"' >/dev/null

log "Extending contract TTL (~29 days)"
for id in $ORACLE $TREASURY $GBT $PGBT $EPT $MINTER $VAULTS $USDC_ID; do
  stellar contract extend --id $id --ledgers-to-extend 500000 --durability persistent --source admin $NET >/dev/null 2>&1 || true
done
for w in oracle_mock treasury gbt_token pgbt_token ept_token gbt_minter project_vaults; do
  stellar contract extend --wasm $WASM/$w.wasm --ledgers-to-extend 500000 --durability persistent --source admin $NET >/dev/null 2>&1 || true
done

log "Writing frontend config"
FE=frontend/alternun-ui
cat > $FE/src/deployment.testnet.json <<JSON
{
  "network": "testnet",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "oracle": "$ORACLE",
    "treasury": "$TREASURY",
    "gbt": "$GBT",
    "pgbt": "$PGBT",
    "ept": "$EPT",
    "minter": "$MINTER",
    "vaults": "$VAULTS",
    "usdc": "$USDC_ID"
  },
  "accounts": {
    "admin": "$(key admin)",
    "usdcIssuer": "$(key usdc-issuer)",
    "poolProjects": "$(key pool-projects)",
    "poolRecovery": "$(key pool-recovery)",
    "poolExploration": "$(key pool-exploration)",
    "poolMarketing": "$(key pool-marketing)",
    "poolTax": "$(key pool-tax)",
    "mineOwner1": "$(key mine-owner-1)",
    "mineOwner2": "$(key mine-owner-2)",
    "seedInvestor": "$(key seed-investor)",
    "demoUser": "$(key demo-user)"
  }
}
JSON
cat > $FE/.env.local <<ENV
# Testnet-only demo keys. Never use on mainnet. Not committed (*.local is git-ignored).
VITE_DEMO_SECRET=$(stellar keys show demo-user)
VITE_ADMIN_SECRET=$(stellar keys show admin)
VITE_USDC_ISSUER_SECRET=$(stellar keys show usdc-issuer)
ENV
log "Done. Contracts written to $FE/src/deployment.testnet.json"
