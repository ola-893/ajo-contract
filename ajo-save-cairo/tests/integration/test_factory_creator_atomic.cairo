use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address};
use starknet::{ContractAddress, contract_address_const};
use ajo_save::factory::ajo_factory::{IAjoFactoryDispatcher, IAjoFactoryDispatcherTrait};
use ajo_save::interfaces::types::PaymentToken;

fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn CREATOR() -> ContractAddress {
    contract_address_const::<'creator'>()
}

fn ATTACKER() -> ContractAddress {
    contract_address_const::<'attacker'>()
}

fn MONTHLY() -> u256 {
    50_000000
}

fn TOTAL_PARTICIPANTS() -> u256 {
    5
}

fn CYCLE_DURATION() -> u64 {
    86400
}

fn deploy_factory() -> (ContractAddress, IAjoFactoryDispatcher) {
    let core_class = declare("AjoCore").unwrap().contract_class();
    let members_class = declare("AjoMembers").unwrap().contract_class();
    let collateral_class = declare("AjoCollateral").unwrap().contract_class();
    let payments_class = declare("AjoPayments").unwrap().contract_class();
    let governance_class = declare("AjoGovernance").unwrap().contract_class();
    let schedule_class = declare("AjoSchedule").unwrap().contract_class();

    let factory_class = declare("AjoFactory").unwrap().contract_class();
    let mut factory_calldata = array![];
    OWNER().serialize(ref factory_calldata);
    (*core_class.class_hash).serialize(ref factory_calldata);
    (*members_class.class_hash).serialize(ref factory_calldata);
    (*collateral_class.class_hash).serialize(ref factory_calldata);
    (*payments_class.class_hash).serialize(ref factory_calldata);
    (*governance_class.class_hash).serialize(ref factory_calldata);
    (*schedule_class.class_hash).serialize(ref factory_calldata);

    let (factory_address, _) = factory_class.deploy(@factory_calldata).unwrap();
    let factory = IAjoFactoryDispatcher { contract_address: factory_address };

    (factory_address, factory)
}

#[test]
fn test_atomic_create_and_initialize() {
    let (factory_address, factory) = deploy_factory();

    start_cheat_caller_address(factory_address, CREATOR());
    let ajo_id = factory.create_ajo_and_initialize(
        'AtomicAjo',
        MONTHLY(),
        TOTAL_PARTICIPANTS(),
        CYCLE_DURATION(),
        PaymentToken::USDC
    );

    let info = factory.get_ajo_info(ajo_id);
    assert(info.is_initialized, 'Ajo not initialized');
    assert(info.core_address.is_non_zero(), 'Core missing');
    assert(info.members_address.is_non_zero(), 'Members missing');
    assert(info.collateral_address.is_non_zero(), 'Collateral missing');
    assert(info.payments_address.is_non_zero(), 'Payments missing');
    assert(info.governance_address.is_non_zero(), 'Governance missing');
    assert(info.schedule_address.is_non_zero(), 'Schedule missing');
}

#[test]
#[should_panic(expected: ('Caller is not ajo creator',))]
fn test_non_creator_cannot_deploy_legacy_phase() {
    let (factory_address, factory) = deploy_factory();

    start_cheat_caller_address(factory_address, CREATOR());
    let ajo_id = factory.create_ajo(
        'LegacyAjo',
        MONTHLY(),
        TOTAL_PARTICIPANTS(),
        CYCLE_DURATION(),
        PaymentToken::USDC
    );

    start_cheat_caller_address(factory_address, ATTACKER());
    factory.deploy_members(ajo_id);
}

#[test]
fn test_creator_can_run_legacy_flow() {
    let (factory_address, factory) = deploy_factory();

    start_cheat_caller_address(factory_address, CREATOR());
    let ajo_id = factory.create_ajo(
        'CreatorLegacy',
        MONTHLY(),
        TOTAL_PARTICIPANTS(),
        CYCLE_DURATION(),
        PaymentToken::USDC
    );

    factory.deploy_members(ajo_id);
    factory.deploy_collateral_and_payments(ajo_id);
    factory.deploy_governance_and_schedule(ajo_id);
    factory.deploy_core(ajo_id);

    let info = factory.get_ajo_info(ajo_id);
    assert(info.is_initialized, 'Legacy flow not initialized');
}

#[test]
#[should_panic(expected: ('Phase already deployed',))]
fn test_redeploy_phase_fails() {
    let (factory_address, factory) = deploy_factory();

    start_cheat_caller_address(factory_address, CREATOR());
    let ajo_id = factory.create_ajo(
        'NoRedeploy',
        MONTHLY(),
        TOTAL_PARTICIPANTS(),
        CYCLE_DURATION(),
        PaymentToken::USDC
    );

    factory.deploy_members(ajo_id);
    factory.deploy_members(ajo_id);
}
