// Event Emission Tests for AJO.SAVE Cairo Translation
// Tests that critical events are emitted with correct parameters
// Validates: Requirements 8.4

use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, spy_events, EventSpyAssertionsTrait
};
use starknet::{ContractAddress, ClassHash, contract_address_const};
use core::num::traits::Zero;

use ajo_save::factory::ajo_factory::{
    IAjoFactoryDispatcher, IAjoFactoryDispatcherTrait, AjoFactory
};
use ajo_save::core::ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait, AjoCore};
use ajo_save::members::ajo_members::{IAjoMembersDispatcher, IAjoMembersDispatcherTrait};
use ajo_save::collateral::ajo_collateral::{IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait};
use ajo_save::payments::ajo_payments::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};
use ajo_save::governance::ajo_governance::{IAjoGovernanceDispatcher, IAjoGovernanceDispatcherTrait};
use ajo_save::schedule::ajo_schedule::{IAjoScheduleDispatcher, IAjoScheduleDispatcherTrait};
use ajo_save::interfaces::types::AjoConfig;

// ============================================================================
// Test Constants
// ============================================================================

const MONTHLY_CONTRIBUTION: u256 = 50_000000; // $50 with 6 decimals
const TOTAL_PARTICIPANTS: u256 = 10;
const CYCLE_DURATION: u64 = 2592000; // 30 days in seconds

fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn CREATOR() -> ContractAddress {
    contract_address_const::<'creator'>()
}

fn MEMBER1() -> ContractAddress {
    contract_address_const::<'member1'>()
}

fn MEMBER2() -> ContractAddress {
    contract_address_const::<'member2'>()
}

// ============================================================================
// AjoCreated Event Tests
// ============================================================================

/// **Validates: Requirements 8.4**
/// 
/// Test that AjoCreated event is emitted when creating a new Ajo
/// Verifies all event parameters match expected values
#[test]
fn test_ajo_created_event_emission() {
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut calldata = array![];
    OWNER().serialize(ref calldata);
    
    let (factory_address, _) = factory_class.deploy(@calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    // Set up class hashes (required for factory to work)
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
    start_cheat_caller_address(factory_address, OWNER());
    factory.set_core_class_hash(*core_class.class_hash);
    factory.set_members_class_hash(*members_class.class_hash);
    factory.set_collateral_class_hash(*collateral_class.class_hash);
    factory.set_payments_class_hash(*payments_class.class_hash);
    factory.set_governance_class_hash(*governance_class.class_hash);
    factory.set_schedule_class_hash(*schedule_class.class_hash);
    stop_cheat_caller_address(factory_address);
    
    // Deploy mock token using simple approach
    let token_address = contract_address_const::<'TOKEN'>();
    
    // Spy on events
    let mut spy = spy_events();
    
    // Create Ajo as creator
    let ajo_name: felt252 = 'Test Ajo';
    start_cheat_caller_address(factory_address, CREATOR());
    let ajo_id = factory.create_ajo(
        ajo_name,
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        token_address
    );
    stop_cheat_caller_address(factory_address);
    
    // Verify AjoCreated event was emitted with correct parameters
    spy.assert_emitted(
        @array![
            (
                factory_address,
                AjoFactory::Event::AjoCreated(
                    AjoFactory::AjoCreated {
                        ajo_id: ajo_id,
                        creator: CREATOR(),
                        name: ajo_name,
                        monthly_contribution: MONTHLY_CONTRIBUTION,
                        total_participants: TOTAL_PARTICIPANTS,
                    }
                )
            )
        ]
    );
}

// ============================================================================
// MemberJoined Event Tests
// ============================================================================

/// **Validates: Requirements 8.4**
/// 
/// Test that MemberJoined event is emitted when a member joins an Ajo
/// Verifies all event parameters match expected values
/// 
/// Note: This test requires a full Ajo deployment with token minting.
/// The MemberJoined event is emitted by AjoCore.join_ajo() and includes:
/// - ajo_id: The ID of the Ajo
/// - member: The address of the joining member
/// - position: The assigned position in the Ajo
/// - collateral_amount: The amount of collateral deposited
/// - guarantor: The address of the member's guarantor
#[test]
#[ignore]
fn test_member_joined_event_emission() {
    // TODO: Implement full test when mock token deployment is available
    // This test would:
    // 1. Deploy AjoCore with all module contracts
    // 2. Deploy and mint mock ERC20 tokens
    // 3. Start the Ajo
    // 4. Have a member join with collateral
    // 5. Verify MemberJoined event with correct parameters
    assert(true, 'Placeholder test');
}

// ============================================================================
// PaymentProcessed Event Tests
// ============================================================================

/// **Validates: Requirements 8.4**
/// 
/// Test that PaymentProcessed event is emitted when a member makes a payment
/// Verifies all event parameters match expected values
/// 
/// Note: This test requires a full Ajo deployment with members and tokens.
/// The PaymentProcessed event is emitted by AjoCore.process_payment() and includes:
/// - ajo_id: The ID of the Ajo
/// - member: The address of the paying member
/// - cycle: The current cycle number
/// - amount: The payment amount (monthly contribution)
/// - all_paid: Boolean indicating if all members have paid for this cycle
#[test]
#[ignore]
fn test_payment_processed_event_emission() {
    // TODO: Implement full test when mock token deployment is available
    // This test would:
    // 1. Deploy AjoCore with all module contracts
    // 2. Deploy and mint mock ERC20 tokens
    // 3. Start the Ajo and have members join
    // 4. Have a member process a payment
    // 5. Verify PaymentProcessed event with correct parameters
    assert(true, 'Placeholder test');
}

