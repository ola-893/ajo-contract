use starknet::{ContractAddress, ClassHash};
use ajo_save::interfaces::types::{AjoInfo, PaymentToken};

#[starknet::interface]
pub trait IAjoFactory<TContractState> {
    // Phase 1: Create Ajo with basic config
    fn create_ajo(
        ref self: TContractState,
        name: felt252,
        monthly_contribution: u256,
        total_participants: u256,
        cycle_duration: u64,
        payment_token: PaymentToken,
    ) -> u256;

    // Atomic create + full initialization in one transaction
    fn create_ajo_and_initialize(
        ref self: TContractState,
        name: felt252,
        monthly_contribution: u256,
        total_participants: u256,
        cycle_duration: u64,
        payment_token: PaymentToken,
    ) -> u256;

    // Phase 2: Deploy core contract
    fn deploy_core(ref self: TContractState, ajo_id: u256) -> ContractAddress;

    // Phase 3: Deploy member management
    fn deploy_members(ref self: TContractState, ajo_id: u256) -> ContractAddress;

    // Phase 4: Deploy collateral & payments
    fn deploy_collateral_and_payments(
        ref self: TContractState, ajo_id: u256
    ) -> (ContractAddress, ContractAddress);

    // Phase 5: Deploy governance & schedule
    fn deploy_governance_and_schedule(
        ref self: TContractState, ajo_id: u256
    ) -> (ContractAddress, ContractAddress);

    // View functions
    fn get_ajo_info(self: @TContractState, ajo_id: u256) -> AjoInfo;
    fn get_user_ajos(self: @TContractState, user: ContractAddress) -> Span<u256>;
    fn get_total_ajos(self: @TContractState) -> u256;

    // Admin functions
    fn set_core_class_hash(ref self: TContractState, class_hash: ClassHash);
    fn set_members_class_hash(ref self: TContractState, class_hash: ClassHash);
    fn set_collateral_class_hash(ref self: TContractState, class_hash: ClassHash);
    fn set_payments_class_hash(ref self: TContractState, class_hash: ClassHash);
    fn set_governance_class_hash(ref self: TContractState, class_hash: ClassHash);
    fn set_schedule_class_hash(ref self: TContractState, class_hash: ClassHash);

    // Token configuration
    fn set_usdc_token_address(ref self: TContractState, token_address: ContractAddress);
    fn set_btc_token_address(ref self: TContractState, token_address: ContractAddress);
    fn get_usdc_token_address(self: @TContractState) -> ContractAddress;
    fn get_btc_token_address(self: @TContractState) -> ContractAddress;
}
