// Test constants matching the design document examples

// Standard test configuration (10 members, $50/month)
pub const MONTHLY_CONTRIBUTION: u256 = 50_000000; // 50 USDC (6 decimals)
pub const TOTAL_PARTICIPANTS: u256 = 10;
pub const CYCLE_DURATION: u64 = 2592000; // 30 days in seconds

// Collateral formula constants
pub const COLLATERAL_FACTOR: u256 = 600; // 60% = 600 basis points
pub const BASIS_POINTS: u256 = 1000;

// Expected collateral values for standard configuration
// Position 1: Debt = $450, Collateral = $270
pub const POSITION_1_DEBT: u256 = 450_000000;
pub const POSITION_1_COLLATERAL: u256 = 270_000000;

// Position 5: Debt = $250, Collateral = $150
pub const POSITION_5_DEBT: u256 = 250_000000;
pub const POSITION_5_COLLATERAL: u256 = 150_000000;

// Position 10: Debt = $0, Collateral = $0
pub const POSITION_10_DEBT: u256 = 0;
pub const POSITION_10_COLLATERAL: u256 = 0;

// Minimum coverage ratio (108.9% for position 1)
pub const MIN_COVERAGE_RATIO: u256 = 108;

// Token decimals
pub const USDC_DECIMALS: u8 = 6;

// Test addresses
pub fn ADMIN() -> starknet::ContractAddress {
    starknet::contract_address_const::<'ADMIN'>()
}

pub fn MEMBER_1() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_1'>()
}

pub fn MEMBER_2() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_2'>()
}

pub fn MEMBER_3() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_3'>()
}

pub fn MEMBER_4() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_4'>()
}

pub fn MEMBER_5() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_5'>()
}

pub fn MEMBER_6() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_6'>()
}

pub fn MEMBER_7() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_7'>()
}

pub fn MEMBER_8() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_8'>()
}

pub fn MEMBER_9() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_9'>()
}

pub fn MEMBER_10() -> starknet::ContractAddress {
    starknet::contract_address_const::<'MEMBER_10'>()
}
