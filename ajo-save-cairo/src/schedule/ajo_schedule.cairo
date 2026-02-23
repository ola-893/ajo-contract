// AjoSchedule - Time-based execution (replaces Hedera HSS)
// Uses keeper pattern for automated execution
// Key features:
// - Schedule task creation
// - Time-based execution checks
// - Automated cycle payments
// - Payout scheduling

#[starknet::contract]
pub mod AjoSchedule {
    use starknet::ContractAddress;
    use starknet::storage::Map;
    use core::array::ArrayTrait;
    use core::num::traits::Zero;
    use ajo_save::interfaces::i_ajo_schedule::{IAjoSchedule, ScheduledTask, ScheduleType};
    use ajo_save::interfaces::i_ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
    use ajo_save::interfaces::i_ajo_payments::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};
    use ajo_save::components::ownable::OwnableComponent;

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Schedule tracking
        schedule_count: u256,
        schedules: Map<u256, ScheduledTask>,
        // Components
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TaskScheduled: TaskScheduled,
        TaskExecuted: TaskExecuted,
        TaskCancelled: TaskCancelled,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TaskScheduled {
        #[key]
        pub task_id: u256,
        pub schedule_type: ScheduleType,
        pub execution_time: u64,
        pub target: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TaskExecuted {
        #[key]
        pub task_id: u256,
        pub executed_at: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TaskCancelled {
        #[key]
        pub task_id: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
        self.schedule_count.write(0);
    }

    #[abi(embed_v0)]
    impl AjoScheduleImpl of IAjoSchedule<ContractState> {
        fn schedule_task(
            ref self: ContractState,
            schedule_type: ScheduleType,
            execution_time: u64,
            target: ContractAddress,
            calldata: felt252,
        ) -> u256 {
            // Validate execution_time is in future
            let current_time = starknet::get_block_timestamp();
            assert(execution_time > current_time, 'Execution time must be future');

            // Validate target address is not zero
            assert(!target.is_zero(), 'Invalid target address');

            // Increment schedule count
            let task_id = self.schedule_count.read() + 1;
            self.schedule_count.write(task_id);

            // Create ScheduledTask struct
            let task = ScheduledTask {
                id: task_id,
                schedule_type,
                execution_time,
                target,
                calldata,
                is_executed: false,
                is_cancelled: false,
            };

            // Store in schedules mapping
            self.schedules.write(task_id, task);

            // Emit TaskScheduled event
            self.emit(TaskScheduled { task_id, schedule_type, execution_time, target });

            task_id
        }

        fn execute_task(ref self: ContractState, task_id: u256) {
            // NOTE: This function can be called by anyone after the execution time
            // This is the keeper pattern - incentivized bots monitor and execute tasks
            // Replaces Hedera Schedule Service (HSS) with no 62-day limit
            
            // Verify task is executable (is_task_ready checks time, executed status, and cancelled status)
            assert(self.is_task_ready(task_id), 'Task not ready for execution');

            // Get the scheduled task
            let mut task = self.schedules.read(task_id);

            // Execute task based on schedule_type
            match task.schedule_type {
                ScheduleType::Payment => {
                    // ProcessPayment: Call process_payment on target (AjoCore)
                    let core = ajo_save::interfaces::i_ajo_core::IAjoCoreDispatcher {
                        contract_address: task.target
                    };
                    core.process_payment();
                },
                ScheduleType::Payout => {
                    // DistributePayout: Call process_cycle on target (AjoCore) to distribute payout
                    // The calldata contains the cycle number
                    let core = ajo_save::interfaces::i_ajo_core::IAjoCoreDispatcher {
                        contract_address: task.target
                    };
                    let cycle: u256 = task.calldata.into();
                    core.process_cycle(cycle);
                },
                ScheduleType::CycleStart => {
                    // AdvanceCycle: Call start_cycle on payments contract
                    let payments = ajo_save::interfaces::i_ajo_payments::IAjoPaymentsDispatcher {
                        contract_address: task.target
                    };
                    let cycle: u256 = task.calldata.into();
                    payments.start_cycle(cycle);
                },
                ScheduleType::CycleEnd => {
                    // End cycle: Call end_cycle on payments contract
                    let payments = ajo_save::interfaces::i_ajo_payments::IAjoPaymentsDispatcher {
                        contract_address: task.target
                    };
                    let cycle: u256 = task.calldata.into();
                    payments.end_cycle(cycle);
                },
                ScheduleType::CollateralCheck => {
                    // Collateral verification: This is a placeholder for future implementation
                    // Could be used to trigger automated collateral checks or default detection
                    // The calldata would contain parameters for the check
                    // For now, this is a no-op that just marks the task as executed
                    // In production, this could call handle_default or other verification functions
                },
            }

            // Mark task as executed
            task.is_executed = true;
            self.schedules.write(task_id, task);

            // Emit TaskExecuted event
            let executed_at = starknet::get_block_timestamp();
            self.emit(TaskExecuted { task_id, executed_at });
        }

        fn cancel_task(ref self: ContractState, task_id: u256) {
            // Owner-only access control
            self.ownable.assert_only_owner();

            // Get the scheduled task
            let mut task = self.schedules.read(task_id);

            // Verify task exists
            assert(task.id != 0, 'Task does not exist');

            // Verify task is not already executed
            assert(!task.is_executed, 'Task already executed');

            // Verify task is not already cancelled
            assert(!task.is_cancelled, 'Task already cancelled');

            // Mark task as cancelled
            task.is_cancelled = true;
            self.schedules.write(task_id, task);

            // Emit TaskCancelled event
            self.emit(TaskCancelled { task_id });
        }

        fn schedule_cycle_payments(ref self: ContractState, cycle: u256, start_time: u64) {
            // TODO: Implement schedule_cycle_payments
            panic!("Not implemented");
        }

        fn schedule_payout(
            ref self: ContractState, cycle: u256, recipient: ContractAddress, payout_time: u64
        ) {
            // TODO: Implement schedule_payout
            panic!("Not implemented");
        }

        fn get_task(self: @ContractState, task_id: u256) -> ScheduledTask {
            self.schedules.read(task_id)
        }

        fn get_pending_tasks(self: @ContractState) -> Span<ScheduledTask> {
            // Returns array of tasks that are executable but not yet executed
            // A task is pending if:
            // 1. Current time >= execution_time
            // 2. is_executed == false
            // 3. is_cancelled == false
            
            let mut pending_tasks: Array<ScheduledTask> = ArrayTrait::new();
            let total_tasks = self.schedule_count.read();
            let current_time = starknet::get_block_timestamp();
            
            // Iterate through all tasks
            let mut task_id: u256 = 1;
            loop {
                if task_id > total_tasks {
                    break;
                }
                
                let task = self.schedules.read(task_id);
                
                // Check if task is pending (executable but not executed)
                if task.id != 0 // Task exists
                    && current_time >= task.execution_time // Time has come
                    && !task.is_executed // Not yet executed
                    && !task.is_cancelled { // Not cancelled
                    pending_tasks.append(task);
                }
                
                task_id += 1;
            };
            
            pending_tasks.span()
        }

        fn is_task_ready(self: @ContractState, task_id: u256) -> bool {
            // Get the scheduled task
            let task = self.schedules.read(task_id);
            
            // Check if task exists (id should match)
            if task.id == 0 {
                return false;
            }
            
            // Get current block timestamp
            let current_time = starknet::get_block_timestamp();
            
            // Check if current time >= execution_time AND task is not already executed AND not cancelled
            current_time >= task.execution_time && !task.is_executed && !task.is_cancelled
        }

        fn get_next_execution_time(self: @ContractState) -> u64 {
            // TODO: Implement get_next_execution_time
            panic!("Not implemented");
        }
    }
}
