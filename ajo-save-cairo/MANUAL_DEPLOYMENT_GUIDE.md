# Manual Deployment Guide - Deploy from ArgentX Wallet

Your ArgentX account has a guardian enabled, which prevents CLI tools from signing transactions. You'll need to deploy using your ArgentX wallet directly.

## Option 1: Use Starkscan Contract Interaction (Easiest)

### Step 1: Declare Contracts

Go to Starkscan's declare page and upload each contract class file:
- https://sepolia.starkscan.co/declare-contract

Upload these files one by one from `target/dev/`:
1. `ajo_save_AjoCore.contract_class.json`
2. `ajo_save_AjoMembers.contract_class.json`
3. `ajo_save_AjoPayments.contract_class.json`
4. `ajo_save_AjoSchedule.contract_class.json`
5. `ajo_save_AjoCollateral.contract_class.json`
6. `ajo_save_AjoGovernance.contract_class.json`
7. `ajo_save_AjoFactory.contract_class.json`

Save each class hash that's returned.

### Step 2: Deploy Factory

Once all contracts are declared, deploy the factory:

1. Go to: https://sepolia.starkscan.co/deploy-contract
2. Enter the Factory class hash
3. Enter constructor calldata:
   - Owner address: `0x0634f84Cd94953222B6E170E0ED7610AF8b191B1130Fa937AB5F4c476c01C539`
   - Core class hash: (from step 1)
   - Members class hash: (from step 1)
   - Collateral class hash: (from step 1)
   - Payments class hash: (from step 1)
   - Governance class hash: (from step 1)
   - Schedule class hash: (from step 1)

## Option 2: Remove Guardian from ArgentX

If you want to use CLI tools:

1. Open ArgentX wallet
2. Go to Settings → Security
3. Remove the guardian
4. Wait for the transaction to confirm
5. Run: `./scripts/deploy_interactive.sh`

## Option 3: Use Voyager

Similar to Starkscan, Voyager also has contract deployment tools:
- https://sepolia.voyager.online/

## Contract Files Location

All compiled contracts are in: `ajo-save-cairo/target/dev/`

Files to declare:
- `ajo_save_AjoCore.contract_class.json`
- `ajo_save_AjoMembers.contract_class.json`
- `ajo_save_AjoPayments.contract_class.json`
- `ajo_save_AjoSchedule.contract_class.json`
- `ajo_save_AjoCollateral.contract_class.json`
- `ajo_save_AjoGovernance.contract_class.json`
- `ajo_save_AjoFactory.contract_class.json`

## After Deployment

Save your factory address and update your frontend/scripts with it!
