# Requirements Document: BTC + Cross-Chain Extension

## Introduction

This document defines the requirements for extending the AJO.SAVE protocol from its current Starknet ERC20-based implementation to support Bitcoin-native DeFi with cross-chain capabilities. The extension follows a phased approach that maintains the deterministic ROSCA core on Starknet while introducing BTC and cross-chain functionality through explicit adapters.

The AJO.SAVE protocol is a Rotating Savings and Credit Association (ROSCA) system built on Starknet. Currently, it supports ERC20 tokens (USDC) with BTC defined in the PaymentToken enum but not fully functional. This extension will make BTC fully operational and add bridge, swap, and advanced collateral capabilities.

## Glossary

- **ROSCA**: Rotating Savings and Credit Association - a group-based savings mechanism where members contribute regularly and take turns receiving payouts
- **Ajo**: A specific instance of a ROSCA pool in the AJO.SAVE protocol
- **AjoCore**: The main orchestration contract that coordinates all modules
- **AjoFactory**: The factory contract that deploys new Ajo instances
- **AjoMembers**: Module managing member registration and status
- **AjoCollateral**: Module managing collateral deposits and enforcement
- **AjoPayments**: Module managing payment processing and payout distribution
- **AjoGovernance**: Module managing governance and voting
- **AjoSchedule**: Module managing cycle scheduling and timing
- **PaymentToken**: Enum defining supported payment assets (USDC, BTC)
- **Bridge_Adapter**: Interface for BTC deposit/withdrawal lifecycle management
- **Swap_Router**: Interface for atomic asset conversion at payout
- **BTC_Collateral_Adapter**: Interface for OP_CAT-compatible BTC collateral enforcement
- **L2Escrow**: Current collateral mode where assets are held in Starknet contracts
- **BTCCommitment**: Advanced collateral mode using OP_CAT for Bitcoin-native enforcement
- **Starknet_Sepolia**: Starknet testnet for deployment and testing

## Requirements

### Requirement 1: Factory Constructor Calldata Fix

**User Story:** As a protocol deployer, I want the factory to correctly pass constructor arguments to deployed modules, so that all modules initialize properly with required configuration.

#### Acceptance Criteria

1. WHEN the Factory deploys a module, THE Factory SHALL construct valid calldata containing all required constructor parameters for that module
2. WHEN a module is deployed, THE Module SHALL receive and process constructor arguments without errors
3. WHEN all modules are deployed for an Ajo, THE Ajo SHALL be fully initialized with correct cross-module references
4. THE Factory SHALL validate that all required class hashes are set before attempting deployment
5. WHEN deployment fails, THE Factory SHALL emit descriptive error messages indicating which module and parameter caused the failure

### Requirement 2: Complete TODO Runtime Functions

**User Story:** As a protocol operator, I want all critical runtime functions to be fully implemented, so that the protocol operates correctly without placeholder panics.

#### Acceptance Criteria

1. THE AjoCollateral.slash_collateral function SHALL transfer the specified amount from member collateral to the payments contract
2. THE AjoCollateral.is_collateral_sufficient function SHALL return true when member collateral meets or exceeds required amount, false otherwise
3. THE AjoSchedule.schedule_cycle_payments function SHALL calculate and store a cycle-level payment deadline and execution task metadata for the specified cycle
4. THE AjoSchedule.schedule_payout function SHALL calculate and store the payout execution time for the specified cycle
5. WHEN any of these functions are called, THE System SHALL execute the logic without panic or placeholder responses

### Requirement 3: Bitcoin-First Protocol Baseline

**User Story:** As a protocol user, I want to create and participate in BTC-mode Ajo pools, so that I can use Bitcoin for savings and credit operations.

#### Acceptance Criteria

1. WHEN creating an Ajo with PaymentToken::BTC, THE Factory SHALL successfully deploy all modules configured for BTC operations
2. WHEN a member joins a BTC-mode Ajo, THE System SHALL accept BTC token deposits for collateral
3. WHEN a member makes a payment in a BTC-mode Ajo, THE System SHALL process the BTC payment and update cycle state
4. WHEN all members have paid in a BTC-mode Ajo, THE System SHALL distribute the BTC payout to the designated recipient
5. THE AjoCore SHALL validate that token_index parameter in join_ajo matches the configured payment_token
6. THE System SHALL maintain explicit per-Ajo asset configuration including token type, contract address, and decimal metadata
7. WHEN querying Ajo configuration, THE System SHALL return the correct BTC token contract address for BTC-mode pools

### Requirement 4: Access Control and Module Authorization

**User Story:** As a security-conscious developer, I want strict access controls on all sensitive module methods, so that only authorized contracts can trigger critical operations.

#### Acceptance Criteria

1. WHEN a non-authorized contract calls a sensitive module method, THE System SHALL reject the call with an access control error
2. THE AjoCore SHALL be the only contract authorized to call state-changing methods in AjoMembers, AjoCollateral, and AjoPayments
3. THE Factory SHALL be the only contract authorized to initialize modules during deployment
4. THE Owner SHALL be the only address authorized to update module addresses or class hashes in the Factory
5. WHEN ownership is transferred, THE System SHALL update authorization accordingly across all modules

### Requirement 5: Bridge Adapter Integration

**User Story:** As a protocol user, I want to deposit BTC from Bitcoin network and withdraw BTC back to Bitcoin addresses, so that I can use native Bitcoin in the protocol.

#### Acceptance Criteria

1. WHEN a user registers a BTC deposit, THE Bridge_Adapter SHALL record the deposit proof with request ID, amount, and member address
2. WHEN a user requests a BTC withdrawal, THE Bridge_Adapter SHALL create a withdrawal request with destination BTC address and amount
3. WHEN a withdrawal is finalized, THE Bridge_Adapter SHALL mark the request as complete and emit a WithdrawalFinalized event
4. WHEN a duplicate deposit proof is submitted, THE Bridge_Adapter SHALL reject it with a replay protection error
5. WHEN a withdrawal request is replayed, THE Bridge_Adapter SHALL reject it with a nonce validation error
6. THE Bridge_Adapter SHALL maintain request status (Pending, Finalized, Cancelled) for all deposit and withdrawal operations
7. THE AjoCore SHALL remain bridge-agnostic and interact only through the Bridge_Adapter interface
8. WHEN querying request status, THE Bridge_Adapter SHALL return current state and relevant metadata

### Requirement 6: Atomic Swap Integration

**User Story:** As a protocol user, I want to receive payouts in my preferred asset even when the pool uses a different asset, so that I can optimize for my needs without managing conversions manually.

#### Acceptance Criteria

1. WHEN a payout is distributed without swap request, THE AjoPayments SHALL transfer funds directly to the recipient
2. WHEN a payout is distributed with swap request, THE Swap_Router SHALL execute the asset conversion before transfer
3. WHEN a swap is requested, THE Swap_Router SHALL validate the quote, deadline, and minimum output amount
4. WHEN a swap deadline expires, THE Swap_Router SHALL cancel the swap and return funds to the payments contract
5. WHEN a swap fails due to slippage, THE Swap_Router SHALL revert the transaction and preserve funds
6. THE Swap_Router SHALL emit events for quote requests, swap execution, and swap cancellation
7. THE AjoPayments.distribute_payout SHALL support both direct transfer and swap-then-transfer paths
8. WHEN a swap timeout occurs, THE System SHALL maintain protocol correctness with no fund loss

### Requirement 7: OP_CAT-Compatible BTC Collateral Adapter

**User Story:** As a protocol designer, I want to support Bitcoin-native collateral enforcement using OP_CAT, so that collateral can be enforced on the Bitcoin network without full L2 escrow.

#### Acceptance Criteria

1. WHEN a member registers a BTC collateral commitment, THE BTC_Collateral_Adapter SHALL record the commitment with proof reference
2. WHEN verifying a commitment, THE BTC_Collateral_Adapter SHALL validate the proof against the registered commitment
3. WHEN a default occurs with BTCCommitment mode, THE BTC_Collateral_Adapter SHALL initiate enforcement lifecycle on Bitcoin network
4. WHEN enforcement is confirmed, THE BTC_Collateral_Adapter SHALL update member status and emit confirmation event
5. THE System SHALL support both L2Escrow and BTCCommitment collateral modes per Ajo configuration
6. WHEN BTCCommitment mode is unavailable, THE System SHALL fall back to L2Escrow mode
7. THE OP_CAT enforcement path SHALL be controlled by a governance-approved feature flag
8. WHEN querying collateral mode, THE System SHALL return the active mode (L2Escrow or BTCCommitment) for the Ajo

### Requirement 8: Security and Reliability

**User Story:** As a protocol operator, I want comprehensive security controls and error handling, so that the protocol is resilient against attacks and failures.

#### Acceptance Criteria

1. WHEN an external adapter entry point is called, THE System SHALL enforce strict access control validation
2. WHEN a bridge or swap request is submitted, THE System SHALL validate replay protection using nonces or request IDs
3. WHEN any token transfer occurs, THE System SHALL apply reentrancy protection
4. WHEN emergency pause is activated, THE System SHALL block all adapter-triggered critical paths
5. WHEN any state-changing lifecycle transition occurs, THE System SHALL emit a corresponding event
6. WHEN an error occurs, THE System SHALL return explicit error messages without silent failures
7. THE System SHALL validate all external inputs before processing
8. WHEN a malicious contract attempts reentrancy, THE System SHALL reject the call

### Requirement 9: Testing and Validation

**User Story:** As a protocol developer, I want comprehensive test coverage for all BTC and cross-chain functionality, so that I can verify correctness before deployment.

#### Acceptance Criteria

1. WHEN running unit tests, THE Test_Suite SHALL validate BTC token mode configuration and validation logic
2. WHEN running integration tests, THE Test_Suite SHALL execute full BTC-mode Ajo lifecycle from creation to payout
3. WHEN running bridge tests, THE Test_Suite SHALL validate deposit registration, withdrawal request, and finalization flows
4. WHEN running swap tests, THE Test_Suite SHALL validate quote execution, timeout handling, and fallback logic
5. WHEN running adversarial tests, THE Test_Suite SHALL validate rejection of duplicate proofs, replayed requests, and unauthorized calls
6. WHEN running collateral mode tests, THE Test_Suite SHALL validate transitions between L2Escrow and BTCCommitment modes
7. THE Test_Suite SHALL include negative test cases for all error conditions
8. WHEN all tests complete, THE System SHALL report zero failures and zero panic placeholders in runtime paths

### Requirement 10: Deployment and Observability

**User Story:** As a protocol deployer, I want clear deployment procedures and comprehensive event logging, so that I can deploy to testnet and monitor operations effectively.

#### Acceptance Criteria

1. WHEN deploying to Starknet Sepolia, THE Deployment_Script SHALL declare all contract classes and record class hashes
2. WHEN deployment completes, THE Deployment_Script SHALL output deployment artifacts including addresses and ABIs
3. WHEN a critical transaction executes, THE System SHALL print transaction hashes and explorer URLs
4. WHEN a deployment fails, THE Deployment_Script SHALL return actionable error messages
5. THE System SHALL emit deterministic events for all bridge, swap, and commitment lifecycle transitions
6. WHEN running post-deployment verification, THE Verification_Script SHALL confirm all contracts are accessible on block explorer
7. THE Deployment artifacts SHALL include declared_class_hashes.json and deployment_info.json
8. WHEN running integration smoke tests, THE Test_Script SHALL execute successfully against deployed contracts

### Requirement 11: Governance and Configuration

**User Story:** As a protocol operator and governor, I want clear split control over adapter configuration and feature flags, so that operational changes are admin-controlled and risk-critical mode changes require governance approval.

#### Acceptance Criteria

1. WHEN setting a bridge adapter address, THE System SHALL require owner authorization
2. WHEN setting a swap router address, THE System SHALL require owner authorization
3. WHEN setting a BTC collateral adapter address, THE System SHALL require owner authorization
4. WHEN enabling BTCCommitment collateral mode, THE System SHALL require governance approval
5. WHEN emergency disable is triggered for an adapter, THE System SHALL immediately block all calls to that adapter
6. THE System SHALL maintain a deterministic on-chain record of adapter configuration and mode changes
7. WHEN querying adapter configuration, THE System SHALL return current addresses and enabled status
8. THE System SHALL emit events for all configuration changes including owner-set adapter updates and governance-approved mode toggles
