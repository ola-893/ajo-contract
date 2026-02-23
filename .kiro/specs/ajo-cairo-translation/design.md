# AJO.SAVE Solidity to Cairo Translation - Design Document

## 1. Design Overview

### 1.1 Purpose
This document provides the detailed technical design for translating the AJO.SAVE ROSCA protocol from Solidity (Hedera) to Cairo (StarkNet), preserving the innovative 60% collateral model while adapting to StarkNet's architecture.

### 1.2 Design Principles
- **Preserve Core Innovation**: Maintain exact 60% collateral formula and guarantor network
- **Platform-Native**: Leverage StarkNet's class hash system and Cairo components
- **Security-First**: Implement comprehensive access control and reentrancy protection
- **Gas Optimization**: Use efficient storage patterns and batch operations
- **Modularity**: Clear separation of concerns across contracts

### 1.3 Architecture Pattern
**Factory + Modular Contracts**
- Factory deploys instances using class hashes
- Core contract orchestrates specialized modules
- Each module handles a specific domain (members, collateral, payments, governance)

## 2. System Architecture

### 2.1 Contract Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                        AjoFactory                            │
│  - Deploys Ajo instances using class hashes                 │
│  - 5-phase initialization to prevent circular dependencies  │
│  - Registry of all Ajos                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ deploys
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         AjoCore                              │
│  - Main orchestration contract                              │
│  - Coordinates all modules                                  │
│  - Manages Ajo lifecycle                                    │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         │              │              │              │
    ┌────▼───┐    ┌────▼────┐    ┌───▼────┐    ┌───▼────────┐
    │ Members│    │Collateral│    │Payments│    │Governance  │
    │        │    │          │    │        │    │            │
    │Queue & │    │60%       │    │Cycle   │    │Proposals & │
    │Guarantor│   │Formula   │    │Mgmt    │    │Voting      │
    └────────┘    └──────────┘    └────────┘    └────────────┘
```

### 2.2 Component Architecture

All contracts use shared components:
```
┌──────────────────────────────────────┐
│         Shared Components            │
├──────────────────────────────────────┤
│  • OwnableComponent                  │
│  • PausableComponent                 │
│  • ReentrancyGuardComponent          │
└──────────────────────────────────────┘
```

### 2.3 Data Flow

**Member Joining Flow:**
```
User → AjoCore.join_ajo()
  ├─→ AjoMembers.add_member()
  │   └─→ Calculate guarantor position
  ├─→ AjoCollateral.calculate_required_collateral()
  │   └─→ Apply 60% formula
  ├─→ AjoCollateral.deposit_collateral()
  │   └─→ Transfer ERC20 tokens
  └─→ Emit MemberJoined event
```

**Payment Processing Flow:**
```
User → AjoCore.process_payment()
  ├─→ AjoPayments.record_payment()
  │   └─→ Transfer ERC20 from member
  ├─→ Check if all members paid
  ├─→ If yes: AjoPayments.distribute_payout()
  │   ├─→ Calculate payout amount
  │   ├─→ Transfer to recipient
  │   └─→ Advance cycle
  └─→ Emit PaymentProcessed event
```

**Default Handling Flow:**
```
System → AjoCore.handle_default()
  ├─→ AjoMembers.get_guarantor()
  ├─→ AjoCollateral.seize_collateral(defaulter)
  ├─→ AjoCollateral.seize_collateral(guarantor)
  ├─→ AjoPayments.seize_past_payments(defaulter)
  ├─→ AjoPayments.seize_past_payments(guarantor)
  ├─→ Transfer seized assets to payments contract
  └─→ Emit DefaultHandled event
```

## 3. Contract Designs

### 3.1 AjoFactory

**Purpose**: Deploy and manage Ajo instances

**Storage:**
```cairo
#[storage]
struct Storage {
    // Class hashes for deployment
    core_class_hash: ClassHash,
    members_class_hash: ClassHash,
    collateral_class_hash: ClassHash,
    payments_class_hash: ClassHash,
    governance_class_hash: ClassHash,
    schedule_class_hash: ClassHash,
    
    // Registry
    ajo_count: u256,
    ajos: Map<u256, AjoInfo>,
    user_ajos: Map<ContractAddress, Vec<u256>>,
    
    // Components
    #[substorage(v0)]
    ownable: OwnableComponent::Storage,
    #[substorage(v0)]
    pausable: PausableComponent::Storage,
}
```

**Key Functions:**
- `create_ajo(name, monthly_contribution, total_participants, cycle_duration)` → u256
- `deploy_core(ajo_id)` → ContractAddress
- `deploy_members(ajo_id)` → ContractAddress
- `deploy_collateral_and_payments(ajo_id)` → (ContractAddress, ContractAddress)
- `deploy_governance_and_schedule(ajo_id)` → (ContractAddress, ContractAddress)
- `get_ajo_info(ajo_id)` → AjoInfo
- `get_user_ajos(user)` → Span<u256>

**5-Phase Initialization:**
1. **Phase 1**: Create Ajo with basic config
2. **Phase 2**: Deploy core orchestration contract
3. **Phase 3**: Deploy members management contract
4. **Phase 4**: Deploy collateral & payments contracts
5. **Phase 5**: Deploy governance & schedule contracts

**Design Rationale:**
- Phased deployment prevents circular dependencies
- Class hash system is more gas-efficient than proxies
- Registry enables discovery of all Ajos

### 3.2 AjoCore

**Purpose**: Main orchestration and lifecycle management

**Storage:**
```cairo
#[storage]
struct Storage {
    // Configuration
    ajo_id: u256,
    name: felt252,
    monthly_contribution: u256,
    total_participants: u256,
    cycle_duration: u64,
    payment_token: ContractAddress,
    
    // Module addresses
    members_contract: ContractAddress,
    collateral_contract: ContractAddress,
    payments_contract: ContractAddress,
    governance_contract: ContractAddress,
    schedule_contract: ContractAddress,
    
    // State
    is_active: bool,
    current_cycle: u256,
    
    // Components
    #[substorage(v0)]
    ownable: OwnableComponent::Storage,
    #[substorage(v0)]
    pausable: PausableComponent::Storage,
    #[substorage(v0)]
    reentrancy_guard: ReentrancyGuardComponent::Storage,
}
```

**Key Functions:**
- `initialize(config, module_addresses)`
- `join_ajo(token_index)` - Member onboarding
- `process_payment()` - Monthly contribution
- `distribute_payout()` - Payout to next recipient
- `handle_default(defaulter)` - Default processing
- `exit_ajo()` - Member exit with penalty
- `start_ajo()` - Begin first cycle
- `advance_cycle()` - Move to next cycle
- `get_ajo_status()` → AjoStatus

**Design Rationale:**
- Thin orchestration layer delegates to specialized modules
- Reentrancy protection on all state-changing functions
- Pausable for emergency situations

### 3.3 AjoMembers

**Purpose**: Member queue management and guarantor network

**Storage:**
```cairo
#[storage]
struct Storage {
    // Member data
    members: Map<ContractAddress, Member>,
    position_to_member: Map<u256, ContractAddress>,
    member_list: Vec<ContractAddress>,
    member_count: u256,
    
    // Configuration
    total_participants: u256,
    
    // Components
    #[substorage(v0)]
    ownable: OwnableComponent::Storage,
}
```

**Key Functions:**
- `add_member(member, position)` - Add member to queue
- `get_member(member)` → Member - Get member details
- `get_guarantor(member)` → ContractAddress - Calculate guarantor
- `calculate_guarantor_position(position)` → u256 - Offset calculation
- `update_member_status(member, status)` - Update status
- `mark_payout_received(member)` - Track payout
- `get_active_members()` → Span<ContractAddress>
- `is_member(address)` → bool

**Guarantor Calculation:**
```cairo
fn calculate_guarantor_position(
    ref self: ContractState,
    position: u256
) -> u256 {
    let total = self.total_participants.read();
    let offset = total / 2;
    ((position - 1 + offset) % total) + 1
}
```

**Design Rationale:**
- Simple offset formula distributes risk evenly
- Position-based queue ensures fair rotation
- Guarantor network creates mutual accountability

### 3.4 AjoCollateral

**Purpose**: Dynamic collateral calculation and management

**Storage:**
```cairo
#[storage]
struct Storage {
    // Collateral tracking
    member_collateral: Map<ContractAddress, u256>,
    total_collateral: u256,
    
    // Configuration
    monthly_contribution: u256,
    total_participants: u256,
    payment_token: ContractAddress,
    
    // Constants
    collateral_factor: u256, // 60% = 600 (basis points)
    basis_points: u256, // 1000
    
    // Components
    #[substorage(v0)]
    ownable: OwnableComponent::Storage,
    #[substorage(v0)]
    reentrancy_guard: ReentrancyGuardComponent::Storage,
}
```

**Key Functions:**
- `calculate_debt(position)` → u256 - Calculate debt for position
- `calculate_required_collateral(position)` → u256 - Apply 60% formula
- `calculate_recovery_assets(position, past_payments)` → u256 - Total recoverable
- `get_coverage_ratio(position, past_payments)` → u256 - Coverage percentage
- `deposit_collateral(amount)` - Lock collateral
- `withdraw_collateral(amount)` - Unlock collateral (if eligible)
- `seize_collateral(member)` → u256 - Seize on default
- `get_collateral_balance(member)` → u256

**Critical Formulas:**
```cairo
// Debt calculation
fn calculate_debt(ref self: ContractState, position: u256) -> u256 {
    let monthly = self.monthly_contribution.read();
    let total = self.total_participants.read();
    let payout = monthly * total;
    let paid = position * monthly;
    payout - paid
}

// Collateral calculation (60% factor)
fn calculate_required_collateral(ref self: ContractState, position: u256) -> u256 {
    let debt = self.calculate_debt(position);
    let factor = self.collateral_factor.read(); // 600
    let basis = self.basis_points.read(); // 1000
    (debt * factor) / basis
}

// Recovery assets calculation
fn calculate_recovery_assets(
    ref self: ContractState,
    position: u256,
    past_payments: u256
) -> u256 {
    let collateral = self.calculate_required_collateral(position);
    let guarantor_pos = self._calculate_guarantor_position(position);
    let guarantor_collateral = self.calculate_required_collateral(guarantor_pos);
    
    collateral + past_payments + guarantor_collateral + past_payments
}

// Coverage ratio (should be > 100%)
fn get_coverage_ratio(
    ref self: ContractState,
    position: u256,
    past_payments: u256
) -> u256 {
    let debt = self.calculate_debt(position);
    let recovery = self.calculate_recovery_assets(position, past_payments);
    (recovery * 100) / debt
}
```

**Design Rationale:**
- 60% collateral factor provides 108.9%+ coverage
- Position-based calculation ensures fairness
- Mathematical proof ensures security
- Basis points (1000) allow precise percentage calculations

### 3.5 AjoPayments

**Purpose**: Payment processing and payout distribution

**Storage:**
```cairo
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
    
    // Components
    #[substorage(v0)]
    ownable: OwnableComponent::Storage,
    #[substorage(v0)]
    reentrancy_guard: ReentrancyGuardComponent::Storage,
}
```

**Key Functions:**
- `record_payment(member, cycle, amount)` - Process monthly payment
- `has_paid(member, cycle)` → bool - Check payment status
- `all_members_paid(cycle)` → bool - Check if cycle complete
- `distribute_payout(recipient, amount)` - Transfer payout
- `advance_cycle()` - Move to next cycle
- `get_next_recipient()` → ContractAddress - Get next payout recipient
- `seize_past_payments(member)` → u256 - Seize on default
- `get_payment_history(member)` → Span<u256>

**Payment Flow:**
```cairo
fn record_payment(
    ref self: ContractState,
    member: ContractAddress,
    cycle: u256,
    amount: u256
) {
    // Verify amount
    assert(amount == self.monthly_contribution.read(), 'Invalid amount');
    
    // Verify not already paid
    assert(!self.payments.read((cycle, member)), 'Already paid');
    
    // Transfer tokens
    let token = IERC20Dispatcher { 
        contract_address: self.payment_token.read() 
    };
    token.transfer_from(member, get_contract_address(), amount);
    
    // Record payment
    self.payments.write((cycle, member), true);
    let count = self.cycle_payments_count.read(cycle);
    self.cycle_payments_count.write(cycle, count + 1);
    
    // Update past payments
    let past = self.member_past_payments.read(member);
    self.member_past_payments.write(member, past + amount);
    
    // Emit event
    self.emit(PaymentRecorded { cycle, member, amount });
}
```

**Design Rationale:**
- Cycle-based tracking ensures clear payment periods
- Past payments tracking enables default recovery
- Automatic cycle advancement when all paid

### 3.6 AjoGovernance

**Purpose**: Decentralized governance and parameter updates

**Storage:**
```cairo
#[storage]
struct Storage {
    // Proposals
    proposal_count: u256,
    proposals: Map<u256, Proposal>,
    votes: Map<(u256, ContractAddress), Vote>, // (proposal_id, voter)
    
    // Configuration
    voting_period: u64,
    quorum_percentage: u256,
    
    // Components
    #[substorage(v0)]
    ownable: OwnableComponent::Storage,
}
```

**Key Functions:**
- `create_proposal(description, proposal_type, params)` → u256
- `cast_vote(proposal_id, support)` - Vote on proposal
- `execute_proposal(proposal_id)` - Execute passed proposal
- `get_proposal(proposal_id)` → Proposal
- `get_vote(proposal_id, voter)` → Vote
- `has_quorum(proposal_id)` → bool
- `is_passed(proposal_id)` → bool

**Proposal Types:**
```cairo
#[derive(Drop, Serde, Copy, starknet::Store)]
pub enum ProposalType {
    ChangeMonthlyPayment,
    ChangeDuration,
    RemoveMember,
    EmergencyPause,
    CompleteCurrentSeason,
    RestartNewSeason,
    AddNewMember,
    UpdateSeasonParameters,
}
```

**Design Rationale:**
- On-chain voting replaces HCS off-chain tallying
- Reputation-weighted voting prevents Sybil attacks
- Quorum ensures sufficient participation

### 3.7 AjoSchedule

**Purpose**: Time-based automation and keeper integration

**Storage:**
```cairo
#[storage]
struct Storage {
    // Scheduled tasks
    schedule_count: u256,
    schedules: Map<u256, ScheduledTask>,
    
    // Components
    #[substorage(v0)]
    ownable: OwnableComponent::Storage,
}
```

**Key Functions:**
- `schedule_task(execution_time, task_type, params)` → u256
- `execute_task(schedule_id)` - Execute scheduled task
- `cancel_task(schedule_id)` - Cancel scheduled task
- `get_pending_tasks()` → Span<u256>
- `is_executable(schedule_id)` → bool

**Design Rationale:**
- Keeper pattern replaces HSS native scheduling
- No 62-day limit (HSS limitation)
- Anyone can execute after time (incentivized by keeper bots)

## 4. Migration Strategies

### 4.1 HTS → ERC20

**Hedera Token Service (HTS):**
```solidity
HederaTokenService.approve(token, spender, amount);
HederaTokenService.transferFrom(token, from, to, amount);
```

**StarkNet ERC20:**
```cairo
let token = IERC20Dispatcher { contract_address: token_address };
token.approve(spender, amount);
token.transfer_from(from, to, amount);
```

**Migration Steps:**
1. Replace HTS calls with ERC20 interface
2. Use OpenZeppelin Cairo ERC20 contracts
3. Handle approvals before transfers

### 4.2 HCS → StarkNet Events

**Hedera Consensus Service (HCS):**
- Off-chain vote submission to HCS topic
- Batch tallying from HCS messages
- Mirror Node queries

**StarkNet Events:**
```cairo
#[derive(Drop, starknet::Event)]
pub struct VoteCast {
    #[key]
    pub proposal_id: u256,
    #[key]
    pub voter: ContractAddress,
    pub support: u8,
    pub voting_power: u256,
}

fn cast_vote(ref self: ContractState, proposal_id: u256, support: u8) {
    // Record vote immediately
    self.votes.write((proposal_id, get_caller_address()), Vote { support, ... });
    
    // Emit event
    self.emit(VoteCast { proposal_id, voter: get_caller_address(), support, ... });
}
```

**Migration Steps:**
1. Replace HCS submission with on-chain vote recording
2. Emit events for indexing
3. Immediate tallying instead of batch processing

### 4.3 HSS → Keeper Pattern

**Hedera Schedule Service (HSS):**
- Native scheduled transactions
- 62-day limit
- Automatic execution

**StarkNet Keeper Pattern:**
```cairo
fn execute_scheduled_payment(ref self: ContractState, schedule_id: u256) {
    let schedule = self.schedules.read(schedule_id);
    assert(!schedule.is_executed, 'Already executed');
    assert(get_block_timestamp() >= schedule.execution_time, 'Too early');
    
    // Execute
    self._process_payment(...);
    
    // Mark executed
    let mut updated = schedule;
    updated.is_executed = true;
    self.schedules.write(schedule_id, updated);
}
```

**Migration Steps:**
1. Store scheduled operations on-chain
2. Implement public execution function
3. Deploy keeper bot to monitor and execute
4. Consider Pragma oracles for automation

## 5. Security Design

### 5.1 Access Control

**Ownership Hierarchy:**
```
Factory Owner (Admin)
  ├─→ Can update class hashes
  ├─→ Can pause factory
  └─→ Cannot access individual Ajos

Ajo Creator (Owner)
  ├─→ Can pause Ajo
  ├─→ Can execute governance proposals
  └─→ Cannot steal funds

Members
  ├─→ Can vote on proposals
  ├─→ Can process own payments
  └─→ Cannot access other members' collateral
```

### 5.2 Reentrancy Protection

**Protected Functions:**
- `join_ajo()` - Collateral deposit
- `process_payment()` - Payment transfer
- `distribute_payout()` - Payout transfer
- `handle_default()` - Collateral seizure
- `deposit_collateral()` - Collateral deposit
- `withdraw_collateral()` - Collateral withdrawal

**Implementation:**
```cairo
fn process_payment(ref self: ContractState) {
    self.reentrancy_guard.start();
    
    // Protected logic
    self._internal_process_payment();
    
    self.reentrancy_guard.end();
}
```

### 5.3 Pausability

**Pausable Functions:**
- All state-changing functions in AjoCore
- All payment and collateral operations
- Factory deployment functions

**Emergency Scenarios:**
- Security vulnerability discovered
- Oracle failure
- Governance attack
- Smart contract bug

## 6. Gas Optimization

### 6.1 Storage Patterns

**Efficient Storage:**
```cairo
// Good: Packed struct
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct Member {
    pub position: u256,
    pub joined_cycle: u256,
    pub is_active: bool,
    pub has_received_payout: bool,
}

// Good: Map for sparse data
member_collateral: Map<ContractAddress, u256>

// Good: Vec for dense data
member_list: Vec<ContractAddress>
```

### 6.2 Batch Operations

**Batch Payment Verification:**
```cairo
fn verify_all_paid(ref self: ContractState, cycle: u256) -> bool {
    let count = self.cycle_payments_count.read(cycle);
    count == self.total_participants.read()
}
```

### 6.3 Minimal Proxy Pattern

**Class Hash Deployment:**
- Deploy once, instantiate many times
- Significantly cheaper than deploying full contracts
- Native to StarkNet architecture

## 7. Testing Strategy

### 7.1 Unit Tests

**Per Contract:**
- Test each function independently
- Test edge cases (zero values, max values)
- Test error conditions
- Test access control

**Example:**
```cairo
#[test]
fn test_calculate_collateral_position_1() {
    let collateral = calculate_required_collateral(1, 50, 10);
    assert(collateral == 270, 'Position 1 collateral wrong');
}
```

### 7.2 Integration Tests

**Cross-Contract:**
- Test full member joining flow
- Test payment and payout cycle
- Test default handling workflow
- Test governance proposal execution

### 7.3 Property-Based Tests

**Mathematical Properties:**
- Coverage ratio always > 100%
- Collateral + past payments >= debt
- Guarantor network is circular
- Total collateral matches sum of individual collateral

### 7.4 Formula Verification

**60% Collateral Formula:**
```cairo
#[test]
fn test_coverage_ratio_all_positions() {
    for position in 1..=10 {
        let coverage = get_coverage_ratio(position, position * 50);
        assert(coverage >= 108, 'Coverage too low');
    }
}
```

## 8. Deployment Strategy

### 8.1 Deployment Order

1. **Deploy Master Contracts:**
   - AjoCore
   - AjoMembers
   - AjoCollateral
   - AjoPayments
   - AjoGovernance
   - AjoSchedule

2. **Deploy Factory:**
   - Initialize with class hashes
   - Set owner
   - Verify all class hashes

3. **Create Test Ajo:**
   - Run through all 5 phases
   - Verify initialization
   - Test basic operations

### 8.2 Testnet Deployment

**StarkNet Testnet:**
- Deploy to Sepolia testnet
- Use test USDC tokens
- Test with 3-5 members
- Verify all formulas

### 8.3 Mainnet Deployment

**Prerequisites:**
- Security audit complete
- All tests passing
- Testnet validation complete
- Documentation complete

## 9. Bitcoin Integration Design

### 9.1 OP_CAT Covenant Pattern

**Collateral Lock Script:**
```
OP_CAT covenant that locks BTC collateral
Unlockable only with:
1. StarkNet proof of completion
2. StarkNet proof of default (for seizure)
```

### 9.2 Bridge Architecture

**Components:**
- Bitcoin light client on StarkNet
- State proof verification
- USDC/BTC atomic swap
- Collateral lock/unlock mechanism

### 9.3 Integration Points

**AjoCollateral Extension:**
```cairo
fn lock_btc_collateral(
    ref self: ContractState,
    amount: u256,
    covenant_script: Span<felt252>
) {
    // Verify covenant script
    // Submit to Bitcoin bridge
    // Track locked BTC
}
```

## 10. Correctness Properties

### 10.1 Safety Properties

**Property 1: Collateral Sufficiency**
```
∀ position ∈ [1, 10]:
  recovery_assets(position) >= debt(position)
```

**Property 2: Coverage Ratio**
```
∀ position ∈ [1, 10]:
  coverage_ratio(position) >= 108%
```

**Property 3: Guarantor Circularity**
```
∀ member:
  guarantor(guarantor(member)) ≠ member
  guarantor_network forms a cycle
```

**Property 4: Payment Completeness**
```
∀ cycle:
  payout_distributed(cycle) ⟹ all_members_paid(cycle)
```

### 10.2 Liveness Properties

**Property 5: Cycle Progression**
```
all_members_paid(cycle) ⟹ ◇ cycle_advanced
```

**Property 6: Payout Distribution**
```
cycle_advanced ⟹ ◇ payout_distributed
```

### 10.3 Invariants

**Invariant 1: Total Collateral**
```
sum(member_collateral) == total_collateral
```

**Invariant 2: Member Count**
```
member_count <= total_participants
```

**Invariant 3: Payout Position**
```
1 <= next_payout_position <= total_participants
```

## 11. Open Questions

### 11.1 Technical Questions

1. **Bitcoin Bridge Timeline**: When will OP_CAT be available?
2. **Keeper Incentives**: How to incentivize keeper bots?
3. **Oracle Integration**: Use Pragma for price feeds?
4. **Cross-Chain Messaging**: Use LayerZero or native bridges?

### 11.2 Design Decisions

1. **Collateral Token**: Support only USDC or multiple tokens?
2. **Governance Threshold**: 51% quorum or higher?
3. **Voting Period**: How long for proposals?
4. **Emergency Pause**: Who can trigger?

## 12. Future Enhancements

### 12.1 Phase 2 Features

- Multi-season support
- Dynamic participant count
- Flexible payment schedules
- Reputation-based collateral reduction

### 12.2 Phase 3 Features

- Cross-chain Ajo groups
- NFT membership tokens
- Automated keeper network
- Mobile app integration

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Design Complete  
**Next Step**: Implementation Tasks
