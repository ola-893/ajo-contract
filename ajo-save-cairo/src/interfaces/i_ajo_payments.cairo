use starknet::ContractAddress;

#[starknet::interface]
pub trait IAjoPayments<TContractState> {
    // Payment processing
    fn make_payment(ref self: TContractState, cycle: u256, amount: u256);
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

    // Payout tracking
    fn get_payout_recipient(self: @TContractState, cycle: u256) -> ContractAddress;
    fn calculate_payout_amount(self: @TContractState, cycle: u256) -> u256;

    // Default handling
    fn mark_default(ref self: TContractState, member: ContractAddress, cycle: u256);
    fn is_defaulted(self: @TContractState, member: ContractAddress) -> bool;
    fn seize_past_payments(ref self: TContractState, member: ContractAddress) -> u256;
}
