use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum BridgeRequestStatus {
    #[default]
    Pending,
    Finalized,
    Cancelled,
}

#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct DepositRequest {
    pub request_id: u256,
    pub ajo_id: u256,
    pub member: ContractAddress,
    pub amount: u256,
    pub btc_tx_hash: felt252,
    pub status: BridgeRequestStatus,
    pub timestamp: u64,
}

#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct WithdrawalRequest {
    pub request_id: u256,
    pub ajo_id: u256,
    pub member: ContractAddress,
    pub amount: u256,
    pub btc_address: felt252,
    pub nonce: u256,
    pub status: BridgeRequestStatus,
    pub timestamp: u64,
    pub btc_tx_hash: felt252,
}

#[starknet::interface]
pub trait IBridgeAdapter<TContractState> {
    // Core authorization
    fn set_authorized_core(ref self: TContractState, core: ContractAddress);
    fn get_authorized_core(self: @TContractState) -> ContractAddress;

    // Deposit lifecycle
    fn register_deposit(
        ref self: TContractState,
        ajo_id: u256,
        member: ContractAddress,
        amount: u256,
        btc_tx_hash: felt252,
        proof: Span<felt252>,
    ) -> u256;
    fn finalize_deposit(ref self: TContractState, request_id: u256);

    // Withdrawal lifecycle
    fn request_withdrawal(
        ref self: TContractState, ajo_id: u256, amount: u256, btc_address: felt252
    ) -> u256;
    fn finalize_withdrawal(
        ref self: TContractState, request_id: u256, btc_tx_hash: felt252
    );
    fn cancel_withdrawal(ref self: TContractState, request_id: u256);

    // Query
    fn get_deposit_request(self: @TContractState, request_id: u256) -> DepositRequest;
    fn get_withdrawal_request(self: @TContractState, request_id: u256) -> WithdrawalRequest;
    fn get_request_status(self: @TContractState, request_id: u256) -> BridgeRequestStatus;

    // Configuration
    fn set_bridge_relayer(ref self: TContractState, relayer: ContractAddress);
    fn get_bridge_relayer(self: @TContractState) -> ContractAddress;

    // Emergency controls
    fn emergency_pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}
