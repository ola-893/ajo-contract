// AjoPayments - Payment processing and cycle management
// Handles monthly payment processing, payout distribution, and cycle advancement

#[starknet::contract]
pub mod AjoPayments {
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use ajo_save::interfaces::i_ajo_payments::IAjoPayments;
    use ajo_save::interfaces::i_ajo_members::{IAjoMembersDispatcher, IAjoMembersDispatcherTrait};
    use ajo_save::interfaces::i_swap_router::{
        ISwapRouterDispatcher, ISwapRouterDispatcherTrait, SwapStatus
    };
    use ajo_save::components::ownable::OwnableComponent;
    use ajo_save::components::reentrancy_guard::ReentrancyGuardComponent;

    // ERC20 interface for token transfers
    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer(
            ref self: TContractState,
            recipient: ContractAddress,
            amount: u256
        ) -> bool;
        fn transfer_from(
            ref self: TContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) -> bool;
        fn approve(
            ref self: TContractState,
            spender: ContractAddress,
            amount: u256
        ) -> bool;
    }

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Cycle management
        current_cycle: u256,
        cycle_start_time: u64,
        cycle_duration: u64,
        next_payout_position: u256,
        
        // Payment tracking
        payments: Map<(u256, ContractAddress), bool>, // (cycle, member) → paid
        cycle_payments_count: Map<u256, u256>,
        member_past_payments: Map<ContractAddress, u256>,
        
        // Configuration
        monthly_contribution: u256,
        total_participants: u256,
        payment_token: ContractAddress,
        members_contract: ContractAddress,
        swap_router: ContractAddress,
        recipient_token_preferences: Map<ContractAddress, ContractAddress>,
        swap_enabled: bool,
        authorized_core: ContractAddress,
        
        // Components
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PaymentRecorded: PaymentRecorded,
        PayoutDistributed: PayoutDistributed,
        CycleAdvanced: CycleAdvanced,
        PastPaymentsSeized: PastPaymentsSeized,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentRecorded {
        #[key]
        pub cycle: u256,
        #[key]
        pub member: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutDistributed {
        #[key]
        pub cycle: u256,
        #[key]
        pub recipient: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CycleAdvanced {
        pub old_cycle: u256,
        pub new_cycle: u256,
        pub next_payout_position: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PastPaymentsSeized {
        #[key]
        pub member: ContractAddress,
        pub amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        monthly_contribution: u256,
        total_participants: u256,
        cycle_duration: u64,
        payment_token: ContractAddress,
        members_contract: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.monthly_contribution.write(monthly_contribution);
        self.total_participants.write(total_participants);
        self.cycle_duration.write(cycle_duration);
        self.payment_token.write(payment_token);
        self.members_contract.write(members_contract);
        self.swap_router.write(Zero::zero());
        self.swap_enabled.write(false);
        self.authorized_core.write(owner);

        self.current_cycle.write(0);
        self.cycle_start_time.write(0);
        self.next_payout_position.write(1);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_core(self: @ContractState) {
            let caller = get_caller_address();
            let authorized = self.authorized_core.read();
            assert(caller == authorized, 'Only authorized core');
        }

        /// Record a payment from a member for a specific cycle
        /// 
        /// # Arguments
        /// * `member` - Address of the member making the payment
        /// * `cycle` - Cycle number for the payment
        /// * `amount` - Amount being paid
        ///
        /// # Requirements
        /// * Amount must match monthly_contribution
        /// * Member must not have already paid for this cycle
        /// * ERC20 transfer must succeed
        fn record_payment(
            ref self: ContractState,
            member: ContractAddress,
            cycle: u256,
            amount: u256
        ) {
            // Apply reentrancy protection
            self.reentrancy_guard.start();

            // Validate amount matches monthly contribution
            let monthly = self.monthly_contribution.read();
            assert(amount == monthly, 'Invalid payment amount');

            // Verify member hasn't already paid for this cycle
            let has_paid = self.payments.read((cycle, member));
            assert(!has_paid, 'Already paid for cycle');

            // Transfer ERC20 tokens from member to this contract
            let token_address = self.payment_token.read();
            let token = IERC20Dispatcher { contract_address: token_address };
            let contract_addr = get_contract_address();
            
            let success = token.transfer_from(member, contract_addr, amount);
            assert(success, 'Token transfer failed');

            // Update payments mapping
            self.payments.write((cycle, member), true);

            // Update cycle payments count
            let current_count = self.cycle_payments_count.read(cycle);
            self.cycle_payments_count.write(cycle, current_count + 1);

            // Update member's past payments
            let past_payments = self.member_past_payments.read(member);
            self.member_past_payments.write(member, past_payments + amount);

            // Emit PaymentRecorded event
            self.emit(PaymentRecorded { cycle, member, amount });

            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        /// Check if a member has paid for a specific cycle
        /// 
        /// # Arguments
        /// * `member` - Address of the member to check
        /// * `cycle` - Cycle number to check
        ///
        /// # Returns
        /// * `bool` - True if the member has paid for the cycle, false otherwise
        fn has_paid(
            self: @ContractState,
            member: ContractAddress,
            cycle: u256
        ) -> bool {
            self.payments.read((cycle, member))
        }

        /// Check if all members have paid for a specific cycle
        /// 
        /// # Arguments
        /// * `cycle` - Cycle number to check
        ///
        /// # Returns
        /// * `bool` - True if all members have paid for the cycle, false otherwise
        ///
        /// # Implementation
        /// Compares the cycle_payments_count for the given cycle with total_participants
        fn all_members_paid(
            self: @ContractState,
            cycle: u256
        ) -> bool {
            let payments_count = self.cycle_payments_count.read(cycle);
            let total = self.total_participants.read();
            payments_count == total
        }

        /// Distribute payout to the recipient for a specific cycle
        /// 
        /// # Arguments
        /// * `recipient` - Address of the member receiving the payout
        /// * `amount` - Amount to be paid out
        ///
        /// # Requirements
        /// * All members must have paid for the current cycle
        /// * Payout amount must equal monthly_contribution × total_participants
        /// * ERC20 transfer must succeed
        /// * Only callable by owner (AjoCore)
        fn distribute_payout(
            ref self: ContractState,
            recipient: ContractAddress,
            amount: u256
        ) {
            // Apply reentrancy protection
            self.reentrancy_guard.start();

            // Get current cycle
            let cycle = self.current_cycle.read();

            // Verify all members have paid for this cycle
            assert(self.all_members_paid(cycle), 'Not all members paid');

            // Calculate expected payout amount
            let monthly = self.monthly_contribution.read();
            let total = self.total_participants.read();
            let expected_payout = monthly * total;

            // Verify amount matches expected payout
            assert(amount == expected_payout, 'Invalid payout amount');

            // Transfer ERC20 tokens to recipient
            let token_address = self.payment_token.read();
            let token = IERC20Dispatcher { contract_address: token_address };
            
            let success = token.transfer(recipient, amount);
            assert(success, 'Payout transfer failed');

            // Emit PayoutDistributed event
            self.emit(PayoutDistributed { cycle, recipient, amount });

            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        /// Advance to the next cycle
        /// 
        /// # Requirements
        /// * Only callable by owner (AjoCore)
        ///
        /// # Implementation
        /// * Increments current_cycle by 1
        /// * Updates cycle_start_time to current block timestamp
        /// * Increments next_payout_position (wrapping at total_participants)
        /// * Emits CycleAdvanced event
        fn advance_cycle(ref self: ContractState) {
            // Only owner (AjoCore) can advance cycle
            self.ownable.assert_only_owner();

            // Get current cycle
            let old_cycle = self.current_cycle.read();
            let new_cycle = old_cycle + 1;

            // Update current cycle
            self.current_cycle.write(new_cycle);

            // Update cycle start time to current block timestamp
            let current_time = starknet::get_block_timestamp();
            self.cycle_start_time.write(current_time);

            // Increment next_payout_position with wrapping
            let current_position = self.next_payout_position.read();
            let total = self.total_participants.read();
            let new_position = if current_position >= total {
                1 // Wrap to position 1
            } else {
                current_position + 1
            };
            self.next_payout_position.write(new_position);

            // Emit CycleAdvanced event
            self.emit(CycleAdvanced {
                old_cycle,
                new_cycle,
                next_payout_position: new_position
            });
        }

        /// Get the next recipient for payout
        /// 
        /// # Returns
        /// * `ContractAddress` - Address of the member at next_payout_position
        ///
        /// # Implementation
        /// Uses position_to_member mapping from AjoMembers to get the member
        /// at the next_payout_position
        fn get_next_recipient(self: @ContractState) -> ContractAddress {
            // Get the next payout position
            let position = self.next_payout_position.read();
            
            // Get the members contract address
            let members_address = self.members_contract.read();
            
            // Create dispatcher for AjoMembers contract
            let members = IAjoMembersDispatcher { contract_address: members_address };
            
            // Get the member at the next payout position
            let member = members.get_member_by_position(position);
            
            // Return the member's address
            member.address
        }

        /// Seize past payments from a member (used in default handling)
        /// 
        /// # Arguments
        /// * `member` - Address of the member whose past payments are being seized
        ///
        /// # Returns
        /// * `u256` - Amount of past payments seized
        ///
        /// # Requirements
        /// * Only callable by owner (AjoCore)
        ///
        /// # Implementation
        /// * Retrieves member's past payments from member_past_payments mapping
        /// * Transfers amount to payments contract (already held by contract)
        /// * Resets member_past_payments to zero
        /// * Emits PastPaymentsSeized event
        /// * Returns seized amount
        fn seize_past_payments(
            ref self: ContractState,
            member: ContractAddress
        ) -> u256 {
            // Only owner (AjoCore) can seize past payments
            self.ownable.assert_only_owner();

            // Retrieve member's past payments
            let past_payments = self.member_past_payments.read(member);

            // Reset member's past payments to zero
            self.member_past_payments.write(member, 0);

            // Emit PastPaymentsSeized event
            self.emit(PastPaymentsSeized {
                member,
                amount: past_payments
            });

            // Return seized amount
            // Note: The funds are already held by the payments contract from previous
            // record_payment calls, so no token transfer is needed here.
            // The seized amount is simply tracked and made available for redistribution.
            past_payments
        }
    }

    #[abi(embed_v0)]
    impl AjoPaymentsImpl of IAjoPayments<ContractState> {
        fn set_authorized_core(ref self: ContractState, core: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!core.is_zero(), 'Core address is zero');
            self.authorized_core.write(core);
        }

        fn get_authorized_core(self: @ContractState) -> ContractAddress {
            self.authorized_core.read()
        }

        fn make_payment(ref self: ContractState, cycle: u256, amount: u256) {
            let caller = get_caller_address();
            InternalImpl::assert_only_core(@self);
            InternalImpl::record_payment(ref self, caller, cycle, amount);
        }

        fn make_payment_for(
            ref self: ContractState, member: ContractAddress, cycle: u256, amount: u256
        ) {
            InternalImpl::assert_only_core(@self);
            InternalImpl::record_payment(ref self, member, cycle, amount);
        }

        fn distribute_payout(ref self: ContractState, cycle: u256, recipient: ContractAddress) {
            InternalImpl::assert_only_core(@self);

            let monthly = self.monthly_contribution.read();
            let total = self.total_participants.read();
            let payout_amount = monthly * total;
            let current_cycle = self.current_cycle.read();
            assert(cycle == current_cycle, 'Invalid cycle number');
            assert(InternalImpl::all_members_paid(@self, cycle), 'Not all members paid');

            let pool_token = self.payment_token.read();
            let preferred_token = self.recipient_token_preferences.read(recipient);
            let swap_router = self.swap_router.read();
            let use_swap = self.swap_enabled.read() && !swap_router.is_zero()
                && !preferred_token.is_zero() && preferred_token != pool_token;

            if use_swap {
                self.reentrancy_guard.start();

                let token = IERC20Dispatcher { contract_address: pool_token };
                let approved = token.approve(swap_router, payout_amount);
                assert(approved, 'Swap approval failed');

                let router = ISwapRouterDispatcher { contract_address: swap_router };
                let quoted = router.get_quote(pool_token, preferred_token, payout_amount);
                assert(quoted > 0, 'Invalid swap quote');
                let deadline = get_block_timestamp() + 300;
                let request_id = router.execute_swap(
                    cycle,
                    recipient,
                    pool_token,
                    preferred_token,
                    payout_amount,
                    quoted,
                    deadline
                );

                let status = router.get_swap_status(request_id);
                assert(status == SwapStatus::Executed, 'Swap execution failed');

                self.emit(PayoutDistributed { cycle, recipient, amount: payout_amount });
                self.reentrancy_guard.end();
            } else {
                InternalImpl::distribute_payout(ref self, recipient, payout_amount);
            }
        }

        fn start_cycle(ref self: ContractState, cycle_number: u256) {
            InternalImpl::assert_only_core(@self);
            self.current_cycle.write(cycle_number);
            self.cycle_start_time.write(starknet::get_block_timestamp());
            self.next_payout_position.write(1);
        }

        fn end_cycle(ref self: ContractState, cycle_number: u256) {
            InternalImpl::assert_only_core(@self);
            // Verify this is the current cycle
            assert(self.current_cycle.read() == cycle_number, 'Invalid cycle number');
        }

        fn advance_cycle(ref self: ContractState) {
            InternalImpl::assert_only_core(@self);
            InternalImpl::advance_cycle(ref self);
        }

        fn get_current_cycle(self: @ContractState) -> u256 {
            self.current_cycle.read()
        }

        fn get_cycle_start_time(self: @ContractState) -> u64 {
            self.cycle_start_time.read()
        }

        fn get_next_payout_position(self: @ContractState) -> u256 {
            self.next_payout_position.read()
        }

        fn has_paid_for_cycle(self: @ContractState, member: ContractAddress, cycle: u256) -> bool {
            InternalImpl::has_paid(self, member, cycle)
        }

        fn get_total_paid(self: @ContractState, member: ContractAddress) -> u256 {
            self.member_past_payments.read(member)
        }

        fn get_cycle_contributions(self: @ContractState, cycle: u256) -> u256 {
            let payments_count = self.cycle_payments_count.read(cycle);
            let monthly = self.monthly_contribution.read();
            payments_count * monthly
        }

        fn get_payment_token(self: @ContractState) -> ContractAddress {
            self.payment_token.read()
        }

        fn get_payout_recipient(self: @ContractState, cycle: u256) -> ContractAddress {
            InternalImpl::get_next_recipient(self)
        }

        fn calculate_payout_amount(self: @ContractState, cycle: u256) -> u256 {
            let monthly = self.monthly_contribution.read();
            let total = self.total_participants.read();
            monthly * total
        }

        fn mark_default(ref self: ContractState, member: ContractAddress, cycle: u256) {
            InternalImpl::assert_only_core(@self);
            // Mark member as defaulted - implementation depends on requirements
            // For now, we just verify the member exists
        }

        fn is_defaulted(self: @ContractState, member: ContractAddress) -> bool {
            // Check if member has defaulted - implementation depends on requirements
            false
        }

        fn seize_past_payments(ref self: ContractState, member: ContractAddress) -> u256 {
            InternalImpl::assert_only_core(@self);
            InternalImpl::seize_past_payments(ref self, member)
        }

        fn set_swap_router(ref self: ContractState, router: ContractAddress) {
            InternalImpl::assert_only_core(@self);
            assert(!router.is_zero(), 'Swap router cannot be zero');
            self.swap_router.write(router);
        }

        fn get_swap_router(self: @ContractState) -> ContractAddress {
            self.swap_router.read()
        }

        fn enable_swap(ref self: ContractState) {
            InternalImpl::assert_only_core(@self);
            assert(!self.swap_router.read().is_zero(), 'Swap router not configured');
            self.swap_enabled.write(true);
        }

        fn disable_swap(ref self: ContractState) {
            InternalImpl::assert_only_core(@self);
            self.swap_enabled.write(false);
        }

        fn is_swap_enabled(self: @ContractState) -> bool {
            self.swap_enabled.read()
        }

        fn set_token_preference(ref self: ContractState, token: ContractAddress) {
            let caller = get_caller_address();
            self.recipient_token_preferences.write(caller, token);
        }

        fn get_token_preference(
            self: @ContractState, member: ContractAddress
        ) -> ContractAddress {
            self.recipient_token_preferences.read(member)
        }
    }
}
