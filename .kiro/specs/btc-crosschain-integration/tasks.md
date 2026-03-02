# Implementation Plan: BTC + Cross-Chain Extension

## Overview

This implementation plan extends the AJO.SAVE protocol to support Bitcoin-native DeFi with cross-chain capabilities. The work is organized into four phases:

1. **Phase 1: Bitcoin-First Protocol Baseline** - Fix critical issues and make BTC fully operational
2. **Phase 2: Bridge Adapter Integration** - Enable BTC deposit/withdrawal lifecycle
3. **Phase 3: Atomic Swap Integration** - Support asset conversion at payout
4. **Phase 4: OP_CAT-Compatible Collateral** - Advanced Bitcoin-native collateral enforcement

Each phase builds incrementally on the previous phase, with checkpoints to ensure stability before proceeding.

## Tasks

### Phase 1: Bitcoin-First Protocol Baseline

- [ ] 1. Fix AjoCore initialization security and deployment order
  - [x] 1.1 Update AjoCore to use initialize() pattern with security guards
    - Add `initialized: bool` and `authorized_initializer: ContractAddress` to storage
    - Implement constructor that sets `authorized_initializer` to Factory address
    - Implement `initialize()` method with double-initialization protection and caller authorization
    - Add initialization guard checks: `assert(!self.initialized.read())` and `assert(caller == authorized)`
    - Mark as initialized at end of initialize(): `self.initialized.write(true)`
    - _Requirements: 1.1, 1.2, 1.3, 4.1_
  
  - [ ]* 1.2 Write property test for initialization security
    - **Property: Initialization Guard Protection**
    - **Validates: Requirements 1.2, 4.1**
    - Test that calling initialize() twice fails
    - Test that unauthorized callers cannot initialize
  
  - [x] 1.3 Update AjoCollateral constructor to include payments_contract parameter
    - Add `payments_contract: ContractAddress` to constructor signature
    - Add `payments_contract` to storage
    - Implement `set_payments_contract()` setter for Factory to resolve circular dependency
    - _Requirements: 1.1, 2.1_

  - [x] 1.4 Update AjoGovernance constructor signature
    - Add `voting_period: u64` and `quorum_percentage: u256` parameters to constructor
    - Initialize storage fields with these parameters
    - _Requirements: 1.1_

- [ ] 2. Update Factory deployment sequence and calldata construction
  - [x] 2.1 Implement proper calldata construction for each module
    - Create helper functions to serialize constructor parameters for each module type
    - Construct calldata arrays for AjoMembers, AjoCollateral, AjoPayments, AjoGovernance, AjoSchedule
    - Ensure all required parameters are included and properly serialized
    - _Requirements: 1.1, 1.2_
  
  - [x] 2.2 Reorder deployment sequence to deploy modules before AjoCore
    - Deploy AjoMembers first with (factory_address, total_participants)
    - Deploy AjoCollateral with (factory_address, monthly_contribution, total_participants, token_address, payments_placeholder, members_address)
    - Deploy AjoPayments with (factory_address, monthly_contribution, total_participants, cycle_duration, token_address, members_address)
    - Deploy AjoGovernance with (factory_address, members_address, voting_period, quorum_percentage)
    - Deploy AjoSchedule with (factory_address)
    - Call AjoCollateral.set_payments_contract() to update payments address
    - Deploy AjoCore with (factory_address)
    - Call AjoCore.initialize() with all module addresses
    - Transfer ownership of all modules to AjoCore
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.3 Add class hash validation before deployment
    - Check all required class hashes are non-zero before attempting deployment
    - Return descriptive error messages indicating which class hash is missing
    - _Requirements: 1.4, 1.5_
  
  - [ ]* 2.4 Write property test for factory deployment correctness
    - **Property 1: Factory Constructor Calldata Correctness**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Generate random valid Ajo configurations
    - Deploy modules through Factory
    - Verify each module receives correct initialization parameters
  
  - [ ]* 2.5 Write property test for class hash validation
    - **Property 2: Factory Class Hash Validation**
    - **Validates: Requirements 1.4**
    - Attempt deployment with missing class hashes
    - Verify Factory rejects with descriptive errors

- [ ] 3. Implement TODO runtime functions in core modules
  - [x] 3.1 Implement AjoCollateral.slash_collateral
    - Validate caller is owner (AjoCore)
    - Check member has sufficient collateral
    - Transfer slashed amount to payments_contract (not owner)
    - Update member's collateral balance and total collateral
    - Emit CollateralSlashed event
    - _Requirements: 2.1_
  
  - [x] 3.2 Implement AjoCollateral.is_collateral_sufficient
    - Query member's position from AjoMembers contract
    - Calculate required collateral for position
    - Compare actual collateral with required amount
    - Return true if actual >= required, false otherwise
    - _Requirements: 2.2_

  - [x] 3.3 Implement AjoSchedule.schedule_cycle_payments
    - Retrieve cycle_duration from AjoCore.get_config()
    - Calculate payment deadline (start_time + cycle_duration)
    - Create scheduled task with ScheduleType::Payment
    - Store task_id in cycle_payment_tasks mapping
    - _Requirements: 2.3_
  
  - [x] 3.4 Implement AjoSchedule.schedule_payout
    - Validate payout_time is in the future
    - Create scheduled task with ScheduleType::Payout
    - Store task_id in cycle_payout_tasks mapping
    - _Requirements: 2.4_
  
  - [x] 3.5 Implement AjoSchedule.get_next_execution_time
    - Iterate through all scheduled tasks
    - Find earliest pending task (not executed, not cancelled, time >= current)
    - Return next execution time or 0 if no pending tasks
    - _Requirements: 2.5_
  
  - [x] 3.6 Implement AjoMembers.remove_member
    - Validate caller is owner (AjoCore)
    - Verify member exists
    - Clear member data and position mapping
    - Decrement member count
    - Emit MemberRemoved event
    - _Requirements: 2.5_
  
  - [x] 3.7 Implement AjoGovernance.cancel_proposal
    - Validate proposal exists and is active
    - Check caller is proposer or owner
    - Update proposal status to Cancelled
    - Emit ProposalCancelled event
    - _Requirements: 2.5_
  
  - [x] 3.8 Implement AjoCore.process_cycle
    - Validate caller is owner or schedule contract
    - Verify Ajo is active and cycle number matches
    - Check if all members have paid
    - If all paid, call _distribute_payout()
    - _Requirements: 2.5_
  
  - [x] 3.9 Implement AjoCore.finalize_ajo
    - Validate caller is owner and Ajo is active
    - Verify all payouts have been distributed
    - Mark Ajo as inactive
    - Emit AjoFinalized event
    - _Requirements: 2.5_
  
  - [ ]* 3.10 Write property tests for collateral operations
    - **Property 3: Collateral Slashing Transfer**
    - **Validates: Requirements 2.1**
    - **Property 4: Collateral Sufficiency Check**
    - **Validates: Requirements 2.2**
    - Generate random member states and collateral amounts
    - Test slashing transfers to payments contract
    - Test sufficiency check returns correct boolean
  
  - [ ]* 3.11 Write property test for schedule functions
    - **Property 5: Schedule Function Completion**
    - **Validates: Requirements 2.3, 2.4, 2.5**
    - Generate random cycle and time parameters
    - Verify functions complete without panic
    - Verify correct deadline/execution time storage

- [ ] 4. Add BTC asset configuration and validation
  - [x] 4.1 Add asset configuration storage to AjoCore
    - Add `payment_token_address: ContractAddress` to storage
    - Add `payment_token_decimals: u8` to storage
    - Implement `get_payment_token_address()` getter
    - Implement `set_payment_token_address()` setter with owner check
    - _Requirements: 3.6, 3.7_
  
  - [x] 4.2 Add token index validation to join_ajo
    - Validate token_index parameter matches configured payment_token
    - Reject join attempts with mismatched token index
    - Return descriptive error message
    - _Requirements: 3.5_
  
  - [x] 4.3 Update Factory to set payment token address during deployment
    - Resolve BTC or USDC token contract address based on PaymentToken enum
    - Call AjoCore.set_payment_token_address() after initialization
    - Store token decimals (8 for BTC, 6 for USDC)
    - _Requirements: 3.1, 3.6_
  
  - [ ]* 4.4 Write property tests for BTC configuration
    - **Property 6: BTC Payment Cycle Completeness**
    - **Validates: Requirements 3.2, 3.3, 3.4**
    - **Property 7: Token Index Validation**
    - **Validates: Requirements 3.5**
    - **Property 8: Asset Configuration Persistence**
    - **Validates: Requirements 3.6, 3.7**
    - Create BTC-mode Ajos with random configurations
    - Test full payment cycle with BTC
    - Test token index validation rejects mismatches
    - Test configuration queries return correct values

- [ ] 5. Implement access control enforcement across modules
  - [x] 5.1 Add authorized_core storage field to each module
    - Add to AjoMembers, AjoCollateral, AjoPayments, AjoGovernance, AjoSchedule
    - Initialize in constructor or during ownership transfer
    - _Requirements: 4.1, 4.2_
  
  - [x] 5.2 Implement assert_only_core() internal function in each module
    - Check caller matches authorized_core address
    - Return descriptive error if unauthorized
    - _Requirements: 4.1_
  
  - [x] 5.3 Add access control checks to all sensitive module methods
    - Protect add_member, remove_member in AjoMembers
    - Protect deposit_collateral, slash_collateral in AjoCollateral
    - Protect make_payment, distribute_payout in AjoPayments
    - Protect schedule_cycle_payments, schedule_payout in AjoSchedule
    - _Requirements: 4.1, 4.2_
  
  - [x] 5.4 Update ownership transfer to propagate authorization
    - When AjoCore ownership changes, update authorized_core in all modules
    - _Requirements: 4.5_
  
  - [ ]* 5.5 Write property tests for access control
    - **Property 9: Access Control Enforcement**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - **Property 10: Ownership Transfer Propagation**
    - **Validates: Requirements 4.5**
    - Generate random unauthorized callers
    - Test all sensitive methods reject unauthorized calls
    - Test ownership transfer updates authorization

- [ ] 6. Checkpoint - Phase 1 validation
  - Run all Phase 1 unit tests and property tests
  - Verify Factory can deploy BTC-mode Ajo successfully
  - Verify all TODO functions are implemented without panics
  - Verify access control blocks unauthorized calls
  - Ensure all tests pass, ask the user if questions arise

### Phase 2: Bridge Adapter Integration

- [ ] 7. Create Bridge Adapter interface and types
  - [x] 7.1 Create i_bridge_adapter.cairo interface file
    - Define BridgeRequestStatus enum (Pending, Finalized, Cancelled)
    - Define DepositRequest struct with all required fields
    - Define WithdrawalRequest struct with all required fields
    - Define IBridgeAdapter trait with all lifecycle methods
    - _Requirements: 5.1, 5.2, 5.3, 5.8_
  
  - [x] 7.2 Create bridge_adapter.cairo implementation file
    - Set up contract module with storage structure
    - Add storage for deposit_requests, withdrawal_requests, next_request_id
    - Add replay protection storage: used_btc_tx_hashes, member_nonces
    - Add configuration storage: bridge_relayer
    - Integrate Ownable and Pausable components
    - _Requirements: 5.1, 5.4, 5.5_

- [ ] 8. Implement Bridge Adapter deposit lifecycle
  - [x] 8.1 Implement register_deposit method
    - Validate proof is not a duplicate (check used_btc_tx_hashes)
    - Create DepositRequest with Pending status
    - Store request and mark btc_tx_hash as used
    - Emit DepositRegistered event
    - Return request_id
    - _Requirements: 5.1, 5.4_
  
  - [x] 8.2 Implement finalize_deposit method
    - Validate caller is authorized bridge relayer
    - Validate request exists and status is Pending
    - Update request status to Finalized
    - Emit DepositFinalized event
    - _Requirements: 5.3, 5.8_
  
  - [ ]* 8.3 Write property test for deposit lifecycle
    - **Property 11: Bridge Request Lifecycle Integrity** (deposit portion)
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Generate random deposit requests
    - Test request data persists accurately through lifecycle
    - Test status transitions correctly
  
  - [ ]* 8.4 Write property test for deposit replay protection
    - **Property 12: Bridge Replay Protection** (deposit portion)
    - **Validates: Requirements 5.4**
    - Generate random BTC transaction hashes
    - Test duplicate deposit proofs are rejected
    - Test used hashes are tracked correctly

- [ ] 9. Implement Bridge Adapter withdrawal lifecycle
  - [x] 9.1 Implement request_withdrawal method
    - Get and increment member's nonce
    - Create WithdrawalRequest with Pending status
    - Store request
    - Emit WithdrawalRequested event
    - Return request_id
    - _Requirements: 5.2, 5.5_

  - [x] 9.2 Implement finalize_withdrawal method
    - Validate caller is authorized bridge relayer
    - Validate request exists and status is Pending
    - Update request status to Finalized
    - Store btc_tx_hash
    - Emit WithdrawalFinalized event
    - _Requirements: 5.3, 5.8_
  
  - [x] 9.3 Implement cancel_withdrawal method
    - Validate caller is owner or member who created request
    - Validate request exists and status is Pending
    - Update request status to Cancelled
    - Emit WithdrawalCancelled event
    - _Requirements: 5.3_
  
  - [ ]* 9.4 Write property test for withdrawal lifecycle
    - **Property 11: Bridge Request Lifecycle Integrity** (withdrawal portion)
    - **Validates: Requirements 5.2, 5.3, 5.8**
    - Generate random withdrawal requests
    - Test request data persists accurately through lifecycle
    - Test status transitions correctly
  
  - [ ]* 9.5 Write property test for withdrawal replay protection
    - **Property 12: Bridge Replay Protection** (withdrawal portion)
    - **Validates: Requirements 5.5**
    - Generate random withdrawal requests with nonces
    - Test replayed requests are rejected
    - Test nonce validation works correctly

- [ ] 10. Implement Bridge Adapter query and configuration methods
  - [x] 10.1 Implement query methods
    - Implement get_deposit_request(request_id)
    - Implement get_withdrawal_request(request_id)
    - Implement get_request_status(request_id)
    - _Requirements: 5.6, 5.8_
  
  - [x] 10.2 Implement configuration methods
    - Implement set_bridge_relayer(relayer) with owner check
    - Implement get_bridge_relayer()
    - _Requirements: 5.7, 11.1_
  
  - [ ]* 10.3 Write unit tests for query methods
    - Test queries return correct request data
    - Test queries for non-existent requests handle gracefully
    - _Requirements: 5.6, 5.8_

- [ ] 11. Integrate Bridge Adapter with AjoCore
  - [x] 11.1 Add bridge_adapter storage field to AjoCore
    - Add bridge_adapter: ContractAddress to storage
    - Add bridge_enabled: bool flag
    - _Requirements: 5.7_
  
  - [x] 11.2 Implement bridge adapter configuration in AjoCore
    - Implement set_bridge_adapter(address) with owner check
    - Implement get_bridge_adapter()
    - Implement enable_bridge() and disable_bridge()
    - _Requirements: 5.7, 11.1, 11.5_
  
  - [ ]* 11.3 Write integration test for bridge lifecycle
    - Create BTC-mode Ajo
    - Register deposit through bridge adapter
    - Finalize deposit
    - Request withdrawal
    - Finalize withdrawal
    - Verify all state transitions and events
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 12. Implement security controls for Bridge Adapter
  - [x] 12.1 Add access control to adapter entry points
    - Validate only authorized contracts can call register_deposit
    - Validate only bridge relayer can finalize operations
    - Return descriptive access control errors
    - _Requirements: 8.1_
  
  - [x] 12.2 Add emergency pause functionality
    - Integrate Pausable component
    - Block all critical operations when paused
    - Implement emergency_pause() and unpause() with owner check
    - _Requirements: 8.4, 11.5_
  
  - [ ]* 12.3 Write property tests for bridge security
    - **Property 23: Adapter Access Control** (bridge portion)
    - **Validates: Requirements 8.1**
    - **Property 24: Replay Protection Enforcement** (bridge portion)
    - **Validates: Requirements 8.2**
    - **Property 26: Emergency Pause Effectiveness** (bridge portion)
    - **Validates: Requirements 8.4**
    - Test unauthorized calls are rejected
    - Test replay attacks are blocked
    - Test pause blocks operations

- [ ] 13. Checkpoint - Phase 2 validation
  - Run all Phase 2 unit tests and property tests
  - Verify bridge adapter can register and finalize deposits
  - Verify bridge adapter can request and finalize withdrawals
  - Verify replay protection blocks duplicate submissions
  - Verify access control and emergency pause work correctly
  - Ensure all tests pass, ask the user if questions arise

### Phase 3: Atomic Swap Integration

- [ ] 14. Create Swap Router interface and types
  - [x] 14.1 Create i_swap_router.cairo interface file
    - Define SwapStatus enum (Pending, Executed, Cancelled, Failed)
    - Define SwapRequest struct with all required fields
    - Define ISwapRouter trait with quote and execution methods
    - _Requirements: 6.1, 6.2, 6.6_
  
  - [x] 14.2 Create swap_router.cairo implementation file
    - Set up contract module with storage structure
    - Add storage for swap_requests, next_request_id
    - Add configuration storage: dex_router
    - Integrate Ownable component
    - Define IERC20 interface with transfer, transfer_from, approve, balance_of
    - _Requirements: 6.1, 6.2_

- [ ] 15. Implement Swap Router quote and execution
  - [x] 15.1 Implement get_quote method
    - Query DEX router for quote
    - Return estimated destination amount
    - Emit SwapQuoted event
    - _Requirements: 6.3, 6.6_
  
  - [x] 15.2 Implement execute_swap method
    - Validate deadline hasn't passed
    - Validate min_dest_amount is reasonable
    - Transfer source tokens from caller to swap router
    - Approve DEX router to spend source tokens
    - Call DEX router to execute swap
    - Verify output amount >= min_dest_amount
    - Transfer destination tokens to recipient
    - Update swap request status to Executed
    - Emit SwapExecuted event
    - _Requirements: 6.2, 6.3, 6.4, 6.6_

  - [x] 15.3 Implement swap failure handling
    - Catch slippage errors and revert transaction
    - Catch deadline expiration and cancel swap
    - Ensure funds are preserved on failure (no fund loss)
    - Update swap request status appropriately
    - Emit SwapFailed or SwapCancelled event
    - _Requirements: 6.4, 6.5, 6.6, 6.8_
  
  - [x] 15.4 Implement cancel_swap method
    - Validate caller is owner or request creator
    - Validate request exists and status is Pending
    - Update request status to Cancelled
    - Return funds to payments contract if applicable
    - Emit SwapCancelled event
    - _Requirements: 6.4, 6.8_
  
  - [ ]* 15.5 Write property tests for swap operations
    - **Property 14: Swap Validation and Timeout Handling**
    - **Validates: Requirements 6.3, 6.4, 6.8**
    - **Property 15: Swap Failure Fund Preservation**
    - **Validates: Requirements 6.5**
    - **Property 16: Swap Event Emission**
    - **Validates: Requirements 6.6**
    - Generate random swap requests with various deadlines
    - Test validation rejects invalid parameters
    - Test timeout cancels swap and preserves funds
    - Test failures preserve funds
    - Test events are emitted correctly

- [ ] 16. Implement Swap Router query and configuration methods
  - [x] 16.1 Implement query methods
    - Implement get_swap_request(request_id)
    - Implement get_swap_status(request_id)
    - _Requirements: 6.6_
  
  - [x] 16.2 Implement configuration methods
    - Implement set_dex_router(router) with owner check
    - Implement get_dex_router()
    - _Requirements: 11.2_
  
  - [ ]* 16.3 Write unit tests for query methods
    - Test queries return correct swap data
    - Test queries for non-existent requests handle gracefully
    - _Requirements: 6.6_

- [ ] 17. Integrate Swap Router with AjoPayments
  - [x] 17.1 Add swap_router storage field to AjoPayments
    - Add swap_router: ContractAddress to storage
    - Add recipient_token_preferences: Map<ContractAddress, ContractAddress>
    - Add swap_enabled: bool flag
    - _Requirements: 6.1, 6.2_
  
  - [x] 17.2 Update distribute_payout to support swap path
    - Check if recipient has token preference different from pool token
    - If no swap needed, execute direct transfer path
    - If swap needed, call Swap_Router.get_quote()
    - Approve swap router to spend pool tokens
    - Call Swap_Router.execute_swap()
    - Verify recipient receives destination tokens
    - Emit PayoutDistributed event with actual amount
    - _Requirements: 6.1, 6.2, 6.7_
  
  - [x] 17.3 Implement token preference management
    - Implement set_token_preference(token) for members
    - Implement get_token_preference(member)
    - _Requirements: 6.1_

  - [x] 17.4 Add swap router configuration to AjoCore
    - Implement set_swap_router(address) with owner check
    - Implement get_swap_router()
    - Implement enable_swap() and disable_swap()
    - _Requirements: 6.7, 11.2, 11.5_
  
  - [ ]* 17.5 Write property test for payout routing
    - **Property 13: Payout Routing Correctness**
    - **Validates: Requirements 6.1, 6.2, 6.7**
    - Generate random payout scenarios with and without swap
    - Test direct transfer when no swap requested
    - Test swap execution when preference differs
    - Test recipient receives correct token and amount
  
  - [ ]* 17.6 Write integration test for swap payout
    - Create BTC-mode Ajo
    - Complete payment cycle
    - Set recipient preference to USDC
    - Distribute payout with swap
    - Verify recipient receives USDC
    - _Requirements: 6.1, 6.2, 6.7_

- [ ] 18. Implement security controls for Swap Router
  - [x] 18.1 Add access control to swap entry points
    - Validate only authorized contracts can execute swaps
    - Return descriptive access control errors
    - _Requirements: 8.1_
  
  - [x] 18.2 Add reentrancy protection to swap operations
    - Add reentrancy guard to execute_swap
    - Prevent reentrant calls during token transfers
    - _Requirements: 8.3, 8.8_
  
  - [ ]* 18.3 Write property tests for swap security
    - **Property 23: Adapter Access Control** (swap portion)
    - **Validates: Requirements 8.1**
    - **Property 25: Reentrancy Protection** (swap portion)
    - **Validates: Requirements 8.3, 8.8**
    - Test unauthorized calls are rejected
    - Test reentrancy attacks are blocked

- [ ] 19. Checkpoint - Phase 3 validation
  - Run all Phase 3 unit tests and property tests
  - Verify swap router can get quotes and execute swaps
  - Verify payout routing works for both direct and swap paths
  - Verify swap failures preserve funds
  - Verify access control and reentrancy protection work
  - Ensure all tests pass, ask the user if questions arise

### Phase 4: OP_CAT-Compatible BTC Collateral Adapter

- [ ] 20. Create BTC Collateral Adapter interface and types
  - [x] 20.1 Update types.cairo with CollateralMode enum
    - Define CollateralMode enum (L2Escrow, BTCCommitment)
    - Update AjoConfig struct to include collateral_mode field
    - _Requirements: 7.5, 7.8_
  
  - [x] 20.2 Create i_btc_collateral_adapter.cairo interface file
    - Define CommitmentStatus enum (Registered, Verified, EnforcementStarted, EnforcementConfirmed, Released)
    - Define BTCCommitment struct with all required fields
    - Define IBTCCollateralAdapter trait with lifecycle methods
    - _Requirements: 7.1, 7.2, 7.4_
  
  - [x] 20.3 Create btc_collateral_adapter.cairo implementation file
    - Set up contract module with storage structure
    - Add storage for commitments, next_commitment_id
    - Add storage for member_commitments mapping
    - Integrate Ownable and Pausable components
    - _Requirements: 7.1, 7.2_

- [ ] 21. Implement BTC Collateral Adapter commitment lifecycle
  - [x] 21.1 Implement register_commitment method
    - Validate member and amount are valid
    - Create BTCCommitment with Registered status
    - Store commitment and update member_commitments mapping
    - Emit CommitmentRegistered event
    - Return commitment_id
    - _Requirements: 7.1_
  
  - [x] 21.2 Implement verify_commitment method
    - Validate commitment exists and status is Registered
    - Validate verification proof
    - Update commitment status to Verified
    - Emit CommitmentVerified event
    - _Requirements: 7.2_
  
  - [x] 21.3 Implement start_enforcement method
    - Validate commitment exists and status is Verified
    - Validate default proof
    - Update commitment status to EnforcementStarted
    - Emit EnforcementStarted event
    - _Requirements: 7.3_
  
  - [x] 21.4 Implement confirm_enforcement method
    - Validate commitment exists and status is EnforcementStarted
    - Store btc_tx_hash
    - Update commitment status to EnforcementConfirmed
    - Emit EnforcementConfirmed event
    - _Requirements: 7.4_
  
  - [x] 21.5 Implement release_commitment method
    - Validate commitment exists
    - Update commitment status to Released
    - Emit CommitmentReleased event
    - _Requirements: 7.4_
  
  - [ ]* 21.6 Write property tests for commitment lifecycle
    - **Property 17: BTC Commitment Registration**
    - **Validates: Requirements 7.1**
    - **Property 18: Commitment Proof Verification**
    - **Validates: Requirements 7.2**
    - **Property 19: Enforcement Confirmation State Update**
    - **Validates: Requirements 7.4**
    - Generate random commitment requests
    - Test registration stores data correctly
    - Test verification validates proofs
    - Test enforcement updates status correctly

- [ ] 22. Implement BTC Collateral Adapter query and configuration methods
  - [x] 22.1 Implement query methods
    - Implement get_commitment(commitment_id)
    - Implement get_member_commitment(member)
    - Implement get_commitment_status(commitment_id)
    - _Requirements: 7.1, 7.4_
  
  - [x] 22.2 Implement configuration methods
    - Implement set_op_cat_verifier(verifier) with owner check
    - Implement get_op_cat_verifier()
    - _Requirements: 11.3_
  
  - [ ]* 22.3 Write unit tests for query methods
    - Test queries return correct commitment data
    - Test queries for non-existent commitments handle gracefully
    - _Requirements: 7.1, 7.4_

- [ ] 23. Integrate BTC Collateral Adapter with AjoCore and AjoCollateral
  - [x] 23.1 Add collateral mode configuration to AjoCore
    - Add collateral_mode: CollateralMode to storage
    - Add btc_collateral_adapter: ContractAddress to storage
    - Add btc_commitment_enabled: bool flag
    - _Requirements: 7.5, 7.8_

  - [x] 23.2 Implement collateral mode management in AjoCore
    - Implement set_collateral_mode(mode) with governance approval check
    - Implement get_collateral_mode()
    - Implement set_btc_collateral_adapter(address) with owner check
    - Implement enable_btc_commitment() with governance approval
    - Implement disable_btc_commitment() with governance approval
    - Emit CollateralModeChanged event
    - _Requirements: 7.5, 7.7, 7.8, 11.4_
  
  - [x] 23.3 Update AjoCollateral to support dual collateral modes
    - Add logic to check collateral_mode from AjoCore
    - If L2Escrow mode, use existing collateral deposit logic
    - If BTCCommitment mode, delegate to BTC_Collateral_Adapter
    - Implement fallback from BTCCommitment to L2Escrow if adapter unavailable
    - _Requirements: 7.5, 7.6_
  
  - [ ]* 23.4 Write property tests for collateral mode support
    - **Property 20: Collateral Mode Support**
    - **Validates: Requirements 7.5, 7.8**
    - **Property 21: Collateral Mode Fallback**
    - **Validates: Requirements 7.6**
    - **Property 22: Governance-Controlled OP_CAT**
    - **Validates: Requirements 7.7**
    - Generate Ajos with different collateral modes
    - Test both modes are supported
    - Test fallback works when BTCCommitment unavailable
    - Test governance approval required for OP_CAT
  
  - [ ]* 23.5 Write integration test for collateral mode switching
    - Create Ajo with L2Escrow mode
    - Create governance proposal to enable BTCCommitment
    - Execute proposal
    - Switch to BTCCommitment mode
    - Verify mode change persists
    - _Requirements: 7.5, 7.7, 7.8_

- [ ] 24. Implement security controls for BTC Collateral Adapter
  - [x] 24.1 Add access control to adapter entry points
    - Validate only authorized contracts can register commitments
    - Validate only authorized verifiers can confirm enforcement
    - Return descriptive access control errors
    - _Requirements: 8.1_
  
  - [x] 24.2 Add emergency pause functionality
    - Integrate Pausable component
    - Block all critical operations when paused
    - Implement emergency_pause() and unpause() with owner check
    - _Requirements: 8.4, 11.5_
  
  - [ ]* 24.3 Write property tests for BTC collateral security
    - **Property 23: Adapter Access Control** (BTC collateral portion)
    - **Validates: Requirements 8.1**
    - **Property 26: Emergency Pause Effectiveness** (BTC collateral portion)
    - **Validates: Requirements 8.4**
    - Test unauthorized calls are rejected
    - Test pause blocks operations

- [ ] 25. Checkpoint - Phase 4 validation
  - Run all Phase 4 unit tests and property tests
  - Verify BTC collateral adapter can register and verify commitments
  - Verify enforcement lifecycle works correctly
  - Verify collateral mode switching requires governance approval
  - Verify fallback to L2Escrow works when BTCCommitment unavailable
  - Verify access control and emergency pause work correctly
  - Ensure all tests pass, ask the user if questions arise

### Cross-Phase Security and Configuration

- [ ] 26. Implement comprehensive event emission
  - [x] 26.1 Add events for all adapter lifecycle transitions
    - Bridge: DepositRegistered, DepositFinalized, WithdrawalRequested, WithdrawalFinalized, WithdrawalCancelled
    - Swap: SwapQuoted, SwapExecuted, SwapCancelled, SwapFailed
    - BTC Collateral: CommitmentRegistered, CommitmentVerified, EnforcementStarted, EnforcementConfirmed, CommitmentReleased
    - _Requirements: 8.5, 10.5_
  
  - [x] 26.2 Add events for configuration changes
    - AdapterAddressUpdated (bridge, swap, BTC collateral)
    - CollateralModeChanged
    - FeatureFlagToggled (bridge_enabled, swap_enabled, btc_commitment_enabled)
    - _Requirements: 11.6, 11.7, 11.8_
  
  - [ ]* 26.3 Write property test for event emission
    - **Property 27: Lifecycle Event Emission**
    - **Validates: Requirements 8.5, 10.5**
    - **Property 30: Configuration History Persistence**
    - **Validates: Requirements 11.6, 11.7, 11.8**
    - Generate random operations
    - Test all operations emit corresponding events
    - Test configuration changes emit events
    - Test events contain accurate parameters

- [ ] 27. Implement adapter configuration management
  - [x] 27.1 Implement owner-controlled adapter address setters
    - set_bridge_adapter(address) in AjoCore
    - set_swap_router(address) in AjoCore
    - set_btc_collateral_adapter(address) in AjoCore
    - All require owner authorization
    - All emit AdapterAddressUpdated event
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [x] 27.2 Implement governance-controlled mode toggles
    - enable_btc_commitment() requires governance approval
    - disable_btc_commitment() requires governance approval
    - set_collateral_mode() requires governance approval
    - All emit FeatureFlagToggled or CollateralModeChanged event
    - _Requirements: 11.4, 11.5_
  
  - [x] 27.3 Implement emergency adapter disable
    - emergency_disable_bridge() with owner check
    - emergency_disable_swap() with owner check
    - emergency_disable_btc_collateral() with owner check
    - All immediately block adapter calls
    - All emit EmergencyDisable event
    - _Requirements: 11.5_
  
  - [ ]* 27.4 Write property tests for configuration authorization
    - **Property 28: Adapter Configuration Authorization Split**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
    - **Property 29: Emergency Adapter Disable**
    - **Validates: Requirements 11.5**
    - Test owner can set adapter addresses
    - Test governance approval required for mode changes
    - Test unauthorized attempts are rejected
    - Test emergency disable blocks adapter calls

- [ ] 28. Implement comprehensive reentrancy protection
  - [x] 28.1 Add reentrancy guards to all token transfer operations
    - AjoCollateral.deposit_collateral
    - AjoCollateral.slash_collateral
    - AjoPayments.make_payment
    - AjoPayments.distribute_payout
    - Swap_Router.execute_swap
    - _Requirements: 8.3, 8.8_
  
  - [ ]* 28.2 Write property test for reentrancy protection
    - **Property 25: Reentrancy Protection**
    - **Validates: Requirements 8.3, 8.8**
    - Create malicious reentrant contract
    - Test all protected operations reject reentrancy
    - Test state is not corrupted by reentrancy attempts

### Testing and Deployment

- [ ] 29. Comprehensive integration testing
  - [ ]* 29.1 Write full BTC cycle integration test
    - Create BTC-mode Ajo with all adapters configured
    - Members join with BTC collateral
    - Register BTC deposits through bridge
    - Process BTC payments for full cycle
    - Distribute BTC payout (with optional swap)
    - Verify all state transitions and balances
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 6.1, 6.2_
  
  - [ ]* 29.2 Write default handling integration test
    - Create BTC-mode Ajo
    - Member defaults on payment
    - Slash collateral (L2Escrow mode)
    - Verify collateral transferred to payments contract
    - Verify member status updated
    - _Requirements: 2.1, 2.2, 4.1_
  
  - [ ]* 29.3 Write BTC commitment enforcement integration test
    - Create Ajo with BTCCommitment mode
    - Register BTC commitment
    - Verify commitment
    - Member defaults
    - Start enforcement
    - Confirm enforcement
    - Verify commitment status transitions
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 29.4 Write adversarial testing suite
    - Test duplicate deposit proof rejection
    - Test replayed withdrawal request rejection
    - Test expired swap deadline handling
    - Test unauthorized adapter calls
    - Test reentrancy attack attempts
    - Test insufficient collateral attempts
    - Test invalid token index in join_ajo
    - Test unauthorized adapter address updates
    - Test unauthorized mode changes
    - _Requirements: 5.4, 5.5, 6.4, 8.1, 8.2, 8.3, 8.8, 11.1, 11.4_

- [ ] 30. Deployment preparation and execution
  - [x] 30.1 Create deployment script for Starknet Sepolia
    - Declare all contract classes (Factory, Core, Modules, Adapters)
    - Record class hashes in declared_class_hashes.json
    - Deploy Factory contract
    - Set all module class hashes in Factory
    - Set adapter addresses in Factory
    - Record deployment addresses in deployment_info.json
    - Output transaction hashes and explorer URLs
    - _Requirements: 10.1, 10.2, 10.3, 10.7_
  
  - [x] 30.2 Implement deployment error handling
    - Validate all class hashes before deployment
    - Return actionable error messages on failure
    - Log all transaction details for debugging
    - _Requirements: 10.4_
  
  - [x] 30.3 Create post-deployment verification script
    - Verify all contracts are accessible on block explorer
    - Verify Factory has correct class hashes set
    - Verify Factory can create test Ajo
    - Query and display all configuration
    - _Requirements: 10.6_
  
  - [ ]* 30.4 Run integration smoke tests against deployed contracts
    - Create BTC-mode Ajo on testnet
    - Execute basic operations (join, payment, payout)
    - Verify all operations succeed
    - _Requirements: 10.8_

- [ ] 31. Final checkpoint - Complete system validation
  - Run complete test suite (unit + property + integration)
  - Verify zero test failures
  - Verify zero panic placeholders in runtime paths
  - Verify all 30 correctness properties pass
  - Deploy to Starknet Sepolia testnet
  - Run post-deployment verification
  - Run integration smoke tests on testnet
  - Document any known limitations or future work
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests validate end-to-end flows across multiple components
- All adapter operations require proper access control and security measures
- Governance approval is required for collateral mode changes (owner can set adapter addresses)
- Emergency pause functionality must be available for all adapters
