# Final Solution: Use Voyager UI

## Why CLI Declarations Keep Failing

We've encountered persistent CASM hash mismatches because:
1. Starkli uses its embedded CASM compiler (v2.9.4)
2. Even when providing pre-compiled CASM from Scarb 2.8.4, the network expects a different hash
3. The network (spec v0.8.1) has specific CASM compilation requirements that don't match our local tooling

## The Reliable Solution: Voyager UI

Voyager compiles CASM server-side using the exact compiler version the network expects. This eliminates all version mismatch issues.

### Step-by-Step Instructions

#### 1. Prepare Your Wallet
- Open ArgentX browser extension
- Ensure you're connected to **Starknet Sepolia Testnet**
- Verify you have STRK tokens for gas (get from https://starknet-faucet.vercel.app/)

#### 2. Declare All Contracts

Go to: **https://sepolia.voyager.online/declare-contract**

Declare each contract in this order (upload the JSON file, sign, wait for confirmation):

1. **AjoCore**
   - File: `target/dev/ajo_save_AjoCore.contract_class.json`
   - Expected hash: `0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe`

2. **AjoMembers**
   - File: `target/dev/ajo_save_AjoMembers.contract_class.json`
   - Expected hash: `0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e`

3. **AjoCollateral**
   - File: `target/dev/ajo_save_AjoCollateral.contract_class.json`
   - Expected hash: `0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508`

4. **AjoPayments**
   - File: `target/dev/ajo_save_AjoPayments.contract_class.json`
   - Expected hash: `0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81`

5. **AjoGovernance**
   - File: `target/dev/ajo_save_AjoGovernance.contract_class.json`
   - Expected hash: `0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986`

6. **AjoSchedule**
   - File: `target/dev/ajo_save_AjoSchedule.contract_class.json`
   - Expected hash: `0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6`

7. **AjoFactory**
   - File: `target/dev/ajo_save_AjoFactory.contract_class.json`
   - Expected hash: `0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812`

#### 3. Deploy AjoFactory

Go to: **https://sepolia.voyager.online/deploy-contract**

- **Class Hash**: `0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812`

- **Constructor Arguments** (paste each on a new line):
```
0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8
0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe
0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e
0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508
0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81
0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986
0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6
```

- Sign the transaction
- Wait for deployment confirmation
- **Copy the deployed contract address**

#### 4. Verify Deployment

After deployment, you can verify on:
- Voyager: `https://sepolia.voyager.online/contract/[YOUR_ADDRESS]`
- Starkscan: `https://sepolia.starkscan.co/contract/[YOUR_ADDRESS]`

## Expected Timeline

- Each declaration: ~1-2 minutes
- Total declarations (7 contracts): ~10-15 minutes
- Factory deployment: ~1-2 minutes
- **Total time: ~15-20 minutes**

## What to Do After Deployment

1. Save the factory contract address
2. Update `FINAL_DEPLOYMENT_STATUS.md` with all deployed addresses
3. Test the factory by creating a test Ajo group
4. Update project documentation

## Troubleshooting

### "Insufficient balance for transaction"
- Get testnet STRK from: https://starknet-faucet.vercel.app/
- Ensure you're using the correct wallet address

### "Class already declared"
- This is fine! It means someone else declared the same class
- Continue to the next contract

### "Invalid class hash"
- Double-check you're uploading the correct `.contract_class.json` file
- Ensure the file isn't corrupted

### Voyager is slow/unresponsive
- Try Starkscan instead: https://sepolia.starkscan.co/declare-contract
- Or wait a few minutes and try again

## Alternative: Starkscan UI

If Voyager doesn't work, use Starkscan:
- Declare: https://sepolia.starkscan.co/declare-contract
- Deploy: https://sepolia.starkscan.co/deploy-contract

Same files and constructor arguments apply.

---

## Why This Works

Voyager and Starkscan:
- Use server-side CASM compilation with the correct network version
- Handle all RPC compatibility issues
- Provide visual confirmation of each step
- Are the most reliable deployment methods for Starknet

**Ready to deploy? Open Voyager and start with AjoCore!** 🚀
