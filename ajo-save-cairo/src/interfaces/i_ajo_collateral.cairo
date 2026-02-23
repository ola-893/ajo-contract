use starknet::ContractAddress;

#[starknet::interface]
pub trait IAjoCollateral<TContractState> {
    // Collateral calculations (60% formula)
    fn calculate_required_collateral(
        self: @TContractState, position: u256, monthly_payment: u256, total_participants: u256
    ) -> u256;

    fn calculate_debt(
        self: @TContractState, position: u256, monthly_payment: u256, total_participants: u256
    ) -> u256;

    // Collateral management
    fn deposit_collateral(ref self: TContractState, amount: u256);
    fn withdraw_collateral(ref self: TContractState, amount: u256);
    fn slash_collateral(ref self: TContractState, member: ContractAddress, amount: u256);
    fn seize_collateral(ref self: TContractState, member: ContractAddress) -> u256;

    // View functions
    fn get_member_collateral(self: @TContractState, member: ContractAddress) -> u256;
    fn get_total_collateral(self: @TContractState) -> u256;
    fn is_collateral_sufficient(self: @TContractState, member: ContractAddress) -> bool;

    // Recovery functions
    fn calculate_recovery_assets(
        self: @TContractState, position: u256, monthly_payment: u256, total_participants: u256
    ) -> u256;

    fn get_coverage_ratio(
        self: @TContractState, position: u256, monthly_payment: u256, total_participants: u256
    ) -> u256;
}
