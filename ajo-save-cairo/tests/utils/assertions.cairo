// Specialized assertion helpers for AJO.SAVE testing
// Provides domain-specific assertions for collateral, payments, and governance

use starknet::ContractAddress;
use super::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use super::test_helpers::{
    calculate_expected_debt, calculate_expected_collateral, calculate_expected_recovery,
    calculate_coverage_ratio, calculate_guarantor_position
};

// ============================================================================
// Collateral Assertions
// ============================================================================

/// Assert that collateral formula is correct for a given position
pub fn assert_collateral_formula_correct(
    actual_collateral: u256,
    position: u256,
    monthly_contribution: u256,
    total_participants: u256
) {
    let payout = monthly_contribution * total_participants;
    let paid = position * monthly_contribution;
    let debt = payout - paid;
    let expected_collateral = (debt * 600) / 1000; // 60%
    
    assert(actual_collateral == expected_collateral, 'Collateral formula incorrect');
}

/// Assert that recovery assets cover debt with minimum coverage ratio
pub fn assert_recovery_covers_debt(
    position: u256, past_payments: u256, min_coverage_percent: u256
) {
    let coverage = calculate_coverage_ratio(position, past_payments);
    assert(coverage >= min_coverage_percent, 'Insufficient coverage ratio');
}

/// Assert that collateral decreases as position increases
pub fn assert_collateral_decreases_with_position(
    collateral_pos_n: u256, collateral_pos_n_plus_1: u256
) {
    assert(collateral_pos_n >= collateral_pos_n_plus_1, 'Collateral should decrease');
}

/// Assert that position 10 has zero collateral
pub fn assert_position_10_zero_collateral(collateral: u256) {
    assert(collateral == 0, 'Position 10 should have 0');
}

// ============================================================================
// Payment Assertions
// ============================================================================

/// Assert that payment amount matches monthly contribution
pub fn assert_payment_amount_correct(actual: u256, expected_monthly: u256) {
    assert(actual == expected_monthly, 'Payment amount incorrect');
}

/// Assert that payout amount is correct (monthly × participants)
pub fn assert_payout_amount_correct(
    actual_payout: u256, monthly_contribution: u256, total_participants: u256
) {
    let expected = monthly_contribution * total_participants;
    assert(actual_payout == expected, 'Payout amount incorrect');
}

/// Assert that all members have paid for a cycle
pub fn assert_all_members_paid(payments_count: u256, total_participants: u256) {
    assert(payments_count == total_participants, 'Not all members paid');
}

/// Assert that member has not paid twice in same cycle
pub fn assert_no_duplicate_payment(has_paid: bool) {
    assert(!has_paid, 'Duplicate payment detected');
}

/// Assert that cycle has advanced correctly
pub fn assert_cycle_advanced(old_cycle: u256, new_cycle: u256) {
    assert(new_cycle == old_cycle + 1, 'Cycle did not advance');
}

/// Assert that payout position has advanced correctly
pub fn assert_payout_position_advanced(
    old_position: u256, new_position: u256, total_participants: u256
) {
    let expected = if old_position == total_participants {
        1 // Wrap around
    } else {
        old_position + 1
    };
    assert(new_position == expected, 'Payout position incorrect');
}

// ============================================================================
// Member Assertions
// ============================================================================

/// Assert that member is active
pub fn assert_member_active(is_active: bool) {
    assert(is_active, 'Member should be active');
}

/// Assert that member is inactive
pub fn assert_member_inactive(is_active: bool) {
    assert(!is_active, 'Member should be inactive');
}

/// Assert that member has received payout
pub fn assert_member_received_payout(has_received: bool) {
    assert(has_received, 'Member should have payout');
}

/// Assert that member has not received payout
pub fn assert_member_not_received_payout(has_received: bool) {
    assert(!has_received, 'Member should not have payout');
}

/// Assert that member count is correct
pub fn assert_member_count_correct(actual: u256, expected: u256) {
    assert(actual == expected, 'Member count incorrect');
}

/// Assert that member position is valid
pub fn assert_member_position_valid(position: u256, total_participants: u256) {
    assert(position >= 1 && position <= total_participants, 'Invalid member position');
}

// ============================================================================
// Guarantor Network Assertions
// ============================================================================

/// Assert that guarantor calculation is correct
pub fn assert_guarantor_calculation_correct(
    actual_guarantor_pos: u256, member_position: u256, total_participants: u256
) {
    let offset = total_participants / 2;
    let expected = ((member_position - 1 + offset) % total_participants) + 1;
    assert(actual_guarantor_pos == expected, 'Guarantor calc incorrect');
}

/// Assert that member is not their own guarantor
pub fn assert_not_self_guarantor(member_position: u256, guarantor_position: u256) {
    assert(member_position != guarantor_position, 'Self-guarantor detected');
}

/// Assert that guarantor network forms a cycle
pub fn assert_guarantor_cycle_complete(
    position: u256, guarantor_of_guarantor: u256, total_participants: u256
) {
    // For 10 members: position 1 -> 6 -> 1 (cycle of 2)
    // This checks that we don't have position -> position
    assert(position != guarantor_of_guarantor, 'Guarantor cycle broken');
}

// ============================================================================
// Governance Assertions
// ============================================================================

/// Assert that proposal has quorum
pub fn assert_proposal_has_quorum(votes: u256, total_members: u256, quorum_percent: u256) {
    let required_votes = (total_members * quorum_percent) / 100;
    assert(votes >= required_votes, 'Quorum not reached');
}

/// Assert that proposal has passed
pub fn assert_proposal_passed(support_votes: u256, oppose_votes: u256) {
    assert(support_votes > oppose_votes, 'Proposal did not pass');
}

/// Assert that proposal has failed
pub fn assert_proposal_failed(support_votes: u256, oppose_votes: u256) {
    assert(support_votes <= oppose_votes, 'Proposal should have failed');
}

/// Assert that voting period has ended
pub fn assert_voting_period_ended(current_time: u64, end_time: u64) {
    assert(current_time >= end_time, 'Voting period not ended');
}

/// Assert that voting period is still active
pub fn assert_voting_period_active(current_time: u64, end_time: u64) {
    assert(current_time < end_time, 'Voting period ended');
}

// ============================================================================
// Token Balance Assertions
// ============================================================================

/// Assert that token transfer occurred correctly
pub fn assert_token_transfer_correct(
    token: IMockERC20Dispatcher,
    from: ContractAddress,
    to: ContractAddress,
    amount: u256,
    initial_from_balance: u256,
    initial_to_balance: u256
) {
    let final_from_balance = token.balance_of(from);
    let final_to_balance = token.balance_of(to);
    
    assert(final_from_balance == initial_from_balance - amount, 'From balance incorrect');
    assert(final_to_balance == initial_to_balance + amount, 'To balance incorrect');
}

/// Assert that token approval is sufficient
pub fn assert_approval_sufficient(
    token: IMockERC20Dispatcher, owner: ContractAddress, spender: ContractAddress, required: u256
) {
    let allowance = token.allowance(owner, spender);
    assert(allowance >= required, 'Insufficient approval');
}

// ============================================================================
// Invariant Assertions
// ============================================================================

/// Assert total collateral invariant: sum(individual) == total
pub fn assert_total_collateral_invariant_holds(individual_sum: u256, total_tracked: u256) {
    assert(individual_sum == total_tracked, 'Collateral invariant broken');
}

/// Assert member count invariant: count <= max
pub fn assert_member_count_invariant_holds(count: u256, max: u256) {
    assert(count <= max, 'Member count invariant broken');
}

/// Assert payout position invariant: 1 <= position <= max
pub fn assert_payout_position_invariant_holds(position: u256, max: u256) {
    assert(position >= 1 && position <= max, 'Payout pos invariant broken');
}

// ============================================================================
// Default Handling Assertions
// ============================================================================

/// Assert that collateral was seized correctly
pub fn assert_collateral_seized(
    seized_amount: u256, expected_collateral: u256, past_payments: u256
) {
    let expected_total = expected_collateral + past_payments;
    assert(seized_amount == expected_total, 'Seized amount incorrect');
}

/// Assert that defaulter is marked correctly
pub fn assert_defaulter_marked(is_active: bool, default_count: u256) {
    assert(!is_active, 'Defaulter should be inactive');
    assert(default_count > 0, 'Default count should increase');
}

/// Assert that guarantor was penalized
pub fn assert_guarantor_penalized(
    guarantor_collateral_before: u256, guarantor_collateral_after: u256
) {
    assert(
        guarantor_collateral_after < guarantor_collateral_before, 'Guarantor not penalized'
    );
}

// ============================================================================
// Access Control Assertions
// ============================================================================

/// Assert that only owner can call function (expect panic)
pub fn assert_only_owner_can_call(caller_is_owner: bool) {
    assert(caller_is_owner, 'Caller is not the owner');
}

/// Assert that only member can call function
pub fn assert_only_member_can_call(caller_is_member: bool) {
    assert(caller_is_member, 'Caller is not a member');
}

/// Assert that function is paused
pub fn assert_function_paused(is_paused: bool) {
    assert(is_paused, 'Contract should be paused');
}

/// Assert that function is not paused
pub fn assert_function_not_paused(is_paused: bool) {
    assert(!is_paused, 'Contract should not be paused');
}
