use starknet::{ContractAddress, ClassHash, deploy_syscall};
use starknet::testing::{set_contract_address, set_block_timestamp};
use super::constants::{MONTHLY_CONTRIBUTION, TOTAL_PARTICIPANTS, CYCLE_DURATION};
use super::mock_erc20::{MockERC20, IMockERC20Dispatcher, IMockERC20DispatcherTrait};

// ============================================================================
// Deployment Helpers
// ============================================================================

/// Deploy a mock ERC20 token for testing
pub fn deploy_mock_token(name: ByteArray, symbol: ByteArray, decimals: u8) -> ContractAddress {
    let mut calldata = array![];
    name.serialize(ref calldata);
    symbol.serialize(ref calldata);
    decimals.serialize(ref calldata);

    let (address, _) = deploy_syscall(
        MockERC20::TEST_CLASS_HASH.try_into().unwrap(), 0, calldata.span(), false
    )
        .expect('Failed to deploy token');

    address
}

// ============================================================================
// Token Management Helpers
// ============================================================================

/// Mint tokens to multiple addresses
pub fn mint_tokens_to_members(
    token: IMockERC20Dispatcher, members: Span<ContractAddress>, amount: u256
) {
    let mut i = 0;
    loop {
        if i >= members.len() {
            break;
        }
        token.mint(*members.at(i), amount);
        i += 1;
    };
}

/// Create array of test member addresses
pub fn create_test_members(count: u32) -> Array<ContractAddress> {
    let mut members = array![];
    let mut i: u32 = 1;
    loop {
        if i > count {
            break;
        }
        // Create unique address for each member
        let addr = starknet::contract_address_const::<0>() + i.into();
        members.append(addr);
        i += 1;
    };
    members
}

/// Setup test environment with timestamp
pub fn setup_test_env() {
    // Set initial block timestamp (e.g., Jan 1, 2024)
    set_block_timestamp(1704067200);
}

/// Advance time by specified seconds
pub fn advance_time(seconds: u64) {
    let current = starknet::get_block_timestamp();
    set_block_timestamp(current + seconds);
}

/// Advance to next cycle
pub fn advance_cycle() {
    advance_time(CYCLE_DURATION);
}

/// Calculate expected debt for a position
pub fn calculate_expected_debt(position: u256) -> u256 {
    let payout = MONTHLY_CONTRIBUTION * TOTAL_PARTICIPANTS;
    let paid = position * MONTHLY_CONTRIBUTION;
    payout - paid
}

/// Calculate expected collateral for a position (60% of debt)
pub fn calculate_expected_collateral(position: u256) -> u256 {
    let debt = calculate_expected_debt(position);
    (debt * 600) / 1000 // 60% = 600/1000
}

/// Calculate guarantor position using the offset formula
pub fn calculate_guarantor_position(position: u256) -> u256 {
    let offset = TOTAL_PARTICIPANTS / 2;
    ((position - 1 + offset) % TOTAL_PARTICIPANTS) + 1
}

/// Calculate expected recovery assets (member + guarantor collateral + past payments)
pub fn calculate_expected_recovery(position: u256, past_payments: u256) -> u256 {
    let member_collateral = calculate_expected_collateral(position);
    let guarantor_pos = calculate_guarantor_position(position);
    let guarantor_collateral = calculate_expected_collateral(guarantor_pos);
    
    member_collateral + past_payments + guarantor_collateral + past_payments
}

/// Calculate coverage ratio as percentage
pub fn calculate_coverage_ratio(position: u256, past_payments: u256) -> u256 {
    let debt = calculate_expected_debt(position);
    if debt == 0 {
        return 0; // Position 10 has no debt
    }
    let recovery = calculate_expected_recovery(position, past_payments);
    (recovery * 100) / debt
}

// ============================================================================
// Member Data Generators
// ============================================================================

/// Generate random member addresses for testing
pub fn generate_random_members(count: u32, seed: u32) -> Array<ContractAddress> {
    let mut members = array![];
    let mut i: u32 = 0;
    loop {
        if i >= count {
            break;
        }
        // Generate pseudo-random address using seed
        let addr_felt: felt252 = (seed + i * 1000).into();
        let addr = starknet::contract_address_try_from_felt252(addr_felt).unwrap();
        members.append(addr);
        i += 1;
    };
    members
}

/// Generate random payment amounts within a range
pub fn generate_random_amount(min: u256, max: u256, seed: u256) -> u256 {
    // Simple pseudo-random generator for testing
    let range = max - min;
    let random = (seed * 1103515245 + 12345) % range;
    min + random
}

/// Generate test scenario with specific member count
pub fn generate_test_scenario(member_count: u32) -> TestScenario {
    TestScenario {
        members: create_test_members(member_count),
        monthly_contribution: MONTHLY_CONTRIBUTION,
        total_participants: member_count.into(),
        cycle_duration: CYCLE_DURATION,
    }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/// Assert that collateral matches expected value for position
pub fn assert_collateral_correct(actual: u256, position: u256, message: felt252) {
    let expected = calculate_expected_collateral(position);
    assert(actual == expected, message);
}

/// Assert that debt matches expected value for position
pub fn assert_debt_correct(actual: u256, position: u256, message: felt252) {
    let expected = calculate_expected_debt(position);
    assert(actual == expected, message);
}

/// Assert that coverage ratio is above minimum threshold
pub fn assert_coverage_sufficient(position: u256, past_payments: u256, message: felt252) {
    let coverage = calculate_coverage_ratio(position, past_payments);
    assert(coverage >= 108, message); // Minimum 108% coverage
}

/// Assert that guarantor position is correct
pub fn assert_guarantor_correct(
    actual_guarantor_pos: u256, member_position: u256, message: felt252
) {
    let expected = calculate_guarantor_position(member_position);
    assert(actual_guarantor_pos == expected, message);
}

/// Assert that member balance matches expected amount
pub fn assert_balance_equals(
    token: IMockERC20Dispatcher, member: ContractAddress, expected: u256, message: felt252
) {
    let actual = token.balance_of(member);
    assert(actual == expected, message);
}

/// Assert that member has sufficient balance
pub fn assert_balance_sufficient(
    token: IMockERC20Dispatcher, member: ContractAddress, minimum: u256, message: felt252
) {
    let actual = token.balance_of(member);
    assert(actual >= minimum, message);
}

/// Assert that total collateral equals sum of individual collateral
pub fn assert_total_collateral_invariant(
    individual_sum: u256, total_tracked: u256, message: felt252
) {
    assert(individual_sum == total_tracked, message);
}

/// Assert that member count is within valid range
pub fn assert_member_count_valid(count: u256, max_participants: u256, message: felt252) {
    assert(count <= max_participants, message);
}

/// Assert that payout position is within valid range
pub fn assert_payout_position_valid(position: u256, total_participants: u256, message: felt252) {
    assert(position >= 1 && position <= total_participants, message);
}

// ============================================================================
// Setup Functions for Test Scenarios
// ============================================================================

/// Setup basic test environment with timestamp
pub fn setup_test_env() {
    // Set initial block timestamp (e.g., Jan 1, 2024)
    set_block_timestamp(1704067200);
}

/// Setup test environment with custom timestamp
pub fn setup_test_env_with_timestamp(timestamp: u64) {
    set_block_timestamp(timestamp);
}

/// Setup members with token balances and approvals
pub fn setup_members_with_tokens(
    token: IMockERC20Dispatcher,
    members: Span<ContractAddress>,
    amount_per_member: u256,
    spender: ContractAddress
) {
    let mut i = 0;
    loop {
        if i >= members.len() {
            break;
        }
        let member = *members.at(i);
        
        // Mint tokens to member
        token.mint(member, amount_per_member);
        
        // Set caller to member and approve spender
        set_contract_address(member);
        token.approve(spender, amount_per_member);
        
        i += 1;
    };
}

/// Setup a complete test Ajo scenario with all contracts deployed
/// Returns (factory, core, members, collateral, payments, governance, schedule, token)
pub fn setup_complete_ajo_scenario() -> CompleteAjoSetup {
    setup_test_env();
    
    // Deploy mock token
    let token_address = deploy_mock_token("USD Coin", "USDC", 6);
    let token = IMockERC20Dispatcher { contract_address: token_address };
    
    // Create test members
    let members = create_test_members(TOTAL_PARTICIPANTS.try_into().unwrap());
    
    // Setup members with tokens (enough for 12 months + collateral)
    let amount_per_member = MONTHLY_CONTRIBUTION * 12 + calculate_expected_collateral(1);
    setup_members_with_tokens(token, members.span(), amount_per_member, token_address);
    
    CompleteAjoSetup {
        token,
        token_address,
        members,
        monthly_contribution: MONTHLY_CONTRIBUTION,
        total_participants: TOTAL_PARTICIPANTS,
        cycle_duration: CYCLE_DURATION,
    }
}

/// Setup scenario for testing default handling
pub fn setup_default_scenario(cycles_completed: u32) -> DefaultTestScenario {
    let base_setup = setup_complete_ajo_scenario();
    
    DefaultTestScenario {
        base: base_setup,
        cycles_completed,
        defaulter_position: 3, // Position 3 will default
        guarantor_position: calculate_guarantor_position(3), // Position 8
    }
}

/// Setup scenario for testing governance
pub fn setup_governance_scenario() -> GovernanceTestScenario {
    let base_setup = setup_complete_ajo_scenario();
    
    GovernanceTestScenario {
        base: base_setup,
        voting_period: 86400, // 1 day
        quorum_percentage: 51,
    }
}

// ============================================================================
// Data Structures for Test Scenarios
// ============================================================================

#[derive(Drop, Clone)]
pub struct TestScenario {
    pub members: Array<ContractAddress>,
    pub monthly_contribution: u256,
    pub total_participants: u256,
    pub cycle_duration: u64,
}

#[derive(Drop, Clone)]
pub struct CompleteAjoSetup {
    pub token: IMockERC20Dispatcher,
    pub token_address: ContractAddress,
    pub members: Array<ContractAddress>,
    pub monthly_contribution: u256,
    pub total_participants: u256,
    pub cycle_duration: u64,
}

#[derive(Drop, Clone)]
pub struct DefaultTestScenario {
    pub base: CompleteAjoSetup,
    pub cycles_completed: u32,
    pub defaulter_position: u256,
    pub guarantor_position: u256,
}

#[derive(Drop, Clone)]
pub struct GovernanceTestScenario {
    pub base: CompleteAjoSetup,
    pub voting_period: u64,
    pub quorum_percentage: u256,
}

