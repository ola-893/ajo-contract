use starknet::ContractAddress;

// Payment token types
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum PaymentToken {
    #[default]
    USDC,
    BTC,
}

// Member status
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum MemberStatus {
    #[default]
    Active,
    Defaulted,
    Completed,
    Removed,
}

// Member struct
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct Member {
    pub address: ContractAddress,
    pub position: u256,
    pub collateral_deposited: u256,
    pub has_received_payout: bool,
    pub status: MemberStatus,
    pub join_timestamp: u64,
}

// Ajo configuration
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct AjoConfig {
    pub name: felt252,
    pub monthly_contribution: u256,
    pub total_participants: u256,
    pub cycle_duration: u64,
    pub payment_token: PaymentToken,
    pub creator: ContractAddress,
}

// Ajo information
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct AjoInfo {
    pub id: u256,
    pub config: AjoConfig,
    pub core_address: ContractAddress,
    pub members_address: ContractAddress,
    pub collateral_address: ContractAddress,
    pub payments_address: ContractAddress,
    pub governance_address: ContractAddress,
    pub schedule_address: ContractAddress,
    pub is_initialized: bool,
    pub created_at: u64,
}

// Ajo status information (aggregated from all modules)
#[derive(Drop, Serde)]
pub struct AjoStatus {
    pub ajo_id: u256,
    pub name: felt252,
    pub is_active: bool,
    pub current_cycle: u256,
    pub total_participants: u256,
    pub current_member_count: u256,
    pub monthly_contribution: u256,
    pub cycle_duration: u64,
    pub payment_token: PaymentToken,
    pub total_collateral_locked: u256,
    pub next_payout_position: u256,
}

// Member information (aggregated from members, collateral, and payments)
#[derive(Drop, Serde)]
pub struct MemberInfo {
    pub address: ContractAddress,
    pub position: u256,
    pub status: MemberStatus,
    pub collateral_deposited: u256,
    pub required_collateral: u256,
    pub has_received_payout: bool,
    pub total_paid: u256,
    pub has_paid_current_cycle: bool,
    pub guarantor: ContractAddress,
    pub join_timestamp: u64,
}

// Cycle information (aggregated from payments)
#[derive(Drop, Serde)]
pub struct CycleInfo {
    pub cycle_number: u256,
    pub cycle_start_time: u64,
    pub cycle_duration: u64,
    pub next_payout_position: u256,
    pub next_payout_recipient: ContractAddress,
    pub total_contributions_this_cycle: u256,
    pub expected_total_contributions: u256,
    pub all_members_paid: bool,
    pub payout_amount: u256,
}

// Protocol constants
pub mod Constants {
    pub const COLLATERAL_PERCENTAGE: u256 = 60; // 60% collateral requirement
    pub const PERCENTAGE_DENOMINATOR: u256 = 100;
    pub const MIN_PARTICIPANTS: u256 = 3;
    pub const MAX_PARTICIPANTS: u256 = 100;
    pub const MIN_CYCLE_DURATION: u64 = 86400; // 1 day in seconds
    pub const MAX_CYCLE_DURATION: u64 = 5356800; // 62 days in seconds
}
