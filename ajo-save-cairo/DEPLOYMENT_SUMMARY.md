# Ajo Save Cairo - Deployment Summary

## ✅ Completed Setup

1. **Build**: Project compiles successfully with no errors
2. **Tools Installed**:
   - sncast v0.56.0
   - starkli v0.4.2
3. **Account Configuration**:
   - Address: `0x0634f84Cd94953222B6E170E0ED7610AF8b191B1130Fa937AB5F4c476c01C539`
   - Network: Starknet Sepolia
   - Balance: 100 STRK (sufficient for deployment)
   - Status: Deployed on-chain
4. **RPC Endpoint**: Alchemy (working)

## ⚠️ Current Blocker

ArgentX account has a guardian enabled. The guardian removal transaction may still be pending confirmation.

**Check guardian status:**
```bash
curl -s "https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU" -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"starknet_call","params":[{"contract_address":"0x0634f84Cd94953222B6E170E0ED7610AF8b191B1130Fa937AB5F4c476c01C539","entry_point_selector":"0x2d4c8ea4c8fb9f571d1f6f9b7692fff8e5ceaf73b1df98e7da8c1109b39ae9a","calldata":[]},"latest"],"id":1}'
```

If the result is `0x0`, the guardian is removed and you can proceed.

## 🚀 Ready to Deploy

Once the guardian is removed, run:

```bash
cd ajo-save-cairo

# Using private key directly (fastest)
source ~/.starkli/env
export STARKNET_RPC="https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU"
export STARKNET_ACCOUNT="$HOME/.starkli-wallets/deployer/account.json"

# Declare all contracts
starkli declare target/dev/ajo_save_AjoCore.contract_class.json --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 --watch
starkli declare target/dev/ajo_save_AjoMembers.contract_class.json --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 --watch
starkli declare target/dev/ajo_save_AjoPayments.contract_class.json --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 --watch
starkli declare target/dev/ajo_save_AjoSchedule.contract_class.json --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 --watch
starkli declare target/dev/ajo_save_AjoCollateral.contract_class.json --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 --watch
starkli declare target/dev/ajo_save_AjoGovernance.contract_class.json --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 --watch
starkli declare target/dev/ajo_save_AjoFactory.contract_class.json --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 --watch

# Then deploy factory with the class hashes
```

## 📁 Deployment Scripts Available

- `scripts/deploy_interactive.sh` - Interactive with password prompts
- `scripts/deploy_with_sncast.sh` - Using sncast
- `MANUAL_DEPLOYMENT_GUIDE.md` - Deploy via Starkscan UI

## 🎯 What Gets Deployed

1. **7 Contract Declarations** (class hashes saved on-chain):
   - AjoCore - Core Ajo logic
   - AjoMembers - Member management
   - AjoPayments - Payment processing
   - AjoSchedule - Scheduling and cycles
   - AjoCollateral - Collateral management
   - AjoGovernance - Governance and voting
   - AjoFactory - Factory for deploying Ajo instances

2. **1 Factory Deployment**:
   - Takes all 7 class hashes as constructor arguments
   - Owned by your address
   - Can deploy unlimited Ajo instances

## 📊 Estimated Costs

- Each declaration: ~0.5-2 STRK
- Factory deployment: ~2-5 STRK
- Total: ~8-20 STRK (you have 100 STRK)

## 🔗 Useful Links

- Starkscan: https://sepolia.starkscan.co/contract/0x0634f84Cd94953222B6E170E0ED7610AF8b191B1130Fa937AB5F4c476c01C539
- Voyager: https://sepolia.voyager.online/contract/0x0634f84Cd94953222B6E170E0ED7610AF8b191B1130Fa937AB5F4c476c01C539
- Faucet: https://starknet-faucet.vercel.app/

## ⏭️ Next Steps After Deployment

1. Save the factory address
2. Update your frontend/scripts
3. Test creating an Ajo instance
4. Verify contracts on Starkscan
5. Re-enable guardian if desired
