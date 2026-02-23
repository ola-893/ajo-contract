// Integration test for factory deployment
// Tests 5-phase initialization process
// Validates: Requirements 2.1.1

use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address};
use starknet::{ContractAddress, ClassHash};
use ajo_save::factory::ajo_factory::IAjoFactoryDispatcher;
use ajo_save::factory::ajo_factory::IAjoFactoryDispatcherTrait;
use ajo_save::interfaces::types::PaymentToken;
use ajo_save_tests::utils::constants::{
    MONTHLY_CONTRIBUTION, TOTAL_PARTICIPANTS, CYCLE_DURATION, ADMIN
};

/// Test Phase 1: Create Ajo with valid configuration
#[test]
fn test_phase_1_create_ajo() {
    // Declare all contract classes
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut factory_calldata = array![];
    ADMIN().serialize(ref factory_calldata);
    (*core_class.class_hash).serialize(ref factory_calldata);
    (*members_class.class_hash).serialize(ref factory_calldata);
    (*collateral_class.class_hash).serialize(ref factory_calldata);
    (*payments_class.class_hash).serialize(ref factory_calldata);
    (*governance_class.class_hash).serialize(ref factory_calldata);
    (*schedule_class.class_hash).serialize(ref factory_calldata);
    
    let (factory_address, _) = factory_class.deploy(@factory_calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    // Create Ajo
    start_cheat_caller_address(factory_address, ADMIN());
    let ajo_id = factory.create_ajo(
        'TestAjo',
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    
    // Verify Ajo was created
    assert(ajo_id == 1, 'Ajo ID should be 1');
    
    // Verify Ajo info
    let ajo_info = factory.get_ajo_info(ajo_id);
    assert(ajo_info.id == ajo_id, 'Ajo ID mismatch');
    assert(ajo_info.config.name == 'TestAjo', 'Ajo name mismatch');
    assert(ajo_info.config.monthly_contribution == MONTHLY_CONTRIBUTION, 'Monthly contribution mismatch');
    assert(ajo_info.config.total_participants == TOTAL_PARTICIPANTS, 'Total participants mismatch');
    assert(ajo_info.config.cycle_duration == CYCLE_DURATION, 'Cycle duration mismatch');
    assert(ajo_info.config.creator == ADMIN(), 'Creator mismatch');
    assert(!ajo_info.is_initialized, 'Should not be initialized');
    
    // Verify all module addresses are zero (not deployed yet)
    let zero_address: ContractAddress = starknet::contract_address_const::<0>();
    assert(ajo_info.core_address == zero_address, 'Core should be zero');
    assert(ajo_info.members_address == zero_address, 'Members should be zero');
    assert(ajo_info.collateral_address == zero_address, 'Collateral should be zero');
    assert(ajo_info.payments_address == zero_address, 'Payments should be zero');
    assert(ajo_info.governance_address == zero_address, 'Governance should be zero');
    assert(ajo_info.schedule_address == zero_address, 'Schedule should be zero');
    
    // Verify factory registry
    assert(factory.get_total_ajos() == 1, 'Total ajos should be 1');
    
    // Verify user_ajos mapping
    let user_ajos = factory.get_user_ajos(ADMIN());
    assert(user_ajos.len() == 1, 'User should have 1 ajo');
    assert(*user_ajos.at(0) == ajo_id, 'User ajo ID mismatch');
}

/// Test complete 5-phase initialization process
/// **Validates: Requirements 2.1.1**
#[test]
fn test_complete_5_phase_initialization() {
    // Declare all contract classes
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut factory_calldata = array![];
    ADMIN().serialize(ref factory_calldata);
    (*core_class.class_hash).serialize(ref factory_calldata);
    (*members_class.class_hash).serialize(ref factory_calldata);
    (*collateral_class.class_hash).serialize(ref factory_calldata);
    (*payments_class.class_hash).serialize(ref factory_calldata);
    (*governance_class.class_hash).serialize(ref factory_calldata);
    (*schedule_class.class_hash).serialize(ref factory_calldata);
    
    let (factory_address, _) = factory_class.deploy(@factory_calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    start_cheat_caller_address(factory_address, ADMIN());
    
    // Phase 1: Create Ajo with valid configuration
    let ajo_id = factory.create_ajo(
        'TestAjo',
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    assert(ajo_id == 1, 'Ajo ID should be 1');
    
    // Verify Phase 1 completed correctly
    let ajo_info_phase1 = factory.get_ajo_info(ajo_id);
    assert(!ajo_info_phase1.is_initialized, 'Should not be initialized yet');
    let zero_address: ContractAddress = starknet::contract_address_const::<0>();
    assert(ajo_info_phase1.core_address == zero_address, 'Core should be zero');
    
    // Phase 2: Deploy core orchestration contract
    let core_address = factory.deploy_core(ajo_id);
    assert(core_address.is_non_zero(), 'Core not deployed');
    
    // Verify Phase 2 completed correctly
    let ajo_info_phase2 = factory.get_ajo_info(ajo_id);
    assert(ajo_info_phase2.core_address == core_address, 'Core address not updated');
    assert(ajo_info_phase2.members_address == zero_address, 'Members should still be zero');
    
    // Phase 3: Deploy members management contract
    let members_address = factory.deploy_members(ajo_id);
    assert(members_address.is_non_zero(), 'Members not deployed');
    
    // Verify Phase 3 completed correctly
    let ajo_info_phase3 = factory.get_ajo_info(ajo_id);
    assert(ajo_info_phase3.members_address == members_address, 'Members address not updated');
    assert(ajo_info_phase3.collateral_address == zero_address, 'Collateral should still be zero');
    
    // Phase 4: Deploy collateral and payments contracts
    let (collateral_address, payments_address) = factory.deploy_collateral_and_payments(ajo_id);
    assert(collateral_address.is_non_zero(), 'Collateral not deployed');
    assert(payments_address.is_non_zero(), 'Payments not deployed');
    
    // Verify Phase 4 completed correctly
    let ajo_info_phase4 = factory.get_ajo_info(ajo_id);
    assert(ajo_info_phase4.collateral_address == collateral_address, 'Collateral address not updated');
    assert(ajo_info_phase4.payments_address == payments_address, 'Payments address not updated');
    assert(ajo_info_phase4.governance_address == zero_address, 'Governance should still be zero');
    assert(!ajo_info_phase4.is_initialized, 'Should not be initialized yet');
    
    // Phase 5: Deploy governance and schedule contracts
    let (governance_address, schedule_address) = factory.deploy_governance_and_schedule(ajo_id);
    assert(governance_address.is_non_zero(), 'Governance not deployed');
    assert(schedule_address.is_non_zero(), 'Schedule not deployed');
    
    // Verify all module contracts deployed with correct addresses
    let ajo_info = factory.get_ajo_info(ajo_id);
    assert(ajo_info.core_address == core_address, 'Core address incorrect');
    assert(ajo_info.members_address == members_address, 'Members address incorrect');
    assert(ajo_info.collateral_address == collateral_address, 'Collateral address incorrect');
    assert(ajo_info.payments_address == payments_address, 'Payments address incorrect');
    assert(ajo_info.governance_address == governance_address, 'Governance address incorrect');
    assert(ajo_info.schedule_address == schedule_address, 'Schedule address incorrect');
    
    // Verify Ajo is marked as initialized after Phase 5
    assert(ajo_info.is_initialized, 'Ajo not initialized');
    
    // Verify factory registry tracks new Ajo
    assert(factory.get_total_ajos() == 1, 'Total ajos incorrect');
    
    // Verify user_ajos mapping updated correctly
    let user_ajos = factory.get_user_ajos(ADMIN());
    assert(user_ajos.len() == 1, 'User ajos count incorrect');
    assert(*user_ajos.at(0) == ajo_id, 'User ajo ID incorrect');
}

/// Test that AjoCore can call all child contracts after deployment
/// **Validates: Requirements 2.1.1**
#[test]
fn test_ajo_core_can_call_child_contracts() {
    use ajo_save::core::ajo_core::IAjoCoreDispatcher;
    use ajo_save::core::ajo_core::IAjoCoreDispatcherTrait;
    
    // Declare all contract classes
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut factory_calldata = array![];
    ADMIN().serialize(ref factory_calldata);
    (*core_class.class_hash).serialize(ref factory_calldata);
    (*members_class.class_hash).serialize(ref factory_calldata);
    (*collateral_class.class_hash).serialize(ref factory_calldata);
    (*payments_class.class_hash).serialize(ref factory_calldata);
    (*governance_class.class_hash).serialize(ref factory_calldata);
    (*schedule_class.class_hash).serialize(ref factory_calldata);
    
    let (factory_address, _) = factory_class.deploy(@factory_calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    start_cheat_caller_address(factory_address, ADMIN());
    
    // Complete 5-phase initialization
    let ajo_id = factory.create_ajo(
        'TestAjo',
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    
    let core_address = factory.deploy_core(ajo_id);
    let members_address = factory.deploy_members(ajo_id);
    let (collateral_address, payments_address) = factory.deploy_collateral_and_payments(ajo_id);
    let (governance_address, schedule_address) = factory.deploy_governance_and_schedule(ajo_id);
    
    // Get AjoCore dispatcher
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Verify AjoCore can query all child contract addresses
    assert(core.get_members_address() == members_address, 'Members address mismatch');
    assert(core.get_collateral_address() == collateral_address, 'Collateral address mismatch');
    assert(core.get_payments_address() == payments_address, 'Payments address mismatch');
    assert(core.get_governance_address() == governance_address, 'Governance address mismatch');
    assert(core.get_schedule_address() == schedule_address, 'Schedule address mismatch');
    
    // Verify AjoCore can read configuration
    let config = core.get_config();
    assert(config.name == 'TestAjo', 'Config name mismatch');
    assert(config.monthly_contribution == MONTHLY_CONTRIBUTION, 'Config contribution mismatch');
    assert(config.total_participants == TOTAL_PARTICIPANTS, 'Config participants mismatch');
    assert(config.cycle_duration == CYCLE_DURATION, 'Config duration mismatch');
    
    // Verify AjoCore initial state
    assert(!core.is_active(), 'Should not be active yet');
    assert(core.get_current_cycle() == 0, 'Cycle should be 0');
}

/// Test multiple Ajo deployments through same factory
/// **Validates: Requirements 2.1.1**
#[test]
fn test_multiple_ajo_deployments() {
    // Declare all contract classes
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut factory_calldata = array![];
    ADMIN().serialize(ref factory_calldata);
    (*core_class.class_hash).serialize(ref factory_calldata);
    (*members_class.class_hash).serialize(ref factory_calldata);
    (*collateral_class.class_hash).serialize(ref factory_calldata);
    (*payments_class.class_hash).serialize(ref factory_calldata);
    (*governance_class.class_hash).serialize(ref factory_calldata);
    (*schedule_class.class_hash).serialize(ref factory_calldata);
    
    let (factory_address, _) = factory_class.deploy(@factory_calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    start_cheat_caller_address(factory_address, ADMIN());
    
    // Create first Ajo
    let ajo_id_1 = factory.create_ajo(
        'FirstAjo',
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    factory.deploy_core(ajo_id_1);
    factory.deploy_members(ajo_id_1);
    factory.deploy_collateral_and_payments(ajo_id_1);
    factory.deploy_governance_and_schedule(ajo_id_1);
    
    // Create second Ajo
    let ajo_id_2 = factory.create_ajo(
        'SecondAjo',
        MONTHLY_CONTRIBUTION * 2,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    factory.deploy_core(ajo_id_2);
    factory.deploy_members(ajo_id_2);
    factory.deploy_collateral_and_payments(ajo_id_2);
    factory.deploy_governance_and_schedule(ajo_id_2);
    
    // Verify both Ajos are tracked
    assert(factory.get_total_ajos() == 2, 'Total ajos should be 2');
    
    // Verify user_ajos mapping contains both
    let user_ajos = factory.get_user_ajos(ADMIN());
    assert(user_ajos.len() == 2, 'User should have 2 ajos');
    assert(*user_ajos.at(0) == ajo_id_1, 'First ajo ID incorrect');
    assert(*user_ajos.at(1) == ajo_id_2, 'Second ajo ID incorrect');
    
    // Verify both Ajos have different addresses
    let ajo_info_1 = factory.get_ajo_info(ajo_id_1);
    let ajo_info_2 = factory.get_ajo_info(ajo_id_2);
    
    assert(ajo_info_1.core_address != ajo_info_2.core_address, 'Core addresses should differ');
    assert(ajo_info_1.members_address != ajo_info_2.members_address, 'Members addresses should differ');
    assert(ajo_info_1.collateral_address != ajo_info_2.collateral_address, 'Collateral addresses should differ');
    assert(ajo_info_1.payments_address != ajo_info_2.payments_address, 'Payments addresses should differ');
    
    // Verify both Ajos are initialized
    assert(ajo_info_1.is_initialized, 'First ajo not initialized');
    assert(ajo_info_2.is_initialized, 'Second ajo not initialized');
    
    // Verify configurations are different
    assert(ajo_info_1.config.name == 'FirstAjo', 'First ajo name incorrect');
    assert(ajo_info_2.config.name == 'SecondAjo', 'Second ajo name incorrect');
    assert(ajo_info_1.config.monthly_contribution == MONTHLY_CONTRIBUTION, 'First ajo contribution incorrect');
    assert(ajo_info_2.config.monthly_contribution == MONTHLY_CONTRIBUTION * 2, 'Second ajo contribution incorrect');
}

/// Test that invalid configuration is rejected
#[test]
#[should_panic(expected: ('Invalid participant count',))]
fn test_invalid_participants_count() {
    // Declare all contract classes
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut factory_calldata = array![];
    ADMIN().serialize(ref factory_calldata);
    (*core_class.class_hash).serialize(ref factory_calldata);
    (*members_class.class_hash).serialize(ref factory_calldata);
    (*collateral_class.class_hash).serialize(ref factory_calldata);
    (*payments_class.class_hash).serialize(ref factory_calldata);
    (*governance_class.class_hash).serialize(ref factory_calldata);
    (*schedule_class.class_hash).serialize(ref factory_calldata);
    
    let (factory_address, _) = factory_class.deploy(@factory_calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    start_cheat_caller_address(factory_address, ADMIN());
    
    // Try to create Ajo with invalid participant count (0)
    factory.create_ajo(
        'InvalidAjo',
        MONTHLY_CONTRIBUTION,
        0, // Invalid: 0 participants
        CYCLE_DURATION,
        PaymentToken::USDC
    );
}

/// Test that zero contribution is rejected
#[test]
#[should_panic(expected: ('Invalid contribution amount',))]
fn test_zero_contribution() {
    // Declare all contract classes
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
    // Deploy factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut factory_calldata = array![];
    ADMIN().serialize(ref factory_calldata);
    (*core_class.class_hash).serialize(ref factory_calldata);
    (*members_class.class_hash).serialize(ref factory_calldata);
    (*collateral_class.class_hash).serialize(ref factory_calldata);
    (*payments_class.class_hash).serialize(ref factory_calldata);
    (*governance_class.class_hash).serialize(ref factory_calldata);
    (*schedule_class.class_hash).serialize(ref factory_calldata);
    
    let (factory_address, _) = factory_class.deploy(@factory_calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };
    
    start_cheat_caller_address(factory_address, ADMIN());
    
    // Try to create Ajo with zero contribution
    factory.create_ajo(
        'InvalidAjo',
        0, // Invalid: 0 contribution
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
}

