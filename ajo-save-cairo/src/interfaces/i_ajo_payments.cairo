use starknet::ContractAddress;

#[starknet::interface]
pub trait IAjoPayments<TContractState> {
    // Core authorization
    fn set_authorized_core(ref self: TContractState, core: ContractAddress);
    fn get_authorized_core(self: @TContractState) -> ContractAddress;

    // Payment processing
    fn make_payment(ref self: TContractState, cycle: u256, amount: u256);
    fn make_payment_for(
        ref self: TContractState, member: ContractAddress, cycle: u256, amount: u256
    );
    fn distribute_payout(ref self: TContractState, cycle: u256, recipient: ContractAddress);

    // Cycle management
    fn start_cycle(ref self: TContractState, cycle_number: u256);
    fn end_cycle(ref self: TContractState, cycle_number: u256);
    fn advance_cycle(ref self: TContractState);
    fn get_current_cycle(self: @TContractState) -> u256;
    fn get_cycle_start_time(self: @TContractState) -> u64;
    fn get_next_payout_position(self: @TContractState) -> u256;

    // Payment tracking
    fn has_paid_for_cycle(
        self: @TContractState, member: ContractAddress, cycle: u256
    ) -> bool;
    fn get_total_paid(self: @TContractState, member: ContractAddress) -> u256;
    fn get_cycle_contributions(self: @TContractState, cycle: u256) -> u256;
    fn get_payment_token(self: @TContractState) -> ContractAddress;

    // Payout tracking
    fn get_payout_recipient(self: @TContractState, cycle: u256) -> ContractAddress;
    fn calculate_payout_amount(self: @TContractState, cycle: u256) -> u256;

    // Default handling
    fn mark_default(ref self: TContractState, member: ContractAddress, cycle: u256);
    fn is_defaulted(self: @TContractState, member: ContractAddress) -> bool;
    fn seize_past_payments(ref self: TContractState, member: ContractAddress) -> u256;
    fn credit_default_reserve(ref self: TContractState, amount: u256);
    fn get_default_reserve(self: @TContractState) -> u256;
    fn get_cycle_shortfall(self: @TContractState, cycle: u256) -> u256;

    // Swap routing
    fn set_swap_router(ref self: TContractState, router: ContractAddress);
    fn get_swap_router(self: @TContractState) -> ContractAddress;
    fn enable_swap(ref self: TContractState);
    fn disable_swap(ref self: TContractState);
    fn is_swap_enabled(self: @TContractState) -> bool;
    fn set_token_preference(ref self: TContractState, token: ContractAddress);
    fn get_token_preference(
        self: @TContractState, member: ContractAddress
    ) -> ContractAddress;
}
