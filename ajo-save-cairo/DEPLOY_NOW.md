# Deploy Now - Quick Start

## Setup (One-time)

1. **Set your keystore password in .env file:**

```bash
# Edit the .env file in the project root
nano ../.env

# Replace 'your_password_here' with your actual keystore password
# (the password you used when creating ~/.starkli/keystore.json)
```

Or use this command:
```bash
echo 'KEYSTORE_PASSWORD=YOUR_ACTUAL_PASSWORD' > ../.env
```

## Deploy

Once the password is set, run:

```bash
./scripts/deploy_with_starkli.sh
```

The script will:
1. ✅ Check your STRK balance (you have 100 STRK)
2. ✅ Declare all 7 contracts (~5-10 minutes)
3. ✅ Deploy AjoFactory (~2-3 minutes)
4. ✅ Save deployment info to `deployment_info.json`

## What You'll See

```
╔════════════════════════════════════════════════════════════╗
║         Ajo Save Cairo - Starkli Deployment               ║
║                  Starknet Sepolia Testnet                 ║
╚════════════════════════════════════════════════════════════╝

📋 Deployment Account:
   Address: 0x634f84cd94953222b6e170e0ed7610af8b191b1130fa937ab5f4c476c01c539

🔍 Testing RPC connection...
   ✅ Connected! Current block: 6869300

💰 Checking STRK balance...
   Balance: 100 STRK (sufficient for deployment)

═══════════════════════════════════════════════════════════
STEP 1: Declaring Contracts
═══════════════════════════════════════════════════════════

📝 Declaring AjoCore...
   ✅ Declared successfully
   Class Hash: 0x...

📝 Declaring AjoMembers...
   ✅ Declared successfully
   Class Hash: 0x...

... (continues for all contracts)

═══════════════════════════════════════════════════════════
STEP 2: Deploying AjoFactory
═══════════════════════════════════════════════════════════

🔨 Deploying factory contract...
   ✅ Factory deployed successfully!

╔════════════════════════════════════════════════════════════╗
║                  Deployment Successful! 🎉                 ║
╚════════════════════════════════════════════════════════════╝

📍 Factory Address: 0x...
🔗 View on Starkscan: https://sepolia.starkscan.co/contract/0x...
```

## After Deployment

Check the generated files:
- `declared_class_hashes.json` - All contract class hashes
- `deployment_info.json` - Complete deployment information

Verify on Starkscan:
- https://sepolia.starkscan.co/

## Troubleshooting

### "KEYSTORE_PASSWORD not set"
- Make sure you edited the .env file
- Check the password is correct (no quotes needed in .env)

### "Insufficient balance"
- You have 100 STRK which should be enough
- If needed, get more from: https://starknet-faucet.vercel.app/

### Declaration fails
- Check your internet connection
- Verify RPC endpoint is working
- Try running the script again (already declared contracts will be skipped)
