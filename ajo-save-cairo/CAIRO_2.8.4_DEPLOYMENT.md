# Cairo 2.8.4 Deployment Guide

## Summary

We've successfully downgraded from Cairo 2.16.0 to Cairo 2.8.4 to match network compatibility. All contracts have been recompiled, resulting in new class hashes.

## New Class Hashes (Cairo 2.8.4)

| Contract | New Class Hash |
|----------|----------------|
| AjoCore | `0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe` |
| AjoMembers | `0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e` |
| AjoCollateral | `0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508` |
| AjoPayments | `0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81` |
| AjoGovernance | `0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986` |
| AjoSchedule | `0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6` |
| AjoFactory | `0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812` |

## Deployment Strategy

Since all class hashes changed, we have two options:

### Option 1: Declare All Contracts via Voyager UI (RECOMMENDED)

This is the most reliable method given the RPC compatibility issues we've encountered.

**Step 1: Declare All Dependency Contracts**

For each contract (in order), go to https://sepolia.voyager.online/declare-contract:

1. **AjoCore**
   - Upload: `target/dev/ajo_save_AjoCore.contract_class.json`
   - Sign and wait for confirmation

2. **AjoMembers**
   - Upload: `target/dev/ajo_save_AjoMembers.contract_class.json`
   - Sign and wait for confirmation

3. **AjoCollateral**
   - Upload: `target/dev/ajo_save_AjoCollateral.contract_class.json`
   - Sign and wait for confirmation

4. **AjoPayments**
   - Upload: `target/dev/ajo_save_AjoPayments.contract_class.json`
   - Sign and wait for confirmation

5. **AjoGovernance**
   - Upload: `target/dev/ajo_save_AjoGovernance.contract_class.json`
   - Sign and wait for confirmation

6. **AjoSchedule**
   - Upload: `target/dev/ajo_save_AjoSchedule.contract_class.json`
   - Sign and wait for confirmation

**Step 2: Declare AjoFactory**

- Upload: `target/dev/ajo_save_AjoFactory.contract_class.json`
- Sign and wait for confirmation

**Step 3: Deploy AjoFactory**

Go to https://sepolia.voyager.online/deploy-contract:

- Class hash: `0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812`
- Constructor arguments (in order):

```
0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8
0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe
0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e
0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508
0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81
0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986
0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6
```

### Option 2: Use Batch Declaration Script

Create a script to declare all contracts programmatically (if RPC issues are resolved).

## Environment Setup

The project is now configured to use Cairo 2.8.4:

- **Scarb version**: 2.8.4 (managed via asdf)
- **Cairo version**: 2.8.4
- **Sierra version**: 1.6.0
- **Configuration file**: `.tool-versions` (contains `scarb 2.8.4`)

## Verification Commands

After declaration, verify each contract:

```bash
# Verify AjoCore
curl -s -X POST https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "starknet_getClass",
    "params": {
      "block_id": "latest",
      "class_hash": "0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe"
    },
    "id": 1
  }' | python3 -m json.tool | head -5
```

Repeat for each contract, replacing the class_hash.

## Important Notes

1. **All previous class hashes are now invalid** - they were compiled with Cairo 2.16.0
2. **The Sierra class hash changes** when you change Cairo compiler versions
3. **CASM hash also changes** based on the CASM compiler version
4. **asdf is now managing Scarb versions** - use `. /opt/homebrew/opt/asdf/libexec/asdf.sh` before running scarb commands
5. **The `.tool-versions` file** pins the project to Scarb 2.8.4

## Rebuilding in the Future

If you need to rebuild:

```bash
# Ensure you're using the correct Scarb version
. /opt/homebrew/opt/asdf/libexec/asdf.sh
cd ajo-save-cairo
scarb --version  # Should show 2.8.4

# Clean and rebuild
scarb clean
scarb build

# Get new class hashes
./get_class_hashes.sh
```

## Next Steps

1. Use Voyager UI to declare all 7 contracts
2. Deploy the AjoFactory with the new constructor arguments
3. Test the deployed factory
4. Update all documentation with the new contract addresses

## Troubleshooting

### If you see "command not found: scarb"
```bash
. /opt/homebrew/opt/asdf/libexec/asdf.sh
```

### If Scarb shows wrong version
```bash
cd ajo-save-cairo
cat .tool-versions  # Should show: scarb 2.8.4
asdf current scarb  # Should show: scarb 2.8.4
```

### If declaration fails with CASM mismatch
- This should no longer happen with Cairo 2.8.4
- If it does, use Voyager UI which handles CASM compilation server-side
