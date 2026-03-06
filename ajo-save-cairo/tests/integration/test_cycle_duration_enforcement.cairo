use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address};
use starknet::{ContractAddress, contract_address_const};
use ajo_save::factory::ajo_factory::{IAjoFactoryDispatcher, IAjoFactoryDispatcherTrait};
use ajo_save::core::ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
use ajo_save::collateral::ajo_collateral::{IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait};
use ajo_save::payments::ajo_payments::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};
use ajo_save::interfaces::types::PaymentToken;
use ajo_save_tests::utils::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use ajo_save_tests::utils::test_helpers::deploy_mock_token;

fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn CREATOR() -> ContractAddress {
    contract_address_const::<'creator'>()
}

fn MEMBER_1() -> ContractAddress {
    contract_address_const::<'member_1'>()
}

fn MEMBER_2() -> ContractAddress {
    contract_address_const::<'member_2'>()
}

fn MEMBER_3() -> ContractAddress {
    contract_address_const::<'member_3'>()
}

fn MONTHLY() -> u256 {
    50_000000
}

fn TOTAL_PARTICIPANTS() -> u256 {
    3
}

fn TEST_CYCLE_DURATION() -> u64 {
    120 // 2 minutes for fast QA/integration tests
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

fn join_member(
    core_address: ContractAddress,
    collateral_address: ContractAddress,
    payments_address: ContractAddress,
    token_address: ContractAddress,
    token: IMockERC20Dispatcher,
    member: ContractAddress,
    position: u256
) {
    let collateral = IAjoCollateralDispatcher { contract_address: collateral_address };
    let required_collateral = collateral.calculate_required_collateral(
        position,
        MONTHLY(),
        TOTAL_PARTICIPANTS()
    );

    let approval_amount = required_collateral + (MONTHLY() * TOTAL_PARTICIPANTS());
    token.mint(member, approval_amount);

    start_cheat_caller_address(token_address, member);
    token.approve(collateral_address, approval_amount);
    token.approve(payments_address, approval_amount);

    let core = IAjoCoreDispatcher { contract_address: core_address };
    start_cheat_caller_address(core_address, member);
    core.join_ajo(0); // USDC token index
}

fn setup_three_member_ajo(
) -> (
    ContractAddress,
    IAjoCoreDispatcher,
    IAjoPaymentsDispatcher,
    ContractAddress
) {
    let (factory_address, factory) = deploy_factory();

    start_cheat_caller_address(factory_address, OWNER());

    let token_address = deploy_mock_token("USD Coin", "USDC", 6);
    let token = IMockERC20Dispatcher { contract_address: token_address };
    factory.set_usdc_token_address(token_address);

    start_cheat_caller_address(factory_address, CREATOR());
    let ajo_id = factory.create_ajo_and_initialize(
        'CycleDurationQA',
        MONTHLY(),
        TOTAL_PARTICIPANTS(),
        TEST_CYCLE_DURATION(),
        PaymentToken::USDC
    );

    let info = factory.get_ajo_info(ajo_id);
    let core = IAjoCoreDispatcher { contract_address: info.core_address };
    let payments = IAjoPaymentsDispatcher { contract_address: info.payments_address };

    join_member(
        info.core_address,
        info.collateral_address,
        info.payments_address,
        token_address,
        token,
        MEMBER_1(),
        1
    );
    join_member(
        info.core_address,
        info.collateral_address,
        info.payments_address,
        token_address,
        token,
        MEMBER_2(),
        2
    );
    join_member(
        info.core_address,
        info.collateral_address,
        info.payments_address,
        token_address,
        token,
        MEMBER_3(),
        3
    );

    // Auto-start should kick in once final member joins.
    assert(core.is_active(), 'Ajo should be active after final join');
    assert(payments.get_current_cycle() == 1, 'Cycle should start at 1');

    // All members pay in cycle 1.
    start_cheat_caller_address(info.core_address, MEMBER_1());
    core.process_payment();
    start_cheat_caller_address(info.core_address, MEMBER_2());
    core.process_payment();
    start_cheat_caller_address(info.core_address, MEMBER_3());
    core.process_payment();

    (info.core_address, core, payments, factory_address)
}

fn advance_time(seconds: u64) {
    let now = starknet::get_block_timestamp();
    starknet::testing::set_block_timestamp(now + seconds);
}

#[test]
fn test_fully_paid_cycle_does_not_auto_advance_before_duration() {
    let (core_address, core, payments, _) = setup_three_member_ajo();

    // Even after all members have paid, cycle remains unchanged until duration expires.
    assert(payments.get_current_cycle() == 1, 'Payments cycle should not auto-advance');
    assert(core.get_current_cycle() == 1, 'Core cycle should not auto-advance');

    start_cheat_caller_address(core_address, CREATOR());
    advance_time(TEST_CYCLE_DURATION());
    core.process_cycle(1);

    assert(payments.get_current_cycle() == 2, 'Payments cycle should advance after duration');
    assert(core.get_current_cycle() == 2, 'Core cycle should advance after duration');
}

#[test]
#[should_panic(expected: ('Cycle duration not elapsed',))]
fn test_process_cycle_reverts_before_duration_elapsed() {
    let (core_address, core, _, _) = setup_three_member_ajo();

    start_cheat_caller_address(core_address, CREATOR());
    // No time advance: cycle duration window has not elapsed yet.
    core.process_cycle(1);
}
