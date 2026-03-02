# Design Document: BTC + Cross-Chain Extension

## Critical Fixes Applied

This design has been updated to fix critical mismatches with the actual codebase:

**P0 Fixes (Security & Correctness):**
1. **AjoCore uses initialize(), not constructor** - Updated all references to use initialize() pattern with initialization guard
2. **AjoGovernance constructor signature corrected** - Now includes voting_period and quorum_percentage parameters
3. **Initialize authorization security** - Added `initialized` boolean flag AND `authorized_initializer` address to prevent re-initialization attacks and unauthorized initialization
4. **Deployment order changed** - All modules now deployed BEFORE AjoCore so module addresses are available for initialize()
5. **AjoCollateral constructor updated** - Now includes payments_contract and members_contract parameters, with set_payments_contract() setter to resolve circular dependency

**P1 Fixes (Implementation Correctness):**
4. **Collateral slashing destination** - Slash transfers to payments_contract (new storage field), not owner
5. **AjoSchedule cycle_duration** - Retrieved from AjoCore.get_config(), not stored in AjoSchedule
6. **Panic placeholder implementations** - Added implementations for:
   - AjoMembers.remove_member
   - AjoSchedule.get_next_execution_time
   - AjoGovernance.cancel_proposal
   - AjoCore.process_cycle
   - AjoCore.finalize_ajo
7. **IERC20.approve method** - Added approve() to IERC20 interface for swap functionality
8. **Authorization model clarified** - Owner can set adapter addresses; governance approval required for mode changes

**P2 Fixes (API Consistency):**
8. **Governance API** - Replaced non-existent has_quorum_approval() with get_proposal() status check
9. **Flow naming** - Updated references to use actual method names from interfaces

## Overview

This design extends the AJO.SAVE protocol to support Bitcoin-native DeFi with cross-chain capabilities while maintaining the deterministic ROSCA core on Starknet. The extension follows a phased approach with four major components:

1. **Phase 1: Bitcoin-First Protocol Baseline** - Make BTC fully operational end-to-end
2. **Phase 2: Bridge Adapter Integration** - Enable BTC deposit/withdrawal lifecycle
3. **Phase 3: Atomic Swap Integration** - Support asset conversion at payout
4. **Phase 4: OP_CAT-Compatible Collateral** - Advanced Bitcoin-native collateral enforcement

The design maintains strict separation of concerns by introducing adapters for cross-chain functionality rather than embedding protocol-specific logic in the core ROSCA modules.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AJO.SAVE Protocol                        │
│                    (Starknet Layer 2)                        │
├─────────────────────────────────────────────────────────────┤
│  Layer A: ROSCA Core (Deterministic)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ AjoCore  │  │AjoMembers│  │AjoPayments│  │AjoSchedule│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │AjoCollat.│  │AjoGovern.│  │AjoFactory│                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
├─────────────────────────────────────────────────────────────┤
│  Layer B: Asset/Cross-Chain Adapters (New)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │Bridge Adapter│  │ Swap Router  │  │BTC Collateral│     │
│  │              │  │              │  │   Adapter    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│  Layer C: External Systems                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │Bitcoin Network│  │Bridge Relayers│  │Swap Executors│    │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Module Interaction Flow


**BTC-Mode Ajo Creation Flow:**
```
User → AjoFactory.create_ajo(payment_token=BTC)
     → Factory deploys all modules with BTC config
     → AjoCore.initialize(config with BTC token address)
     → All modules configured for BTC operations
```

**Member Join with BTC:**
```
User → AjoCore.join_ajo(token_index)
     → Validates token_index matches BTC config
     → AjoMembers.add_member(user, position)
     → AjoCollateral.calculate_required_collateral(position)
     → AjoCollateral.deposit_collateral(amount)
     → ERC20(BTC).transfer_from(user, collateral_contract, amount)
```

**Payment Processing with Bridge:**
```
User deposits BTC on Bitcoin network
     → Bridge relayer detects deposit
     → Bridge_Adapter.register_deposit(proof, amount, user)
     → Mints/credits BTC on Starknet
     → User → AjoCore.process_payment()
     → AjoPayments.make_payment(cycle, amount)
     → ERC20(BTC).transfer_from(user, payments_contract, amount)
```

**Payout with Swap:**
```
All members paid → AjoCore._distribute_payout()
     → AjoPayments.get_payout_recipient(cycle)
     → If swap requested: Swap_Router.execute_swap(BTC → USDC)
     → AjoPayments.distribute_payout(recipient, amount)
     → ERC20.transfer(recipient, amount)
```

## Components and Interfaces

### Phase 1: Core Module Updates

#### 1.1 AjoFactory Constructor Calldata Fix

**Problem:** Factory currently deploys modules with empty constructor calldata, but modules require initialization parameters.

**Solution:** Construct proper calldata arrays for each module deployment.


**Module Initialization Signatures:**

```cairo
// AjoCore - Uses initialize(), NOT constructor
fn initialize(
    ref self: ContractState,
    config: AjoConfig,
    members_address: ContractAddress,
    collateral_address: ContractAddress,
    payments_address: ContractAddress,
    governance_address: ContractAddress,
    schedule_address: ContractAddress,
)

// AjoMembers constructor
fn constructor(
    ref self: ContractState,
    owner: ContractAddress,
    total_participants: u256,
)

// AjoCollateral constructor
fn constructor(
    ref self: ContractState,
    owner: ContractAddress,
    monthly_contribution: u256,
    total_participants: u256,
    payment_token: ContractAddress,
    payments_contract: ContractAddress,
    members_contract: ContractAddress,
)

// AjoPayments constructor
fn constructor(
    ref self: ContractState,
    owner: ContractAddress,
    monthly_contribution: u256,
    total_participants: u256,
    cycle_duration: u64,
    payment_token: ContractAddress,
    members_contract: ContractAddress,
)

// AjoGovernance constructor - CORRECTED SIGNATURE
fn constructor(
    ref self: ContractState,
    owner: ContractAddress,
    members_contract: ContractAddress,
    voting_period: u64,
    quorum_percentage: u256,
)

// AjoSchedule constructor
fn constructor(
    ref self: ContractState,
    owner: ContractAddress,
)
```

**Factory Deployment Sequence:**

**CRITICAL DEPLOYMENT ORDER CHANGE:**
The deployment order has been updated to deploy all modules BEFORE AjoCore, so that module addresses are available when calling AjoCore.initialize().

1. Deploy AjoMembers with (factory_address, total_participants)
2. Deploy AjoCollateral with (factory_address, monthly_contribution, total_participants, token_address, payments_address_placeholder, members_address)
3. Deploy AjoPayments with (factory_address, monthly_contribution, total_participants, cycle_duration, token_address, members_address)
4. Deploy AjoGovernance with (factory_address, members_address, voting_period, quorum_percentage)
5. Deploy AjoSchedule with (factory_address)
6. **Update AjoCollateral.payments_contract** to point to deployed AjoPayments address (via setter or re-initialization)
7. Deploy AjoCore with (factory_address) - constructor only sets authorized_initializer
8. Call AjoCore.initialize(config, members_address, collateral_address, payments_address, governance_address, schedule_address)
9. Transfer ownership of all modules to AjoCore

**Note on Step 6:** Since AjoCollateral needs the payments_contract address but AjoPayments is deployed after AjoCollateral, we have two options:
- Option A: Add a setter function `set_payments_contract(address)` to AjoCollateral that can be called by Factory after AjoPayments is deployed
- Option B: Pass a placeholder address in step 2, then update it in step 6

The implementation should use Option A (setter function) for clarity and explicit authorization.

#### 1.3 Asset Configuration Storage

**New Storage in AjoCore:**

```cairo
#[storage]
struct Storage {
    // Existing fields...
    
    // Initialization guard and authorization
    initialized: bool,  // Prevent re-initialization attacks
    authorized_initializer: ContractAddress,  // Only Factory can initialize
    
    // Asset configuration
    payment_token_address: ContractAddress,  // ERC20 contract address
    payment_token_decimals: u8,              // Token decimals (8 for BTC, 6 for USDC)
}
```

**Add Initialization Guard and Authorization:**

AjoCore.initialize must check both the `initialized` flag and caller authorization to prevent re-initialization attacks and unauthorized initialization:

```cairo
fn initialize(
    ref self: ContractState,
    config: AjoConfig,
    members_address: ContractAddress,
    collateral_address: ContractAddress,
    payments_address: ContractAddress,
    governance_address: ContractAddress,
    schedule_address: ContractAddress,
) {
    // CRITICAL: Check not already initialized
    assert(!self.initialized.read(), 'Already initialized');
    
    // CRITICAL: Check caller is authorized initializer (Factory)
    let caller = get_caller_address();
    let authorized = self.authorized_initializer.read();
    assert(caller == authorized, 'Unauthorized initializer');
    
    // ... rest of initialization logic ...
    
    // Mark as initialized at the end
    self.initialized.write(true);
}
```

**AjoCore Constructor:**

The AjoCore constructor must set the authorized_initializer to the Factory address:

```cairo
#[constructor]
fn constructor(ref self: ContractState, factory_address: ContractAddress) {
    // Set factory as the only authorized initializer
    self.authorized_initializer.write(factory_address);
    // initialized remains false until initialize() is called
}
```

#### 1.4 Complete TODO Functions and Panic Placeholders


**Token Address Resolution:**

```cairo
fn get_payment_token_address(self: @ContractState) -> ContractAddress {
    self.payment_token_address.read()
}

fn set_payment_token_address(ref self: ContractState, address: ContractAddress) {
    self.ownable.assert_only_owner();
    assert(!address.is_zero(), 'Invalid token address');
    self.payment_token_address.write(address);
}
```

#### 1.4 Complete TODO Functions

**AjoCollateral.slash_collateral:**

```cairo
fn slash_collateral(ref self: ContractState, member: ContractAddress, amount: u256) {
    // Only owner (AjoCore) can slash collateral
    self.ownable.assert_only_owner();
    
    // Get member's current collateral
    let current_collateral = self.member_collateral.read(member);
    assert(current_collateral >= amount, 'Insufficient collateral');
    
    // Get payment token and payments contract address
    let token_address = self.payment_token.read();
    let token = IERC20Dispatcher { contract_address: token_address };
    
    // Get payments contract address from storage
    let payments_contract = self.payments_contract.read();
    
    // Transfer slashed amount to payments contract
    let success = token.transfer(payments_contract, amount);
    assert(success, 'Token transfer failed');
    
    // Update member's collateral balance
    self.member_collateral.write(member, current_collateral - amount);
    
    // Update total collateral
    let current_total = self.total_collateral.read();
    self.total_collateral.write(current_total - amount);
    
    // Emit event
    self.emit(CollateralSlashed { member, amount });
}
```

**Note:** Requires adding `payments_contract: ContractAddress` to AjoCollateral storage and initializing it in the constructor.

**AjoCollateral.is_collateral_sufficient:**

```cairo
fn is_collateral_sufficient(self: @ContractState, member: ContractAddress) -> bool {
    // Get member's position from members contract
    let members_address = self.members_contract.read();
    let members = IAjoMembersDispatcher { contract_address: members_address };
    let member_data = members.get_member(member);
    
    // Calculate required collateral for this position
    let required = self.calculate_required_collateral(
        member_data.position,
        self.monthly_contribution.read(),
        self.total_participants.read()
    );
    
    // Get member's actual collateral
    let actual = self.member_collateral.read(member);
    
    // Return true if actual >= required
    actual >= required
}
```

**Note:** Requires adding `members_contract: ContractAddress` to AjoCollateral storage and initializing it in the constructor.


**AjoSchedule.schedule_cycle_payments:**

```cairo
fn schedule_cycle_payments(ref self: ContractState, cycle: u256, start_time: u64) {
    self.ownable.assert_only_owner();
    
    // Get cycle duration from AjoCore
    let core_address = self.ownable.owner();
    let core = IAjoCoreDispatcher { contract_address: core_address };
    let config = core.get_config();
    let cycle_duration = config.cycle_duration;
    
    // Calculate payment deadline (start_time + cycle_duration)
    let payment_deadline = start_time + cycle_duration;
    
    // Create scheduled task for payment processing
    let task_id = self.schedule_task(
        ScheduleType::Payment,
        payment_deadline,
        core_address,
        cycle.try_into().unwrap()
    );
    
    // Store task_id for this cycle
    self.cycle_payment_tasks.write(cycle, task_id);
}
```

**Note:** Requires adding `cycle_payment_tasks: Map<u256, u256>` to AjoSchedule storage. The cycle_duration is retrieved from AjoCore rather than stored in AjoSchedule.

**AjoSchedule.schedule_payout:**

```cairo
fn schedule_payout(
    ref self: ContractState, 
    cycle: u256, 
    recipient: ContractAddress, 
    payout_time: u64
) {
    self.ownable.assert_only_owner();
    
    // Validate payout_time is in the future
    let current_time = starknet::get_block_timestamp();
    assert(payout_time > current_time, 'Payout time must be future');
    
    // Get AjoCore address
    let core_address = self.ownable.owner();
    
    // Create scheduled task for payout distribution
    let task_id = self.schedule_task(
        ScheduleType::Payout,
        payout_time,
        core_address,
        cycle.try_into().unwrap()
    );
    
    // Store task_id for this cycle's payout
    self.cycle_payout_tasks.write(cycle, task_id);
}
```

**Note:** Requires adding `cycle_payout_tasks: Map<u256, u256>` to AjoSchedule storage.

**AjoSchedule.get_next_execution_time:**

```cairo
fn get_next_execution_time(self: @ContractState) -> u64 {
    let total_tasks = self.schedule_count.read();
    let current_time = starknet::get_block_timestamp();
    let mut next_time: u64 = 0;
    let mut found = false;
    
    // Iterate through all tasks to find the earliest pending execution time
    let mut task_id: u256 = 1;
    loop {
        if task_id > total_tasks {
            break;
        }
        
        let task = self.schedules.read(task_id);
        
        // Check if task is pending (not executed, not cancelled, time >= current)
        if task.id != 0 
            && !task.is_executed 
            && !task.is_cancelled 
            && task.execution_time >= current_time {
            
            if !found || task.execution_time < next_time {
                next_time = task.execution_time;
                found = true;
            }
        }
        
        task_id += 1;
    };
    
    // Return next execution time, or 0 if no pending tasks
    next_time
}
```

**AjoMembers.remove_member:**

```cairo
fn remove_member(ref self: ContractState, member: ContractAddress) {
    // Only owner (AjoCore) can remove members
    self.ownable.assert_only_owner();
    
    // Verify member exists
    assert(!member.is_zero(), Errors::ZERO_ADDRESS);
    let member_data = self.members.entry(member).read();
    assert(!member_data.address.is_zero(), Errors::MEMBER_NOT_FOUND);
    
    // Get member's position
    let position = member_data.position;
    
    // Clear member data
    let empty_member = Member {
        address: starknet::contract_address_const::<0>(),
        position: 0,
        collateral_deposited: 0,
        has_received_payout: false,
        status: MemberStatus::Removed,
        join_timestamp: 0,
    };
    self.members.entry(member).write(empty_member);
    
    // Clear position mapping
    self.position_to_member.entry(position).write(starknet::contract_address_const::<0>());
    
    // Decrement member count
    let current_count = self.member_count.read();
    self.member_count.write(current_count - 1);
    
    // Emit MemberRemoved event
    self.emit(MemberRemoved { member });
}
```

**AjoGovernance.cancel_proposal:**

```cairo
fn cancel_proposal(ref self: ContractState, proposal_id: u256) {
    let caller = starknet::get_caller_address();
    
    // Validate proposal exists
    let mut proposal = self.proposals.read(proposal_id);
    assert(proposal.id != 0, Errors::PROPOSAL_NOT_FOUND);
    
    // Only proposer or owner can cancel
    assert(
        caller == proposal.proposer || caller == self.ownable.owner(),
        'Unauthorized to cancel'
    );
    
    // Verify proposal is active
    assert(proposal.status == ProposalStatus::Active, 'Proposal not active');
    
    // Update status to Cancelled
    proposal.status = ProposalStatus::Cancelled;
    self.proposals.write(proposal_id, proposal);
    
    // Emit ProposalCancelled event
    self.emit(ProposalCancelled {
        proposal_id: proposal_id,
        canceller: caller,
    });
}
```

**AjoCore.process_cycle:**

```cairo
fn process_cycle(ref self: ContractState, cycle_number: u256) {
    // Only owner or schedule contract can process cycles
    let caller = get_caller_address();
    let schedule_address = self.schedule_contract.read();
    assert(
        caller == self.ownable.owner() || caller == schedule_address,
        'Unauthorized to process cycle'
    );
    
    // Verify Ajo is active
    assert(self.is_active.read(), 'Ajo is not active');
    
    // Verify cycle number matches current cycle
    let current_cycle = self.current_cycle.read();
    assert(cycle_number == current_cycle, 'Invalid cycle number');
    
    // Check if all members have paid for this cycle
    let payments_dispatcher = IAjoPaymentsDispatcher {
        contract_address: self.payments_contract.read()
    };
    let all_paid = payments_dispatcher.get_cycle_contributions(current_cycle) 
        == (self.monthly_contribution.read() * self.total_participants.read());
    
    // If all paid, distribute payout
    if all_paid {
        self._distribute_payout();
    }
}
```

**AjoCore.finalize_ajo:**

```cairo
fn finalize_ajo(ref self: ContractState) {
    // Only owner can finalize
    self.ownable.assert_only_owner();
    
    // Verify Ajo is active
    assert(self.is_active.read(), 'Ajo is not active');
    
    // Get payments dispatcher
    let payments_dispatcher = IAjoPaymentsDispatcher {
        contract_address: self.payments_contract.read()
    };
    
    // Verify all cycles completed (all members received payout)
    let total_participants = self.total_participants.read();
    let next_payout_position = payments_dispatcher.get_next_payout_position();
    assert(next_payout_position > total_participants, 'Not all payouts distributed');
    
    // Mark Ajo as inactive
    self.is_active.write(false);
    
    // Emit AjoFinalized event
    self.emit(AjoFinalized {
        ajo_id: self.ajo_id.read(),
        final_cycle: self.current_cycle.read(),
    });
}
```

**Note:** Requires adding `AjoFinalized` event to AjoCore events.

#### 1.4 Access Control Enforcement

**Module Authorization Pattern:**

```cairo
// In each module, store authorized caller addresses
#[storage]
struct Storage {
    authorized_core: ContractAddress,  // Only AjoCore can call sensitive methods
    // ... other storage
}

// Modifier-like internal function
fn assert_only_core(self: @ContractState) {
    let caller = get_caller_address();
    let authorized = self.authorized_core.read();
    assert(caller == authorized, 'Unauthorized: only core');
}

// Use in sensitive functions
fn add_member(ref self: ContractState, member: ContractAddress, position: u256) {
    self.assert_only_core();
    // ... implementation
}
```

### Phase 2: Bridge Adapter Integration

#### 2.1 Bridge Adapter Interface

**File:** `src/interfaces/i_bridge_adapter.cairo`


```cairo
use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum BridgeRequestStatus {
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
    pub btc_address: felt252,  // Bitcoin address hash
    pub nonce: u256,
    pub status: BridgeRequestStatus,
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IBridgeAdapter<TContractState> {
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
        ref self: TContractState,
        ajo_id: u256,
        amount: u256,
        btc_address: felt252,
    ) -> u256;
    
    fn finalize_withdrawal(
        ref self: TContractState,
        request_id: u256,
        btc_tx_hash: felt252,
    );
    
    fn cancel_withdrawal(ref self: TContractState, request_id: u256);
    
    // Query functions
    fn get_deposit_request(self: @TContractState, request_id: u256) -> DepositRequest;
    fn get_withdrawal_request(self: @TContractState, request_id: u256) -> WithdrawalRequest;
    fn get_request_status(self: @TContractState, request_id: u256) -> BridgeRequestStatus;
    
    // Configuration
    fn set_bridge_relayer(ref self: TContractState, relayer: ContractAddress);
    fn get_bridge_relayer(self: @TContractState) -> ContractAddress;
}
```

#### 2.2 Bridge Adapter Implementation

**File:** `src/adapters/bridge_adapter.cairo`


```cairo
#[starknet::contract]
pub mod BridgeAdapter {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, 
                            StoragePointerReadAccess, StoragePointerWriteAccess};
    use ajo_save::interfaces::i_bridge_adapter::{
        IBridgeAdapter, DepositRequest, WithdrawalRequest, BridgeRequestStatus
    };
    use ajo_save::components::ownable::{OwnableComponent, IOwnable};
    use ajo_save::components::pausable::{PausableComponent, IPausable};
    
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    
    #[storage]
    struct Storage {
        // Request tracking
        deposit_requests: Map<u256, DepositRequest>,
        withdrawal_requests: Map<u256, WithdrawalRequest>,
        next_request_id: u256,
        
        // Replay protection
        used_btc_tx_hashes: Map<felt252, bool>,
        member_nonces: Map<ContractAddress, u256>,
        
        // Configuration
        bridge_relayer: ContractAddress,
        
        // Components
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        DepositRegistered: DepositRegistered,
        DepositFinalized: DepositFinalized,
        WithdrawalRequested: WithdrawalRequested,
        WithdrawalFinalized: WithdrawalFinalized,
        WithdrawalCancelled: WithdrawalCancelled,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct DepositRegistered {
        #[key]
        pub request_id: u256,
        #[key]
        pub member: ContractAddress,
        pub ajo_id: u256,
        pub amount: u256,
        pub btc_tx_hash: felt252,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct DepositFinalized {
        #[key]
        pub request_id: u256,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalRequested {
        #[key]
        pub request_id: u256,
        #[key]
        pub member: ContractAddress,
        pub ajo_id: u256,
        pub amount: u256,
        pub btc_address: felt252,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalFinalized {
        #[key]
        pub request_id: u256,
        pub btc_tx_hash: felt252,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalCancelled {
        #[key]
        pub request_id: u256,
    }
    
    // Implementation continues...
}
```


**Key Implementation Details:**

- **Replay Protection:** Track used BTC transaction hashes to prevent duplicate deposit registrations
- **Nonce Management:** Each member has a nonce that increments with each withdrawal request
- **Relayer Authorization:** Only authorized bridge relayer can finalize deposits/withdrawals
- **Status Tracking:** All requests maintain status (Pending → Finalized/Cancelled)

**Authorization Model:**
- **Adapter Address Configuration:** Owner can set adapter addresses (set_bridge_adapter, set_swap_router, set_btc_collateral_adapter)
- **Mode Changes:** Governance approval required for collateral mode changes (set_collateral_mode, enable_btc_commitment, disable_btc_commitment)

### Phase 3: Atomic Swap Integration

#### 3.1 Swap Router Interface

**File:** `src/interfaces/i_swap_router.cairo`

```cairo
use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum SwapStatus {
    Pending,
    Executed,
    Cancelled,
    Failed,
}

#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct SwapRequest {
    pub request_id: u256,
    pub ajo_id: u256,
    pub recipient: ContractAddress,
    pub source_token: ContractAddress,
    pub dest_token: ContractAddress,
    pub source_amount: u256,
    pub min_dest_amount: u256,
    pub deadline: u64,
    pub status: SwapStatus,
    pub actual_dest_amount: u256,
}

#[starknet::interface]
pub trait ISwapRouter<TContractState> {
    // Quote and execution
    fn get_quote(
        self: @TContractState,
        source_token: ContractAddress,
        dest_token: ContractAddress,
        amount: u256,
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
    
    // Query functions
    fn get_swap_request(self: @TContractState, request_id: u256) -> SwapRequest;
    fn get_swap_status(self: @TContractState, request_id: u256) -> SwapStatus;
}
```

#### 3.2 Swap Router Implementation

**File:** `src/adapters/swap_router.cairo`


```cairo
#[starknet::contract]
pub mod SwapRouter {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess,
                            StoragePointerReadAccess, StoragePointerWriteAccess};
    use ajo_save::interfaces::i_swap_router::{ISwapRouter, SwapRequest, SwapStatus};
    use ajo_save::components::ownable::{OwnableComponent, IOwnable};
    
    // ERC20 interface
    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TContractState, sender: ContractAddress, 
                        recipient: ContractAddress, amount: u256) -> bool;
        fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    }
    
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    
    #[storage]
    struct Storage {
        // Swap tracking
        swap_requests: Map<u256, SwapRequest>,
        next_request_id: u256,
        
        // DEX integration (e.g., JediSwap, 10KSwap)
        dex_router: ContractAddress,
        
        // Components
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        SwapQuoted: SwapQuoted,
        SwapExecuted: SwapExecuted,
        SwapCancelled: SwapCancelled,
        SwapFailed: SwapFailed,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct SwapQuoted {
        pub source_token: ContractAddress,
        pub dest_token: ContractAddress,
        pub source_amount: u256,
        pub quoted_dest_amount: u256,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct SwapExecuted {
        #[key]
        pub request_id: u256,
        #[key]
        pub recipient: ContractAddress,
        pub source_amount: u256,
        pub dest_amount: u256,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct SwapCancelled {
        #[key]
        pub request_id: u256,
        pub reason: felt252,
    }
    
    #[derive(Drop, starknet::Event)]
    pub struct SwapFailed {
        #[key]
        pub request_id: u256,
        pub reason: felt252,
    }
    
    // Implementation with DEX integration...
}
```

**Swap Execution Logic:**

1. Validate deadline hasn't passed
2. Transfer source tokens from caller to swap router
3. Call DEX router to execute swap
4. Verify output amount >= min_dest_amount
5. Transfer destination tokens to recipient
6. On failure: revert transaction, return source tokens


#### 3.3 AjoPayments Integration

**Updated distribute_payout function:**

```cairo
fn distribute_payout(ref self: ContractState, cycle: u256, recipient: ContractAddress) {
    self.reentrancy_guard.start();
    
    let monthly = self.monthly_contribution.read();
    let total = self.total_participants.read();
    let payout_amount = monthly * total;
    
    // Check if swap is requested for this payout
    let swap_router_address = self.swap_router.read();
    let recipient_preferred_token = self.recipient_token_preferences.read(recipient);
    let pool_token = self.payment_token.read();
    
    if !swap_router_address.is_zero() && recipient_preferred_token != pool_token {
        // Execute swap path
        let swap_router = ISwapRouterDispatcher { contract_address: swap_router_address };
        
        // Get quote
        let min_output = swap_router.get_quote(pool_token, recipient_preferred_token, payout_amount);
        
        // Calculate deadline (current time + 5 minutes)
        let deadline = get_block_timestamp() + 300;
        
        // Approve swap router to spend tokens
        let token = IERC20Dispatcher { contract_address: pool_token };
        token.approve(swap_router_address, payout_amount);
        
        // Execute swap
        let actual_output = swap_router.execute_swap(
            self.ajo_id.read(),
            recipient,
            pool_token,
            recipient_preferred_token,
            payout_amount,
            min_output,
            deadline
        );
        
        // Tokens are already transferred to recipient by swap router
        self.emit(PayoutDistributed { cycle, recipient, amount: actual_output });
    } else {
        // Direct transfer path (no swap)
        let token = IERC20Dispatcher { contract_address: pool_token };
        let success = token.transfer(recipient, payout_amount);
        assert(success, 'Payout transfer failed');
        
        self.emit(PayoutDistributed { cycle, recipient, amount: payout_amount });
    }
    
    self.reentrancy_guard.end();
}
```

### Phase 4: OP_CAT-Compatible BTC Collateral Adapter

#### 4.1 Collateral Mode Enum

**Update to types.cairo:**

```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum CollateralMode {
    L2Escrow,        // Current mode: collateral held in Starknet contract
    BTCCommitment,   // OP_CAT mode: collateral enforced on Bitcoin network
}
```


#### 4.2 BTC Collateral Adapter Interface

**File:** `src/interfaces/i_btc_collateral_adapter.cairo`

```cairo
use starknet::ContractAddress;

#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum CommitmentStatus {
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
}

#[starknet::interface]
pub trait IBTCCollateralAdapter<TContractState> {
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
        ref self: TContractState,
        commitment_id: u256,
        verification_proof: Span<felt252>,
    );
    
    fn start_enforcement(
        ref self: TContractState,
        commitment_id: u256,
        default_proof: Span<felt252>,
    );
    
    fn confirm_enforcement(
        ref self: TContractState,
        commitment_id: u256,
        btc_tx_hash: felt252,
    );
    
    fn release_commitment(ref self: TContractState, commitment_id: u256);
    
    // Query functions
    fn get_commitment(self: @TContractState, commitment_id: u256) -> BTCCommitment;
    fn get_member_commitment(self: @TContractState, member: ContractAddress) -> u256;
    fn get_commitment_status(self: @TContractState, commitment_id: u256) -> CommitmentStatus;
}
```

#### 4.3 Collateral Mode Configuration

**Update AjoConfig:**

```cairo
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct AjoConfig {
    pub name: felt252,
    pub monthly_contribution: u256,
    pub total_participants: u256,
    pub cycle_duration: u64,
    pub payment_token: PaymentToken,
    pub collateral_mode: CollateralMode,  // New field
    pub creator: ContractAddress,
}
```

**Governance-Controlled Mode Switch:**

```cairo
fn set_collateral_mode(ref self: ContractState, mode: CollateralMode) {
    // Require governance approval
    let governance = IAjoGovernanceDispatcher { 
        contract_address: self.governance_contract.read() 
    };
    
    // Check if governance has approved this action
    // Note: Use existing governance methods (has_quorum and is_passed)
    // rather than non-existent has_quorum_approval method
    let proposal_id = self.pending_collateral_mode_proposal.read();
    assert(proposal_id != 0, 'No proposal for mode change');
    
    let proposal = governance.get_proposal(proposal_id);
    assert(proposal.status == ProposalStatus::Executed, 'Proposal not executed');
    
    // Update mode
    self.collateral_mode.write(mode);
    
    // Emit event
    self.emit(CollateralModeChanged { old_mode: self.collateral_mode.read(), new_mode: mode });
}
```

**Note:** The design previously referenced `has_quorum_approval()` which doesn't exist in the governance interface. Use the existing `get_proposal()` method to check proposal status instead.


## Data Models

### Updated Type Definitions

**PaymentToken (existing):**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum PaymentToken {
    USDC,
    BTC,
}
```

**CollateralMode (new):**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum CollateralMode {
    L2Escrow,
    BTCCommitment,
}
```

**BridgeRequestStatus (new):**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum BridgeRequestStatus {
    Pending,
    Finalized,
    Cancelled,
}
```

**SwapStatus (new):**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum SwapStatus {
    Pending,
    Executed,
    Cancelled,
    Failed,
}
```

**CommitmentStatus (new):**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store, PartialEq)]
pub enum CommitmentStatus {
    Registered,
    Verified,
    EnforcementStarted,
    EnforcementConfirmed,
    Released,
}
```

### Storage Patterns

**Adapter Configuration in AjoCore:**
```cairo
#[storage]
struct Storage {
    // Existing fields...
    
    // Adapter addresses
    bridge_adapter: ContractAddress,
    swap_router: ContractAddress,
    btc_collateral_adapter: ContractAddress,
    
    // Feature flags
    bridge_enabled: bool,
    swap_enabled: bool,
    btc_commitment_enabled: bool,
}
```

**Request Tracking Pattern:**
```cairo
// In adapters
#[storage]
struct Storage {
    requests: Map<u256, RequestStruct>,
    next_request_id: u256,
    member_requests: Map<ContractAddress, Vec<u256>>,  // Member → request IDs
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies to eliminate:

- Properties 5.1, 5.2, 5.6, and 5.8 all test request data storage and retrieval - these can be combined into a single comprehensive property about request lifecycle data integrity
- Properties 8.1, 8.2, and 8.3 all test security mechanisms - these can be grouped but should remain separate as they test distinct security features
- Properties 3.2, 3.3, 3.4 test BTC payment flow - these can be combined into a comprehensive BTC payment cycle property
- Properties 4.1, 4.2, 4.3, 4.4 all test access control - these can be combined into a single access control property
- Properties 6.1, 6.2, 6.7 test payout paths - these can be combined into a single payout routing property

### Core System Properties

**Property 1: Factory Constructor Calldata Correctness**
*For any* valid Ajo configuration, when the Factory deploys modules, each deployed module should be initialized with constructor parameters that match the Ajo configuration (monthly_contribution, total_participants, payment_token address, etc.)
**Validates: Requirements 1.1, 1.2, 1.3**

**Property 2: Factory Class Hash Validation**
*For any* deployment attempt, if any required class hash is not set (is zero), the Factory should reject the deployment with a descriptive error
**Validates: Requirements 1.4**

**Property 3: Collateral Slashing Transfer**
*For any* member with sufficient collateral and any valid slash amount, calling slash_collateral should result in the specified amount being transferred from the member's collateral balance to the payments contract
**Validates: Requirements 2.1**

**Property 4: Collateral Sufficiency Check**
*For any* member in an Ajo, is_collateral_sufficient should return true if and only if the member's actual collateral is greater than or equal to the required collateral for their position
**Validates: Requirements 2.2**


**Property 5: Schedule Function Completion**
*For any* valid cycle and time parameters, calling schedule_cycle_payments or schedule_payout should complete without panic and store the correct deadline/execution time
**Validates: Requirements 2.3, 2.4, 2.5**

**Property 6: BTC Payment Cycle Completeness**
*For any* BTC-mode Ajo with all members having paid, the system should successfully distribute the BTC payout to the designated recipient with the correct amount (monthly_contribution × total_participants)
**Validates: Requirements 3.2, 3.3, 3.4**

**Property 7: Token Index Validation**
*For any* Ajo with a configured payment_token, when a member calls join_ajo with a token_index parameter, the system should reject the call if token_index does not match the configured payment_token
**Validates: Requirements 3.5**

**Property 8: Asset Configuration Persistence**
*For any* created Ajo, querying the Ajo configuration should return the exact payment token type, contract address, and decimal metadata that was specified during creation
**Validates: Requirements 3.6, 3.7**

**Property 9: Access Control Enforcement**
*For any* sensitive module method (add_member, deposit_collateral, make_payment, etc.), calls from unauthorized addresses should be rejected, and only authorized callers (AjoCore, Factory, or Owner as appropriate) should succeed
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

**Property 10: Ownership Transfer Propagation**
*For any* Ajo system, when ownership is transferred in AjoCore, all modules should recognize the new owner for subsequent authorization checks
**Validates: Requirements 4.5**

**Property 11: Bridge Request Lifecycle Integrity**
*For any* deposit or withdrawal request, the Bridge_Adapter should maintain accurate request data (ID, amount, member, status) throughout the lifecycle, and querying the request should return the current accurate state
**Validates: Requirements 5.1, 5.2, 5.3, 5.6, 5.8**

**Property 12: Bridge Replay Protection**
*For any* BTC transaction hash or withdrawal nonce, submitting a duplicate deposit proof or replaying a withdrawal request should be rejected by the Bridge_Adapter
**Validates: Requirements 5.4, 5.5**

**Property 13: Payout Routing Correctness**
*For any* payout distribution, if no swap is requested, funds should transfer directly to the recipient; if a swap is requested, the Swap_Router should execute the conversion and the recipient should receive the destination token
**Validates: Requirements 6.1, 6.2, 6.7**

**Property 14: Swap Validation and Timeout Handling**
*For any* swap request, the Swap_Router should validate quote, deadline, and minimum output; if the deadline has passed, the swap should be cancelled and funds returned to the payments contract
**Validates: Requirements 6.3, 6.4, 6.8**

**Property 15: Swap Failure Fund Preservation**
*For any* swap that fails due to slippage or other errors, the transaction should revert and all funds should remain in the payments contract (no fund loss)
**Validates: Requirements 6.5**

**Property 16: Swap Event Emission**
*For any* swap operation (quote, execution, cancellation), the Swap_Router should emit the corresponding event with accurate parameters
**Validates: Requirements 6.6**

**Property 17: BTC Commitment Registration**
*For any* member registering a BTC collateral commitment, the BTC_Collateral_Adapter should store the commitment with all provided data (amount, script hash, proof reference) and return a unique commitment ID
**Validates: Requirements 7.1**

**Property 18: Commitment Proof Verification**
*For any* registered commitment, submitting a valid verification proof should result in the commitment status transitioning to Verified; invalid proofs should be rejected
**Validates: Requirements 7.2**

**Property 19: Enforcement Confirmation State Update**
*For any* commitment in enforcement, when enforcement is confirmed with a BTC transaction hash, the BTC_Collateral_Adapter should update the commitment status to EnforcementConfirmed and emit a confirmation event
**Validates: Requirements 7.4**

**Property 20: Collateral Mode Support**
*For any* Ajo configuration, the system should support both L2Escrow and BTCCommitment collateral modes, and the active mode should be queryable and match the configuration
**Validates: Requirements 7.5, 7.8**

**Property 21: Collateral Mode Fallback**
*For any* Ajo configured with BTCCommitment mode, if BTCCommitment operations are unavailable or disabled, the system should fall back to L2Escrow mode without failure
**Validates: Requirements 7.6**

**Property 22: Governance-Controlled OP_CAT**
*For any* attempt to enable OP_CAT enforcement, the system should require governance approval; attempts without approval should be rejected
**Validates: Requirements 7.7**

**Property 23: Adapter Access Control**
*For any* adapter entry point (bridge, swap, BTC collateral), calls from unauthorized addresses should be rejected with access control errors
**Validates: Requirements 8.1**

**Property 24: Replay Protection Enforcement**
*For any* bridge or swap request, the system should validate nonces or request IDs to prevent replay attacks; duplicate submissions should be rejected
**Validates: Requirements 8.2**

**Property 25: Reentrancy Protection**
*For any* token transfer operation, if a malicious contract attempts reentrancy, the system should reject the reentrant call and prevent state corruption
**Validates: Requirements 8.3, 8.8**

**Property 26: Emergency Pause Effectiveness**
*For any* adapter, when emergency pause is activated, all critical operations through that adapter should be blocked until unpaused
**Validates: Requirements 8.4**

**Property 27: Lifecycle Event Emission**
*For any* state-changing operation (deposit, withdrawal, swap, commitment, etc.), the system should emit a corresponding event with accurate parameters
**Validates: Requirements 8.5, 10.5**

**Property 28: Adapter Configuration Authorization Split**
*For any* adapter configuration change, the system should require owner authorization for adapter address updates and governance approval for BTC commitment mode changes; unauthorized attempts should be rejected
**Validates: Requirements 11.1, 11.2, 11.3**

**Property 29: Emergency Adapter Disable**
*For any* adapter, when emergency disable is triggered, all subsequent calls to that adapter should be immediately blocked
**Validates: Requirements 11.4**

**Property 30: Configuration History Persistence**
*For any* adapter configuration or mode change, the system should record the change and emit an event; querying configuration should return current addresses and enabled status
**Validates: Requirements 11.5, 11.6, 11.7**


## Error Handling

### Error Categories

**1. Input Validation Errors**
- Invalid token address (zero address)
- Invalid amount (zero or negative)
- Invalid participant count (below MIN or above MAX)
- Invalid cycle duration (below MIN or above MAX)
- Token index mismatch with configured payment token

**2. Authorization Errors**
- Unauthorized caller (not AjoCore, Factory, or Owner)
- Governance approval required but not obtained
- Emergency pause active

**3. State Errors**
- Ajo not found
- Ajo already initialized
- Member not found
- Member already exists
- Insufficient collateral balance
- Cycle not active
- Already paid for cycle

**4. Bridge/Swap Errors**
- Duplicate deposit proof (replay attack)
- Invalid nonce (replay attack)
- Deadline expired
- Slippage exceeded
- Request not found
- Request already finalized
- Request cancelled

**5. Token Transfer Errors**
- ERC20 transfer failed
- Insufficient token balance
- Insufficient allowance

### Error Handling Patterns

**Explicit Error Messages:**
```cairo
assert(amount > 0, 'Amount must be greater than 0');
assert(!address.is_zero(), 'Invalid token address');
assert(caller == authorized, 'Unauthorized: only core');
```

**Revert on Failure:**
```cairo
let success = token.transfer(recipient, amount);
assert(success, 'Token transfer failed');
```

**Status Tracking:**
```cairo
// Instead of silent failure, update status
if enforcement_failed {
    request.status = BridgeRequestStatus::Cancelled;
    self.emit(RequestCancelled { request_id, reason: 'Enforcement failed' });
}
```

**Reentrancy Protection:**
```cairo
fn deposit_collateral(ref self: ContractState, amount: u256) {
    self.reentrancy_guard.start();
    // ... operation ...
    self.reentrancy_guard.end();
}
```

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests as complementary approaches:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs

Together, these provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Unit Testing Focus

Unit tests should focus on:
- Specific examples that demonstrate correct behavior
- Integration points between components
- Edge cases (zero amounts, boundary values, empty states)
- Error conditions (unauthorized access, invalid inputs, insufficient balances)

Avoid writing too many unit tests for cases that property-based tests will cover through randomization.

### Property-Based Testing Configuration

**Library Selection:**
- Cairo: Use built-in fuzzing capabilities or custom property test framework
- Minimum 100 iterations per property test (due to randomization)

**Test Tagging:**
Each property test must reference its design document property:
```cairo
// Feature: btc-crosschain-integration, Property 1: Factory Constructor Calldata Correctness
#[test]
fn test_factory_constructor_calldata_correctness() {
    // Generate random Ajo configurations
    // Deploy modules
    // Verify initialization parameters match configuration
}
```

**Property Test Structure:**
1. Generate random valid inputs
2. Execute operation
3. Assert property holds
4. Repeat for minimum 100 iterations


### Test Coverage by Phase

**Phase 1: Bitcoin-First Protocol Baseline**

Unit Tests:
- Factory deployment with BTC configuration
- Module initialization with correct parameters
- BTC token address resolution
- TODO function implementations (slash_collateral, is_collateral_sufficient, schedule functions)
- Access control enforcement

Property Tests:
- Property 1: Factory constructor calldata correctness
- Property 2: Factory class hash validation
- Property 3: Collateral slashing transfer
- Property 4: Collateral sufficiency check
- Property 5: Schedule function completion
- Property 6: BTC payment cycle completeness
- Property 7: Token index validation
- Property 8: Asset configuration persistence
- Property 9: Access control enforcement
- Property 10: Ownership transfer propagation

**Phase 2: Bridge Adapter Integration**

Unit Tests:
- Deposit registration with valid proof
- Withdrawal request creation
- Request finalization
- Duplicate proof rejection
- Nonce validation

Property Tests:
- Property 11: Bridge request lifecycle integrity
- Property 12: Bridge replay protection
- Property 23: Adapter access control
- Property 24: Replay protection enforcement
- Property 27: Lifecycle event emission

**Phase 3: Atomic Swap Integration**

Unit Tests:
- Direct payout (no swap)
- Swap payout with valid quote
- Deadline expiration handling
- Slippage failure handling
- Swap cancellation

Property Tests:
- Property 13: Payout routing correctness
- Property 14: Swap validation and timeout handling
- Property 15: Swap failure fund preservation
- Property 16: Swap event emission

**Phase 4: OP_CAT-Compatible Collateral**

Unit Tests:
- Commitment registration
- Proof verification (valid and invalid)
- Enforcement lifecycle
- Mode switching (L2Escrow ↔ BTCCommitment)
- Governance approval requirement

Property Tests:
- Property 17: BTC commitment registration
- Property 18: Commitment proof verification
- Property 19: Enforcement confirmation state update
- Property 20: Collateral mode support
- Property 21: Collateral mode fallback
- Property 22: Governance-controlled OP_CAT

**Security and Reliability Tests (All Phases)**

Unit Tests:
- Reentrancy attack attempts
- Unauthorized access attempts
- Emergency pause activation
- Invalid input rejection

Property Tests:
- Property 25: Reentrancy protection
- Property 26: Emergency pause effectiveness
- Property 28: Adapter configuration authorization split
- Property 29: Emergency adapter disable
- Property 30: Configuration history persistence

### Integration Tests

**Full BTC Cycle Test:**
1. Create BTC-mode Ajo
2. Members join with BTC collateral
3. Process BTC payments for full cycle
4. Distribute BTC payout
5. Verify all state transitions and balances

**Bridge Lifecycle Test:**
1. Register BTC deposit
2. Finalize deposit
3. Request withdrawal
4. Finalize withdrawal
5. Verify request status transitions

**Swap Payout Test:**
1. Create Ajo with BTC
2. Complete payment cycle
3. Request swap to USDC for payout
4. Verify recipient receives USDC

**Default Handling with BTC Collateral:**
1. Create BTC-mode Ajo
2. Member defaults on payment
3. Seize BTC collateral
4. Verify collateral redistribution

### Negative/Adversarial Tests

- Duplicate deposit proof submission
- Replayed withdrawal request
- Expired swap deadline
- Unauthorized adapter calls
- Reentrancy attack attempts
- Insufficient collateral attempts
- Invalid token index in join_ajo
- Unauthorized adapter address updates and unauthorized mode changes

### Exit Criteria

All tests must pass before deployment:
- `snforge test` reports zero failures
- No panic placeholders in runtime-critical functions
- All property tests pass with minimum 100 iterations
- Integration tests pass on local testnet
- Adversarial tests successfully reject malicious inputs
