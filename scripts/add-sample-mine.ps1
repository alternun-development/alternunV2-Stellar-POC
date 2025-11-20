# Alternun POC - Add Sample Mine Script
# This script adds a simulated mine based on Nechi, Antioquia data

Write-Host "=== Adding Sample Mine to POC ===" -ForegroundColor Green

# Load deployed addresses
if (!(Test-Path "deployed-addresses.json")) {
    Write-Host "ERROR: deployed-addresses.json not found. Run deploy-all.ps1 first." -ForegroundColor Red
    exit 1
}

$addresses = Get-Content "deployed-addresses.json" | ConvertFrom-Json
$MINTER_ID = $addresses.minter

# Sample mine data (Nechi-inspired, simulated NI 43-101 report)
# All values in grams * 1000 for precision
$MINE_ID = 1
$MINE_NAME = "Nechi Digital Mine (Simulated)"
$INFERIDOS_GM = 500000000   # 500,000 grams * 1000 = 500M total inferred
$INDICADOS_GM = 1200000000  # 1,200,000 grams * 1000 = 1.2B total indicated  
$MEDIDOS_GM = 800000000     # 800,000 grams * 1000 = 800M total measured
$PROBABLES_GM = 600000000   # 600,000 grams * 1000 = 600M total probable reserves
$PROBADAS_GM = 400000000    # 400,000 grams * 1000 = 400M total proven reserves

Write-Host "Adding mine: $MINE_NAME" -ForegroundColor Yellow
Write-Host "Mine ID: $MINE_ID" -ForegroundColor Yellow
Write-Host "Total Resources: $(($INFERIDOS_GM + $INDICADOS_GM + $MEDIDOS_GM + $PROBABLES_GM + $PROBADAS_GM) / 1000) grams" -ForegroundColor Yellow

# Add mine to minter contract
Write-Host "Registering mine in GBT Minter contract..." -ForegroundColor Cyan
soroban contract invoke --id $MINTER_ID --source default --network testnet -- upsert_mine --id $MINE_ID --inferidos_gm $INFERIDOS_GM --indicados_gm $INDICADOS_GM --medidos_gm $MEDIDOS_GM --probables_gm $PROBABLES_GM --probadas_gm $PROBADAS_GM --enabled true

# Check mine capacity
Write-Host "Checking mine capacity..." -ForegroundColor Cyan
$CAPACITY = soroban contract invoke --id $MINTER_ID --source default --network testnet -- mine_capacity_gm --id $MINE_ID
Write-Host "Mine capacity: $(([int64]$CAPACITY) / 1000) grams GBT minteable" -ForegroundColor Green

$TOTAL_CAPACITY = soroban contract invoke --id $MINTER_ID --source default --network testnet -- total_capacity_gm --max_id_inclusive $MINE_ID
Write-Host "Total system capacity: $(([int64]$TOTAL_CAPACITY) / 1000) grams GBT minteable" -ForegroundColor Green

Write-Host "=== Sample Mine Added Successfully ===" -ForegroundColor Green
Write-Host "You can now test GBT minting!" -ForegroundColor Yellow
Write-Host "Next: Run test-mint.ps1 to test the complete minting flow" -ForegroundColor Yellow
