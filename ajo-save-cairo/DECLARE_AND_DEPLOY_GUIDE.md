# AjoFactory Declaration and Deployment Guide

## Current Status
- Class Hash: `0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b`
- Status: **NOT DECLARED** on Sepolia network (verified via RPC call)
- Issue: CASM hash mismatch between local compiler (Cairo 2.16.0) and network expectations

## Problem Analysis
The contract was compiled with Cairo 2.16.0, but the network expects a different CASM compilation result:
- Local CASM: `0x03e1272ff102a11081044edf246be9bc5060e00819ffb32e60b315626c5fe3a0`
- Expected CASM: `0x30fcc77c73d3c8523bc0c56e972968cd001d99934847b36c506aef17ea97e2`

## Solution Path

### Option 1: Use Voyager UI (RECOMMENDED - Most Reliable)

1. **Prepare the Contract Class File**
   - File location: `ajo-save-cairo/target/dev/ajo_save_AjoFactory.contract_class.json`
   - This is the Sierra class file needed for declaration

2. **Go to Voyager Declare Page**
   - URL: https://sepolia.voyager.online/declare-contract
   - Connect your ArgentX wallet (ensure it's on Sepolia testnet)

3. **Upload and Declare**
   - Upload the contract class JSON file
   - Review the transaction details
   - Sign with ArgentX
   - Wait for confirmation

4. **After Declaration, Deploy via Voyager**
   - URL: https://sepolia.voyager.online/deploy-contract
   - Enter class hash: `0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b`
   - Enter constructor arguments (in order):

   ```
   owner: 0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8
   core_class_hash: 0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc
   members_class_hash: 0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07
   collateral_class_hash: 0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb
   payments_class_hash: 0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d
   governance_class_hash: 0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2
   schedule_class_hash: 0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae
   ```

5. **Sign and Deploy**
   - Review transaction
   - Sign with ArgentX
   - Wait for deployment confirmation
   - Copy the deployed contract address

### Option 2: Use Starkscan UI (Alternative)

1. **Declare Contract**
   - URL: https://sepolia.starkscan.co/declare-contract
   - Upload: `ajo-save-cairo/target/dev/ajo_save_AjoFactory.contract_class.json`
   - Connect ArgentX and sign

2. **Deploy Contract**
   - URL: https://sepolia.starkscan.co/deploy-contract
   - Follow same constructor arguments as Option 1

### Option 3: Rebuild with Compatible Cairo Version

If you prefer CLI deployment, you need to rebuild with a Cairo version that matches the network:

1. **Check Network's Expected Cairo Version**
   ```bash
   curl -s https://alpha-sepolia.starknet.io/feeder_gateway/get_state_update?blockNumber=latest | jq '.state_diff.declared_classes[0]'
   ```

2. **Install Compatible Scarb Version**
   - Check https://docs.swmansion.com/scarb/download.html
   - Install the version that includes the matching Cairo compiler

3. **Rebuild and Declare**
   ```bash
   cd ajo-save-cairo
   scarb build
   starkli declare target/dev/ajo_save_AjoFactory.contract_class.json \
     --private-key 0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228 \
     --watch
   ```

### Option 4: Use starknet.js Script (Advanced)

A Node.js script has been prepared in `deploy-scripts/` directory. This approach:
- Gives full control over the declaration and deployment process
- Can handle CASM compilation issues more gracefully
- Provides detailed error messages

To use:
```bash
cd deploy-scripts
node declare_and_deploy_factory.js
```

## Recommended Next Steps

1. **Use Voyager UI (Option 1)** - This is the most reliable method and bypasses all CLI/compiler issues
2. After successful declaration, verify with:
   ```bash
   curl -s -X POST https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU \
     -H "Content-Type: application/json" \
     -d '{
       "jsonrpc": "2.0",
       "method": "starknet_getClass",
       "params": {
         "block_id": "latest",
         "class_hash": "0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b"
       },
       "id": 1
     }' | python3 -m json.tool
   ```
3. Once declared, proceed with deployment using the same UI or CLI

## Constructor Arguments Reference

| Parameter | Value | Description |
|-----------|-------|-------------|
| owner | `0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8` | Factory owner address |
| core_class_hash | `0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc` | AjoCore class hash |
| members_class_hash | `0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07` | AjoMembers class hash |
| collateral_class_hash | `0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb` | AjoCollateral class hash |
| payments_class_hash | `0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d` | AjoPayments class hash |
| governance_class_hash | `0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2` | AjoGovernance class hash |
| schedule_class_hash | `0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae` | AjoSchedule class hash |

## Troubleshooting

### If Voyager shows "Invalid class hash"
- The contract needs to be declared first before deployment
- Use the declare page first, then the deploy page

### If ArgentX shows "Insufficient balance"
- Ensure your wallet has enough STRK tokens for gas fees
- Get testnet tokens from: https://starknet-faucet.vercel.app/

### If deployment fails with "Class hash not found"
- The declaration transaction may still be pending
- Wait a few minutes and try again
- Verify declaration status on Voyager/Starkscan
