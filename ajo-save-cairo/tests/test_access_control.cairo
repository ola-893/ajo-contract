// Access Control Tests for AJO.SAVE Cairo Translation
// Tests security requirements for owner-only, member-only, and AjoCore-only functions
// Validates: Requirements 2.3.1

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait
};
use starknet::{ContractAddress, ClassHash, contract_address_const};
use ajo_save::factory::ajo_factory::{IAjoFactoryDispatcher, IAjoFactoryDispatcherTrait};
use ajo_save::core::ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
use ajo_save::members::ajo_members::{IAjoMembersDispatcher, IAjoMembersDispatcherTrait};
use ajo_save::collateral::ajo_collateral::{
    IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait
};
use ajo_save::payments::ajo_payments::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};
use ajo_save::governance::ajo_governance::{
    IAjoGovernanceDispatcher, IAjoGovernanceDispatcherTrait
};
use ajo_save::schedule::ajo_schedule::{IAjoScheduleDispatcher, IAjoScheduleDispatcherTrait};
use ajo_save::interfaces::types::{AjoConfig, ProposalType};

// ============================================================================
// Test Addresses
// ============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn NON_OWNER() -> ContractAddress {
    contract_address_const::<'non_owner'>()
}

fn MEMBER() -> ContractAddress {
    contract_address_const::<'member'>()
}

fn NON_MEMBER() -> ContractAddress {
    contract_address_const::<'non_member'>()
}

fn AJO_CORE() -> ContractAddress {
    contract_address_const::<'ajo_core'>()
}

fn NON_AJO_CORE() -> ContractAddress {
    contract_address_const::<'non_ajo_core'>()
}

// ============================================================================
// Factory Access Control Tests
// ============================================================================

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_set_core_class_hash() {
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    // Try to set class hash as non-owner (should fail)
    let dummy_class_hash: ClassHash = 123.try_into().unwrap();
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.set_core_class_hash(dummy_class_hash);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_set_members_class_hash() {
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    let dummy_class_hash: ClassHash = 123.try_into().unwrap();
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.set_members_class_hash(dummy_class_hash);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_set_collateral_class_hash() {
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    let dummy_class_hash: ClassHash = 123.try_into().unwrap();
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.set_collateral_class_hash(dummy_class_hash);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_set_payments_class_hash() {
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    let dummy_class_hash: ClassHash = 123.try_into().unwrap();
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.set_payments_class_hash(dummy_class_hash);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_set_governance_class_hash() {
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    let dummy_class_hash: ClassHash = 123.try_into().unwrap();
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.set_governance_class_hash(dummy_class_hash);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_set_schedule_class_hash() {
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    let dummy_class_hash: ClassHash = 123.try_into().unwrap();
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.set_schedule_class_hash(dummy_class_hash);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_pause() {
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.pause();
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_factory_non_owner_cannot_unpause() {
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    // First pause as owner
    start_cheat_caller_address(factory_address, OWNER());
    factory.pause();
    stop_cheat_caller_address(factory_address);
    
    // Try to unpause as non-owner (should fail)
    start_cheat_caller_address(factory_address, NON_OWNER());
    factory.unpause();
}

// ============================================================================
// AjoCore Access Control Tests
// ============================================================================

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_core_non_owner_cannot_start_ajo() {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let mut calldata = array![];
    
    let (core_address, _) = core_class.deploy(@calldata).unwrap();
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Initialize with owner
    let config = AjoConfig {
        ajo_id: 1,
        name: "Test Ajo",
        monthly_contribution: 50_000000,
        total_participants: 10,
        cycle_duration: 2592000, // 30 days
        payment_token: contract_address_const::<'token'>(),
    };
    
    start_cheat_caller_address(core_address, OWNER());
    core.initialize(
        config,
        contract_address_const::<'members'>(),
        contract_address_const::<'collateral'>(),
        contract_address_const::<'payments'>(),
        contract_address_const::<'governance'>(),
        contract_address_const::<'schedule'>()
    );
    stop_cheat_caller_address(core_address);
    
    // Try to start as non-owner (should fail)
    start_cheat_caller_address(core_address, NON_OWNER());
    core.start_ajo();
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_core_non_owner_cannot_handle_default() {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let mut calldata = array![];
    
    let (core_address, _) = core_class.deploy(@calldata).unwrap();
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Initialize with owner
    let config = AjoConfig {
        ajo_id: 1,
        name: "Test Ajo",
        monthly_contribution: 50_000000,
        total_participants: 10,
        cycle_duration: 2592000,
        payment_token: contract_address_const::<'token'>(),
    };
    
    start_cheat_caller_address(core_address, OWNER());
    core.initialize(
        config,
        contract_address_const::<'members'>(),
        contract_address_const::<'collateral'>(),
        contract_address_const::<'payments'>(),
        contract_address_const::<'governance'>(),
        contract_address_const::<'schedule'>()
    );
    stop_cheat_caller_address(core_address);
    
    // Try to handle default as non-owner (should fail)
    start_cheat_caller_address(core_address, NON_OWNER());
    core.handle_default(MEMBER());
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_core_non_owner_cannot_pause() {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let mut calldata = array![];
    
    let (core_address, _) = core_class.deploy(@calldata).unwrap();
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Initialize with owner
    let config = AjoConfig {
        ajo_id: 1,
        name: "Test Ajo",
        monthly_contribution: 50_000000,
        total_participants: 10,
        cycle_duration: 2592000,
        payment_token: contract_address_const::<'token'>(),
    };
    
    start_cheat_caller_address(core_address, OWNER());
    core.initialize(
        config,
        contract_address_const::<'members'>(),
        contract_address_const::<'collateral'>(),
        contract_address_const::<'payments'>(),
        contract_address_const::<'governance'>(),
        contract_address_const::<'schedule'>()
    );
    stop_cheat_caller_address(core_address);
    
    // Try to pause as non-owner (should fail)
    start_cheat_caller_address(core_address, NON_OWNER());
    core.pause();
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_core_non_owner_cannot_unpause() {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let mut calldata = array![];
    
    let (core_address, _) = core_class.deploy(@calldata).unwrap();
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Initialize with owner
    let config = AjoConfig {
        ajo_id: 1,
        name: "Test Ajo",
        monthly_contribution: 50_000000,
        total_participants: 10,
        cycle_duration: 2592000,
        payment_token: contract_address_const::<'token'>(),
    };
    
    start_cheat_caller_address(core_address, OWNER());
    core.initialize(
        config,
        contract_address_const::<'members'>(),
        contract_address_const::<'collateral'>(),
        contract_address_const::<'payments'>(),
        contract_address_const::<'governance'>(),
        contract_address_const::<'schedule'>()
    );
    
    // Pause as owner
    core.pause();
    stop_cheat_caller_address(core_address);
    
    // Try to unpause as non-owner (should fail)
    start_cheat_caller_address(core_address, NON_OWNER());
    core.unpause();
}

#[test]
#[should_panic(expected: ('Caller is not a member',))]
fn test_core_non_member_cannot_process_payment() {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let mut calldata = array![];
    
    let (core_address, _) = core_class.deploy(@calldata).unwrap();
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Initialize with owner
    let config = AjoConfig {
        ajo_id: 1,
        name: "Test Ajo",
        monthly_contribution: 50_000000,
        total_participants: 10,
        cycle_duration: 2592000,
        payment_token: contract_address_const::<'token'>(),
    };
    
    start_cheat_caller_address(core_address, OWNER());
    core.initialize(
        config,
        contract_address_const::<'members'>(),
        contract_address_const::<'collateral'>(),
        contract_address_const::<'payments'>(),
        contract_address_const::<'governance'>(),
        contract_address_const::<'schedule'>()
    );
    core.start_ajo();
    stop_cheat_caller_address(core_address);
    
    // Try to process payment as non-member (should fail)
    start_cheat_caller_address(core_address, NON_MEMBER());
    core.process_payment();
}

#[test]
#[should_panic(expected: ('Caller is not a member',))]
fn test_core_non_member_cannot_exit_ajo() {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let mut calldata = array![];
    
    let (core_address, _) = core_class.deploy(@calldata).unwrap();
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Initialize with owner
    let config = AjoConfig {
        ajo_id: 1,
        name: "Test Ajo",
        monthly_contribution: 50_000000,
        total_participants: 10,
        cycle_duration: 2592000,
        payment_token: contract_address_const::<'token'>(),
    };
    
    start_cheat_caller_address(core_address, OWNER());
    core.initialize(
        config,
        contract_address_const::<'members'>(),
        contract_address_const::<'collateral'>(),
        contract_address_const::<'payments'>(),
        contract_address_const::<'governance'>(),
        contract_address_const::<'schedule'>()
    );
    stop_cheat_caller_address(core_address);
    
    // Try to exit as non-member (should fail)
    start_cheat_caller_address(core_address, NON_MEMBER());
    core.exit_ajo();
}

// ============================================================================
// AjoMembers Access Control Tests (AjoCore-only functions)
// ============================================================================

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_members_non_core_cannot_add_member() {
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata); // Owner is AjoCore
    10_u256.serialize(ref calldata); // total_participants
    
    let (members_address, _) = members_class.deploy(@calldata).unwrap();
    let members = IAjoMembersDispatcher { contract_address: members_address };
    
    // Try to add member as non-AjoCore (should fail)
    start_cheat_caller_address(members_address, NON_AJO_CORE());
    members.add_member(MEMBER(), 1);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_members_non_core_cannot_update_status() {
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata);
    10_u256.serialize(ref calldata);
    
    let (members_address, _) = members_class.deploy(@calldata).unwrap();
    let members = IAjoMembersDispatcher { contract_address: members_address };
    
    // First add a member as AjoCore
    start_cheat_caller_address(members_address, AJO_CORE());
    members.add_member(MEMBER(), 1);
    stop_cheat_caller_address(members_address);
    
    // Try to update status as non-AjoCore (should fail)
    start_cheat_caller_address(members_address, NON_AJO_CORE());
    members.update_member_status(MEMBER(), 0); // 0 = Inactive
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_members_non_core_cannot_mark_payout_received() {
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata);
    10_u256.serialize(ref calldata);
    
    let (members_address, _) = members_class.deploy(@calldata).unwrap();
    let members = IAjoMembersDispatcher { contract_address: members_address };
    
    // First add a member as AjoCore
    start_cheat_caller_address(members_address, AJO_CORE());
    members.add_member(MEMBER(), 1);
    stop_cheat_caller_address(members_address);
    
    // Try to mark payout received as non-AjoCore (should fail)
    start_cheat_caller_address(members_address, NON_AJO_CORE());
    members.mark_payout_received(MEMBER());
}

// ============================================================================
// AjoCollateral Access Control Tests (AjoCore-only functions)
// ============================================================================

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_collateral_non_core_cannot_seize_collateral() {
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata); // Owner is AjoCore
    50_000000_u256.serialize(ref calldata); // monthly_contribution
    10_u256.serialize(ref calldata); // total_participants
    contract_address_const::<'token'>().serialize(ref calldata); // payment_token
    
    let (collateral_address, _) = collateral_class.deploy(@calldata).unwrap();
    let collateral = IAjoCollateralDispatcher { contract_address: collateral_address };
    
    // Try to seize collateral as non-AjoCore (should fail)
    start_cheat_caller_address(collateral_address, NON_AJO_CORE());
    collateral.seize_collateral(MEMBER());
}

// ============================================================================
// AjoPayments Access Control Tests (AjoCore-only functions)
// ============================================================================

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_payments_non_core_cannot_advance_cycle() {
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata); // Owner is AjoCore
    50_000000_u256.serialize(ref calldata); // monthly_contribution
    10_u256.serialize(ref calldata); // total_participants
    2592000_u64.serialize(ref calldata); // cycle_duration
    contract_address_const::<'token'>().serialize(ref calldata); // payment_token
    contract_address_const::<'members'>().serialize(ref calldata); // members_contract
    
    let (payments_address, _) = payments_class.deploy(@calldata).unwrap();
    let payments = IAjoPaymentsDispatcher { contract_address: payments_address };
    
    // Try to advance cycle as non-AjoCore (should fail)
    start_cheat_caller_address(payments_address, NON_AJO_CORE());
    payments.advance_cycle();
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_payments_non_core_cannot_seize_past_payments() {
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata);
    50_000000_u256.serialize(ref calldata);
    10_u256.serialize(ref calldata);
    2592000_u64.serialize(ref calldata);
    contract_address_const::<'token'>().serialize(ref calldata);
    contract_address_const::<'members'>().serialize(ref calldata);
    
    let (payments_address, _) = payments_class.deploy(@calldata).unwrap();
    let payments = IAjoPaymentsDispatcher { contract_address: payments_address };
    
    // Try to seize past payments as non-AjoCore (should fail)
    start_cheat_caller_address(payments_address, NON_AJO_CORE());
    payments.seize_past_payments(MEMBER());
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_payments_non_core_cannot_start_cycle() {
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata);
    50_000000_u256.serialize(ref calldata);
    10_u256.serialize(ref calldata);
    2592000_u64.serialize(ref calldata);
    contract_address_const::<'token'>().serialize(ref calldata);
    contract_address_const::<'members'>().serialize(ref calldata);
    
    let (payments_address, _) = payments_class.deploy(@calldata).unwrap();
    let payments = IAjoPaymentsDispatcher { contract_address: payments_address };
    
    // Try to start cycle as non-AjoCore (should fail)
    start_cheat_caller_address(payments_address, NON_AJO_CORE());
    payments.start_cycle(1);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_payments_non_core_cannot_end_cycle() {
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata);
    50_000000_u256.serialize(ref calldata);
    10_u256.serialize(ref calldata);
    2592000_u64.serialize(ref calldata);
    contract_address_const::<'token'>().serialize(ref calldata);
    contract_address_const::<'members'>().serialize(ref calldata);
    
    let (payments_address, _) = payments_class.deploy(@calldata).unwrap();
    let payments = IAjoPaymentsDispatcher { contract_address: payments_address };
    
    // Start cycle as AjoCore first
    start_cheat_caller_address(payments_address, AJO_CORE());
    payments.start_cycle(1);
    stop_cheat_caller_address(payments_address);
    
    // Try to end cycle as non-AjoCore (should fail)
    start_cheat_caller_address(payments_address, NON_AJO_CORE());
    payments.end_cycle(1);
}

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_payments_non_core_cannot_mark_default() {
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let mut calldata = array![];
    AJO_CORE().serialize(ref calldata);
    50_000000_u256.serialize(ref calldata);
    10_u256.serialize(ref calldata);
    2592000_u64.serialize(ref calldata);
    contract_address_const::<'token'>().serialize(ref calldata);
    contract_address_const::<'members'>().serialize(ref calldata);
    
    let (payments_address, _) = payments_class.deploy(@calldata).unwrap();
    let payments = IAjoPaymentsDispatcher { contract_address: payments_address };
    
    // Try to mark default as non-AjoCore (should fail)
    start_cheat_caller_address(payments_address, NON_AJO_CORE());
    payments.mark_default(MEMBER(), 1);
}

// ============================================================================
// AjoGovernance Access Control Tests (Member-only functions)
// ============================================================================

#[test]
#[should_panic(expected: ('Caller is not a member',))]
fn test_governance_non_member_cannot_create_proposal() {
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    86400_u64.serialize(ref calldata); // voting_period
    51_u256.serialize(ref calldata); // quorum_percentage
    contract_address_const::<'members'>().serialize(ref calldata); // members_contract
    
    let (governance_address, _) = governance_class.deploy(@calldata).unwrap();
    let governance = IAjoGovernanceDispatcher { contract_address: governance_address };
    
    // Try to create proposal as non-member (should fail)
    start_cheat_caller_address(governance_address, NON_MEMBER());
    governance.create_proposal(
        "Change monthly payment",
        ProposalType::ChangeMonthlyPayment,
        array![75_000000].span() // New amount
    );
}

#[test]
#[should_panic(expected: ('Caller is not a member',))]
fn test_governance_non_member_cannot_cast_vote() {
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    86400_u64.serialize(ref calldata);
    51_u256.serialize(ref calldata);
    contract_address_const::<'members'>().serialize(ref calldata);
    
    let (governance_address, _) = governance_class.deploy(@calldata).unwrap();
    let governance = IAjoGovernanceDispatcher { contract_address: governance_address };
    
    // Try to cast vote as non-member (should fail)
    start_cheat_caller_address(governance_address, NON_MEMBER());
    governance.cast_vote(1, 1); // proposal_id=1, support=1 (yes)
}

// ============================================================================
// AjoSchedule Access Control Tests (Owner-only functions)
// ============================================================================

#[test]
#[should_panic(expected: ('Caller is not the owner',))]
fn test_schedule_non_owner_cannot_cancel_task() {
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    contract_address_const::<'core'>().serialize(ref calldata); // core_contract
    
    let (schedule_address, _) = schedule_class.deploy(@calldata).unwrap();
    let schedule = IAjoScheduleDispatcher { contract_address: schedule_address };
    
    // Try to cancel task as non-owner (should fail)
    start_cheat_caller_address(schedule_address, NON_OWNER());
    schedule.cancel_task(1);
}
