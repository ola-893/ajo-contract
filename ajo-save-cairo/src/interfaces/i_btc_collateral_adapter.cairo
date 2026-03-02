use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum CommitmentStatus {
    #[default]
    Registered,
    Verified,
    EnforcementStarted,
    EnforcementConfirmed,
    Released,
}

#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct BTCCommitment {
    pub commitment_id: u256,
    pub member: ContractAddress,
    pub ajo_id: u256,
    pub amount: u256,
    pub btc_script_hash: felt252,
    pub proof_reference: felt252,
    pub status: CommitmentStatus,
    pub registered_at: u64,
    pub enforcement_tx_hash: felt252,
}

#[starknet::interface]
pub trait IBTCCollateralAdapter<TContractState> {
    // Authorization
    fn set_authorized_core(ref self: TContractState, core: ContractAddress);
    fn get_authorized_core(self: @TContractState) -> ContractAddress;

    // Commitment lifecycle
    fn register_commitment(
        ref self: TContractState,
        ajo_id: u256,
        member: ContractAddress,
        amount: u256,
        btc_script_hash: felt252,
        proof: Span<felt252>,
    ) -> u256;

    fn verify_commitment(
        ref self: TContractState, commitment_id: u256, verification_proof: Span<felt252>
    );

    fn start_enforcement(
        ref self: TContractState, commitment_id: u256, default_proof: Span<felt252>
    );

    fn confirm_enforcement(
        ref self: TContractState, commitment_id: u256, btc_tx_hash: felt252
    );

    fn release_commitment(ref self: TContractState, commitment_id: u256);

    // Query
    fn get_commitment(self: @TContractState, commitment_id: u256) -> BTCCommitment;
    fn get_member_commitment(self: @TContractState, member: ContractAddress) -> u256;
    fn get_commitment_status(self: @TContractState, commitment_id: u256) -> CommitmentStatus;

    // Configuration
    fn set_op_cat_verifier(ref self: TContractState, verifier: ContractAddress);
    fn get_op_cat_verifier(self: @TContractState) -> ContractAddress;

    // Emergency controls
    fn emergency_pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}
