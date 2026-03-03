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
    use starknet::get_caller_address;
    use starknet::storage::Map;
    use core::array::ArrayTrait;
    use core::num::traits::Zero;
    use ajo_save::interfaces::i_ajo_schedule::{IAjoSchedule, ScheduledTask, ScheduleType};
    use ajo_save::interfaces::i_ajo_core::{IAjoCoreDispatcher, IAjoCoreDispatcherTrait};
    use ajo_save::interfaces::i_ajo_payments::IAjoPaymentsDispatcherTrait;
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
        cycle_payment_tasks: Map<u256, u256>,
        cycle_payout_tasks: Map<u256, u256>,
        authorized_core: ContractAddress,
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
        self.authorized_core.write(owner);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_core(self: @ContractState) {
            let caller = get_caller_address();
            let authorized = self.authorized_core.read();
            assert(caller == authorized, 'Only authorized core');
        }
    }

    #[abi(embed_v0)]
    impl AjoScheduleImpl of IAjoSchedule<ContractState> {
        fn set_authorized_core(ref self: ContractState, core: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!core.is_zero(), 'Core address is zero');
            self.authorized_core.write(core);
        }

        fn get_authorized_core(self: @ContractState) -> ContractAddress {
            self.authorized_core.read()
        }

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
                    // Calldata contains the defaulter address (felt252).
                    // This enables automated default handling from keeper executions.
                    let core = ajo_save::interfaces::i_ajo_core::IAjoCoreDispatcher {
                        contract_address: task.target
                    };
                    let defaulter: ContractAddress = task.calldata.try_into().unwrap();
                    assert(!defaulter.is_zero(), 'Invalid defaulter address');
                    core.handle_default(defaulter);
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
            InternalImpl::assert_only_core(@self);

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
            InternalImpl::assert_only_core(@self);

            let current_time = starknet::get_block_timestamp();
            assert(start_time >= current_time, 'Start time must be future');

            let core_address = self.authorized_core.read();
            assert(!core_address.is_zero(), 'Core not configured');

            let core = IAjoCoreDispatcher { contract_address: core_address };
            let config = core.get_config();
            let execution_time = start_time + config.cycle_duration;

            let task_id = self.schedule_count.read() + 1;
            self.schedule_count.write(task_id);

            let cycle_as_felt: felt252 = cycle.try_into().unwrap();
            let task = ScheduledTask {
                id: task_id,
                schedule_type: ScheduleType::Payout,
                execution_time,
                target: core_address,
                calldata: cycle_as_felt,
                is_executed: false,
                is_cancelled: false,
            };

            self.schedules.write(task_id, task);
            self.cycle_payment_tasks.write(cycle, task_id);
            self.emit(TaskScheduled {
                task_id,
                schedule_type: ScheduleType::Payout,
                execution_time,
                target: core_address,
            });
        }

        fn schedule_payout(
            ref self: ContractState, cycle: u256, recipient: ContractAddress, payout_time: u64
        ) {
            InternalImpl::assert_only_core(@self);

            let current_time = starknet::get_block_timestamp();
            assert(payout_time > current_time, 'Payout time must be future');
            assert(!recipient.is_zero(), 'Recipient cannot be zero');

            let core_address = self.authorized_core.read();
            assert(!core_address.is_zero(), 'Core not configured');

            let task_id = self.schedule_count.read() + 1;
            self.schedule_count.write(task_id);

            let cycle_as_felt: felt252 = cycle.try_into().unwrap();
            let task = ScheduledTask {
                id: task_id,
                schedule_type: ScheduleType::Payout,
                execution_time: payout_time,
                target: core_address,
                calldata: cycle_as_felt,
                is_executed: false,
                is_cancelled: false,
            };

            self.schedules.write(task_id, task);
            self.cycle_payout_tasks.write(cycle, task_id);
            self.emit(TaskScheduled {
                task_id,
                schedule_type: ScheduleType::Payout,
                execution_time: payout_time,
                target: core_address,
            });
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
            let total_tasks = self.schedule_count.read();
            if total_tasks == 0 {
                return 0;
            }

            let mut task_id: u256 = 1;
            let mut next_time: u64 = 0;

            loop {
                if task_id > total_tasks {
                    break;
                }

                let task = self.schedules.read(task_id);
                if task.id != 0 && !task.is_executed && !task.is_cancelled {
                    if next_time == 0 || task.execution_time < next_time {
                        next_time = task.execution_time;
                    }
                }

                task_id += 1;
            };

            next_time
        }
    }
}
