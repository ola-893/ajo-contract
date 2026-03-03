use starknet::ContractAddress;
use ajo_save::interfaces::types::{AjoConfig, AjoStatus, MemberInfo, CycleInfo, CollateralMode};

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
    fn governance_add_member(
        ref self: TContractState, member: ContractAddress, position: u256
    );
    fn governance_remove_member(ref self: TContractState, member: ContractAddress);
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
    fn get_payment_token_address(self: @TContractState) -> ContractAddress;
    fn get_payment_token_decimals(self: @TContractState) -> u8;
    fn get_bridge_adapter(self: @TContractState) -> ContractAddress;
    fn is_bridge_enabled(self: @TContractState) -> bool;
    fn get_swap_router(self: @TContractState) -> ContractAddress;
    fn is_swap_enabled(self: @TContractState) -> bool;
    fn get_btc_collateral_adapter(self: @TContractState) -> ContractAddress;
    fn is_btc_commitment_enabled(self: @TContractState) -> bool;
    fn get_collateral_mode(self: @TContractState) -> CollateralMode;

    // Query functions (aggregate data from all modules)
    fn get_ajo_status(self: @TContractState) -> AjoStatus;
    fn get_member_info(self: @TContractState, member: ContractAddress) -> MemberInfo;
    fn get_cycle_info(self: @TContractState) -> CycleInfo;

    // Emergency functions
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);

    // Admin token config
    fn set_payment_token_address(
        ref self: TContractState, token_address: ContractAddress, decimals: u8
    );
    fn set_bridge_adapter(ref self: TContractState, bridge_adapter: ContractAddress);
    fn enable_bridge(ref self: TContractState);
    fn disable_bridge(ref self: TContractState);
    fn set_swap_router(ref self: TContractState, swap_router: ContractAddress);
    fn enable_swap(ref self: TContractState);
    fn disable_swap(ref self: TContractState);
    fn set_btc_collateral_adapter(
        ref self: TContractState, btc_collateral_adapter: ContractAddress
    );
    fn enable_btc_commitment(ref self: TContractState);
    fn disable_btc_commitment(ref self: TContractState);
    fn set_collateral_mode(ref self: TContractState, mode: CollateralMode);
    fn emergency_disable_bridge(ref self: TContractState);
    fn emergency_disable_swap(ref self: TContractState);
    fn emergency_disable_btc_collateral(ref self: TContractState);
}
