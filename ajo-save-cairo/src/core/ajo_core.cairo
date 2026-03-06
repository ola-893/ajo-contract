// AjoCore - Main orchestration contract
// This contract coordinates all other modules and manages the Ajo lifecycle

#[starknet::contract]
pub mod AjoCore {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use ajo_save::interfaces::types::{AjoConfig, PaymentToken, MemberStatus, AjoStatus, MemberInfo, CycleInfo, CollateralMode};
    use ajo_save::interfaces::i_ajo_core::IAjoCore;
    use ajo_save::interfaces::i_ajo_members::{IAjoMembersDispatcher, IAjoMembersDispatcherTrait};
    use ajo_save::interfaces::i_ajo_collateral::{IAjoCollateralDispatcher, IAjoCollateralDispatcherTrait};
    use ajo_save::interfaces::i_ajo_payments::{IAjoPaymentsDispatcher, IAjoPaymentsDispatcherTrait};
    use ajo_save::interfaces::i_ajo_governance::{
        IAjoGovernanceDispatcher, IAjoGovernanceDispatcherTrait, ProposalStatus
    };
    use ajo_save::components::ownable::{OwnableComponent, IOwnable};
    use ajo_save::components::pausable::{PausableComponent, IPausable};
    use ajo_save::components::reentrancy_guard::ReentrancyGuardComponent;

    // Component declarations
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

    // Component implementations
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // Don't embed PausableImpl in ABI - we provide custom pause/unpause with owner checks
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Configuration variables
        ajo_id: u256,
        name: felt252,
        monthly_contribution: u256,
        total_participants: u256,
        cycle_duration: u64,
        payment_token: PaymentToken,
        payment_token_address: ContractAddress,
        payment_token_decimals: u8,
        
        // Module addresses
        members_contract: ContractAddress,
        collateral_contract: ContractAddress,
        payments_contract: ContractAddress,
        governance_contract: ContractAddress,
        schedule_contract: ContractAddress,
        bridge_adapter: ContractAddress,
        bridge_enabled: bool,
        swap_router: ContractAddress,
        swap_enabled: bool,
        btc_collateral_adapter: ContractAddress,
        btc_commitment_enabled: bool,
        collateral_mode: CollateralMode,
        
        // State variables
        is_active: bool,
        current_cycle: u256,
        initialized: bool,
        authorized_initializer: ContractAddress,
        
        // Components
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        AjoInitialized: AjoInitialized,
        AjoStarted: AjoStarted,
        MemberJoined: MemberJoined,
        PaymentProcessed: PaymentProcessed,
        PayoutDistributed: PayoutDistributed,
        DefaultHandled: DefaultHandled,
        MemberExited: MemberExited,
        AjoFinalized: AjoFinalized,
        CollateralModeChanged: CollateralModeChanged,
        AdapterAddressUpdated: AdapterAddressUpdated,
        FeatureFlagToggled: FeatureFlagToggled,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AjoInitialized {
        #[key]
        pub ajo_id: u256,
        pub name: felt252,
        pub monthly_contribution: u256,
        pub total_participants: u256,
        pub cycle_duration: u64,
        pub members_address: ContractAddress,
        pub collateral_address: ContractAddress,
        pub payments_address: ContractAddress,
        pub governance_address: ContractAddress,
        pub schedule_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AjoStarted {
        #[key]
        pub ajo_id: u256,
        pub cycle: u256,
        pub member_count: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MemberJoined {
        #[key]
        pub ajo_id: u256,
        #[key]
        pub member: ContractAddress,
        pub position: u256,
        pub collateral_amount: u256,
        pub guarantor: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentProcessed {
        #[key]
        pub ajo_id: u256,
        #[key]
        pub member: ContractAddress,
        pub cycle: u256,
        pub amount: u256,
        pub all_paid: bool,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutDistributed {
        #[key]
        pub ajo_id: u256,
        #[key]
        pub recipient: ContractAddress,
        pub cycle: u256,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DefaultHandled {
        #[key]
        pub ajo_id: u256,
        #[key]
        pub defaulter: ContractAddress,
        #[key]
        pub guarantor: ContractAddress,
        pub defaulter_collateral_seized: u256,
        pub guarantor_collateral_seized: u256,
        pub defaulter_past_payments_seized: u256,
        pub guarantor_past_payments_seized: u256,
        pub total_seized: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MemberExited {
        #[key]
        pub ajo_id: u256,
        #[key]
        pub member: ContractAddress,
        pub penalty_amount: u256,
        pub refund_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AjoFinalized {
        #[key]
        pub ajo_id: u256,
        pub final_cycle: u256,
        pub total_members: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralModeChanged {
        pub old_mode: CollateralMode,
        pub new_mode: CollateralMode,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AdapterAddressUpdated {
        pub adapter_type: felt252,
        pub adapter_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FeatureFlagToggled {
        pub feature: felt252,
        pub enabled: bool,
    }

    #[constructor]
    fn constructor(ref self: ContractState, factory_address: ContractAddress) {
        assert(!factory_address.is_zero(), 'Factory address cannot be zero');
        self.initialized.write(false);
        self.authorized_initializer.write(factory_address);
        self.is_active.write(false);
        self.current_cycle.write(0);
    }

    #[abi(embed_v0)]
    impl AjoCoreImpl of IAjoCore<ContractState> {
        fn initialize(
            ref self: ContractState,
            config: AjoConfig,
            members_address: ContractAddress,
            collateral_address: ContractAddress,
            payments_address: ContractAddress,
            governance_address: ContractAddress,
            schedule_address: ContractAddress,
        ) {
            assert(!self.initialized.read(), 'Already initialized');
            let caller = starknet::get_caller_address();
            assert(caller == self.authorized_initializer.read(), 'Unauthorized initializer');

            // Validate all module addresses are non-zero
            assert(!members_address.is_zero(), 'Members addr cannot be zero');
            assert(!collateral_address.is_zero(), 'Collateral addr cannot be 0');
            assert(!payments_address.is_zero(), 'Payments addr cannot be zero');
            assert(!governance_address.is_zero(), 'Governance addr cannot be 0');
            assert(!schedule_address.is_zero(), 'Schedule addr cannot be zero');

            // Store configuration
            self.name.write(config.name);
            self.monthly_contribution.write(config.monthly_contribution);
            self.total_participants.write(config.total_participants);
            self.cycle_duration.write(config.cycle_duration);
            self.payment_token.write(config.payment_token);
            match config.payment_token {
                PaymentToken::USDC => {
                    self.payment_token_decimals.write(6);
                },
                PaymentToken::BTC => {
                    self.payment_token_decimals.write(8);
                },
            };
            // Token address is configured explicitly by owner post-deploy.
            self.payment_token_address.write(Zero::zero());
            
            // Store module addresses
            self.members_contract.write(members_address);
            self.collateral_contract.write(collateral_address);
            self.payments_contract.write(payments_address);
            self.governance_contract.write(governance_address);
            self.schedule_contract.write(schedule_address);
            self.bridge_adapter.write(Zero::zero());
            self.bridge_enabled.write(false);
            self.swap_router.write(Zero::zero());
            self.swap_enabled.write(false);
            self.btc_collateral_adapter.write(Zero::zero());
            self.btc_commitment_enabled.write(false);
            self.collateral_mode.write(config.collateral_mode);

            // Initialize state variables
            self.is_active.write(false);
            self.current_cycle.write(0);
            self.initialized.write(true);

            // Set owner
            self.ownable.initializer(config.creator);

            // Emit AjoInitialized event
            self.emit(AjoInitialized {
                ajo_id: self.ajo_id.read(),
                name: config.name,
                monthly_contribution: config.monthly_contribution,
                total_participants: config.total_participants,
                cycle_duration: config.cycle_duration,
                members_address,
                collateral_address,
                payments_address,
                governance_address,
                schedule_address,
            });
        }

        fn join_ajo(ref self: ContractState, token_index: u256) {
            // Apply reentrancy protection
            self.reentrancy_guard.start();

            // Validate token selection against configured payment token.
            match self.payment_token.read() {
                PaymentToken::USDC => {
                    assert(token_index == 0, 'Token mismatch: expected USDC');
                },
                PaymentToken::BTC => {
                    assert(token_index == 1, 'Token mismatch: expected BTC');
                },
            };
            
            // Verify Ajo is not full
            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            let current_member_count = members_dispatcher.get_total_members();
            let total_participants = self.total_participants.read();
            assert(current_member_count < total_participants, 'Ajo is full');
            
            // Verify caller is not already a member
            let caller = starknet::get_caller_address();
            assert(!members_dispatcher.is_member(caller), 'Already a member');
            
            // Calculate next available position (1-indexed)
            let next_position = current_member_count + 1;
            
            // Add member to members contract
            members_dispatcher.add_member(caller, next_position);
            
            // Calculate required collateral via AjoCollateral
            let collateral_dispatcher = IAjoCollateralDispatcher {
                contract_address: self.collateral_contract.read()
            };
            let monthly_contribution = self.monthly_contribution.read();
            let required_collateral = collateral_dispatcher.calculate_required_collateral(
                next_position,
                monthly_contribution,
                total_participants
            );
            
            // Last position can have zero debt => zero required collateral.
            // Skip deposit syscall in that case to avoid amount>0 reverts.
            if required_collateral > 0 {
                // Deposit collateral (this will transfer tokens from caller)
                collateral_dispatcher.deposit_collateral_for(caller, required_collateral);
            }
            
            // Get guarantor for event emission
            let guarantor = members_dispatcher.get_guarantor(caller);
            
            // Emit MemberJoined event
            self.emit(MemberJoined {
                ajo_id: self.ajo_id.read(),
                member: caller,
                position: next_position,
                collateral_amount: required_collateral,
                guarantor,
            });

            // Auto-start the Ajo when membership reaches configured capacity.
            // This removes manual start endpoint dependency from user flows.
            let updated_member_count = members_dispatcher.get_total_members();
            if !self.is_active.read() && updated_member_count == total_participants {
                let payments_dispatcher = IAjoPaymentsDispatcher {
                    contract_address: self.payments_contract.read()
                };
                payments_dispatcher.start_cycle(1);

                self.is_active.write(true);
                self.current_cycle.write(1);

                self.emit(AjoStarted {
                    ajo_id: self.ajo_id.read(),
                    cycle: 1,
                    member_count: updated_member_count,
                });
            }
            
            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        fn start_ajo(ref self: ContractState) {
            assert(1 == 0, 'Auto start only');
        }

        fn process_payment(ref self: ContractState) {
            // Apply reentrancy protection
            self.reentrancy_guard.start();

            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };

            // Compatibility fallback:
            // if an Ajo is full but not active yet, auto-start on first payment attempt.
            if !self.is_active.read() {
                let total_participants = self.total_participants.read();
                let member_count = members_dispatcher.get_total_members();
                assert(member_count == total_participants, 'Ajo is not active');

                let payments_dispatcher = IAjoPaymentsDispatcher {
                    contract_address: self.payments_contract.read()
                };
                payments_dispatcher.start_cycle(1);

                self.is_active.write(true);
                self.current_cycle.write(1);

                self.emit(AjoStarted {
                    ajo_id: self.ajo_id.read(),
                    cycle: 1,
                    member_count,
                });
            }

            // Verify caller is a member
            let caller = starknet::get_caller_address();
            assert(members_dispatcher.is_member(caller), 'Caller is not a member');
            
            // Get current cycle from payments contract
            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };
            let current_cycle = payments_dispatcher.get_current_cycle();
            
            // Get monthly contribution amount
            let amount = self.monthly_contribution.read();
            
            // Call AjoPayments.make_payment() to record the payment
            payments_dispatcher.make_payment_for(caller, current_cycle, amount);
            
            // Check if all members have paid for this cycle
            let all_paid = payments_dispatcher.get_cycle_contributions(current_cycle) 
                == (self.monthly_contribution.read() * self.total_participants.read());
            
            // Emit PaymentProcessed event
            self.emit(PaymentProcessed {
                ajo_id: self.ajo_id.read(),
                member: caller,
                cycle: current_cycle,
                amount,
                all_paid,
            });
            
            // If all members have paid, trigger distribute_payout
            if all_paid {
                self._distribute_payout();
            }
            
            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        fn process_cycle(ref self: ContractState, cycle_number: u256) {
            // Only owner (operator) or schedule module can process cycles.
            let caller = starknet::get_caller_address();
            let owner = self.ownable.owner();
            let schedule = self.schedule_contract.read();
            assert(caller == owner || caller == schedule, 'Unauthorized cycle processor');

            assert(self.is_active.read(), 'Ajo is not active');

            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };
            let current_cycle = payments_dispatcher.get_current_cycle();
            assert(cycle_number == current_cycle, 'Cycle mismatch');

            let expected_total = self.monthly_contribution.read() * self.total_participants.read();
            let total_paid = payments_dispatcher.get_cycle_contributions(cycle_number);
            assert(total_paid == expected_total, 'Cycle not fully funded');

            self._distribute_payout();
        }

        fn handle_default(ref self: ContractState, defaulter: ContractAddress) {
            // Apply reentrancy protection
            self.reentrancy_guard.start();

            // Default handling can be triggered by owner, governance, or schedule automation.
            InternalImpl::assert_owner_governance_or_schedule(@self);
            
            // Verify defaulter is a member
            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            assert(members_dispatcher.is_member(defaulter), 'Defaulter is not a member');
            
            // Get guarantor via AjoMembers.get_guarantor()
            let guarantor = members_dispatcher.get_guarantor(defaulter);
            
            // Get collateral dispatcher
            let collateral_dispatcher = IAjoCollateralDispatcher {
                contract_address: self.collateral_contract.read()
            };
            
            // Seize defaulter's collateral via AjoCollateral.seize_collateral()
            let defaulter_collateral_seized = collateral_dispatcher.seize_collateral(defaulter);
            
            // Seize guarantor's collateral
            let guarantor_collateral_seized = collateral_dispatcher.seize_collateral(guarantor);
            
            // Get payments dispatcher
            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };
            
            // Seize defaulter's past payments via AjoPayments.seize_past_payments()
            let defaulter_past_payments_seized = payments_dispatcher.seize_past_payments(defaulter);
            
            // Seize guarantor's past payments
            let guarantor_past_payments_seized = payments_dispatcher.seize_past_payments(guarantor);
            
            // Calculate total seized assets
            let total_seized = defaulter_collateral_seized 
                + guarantor_collateral_seized 
                + defaulter_past_payments_seized 
                + guarantor_past_payments_seized;
            
            // Note: All seized assets are already in the appropriate contracts:
            // - Collateral is in the collateral contract
            // - Past payments are in the payments contract
            // These funds are now available for redistribution to cover the default
            
            // Update defaulter status to Defaulted
            members_dispatcher.update_member_status(defaulter, MemberStatus::Defaulted);
            
            // Update guarantor status to Defaulted (as they are also penalized)
            members_dispatcher.update_member_status(guarantor, MemberStatus::Defaulted);
            
            // Emit DefaultHandled event
            self.emit(DefaultHandled {
                ajo_id: self.ajo_id.read(),
                defaulter,
                guarantor,
                defaulter_collateral_seized,
                guarantor_collateral_seized,
                defaulter_past_payments_seized,
                guarantor_past_payments_seized,
                total_seized,
            });
            
            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        fn governance_add_member(
            ref self: ContractState, member: ContractAddress, position: u256
        ) {
            let caller = starknet::get_caller_address();
            assert(caller == self.governance_contract.read(), 'Only governance');

            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            members_dispatcher.add_member(member, position);
        }

        fn governance_remove_member(ref self: ContractState, member: ContractAddress) {
            let caller = starknet::get_caller_address();
            assert(caller == self.governance_contract.read(), 'Only governance');

            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            members_dispatcher.remove_member(member);
        }

        fn exit_ajo(ref self: ContractState) {
            // Apply reentrancy protection
            self.reentrancy_guard.start();
            
            // Get caller address
            let caller = starknet::get_caller_address();
            
            // Verify caller is a member
            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            assert(members_dispatcher.is_member(caller), 'Caller is not a member');
            
            // Verify member hasn't received payout
            assert(!members_dispatcher.has_received_payout(caller), 'Already received payout');
            
            // Get collateral dispatcher
            let collateral_dispatcher = IAjoCollateralDispatcher {
                contract_address: self.collateral_contract.read()
            };
            
            // Get member's current collateral balance
            let collateral_balance = collateral_dispatcher.get_member_collateral(caller);
            
            // Calculate exit penalty (50% of collateral as penalty for early exit)
            let penalty_amount = collateral_balance / 2;
            let refund_amount = collateral_balance - penalty_amount;
            
            // Seize penalty amount (transfers to payments contract for redistribution)
            if penalty_amount > 0 {
                collateral_dispatcher.slash_collateral(caller, penalty_amount);
            }
            
            // Refund remaining collateral to member
            if refund_amount > 0 {
                collateral_dispatcher.withdraw_collateral_for(caller, refund_amount);
            }
            
            // Update member status to Removed
            members_dispatcher.update_member_status(caller, MemberStatus::Removed);
            
            // Emit MemberExited event
            self.emit(MemberExited {
                ajo_id: self.ajo_id.read(),
                member: caller,
                penalty_amount,
                refund_amount,
            });
            
            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        fn finalize_ajo(ref self: ContractState) {
            self.ownable.assert_only_owner();

            // Finalization is allowed after all payout cycles have completed.
            // current_cycle starts at 1 when active and increments after payout,
            // so completion means current_cycle > total_participants.
            let current_cycle = self.current_cycle.read();
            let total_participants = self.total_participants.read();
            assert(current_cycle > total_participants, 'Ajo not completed');

            self.is_active.write(false);

            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };

            self.emit(AjoFinalized {
                ajo_id: self.ajo_id.read(),
                final_cycle: current_cycle,
                total_members: members_dispatcher.get_total_members(),
            });
        }

        fn get_config(self: @ContractState) -> AjoConfig {
            AjoConfig {
                name: self.name.read(),
                monthly_contribution: self.monthly_contribution.read(),
                total_participants: self.total_participants.read(),
                cycle_duration: self.cycle_duration.read(),
                payment_token: self.payment_token.read(),
                collateral_mode: self.collateral_mode.read(),
                creator: self.ownable.owner(),
            }
        }

        fn get_current_cycle(self: @ContractState) -> u256 {
            self.current_cycle.read()
        }

        fn is_active(self: @ContractState) -> bool {
            self.is_active.read()
        }

        fn get_members_address(self: @ContractState) -> ContractAddress {
            self.members_contract.read()
        }

        fn get_collateral_address(self: @ContractState) -> ContractAddress {
            self.collateral_contract.read()
        }

        fn get_payments_address(self: @ContractState) -> ContractAddress {
            self.payments_contract.read()
        }

        fn get_governance_address(self: @ContractState) -> ContractAddress {
            self.governance_contract.read()
        }

        fn get_schedule_address(self: @ContractState) -> ContractAddress {
            self.schedule_contract.read()
        }

        fn get_payment_token_address(self: @ContractState) -> ContractAddress {
            self.payment_token_address.read()
        }

        fn get_payment_token_decimals(self: @ContractState) -> u8 {
            self.payment_token_decimals.read()
        }

        fn get_bridge_adapter(self: @ContractState) -> ContractAddress {
            self.bridge_adapter.read()
        }

        fn is_bridge_enabled(self: @ContractState) -> bool {
            self.bridge_enabled.read()
        }

        fn get_swap_router(self: @ContractState) -> ContractAddress {
            self.swap_router.read()
        }

        fn is_swap_enabled(self: @ContractState) -> bool {
            self.swap_enabled.read()
        }

        fn get_btc_collateral_adapter(self: @ContractState) -> ContractAddress {
            self.btc_collateral_adapter.read()
        }

        fn is_btc_commitment_enabled(self: @ContractState) -> bool {
            self.btc_commitment_enabled.read()
        }

        fn get_collateral_mode(self: @ContractState) -> CollateralMode {
            self.collateral_mode.read()
        }

        fn get_ajo_status(self: @ContractState) -> AjoStatus {
            // Get dispatchers for all module contracts
            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            let collateral_dispatcher = IAjoCollateralDispatcher {
                contract_address: self.collateral_contract.read()
            };
            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };

            // Aggregate data from all modules
            AjoStatus {
                ajo_id: self.ajo_id.read(),
                name: self.name.read(),
                is_active: self.is_active.read(),
                current_cycle: self.current_cycle.read(),
                total_participants: self.total_participants.read(),
                current_member_count: members_dispatcher.get_total_members(),
                monthly_contribution: self.monthly_contribution.read(),
                cycle_duration: self.cycle_duration.read(),
                payment_token: self.payment_token.read(),
                total_collateral_locked: collateral_dispatcher.get_total_collateral(),
                next_payout_position: payments_dispatcher.get_next_payout_position(),
            }
        }

        fn get_member_info(self: @ContractState, member: ContractAddress) -> MemberInfo {
            // Get dispatchers for all module contracts
            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            let collateral_dispatcher = IAjoCollateralDispatcher {
                contract_address: self.collateral_contract.read()
            };
            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };

            // Get member data from AjoMembers
            let member_data = members_dispatcher.get_member(member);

            // Calculate required collateral for this member's position
            let required_collateral = collateral_dispatcher.calculate_required_collateral(
                member_data.position,
                self.monthly_contribution.read(),
                self.total_participants.read()
            );

            // Get current cycle to check payment status
            let current_cycle = payments_dispatcher.get_current_cycle();

            // Aggregate member information from all modules
            MemberInfo {
                address: member_data.address,
                position: member_data.position,
                status: member_data.status,
                collateral_deposited: collateral_dispatcher.get_member_collateral(member),
                required_collateral: required_collateral,
                has_received_payout: member_data.has_received_payout,
                total_paid: payments_dispatcher.get_total_paid(member),
                has_paid_current_cycle: payments_dispatcher.has_paid_for_cycle(member, current_cycle),
                guarantor: members_dispatcher.get_guarantor(member),
                join_timestamp: member_data.join_timestamp,
            }
        }

        fn get_cycle_info(self: @ContractState) -> CycleInfo {
            // Get payments dispatcher
            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };

            // Get current cycle number
            let current_cycle = payments_dispatcher.get_current_cycle();

            // Calculate expected total contributions
            let monthly_contribution = self.monthly_contribution.read();
            let total_participants = self.total_participants.read();
            let expected_total = monthly_contribution * total_participants;

            // Get actual contributions for this cycle
            let total_contributions = payments_dispatcher.get_cycle_contributions(current_cycle);

            // Check if all members have paid
            let all_paid = total_contributions == expected_total;

            // Get next payout recipient
            let next_recipient = payments_dispatcher.get_payout_recipient(current_cycle);

            // Get cycle start time
            let cycle_start_time = payments_dispatcher.get_cycle_start_time();

            // Get next payout position
            let next_payout_position = payments_dispatcher.get_next_payout_position();

            // Aggregate cycle information
            CycleInfo {
                cycle_number: current_cycle,
                cycle_start_time: cycle_start_time,
                cycle_duration: self.cycle_duration.read(),
                next_payout_position: next_payout_position,
                next_payout_recipient: next_recipient,
                total_contributions_this_cycle: total_contributions,
                expected_total_contributions: expected_total,
                all_members_paid: all_paid,
                payout_amount: expected_total,
            }
        }

        fn pause(ref self: ContractState) {
            InternalImpl::assert_owner_or_governance(@self);
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            InternalImpl::assert_owner_or_governance(@self);
            self.pausable.unpause();
        }

        fn set_payment_token_address(
            ref self: ContractState, token_address: ContractAddress, decimals: u8
        ) {
            let caller = starknet::get_caller_address();
            let owner = self.ownable.owner();
            let initializer = self.authorized_initializer.read();
            assert(caller == owner || caller == initializer, 'Not authorized');
            assert(!token_address.is_zero(), 'Token address cannot be zero');
            assert(decimals > 0, 'Token decimals must be > 0');

            self.payment_token_address.write(token_address);
            self.payment_token_decimals.write(decimals);
        }

        fn set_bridge_adapter(ref self: ContractState, bridge_adapter: ContractAddress) {
            InternalImpl::assert_owner_or_initializer(@self);
            assert(!bridge_adapter.is_zero(), 'Bridge adapter cannot be zero');
            self.bridge_adapter.write(bridge_adapter);
            self.emit(AdapterAddressUpdated {
                adapter_type: 'bridge',
                adapter_address: bridge_adapter,
            });
        }

        fn enable_bridge(ref self: ContractState) {
            InternalImpl::assert_owner_or_initializer(@self);
            assert(!self.bridge_adapter.read().is_zero(), 'Bridge adapter not configured');
            self.bridge_enabled.write(true);
            self.emit(FeatureFlagToggled { feature: 'bridge', enabled: true });
        }

        fn disable_bridge(ref self: ContractState) {
            InternalImpl::assert_owner_or_initializer(@self);
            self.bridge_enabled.write(false);
            self.emit(FeatureFlagToggled { feature: 'bridge', enabled: false });
        }

        fn set_swap_router(ref self: ContractState, swap_router: ContractAddress) {
            InternalImpl::assert_owner_or_initializer(@self);
            assert(!swap_router.is_zero(), 'Swap router cannot be zero');
            self.swap_router.write(swap_router);
            self.emit(AdapterAddressUpdated {
                adapter_type: 'swap',
                adapter_address: swap_router,
            });

            let payments = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };
            payments.set_swap_router(swap_router);
        }

        fn enable_swap(ref self: ContractState) {
            InternalImpl::assert_owner_or_initializer(@self);
            assert(!self.swap_router.read().is_zero(), 'Swap router not configured');
            self.swap_enabled.write(true);
            self.emit(FeatureFlagToggled { feature: 'swap', enabled: true });

            let payments = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };
            payments.enable_swap();
        }

        fn disable_swap(ref self: ContractState) {
            InternalImpl::assert_owner_or_initializer(@self);
            self.swap_enabled.write(false);
            self.emit(FeatureFlagToggled { feature: 'swap', enabled: false });

            let payments = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };
            payments.disable_swap();
        }

        fn set_btc_collateral_adapter(
            ref self: ContractState, btc_collateral_adapter: ContractAddress
        ) {
            InternalImpl::assert_owner_or_initializer(@self);
            assert(!btc_collateral_adapter.is_zero(), 'BTC collat adapter zero');
            self.btc_collateral_adapter.write(btc_collateral_adapter);
            self.emit(AdapterAddressUpdated {
                adapter_type: 'btc_collateral',
                adapter_address: btc_collateral_adapter,
            });
        }

        fn enable_btc_commitment(ref self: ContractState) {
            InternalImpl::assert_owner_governance_or_initializer(@self);
            assert(
                !self.btc_collateral_adapter.read().is_zero(),
                'BTC collat adapter missing'
            );
            self.btc_commitment_enabled.write(true);
            self.emit(FeatureFlagToggled { feature: 'btc_commitment', enabled: true });
        }

        fn disable_btc_commitment(ref self: ContractState) {
            InternalImpl::assert_owner_governance_or_initializer(@self);
            self.btc_commitment_enabled.write(false);
            self.emit(FeatureFlagToggled { feature: 'btc_commitment', enabled: false });
        }

        fn set_collateral_mode(ref self: ContractState, mode: CollateralMode) {
            InternalImpl::assert_owner_governance_or_initializer(@self);
            let old_mode = self.collateral_mode.read();
            self.collateral_mode.write(mode);
            self.emit(CollateralModeChanged { old_mode, new_mode: mode });
        }

        fn emergency_disable_bridge(ref self: ContractState) {
            InternalImpl::assert_owner_or_governance(@self);
            self.bridge_enabled.write(false);
            self.bridge_adapter.write(Zero::zero());
            self.emit(FeatureFlagToggled { feature: 'bridge', enabled: false });
            self.emit(AdapterAddressUpdated {
                adapter_type: 'bridge',
                adapter_address: Zero::zero(),
            });
        }

        fn emergency_disable_swap(ref self: ContractState) {
            InternalImpl::assert_owner_or_governance(@self);
            self.swap_enabled.write(false);
            self.swap_router.write(Zero::zero());
            self.emit(FeatureFlagToggled { feature: 'swap', enabled: false });
            self.emit(AdapterAddressUpdated {
                adapter_type: 'swap',
                adapter_address: Zero::zero(),
            });
        }

        fn emergency_disable_btc_collateral(ref self: ContractState) {
            InternalImpl::assert_owner_or_governance(@self);
            self.btc_commitment_enabled.write(false);
            self.btc_collateral_adapter.write(Zero::zero());
            let old_mode = self.collateral_mode.read();
            self.collateral_mode.write(CollateralMode::L2Escrow);

            self.emit(FeatureFlagToggled { feature: 'btc_commitment', enabled: false });
            self.emit(AdapterAddressUpdated {
                adapter_type: 'btc_collateral',
                adapter_address: Zero::zero(),
            });
            self.emit(CollateralModeChanged {
                old_mode,
                new_mode: CollateralMode::L2Escrow,
            });
        }
    }

    // Internal helper functions
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_owner_or_governance(self: @ContractState) {
            let caller = starknet::get_caller_address();
            let owner = self.ownable.owner();
            let governance = self.governance_contract.read();
            assert(caller == owner || caller == governance, 'Only owner or governance');
        }

        fn assert_owner_or_initializer(self: @ContractState) {
            let caller = starknet::get_caller_address();
            let owner = self.ownable.owner();
            let initializer = self.authorized_initializer.read();
            assert(caller == owner || caller == initializer, 'Only owner or initializer');
        }

        fn assert_owner_governance_or_initializer(self: @ContractState) {
            let caller = starknet::get_caller_address();
            let owner = self.ownable.owner();
            let governance = self.governance_contract.read();
            let initializer = self.authorized_initializer.read();
            assert(
                caller == owner || caller == governance || caller == initializer,
                'Only owner/gov/init'
            );
        }

        fn assert_owner_governance_or_schedule(self: @ContractState) {
            let caller = starknet::get_caller_address();
            let owner = self.ownable.owner();
            let governance = self.governance_contract.read();
            let schedule = self.schedule_contract.read();
            assert(
                caller == owner || caller == governance || caller == schedule,
                'Only owner/governance/schedule'
            );
        }

        fn assert_governance_approved(self: @ContractState) {
            let governance_address = self.governance_contract.read();
            assert(!governance_address.is_zero(), 'Governance not configured');

            let caller = starknet::get_caller_address();
            if caller == governance_address {
                return ();
            }

            let owner = self.ownable.owner();
            assert(caller == owner, 'Only owner or governance');

            let governance = IAjoGovernanceDispatcher { contract_address: governance_address };
            let total_proposals = governance.get_total_proposals();
            assert(total_proposals > 0, 'No governance proposal');

            let proposal = governance.get_proposal(total_proposals);
            assert(proposal.status == ProposalStatus::Executed, 'Governance approval required');
        }

        /// Internal function to distribute payout to the next recipient
        /// Called automatically when all members have paid for the current cycle
        /// 
        /// # Requirements (2.1.2, 2.1.5, 2.3.2)
        /// * Gets next recipient from AjoPayments.get_next_recipient()
        /// * Calculates payout amount (monthly_contribution × total_participants)
        /// * Calls AjoPayments.distribute_payout()
        /// * Marks recipient as received in AjoMembers
        /// * Calls AjoPayments.advance_cycle()
        /// * Emits PayoutDistributed event
        fn _distribute_payout(ref self: ContractState) {
            // Get payments dispatcher
            let payments_dispatcher = IAjoPaymentsDispatcher {
                contract_address: self.payments_contract.read()
            };
            
            // Get next recipient from AjoPayments.get_payout_recipient()
            let current_cycle = payments_dispatcher.get_current_cycle();
            let recipient = payments_dispatcher.get_payout_recipient(current_cycle);
            
            // Calculate payout amount (monthly_contribution × total_participants)
            let monthly_contribution = self.monthly_contribution.read();
            let total_participants = self.total_participants.read();
            let payout_amount = monthly_contribution * total_participants;
            
            // Call AjoPayments.distribute_payout()
            payments_dispatcher.distribute_payout(current_cycle, recipient);
            
            // Mark recipient as received payout in AjoMembers
            let members_dispatcher = IAjoMembersDispatcher {
                contract_address: self.members_contract.read()
            };
            members_dispatcher.mark_payout_received(recipient);
            
            // Call AjoPayments.advance_cycle()
            payments_dispatcher.advance_cycle();
            
            // Update current_cycle in AjoCore to stay in sync
            self.current_cycle.write(current_cycle + 1);
            
            // Emit PayoutDistributed event
            self.emit(PayoutDistributed {
                ajo_id: self.ajo_id.read(),
                recipient,
                cycle: current_cycle,
                amount: payout_amount,
            });
        }
    }
}
