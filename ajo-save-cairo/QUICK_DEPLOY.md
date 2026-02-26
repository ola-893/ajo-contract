# Quick Deployment Guide

## Prerequisites Completed ✅

- ✅ Cairo project builds successfully
- ✅ sncast v0.56.0 installed
- ✅ starkli v0.4.2 installed  
- ✅ Deployer account configured

## Before You Deploy

### 1. Get a Reliable RPC Endpoint

Public RPCs are unstable. Get a free API key:

**Option A: Alchemy (Recommended)**
1. Go to https://www.alchemy.com/
2. Sign up and create a new app
3. Select "Starknet" and "Sepolia Testnet"
4. Copy your API key

**Option B: Infura**
1. Go to https://www.infura.io/
2. Sign up and create a new project
3. Select "Starknet"
4. Copy your API key

### 2. Update snfoundry.toml

```toml
[sncast.deployer]
account = "deployer"
accounts-file = "/Users/ola/.starknet_accounts/starknet_open_zeppelin_accounts.json"
url = "https://starknet-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
```

### 3. Fund Your Account

Get testnet ETH:
1. Visit: https://starknet-faucet.vercel.app/
2. Enter: `0x634f84cd94953222b6e170e0ed7610af8b191b1130fa937ab5f4c476c01c539`
3. Request testnet ETH

## Deploy Everything (One Command)

```bash
cd ajo-save-cairo
./scripts/full_deployment.sh
```

This script will:
1. ✅ Declare all 7 contracts
2. ✅ Save class hashes to `declared_class_hashes.json`
3. ✅ Deploy AjoFactory with all class hashes
4. ✅ Save deployment info to `deployment_info.json`

## Manual Deployment (Step by Step)

If you prefer manual control:

### Step 1: Declare Contracts
```bash
./scripts/declare_all.sh
```

### Step 2: Deploy Factory
```bash
./scripts/deploy_factory.sh
```

## Verify Deployment

After deployment, check:
- Starkscan: https://sepolia.starkscan.co/
- Voyager: https://sepolia.voyager.online/

Search for your factory address.

## Test the Deployment

Create a test Ajo instance:

```bash
sncast --profile deployer invoke \
  --contract-address <FACTORY_ADDRESS> \
  --function create_ajo \
  --calldata <AJO_CONFIG_PARAMS>
```

## Troubleshooting

### "Account not found on network"
- Your account needs to be deployed first
- Make sure you have testnet ETH
- Run: `sncast account deploy --name deployer --network sepolia`

### "RPC connection failed"
- Update snfoundry.toml with Alchemy/Infura RPC
- Check your API key is correct
- Verify your internet connection

### "Insufficient balance"
- Get more testnet ETH from the faucet
- Wait a few minutes for the transaction to confirm

### "Class already declared"
- This is normal! The script will use the existing class hash
- Continue with deployment

## Files Generated

After successful deployment:

- `declared_class_hashes.json` - All contract class hashes
- `deployment_info.json` - Factory address and deployment details

## Next Steps

1. ✅ Verify contract on Starkscan
2. ✅ Test creating an Ajo instance
3. ✅ Update frontend with factory address
4. ✅ Document the deployment for your team

## Need Help?

Check the full guide: `DEPLOYMENT.md`
