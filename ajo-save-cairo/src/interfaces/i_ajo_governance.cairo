use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum ProposalType {
    #[default]
    AddMember,
    RemoveMember,
    ChangeConfig,
    HandleDefault,
    Emergency,
}

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum ProposalStatus {
    Pending,
    #[default]
    Active,
    Passed,
    Rejected,
    Executed,
    Cancelled,
}

#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct Proposal {
    pub id: u256,
    pub proposer: ContractAddress,
    pub proposal_type: ProposalType,
    pub description: felt252,
    pub votes_for: u256,
    pub votes_against: u256,
    pub status: ProposalStatus,
    pub created_at: u64,
    pub voting_ends_at: u64,
}

#[starknet::interface]
pub trait IAjoGovernance<TContractState> {
    // Proposal creation
    fn create_proposal(
        ref self: TContractState,
        proposal_type: ProposalType,
        description: felt252,
        target: ContractAddress,
        calldata: Span<felt252>,
    ) -> u256;

    // Voting (on-chain via StarkNet events)
    fn cast_vote(ref self: TContractState, proposal_id: u256, support: bool);
    fn get_voting_power(self: @TContractState, voter: ContractAddress) -> u256;

    // Proposal execution
    fn execute_proposal(ref self: TContractState, proposal_id: u256);
    fn cancel_proposal(ref self: TContractState, proposal_id: u256);

    // View functions
    fn get_proposal(self: @TContractState, proposal_id: u256) -> Proposal;
    fn get_proposal_status(self: @TContractState, proposal_id: u256) -> ProposalStatus;
    fn has_voted(self: @TContractState, proposal_id: u256, voter: ContractAddress) -> bool;
    fn get_total_proposals(self: @TContractState) -> u256;

    // Governance parameters
    fn get_quorum(self: @TContractState) -> u256;
    fn get_voting_period(self: @TContractState) -> u64;
}
