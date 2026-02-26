# AjoFactory Deployment - Action Plan

## Current Situation

✅ **Verified**: AjoFactory class is NOT declared on Starknet Sepolia
- Class Hash: `0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b`
- Status: Class hash not found on network (confirmed via RPC call)

❌ **Problem**: CASM hash mismatch when trying to declare via CLI
- Local Cairo version: 2.16.0
- Local CASM hash: `0x03e1272ff102a11081044edf246be9bc5060e00819ffb32e60b315626c5fe3a0`
- Network expected CASM: `0x30fcc77c73d3c8523bc0c56e972968cd001d99934847b36c506aef17ea97e2`
- Root cause: Compiler version mismatch between local and sequencer

## Recommended Solution: Use Voyager UI

This is the most reliable approach and bypasses all compiler/CLI issues.

### Step 1: Declare the Contract

1. Open: https://sepolia.voyager.online/declare-contract
2. Connect your ArgentX wallet (ensure it's on Sepolia testnet)
3. Upload file: `ajo-save-cairo/target/dev/ajo_save_AjoFactory.contract_class.json`
4. Review and sign the transaction
5. Wait for confirmation (usually 1-2 minutes)

### Step 2: Verify Declaration

After declaration is confirmed, verify with:

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

You should see `"type": "SIERRA"` in the response.

### Step 3: Deploy the Contract

1. Open: https://sepolia.voyager.online/deploy-contract
2. Enter class hash: `0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b`
3. Enter constructor arguments (copy-paste each value):

```
0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8
0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc
0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07
0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb
0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d
0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2
0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae
```

4. Review and sign the transaction
5. Wait for deployment confirmation
6. Copy the deployed contract address

### Step 4: Update Documentation

Once deployed, update `FINAL_DEPLOYMENT_STATUS.md` with:
- Factory contract address
- Deployment transaction hash
- Timestamp
- Links to Voyager/Starkscan

## Alternative Solutions

### Option 2: Use starknet.js Script

If you prefer automation:

```bash
cd deploy-scripts
npm run declare-deploy
```

This will attempt to declare and deploy using Node.js. If it fails, fall back to Voyager UI.

### Option 3: Use Starkscan UI

Similar to Voyager but different interface:
- Declare: https://sepolia.starkscan.co/declare-contract
- Deploy: https://sepolia.starkscan.co/deploy-contract

### Option 4: Rebuild with Compatible Cairo Version

This is more complex and time-consuming:
1. Identify the exact Cairo version the network expects
2. Install compatible Scarb version
3. Rebuild all contracts
4. Declare and deploy via CLI

Not recommended unless you have specific requirements for CLI deployment.

## Pre-Deployment Checklist

- [ ] ArgentX wallet installed and configured
- [ ] Wallet connected to Sepolia testnet
- [ ] Wallet has sufficient STRK tokens for gas (get from https://starknet-faucet.vercel.app/)
- [ ] Contract class file exists: `ajo-save-cairo/target/dev/ajo_save_AjoFactory.contract_class.json`
- [ ] All dependency class hashes are declared and verified
- [ ] Constructor arguments are ready and verified

## Dependency Class Hashes (Already Declared)

| Contract | Class Hash | Status |
|----------|------------|--------|
| AjoCore | `0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc` | ✅ Declared |
| AjoMembers | `0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07` | ✅ Declared |
| AjoCollateral | `0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb` | ✅ Declared |
| AjoPayments | `0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d` | ✅ Declared |
| AjoGovernance | `0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2` | ✅ Declared |
| AjoSchedule | `0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae` | ✅ Declared |

## Expected Timeline

- Declaration: 1-2 minutes
- Verification: Immediate
- Deployment: 1-2 minutes
- Total: ~5 minutes

## Support Resources

- Voyager: https://sepolia.voyager.online/
- Starkscan: https://sepolia.starkscan.co/
- Starknet Faucet: https://starknet-faucet.vercel.app/
- Starknet Discord: https://discord.gg/starknet

## Next Steps After Deployment

1. Verify contract on explorer
2. Test factory functionality (create an Ajo group)
3. Update all documentation with deployed addresses
4. Create integration tests with deployed contracts
5. Document the deployment in project README

---

**Ready to proceed?** Start with Step 1 above using Voyager UI.
