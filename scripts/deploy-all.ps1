# Alternun POC - Complete Deployment Script
# This script deploys all contracts and configures them for the GBT minting flow

Write-Host "=== Alternun POC Deployment ===" -ForegroundColor Green
Write-Host "Starting deployment of all contracts..." -ForegroundColor Yellow

# Build all contracts
Write-Host "Building contracts..." -ForegroundColor Yellow
cd ../contracts

# Build each contract
foreach ($contract in @("oracle_mock", "treasury", "gbt_token", "gbt_minter")) {
    Write-Host "Building $contract..." -ForegroundColor Cyan
    cd $contract
    cargo build --target wasm32-unknown-unknown --release
    cd ..
}

# Deploy contracts (testnet)
Write-Host "Deploying contracts to Stellar testnet..." -ForegroundColor Yellow
cd ../scripts

# Deploy Oracle Mock (with initial gold price ~$65/gram = 650000000 scaled 1e7)
Write-Host "Deploying Oracle Mock..." -ForegroundColor Cyan
$ORACLE_ID = soroban contract deploy --wasm ../contracts/oracle_mock/target/wasm32-unknown-unknown/release/oracle_mock.wasm --network testnet --source default
Write-Host "Oracle deployed: $ORACLE_ID" -ForegroundColor Green

# Deploy Treasury
Write-Host "Deploying Treasury..." -ForegroundColor Cyan  
$TREASURY_ID = soroban contract deploy --wasm ../contracts/treasury/target/wasm32-unknown-unknown/release/treasury.wasm --network testnet --source default
Write-Host "Treasury deployed: $TREASURY_ID" -ForegroundColor Green

# Deploy GBT Token
Write-Host "Deploying GBT Token..." -ForegroundColor Cyan
$GBT_TOKEN_ID = soroban contract deploy --wasm ../contracts/gbt_token/target/wasm32-unknown-unknown/release/gbt_token.wasm --network testnet --source default  
Write-Host "GBT Token deployed: $GBT_TOKEN_ID" -ForegroundColor Green

# Deploy GBT Minter
Write-Host "Deploying GBT Minter..." -ForegroundColor Cyan
$MINTER_ID = soroban contract deploy --wasm ../contracts/gbt_minter/target/wasm32-unknown-unknown/release/gbt_minter.wasm --network testnet --source default
Write-Host "GBT Minter deployed: $MINTER_ID" -ForegroundColor Green

# Save deployed addresses
$addresses = @{
    "oracle" = $ORACLE_ID
    "treasury" = $TREASURY_ID  
    "gbt_token" = $GBT_TOKEN_ID
    "minter" = $MINTER_ID
}
$addresses | ConvertTo-Json | Set-Content "deployed-addresses.json"

Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Contract addresses saved to deployed-addresses.json" -ForegroundColor Yellow
Write-Host "Next: Run initialize-contracts.ps1 to configure them" -ForegroundColor Yellow
