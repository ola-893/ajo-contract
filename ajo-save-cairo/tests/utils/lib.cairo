// Test utilities module
mod mock_erc20;
mod test_helpers;
mod constants;
mod assertions;

pub use mock_erc20::{MockERC20, IMockERC20Dispatcher, IMockERC20DispatcherTrait};
pub use test_helpers::{
    deploy_mock_token, setup_test_env, setup_test_env_with_timestamp, create_test_members,
    mint_tokens_to_members, advance_time, advance_cycle, calculate_expected_debt,
    calculate_expected_collateral, calculate_guarantor_position, calculate_expected_recovery,
    calculate_coverage_ratio, generate_random_members, generate_random_amount,
    generate_test_scenario, setup_members_with_tokens, setup_complete_ajo_scenario,
    setup_default_scenario, setup_governance_scenario, assert_collateral_correct,
    assert_debt_correct, assert_coverage_sufficient, assert_guarantor_correct,
    assert_balance_equals, assert_balance_sufficient, assert_total_collateral_invariant,
    assert_member_count_valid, assert_payout_position_valid, TestScenario, CompleteAjoSetup,
    DefaultTestScenario, GovernanceTestScenario
};
pub use constants::{
    MONTHLY_CONTRIBUTION, TOTAL_PARTICIPANTS, CYCLE_DURATION, COLLATERAL_FACTOR, BASIS_POINTS,
    POSITION_1_DEBT, POSITION_1_COLLATERAL, POSITION_5_DEBT, POSITION_5_COLLATERAL,
    POSITION_10_DEBT, POSITION_10_COLLATERAL, MIN_COVERAGE_RATIO, USDC_DECIMALS, ADMIN, MEMBER_1,
    MEMBER_2, MEMBER_3, MEMBER_4, MEMBER_5, MEMBER_6, MEMBER_7, MEMBER_8, MEMBER_9, MEMBER_10
};
pub use assertions::{
    assert_collateral_formula_correct, assert_recovery_covers_debt,
    assert_collateral_decreases_with_position, assert_position_10_zero_collateral,
    assert_payment_amount_correct, assert_payout_amount_correct, assert_all_members_paid,
    assert_no_duplicate_payment, assert_cycle_advanced, assert_payout_position_advanced,
    assert_member_active, assert_member_inactive, assert_member_received_payout,
    assert_member_not_received_payout, assert_member_count_correct, assert_member_position_valid,
    assert_guarantor_calculation_correct, assert_not_self_guarantor,
    assert_guarantor_cycle_complete, assert_proposal_has_quorum, assert_proposal_passed,
    assert_proposal_failed, assert_voting_period_ended, assert_voting_period_active,
    assert_token_transfer_correct, assert_approval_sufficient,
    assert_total_collateral_invariant_holds, assert_member_count_invariant_holds,
    assert_payout_position_invariant_holds, assert_collateral_seized, assert_defaulter_marked,
    assert_guarantor_penalized, assert_only_owner_can_call, assert_only_member_can_call,
    assert_function_paused, assert_function_not_paused
};

