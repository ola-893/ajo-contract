use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};
use starknet::{ContractAddress, ClassHash};

#[test]
fn test_factory_smoke_test() {
    // This is a simple smoke test to verify the testing framework is working
    // We'll just verify we can declare a contract class
    
    // Try to declare the AjoFactory contract
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    
    // Verify we got a valid class hash
    let class_hash: ClassHash = (*factory_class.class_hash).try_into().unwrap();
    assert(class_hash.into() != 0, 'Factory class hash is zero');
}

#[test]
fn test_basic_arithmetic() {
    // Simple test to verify test framework basics
    let a: u256 = 10;
    let b: u256 = 20;
    let sum = a + b;
    assert(sum == 30, 'Basic arithmetic failed');
}

#[test]
fn test_collateral_formula_constants() {
    // Test that our formula constants are correct
    let collateral_factor: u256 = 600; // 60%
    let basis_points: u256 = 1000;
    
    // Test 60% calculation
    let debt: u256 = 450_000000; // $450 (6 decimals)
    let expected_collateral: u256 = 270_000000; // $270 (6 decimals)
    let calculated_collateral = (debt * collateral_factor) / basis_points;
    
    assert(calculated_collateral == expected_collateral, 'Collateral formula wrong');
}
