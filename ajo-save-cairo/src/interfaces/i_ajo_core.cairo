use starknet::ContractAddress;
use ajo_save::interfaces::types::{AjoConfig, Member, AjoStatus, MemberInfo, CycleInfo};

#[starknet::interface]
pub trait IAjoCore<TContractState> {
    // Initialization
    fn initialize(
        ref self: TContractState,
        config: AjoConfig,
        members_address: ContractAddress,
        collateral_address: ContractAddress,
        payments_address: ContractAddress,
        governance_address: ContractAddress,
        schedule_address: ContractAddress,
    );

    // Core orchestration functions
    fn join_ajo(ref self: TContractState, token_index: u256);
    fn start_ajo(ref self: TContractState);
    fn process_payment(ref self: TContractState);
    fn process_cycle(ref self: TContractState, cycle_number: u256);
    fn handle_default(ref self: TContractState, defaulter: ContractAddress);
    fn exit_ajo(ref self: TContractState);
    fn finalize_ajo(ref self: TContractState);

    // View functions
    fn get_config(self: @TContractState) -> AjoConfig;
    fn get_current_cycle(self: @TContractState) -> u256;
    fn is_active(self: @TContractState) -> bool;
    fn get_members_address(self: @TContractState) -> ContractAddress;
    fn get_collateral_address(self: @TContractState) -> ContractAddress;
    fn get_payments_address(self: @TContractState) -> ContractAddress;
    fn get_governance_address(self: @TContractState) -> ContractAddress;
    fn get_schedule_address(self: @TContractState) -> ContractAddress;

    // Query functions (aggregate data from all modules)
    fn get_ajo_status(self: @TContractState) -> AjoStatus;
    fn get_member_info(self: @TContractState, member: ContractAddress) -> MemberInfo;
    fn get_cycle_info(self: @TContractState) -> CycleInfo;

    // Emergency functions
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}
