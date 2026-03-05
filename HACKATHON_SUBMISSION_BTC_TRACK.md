# AJO.SAVE - Re{define} Hackathon BTC Track Submission

## Project Description (<= 500 words)
AJO.SAVE is a BTC-native DeFi savings protocol on Starknet that modernizes Ajo/Esusu rotating savings circles with stronger default handling and cross-chain optionality. The core product is a ROSCA engine where members contribute each cycle and receive payouts in turn, but the implementation is designed for Bitcoin-centric flows rather than generic stablecoin-only loops.

The protocol is split into deterministic Starknet modules and adapter-based Bitcoin integrations. On Starknet, `AjoFactory` deploys per-pool modules (`AjoCore`, `AjoMembers`, `AjoCollateral`, `AjoPayments`, `AjoGovernance`, `AjoSchedule`) using class-hash deployment. This gives each Ajo instance isolated state while keeping contract logic reusable, auditable, and cheaper to instantiate at scale.

To align with the Bitcoin track, AJO.SAVE introduces three BTC-facing adapters that keep the core protocol bridge-agnostic and swap-agnostic:

1. Bridge Adapter: models BTC in/out lifecycle with replay-protected request IDs, status transitions, relayer authorization, and events for off-chain watchers.
2. Swap Router: models optional payout conversion and supports direct transfer path or swap path with executor authorization and deadline checks.
3. BTC Collateral Adapter (OP_CAT-compatible abstraction): models commitment registration, verification, enforcement start, and enforcement confirmation for Bitcoin-side collateral commitments.

The innovation is not just plugging BTC labels into an existing pool. We added collateral-mode abstraction so a pool can run either `L2Escrow` or `BTCCommitment`. In BTC commitment mode, member join and collateral operations create commitment state instead of requiring the same L2 token escrow behavior. This preserves the Ajo experience while shifting risk controls toward BTC-side commitments and verifiable state transitions.

The protocol also keeps AJO.SAVE’s original value proposition: reducing collateral burden through a structured guarantee model. Members can still participate in rotating community savings, but with programmable enforcement, transparent state, and extensible Bitcoin settlement pathways.

For the hackathon demo, we provide an end-to-end BTC flow script that creates a new BTC pool, deploys modules, wires adapters, enables bridge/swap/BTC commitment features, and executes track-relevant actions (withdrawal request/finalization path, swap execution path, and join with commitment creation). The script emits a machine-readable report for judging and reproducibility.

This project is original because it combines culturally native group savings mechanics with Starknet account abstraction and a BTC-first adapter architecture. It is also practical: contracts compile, frontend supports advanced module controls, and deployment scripts can reproduce the full flow on Starknet Sepolia.

## Track Alignment Matrix
| BTC Track Requirement | AJO.SAVE Implementation |
|---|---|
| Starknet security | Cairo modular contracts, per-module access control, reentrancy guard, pausable paths |
| Bridges | `src/adapters/bridge_adapter.cairo` + `src/interfaces/i_bridge_adapter.cairo` |
| Atomic swaps | `src/adapters/swap_router.cairo` + payout integration in `src/payments/ajo_payments.cairo` |
| OP_CAT apps | `src/adapters/btc_collateral_adapter.cairo` + `CollateralMode::BTCCommitment` wiring |

## Demo Commands
```bash
cd ajo-save-cairo
source /opt/homebrew/opt/asdf/libexec/asdf.sh
ASDF_SCARB_VERSION=2.13.1 scarb build

cd deploy-scripts
npm install
npm run deploy:sepolia
npm run verify:deployment
npm run btc:full-flow
```

## Submission Artifacts Generated
- `ajo-save-cairo/deployment_info.json`
- `ajo-save-cairo/declared_class_hashes.json`
- `ajo-save-cairo/verification_report.json`
- `ajo-save-cairo/btc_track_report.json`
