use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum SwapStatus {
    #[default]
    Pending,
    Executed,
    Cancelled,
    Failed,
}

#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct SwapRequest {
    pub request_id: u256,
    pub ajo_id: u256,
    pub requester: ContractAddress,
    pub recipient: ContractAddress,
    pub source_token: ContractAddress,
    pub dest_token: ContractAddress,
    pub source_amount: u256,
    pub min_dest_amount: u256,
    pub deadline: u64,
    pub status: SwapStatus,
    pub actual_dest_amount: u256,
    pub created_at: u64,
}

#[starknet::interface]
pub trait ISwapRouter<TContractState> {
    // Authorization
    fn set_authorized_executor(ref self: TContractState, executor: ContractAddress);
    fn get_authorized_executor(self: @TContractState) -> ContractAddress;

    // Quote and execution
    fn get_quote(
        self: @TContractState, source_token: ContractAddress, dest_token: ContractAddress, amount: u256
    ) -> u256;
    fn execute_swap(
        ref self: TContractState,
        ajo_id: u256,
        recipient: ContractAddress,
        source_token: ContractAddress,
        dest_token: ContractAddress,
        source_amount: u256,
        min_dest_amount: u256,
        deadline: u64,
    ) -> u256;
    fn cancel_swap(ref self: TContractState, request_id: u256);

    // Query
    fn get_swap_request(self: @TContractState, request_id: u256) -> SwapRequest;
    fn get_swap_status(self: @TContractState, request_id: u256) -> SwapStatus;

    // Config
    fn set_dex_router(ref self: TContractState, router: ContractAddress);
    fn get_dex_router(self: @TContractState) -> ContractAddress;
}
