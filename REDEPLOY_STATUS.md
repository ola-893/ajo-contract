# Starknet Redeploy Status (Current)

Last updated: 2026-03-06
Network: Starknet Sepolia
RPC: https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU
Deployer account: `0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8`

## Outcome
Updated Cairo contracts were rebuilt, redeclared (with network-expected CASM hashes where required), and redeployed.
ABIs were regenerated from latest `target/dev` artifacts and synced to frontend.

## Deployed Contracts (Fresh)
- Factory: `0x0295f1221b20905844cb4977866f097e2af880b8b08c59b2f27e32b6a4011601`
- BridgeAdapter: `0x072a35eee202f9f711e92c9731c1c9d452e3463b93c44f20e9cb406a80c3406d`
- SwapRouter: `0x00690ab409afb13a81ef10df3c6dc5880b0bb99a5141d24cc5db9b320111fc1d`
- BTCCollateralAdapter: `0x03444836110556606b35ccda6e9c1a51094f444ae0e415102595097b53341ccc`

## Frontend Wiring
- `frontend/.env` updated:
  - `VITE_AJO_FACTORY_ADDRESS`
  - `VITE_BRIDGE_ADAPTER_ADDRESS`
  - `VITE_SWAP_ROUTER_ADDRESS`
  - `VITE_BTC_COLLATERAL_ADAPTER_ADDRESS`
- `frontend/src/config/constants.ts` fallback adapter addresses updated to new deployments.

## Class Hashes (Current)
- AjoCore: `0x055e8968f0be4e2e89a454ab61c469ac82cb3f5ecfecaf2135437e842ecb8905`
- AjoMembers: `0x07f58b65262907ade7ed422eb138ce221b9791f0d991f7a468560fb309ced133`
- AjoCollateral: `0x07d2ffdc1b58f4d17b70d5288e02a4bc93481ac9835f2087bc1a971ddbf8182d`
- AjoPayments: `0x066a426deb875e97adc09090d1e2f5d5fb96a1f9b9dbe62fd785dd631b095648`
- AjoGovernance: `0x07c4543c733cefaa7c0fa3ca1152952185af730e1f091553737f5e99653d204e`
- AjoSchedule: `0x03ed10be83a83737c2e9ba5cdf4248e0dd7ee96fa5953ca1af3a6312f158b813`
- BridgeAdapter: `0x073e30fe39b83b4de334ca62f304a413ff50e01c893a5c38a2717fdac457b09b`
- SwapRouter: `0x03b1f3a6a19038bd408dd10afe4b8f713b3983c792d140cf7d55beb34a8cb5e6`
- BTCCollateralAdapter: `0x0509945ac93dd432b7d877fa6272c1728867e4962fc30506ed3414caea11208d`
- AjoFactory: `0x0569764f5aad4d041b5e64d0c66b49313d30155344d9700724c6d626c37bf697`

## ABI Regeneration
Synced from latest Cairo artifacts:
- `ajo-save-cairo/starknet-scripts/abis/*.json`
- `frontend/src/abi/*.json`

## Notes
- Factory USDC token was configured to Circle Sepolia USDC:
  - `0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343`
- Factory BTC token remains at contract default placeholder until a concrete Sepolia BTC token address is set.
