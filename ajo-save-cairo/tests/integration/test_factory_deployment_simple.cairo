// Simple test to verify factory deployment works
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};

#[test]
fn test_simple_factory_declare() {
    // Just verify we can declare the factory
    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let class_hash = *factory_class.class_hash;
    assert(class_hash != 0, 'Factory class hash is zero');
}
