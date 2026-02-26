use starknet::ContractAddress;
use ajo_save::interfaces::types::{Member, MemberStatus};

#[starknet::interface]
pub trait IAjoMembers<TContractState> {
    // Member management
    fn add_member(ref self: TContractState, member: ContractAddress, position: u256);
    fn remove_member(ref self: TContractState, member: ContractAddress);
    fn update_member_status(
        ref self: TContractState, member: ContractAddress, status: MemberStatus
    );

    // Guarantor network
    fn get_guarantor(self: @TContractState, member: ContractAddress) -> ContractAddress;
    fn calculate_guarantor_position(self: @TContractState, position: u256) -> u256;

    // View functions
    fn get_member(self: @TContractState, address: ContractAddress) -> Member;
    fn get_member_by_position(self: @TContractState, position: u256) -> Member;
    fn get_total_members(self: @TContractState) -> u256;
    fn get_member_count(self: @TContractState) -> u256;
    fn is_member(self: @TContractState, address: ContractAddress) -> bool;
    fn get_all_members(self: @TContractState) -> Span<Member>;

    // Payout tracking
    fn mark_payout_received(ref self: TContractState, member: ContractAddress);
    fn has_received_payout(self: @TContractState, member: ContractAddress) -> bool;
}
