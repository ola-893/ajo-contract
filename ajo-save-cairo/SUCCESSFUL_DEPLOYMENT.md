# ✅ Successful Deployment - Cairo 2.8.4

## Deployment Summary

**Date**: February 26, 2026
**Network**: Starknet Sepolia Testnet
**Cairo Version**: 2.8.4
**Deployment Method**: starkli with --casm-hash override

## Deployed Contracts

### AjoFactory (Main Entry Point)
- **Contract Address**: `0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c`
- **Class Hash**: `0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812`
- **Deployment Tx**: `0x0028abee4abfe5adb5a408a6a8fe56c19e3127cd25335335f0d35385aa51217e`
- **Voyager**: https://sepolia.voyager.online/contract/0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c
- **Starkscan**: https://sepolia.starkscan.co/contract/0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c

## Declared Class Hashes

| Contract | Class Hash | Declaration Tx |
|----------|------------|----------------|
| AjoCore | `0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe` | `0x0124f35c7c4d108f7c96e7cfd8cf41fec12845e1f405cbd82b5501ef9e851da2` |
| AjoMembers | `0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e` | `0x02ac9658b5d18d6c0a7f86253d4f753c502387aeacbbac6943025cc6f0c22cc7` |
| AjoCollateral | `0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508` | `0x022b9df86bf1511e745b0263d867907c58adbad1fe27b4412ab72e19b1aa78b7` |
| AjoPayments | `0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81` | `0x02c4c02311251d138b4087419adf4b41a31e125dff366d95070636c80eab942c` |
| AjoGovernance | `0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986` | `0x02a13ec658e32d97cbbfb9ec9c230d029720758f1a59452b2b2fcf8ead6f365d` |
| AjoSchedule | `0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6` | `0x066707fd67e041d417d14f6cfc307ac0bdea0e85e75c416a7739c0557150cab9` |
| AjoFactory | `0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812` | `0x057965c0bbb5edba46d5b749fcb9154920d0d51a4360e3797d9683ccf5ba35be` |

## Constructor Arguments Used

```
owner: 0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8
core_class_hash: 0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe
members_class_hash: 0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e
collateral_class_hash: 0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508
payments_class_hash: 0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81
governance_class_hash: 0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986
schedule_class_hash: 0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6
```

## Key Solution: CASM Hash Override

The deployment succeeded by using the `--casm-hash` flag with starkli, which bypasses local CASM compilation and uses the network-expected CASM hash directly. This solved the persistent CASM mismatch issues.

### Example Command
```bash
starkli declare target/dev/ajo_save_AjoCore.contract_class.json \
  --casm-hash 0x74865ddd0c81e7ac529241223dd9817a77949d34369705e2e6fb0582221857a \
  --private-key $PK \
  --watch
```

## Next Steps

### 1. Verify Deployment
Visit the factory contract on explorers:
- Voyager: https://sepolia.voyager.online/contract/0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c
- Starkscan: https://sepolia.starkscan.co/contract/0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c

### 2. Test Factory Functionality
Create a test Ajo group to verify the factory works correctly:
```bash
# Example: Call create_ajo on the factory
starkli invoke \
  0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c \
  create_ajo \
  [constructor_args] \
  --private-key $PK
```

### 3. Update Documentation
- Update main README with factory address
- Update integration tests with new addresses
- Document the deployment process for future reference

### 4. Set Up Monitoring
- Monitor factory events on Voyager
- Set up alerts for contract interactions
- Track gas usage and optimization opportunities

## Technical Notes

### Cairo Version Management
- Using asdf to manage Scarb versions
- Current version: Scarb 2.8.4 (Cairo 2.8.4)
- Configuration file: `.tool-versions`

### CASM Hash Mapping
Each contract's Sierra class hash maps to a specific CASM hash expected by the network:

| Sierra Class Hash | Expected CASM Hash |
|-------------------|-------------------|
| `0x06176c5b...` | `0x74865ddd...` |
| `0x03ddd2cb...` | `0x0f4acb67...` |
| `0x010df6c9...` | `0x54f40d5d...` |
| `0x037373de...` | `0x06961752...` |
| `0x032c456a...` | `0x5e6cb322...` |
| `0x03a021e7...` | `0x65465f7b...` |
| `0x037dabada...` | `0x01587881...` |

### Lessons Learned
1. Network CASM compilation can differ from local tooling
2. The `--casm-hash` override is a reliable workaround
3. Voyager UI would have also worked (server-side compilation)
4. Always verify class hashes before deployment

## Support & Resources

- Starknet Documentation: https://docs.starknet.io/
- Starkli Documentation: https://book.starkli.rs/
- Voyager Explorer: https://sepolia.voyager.online/
- Starkscan Explorer: https://sepolia.starkscan.co/
- Starknet Discord: https://discord.gg/starknet

---

**Deployment Status**: ✅ COMPLETE
**Factory Address**: `0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c`
