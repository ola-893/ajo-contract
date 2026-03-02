# BTC Cross-Chain Spec Fix Log

Date: 2026-02-27

## Scope

This log documents issues found during spec review and the updates applied to:
- `.kiro/specs/btc-crosschain-integration/requirements.md`
- `.kiro/specs/btc-crosschain-integration/design.md`
- `.kiro/specs/btc-crosschain-integration/tasks.md`

## Issues Found and Fixes Applied

1. Requirement/design mismatch for schedule granularity
- Issue: Requirement 2 said `schedule_cycle_payments` must store deadlines "for all members", while design/tasks implemented cycle-level schedule tasks.
- Fix: Requirement 2 acceptance criterion updated to cycle-level deadline + task metadata.
- File: `requirements.md`

2. Authorization model drift (owner vs governance)
- Issue: Spec mixed two models for adapter configuration (`owner` in some tasks, `governance` in others).
- Fix: Standardized split model:
  - Adapter address setters: owner authorization.
  - BTC commitment mode toggles: governance approval.
- Files: `requirements.md`, `design.md`, `tasks.md`

3. Property naming/semantics mismatch with updated auth model
- Issue: Design properties still used governance-centric labels that no longer matched the finalized split model.
- Fix:
  - Property 28 renamed to `Adapter Configuration Authorization Split`.
  - Property 30 renamed to `Configuration History Persistence`.
  - Related references updated in testing and adversarial sections.
- File: `design.md`

4. Optional-test policy inconsistency
- Issue: `tasks.md` had asterisks for optional tests and a note permitting skipping, which conflicted with deployment-readiness requirements.
- Fix:
  - Removed optional marker usage from checklist items.
  - Notes section updated to state all listed tasks are required for testnet readiness.
- File: `tasks.md`

5. Task wording mismatch in adversarial configuration tests
- Issue: Negative tests referred only to "without governance approval" for all configuration paths.
- Fix: Updated adversarial test task to validate:
  - adapter address changes without owner authorization, and
  - BTC commitment mode toggles without governance approval.
- File: `tasks.md`

## Result

The spec suite now has a consistent authorization model, aligned requirement/design semantics, and a mandatory test/deployment checklist suitable for execution.

## Execution Pass Updates (Code)

The following implementation issues were identified during execution and fixed in the Cairo contracts:

1. Unprotected and re-initializable `AjoCore.initialize`
- Issue: `AjoCore` could be initialized by any caller and re-initialized.
- Fix:
  - Added `constructor(factory_address)` to pin initializer authority.
  - Added `initialized` + `authorized_initializer` storage guards.
  - Restricted `initialize` to authorized factory caller and one-time execution.
- Files:
  - `ajo-save-cairo/src/core/ajo_core.cairo`
  - `ajo-save-cairo/src/factory/ajo_factory.cairo`

2. Factory module deployment used empty constructor calldata
- Issue: module deploy paths did not serialize required constructor args.
- Fix: factory now builds constructor calldata for core/members/collateral/payments/governance/schedule, wires collateral dependencies, initializes core at final phase, and transfers module ownership to core.
- File:
  - `ajo-save-cairo/src/factory/ajo_factory.cairo`

3. Runtime panic placeholders in core modules
- Issue: production paths still had `panic!("Not implemented")` in:
  - `AjoCore.process_cycle`
  - `AjoCore.finalize_ajo`
  - `AjoMembers.remove_member`
  - `AjoGovernance.cancel_proposal`
  - `AjoSchedule.schedule_cycle_payments`
  - `AjoSchedule.schedule_payout`
  - `AjoSchedule.get_next_execution_time`
- Fix: all listed functions implemented with access checks + deterministic state transitions.
- Files:
  - `ajo-save-cairo/src/core/ajo_core.cairo`
  - `ajo-save-cairo/src/members/ajo_members.cairo`
  - `ajo-save-cairo/src/governance/ajo_governance.cairo`
  - `ajo-save-cairo/src/schedule/ajo_schedule.cairo`

4. Collateral module missing cross-module wiring and sufficiency logic
- Issue: no payments/members linkage, slash placeholder, and insufficient collateral check placeholder.
- Fix:
  - Added `payments_contract` + `members_contract` storage.
  - Added owner-only setters for both addresses.
  - Implemented `slash_collateral` transfer and accounting.
  - Implemented `is_collateral_sufficient`.
  - Updated seize destination to prefer configured payments contract.
- Files:
  - `ajo-save-cairo/src/collateral/ajo_collateral.cairo`
  - `ajo-save-cairo/src/interfaces/i_ajo_collateral.cairo`

5. Missing payments constructor initialization
- Issue: payments storage fields were never initialized at deploy time.
- Fix: added constructor to initialize owner/config/token/members and default cycle state.
- File:
  - `ajo-save-cairo/src/payments/ajo_payments.cairo`

6. BTC/asset configuration missing in core state
- Issue: payment token metadata/address was not persisted as explicit per-Ajo config.
- Fix:
  - Added `payment_token_address` + `payment_token_decimals` to core storage.
  - Added getter/setter admin functions.
  - Initialized decimals based on `PaymentToken` enum and validated token index in `join_ajo`.
- Files:
  - `ajo-save-cairo/src/core/ajo_core.cairo`
  - `ajo-save-cairo/src/interfaces/i_ajo_core.cairo`

7. Task tracking drift
- Issue: task checklist did not reflect executed items.
- Fix: marked completed items for implemented subtasks in Phase 1.
- File:
  - `.kiro/specs/btc-crosschain-integration/tasks.md`

## Verification Notes

- `scarb build` now succeeds after changes.
- `snforge test` could not be executed in this environment due toolchain mismatch:
  - installed Scarb: `2.8.4`
  - required by snforge in this repo: `>= 2.13.1`

## Continuation Updates (Modules-First Rollout)

1. Factory sequence still effectively core-first in constraints/tests
- Issue: although calldata fixes existed, deployment constraints still required core before modules.
- Fix:
  - Removed core-first requirement in members/collateral/governance deployment guards.
  - Added dual-path finalization:
    - finalize on `deploy_governance_and_schedule` if core already exists
    - finalize on `deploy_core` if modules already exist
  - Finalization includes `AjoCore.initialize` + ownership transfer of all modules to core.
- File:
  - `ajo-save-cairo/src/factory/ajo_factory.cairo`

2. Integration tests still used old deployment order
- Issue: integration tests deployed `core -> modules`, conflicting with the approved modules-first order.
- Fix: updated integration flows to `members -> collateral/payments -> governance/schedule -> core`.
- Files:
  - `ajo-save-cairo/tests/integration/test_factory_deployment.cairo`
  - `ajo-save-cairo/tests/integration/test_full_season.cairo`
  - `ajo-save-cairo/tests/integration/test_default_handling.cairo`

3. Starknet JS helper mismatch with factory ABI and phased flow
- Issue: `starknet-scripts/core/factory.js` used stale ABI keys and old `create_ajo` arguments.
- Fix:
  - Rewrote factory helper to current ABI (`ABIS.FACTORY_ABI`).
  - Added phased create/deploy orchestration using modules-first order.
  - Updated stats/info retrieval to current factory view methods.
  - Fixed ABI key usage in lifecycle/quick-test helpers.
- Files:
  - `ajo-save-cairo/starknet-scripts/core/factory.js`
  - `ajo-save-cairo/starknet-scripts/core/ajo-lifecycle.js`
  - `ajo-save-cairo/starknet-scripts/demos/quick-test.js`

4. Token address propagation gap across factory/core/module transfers
- Issue: payment token config in `AjoCore` was not enough because collateral/payments perform ERC20 transfers from their own stored token address.
- Fix:
  - Added owner-managed token registry in factory (`USDC`, `BTC`) with getters/setters.
  - Factory now resolves token by `PaymentToken` enum and passes it into collateral/payments constructors.
  - Factory sets token metadata on core via `set_payment_token_address` during finalization.
  - Updated core setter authorization to allow factory (authorized initializer) during deployment-time setup.
  - Updated integration tests that run token transfers to set factory USDC token address to deployed mock token before Ajo deployment.
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_factory.cairo`
  - `ajo-save-cairo/src/factory/ajo_factory.cairo`
  - `ajo-save-cairo/src/core/ajo_core.cairo`
  - `ajo-save-cairo/tests/integration/test_full_season.cairo`
  - `ajo-save-cairo/tests/integration/test_default_handling.cairo`

5. Cross-contract caller context broke member-attributed token transfers
- Issue: core orchestrator was calling module methods that infer payer/member from `get_caller_address()`, which becomes `AjoCore` during contract-to-contract calls, not the end user.
- Fix:
  - Added explicit owner-only member-attributed entrypoints:
    - `AjoCollateral.deposit_collateral_for(member, amount)`
    - `AjoCollateral.withdraw_collateral_for(member, amount)`
    - `AjoPayments.make_payment_for(member, cycle, amount)`
  - Updated AjoCore to use these entrypoints in `join_ajo`, `process_payment`, and `exit_ajo`.
  - Kept existing direct methods for compatibility.
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_collateral.cairo`
  - `ajo-save-cairo/src/interfaces/i_ajo_payments.cairo`
  - `ajo-save-cairo/src/collateral/ajo_collateral.cairo`
  - `ajo-save-cairo/src/payments/ajo_payments.cairo`
  - `ajo-save-cairo/src/core/ajo_core.cairo`

## Continuation Updates (Access Control + Bridge Phase)

1. Missing explicit `authorized_core` gate across modules
- Issue: Sensitive module methods relied only on owner semantics; spec required explicit authorized-core checks and propagation.
- Fix:
  - Added `authorized_core` storage + setter/getter across:
    - `AjoMembers`, `AjoCollateral`, `AjoPayments`, `AjoGovernance`, `AjoSchedule`
  - Added `assert_only_core()` internal guards.
  - Applied guards to sensitive methods:
    - Members: `add_member`, `remove_member`, `update_member_status`, `mark_payout_received`
    - Collateral: `deposit_collateral*`, `withdraw_collateral*`, `slash_collateral`, `seize_collateral`
    - Payments: payment/cycle/default seizure state-mutating methods
    - Schedule: `schedule_cycle_payments`, `schedule_payout`, `cancel_task`
  - Updated factory finalization to call `set_authorized_core(core_address)` on all modules before ownership transfer.
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_members.cairo`
  - `ajo-save-cairo/src/interfaces/i_ajo_collateral.cairo`
  - `ajo-save-cairo/src/interfaces/i_ajo_payments.cairo`
  - `ajo-save-cairo/src/interfaces/i_ajo_governance.cairo`
  - `ajo-save-cairo/src/interfaces/i_ajo_schedule.cairo`
  - `ajo-save-cairo/src/members/ajo_members.cairo`
  - `ajo-save-cairo/src/collateral/ajo_collateral.cairo`
  - `ajo-save-cairo/src/payments/ajo_payments.cairo`
  - `ajo-save-cairo/src/governance/ajo_governance.cairo`
  - `ajo-save-cairo/src/schedule/ajo_schedule.cairo`
  - `ajo-save-cairo/src/factory/ajo_factory.cairo`

2. Bridge adapter interface/implementation absent
- Issue: Phase 2 required a concrete bridge adapter lifecycle, but no interface or contract existed.
- Fix:
  - Added `i_bridge_adapter.cairo` with:
    - `BridgeRequestStatus`, `DepositRequest`, `WithdrawalRequest`
    - Deposit/withdraw lifecycle methods
    - Query/config methods
    - Emergency pause controls
  - Added `BridgeAdapter` contract with:
    - request storage (`deposit_requests`, `withdrawal_requests`, `next_request_id`)
    - replay protection (`used_btc_tx_hashes`, `member_nonces`)
    - relayer + authorized-core authorization model
    - owner-controlled relayer/core config
    - pause/unpause owner wrappers
    - lifecycle event emission
- Files:
  - `ajo-save-cairo/src/interfaces/i_bridge_adapter.cairo`
  - `ajo-save-cairo/src/interfaces.cairo`
  - `ajo-save-cairo/src/adapters.cairo`
  - `ajo-save-cairo/src/adapters/bridge_adapter.cairo`
  - `ajo-save-cairo/src/lib.cairo`

3. Core bridge configuration missing
- Issue: `AjoCore` lacked bridge adapter state and controls required by Phase 2.
- Fix:
  - Added `bridge_adapter` + `bridge_enabled` storage in `AjoCore`.
  - Added admin methods:
    - `set_bridge_adapter`
    - `enable_bridge`
    - `disable_bridge`
  - Added view methods:
    - `get_bridge_adapter`
    - `is_bridge_enabled`
  - Updated core interface accordingly.
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_core.cairo`
  - `ajo-save-cairo/src/core/ajo_core.cairo`

4. Task tracking drift after access-control + bridge work
- Issue: checklist did not reflect newly completed Phase 1/2 implementation tasks.
- Fix: marked completed tasks in `tasks.md` for:
  - `5.1`–`5.4`
  - `7.1`, `7.2`
  - `8.1`, `8.2`
  - `9.1`, `9.2`, `9.3`
  - `10.1`, `10.2`
  - `11.1`, `11.2`
  - `12.1`, `12.2`
- File:
  - `.kiro/specs/btc-crosschain-integration/tasks.md`

## Continuation Updates (Swap Router Phase)

1. Missing swap router interface and contract implementation
- Issue: Phase 3 required quote/execution/cancel lifecycle for swaps, but no swap artifacts existed.
- Fix:
  - Added `i_swap_router.cairo` with `SwapStatus`, `SwapRequest`, and `ISwapRouter`.
  - Added `SwapRouter` contract with:
    - quote + execution + cancel lifecycle
    - request persistence and status tracking
    - owner-controlled DEX router config
    - authorized executor enforcement
    - reentrancy guard on execution path
- Files:
  - `ajo-save-cairo/src/interfaces/i_swap_router.cairo`
  - `ajo-save-cairo/src/interfaces.cairo`
  - `ajo-save-cairo/src/adapters/swap_router.cairo`
  - `ajo-save-cairo/src/adapters.cairo`
  - `ajo-save-cairo/src/lib.cairo`

2. Payments contract lacked swap routing + recipient preferences
- Issue: `AjoPayments.distribute_payout` only supported direct transfer and had no swap configuration/preference state.
- Fix:
  - Added storage:
    - `swap_router`
    - `recipient_token_preferences`
    - `swap_enabled`
  - Added admin/config methods:
    - `set_swap_router`, `get_swap_router`
    - `enable_swap`, `disable_swap`, `is_swap_enabled`
  - Added member preference methods:
    - `set_token_preference`, `get_token_preference`
  - Updated payout flow to:
    - branch direct transfer vs swap path
    - call `SwapRouter.get_quote` + `execute_swap` when preference differs
    - enforce executed status
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_payments.cairo`
  - `ajo-save-cairo/src/payments/ajo_payments.cairo`

3. Core lacked swap-router orchestration controls
- Issue: `AjoCore` had no persistent swap router config or toggles to govern swap behavior in payments.
- Fix:
  - Added `swap_router` + `swap_enabled` to `AjoCore` storage.
  - Added methods:
    - `set_swap_router`, `get_swap_router`
    - `enable_swap`, `disable_swap`, `is_swap_enabled`
  - Propagated router/toggle changes into `AjoPayments`.
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_core.cairo`
  - `ajo-save-cairo/src/core/ajo_core.cairo`

4. Task tracking drift after Phase 3 implementation
- Issue: task checklist did not reflect completed swap-router implementation work.
- Fix: marked completed tasks in `tasks.md` for:
  - `14.1`, `14.2`
  - `15.1`, `15.2`, `15.3`, `15.4`
  - `16.1`, `16.2`
  - `17.1`, `17.2`, `17.3`, `17.4`
  - `18.1`, `18.2`
- File:
  - `.kiro/specs/btc-crosschain-integration/tasks.md`

## Continuation Updates (BTC Collateral Adapter + Mode Integration)

1. Missing collateral mode in protocol types/config
- Issue: protocol had no first-class collateral-mode representation for L2 escrow vs BTC commitment.
- Fix:
  - Added `CollateralMode` enum to shared types.
  - Extended `AjoConfig` with `collateral_mode`.
  - Factory now sets default `CollateralMode::L2Escrow` for new Ajos.
- Files:
  - `ajo-save-cairo/src/interfaces/types.cairo`
  - `ajo-save-cairo/src/factory/ajo_factory.cairo`

2. Missing BTC collateral adapter interface/implementation
- Issue: Phase 4 required a dedicated adapter lifecycle for BTC commitments, but no interface/contract existed.
- Fix:
  - Added `i_btc_collateral_adapter.cairo` with commitment status/types and lifecycle/query/config APIs.
  - Added `BTCCollateralAdapter` contract implementing:
    - registration/verification/enforcement/release lifecycle
    - per-member commitment mapping
    - access control (`authorized_core`, verifier gating)
    - pausable emergency controls
    - OP_CAT verifier configuration
    - lifecycle/config event emission
- Files:
  - `ajo-save-cairo/src/interfaces/i_btc_collateral_adapter.cairo`
  - `ajo-save-cairo/src/interfaces.cairo`
  - `ajo-save-cairo/src/adapters/btc_collateral_adapter.cairo`
  - `ajo-save-cairo/src/adapters.cairo`

3. AjoCore lacked collateral-mode and BTC adapter controls
- Issue: core could not represent or toggle BTC commitment mode and had no BTC adapter state.
- Fix:
  - Added storage/state in `AjoCore`:
    - `btc_collateral_adapter`
    - `btc_commitment_enabled`
    - `collateral_mode`
  - Added API methods:
    - `set_btc_collateral_adapter`, `get_btc_collateral_adapter`
    - `enable_btc_commitment`, `disable_btc_commitment`
    - `is_btc_commitment_enabled`
    - `set_collateral_mode`, `get_collateral_mode`
  - Added governance-approval guard path (`assert_governance_approved`) for mode/feature toggles.
  - Added configuration events for adapter and feature/mode changes.
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_core.cairo`
  - `ajo-save-cairo/src/core/ajo_core.cairo`

4. AjoCollateral had no dual-mode fallback logic
- Issue: collateral operations always assumed escrowed ERC20 path and could not delegate to BTC commitment backend.
- Fix:
  - Added mode-aware helper that queries core config and adapter enablement.
  - Updated collateral operations to:
    - use BTC commitment lifecycle when BTC mode is active and adapter is configured
    - fall back to existing L2 escrow token transfer path otherwise
  - Applied delegation across deposit/withdraw/slash/seize flows.
- Files:
  - `ajo-save-cairo/src/collateral/ajo_collateral.cairo`

5. Task tracking drift after Phase 4 implementation
- Issue: task checklist did not reflect completed `20.x`–`24.2` implementation work.
- Fix: marked completed tasks for:
  - `20.1`–`20.3`
  - `21.1`–`21.5`
  - `22.1`, `22.2`
  - `23.1`–`23.3`
  - `24.1`, `24.2`
- File:
  - `.kiro/specs/btc-crosschain-integration/tasks.md`

## Continuation Updates (Cross-Phase Config + Emergency Controls)

1. Incomplete configuration event coverage
- Issue: adapter lifecycle events existed, but core-level configuration transitions were not emitted consistently across all adapter/mode toggles.
- Fix:
  - Added and wired core events:
    - `AdapterAddressUpdated`
    - `FeatureFlagToggled`
    - `CollateralModeChanged`
  - Emitted on bridge/swap/btc-collateral address and feature updates.
- Files:
  - `ajo-save-cairo/src/core/ajo_core.cairo`

2. Missing explicit emergency adapter disable paths
- Issue: no dedicated owner-triggered emergency disable methods existed for bridge/swap/btc-collateral adapters.
- Fix:
  - Added to core interface + implementation:
    - `emergency_disable_bridge`
    - `emergency_disable_swap`
    - `emergency_disable_btc_collateral`
  - Each path immediately disables corresponding feature flags and adapter wiring (and resets collateral mode to `L2Escrow` for BTC collateral emergency path).
- Files:
  - `ajo-save-cairo/src/interfaces/i_ajo_core.cairo`
  - `ajo-save-cairo/src/core/ajo_core.cairo`

3. Task tracking drift after cross-phase config controls
- Issue: checklist still showed event/config/emergency tasks as pending after implementation.
- Fix: marked completed tasks:
  - `26.1`, `26.2`
  - `27.1`, `27.2`, `27.3`
- File:
  - `.kiro/specs/btc-crosschain-integration/tasks.md`

4. Reentrancy hardening task state was stale
- Issue: checklist still had reentrancy hardening pending despite guards being present on token-transfer-critical paths.
- Fix: confirmed and tracked guard coverage on:
  - `AjoCollateral` deposit/slash/withdraw flows
  - `AjoPayments` payment/payout paths (via guarded internal execution)
  - `SwapRouter.execute_swap`
  - Marked `28.1` complete in task list.
- Files:
  - `ajo-save-cairo/src/collateral/ajo_collateral.cairo`
  - `ajo-save-cairo/src/payments/ajo_payments.cairo`
  - `ajo-save-cairo/src/adapters/swap_router.cairo`
  - `.kiro/specs/btc-crosschain-integration/tasks.md`

## Continuation Updates (Constructor Wiring + Deployment/Verification Pipeline)

1. AjoCollateral constructor drifted from spec deployment contract wiring
- Issue: `AjoCollateral` constructor still accepted only `(owner, monthly_contribution, total_participants, payment_token)` and initialized `payments_contract`/`members_contract` to zero, while design/tasks required constructor-level support for deployment-time wiring.
- Fix:
  - Updated constructor to accept:
    - `payments_contract: ContractAddress`
    - `members_contract: ContractAddress`
  - Persisted both values directly in storage at deployment.
  - Updated Factory collateral deployment calldata to pass placeholder payments address (zero) + concrete members address, then finalize payments address post-payments deployment via setter.
  - Updated unit/access-control tests that deploy `AjoCollateral` directly to pass new constructor args.
- Files:
  - `ajo-save-cairo/src/collateral/ajo_collateral.cairo`
  - `ajo-save-cairo/src/factory/ajo_factory.cairo`
  - `ajo-save-cairo/tests/test_collateral.cairo`
  - `ajo-save-cairo/tests/test_access_control.cairo`

2. Deployment script lacked hard guarantees for task 30 requirements
- Issue: existing full deployment script covered core flow but did not enforce robust preflight validation/output shape expected by Requirement 10 and tasks `30.1`/`30.2`.
- Fix:
  - Reworked `deploy_testnet_full.js` with:
    - explicit required env validation (`STARKNET_RPC`, `STARKNET_ACCOUNT_ADDRESS`, `STARKNET_PRIVATE_KEY`)
    - class artifact presence checks
    - computed class-hash non-zero validation for all classes
    - declaration lifecycle handling with contextual errors
    - transaction-level logging with explorer URLs
    - deterministic artifact emission:
      - `declared_class_hashes.json`
      - `deployment_info.json`
      - extracted ABI files under `deployment_artifacts/abis/`
    - actionable failure guidance at exit.
- Files:
  - `ajo-save-cairo/deploy-scripts/deploy_testnet_full.js`

3. Missing post-deployment verification script (task 30.3)
- Issue: there was no dedicated script to validate on-chain deploy outputs and end-to-end Factory operability after deployment.
- Fix:
  - Added `verify_deployment.js` that:
    - loads `deployment_info.json` and `declared_class_hashes.json`
    - verifies declared class hashes are available on-chain
    - verifies deployed contract addresses are reachable
    - runs smoke factory flow on-chain (`create_ajo` + phased module deployment + core deployment)
    - validates resulting Ajo addresses are non-zero and `is_initialized == true`
    - writes `verification_report.json`.
- Files:
  - `ajo-save-cairo/deploy-scripts/verify_deployment.js`

4. Deployment toolchain scripts/docs not aligned with new flow
- Issue: `deploy-scripts/package.json` and README did not expose/document full deploy+verify lifecycle.
- Fix:
  - Added npm scripts:
    - `deploy:sepolia`
    - `verify:deployment`
  - Updated deploy-scripts README with required env vars, optional env vars, and standard run order.
- Files:
  - `ajo-save-cairo/deploy-scripts/package.json`
  - `ajo-save-cairo/deploy-scripts/README.md`

5. Task tracking lag for executed mandatory items
- Issue: checklist still showed completed mandatory items as open.
- Fix: marked complete:
  - `1.3`
  - `30.1`
  - `30.2`
  - `30.3`
- File:
  - `.kiro/specs/btc-crosschain-integration/tasks.md`

6. Validation status after fixes
- `scarb build`: ✅ pass
- `node --check deploy_testnet_full.js`: ✅ pass
- `node --check verify_deployment.js`: ✅ pass
- `snforge test`: ⚠️ blocked locally by toolchain requirement mismatch (`Scarb 2.8.4` installed; snforge requires `>= 2.13.1`).

## Continuation Updates (Task 30.4 Smoke Runner)

1. Missing executable smoke-test runner for deployed contracts
- Issue: `30.4` required an integration smoke test against deployed testnet contracts (BTC-mode create/join/payment/payout), but the deploy pipeline only had deploy + verification scripts.
- Fix:
  - Added `smoke_test_deployed.js` to execute BTC-mode smoke flow against contracts in `deployment_info.json`:
    - optional BTC token override on Factory (`set_btc_token_address`)
    - create BTC-mode Ajo
    - phased module deployment
    - member approvals + `join_ajo(1)`
    - `start_ajo` and first payment round via `process_payment`
    - assertions on cycle advancement and payout state
    - emits `smoke_test_report.json`
  - Added npm script alias `smoke:deployed`.
  - Updated deploy-scripts README with required env vars and smoke workflow.
- Files:
  - `ajo-save-cairo/deploy-scripts/smoke_test_deployed.js`
  - `ajo-save-cairo/deploy-scripts/package.json`
  - `ajo-save-cairo/deploy-scripts/README.md`

2. Smoke execution blocked by missing runtime environment in local shell
- Issue: running `npm run smoke:deployed` failed immediately due missing `STARKNET_RPC` (and by extension no live signer/test accounts configured in this session).
- Result:
  - Task `30.4` remains unchecked until script is run successfully against Starknet testnet with funded accounts and token balances.
  - Script syntax validated with `node --check` and Cairo build remains green.
- Validation:
  - `node --check deploy-scripts/smoke_test_deployed.js`: ✅
  - `npm run smoke:deployed`: ❌ blocked (`Missing required environment variable: STARKNET_RPC`)
  - `scarb build`: ✅
