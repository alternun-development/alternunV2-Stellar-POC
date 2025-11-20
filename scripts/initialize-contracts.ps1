# Alternun POC - Contract Initialization Script
# This script initializes all deployed contracts with proper configuration

Write-Host "=== Alternun POC Initialization ===" -ForegroundColor Green

# Load deployed addresses
if (!(Test-Path "deployed-addresses.json")) {
    Write-Host "ERROR: deployed-addresses.json not found. Run deploy-all.ps1 first." -ForegroundColor Red
    exit 1
}

$addresses = Get-Content "deployed-addresses.json" | ConvertFrom-Json
$ORACLE_ID = $addresses.oracle
$TREASURY_ID = $addresses.treasury  
$GBT_TOKEN_ID = $addresses.gbt_token
$MINTER_ID = $addresses.minter

# Get admin address (default account)
$ADMIN = soroban config identity address default

# Mock addresses for POC (replace with real addresses in production)
$PROJECTS_ADDR = $ADMIN  # For now, admin receives projects funds
$RECOVERY_ADDR = $ADMIN  # For now, admin receives recovery funds  
$ALTERNUN_ADDR = $ADMIN  # For now, admin receives alternun funds
$STABLE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4YX"  # USDC on testnet

Write-Host "Using admin address: $ADMIN" -ForegroundColor Yellow
Write-Host "Using stable token (USDC): $STABLE_TOKEN" -ForegroundColor Yellow

# 1. Initialize Oracle Mock with gold price (~$65/gram = 650000000 scaled 1e7)
Write-Host "Initializing Oracle Mock..." -ForegroundColor Cyan
soroban contract invoke --id $ORACLE_ID --source default --network testnet -- init --admin $ADMIN --initial_price_scaled_1e7 650000000

# 2. Initialize Treasury with distribution addresses
Write-Host "Initializing Treasury..." -ForegroundColor Cyan  
soroban contract invoke --id $TREASURY_ID --source default --network testnet -- init --admin $ADMIN --addr_p $PROJECTS_ADDR --addr_r $RECOVERY_ADDR --addr_a $ALTERNUN_ADDR

# 3. Initialize GBT Token with minter as admin (so minter can mint)
Write-Host "Initializing GBT Token..." -ForegroundColor Cyan
soroban contract invoke --id $GBT_TOKEN_ID --source default --network testnet -- initialize --admin $MINTER_ID

# 4. Initialize GBT Minter with all contract addresses
Write-Host "Initializing GBT Minter..." -ForegroundColor Cyan
soroban contract invoke --id $MINTER_ID --source default --network testnet -- init --admin $ADMIN --token_gbt $GBT_TOKEN_ID --token_stable $STABLE_TOKEN --treasury $TREASURY_ID --oracle $ORACLE_ID --fee_bps 200 --fc_bps 8000

Write-Host "=== Initialization Complete ===" -ForegroundColor Green
Write-Host "All contracts are configured and ready to use!" -ForegroundColor Yellow
Write-Host "Next: Run add-sample-mine.ps1 to add a test mine" -ForegroundColor Yellow
