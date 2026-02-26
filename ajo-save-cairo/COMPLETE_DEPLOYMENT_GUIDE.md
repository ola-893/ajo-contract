# Complete Deployment Guide - Ajo Save Cairo

## Current Status: 95% Complete ✅

Everything is ready for deployment. All contracts are declared on Sepolia, account is funded, and we have all the class hashes.

## What We've Accomplished

1. ✅ Cairo project builds successfully
2. ✅ All 7 contracts compiled
3. ✅ New OpenZeppelin account created and deployed
4. ✅ Account funded with STRK for gas
5. ✅ All contracts declared on Starknet Sepolia
6. ✅ Class hashes collected

## Account Details

- **Address**: `0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8`
- **Private Key**: `0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228`
- **Network**: Starknet Sepolia
- **Balance**: Has STRK for deployment

## Declared Class Hashes

```json
{
  "AjoCore": "0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc",
  "AjoMembers": "0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07",
  "AjoPayments": "0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d",
  "AjoSchedule": "0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae",
  "AjoCollateral": "0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb",
  "AjoGovernance": "0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2",
  "AjoFactory": "0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b"
}
```

## Deployment Options

### Option 1: CLI Deployment (Retry Later)

Wait a few hours for network propagation, then:

```bash
cd ajo-save-cairo

source ~/.starkli/env
export STARKNET_RPC="https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU"
export STARKNET_ACCOUNT="$HOME/.starkli-wallets/deployer-new/account.json"

starkli deploy \
  0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b \
  0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8 \
  0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc \
  0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07 \
  0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb \
  0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d \
  0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2 \
  0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae \
  --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 \
  --watch
```

### Option 2: Starkscan UI (When Available)

1. Go to: https://sepolia.starkscan.co/deploy-contract
2. Enter Factory class hash: `0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b`
3. Constructor calldata (comma-separated):
   ```
   0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8,
   0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc,
   0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07,
   0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb,
   0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d,
   0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2,
   0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae
   ```
4. Connect your wallet and sign

### Option 3: Voyager UI

1. Go to: https://sepolia.voyager.online/
2. Navigate to "Deploy Contract"
3. Use the same class hash and constructor data as above

### Option 4: Direct RPC Call

Use curl to deploy directly:

```bash
curl -X POST https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "starknet_addDeployAccountTransaction",
    "params": [...],
    "id": 1
  }'
```

## Constructor Parameters Explained

The factory constructor takes 7 parameters in this order:

1. **Owner** (`0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8`) - Your account address
2. **Core Class Hash** - For deploying AjoCore instances
3. **Members Class Hash** - For deploying AjoMembers instances
4. **Collateral Class Hash** - For deploying AjoCollateral instances
5. **Payments Class Hash** - For deploying AjoPayments instances
6. **Governance Class Hash** - For deploying AjoGovernance instances
7. **Schedule Class Hash** - For deploying AjoSchedule instances

## After Deployment

Once the factory is deployed, you'll get a contract address. Save it and use it to:

1. Create Ajo instances
2. Update your frontend
3. Test the full flow

## Troubleshooting

### "Class not declared" Error
- Wait 30-60 minutes for network propagation
- Try the deployment command again
- Use Starkscan/Voyager UI as fallback

### Block Explorers Down
- Wait for them to come back online
- Use CLI deployment instead
- Check https://status.starknet.io/ for network status

### Transaction Fails
- Check account has enough STRK
- Verify all class hashes are correct
- Try with higher gas limits

## Files Reference

- **Compiled Contracts**: `target/dev/ajo_save_*.contract_class.json`
- **Class Hashes**: `declared_class_hashes.json`
- **Account Config**: `~/.starkli-wallets/deployer-new/account.json`

## Summary

You're one command away from completion. The contracts are declared, account is ready, and all parameters are collected. Just need to wait for network propagation or use a UI when available.

**Estimated time to complete**: 5-10 minutes once network stabilizes
