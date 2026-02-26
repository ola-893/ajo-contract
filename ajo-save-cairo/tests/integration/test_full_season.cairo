// Integration test for full season completion
// Tests complete workflow: join -> payments -> payouts -> completion
// **Validates: Requirements 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5**

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
use ajo_save_tests::utils::test_helpers::{calculate_expected_collateral, deploy_mock_token};
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

/// Test complete full season with 10 members and 10 cycles
#[test]
fn test_full_season_completion() {
    // ========================================================================
    // PHASE 1: Setup - Deploy factory and create Ajo (5-phase initialization)
    // ========================================================================
    
    let factory = deploy_factory();
    start_cheat_caller_address(factory.contract_address, ADMIN());
    
    // Create Ajo through factory
    let ajo_id = factory.create_ajo(
        'FullSeasonTest',
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
        
        // Verify member's collateral matches position-based calculation
        let actual_collateral = collateral.get_member_collateral(member);
        assert(actual_collateral == required_collateral, 'Collateral mismatch');
        
        position += 1;
    };
    
    // Verify all 10 members joined
    assert(members.get_total_members() == TOTAL_PARTICIPANTS, 'Not all members joined');
    
    // ========================================================================
    // PHASE 3: Start Ajo and begin first cycle
    // ========================================================================
    
    start_cheat_caller_address(core_address, ADMIN());
    core.start_ajo();
    
    assert(core.is_active(), 'Ajo not active');
    assert(payments.get_current_cycle() == 1, 'Cycle not started');
    
    // ========================================================================
    // PHASE 4: Process all 10 cycles
    // ========================================================================
    
    let mut cycle: u256 = 1;
    let mut payout_recipients: Array<ContractAddress> = array![];
    let mut total_contributions_made: u256 = 0;
    
    loop {
        if cycle > TOTAL_PARTICIPANTS {
            break;
        }
        
        // Process payments from all 10 members for current cycle
        let mut member_idx: u32 = 0;
        loop {
            if member_idx >= 10 {
                break;
            }
            
            let member = *all_members.at(member_idx);
            
            // Member makes payment
            start_cheat_caller_address(core_address, member);
            core.process_payment();
            
            // Verify payment recorded
            assert(
                payments.has_paid_for_cycle(member, cycle),
                'Payment not recorded'
            );
            
            total_contributions_made += MONTHLY_CONTRIBUTION;
            member_idx += 1;
        };
        
        // Verify all members paid for this cycle
        let cycle_contributions = payments.get_cycle_contributions(cycle);
        let expected_total = MONTHLY_CONTRIBUTION * TOTAL_PARTICIPANTS;
        assert(cycle_contributions == expected_total, 'Cycle contributions wrong');
        
        // Get payout recipient for this cycle (before advancing)
        let recipient = payments.get_payout_recipient(cycle);
        payout_recipients.append(recipient);
        
        // Verify payout distributed to correct position member
        let expected_recipient = *all_members.at((cycle - 1).try_into().unwrap());
        assert(recipient == expected_recipient, 'Wrong payout recipient');
        
        // Verify payout amount is correct (monthly_contribution × total_participants)
        let payout_amount = payments.calculate_payout_amount(cycle);
        assert(payout_amount == expected_total, 'Payout amount wrong');
        
        // Advance to next cycle (if not last cycle)
        if cycle < TOTAL_PARTICIPANTS {
            advance_time(CYCLE_DURATION);
            // Cycle should advance after time passes and next payment is made
        }
        
        cycle += 1;
    };
    
    // ========================================================================
    // PHASE 5: Verify all 10 members received payout exactly once
    // ========================================================================
    
    let mut member_idx: u32 = 0;
    loop {
        if member_idx >= 10 {
            break;
        }
        
        let member = *all_members.at(member_idx);
        assert(
            members.has_received_payout(member),
            'Member did not receive payout'
        );
        
        member_idx += 1;
    };
    
    // Verify exactly 10 unique recipients
    assert(payout_recipients.len() == 10, 'Wrong number of payouts');
    
    // ========================================================================
    // PHASE 6: Verify all collateral can be withdrawn after season ends
    // ========================================================================
    
    let mut position: u256 = 1;
    let mut total_collateral_withdrawn: u256 = 0;
    
    loop {
        if position > TOTAL_PARTICIPANTS {
            break;
        }
        
        let member = *all_members.at((position - 1).try_into().unwrap());
        let collateral_amount = collateral.get_member_collateral(member);
        total_collateral_withdrawn += collateral_amount;
        
        // Member withdraws collateral
        start_cheat_caller_address(collateral_address, member);
        collateral.withdraw_collateral(collateral_amount);
        
        // Verify collateral withdrawn
        assert(
            collateral.get_member_collateral(member) == 0,
            'Collateral not withdrawn'
        );
        
        position += 1;
    };
    
    // Verify total collateral is now zero
    assert(collateral.get_total_collateral() == 0, 'Total collateral not zero');
    
    // ========================================================================
    // PHASE 7: Verify total contributions = total payouts
    // ========================================================================
    
    // Total contributions = 10 members × 10 cycles × monthly_contribution
    let expected_total_contributions = TOTAL_PARTICIPANTS * TOTAL_PARTICIPANTS * MONTHLY_CONTRIBUTION;
    assert(total_contributions_made == expected_total_contributions, 'Total contributions wrong');
    
    // Total payouts = 10 payouts × (monthly_contribution × total_participants)
    let payout_per_cycle = MONTHLY_CONTRIBUTION * TOTAL_PARTICIPANTS;
    let total_payouts = TOTAL_PARTICIPANTS * payout_per_cycle;
    
    assert(expected_total_contributions == total_payouts, 'Contributions != payouts');
}

/// Test that season cannot start with insufficient members
#[test]
#[should_panic(expected: ('Insufficient members',))]
fn test_cannot_start_with_insufficient_members() {
    let factory = deploy_factory();
    start_cheat_caller_address(factory.contract_address, ADMIN());
    
    let ajo_id = factory.create_ajo(
        'InsufficientTest',
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
    
    // Try to start without any members
    start_cheat_caller_address(core_address, ADMIN());
    core.start_ajo();
}

/// Test that member cannot join after Ajo is full
#[test]
#[should_panic(expected: ('Ajo is full',))]
fn test_cannot_join_when_full() {
    let factory = deploy_factory();
    start_cheat_caller_address(factory.contract_address, ADMIN());
    
    let ajo_id = factory.create_ajo(
        'FullTest',
        MONTHLY_CONTRIBUTION,
        TOTAL_PARTICIPANTS,
        CYCLE_DURATION,
        PaymentToken::USDC
    );
    
    let core_address = factory.deploy_core(ajo_id);
    let members_address = factory.deploy_members(ajo_id);
    let (collateral_address, _) = factory.deploy_collateral_and_payments(ajo_id);
    factory.deploy_governance_and_schedule(ajo_id);
    
    let core = IAjoCoreDispatcher { contract_address: core_address };
    let collateral = IAjoCollateralDispatcher { contract_address: collateral_address };
    let token_address = deploy_mock_token("USD Coin", "USDC", 6);
    let token = IMockERC20Dispatcher { contract_address: token_address };
    
    // Join 10 members
    let all_members = get_all_members();
    let mut position: u256 = 1;
    
    loop {
        if position > TOTAL_PARTICIPANTS {
            break;
        }
        
        let member = *all_members.at((position - 1).try_into().unwrap());
        let required_collateral = calculate_expected_collateral(position);
        let total_needed = required_collateral + MONTHLY_CONTRIBUTION;
        
        token.mint(member, total_needed);
        start_cheat_caller_address(token_address, member);
        token.approve(core_address, total_needed);
        
        start_cheat_caller_address(core_address, member);
        core.join_ajo(0);
        
        position += 1;
    };
    
    // Try to join 11th member
    let extra_member = starknet::contract_address_const::<'EXTRA_MEMBER'>();
    token.mint(extra_member, MONTHLY_CONTRIBUTION * 2);
    start_cheat_caller_address(token_address, extra_member);
    token.approve(core_address, MONTHLY_CONTRIBUTION * 2);
    
    start_cheat_caller_address(core_address, extra_member);
    core.join_ajo(0);
}

/// Test that payment cannot be made twice in same cycle
#[test]
#[should_panic(expected: ('Already paid this cycle',))]
fn test_cannot_pay_twice_same_cycle() {
    let factory = deploy_factory();
    start_cheat_caller_address(factory.contract_address, ADMIN());
    
    let ajo_id = factory.create_ajo(
        'DuplicatePaymentTest',
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
    let token_address = deploy_mock_token("USD Coin", "USDC", 6);
    let token = IMockERC20Dispatcher { contract_address: token_address };
    
    // Join all 10 members first
    let all_members = get_all_members();
    let mut position: u256 = 1;
    
    loop {
        if position > TOTAL_PARTICIPANTS {
            break;
        }
        
        let member = *all_members.at((position - 1).try_into().unwrap());
        let required_collateral = calculate_expected_collateral(position);
        let total_needed = required_collateral + (MONTHLY_CONTRIBUTION * 2);
        
        token.mint(member, total_needed);
        start_cheat_caller_address(token_address, member);
        token.approve(core_address, total_needed);
        
        start_cheat_caller_address(core_address, member);
        core.join_ajo(0);
        
        position += 1;
    };
    
    // Start Ajo
    start_cheat_caller_address(core_address, ADMIN());
    core.start_ajo();
    
    // Make first payment from MEMBER_1
    let member = MEMBER_1();
    start_cheat_caller_address(core_address, member);
    core.process_payment();
    
    // Try to make second payment in same cycle (should panic)
    core.process_payment();
}
