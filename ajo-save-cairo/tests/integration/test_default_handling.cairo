// Integration test for default handling workflow
// Tests collateral seizure and guarantor network
// **Validates: Requirements 2.1.2, 2.1.3, 2.1.4, 2.1.5**

use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use ajo_save::factory::ajo_factory::{IAjoFactoryDispatcher, IAjoFactoryDispatcherTrait};
use ajo_save::core::ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
use ajo_save::members::ajo_members::{IAjoMembersDispatcher, IAjoMembersDispatcherTrait};
use ajo_save::collateral::ajo_collateral::{IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait};
use ajo_save::payments::ajo_payments::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};
use ajo_save::interfaces::types::PaymentToken;
use ajo_save_tests::utils::constants::{
    MONTHLY_CONTRIBUTION, TOTAL_PARTICIPANTS, CYCLE_DURATION, ADMIN,
    MEMBER_1, MEMBER_2, MEMBER_3, MEMBER_4, MEMBER_5,
    MEMBER_6, MEMBER_7, MEMBER_8, MEMBER_9, MEMBER_10
};
use ajo_save_tests::utils::test_helpers::{calculate_expected_collateral, calculate_guarantor_position, deploy_mock_token};
use ajo_save_tests::utils::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};

/// Helper function to advance time
fn advance_time(seconds: u64) {
    let current = starknet::get_block_timestamp();
    starknet::testing::set_block_timestamp(current + seconds);
}

/// Helper function to deploy factory with all class hashes
fn deploy_factory() -> IAjoFactoryDispatcher {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();
    
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
    IAjoFactoryDispatcher { contract_address: factory_address }
}

/// Helper function to get all member addresses
fn get_all_members() -> Array<ContractAddress> {
    array![
        MEMBER_1(), MEMBER_2(), MEMBER_3(), MEMBER_4(), MEMBER_5(),
        MEMBER_6(), MEMBER_7(), MEMBER_8(), MEMBER_9(), MEMBER_10()
    ]
}

/// Test complete default handling workflow
/// Setup: 10 members, 3 successful cycles, then position 3 defaults in cycle 4
/// Expected: Position 3 and guarantor (position 8) collateral + past payments seized
#[test]
fn test_default_handling_workflow() {
    // ========================================================================
    // PHASE 1: Setup - Deploy factory and create Ajo (5-phase initialization)
    // ========================================================================
    
    let factory = deploy_factory();
    start_cheat_caller_address(factory.contract_address, ADMIN());
    
    // Create Ajo through factory
    let ajo_id = factory.create_ajo(
        'DefaultHandlingTest',
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    
    // Complete 5-phase initialization
    let core_address = factory.deploy_core(ajo_id);
    let members_address = factory.deploy_members(ajo_id);
    let (collateral_address, payments_address) = factory.deploy_collateral_and_payments(ajo_id);
    let (governance_address, schedule_address) = factory.deploy_governance_and_schedule(ajo_id);
    
    // Get dispatchers for all contracts
    let core = IAjoCoreDispatcher { contract_address: core_address };
    let members = IAjoMembersDispatcher { contract_address: members_address };
    let collateral = IAjoCollateralDispatcher { contract_address: collateral_address };
    let payments = IAjoPaymentsDispatcher { contract_address: payments_address };
    
    // Deploy mock USDC token
    let token_address = deploy_mock_token("USD Coin", "USDC", 6);
    let token = IMockERC20Dispatcher { contract_address: token_address };
    
    // ========================================================================
    // PHASE 2: Join 10 members with correct collateral amounts
    // ========================================================================
    
    let all_members = get_all_members();
    let mut position: u256 = 1;
    
    loop {
        if position > TOTAL_PARTICIPANTS {
            break;
        }
        
        let member = *all_members.at((position - 1).try_into().unwrap());
        let required_collateral = calculate_expected_collateral(position);
        
        // Mint tokens for collateral + 10 cycles of payments
        let total_needed = required_collateral + (MONTHLY_CONTRIBUTION * 10);
        token.mint(member, total_needed);
        
        // Approve core contract to spend tokens
        start_cheat_caller_address(token_address, member);
        token.approve(core_address, total_needed);
        
        // Join Ajo
        start_cheat_caller_address(core_address, member);
        core.join_ajo(0); // token_index 0 for USDC
        
        position += 1;
    };
    
    // Verify all 10 members joined
    assert(members.get_total_members() == TOTAL_PARTICIPANTS, 'Not all members joined');
    
    // ========================================================================
    // PHASE 3: Start Ajo and process 3 successful cycles
    // ========================================================================
    
    start_cheat_caller_address(core_address, ADMIN());
    core.start_ajo();
    
    assert(core.is_active(), 'Ajo not active');
    
    // Process payments for cycles 1, 2, and 3
    let mut cycle: u256 = 1;
    loop {
        if cycle > 3 {
            break;
        }
        
        // All 10 members make payments for this cycle
        let mut member_idx: u32 = 0;
        loop {
            if member_idx >= 10 {
                break;
            }
            
            let member = *all_members.at(member_idx);
            
            // Member makes payment
            start_cheat_caller_address(core_address, member);
            core.process_payment();
            
            member_idx += 1;
        };
        
        // Verify all members paid for this cycle
        assert(
            payments.get_cycle_contributions(cycle) == MONTHLY_CONTRIBUTION * TOTAL_PARTICIPANTS,
            'Cycle contributions wrong'
        );
        
        // Advance to next cycle
        if cycle < 3 {
            advance_time(CYCLE_DURATION);
        }
        
        cycle += 1;
    };
    
    // ========================================================================
    // PHASE 4: Simulate default by position 3 member in cycle 4
    // ========================================================================
    
    advance_time(CYCLE_DURATION); // Move to cycle 4
    
    let defaulter = MEMBER_3(); // Position 3
    let defaulter_position: u256 = 3;
    let guarantor_position = calculate_guarantor_position(defaulter_position); // Position 8
    let guarantor = MEMBER_8();
    
    // Verify guarantor calculation is correct
    assert(guarantor_position == 8, 'Guarantor position wrong');
    
    // Record collateral and past payments BEFORE default handling
    let defaulter_collateral_before = collateral.get_member_collateral(defaulter);
    let guarantor_collateral_before = collateral.get_member_collateral(guarantor);
    let defaulter_past_payments_before = payments.get_total_paid(defaulter);
    let guarantor_past_payments_before = payments.get_total_paid(guarantor);
    let payments_contract_balance_before = token.balance_of(payments_address);
    
    // Verify expected values before default
    let expected_defaulter_collateral = calculate_expected_collateral(defaulter_position); // $210
    let expected_guarantor_collateral = calculate_expected_collateral(guarantor_position); // $60
    let expected_past_payments = MONTHLY_CONTRIBUTION * 3; // 3 cycles × $50 = $150
    
    assert(defaulter_collateral_before == expected_defaulter_collateral, 'Defaulter collateral wrong');
    assert(guarantor_collateral_before == expected_guarantor_collateral, 'Guarantor collateral wrong');
    assert(defaulter_past_payments_before == expected_past_payments, 'Defaulter past payments wrong');
    assert(guarantor_past_payments_before == expected_past_payments, 'Guarantor past payments wrong');
    
    // ========================================================================
    // PHASE 5: Handle default and verify seizures
    // ========================================================================
    
    // Call handle_default
    start_cheat_caller_address(core_address, ADMIN());
    core.handle_default(defaulter);
    
    // ========================================================================
    // PHASE 6: Verify position 3 collateral seized ($210)
    // ========================================================================
    
    let defaulter_collateral_after = collateral.get_member_collateral(defaulter);
    assert(defaulter_collateral_after == 0, 'Defaulter collateral not seized');
    
    // ========================================================================
    // PHASE 7: Verify position 8 (guarantor) collateral seized ($60)
    // ========================================================================
    
    let guarantor_collateral_after = collateral.get_member_collateral(guarantor);
    assert(guarantor_collateral_after == 0, 'Guarantor collateral not seized');
    
    // ========================================================================
    // PHASE 8: Verify position 3 past payments seized (3 × $50 = $150)
    // ========================================================================
    
    let defaulter_past_payments_after = payments.get_total_paid(defaulter);
    assert(defaulter_past_payments_after == 0, 'Defaulter past payments not seized');
    
    // ========================================================================
    // PHASE 9: Verify position 8 past payments seized (3 × $50 = $150)
    // ========================================================================
    
    let guarantor_past_payments_after = payments.get_total_paid(guarantor);
    assert(guarantor_past_payments_after == 0, 'Guarantor past payments not seized');
    
    // ========================================================================
    // PHASE 10: Verify total seized = $570 transferred to payments contract
    // ========================================================================
    
    let total_seized = expected_defaulter_collateral + expected_guarantor_collateral 
                     + expected_past_payments + expected_past_payments;
    let expected_total_seized: u256 = 210_000000 + 60_000000 + 150_000000 + 150_000000; // $570
    
    assert(total_seized == expected_total_seized, 'Total seized amount wrong');
    
    // Verify payments contract received the seized funds
    let payments_contract_balance_after = token.balance_of(payments_address);
    let balance_increase = payments_contract_balance_after - payments_contract_balance_before;
    
    assert(balance_increase == expected_total_seized, 'Payments contract balance wrong');
    
    // ========================================================================
    // PHASE 11: Verify defaulter and guarantor marked as inactive
    // ========================================================================
    
    let defaulter_info = members.get_member(defaulter);
    let guarantor_info = members.get_member(guarantor);
    
    assert(!defaulter_info.is_active, 'Defaulter still active');
    assert(!guarantor_info.is_active, 'Guarantor still active');
    
    // ========================================================================
    // PHASE 12: Verify remaining members can continue cycle
    // ========================================================================
    
    // Remaining 8 members (excluding defaulter and guarantor) should be able to continue
    let mut member_idx: u32 = 0;
    let mut active_count: u32 = 0;
    
    loop {
        if member_idx >= 10 {
            break;
        }
        
        let member = *all_members.at(member_idx);
        
        // Skip defaulter and guarantor
        if member != defaulter && member != guarantor {
            let member_info = members.get_member(member);
            if member_info.is_active {
                active_count += 1;
            }
        }
        
        member_idx += 1;
    };
    
    assert(active_count == 8, 'Wrong number of active members');
    
    // Verify remaining members can still make payments
    let test_member = MEMBER_1(); // Position 1, not defaulter or guarantor
    start_cheat_caller_address(core_address, test_member);
    
    // This should succeed (member can still participate)
    core.process_payment();
    
    // Verify payment was recorded
    assert(
        payments.has_paid_for_cycle(test_member, 4),
        'Remaining member payment failed'
    );
}

/// Test that default handling correctly calculates guarantor position
#[test]
fn test_guarantor_position_calculation() {
    // Test guarantor offset formula: ((position - 1 + (total/2)) % total) + 1
    // For 10 members, offset = 5
    
    // Position 1 → Guarantor Position 6
    assert(calculate_guarantor_position(1) == 6, 'Position 1 guarantor wrong');
    
    // Position 3 → Guarantor Position 8
    assert(calculate_guarantor_position(3) == 8, 'Position 3 guarantor wrong');
    
    // Position 6 → Guarantor Position 1 (wraps around)
    assert(calculate_guarantor_position(6) == 1, 'Position 6 guarantor wrong');
    
    // Position 8 → Guarantor Position 3 (wraps around)
    assert(calculate_guarantor_position(8) == 3, 'Position 8 guarantor wrong');
    
    // Position 10 → Guarantor Position 5
    assert(calculate_guarantor_position(10) == 5, 'Position 10 guarantor wrong');
}

/// Test that default handling fails if defaulter is not a member
#[test]
#[should_panic(expected: ('Not a member',))]
fn test_cannot_handle_default_for_non_member() {
    let factory = deploy_factory();
    start_cheat_caller_address(factory.contract_address, ADMIN());
    
    let ajo_id = factory.create_ajo(
        'DefaultTest',
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    
    let core_address = factory.deploy_core(ajo_id);
    factory.deploy_members(ajo_id);
    factory.deploy_collateral_and_payments(ajo_id);
    factory.deploy_governance_and_schedule(ajo_id);
    
    let core = IAjoCoreDispatcher { contract_address: core_address };
    
    // Try to handle default for non-member
    let non_member = starknet::contract_address_const::<'NON_MEMBER'>();
    start_cheat_caller_address(core_address, ADMIN());
    core.handle_default(non_member);
}

/// Test that seized assets total matches expected recovery amount
#[test]
fn test_seized_assets_match_recovery_calculation() {
    // For position 3 with 3 cycles of past payments:
    // - Position 3 collateral: $210 (60% of $350 debt)
    // - Position 8 collateral: $60 (60% of $100 debt)
    // - Position 3 past payments: $150 (3 × $50)
    // - Position 8 past payments: $150 (3 × $50)
    // Total recovery: $570
    
    let position_3_collateral = calculate_expected_collateral(3);
    let position_8_collateral = calculate_expected_collateral(8);
    let past_payments = MONTHLY_CONTRIBUTION * 3;
    
    let total_recovery = position_3_collateral + position_8_collateral 
                       + past_payments + past_payments;
    
    let expected_total: u256 = 570_000000; // $570 in USDC (6 decimals)
    
    assert(total_recovery == expected_total, 'Recovery calculation wrong');
    
    // Verify this provides sufficient coverage for position 3 debt
    // Position 3 debt = $350 (payout $500 - paid $150)
    let position_3_debt: u256 = 350_000000;
    let coverage_ratio = (total_recovery * 100) / position_3_debt;
    
    // Coverage should be > 100% (actually 162.8%)
    assert(coverage_ratio > 100, 'Insufficient coverage');
    assert(coverage_ratio >= 162, 'Coverage ratio too low');
}
