# Alternun POC - GBT Minting Flow

## Overview

This is a Proof of Concept (POC) implementation of Alternun's core GBT (Gold-Backed Token) minting functionality on the Stellar blockchain using Soroban smart contracts.

## Architecture

The POC implements the complete GBT minting flow:

1. **Mine Registration**: Admin registers mines with NI 43-101 simulated data
2. **Capacity Calculation**: System calculates mintable GBT based on gold resources  
3. **Price Oracle**: Mock oracle provides current gold prices
4. **Automatic Distribution**: Funds automatically split 50% projects, 30% recovery, 20% alternun
5. **GBT Minting**: Users receive GBT tokens backed by underground gold reserves

## Smart Contracts

- **`oracle_mock`**: Simulates gold price oracle (~$65/gram)
- **`treasury`**: Handles automatic fund distribution (50/30/20 split)
- **`gbt_token`**: ERC20-compatible token representing gold-backed tokens
- **`gbt_minter`**: Core contract orchestrating the complete minting flow

## Project Structure

alternun-poc-clean/
+-- contracts/          # Soroban smart contracts
¦   +-- oracle_mock/    # Gold price oracle simulation
¦   +-- treasury/       # Fund distribution (50/30/20)
¦   +-- gbt_token/      # GBT token implementation
¦   +-- gbt_minter/     # Main minting logic
+-- scripts/            # Deployment and testing scripts
+-- frontend/           # React frontend (TBD)
+-- docs/               # Documentation

## Quick Start

### Prerequisites

1. Install [Stellar CLI](https://soroban.stellar.org/docs/getting-started/setup#install-the-stellar-cli)
2. Configure testnet identity: `soroban config identity generate default`
3. Fund testnet account: `soroban config identity fund default --network testnet`

### Deployment

Run the deployment scripts in order:
```powershell
# 1. Deploy all contracts
./scripts/deploy-all.ps1

# 2. Initialize contracts with configuration
./scripts/initialize-contracts.ps1

# 3. Add a sample mine (Nechí simulation)
./scripts/add-sample-mine.ps1

# 4. Test the complete minting flow
./scripts/test-mint.ps1

Sample Mine Data
The POC includes a simulated mine based on Nechí, Antioquia with the following resources:

Inferred: 500,000 grams (15% collateral weight)
Indicated: 1,200,000 grams (30% collateral weight)
Measured: 800,000 grams (60% collateral weight)
Probable Reserves: 600,000 grams (50% collateral weight)
Proven Reserves: 400,000 grams (70% collateral weight)

This generates significant GBT minting capacity for testing.
Key Features Demonstrated
? Mine registration with NI 43-101 simulated data
? Dynamic supply calculation based on resource certainty
? Gold price oracle integration
? Automatic fee collection (2% default)
? Treasury distribution (50% projects, 30% recovery, 20% alternun)
? Capacity management (prevents over-minting)
? Admin controls (pause, fee adjustment, mine management)
Testing
The POC demonstrates the complete user flow:

Admin registers mine with gold resource data
System calculates available GBT minting capacity
User deposits USDC and receives GBT based on current gold price
Funds automatically distribute to stakeholders
GBT tokens represent claim on underground gold reserves

Next Steps

Frontend Development: Build React interface for mine registration and minting
Real Integration: Connect to actual gold price feeds
Multi-mine Support: Test with multiple mines from different regions
Governance: Implement DAO voting for mine approval
Project Vaults: Add project funding and equity token features

Technical Notes

Precision: All calculations use fixed-point arithmetic with appropriate scaling
Security: Admin functions require proper authorization
Modularity: Contracts are loosely coupled for easy upgrades
Testing: Comprehensive testing scripts included
Documentation: All functions documented with clear purpose

Grant Application Ready
This POC demonstrates:

Technical feasibility of tokenizing underground gold reserves
Automated distribution ensuring stakeholder alignment
Scalable architecture supporting multiple mines
Real-world impact through regenerative project funding
Innovation in RWA tokenization on Stellar

Ready for Stellar grants and investor demonstrations.
Contact
For questions about this POC implementation, refer to the Alternun technical documentation or contact the development team, or info@alternun.io
