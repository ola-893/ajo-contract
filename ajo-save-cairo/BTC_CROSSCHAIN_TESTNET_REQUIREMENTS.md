# AJO.SAVE BTC + Cross-Chain Extension Requirements (Testnet)

## 1. Document Control

- Document ID: `AJO-BTC-XCHAIN-REQ-SEPOLIA-v1`
- Version: `1.0`
- Status: `Proposed for implementation`
- Date: `2026-02-27`
- Scope: `Contract updates + Starknet Sepolia deployment`
- Target repo path: `ajo-save-cairo/`

## 2. Purpose

Define implementation requirements to extend AJO.SAVE from current Starknet ERC20 flow to a staged BTC-oriented architecture:

1. Bitcoin-first protocol baseline
2. Bridge adapter integration
3. Atomic swap integration
4. OP_CAT-compatible collateral adapter

This document is written as an execution-ready engineering requirement for contract updates, tests, and testnet rollout.

## 3. Current Baseline (Observed)

### 3.1 Implemented Today

- Modular Cairo contracts:
  - `AjoFactory`, `AjoCore`, `AjoMembers`, `AjoCollateral`, `AjoPayments`, `AjoGovernance`, `AjoSchedule`
- `PaymentToken` enum includes `USDC` and `BTC`:
  - `src/interfaces/types.cairo`
- ERC20-based payment/collateral transfer logic exists in:
  - `src/payments/ajo_payments.cairo`
  - `src/collateral/ajo_collateral.cairo`

### 3.2 Critical Gaps / Preconditions

The following must be treated as mandatory blockers before BTC/cross-chain expansion:

- Factory module deployment currently uses empty constructor calldata for deployed modules, while modules require constructor args.
  - `src/factory/ajo_factory.cairo`
- Incomplete functions (TODO/panic) in operational paths:
  - `AjoCollateral.slash_collateral`
  - `AjoCollateral.is_collateral_sufficient`
  - `AjoSchedule.schedule_cycle_payments`
  - `AjoSchedule.schedule_payout`
- Some modules rely on owner/module wiring assumptions not fully enforced end-to-end during deploy sequence.

No bridge protocol, no atomic swap protocol, and no OP_CAT integration is currently implemented in runtime contracts.

## 4. Architectural Direction

### 4.1 Guiding Principle

Keep ROSCA core deterministic on Starknet, and introduce BTC/cross-chain capability through explicit adapters (not embedded protocol-specific logic in core).

### 4.2 Required Layering

- Layer A: ROSCA Core (existing modules)
- Layer B: Asset/Cross-chain Adapters (new)
  - Bridge adapter
  - Swap adapter
  - BTC collateral adapter
- Layer C: External systems
  - Bitcoin network and indexers
  - Bridge relayers/watchers
  - Swap executors/routers

## 5. Scope and Non-Goals

### 5.1 In Scope

- Contract interface and storage changes required for BTC-first and cross-chain support
- Event model updates for off-chain coordination
- Integration test requirements
- Starknet Sepolia deployment requirements and acceptance criteria

### 5.2 Out of Scope (for this phase)

- Starknet mainnet deployment
- Production bridge partner selection finalization
- Economic design finalization for OP_CAT collateral liquidation
- Mobile wallet UX redesign

## 6. Phased Requirements

## Phase 1: Bitcoin-First Protocol Baseline (MUST)

### 6.1 Functional Requirements

- FR-1.1: `PaymentToken::BTC` must be executable in end-to-end flows, not only selectable.
- FR-1.2: Member join, collateral deposit, payment processing, and payout must all work for BTC-mode pools.
- FR-1.3: Token/address resolution must be explicit and deterministic per Ajo instance.
- FR-1.4: `AjoCore.join_ajo` token selection behavior (`token_index`) must be validated against `AjoConfig.payment_token` and enforced.

### 6.2 Contract Requirements

- CR-1.1: Add/confirm canonical per-Ajo asset config in state:
  - payment asset type (`USDC`/`BTC`)
  - Starknet token contract address
  - optional decimal metadata if needed for normalization
- CR-1.2: Ensure `AjoFactory` deploy sequence passes valid constructor calldata to all modules.
- CR-1.3: Complete all TODO runtime functions in collateral/schedule modules.
- CR-1.4: Ownership and access controls must ensure only authorized modules trigger sensitive methods.

### 6.3 Files Impacted (minimum)

- `src/factory/ajo_factory.cairo`
- `src/core/ajo_core.cairo`
- `src/payments/ajo_payments.cairo`
- `src/collateral/ajo_collateral.cairo`
- `src/schedule/ajo_schedule.cairo`
- `src/interfaces/types.cairo`
- `src/interfaces/i_ajo_core.cairo`
- `src/interfaces/i_ajo_factory.cairo`

### 6.4 Acceptance Criteria

- AC-1.1: Create Ajo with `PaymentToken::BTC` succeeds.
- AC-1.2: 3+ members join and deposit collateral in BTC-mode pool.
- AC-1.3: Full payment cycle and payout execute in BTC-mode without manual state patching.
- AC-1.4: `snforge test` includes BTC-mode integration tests passing.

## Phase 2: Bridge Adapter Integration (MUST)

### 6.5 Functional Requirements

- FR-2.1: Introduce an adapter interface for BTC in/out lifecycle.
- FR-2.2: Deposit proof registration and withdrawal request lifecycle must be represented on Starknet.
- FR-2.3: Core ROSCA modules must remain bridge-agnostic (call adapter, not bridge-specific code).

### 6.6 New Interface Requirements

Create new interface(s), e.g.:

- `src/interfaces/i_bridge_adapter.cairo`
  - `register_deposit(...)`
  - `request_withdrawal(...)`
  - `finalize_withdrawal(...)`
  - `get_request_status(...)`

Bridge requests must include:

- request id
- Ajo id
- member address
- asset
- amount
- destination BTC address hash/payload
- nonce / replay protection
- status enum

### 6.7 Events (MUST)

- `DepositRegistered`
- `WithdrawalRequested`
- `WithdrawalFinalized`
- `WithdrawalCancelled`

### 6.8 Acceptance Criteria

- AC-2.1: Bridge adapter contract can be configured per Ajo/pool.
- AC-2.2: Test flow validates deposit registration + withdrawal request + finalize transitions.
- AC-2.3: Invalid replay or duplicate request is rejected.

## Phase 3: Atomic Swap Integration (SHOULD for testnet release)

### 6.9 Functional Requirements

- FR-3.1: Support payout conversion path when pool asset != recipient preferred asset.
- FR-3.2: Swap must be optional and explicit per payout instruction.
- FR-3.3: If swap fails/timeout, fallback must preserve funds and protocol correctness.

### 6.10 New Interface Requirements

Create new interface(s), e.g.:

- `src/interfaces/i_swap_router.cairo`
  - `quote(...)`
  - `execute_swap(...)`
  - `cancel_swap(...)`
  - `get_swap_status(...)`

Swap execution metadata must include:

- source asset/amount
- destination asset/min-out
- deadline
- executor/route id
- status

### 6.11 Integration Requirements

- `AjoPayments.distribute_payout` must support both:
  - direct transfer path
  - swap-then-transfer path
- Schedule module may execute delayed swap settlement where needed.

### 6.12 Acceptance Criteria

- AC-3.1: Direct payout remains unchanged when no swap requested.
- AC-3.2: Swap payout succeeds under positive quote.
- AC-3.3: Timeout path cancels safely with no fund loss.

## Phase 4: OP_CAT-Compatible BTC Collateral Adapter (MAY for initial testnet; MUST before production BTC collateral)

### 6.13 Functional Requirements

- FR-4.1: Add collateral mode abstraction:
  - `L2Escrow` (current)
  - `BTCCommitment` (OP_CAT-compatible model)
- FR-4.2: Track BTC-side collateral commitments and proof references per member.
- FR-4.3: Default handling must support BTC commitment enforcement lifecycle.

### 6.14 New Interface Requirements

Create new interface(s), e.g.:

- `src/interfaces/i_btc_collateral_adapter.cairo`
  - `register_commitment(...)`
  - `verify_commitment(...)`
  - `start_enforcement(...)`
  - `confirm_enforcement(...)`

### 6.15 Policy Requirements

- OP_CAT path must be behind governance-controlled feature flag.
- No OP_CAT enforcement path can alter core balances without verifiable state transition proofs.

### 6.16 Acceptance Criteria

- AC-4.1: BTC collateral commitment state is created and queryable per member.
- AC-4.2: Default flow can transition through enforcement states.
- AC-4.3: Fallback to L2 escrow mode remains available if enforcement is unavailable.

## 7. Security and Reliability Requirements

- SR-1: All new external adapter entry points require strict access control.
- SR-2: Replay protection required for bridge and swap requests.
- SR-3: Reentrancy protections required for any token transfer path.
- SR-4: Emergency pause must cover adapter-triggered critical paths.
- SR-5: Event emission required for every state-changing lifecycle transition.
- SR-6: No silent failure paths; explicit error signaling required.

## 8. Testing Requirements

### 8.1 Unit Tests (MUST)

Add/extend tests for:

- BTC token mode config and validation
- Factory constructor calldata correctness
- Collateral TODO function implementations
- Bridge request state machine
- Swap state machine and fallback logic
- Collateral mode transitions (L2Escrow <-> BTCCommitment)

### 8.2 Integration Tests (MUST)

Create/extend under `tests/integration/`:

- `test_btc_full_cycle.cairo`
- `test_bridge_lifecycle.cairo`
- `test_swap_payout.cairo`
- `test_default_with_btc_collateral_mode.cairo`

### 8.3 Negative/Adversarial Tests (MUST)

- duplicate bridge proof
- replayed withdrawal request
- stale swap quote / deadline exceeded
- unauthorized adapter calls
- partial execution / interrupted schedule execution

### 8.4 Exit Criteria

- `snforge test` passes all modules
- no panic placeholders in runtime-critical functions
- integration tests pass on local + Sepolia fork where applicable

## 9. Deployment Requirements (Starknet Sepolia)

## 9.1 Pre-Deployment

- DR-1: Freeze ABIs and interfaces for this release.
- DR-2: Update deployment scripts to include new class declarations (if new adapter contracts added).
- DR-3: Ensure environment variables are complete for testnet execution.

### Required env keys (minimum)

- `STARKNET_RPC`
- `STARKNET_ACCOUNT_ADDRESS`
- `STARKNET_PRIVATE_KEY`
- `FACTORY_ADDRESS` (for integration scripts after deploy)
- asset/adaptor contract addresses as introduced

## 9.2 Build + Test Gate

```bash
cd ajo-save-cairo
scarb build
snforge test
```

All tests must pass before declare/deploy.

## 9.3 Declare + Deploy

Primary script path:

```bash
cd ajo-save-cairo
./scripts/full_deployment.sh
```

Alternative scripts (if needed):

- `scripts/deploy_with_sncast.sh`
- `scripts/deploy_with_starkli.sh`

## 9.4 Post-Deployment Verification

- Verify factory and module class hashes recorded in deployment artifact.
- Confirm deployed addresses on Voyager/Starkscan.
- Run quick integration smoke:

```bash
cd ajo-save-cairo/starknet-scripts
npm install
npm run demo:quick
npm run demo:full
```

### Required deployment artifacts

- `declared_class_hashes.json`
- `deployment_info.json`
- release notes with ABI/class hash checksum references

## 10. Observability Requirements

- OR-1: Emit deterministic events for bridge/swap/commitment lifecycle transitions.
- OR-2: Scripts must print tx hashes and explorer URLs for all critical txs.
- OR-3: Failures must return actionable error messages for operators.

## 11. Governance Requirements

- GR-1: Adapter addresses must be settable only by authorized governance/owner.
- GR-2: Collateral mode switch to `BTCCommitment` must require governance approval.
- GR-3: Emergency disable switch for bridge/swap adapters is required.

## 12. Risks and Mitigations

- Risk: Bridge dependency failure
  - Mitigation: adapter pause + fallback to direct L2 asset mode
- Risk: Swap slippage/MEV
  - Mitigation: strict min-out + deadline + cancel path
- Risk: OP_CAT feature uncertainty across environments
  - Mitigation: keep OP_CAT mode optional and testnet-simulated behind feature flag
- Risk: Constructor wiring failures during module deploy
  - Mitigation: deployment tests validating constructor calldata per module before release

## 13. Milestones

- M1: BTC baseline complete (contracts + tests)  
- M2: Bridge adapter complete (contracts + tests + smoke deploy)  
- M3: Swap adapter complete (contracts + tests + payout path validation)  
- M4: OP_CAT collateral adapter prototype complete (state machine + simulated enforcement)

## 14. Definition of Done (Release Candidate)

A release is considered done for testnet when:

1. Phase 1 + Phase 2 requirements are fully implemented and accepted.
2. Phase 3 is implemented or explicitly deferred with approved rationale.
3. No critical TODO/panic placeholders remain in runtime paths.
4. Contracts are declared/deployed on Starknet Sepolia.
5. End-to-end demo flow executes successfully with recorded transaction evidence.

## 15. Immediate Next Implementation Tasks (Execution List)

1. Fix factory module deployment constructor calldata wiring.
2. Complete pending TODO functions in collateral and schedule modules.
3. Add BTC-mode end-to-end integration tests.
4. Introduce `i_bridge_adapter.cairo` + minimal bridge adapter implementation.
5. Update deployment scripts to declare/deploy adapter contract(s).
6. Re-run full test suite and execute Sepolia deployment.

