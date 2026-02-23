# Design Document: Fix Cairo Build Errors

## Overview

This design provides a systematic approach to fixing 73 compilation errors in the AJO.SAVE Cairo contracts. The errors fall into 7 distinct categories, each requiring specific fixes while maintaining exact functional equivalence to the Solidity originals. The design prioritizes fixing critical blockers first (syntax errors), then API mismatches (storage, traits), and finally warnings (deprecated features, enum storage).

The key principle is: **Fix compilation errors without changing any contract logic or behavior.**

## Architecture

### Error Classification System

Errors are grouped into priority tiers:

**Tier 1 - Critical Blockers (1 error)**
- Syntax errors that prevent parsing

**Tier 2 - API Mismatches (45 errors)**
- Storage API errors (18)
- Missing trait imports (15)
- Ambiguous method calls (12)

**Tier 3 - Interface Mismatches (3 errors)**
- Missing dispatcher methods

**Tier 4 - Deprecation Warnings (10 warnings)**
- Deprecated features (6)
- Enum storage warnings (4)

### Fix Strategy

1. **Syntax fixes first** - Enable parsing
2. **Storage API updates** - Fix state access patterns
3. **Trait imports** - Resolve method calls
4. **Disambiguation** - Explicit trait qualification
5. **Interface alignment** - Add missing methods
6. **Deprecation cleanup** - Modernize code

## Components and Interfaces

### Component 1: Syntax Error Fixer

**Location:** `ajo_governance.cairo` line 309

**Problem:** Duplicate `fn` keyword in `execute_proposal` function
```cairo
fn         fn execute_proposal(ref self: ContractState, proposal_id: u256) {
```

**Solution:** Remove the duplicate `fn` keyword
```cairo
fn execute_proposal(ref self: ContractState, proposal_id: u256) {
```

**Files Affected:**
- `src/governance/ajo_governance.cairo`

### Component 2: Storage API Updater

**Problem:** Using old storage patterns like `.entry().append()` for Vec storage

**Current Pattern (Broken):**
```cairo
self.user_ajos.entry(caller).append().write(ajo_id);
```

**New Pattern (Fixed):**
```cairo
self.user_ajos.append().write(ajo_id);
```

**Explanation:** In Cairo 2.6.0+, Vec storage no longer uses `.entry()` for append operations. The `.append()` method is called directly on the Vec storage variable.

**Files Affected:**
- `src/factory/ajo_factory.cairo` - `user_ajos` Vec storage
- `src/members/ajo_members.cairo` - `member_list` Vec storage

**Additional Storage Fixes:**

For Map storage with explicit trait usage:
```cairo
// Import required traits
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};

// Then use .read() and .write() as before
let value = self.my_map.read(key);
self.my_map.write(key, value);
```

### Component 3: Trait Import Manager

**Problem:** Methods like `is_zero()`, `is_non_zero()`, `unwrap_syscall()` require trait imports

**Required Trait Imports:**

1. **For `is_zero()` and `is_non_zero()` on ContractAddress/ClassHash:**
```cairo
use core::num::traits::Zero;
```

2. **For `unwrap_syscall()` on Result types:**
```cairo
use starknet::SyscallResultTrait;
```

**Files Affected:**
- `src/factory/ajo_factory.cairo` - Uses `is_non_zero()` and `unwrap_syscall()`
- `src/core/ajo_core.cairo` - Uses `is_zero()`
- `src/members/ajo_members.cairo` - Uses `is_zero()`
- `src/collateral/ajo_collateral.cairo` - Uses comparison operations
- `src/governance/ajo_governance.cairo` - Uses `is_zero()`

### Component 4: Method Disambiguator

**Problem:** Ambiguous method calls where multiple traits provide the same method

**Common Ambiguities:**

1. **`.read()` and `.write()` on storage:**
```cairo
// Ambiguous - could be from multiple traits
let value = self.storage_var.read();

// Disambiguated with explicit trait import
use starknet::storage::StoragePointerReadAccess;
let value = self.storage_var.read();
```

2. **`.append()`, `.at()`, `.len()` on Vec:**
```cairo
// Import VecTrait explicitly
use starknet::storage::VecTrait;

// Then use methods
self.my_vec.append().write(value);
let item = self.my_vec.at(index).read();
let length = self.my_vec.len();
```

3. **`.entry()` on Map:**
```cairo
// Import StoragePathEntry for .entry()
use starknet::storage::StoragePathEntry;

// Then use
let value = self.my_map.entry(key).read();
```

**Files Affected:**
- All contract files using storage operations

### Component 5: Zero Address Modernizer

**Problem:** `contract_address_const::<0>()` is deprecated

**Old Pattern:**
```cairo
core_address: starknet::contract_address_const::<0>(),
```

**New Pattern:**
```cairo
use core::num::traits::Zero;

core_address: Zero::zero(),
```

**Files Affected:**
- `src/factory/ajo_factory.cairo` - Initializes 6 address fields to zero

### Component 6: Interface Method Aligner

**Problem:** Dispatcher traits reference methods that don't exist in interface definitions

**Analysis Required:**
1. Find all dispatcher calls in contracts
2. Check corresponding interface files for method definitions
3. Add missing method signatures to interfaces

**Likely Missing Methods:**
- `IAjoMembers::get_member_count()` - Called in governance
- `IAjoMembers::get_total_members()` - Called in core
- `IAjoPayments::get_cycle_start_time()` - Called in core
- `IAjoPayments::get_next_payout_position()` - Called in core

**Files to Check:**
- `src/interfaces/i_ajo_members.cairo`
- `src/interfaces/i_ajo_collateral.cairo`
- `src/interfaces/i_ajo_payments.cairo`

### Component 7: Enum Storage Handler

**Problem:** Enums stored in contract storage need either a default variant or `#[allow]` attribute

**Affected Enums:**
- `PaymentToken` (USDC, BTC)
- `MemberStatus` (Active, Defaulted, Completed, Removed)
- `ProposalStatus` (Active, Executed, Cancelled, etc.)

**Solution Options:**

**Option A: Add default variant**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum MemberStatus {
    #[default]
    Active,
    Defaulted,
    Completed,
    Removed,
}
```

**Option B: Use allow attribute**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
#[allow(enum_storage)]
pub enum MemberStatus {
    Active,
    Defaulted,
    Completed,
    Removed,
}
```

**Recommendation:** Use Option A (default variant) for enums with a clear default state (Active for MemberStatus), and Option B for enums without a clear default.

**Files Affected:**
- `src/interfaces/types.cairo` - PaymentToken, MemberStatus
- `src/interfaces/i_ajo_governance.cairo` - ProposalStatus

## Data Models

### Error Tracking Model

```cairo
struct ErrorFix {
    category: ErrorCategory,
    file: felt252,
    line: u32,
    description: felt252,
    fix_applied: bool,
}

enum ErrorCategory {
    Syntax,
    StorageAPI,
    TraitImport,
    Ambiguous,
    Interface,
    Deprecated,
    EnumStorage,
}
```

### Fix Verification Model

```cairo
struct VerificationResult {
    total_errors_before: u32,
    total_errors_after: u32,
    errors_fixed: u32,
    new_errors_introduced: u32,
    build_successful: bool,
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Collateral Formula Preservation

*For any* position n (where 1 ≤ n ≤ total_participants) and any monthly contribution amount, the required collateral SHALL equal exactly 60% of the debt, where debt = (monthly_contribution × total_participants) - (n × monthly_contribution).

**Validates: Requirements 8.1**

### Property 2: Guarantor Network Logic Preservation

*For any* member position n and any total_participants value, the guarantor position SHALL be calculated as ((n - 1 + (total_participants / 2)) % total_participants) + 1, maintaining the circular offset pattern.

**Validates: Requirements 8.2**

### Property 3: Access Control Preservation

*For any* restricted function (owner-only, member-only, etc.) and any caller address, the function SHALL revert when called by an unauthorized address and SHALL succeed when called by an authorized address, maintaining the same access control behavior as before the fixes.

**Validates: Requirements 8.5**

## Error Handling

### Build Error Handling

**Strategy:** Fix errors in priority order (syntax → storage → traits → interfaces → deprecation)

**Error Recovery:**
- If a fix introduces new errors, revert the change and try an alternative approach
- Track error count after each fix to ensure monotonic decrease
- Use `scarb build` output parsing to identify remaining errors

### Compilation Verification

After each category of fixes:
1. Run `scarb build`
2. Parse output for error count
3. Verify error count decreased
4. If new errors appeared, analyze and fix
5. Commit fixes only when error count decreases

### Functional Verification

After all fixes:
1. Run existing test suite with `scarb test`
2. Verify tests compile (even if some fail)
3. Manually verify critical functions:
   - Collateral calculation
   - Guarantor position calculation
   - Access control checks
   - Event emissions

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure correctness:

**Unit Tests** - Verify specific examples and edge cases:
- Test that `scarb build` succeeds (exit code 0)
- Test that all 6 contracts produce CASM output
- Test that `scarb test` compiles successfully
- Test specific function behavior (execute_proposal, zero addresses, enum storage)
- Test the 5-phase factory deployment sequence
- Test event emissions with expected parameters

**Property-Based Tests** - Verify universal properties:
- Test collateral formula for all valid positions and contribution amounts
- Test guarantor position calculation for all valid positions and participant counts
- Test access control for all restricted functions with random authorized/unauthorized callers

### Property-Based Testing Configuration

**Library:** Use `proptest` or similar property-based testing library for Cairo/Rust

**Test Configuration:**
- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: **Feature: fix-cairo-build-errors, Property {number}: {property_text}**

### Unit Testing Balance

- Focus unit tests on:
  - Build success verification (run `scarb build`, check exit code)
  - Test compilation verification (run `scarb test --build-only`)
  - Specific examples of fixed functionality (execute_proposal works, zero addresses work)
  - Integration points (5-phase deployment, event emissions)
  
- Avoid excessive unit tests for:
  - Every possible position/contribution combination (use property tests instead)
  - Every possible access control scenario (use property tests instead)

### Test Execution Strategy

1. **Pre-fix baseline:** Run `scarb build` and record error count (should be 73)
2. **After each fix category:** Run `scarb build` and verify error count decreased
3. **Post-fix verification:** Run `scarb build` and verify 0 errors
4. **Test compilation:** Run `scarb test` and verify tests compile
5. **Property tests:** Run property-based tests for collateral, guarantor, access control
6. **Integration tests:** Run existing integration tests to verify end-to-end functionality

### Critical Test Cases

**Example Test 1: Build Success**
```cairo
#[test]
fn test_build_succeeds() {
    // Run: scarb build
    // Assert: exit code == 0
    // Assert: error count == 0
    // Assert: CASM files exist for all 6 contracts
}
```

**Example Test 2: Execute Proposal Still Works**
```cairo
#[test]
fn test_execute_proposal_after_syntax_fix() {
    // Create a proposal
    // Vote on it
    // Execute it
    // Assert: proposal status == Executed
    // Assert: ProposalExecuted event emitted
}
```

**Example Test 3: Zero Addresses Work**
```cairo
#[test]
fn test_zero_address_behavior_preserved() {
    // Create AjoInfo with Zero::zero() addresses
    // Assert: addresses are zero
    // Assert: is_zero() returns true
    // Assert: behavior matches old contract_address_const::<0>()
}
```

**Property Test 1: Collateral Formula**
```cairo
// Feature: fix-cairo-build-errors, Property 1: Collateral Formula Preservation
#[test]
fn prop_collateral_formula_preserved(position: u256, monthly_contribution: u256, total_participants: u256) {
    // Assume: 1 <= position <= total_participants
    // Assume: monthly_contribution > 0
    // Assume: 2 <= total_participants <= 100
    
    let debt = (monthly_contribution * total_participants) - (position * monthly_contribution);
    let expected_collateral = (debt * 60) / 100;
    let actual_collateral = calculate_required_collateral(position, monthly_contribution, total_participants);
    
    assert_eq!(actual_collateral, expected_collateral);
}
```

**Property Test 2: Guarantor Position**
```cairo
// Feature: fix-cairo-build-errors, Property 2: Guarantor Network Logic Preservation
#[test]
fn prop_guarantor_position_preserved(position: u256, total_participants: u256) {
    // Assume: 1 <= position <= total_participants
    // Assume: 2 <= total_participants <= 100
    
    let offset = total_participants / 2;
    let expected_guarantor = ((position - 1 + offset) % total_participants) + 1;
    let actual_guarantor = calculate_guarantor_position(position, total_participants);
    
    assert_eq!(actual_guarantor, expected_guarantor);
}
```

**Property Test 3: Access Control**
```cairo
// Feature: fix-cairo-build-errors, Property 3: Access Control Preservation
#[test]
fn prop_access_control_preserved(caller: ContractAddress, is_authorized: bool) {
    // For owner-only functions
    if is_authorized {
        // Should succeed
        assert!(call_owner_function(caller).is_ok());
    } else {
        // Should revert
        assert!(call_owner_function(caller).is_err());
    }
}
```

## Implementation Notes

### Fix Order Rationale

1. **Syntax errors first** - Must fix to enable parsing
2. **Storage API** - High impact, affects multiple files
3. **Trait imports** - Enables method resolution
4. **Disambiguation** - Resolves remaining ambiguities
5. **Interfaces** - Enables dispatcher calls
6. **Deprecation** - Low risk, modernizes code

### Risk Mitigation

**Risk:** Introducing new errors while fixing old ones
**Mitigation:** Fix one category at a time, verify build after each

**Risk:** Breaking contract functionality
**Mitigation:** Run property tests after fixes to verify formulas preserved

**Risk:** Breaking test suite
**Mitigation:** Verify test compilation after all fixes

### Success Criteria

- `scarb build` exits with code 0
- All 6 contracts produce CASM output
- Error count reduced from 73 to 0
- `scarb test` compiles successfully
- Property tests pass for collateral, guarantor, access control
- Existing integration tests still compile

## File-by-File Fix Summary

### ajo_governance.cairo
- Fix duplicate `fn` keyword (line 309)
- Add `Zero` trait import
- Add `StorageMapReadAccess`, `StorageMapWriteAccess` imports

### ajo_factory.cairo
- Replace `.entry().append()` with `.append()` for Vec storage
- Replace `contract_address_const::<0>()` with `Zero::zero()` (6 occurrences)
- Add `Zero` trait import
- Add `SyscallResultTrait` import for `unwrap_syscall()`
- Add storage trait imports

### ajo_core.cairo
- Add `Zero` trait import for `is_zero()` checks
- Add storage trait imports
- Verify dispatcher method calls match interfaces

### ajo_members.cairo
- Replace `.append()` pattern for Vec storage
- Add `Zero` trait import (already present)
- Add storage trait imports

### ajo_collateral.cairo
- Add storage trait imports
- Verify no deprecated patterns

### ajo_payments.cairo
- Add storage trait imports
- Verify dispatcher method calls

### types.cairo
- Add `#[default]` attribute to `MemberStatus::Active`
- Add `#[default]` attribute to `PaymentToken::USDC`

### i_ajo_governance.cairo
- Add `#[default]` attribute to `ProposalStatus::Active` or use `#[allow(enum_storage)]`

### Interface files (i_ajo_*.cairo)
- Add missing method signatures referenced by dispatchers
- Verify all dispatcher calls have matching interface methods
