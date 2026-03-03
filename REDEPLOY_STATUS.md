# Starknet Redeploy Status (Current)

Last updated: 2026-03-03
Network: Starknet Sepolia
RPC: https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU
Deployer account: `0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8`

## Outcome
Updated Cairo contracts were rebuilt, redeclared (with network-expected CASM hashes where required), and redeployed.
ABIs were regenerated from latest `target/dev` artifacts and synced to frontend.

## Deployed Contracts (Fresh)
- Factory: `0x03b4150c50f006ff24d459c61b6d7a3105b529d4cbc1d31230dcb381fe498de0`
- BridgeAdapter: `0x07b3140baa939d72d40b89a3647b2e7ac08f719dde54311490cf8bf0a8c44fac`
- SwapRouter: `0x0613d8d56a9f7b9a1abeeb27119bb4bd3b9881c1720d367b7cd87029ffb1a157`
- BTCCollateralAdapter: `0x01ecd36cf56d31533ea46c30e3c28983dd341a667549efadd9fbeff55fb7a2af`

## Frontend Wiring
- `frontend/.env` updated:
  - `VITE_AJO_FACTORY_ADDRESS`
  - `VITE_BRIDGE_ADAPTER_ADDRESS`
  - `VITE_SWAP_ROUTER_ADDRESS`
  - `VITE_BTC_COLLATERAL_ADAPTER_ADDRESS`
- `frontend/src/config/constants.ts` fallback adapter addresses updated to new deployments.

## Class Hashes (Current)
- AjoCore: `0x01831ddace9afff0a50534fce03c52dff11aedbe8b49debd3b933a89da88d058`
- AjoMembers: `0x044f93453b204b575944722037b9d51ebe5062ebae88e3ca43d6979ac9a8a118`
- AjoCollateral: `0x007de0379791d5affce82c82a84fb639b0487b8f149a6ab26895128d260c79bf`
- AjoPayments: `0x031a0741d826c579bd66ae52605c42e78e86304b1928d1e8beffbc53dab0c0b6`
- AjoGovernance: `0x067ce461390cabffdc105b38499d2bb0511d60cd59d46fd15563a0f9e979ba5d`
- AjoSchedule: `0x06dc39cf61ceae671925aac808897fa365495140d4359c5f32b584ef3310be4a`
- BridgeAdapter: `0x04ca93e065c74f7e0317296a804e7b4caaee5156345dfc0eda64cf7b30d9c040`
- SwapRouter: `0x003e4c7c26e7e9697855561d02d2e3d2022645cf5bc90d5a77d8104c98ad6e60`
- BTCCollateralAdapter: `0x0538467f924a1490747123bb32531f90136561b3d92836104f54f122376f572f`
- AjoFactory: `0x0023985f9ebabbe1468dd37623ce1e8dbf4dd0c19b636099acfd16e7585c6edd`

## ABI Regeneration
Synced from latest Cairo artifacts:
- `ajo-save-cairo/starknet-scripts/abis/*.json`
- `frontend/src/abi/*.json`

## Notes
- Factory USDC token was configured to Circle Sepolia USDC:
  - `0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343`
- Factory BTC token remains at contract default placeholder until a concrete Sepolia BTC token address is set.
