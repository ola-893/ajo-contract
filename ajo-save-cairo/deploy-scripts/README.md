# Starknet Deployment Scripts

This directory contains deployment and verification scripts for the AJO Cairo contracts.

## Scripts

- `npm run deploy:sepolia`
  - Declares all contract classes (Factory, modules, adapters)
  - Writes `../declared_class_hashes.json`
  - Deploys `AjoFactory` + adapter contracts
  - Sets Factory class hashes (and optional token addresses)
  - Writes `../deployment_info.json`
  - Exports ABIs to `../deployment_artifacts/abis/`

- `npm run verify:deployment`
  - Loads `../deployment_info.json` + `../declared_class_hashes.json`
  - Verifies class hashes exist on-chain
  - Verifies deployed contracts are accessible
  - Runs a smoke flow on Factory (`create_ajo_and_initialize`)
  - Writes `../verification_report.json`

- `npm run smoke:deployed`
  - Runs BTC-mode smoke test against deployed contracts from `../deployment_info.json`
  - Creates BTC Ajo with atomic factory initialization
  - Uses test member accounts (`TEST_ACCOUNT_i_*` or `SMOKE_MEMBER_i_*`) for:
    - token approvals (collateral/payments)
    - `join_ajo(1)`
    - auto-start on full membership + cycle payment round
  - Verifies cycle advancement and writes `../smoke_test_report.json`

- `npm run btc:full-flow`
  - Runs full BTC-track demo flow against deployed contracts from `../deployment_info.json`
  - Creates a fresh BTC Ajo with atomic factory initialization
  - Wires adapters and enables:
    - bridge
    - atomic swap
    - BTC commitment collateral mode
  - Executes optional demos when balance permits:
    - bridge withdrawal request + finalize
    - swap execution
    - join flow with BTC commitment creation
  - Writes `../btc_track_report.json`

- `npm run declare-deploy`
  - Legacy single-contract script for `AjoFactory` only

## Required Environment Variables

- `STARKNET_RPC`
- `STARKNET_ACCOUNT_ADDRESS`
- `STARKNET_PRIVATE_KEY`

## Optional Environment Variables

- `STARKNET_NETWORK` (default: `sepolia`)
- `OWNER_ADDRESS` (default: deployer account)
- `BRIDGE_RELAYER_ADDRESS` (default: owner)
- `OP_CAT_VERIFIER_ADDRESS` (default: owner)
- `USDC_TOKEN_ADDRESS` (optional Factory token registry override)
- `BTC_TOKEN_ADDRESS` (optional Factory token registry override)

Verification script options:

- `VERIFY_PAYMENT_TOKEN` (`USDC` or `BTC`, default: `USDC`)
- `VERIFY_MONTHLY_CONTRIBUTION` (default: `1000`)
- `VERIFY_TOTAL_PARTICIPANTS` (default: `3`)
- `VERIFY_CYCLE_DURATION` (default: `60`)

Deployed smoke-test options:

- `SMOKE_TOTAL_PARTICIPANTS` (default: `3`, must be `>= 3`)
- `SMOKE_MONTHLY_CONTRIBUTION` (default: `1000`)
- `SMOKE_CYCLE_DURATION` (default: `86400`)
- `SMOKE_BTC_TOKEN_ADDRESS` (optional; if set, updates Factory BTC token before smoke run)
- Member keys: `TEST_ACCOUNT_1_ADDRESS`/`TEST_ACCOUNT_1_PRIVATE_KEY` ...
  or `SMOKE_MEMBER_1_ADDRESS`/`SMOKE_MEMBER_1_PRIVATE_KEY` ...

BTC full-flow options:

- `FLOW_MONTHLY_CONTRIBUTION` (default: `1000`)
- `FLOW_TOTAL_PARTICIPANTS` (default: `3`, must be `>= 3`)
- `FLOW_CYCLE_DURATION` (default: `86400`, must be `>= 86400`)
- `FLOW_BRIDGE_AMOUNT` (default: `1`)
- `FLOW_SWAP_AMOUNT` (default: `1`)
- `FLOW_DEMO_BTC_ADDRESS` (default demo felt payload)
- `FLOW_DEMO_BTC_TX_HASH` (default demo felt payload)

## Typical Flow

```bash
cd ajo-save-cairo
scarb build
cd deploy-scripts
npm install
npm run deploy:sepolia
npm run verify:deployment
npm run smoke:deployed
npm run btc:full-flow
```
