# Implementation Plan: Fix Cairo Build Errors

## Overview

This plan systematically fixes 73 compilation errors in the AJO.SAVE Cairo contracts by addressing errors in priority order: syntax errors first, then storage API updates, trait imports, method disambiguation, interface alignment, and finally deprecation cleanup. Each task builds on previous fixes and includes verification steps to ensure error count decreases monotonically.

## Tasks

- [x] 1. Fix critical syntax error in governance contract
  - Remove duplicate `fn` keyword on line 309 of `ajo_governance.cairo`
  - Verify the `execute_proposal` function signature is correct
  - Run `scarb build` and verify error count decreases
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2. Update storage API patterns across all contracts
  - [x] 2.1 Fix Vec storage append pattern in ajo_factory.cairo
    - Replace `self.user_ajos.entry(caller).append().write(ajo_id)` with `self.user_ajos.append().write(ajo_id)`
    - Add `VecTrait` import if needed
    - _Requirements: 1.1, 1.4_
  
  - [x] 2.2 Fix Vec storage append pattern in ajo_members.cairo
    - Replace `self.member_list.append().write(member)` pattern if using old API
    - Ensure VecTrait is imported
    - _Requirements: 1.1, 1.4_
  
  - [x] 2.3 Add storage trait imports to all contracts
    - Add `StorageMapReadAccess`, `StorageMapWriteAccess` to contracts using Map storage
    - Add `StoragePointerReadAccess`, `StoragePointerWriteAccess` where needed
    - Add `StoragePathEntry` for `.entry()` calls on Map
    - Files: ajo_factory.cairo, ajo_core.cairo, ajo_members.cairo, ajo_collateral.cairo, ajo_payments.cairo, ajo_governance.cairo
    - _Requirements: 1.2, 1.3, 1.5_
  
  - [x] 2.4 Verify storage operations compile
    - Run `scarb build` and check for storage-related errors
    - Verify error count decreased from previous step
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 3. Add missing trait imports for method resolution
  - [x] 3.1 Add Zero trait import to contracts using is_zero()/is_non_zero()
    - Add `use core::num::traits::Zero;` to ajo_factory.cairo
    - Add to ajo_core.cairo
    - Add to ajo_governance.cairo
    - Verify ajo_members.cairo already has it
    - _Requirements: 3.1, 3.2_
  
  - [x] 3.2 Add SyscallResultTrait import to ajo_factory.cairo
    - Add `use starknet::SyscallResultTrait;` for `unwrap_syscall()` calls
    - _Requirements: 3.3_
  
  - [x] 3.3 Verify trait imports resolve method calls
    - Run `scarb build` and check for "method not found" errors
    - Verify error count decreased
    - _Requirements: 3.4_

- [ ] 4. Disambiguate ambiguous method calls
  - [x] 4.1 Review scarb build output for ambiguous method errors
    - Identify all "ambiguous method call" errors
    - List affected files and methods
    - _Requirements: 4.1, 4.2_
  
  - [x] 4.2 Add explicit trait qualifications where needed
    - For ambiguous `.read()` calls, ensure `StoragePointerReadAccess` is imported
    - For ambiguous `.write()` calls, ensure `StoragePointerWriteAccess` is imported
    - For ambiguous Vec methods, ensure `VecTrait` is imported
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 4.3 Verify disambiguation resolved errors
    - Run `scarb build` and check for remaining ambiguity errors
    - Verify error count decreased
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Replace deprecated contract_address_const with Zero::zero()
  - [x] 5.1 Update ajo_factory.cairo zero address initialization
    - Replace all 6 occurrences of `starknet::contract_address_const::<0>()` with `Zero::zero()`
    - Ensure `use core::num::traits::Zero;` is imported
    - _Requirements: 5.1, 5.2_
  
  - [ ]* 5.2 Write unit test to verify zero address behavior preserved
    - Test that `Zero::zero()` produces a zero address
    - Test that `is_zero()` returns true for zero addresses
    - Test that AjoInfo initialization works with Zero::zero()
    - _Requirements: 5.3_
  
  - [x] 5.3 Verify deprecation warnings resolved
    - Run `scarb build` and check for contract_address_const warnings
    - Verify error count unchanged (these were warnings, not errors)
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 6. Align interface methods with dispatcher calls
  - [x] 6.1 Identify missing interface methods
    - Search for all dispatcher calls in contracts (IAjoMembersDispatcher, IAjoCollateralDispatcher, IAjoPaymentsDispatcher)
    - Check corresponding interface files for method definitions
    - List missing methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 6.2 Add missing methods to i_ajo_members.cairo
    - Add `get_member_count() -> u256` if missing
    - Add `get_total_members() -> u256` if missing (likely already exists)
    - Add any other missing methods found in step 6.1
    - _Requirements: 6.2_
  
  - [x] 6.3 Add missing methods to i_ajo_collateral.cairo
    - Add any missing methods found in step 6.1
    - _Requirements: 6.3_
  
  - [x] 6.4 Add missing methods to i_ajo_payments.cairo
    - Add `get_cycle_start_time() -> u64` if missing
    - Add `get_next_payout_position() -> u256` if missing
    - Add any other missing methods found in step 6.1
    - _Requirements: 6.4_
  
  - [x] 6.5 Verify interface alignment resolved errors
    - Run `scarb build` and check for "method not found in trait" errors
    - Verify error count decreased
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Fix enum storage warnings
  - [x] 7.1 Add default variant to MemberStatus enum
    - Add `#[default]` attribute to `Active` variant in types.cairo
    - _Requirements: 7.1, 7.2_
  
  - [x] 7.2 Add default variant to PaymentToken enum
    - Add `#[default]` attribute to `USDC` variant in types.cairo
    - _Requirements: 7.1, 7.2_
  
  - [x] 7.3 Fix ProposalStatus enum storage
    - Add `#[default]` attribute to `Active` variant in i_ajo_governance.cairo, OR
    - Add `#[allow(enum_storage)]` attribute to the enum
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 7.4 Write unit test to verify enum behavior preserved
    - Test enum comparison works (MemberStatus::Active == MemberStatus::Active)
    - Test enum storage and retrieval works
    - Test enum pattern matching works
    - _Requirements: 7.3_
  
  - [x] 7.5 Verify enum warnings resolved
    - Run `scarb build` and check for enum storage warnings
    - Verify warnings decreased or eliminated
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 8. Verify build success and error count
  - [x] 8.1 Run full build and verify zero errors
    - Run `scarb build`
    - Verify exit code is 0
    - Verify error count is 0 (down from 73)
    - _Requirements: 9.1, 9.3, 9.4_
  
  - [x] 8.2 Verify CASM output generated
    - Check that CASM files exist for all 6 contracts
    - Verify CASM files are non-empty
    - _Requirements: 9.2_
  
  - [x] 8.3 Verify test compilation
    - Run `scarb test` (or `snforge test`)
    - Verify tests compile without errors
    - Note: Tests may fail, but they must compile
    - _Requirements: 10.1, 10.4_

- [x] 9. Checkpoint - Verify all compilation errors fixed
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 10. Write property tests for preserved functionality
  - [ ]* 10.1 Write property test for collateral formula preservation
    - **Property 1: Collateral Formula Preservation**
    - **Validates: Requirements 8.1**
    - Generate random positions (1 to total_participants)
    - Generate random monthly contributions
    - Verify required_collateral == (debt × 60) / 100
    - Run 100+ iterations
  
  - [ ]* 10.2 Write property test for guarantor network logic
    - **Property 2: Guarantor Network Logic Preservation**
    - **Validates: Requirements 8.2**
    - Generate random positions and total_participants
    - Verify guarantor_position == ((position - 1 + (total/2)) % total) + 1
    - Run 100+ iterations
  
  - [ ]* 10.3 Write property test for access control preservation
    - **Property 3: Access Control Preservation**
    - **Validates: Requirements 8.5**
    - Test owner-only functions with authorized/unauthorized callers
    - Test member-only functions with members/non-members
    - Verify unauthorized calls revert, authorized calls succeed
    - Run 100+ iterations

- [ ] 11. Write integration tests for critical functionality
  - [x] 11.1 Test execute_proposal function works after syntax fix
    - Create a proposal
    - Cast votes
    - Execute proposal
    - Verify proposal status updated and event emitted
    - _Requirements: 2.2_
  
  - [x] 11.2 Test 5-phase factory deployment sequence
    - Create Ajo
    - Deploy core
    - Deploy members
    - Deploy collateral and payments
    - Deploy governance and schedule
    - Verify all addresses set and is_initialized == true
    - _Requirements: 8.3_
  
  - [x] 11.3 Test event emissions preserved
    - Test AjoCreated event
    - Test MemberJoined event
    - Test PaymentProcessed event
    - Verify event parameters match expected values
    - _Requirements: 8.4_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster completion
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (collateral formula, guarantor logic, access control)
- Unit tests validate specific examples and edge cases (build success, syntax fixes, enum behavior)
- Run `scarb build` after each major task group to verify error count decreases
- If error count increases, revert changes and try alternative approach
- Priority is getting to zero compilation errors; property tests can be added later for verification
