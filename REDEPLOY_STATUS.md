# Starknet Redeploy Status (Current)

Last updated: 2026-02-28
Network: Starknet Sepolia
RPC: https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU
Deployer account: `0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8`

## Goal
Redeploy contracts from the latest codebase (including BTC cross-chain features), not reuse older deployments.

## Current Class Hashes (local build)
- AjoCore: `0x06fc818a243a666f1fb900f1cff77862f0b846edddc43ffb1c4ee1931b30149e`
- AjoMembers: `0x044f93453b204b575944722037b9d51ebe5062ebae88e3ca43d6979ac9a8a118`
- AjoCollateral: `0x05d34eefea30d315d290f7902429c02ca10cb88c1343f8658dcb011f54e3c9db`
- AjoPayments: `0x031a0741d826c579bd66ae52605c42e78e86304b1928d1e8beffbc53dab0c0b6`
- AjoGovernance: `0x03ab10edaca770e4ec100ceb394dbc00320c6bb9ad18d59461031a9870703db3`
- AjoSchedule: `0x0020058e568d00ada7dbb5825ace8dbbe672593247274b3232712a0c6da12583`
- AjoFactory: `0x0023985f9ebabbe1468dd37623ce1e8dbf4dd0c19b636099acfd16e7585c6edd`
- BridgeAdapter: `0x045622d849e5fbc70e14922f714ee2f91f87c32914c7dd6ab0327cc57f4081d4`
- SwapRouter: `0x003e4c7c26e7e9697855561d02d2e3d2022645cf5bc90d5a77d8104c98ad6e60`
- BTCCollateralAdapter: `0x037e75bed46ebe58a079d7a9591c2d24d450d73e3e7f2936bca2781fe0b33a8f`

## On-chain Declaration Progress
Declared:
- AjoCore
- AjoMembers
- AjoCollateral
- AjoPayments
- AjoGovernance
- AjoSchedule
- AjoFactory
- BridgeAdapter
- SwapRouter
- BTCCollateralAdapter

## Latest Successful Declaration
- Patched AjoFactory declaration tx:
  - `0x0347e43fe60b82354f6fb8053806d7b79250a456b242c0a541c6111140fd5f53`
- BridgeAdapter declaration tx:
  - `0x06760f7c1f00b589842ebaa30712d5a94074c97d7c3a6a73e5b1010038576dd2`
- SwapRouter declaration tx:
  - `0x0471ff2227048eb0adfe04bb3ad518b2b433a95928cc415cc58dba25b2cfedfc`
- BTCCollateralAdapter declaration tx:
  - `0x0040d2146ae28e3839c15014380a2050e157e94635f3e21d9a9b2b9554b889d6`

## Factory Deployment Status
- Patched Factory deployment tx:
  - `0x04c8b923829ef629161c8e47c182774c21880cc8760550f1a225e59f402103f6`
- Deployed Factory address:
  - `0x05a578299c40e373787a13f5d970b904b1d4c62dc4f04bc1999e8ecc30222bcc`

## Adapter Deployment Status
- BridgeAdapter deployment tx:
  - `0x05e5cac03d60e23ec4ff5ee8d14d3a34d1a896d5b434aae7f317155a1fe547e4`
- BridgeAdapter address:
  - `0x0271f1b9fea5af65f4e852b61276ba1f859d58dd5e2a1a733c0a01526c3c4211`
- SwapRouter deployment tx:
  - `0x03fed73bab0577be11e4df9a9919d8781bdf3feddda49d6cdbd1290ef80bef63`
- SwapRouter address:
  - `0x04c336e930487b70a68bd0cec6448735aa90db845dbc3930510c0cf0b1191b93`
- BTCCollateralAdapter deployment tx:
  - `0x04336f930a34d7bb33c2ce917de80df9206e23e8a9e8bbc66a8b6a3e0352f23a`
- BTCCollateralAdapter address:
  - `0x012f18e202d6a857b16434080c247b2ea90a7a3b879617eee2b3a68e0342bf05`

## CASM Hashes Needed (for deterministic declares)
- AjoFactory: `0x17849d3b764ad1ba257226b0a61dd00160a43e365d69b2dfa05f8b3947521f7`
- BridgeAdapter: `0xb189a8d634a3810378897383c26b0e3588b766176ecf924dc576d4b0994e4c`
- SwapRouter: `0x3c5ae2f8bdd9b69dea5019db8b586673df387ec6958a76c79717bc94cda5ea6`
- BTCCollateralAdapter: `0x68d96139cf8fcd778ecaa82160b7b421aa563615c2639d14f74981b110fcafe`

## Current Status
Redeploy has completed for:
1. Core AJO suite declarations
2. Patched factory declaration + deployment
3. BTC adapter declarations + deployments

## Manual On-Chain Validation (Patched Factory)
Using `starkli` (direct invoke), the patched factory flow succeeded end-to-end:
- `create_ajo` tx:
  - `0x0473fc6a9a85e3b94e3cedbb49de580ffd2a759b698e42799c430631b768b883`
- `deploy_members` tx:
  - `0x002aad232a5bb4d9723f3d279216de3ad387e82eec27121de91cb96edb0d9a3e`
- `deploy_collateral_and_payments` tx:
  - `0x004e3e7825a63f9c829ef3d82c572f55dc7d0892fccaefd56dce0e33a19c7137`
- `deploy_governance_and_schedule` tx:
  - `0x00f9ef82b673f4549d00ecf017e9a78081eb5b6452393717879fe55df3a12921`
- `deploy_core` tx:
  - `0x02ebaba039f5edf96a6f94980e093beed70eaee2f5d2f7527f9ea460ab017eb7`

Result:
- `get_total_ajos` = `1`
- `get_ajo_info(1)` returns non-zero module addresses and `is_initialized = 1`

## Next Step
1. `verify_deployment.js` and `smoke_test_deployed.js` currently fail on this RPC due Starknet.js fee parser issue:
   - `Cannot convert undefined to a BigInt` during `estimateInvokeFee`
2. Functional verification is completed via direct on-chain `starkli` transactions listed above.
