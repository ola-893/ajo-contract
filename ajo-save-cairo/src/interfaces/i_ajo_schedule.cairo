use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum ScheduleType {
    #[default]
    Payment,
    Payout,
    CycleStart,
    CycleEnd,
    CollateralCheck,
}

#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct ScheduledTask {
    pub id: u256,
    pub schedule_type: ScheduleType,
    pub execution_time: u64,
    pub target: ContractAddress,
    pub calldata: felt252,
    pub is_executed: bool,
    pub is_cancelled: bool,
}

#[starknet::interface]
pub trait IAjoSchedule<TContractState> {
    // Schedule management
    fn schedule_task(
        ref self: TContractState,
        schedule_type: ScheduleType,
        execution_time: u64,
        target: ContractAddress,
        calldata: felt252,
    ) -> u256;

    fn execute_task(ref self: TContractState, task_id: u256);
    fn cancel_task(ref self: TContractState, task_id: u256);

    // Automated scheduling for cycles
    fn schedule_cycle_payments(ref self: TContractState, cycle: u256, start_time: u64);
    fn schedule_payout(
        ref self: TContractState, cycle: u256, recipient: ContractAddress, payout_time: u64
    );

    // View functions
    fn get_task(self: @TContractState, task_id: u256) -> ScheduledTask;
    fn get_pending_tasks(self: @TContractState) -> Span<ScheduledTask>;
    fn is_task_ready(self: @TContractState, task_id: u256) -> bool;
    fn get_next_execution_time(self: @TContractState) -> u64;
}
