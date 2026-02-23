// AjoCollateral - Dynamic collateral calculation (60% formula)
// Implements the critical 60% collateral formula with guarantor network
// Key formulas:
// - Debt(n) = Payout - (n × monthlyContribution)
// - Collateral(n) = Debt(n) × 0.60
// - Recovery Assets = Collateral + (n × monthlyContribution)
// - Coverage = Recovery Assets / Debt

#[starknet::contract]
pub mod AjoCollateral {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use ajo_save::interfaces::i_ajo_collateral::IAjoCollateral;
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
    }

    // Component declarations
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);

    // Ownable implementation
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // ReentrancyGuard implementation
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // Collateral tracking
        member_collateral: Map<ContractAddress, u256>,
        total_collateral: u256,
        
        // Configuration variables
        monthly_contribution: u256,
        total_participants: u256,
        payment_token: ContractAddress,
        
        // Constants (60% = 600 basis points out of 1000)
        collateral_factor: u256, // 600 basis points
        basis_points: u256, // 1000 (denominator)
        
        // Components
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        CollateralDeposited: CollateralDeposited,
        CollateralWithdrawn: CollateralWithdrawn,
        CollateralSeized: CollateralSeized,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralDeposited {
        #[key]
        pub member: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralWithdrawn {
        #[key]
        pub member: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CollateralSeized {
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
        payment_token: ContractAddress,
    ) {
        // Initialize Ownable component
        self.ownable.initializer(owner);
        
        // Set configuration
        self.monthly_contribution.write(monthly_contribution);
        self.total_participants.write(total_participants);
        self.payment_token.write(payment_token);
        
        // Set constants (60% = 600 basis points out of 1000)
        self.collateral_factor.write(600);
        self.basis_points.write(1000);
        
        // Initialize total collateral to zero
        self.total_collateral.write(0);
    }

    #[abi(embed_v0)]
    impl AjoCollateralImpl of IAjoCollateral<ContractState> {
        /// Calculate debt for a given position
        /// Formula: Debt(n) = Payout - (n × monthlyContribution)
        /// where Payout = monthlyContribution × totalParticipants
        /// 
        /// # Arguments
        /// * `position` - The queue position (1-10)
        /// * `monthly_payment` - The monthly contribution amount
        /// * `total_participants` - Total number of participants
        /// 
        /// # Returns
        /// The debt amount for the given position
        fn calculate_debt(
            self: @ContractState,
            position: u256,
            monthly_payment: u256,
            total_participants: u256
        ) -> u256 {
            // Calculate payout: monthlyContribution × totalParticipants
            let payout = monthly_payment * total_participants;
            
            // Calculate amount already paid: position × monthlyContribution
            let paid = position * monthly_payment;
            
            // Debt = Payout - Paid
            // Note: For position 10, paid equals payout, so debt is 0
            payout - paid
        }

        /// Calculate required collateral for a given position using 60% formula
        /// Formula: Collateral(n) = Debt(n) × 0.60
        /// Implementation uses basis points: (Debt × 600) / 1000
        /// 
        /// # Arguments
        /// * `position` - The queue position (1-10)
        /// * `monthly_payment` - The monthly contribution amount
        /// * `total_participants` - Total number of participants
        /// 
        /// # Returns
        /// The required collateral amount (60% of debt)
        /// 
        /// # Examples
        /// For 10 members, $50/month:
        /// - Position 1: Debt = $450 → Collateral = $270 (60%)
        /// - Position 6: Debt = $200 → Collateral = $120 (60%)
        /// - Position 10: Debt = $0 → Collateral = $0
        fn calculate_required_collateral(
            self: @ContractState,
            position: u256,
            monthly_payment: u256,
            total_participants: u256
        ) -> u256 {
            // First calculate the debt for this position
            let debt = self.calculate_debt(position, monthly_payment, total_participants);
            
            // Apply 60% collateral factor using basis points
            // Collateral = (Debt × 600) / 1000
            let collateral_factor = self.collateral_factor.read(); // 600
            let basis_points = self.basis_points.read(); // 1000
            
            (debt * collateral_factor) / basis_points
        }

        /// Calculate total recovery assets for a given position
        /// Formula: Recovery Assets = Member Collateral + Member Past Payments + 
        ///                           Guarantor Collateral + Guarantor Past Payments
        /// 
        /// This calculates the total assets that can be recovered in case of default,
        /// including both the defaulter's and their guarantor's contributions.
        /// 
        /// # Arguments
        /// * `position` - The queue position (1-10)
        /// * `monthly_payment` - The monthly contribution amount
        /// * `total_participants` - Total number of participants
        /// 
        /// # Returns
        /// The total recoverable assets (should be >= debt for coverage)
        /// 
        /// # Examples
        /// For 10 members, $50/month, position 1:
        /// - Member collateral: $270 (60% of $450 debt)
        /// - Member past payments: $50 (1 × $50)
        /// - Guarantor (position 6) collateral: $120 (60% of $200 debt)
        /// - Guarantor past payments: $300 (6 × $50)
        /// - Total recovery: $740
        fn calculate_recovery_assets(
            self: @ContractState,
            position: u256,
            monthly_payment: u256,
            total_participants: u256
        ) -> u256 {
            // Calculate member's collateral requirement
            let member_collateral = self.calculate_required_collateral(
                position, 
                monthly_payment, 
                total_participants
            );
            
            // Calculate member's past payments: position × monthly_payment
            let member_past_payments = position * monthly_payment;
            
            // Calculate guarantor position using offset formula
            // Formula: ((position - 1 + (total/2)) % total) + 1
            let offset = total_participants / 2;
            let guarantor_position = ((position - 1 + offset) % total_participants) + 1;
            
            // Calculate guarantor's collateral requirement
            let guarantor_collateral = self.calculate_required_collateral(
                guarantor_position,
                monthly_payment,
                total_participants
            );
            
            // Calculate guarantor's past payments: guarantor_position × monthly_payment
            let guarantor_past_payments = guarantor_position * monthly_payment;
            
            // Sum all recovery assets
            member_collateral + member_past_payments + guarantor_collateral + guarantor_past_payments
        }

        /// Calculate coverage ratio for a given position
        /// Formula: Coverage Ratio = (Recovery Assets / Debt) × 100
        /// 
        /// This verifies that the 60% collateral model provides sufficient coverage
        /// (should be >= 108% for all positions).
        /// 
        /// # Arguments
        /// * `position` - The queue position (1-10)
        /// * `monthly_payment` - The monthly contribution amount
        /// * `total_participants` - Total number of participants
        /// 
        /// # Returns
        /// The coverage ratio as a percentage (e.g., 108 means 108%)
        /// 
        /// # Examples
        /// For 10 members, $50/month, position 1:
        /// - Debt: $450
        /// - Recovery assets: $740 (member $270 + $50, guarantor $120 + $300)
        /// - Coverage ratio: ($740 / $450) × 100 = 164%
        /// 
        /// # Panics
        /// Panics if debt is zero (position 10 edge case)
        fn get_coverage_ratio(
            self: @ContractState,
            position: u256,
            monthly_payment: u256,
            total_participants: u256
        ) -> u256 {
            // Calculate debt for this position
            let debt = self.calculate_debt(position, monthly_payment, total_participants);
            
            // Handle edge case: position 10 has zero debt
            // In this case, coverage ratio is undefined (infinite coverage)
            // We return 0 to indicate no coverage needed
            if debt == 0 {
                return 0;
            }
            
            // Calculate total recovery assets
            let recovery_assets = self.calculate_recovery_assets(
                position,
                monthly_payment,
                total_participants
            );
            
            // Calculate coverage ratio: (recovery_assets / debt) × 100
            // This gives us the percentage coverage
            (recovery_assets * 100) / debt
        }

        /// Deposit collateral for the caller
        /// Transfers ERC20 tokens from caller to this contract and updates collateral tracking.
        /// Protected against reentrancy attacks.
        /// 
        /// # Arguments
        /// * `amount` - The amount of collateral to deposit
        /// 
        /// # Requirements
        /// * Amount must be greater than zero
        /// * Caller must have approved this contract to transfer tokens
        /// * Caller must have sufficient token balance
        /// 
        /// # Events
        /// Emits `CollateralDeposited` event
        fn deposit_collateral(ref self: ContractState, amount: u256) {
            // Start reentrancy protection
            self.reentrancy_guard.start();
            
            // Validate amount
            assert(amount > 0, 'Amount must be greater than 0');
            
            // Get caller address
            let caller = get_caller_address();
            
            // Get payment token address
            let token_address = self.payment_token.read();
            
            // Create ERC20 dispatcher for token transfers
            let token = IERC20Dispatcher { contract_address: token_address };
            
            // Transfer tokens from caller to this contract
            // Note: Caller must have approved this contract first
            let success = token.transfer_from(
                caller,
                get_contract_address(),
                amount
            );
            
            // Verify transfer succeeded
            assert(success, 'Token transfer failed');
            
            // Update member's collateral balance
            let current_collateral = self.member_collateral.read(caller);
            self.member_collateral.write(caller, current_collateral + amount);
            
            // Update total collateral
            let current_total = self.total_collateral.read();
            self.total_collateral.write(current_total + amount);
            
            // Emit event
            self.emit(CollateralDeposited { member: caller, amount });
            
            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        /// Withdraw collateral for the caller
        /// Transfers ERC20 tokens from this contract back to the caller and updates collateral tracking.
        /// Protected against reentrancy attacks.
        /// 
        /// # Arguments
        /// * `amount` - The amount of collateral to withdraw
        /// 
        /// # Requirements
        /// * Amount must be greater than zero
        /// * Caller must have sufficient collateral balance
        /// * Member must exist (have deposited collateral before)
        /// * Contract must have sufficient token balance
        /// 
        /// # Safety
        /// This function should only be called when the member is not in an active cycle.
        /// The AjoCore contract (owner) is responsible for enforcing this constraint
        /// before allowing withdrawals.
        /// 
        /// # Events
        /// Emits `CollateralWithdrawn` event
        fn withdraw_collateral(ref self: ContractState, amount: u256) {
            // Start reentrancy protection
            self.reentrancy_guard.start();
            
            // Validate amount
            assert(amount > 0, 'Amount must be greater than 0');
            
            // Get caller address
            let caller = get_caller_address();
            
            // Check member exists (has collateral deposited)
            let current_collateral = self.member_collateral.read(caller);
            assert(current_collateral > 0, 'Member does not exist');
            
            // Check sufficient balance
            assert(current_collateral >= amount, 'Insufficient collateral balance');
            
            // Get payment token address
            let token_address = self.payment_token.read();
            
            // Create ERC20 dispatcher for token transfers
            let token = IERC20Dispatcher { contract_address: token_address };
            
            // Transfer tokens from this contract to caller
            let success = token.transfer(caller, amount);
            
            // Verify transfer succeeded
            assert(success, 'Token transfer failed');
            
            // Update member's collateral balance
            self.member_collateral.write(caller, current_collateral - amount);
            
            // Update total collateral
            let current_total = self.total_collateral.read();
            self.total_collateral.write(current_total - amount);
            
            // Emit event
            self.emit(CollateralWithdrawn { member: caller, amount });
            
            // End reentrancy protection
            self.reentrancy_guard.end();
        }

        // TODO: Implement slash_collateral
        fn slash_collateral(ref self: ContractState, member: ContractAddress, amount: u256) {
            // Placeholder
        }

        /// Seize collateral from a member (used in default handling)
        /// Transfers all of the member's collateral to the payments contract.
        /// This function is called by the AjoCore contract when handling defaults.
        /// 
        /// # Arguments
        /// * `member` - The address of the member whose collateral is being seized
        /// 
        /// # Returns
        /// The amount of collateral seized
        /// 
        /// # Requirements
        /// * Only the owner (AjoCore contract) can call this function
        /// * Member must have collateral deposited
        /// 
        /// # Events
        /// Emits `CollateralSeized` event
        /// 
        /// # Note
        /// This function does NOT use reentrancy protection because it's only
        /// callable by the trusted owner (AjoCore), which already has reentrancy
        /// protection on the handle_default function.
        fn seize_collateral(ref self: ContractState, member: ContractAddress) -> u256 {
            // Only owner (AjoCore) can seize collateral
            self.ownable.assert_only_owner();
            
            // Get member's collateral balance
            let collateral_amount = self.member_collateral.read(member);
            
            // If no collateral, return 0
            if collateral_amount == 0 {
                return 0;
            }
            
            // Get payment token address
            let token_address = self.payment_token.read();
            
            // Create ERC20 dispatcher for token transfers
            let token = IERC20Dispatcher { contract_address: token_address };
            
            // Get the owner (payments contract address)
            // Note: In the actual system, the owner should be AjoCore,
            // and we should transfer to a payments contract address.
            // For now, we transfer to the owner as specified in requirements.
            let payments_contract = self.ownable.owner();
            
            // Transfer collateral to payments contract
            let success = token.transfer(payments_contract, collateral_amount);
            
            // Verify transfer succeeded
            assert(success, 'Token transfer failed');
            
            // Update member's collateral balance to zero
            self.member_collateral.write(member, 0);
            
            // Update total collateral
            let current_total = self.total_collateral.read();
            self.total_collateral.write(current_total - collateral_amount);
            
            // Emit event
            self.emit(CollateralSeized { member, amount: collateral_amount });
            
            // Return seized amount
            collateral_amount
        }

        // View functions
        fn get_member_collateral(self: @ContractState, member: ContractAddress) -> u256 {
            self.member_collateral.read(member)
        }

        fn get_total_collateral(self: @ContractState) -> u256 {
            self.total_collateral.read()
        }

        // TODO: Implement is_collateral_sufficient
        fn is_collateral_sufficient(self: @ContractState, member: ContractAddress) -> bool {
            false // Placeholder
        }
    }
}
