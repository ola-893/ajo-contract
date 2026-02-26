# Requirements Document: Fix Cairo Build Errors

## Introduction

This specification addresses the systematic resolution of 73 compilation errors in the AJO.SAVE Cairo contracts. The contracts have been fully translated from Solidity to Cairo but cannot compile due to API mismatches, syntax errors, and missing trait imports. The goal is to achieve a clean build with `scarb build` while maintaining exact functional equivalence to the original Solidity implementation.

## Glossary

- **AJO.SAVE**: A rotating savings and credit association (ROSCA) system where members contribute monthly and receive payouts in turns
- **Scarb**: The Cairo package manager and build tool (similar to Cargo for Rust)
- **Storage_API**: Cairo's storage access patterns for reading/writing contract state
- **Trait**: Cairo's interface mechanism for defining shared behavior
- **Dispatcher**: StarkNet's pattern for calling external contracts
- **Collateral_Formula**: The 60% collateral requirement calculation based on position
- **Guarantor_Network**: The system where each member vouches for another member
- **EARS_Pattern**: Easy Approach to Requirements Syntax - structured requirement format

## Requirements

### Requirement 1: Fix Storage API Errors

**User Story:** As a developer, I want to update all storage access patterns to use the current Cairo storage API, so that the contracts compile without storage-related errors.

#### Acceptance Criteria

1. WHEN accessing Vec storage, THE System SHALL use direct indexing methods instead of `.entry().append()`
2. WHEN reading from Map storage, THE System SHALL use `.read()` with explicit trait imports
3. WHEN writing to Map storage, THE System SHALL use `.write()` with explicit trait imports
4. WHEN accessing nested storage, THE System SHALL use the correct storage pointer access patterns
5. THE System SHALL import `StorageMapReadAccess` and `StorageMapWriteAccess` traits where needed

### Requirement 2: Fix Critical Syntax Error in Governance

**User Story:** As a developer, I want to remove the duplicate `fn` keyword in ajo_governance.cairo, so that the contract parses correctly.

#### Acceptance Criteria

1. WHEN the governance contract is parsed, THE System SHALL have exactly one `fn` keyword per function declaration
2. THE System SHALL preserve the complete `execute_proposal` function implementation
3. THE System SHALL maintain all function signatures in the IAjoGovernance trait

### Requirement 3: Add Missing Trait Imports

**User Story:** As a developer, I want to import all required traits for method calls, so that methods like `is_zero()`, `is_non_zero()`, and `unwrap_syscall()` resolve correctly.

#### Acceptance Criteria

1. WHEN calling `.is_zero()` on ContractAddress or ClassHash, THE System SHALL import `core::num::traits::Zero`
2. WHEN calling `.is_non_zero()` on values, THE System SHALL import the appropriate trait
3. WHEN calling `.unwrap_syscall()` on Result types, THE System SHALL import `starknet::SyscallResultTrait`
4. THE System SHALL add trait imports at the module level for all contracts

### Requirement 4: Resolve Ambiguous Method Calls

**User Story:** As a developer, I want to explicitly qualify ambiguous method calls, so that the compiler can resolve which trait implementation to use.

#### Acceptance Criteria

1. WHEN calling `.read()` on storage that could be ambiguous, THE System SHALL use explicit trait qualification
2. WHEN calling `.write()` on storage that could be ambiguous, THE System SHALL use explicit trait qualification
3. WHEN calling `.append()` on Vec storage, THE System SHALL use the correct VecTrait method
4. WHEN calling `.at()` on Vec storage, THE System SHALL use the correct VecTrait method
5. WHEN calling `.len()` on Vec storage, THE System SHALL use the correct VecTrait method

### Requirement 5: Update Deprecated Features

**User Story:** As a developer, I want to replace deprecated Cairo features with current alternatives, so that the code follows Cairo 2.6.0+ best practices.

#### Acceptance Criteria

1. WHEN creating zero addresses, THE System SHALL use `Zero::zero()` instead of `contract_address_const::<0>()`
2. THE System SHALL import `core::num::traits::Zero` for zero value creation
3. THE System SHALL maintain the same runtime behavior as the deprecated features

### Requirement 6: Fix Missing Interface Methods

**User Story:** As a developer, I want to ensure all dispatcher trait methods exist in their corresponding interfaces, so that external contract calls compile successfully.

#### Acceptance Criteria

1. WHEN calling methods via dispatcher, THE System SHALL have matching method signatures in the interface trait
2. THE System SHALL verify all IAjoMembersDispatcher methods exist in i_ajo_members.cairo
3. THE System SHALL verify all IAjoCollateralDispatcher methods exist in i_ajo_collateral.cairo
4. THE System SHALL verify all IAjoPaymentsDispatcher methods exist in i_ajo_payments.cairo

### Requirement 7: Handle Enum Storage Warnings

**User Story:** As a developer, I want to properly configure enum storage, so that enums can be stored without compiler warnings.

#### Acceptance Criteria

1. WHEN storing enums in contract storage, THE System SHALL either provide a default variant or use the `#[allow]` attribute
2. THE System SHALL apply fixes to ProposalStatus, MemberStatus, and PaymentToken enums
3. THE System SHALL maintain the same enum variant values and behavior

### Requirement 8: Preserve Contract Functionality

**User Story:** As a developer, I want all error fixes to maintain exact functional equivalence, so that the Cairo contracts behave identically to the Solidity originals.

#### Acceptance Criteria

1. THE System SHALL preserve the 60% collateral formula calculation
2. THE System SHALL preserve the guarantor network logic
3. THE System SHALL preserve the 5-phase factory initialization sequence
4. THE System SHALL preserve all event emissions and their parameters
5. THE System SHALL preserve all access control checks (owner, member, etc.)

### Requirement 9: Achieve Clean Build

**User Story:** As a developer, I want `scarb build` to complete successfully with zero errors, so that I can proceed to testing and deployment.

#### Acceptance Criteria

1. WHEN running `scarb build`, THE System SHALL compile all 6 contracts without errors
2. WHEN running `scarb build`, THE System SHALL produce valid CASM output for all contracts
3. THE System SHALL reduce error count from 73 to 0
4. THE System SHALL allow warnings but have zero compilation errors

### Requirement 10: Maintain Test Compatibility

**User Story:** As a developer, I want the existing test suite to compile after fixes, so that I can verify contract behavior.

#### Acceptance Criteria

1. WHEN running `scarb test`, THE System SHALL compile all test files without errors
2. THE System SHALL maintain compatibility with test helper functions
3. THE System SHALL maintain compatibility with mock contracts
4. THE System SHALL allow tests to run (even if some fail, they must compile)
