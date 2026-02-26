# ✅ Deployment Ready - Action Required

## What We Fixed

The CASM hash mismatch issue has been resolved by downgrading from Cairo 2.16.0 to Cairo 2.8.4, which is compatible with Starknet Sepolia.

## Current Status

✅ Scarb 2.8.4 installed and configured (via asdf)
✅ All contracts rebuilt with Cairo 2.8.4
✅ New class hashes computed
✅ Build errors fixed (schedule contract return type)
✅ Deployment scripts updated

## What You Need to Do Now

### Quick Path (5-10 minutes)

Use Voyager UI to declare and deploy all contracts:

1. **Open Voyager**: https://sepolia.voyager.online/declare-contract
2. **Connect ArgentX** (ensure you're on Sepolia testnet)
3. **Declare each contract** by uploading these files in order:
   - `target/dev/ajo_save_AjoCore.contract_class.json`
   - `target/dev/ajo_save_AjoMembers.contract_class.json`
   - `target/dev/ajo_save_AjoCollateral.contract_class.json`
   - `target/dev/ajo_save_AjoPayments.contract_class.json`
   - `target/dev/ajo_save_AjoGovernance.contract_class.json`
   - `target/dev/ajo_save_AjoSchedule.contract_class.json`
   - `target/dev/ajo_save_AjoFactory.contract_class.json`

4. **Deploy AjoFactory**: https://sepolia.voyager.online/deploy-contract
   - Class hash: `0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812`
   - Constructor args (copy-paste each line):
   ```
   0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8
   0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe
   0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e
   0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508
   0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81
   0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986
   0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6
   ```

## New Class Hashes Reference

```
AjoCore:       0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe
AjoMembers:    0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e
AjoCollateral: 0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508
AjoPayments:   0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81
AjoGovernance: 0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986
AjoSchedule:   0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6
AjoFactory:    0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812
```

## Why Voyager UI?

- Handles CASM compilation server-side (no version mismatch issues)
- Most reliable method
- Visual confirmation of each step
- No RPC compatibility issues

## After Deployment

Once you have the factory contract address, update:
- `FINAL_DEPLOYMENT_STATUS.md`
- Project README
- Integration tests

## Need More Details?

See `CAIRO_2.8.4_DEPLOYMENT.md` for comprehensive documentation.

---

**Ready to deploy? Start with Voyager UI now!** 🚀
