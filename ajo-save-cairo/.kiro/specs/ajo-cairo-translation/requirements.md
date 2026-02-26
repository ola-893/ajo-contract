# AJO.SAVE Solidity to Cairo Translation - Requirements

## 1. Project Overview

### 1.1 Purpose
Translate the AJO.SAVE ROSCA (Rotating Savings and Credit Association) protocol from Solidity (Hedera) to Cairo (StarkNet + Bitcoin integration).

### 1.2 Source Project Analysis
- **Original Platform**: Hedera Hashgraph
- **Original Language**: Solidity 0.8.24
- **Architecture**: Factory pattern with minimal proxies
- **Key Innovation**: 60% collateral model (vs 100%+ traditional)
- **Contracts**: 6 main contracts + factory

### 1.3 Target Platform
- **Platform**: StarkNet L2
- **Language**: Cairo 2.6.0+
- **Integration**: Bitcoin settlement layer
- **Architecture**: Class hash deployment system

## 2. Core Requirements

### 2.1 Contract Architecture Translation

#### 2.1.1 Factory Pattern
**Acceptance Criteria**:
- [ ] AjoFactory contract creates new Ajo instances
- [ ] Uses StarkNet class hash system (replaces minimal proxies)
- [ ] Supports 5-phase initialization process
- [ ] Tracks all created Ajo instances
- [ ] Manages master implementation addresses

**Solidity Reference**:
```solidity
// contracts/factory/AjoFactory.sol
- createAjo() - Phase 1: Deploy proxies
- initializeAjoPhase2() - Members + Governance
- initializeAjoPhase3() - Collateral + Payments  
- initializeAjoPhase4() - Core + Token config
- initializeAjoPhase5() - Schedule (optional)
```

**Cairo Implementation**:
- Use `deploy_syscall()` with class hashes
- Store class hashes for each contract type
- Implement phased initialization to prevent circular dependencies

#### 2.1.2 Core Orchestration (AjoCore)
**Acceptance Criteria**:
- [ ] Coordinates all other contracts
- [ ] Manages member joining process
- [ ] Processes monthly payments
- [ ] Distributes payouts
- [ ] Handles defaults
- [ ] Manages cycle advancement

**Key Functions**:
- `joinAjo()` - Member onboarding with collateral
- `processPayment()` - Monthly contribution
- `distributePayout()` - Payout to next recipient
- `handleDefault()` - Default processing
- `exitAjo()` - Member exit with penalty

**State Variables**:
- Fixed 10 participants
- Cycle duration (30 days default)
- Queue positions
- Guarantor assignments

#### 2.1.3 Member Management (AjoMembers)
**Acceptance Criteria**:
- [ ] Track member information (position, collateral, status)
- [ ] Manage member queue (1-10 positions)
- [ ] Calculate guarantor relationships
- [ ] Track payment history
- [ ] Manage reputation scores

**Key Data Structures**:
```solidity
struct Member {
    uint256 queueNumber;
    uint256 joinedCycle;
    uint256 totalPaid;
    uint256 requiredCollateral;
    uint256 lockedCollateral;
    uint256 lastPaymentCycle;
    uint256 defaultCount;
    bool hasReceivedPayout;
    bool isActive;
    address guarantor;
    PaymentToken preferredToken;
    uint256 reputationScore;
    uint256[] pastPayments;
    uint256 guaranteePosition;
}
```

**Cairo Translation**:
- Use `Map<ContractAddress, Member>` for member storage
- Use `Vec<ContractAddress>` for active members list
- Implement guarantor offset calculation

#### 2.1.4 Collateral Management (AjoCollateral)
**Acceptance Criteria**:
- [ ] Implement 60% collateral formula
- [ ] Calculate position-based collateral requirements
- [ ] Lock/unlock collateral
- [ ] Execute seizure on default
- [ ] Track collateral balances per token

**Critical Formula** (MUST BE EXACT):
```
Debt(n) = Payout - (n × monthlyContribution)
Collateral(n) = Debt(n) × 0.60
Guarantor Position = ((position - 1 + (total/2)) % total) + 1
```

**Example** (10 members, 50 USDC/month):
- Position 1: Debt = $450 → Collateral = $270 (60%)
- Position 6: Debt = $200 → Collateral = $120 (60%)
- Position 10: Debt = $0 → Collateral = $0

**Seizure Logic**:
- Seize defaulter's collateral
- Seize guarantor's collateral
- Seize both past payments
- Transfer to payments contract

#### 2.1.5 Payment Processing (AjoPayments)
**Acceptance Criteria**:
- [ ] Process monthly payments
- [ ] Track payment status per cycle
- [ ] Calculate and distribute payouts
- [ ] Manage cycle advancement
- [ ] Handle penalties for late payments
- [ ] Detect defaults

**Key State**:
- Current cycle number
- Next payout position
- Payment tracking per member per cycle
- Cycle start time and duration
- Penalty rates

**Payment Flow**:
1. Member calls `processPayment()`
2. Transfer tokens from member
3. Mark payment in current cycle
4. Update member's last payment cycle
5. Emit payment event

**Payout Flow**:
1. Verify all members paid
2. Calculate payout amount
3. Transfer to recipient
4. Mark recipient as received
5. Advance cycle
6. Increment payout position

#### 2.1.6 Governance (AjoGovernance)
**Acceptance Criteria**:
- [ ] Create proposals
- [ ] Vote on proposals (on-chain)
- [ ] Execute passed proposals
- [ ] Manage season completion
- [ ] Handle member participation
- [ ] Support new member onboarding

**Proposal Types**:
- ChangeMonthlyPayment
- ChangeDuration
- RemoveMember
- EmergencyPause
- CompleteCurrentSeason
- RestartNewSeason
- AddNewMember
- UpdateSeasonParameters

**Voting System**:
- Voting period (default 1 minute for testing)
- Quorum percentage (51%)
- Voting power based on reputation
- On-chain vote recording (replaces HCS)

#### 2.1.7 Scheduling (AjoSchedule)
**Acceptance Criteria**:
- [ ] Schedule automated tasks
- [ ] Time-based execution checks
- [ ] Keeper bot integration
- [ ] Automated cycle payments
- [ ] Payout scheduling

**Replaces**: Hedera Schedule Service (HSS)
**Implementation**: Keeper pattern with time checks

### 2.2 Token Integration

#### 2.2.1 ERC20 Support
**Acceptance Criteria**:
- [ ] Support USDC token
- [ ] Support WHBAR token
- [ ] Token approval handling
- [ ] Token transfer logic
- [ ] Balance tracking

**Replaces**: Hedera Token Service (HTS)
**Implementation**: OpenZeppelin Cairo ERC20 interface

#### 2.2.2 Multi-Token Configuration
**Acceptance Criteria**:
- [ ] Configure monthly payment per token
- [ ] Enable/disable tokens
- [ ] Track active payment token
- [ ] Support token switching

### 2.3 Security Requirements

#### 2.3.1 Access Control
**Acceptance Criteria**:
- [ ] Ownable component for admin functions
- [ ] Only AjoCore can call child contracts
- [ ] Member-only functions
- [ ] Proposal creator permissions

#### 2.3.2 Reentrancy Protection
**Acceptance Criteria**:
- [ ] ReentrancyGuard on payment functions
- [ ] ReentrancyGuard on payout distribution
- [ ] ReentrancyGuard on collateral operations

#### 2.3.3 Pausability
**Acceptance Criteria**:
- [ ] Emergency pause mechanism
- [ ] Pausable component integration
- [ ] Admin-only pause/unpause

### 2.4 Economic Model Preservation

#### 2.4.1 60% Collateral Formula
**Acceptance Criteria**:
- [ ] Exact formula implementation
- [ ] Position-based calculation
- [ ] Guarantor offset calculation
- [ ] Coverage ratio verification (108.9%+)

**Mathematical Proof**:
```
For 10 members, $50/month:
Position 1: $270 collateral + $50 past payment + 
            Guarantor $120 + $50 = $490 recoverable
            vs $450 debt = 108.9% coverage
```

#### 2.4.2 Guarantor Network
**Acceptance Criteria**:
- [ ] Circular offset calculation
- [ ] Bidirectional relationships
- [ ] Guarantor assignment on join
- [ ] Guarantor seizure on default

**Formula**:
```
Guarantor Position = ((position - 1 + (total/2)) % total) + 1
```

### 2.5 Hedera to StarkNet Migration

#### 2.5.1 HTS → ERC20
**Mapping**:
- `HederaTokenService.approve()` → `IERC20.approve()`
- `HederaTokenService.transferFrom()` → `IERC20.transfer_from()`
- Token association → Not needed (ERC20 standard)

#### 2.5.2 HCS → StarkNet Events
**Mapping**:
- HCS topic submission → On-chain vote recording
- Off-chain vote tallying → Immediate on-chain tallying
- Mirror Node queries → Event indexing

#### 2.5.3 HSS → Keeper Pattern
**Mapping**:
- Scheduled transactions → Time-based execution checks
- Automatic execution → Keeper bot monitoring
- 62-day limit → No limit (keeper-based)

### 2.6 Bitcoin Integration (Future)

#### 2.6.1 Collateral Settlement
**Acceptance Criteria**:
- [ ] Bitcoin bridge interface
- [ ] OP_CAT covenant design
- [ ] Collateral lock on Bitcoin
- [ ] Atomic swap support

#### 2.6.2 Bridge Architecture
**Acceptance Criteria**:
- [ ] USDC/BTC bridge interface
- [ ] State proof verification
- [ ] Cross-chain messaging

## 3. Non-Functional Requirements

### 3.1 Performance
- Gas-optimized storage patterns
- Batch operations where possible
- Minimal on-chain data storage

### 3.2 Maintainability
- Clear code documentation
- Modular architecture
- Comprehensive tests

### 3.3 Compatibility
- Cairo 2.6.0+ syntax
- StarkNet Foundry testing
- OpenZeppelin Cairo contracts

## 4. Out of Scope

### 4.1 Not Included in Initial Translation
- Frontend translation (React → StarkNet.js)
- Bitcoin bridge implementation (design only)
- Mainnet deployment
- Security audit

### 4.2 Deferred Features
- Advanced governance features
- Multi-season management
- Cross-chain bridges
- Mobile app

## 5. Success Criteria

### 5.1 Functional Completeness
- [ ] All 6 contracts translated
- [ ] All core functions working
- [ ] 60% formula verified
- [ ] Payment cycles functional
- [ ] Governance operational

### 5.2 Test Coverage
- [ ] Unit tests for each contract
- [ ] Integration tests
- [ ] Formula verification tests
- [ ] Edge case coverage

### 5.3 Documentation
- [ ] Code comments
- [ ] Function documentation
- [ ] Architecture diagrams
- [ ] Migration guide

## 6. Dependencies

### 6.1 External Dependencies
- Scarb 2.6.0+
- StarkNet Foundry
- OpenZeppelin Cairo Contracts
- Cairo 2.6.0+

### 6.2 Internal Dependencies
- Interfaces must be defined first
- Components before contracts
- Factory before instances

## 7. Constraints

### 7.1 Technical Constraints
- Cairo language limitations
- StarkNet gas costs
- Storage optimization needs

### 7.2 Business Constraints
- Must preserve 60% collateral model
- Must maintain security guarantees
- Must support 10-member groups

## 8. Assumptions

### 8.1 Platform Assumptions
- StarkNet testnet availability
- ERC20 tokens available
- Keeper bots can be deployed

### 8.2 User Assumptions
- Users have StarkNet wallets
- Users understand ROSCA model
- Users can approve tokens

## 9. Risks

### 9.1 Technical Risks
- Cairo language differences
- Storage pattern changes
- Gas cost increases

### 9.2 Mitigation Strategies
- Thorough testing
- Gas optimization
- Fallback mechanisms

## 10. Timeline Estimate

### 10.1 Phase Breakdown
- **Phase 1**: Interfaces & Components (Complete)
- **Phase 2**: Core Contracts (3-4 weeks)
- **Phase 3**: Testing (1-2 weeks)
- **Phase 4**: Bitcoin Integration Design (2-3 weeks)
- **Phase 5**: Deployment (1 week)

**Total**: 8-10 weeks

## 11. References

### 11.1 Source Code
- Original Solidity: `contracts/` directory
- Cairo Translation: `ajo-save-cairo/src/` directory

### 11.2 Documentation
- Original README: `README.md`
- Migration Guide: `ajo-save-cairo/MIGRATION_GUIDE.md`
- Project Status: `ajo-save-cairo/PROJECT_STATUS.md`

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Requirements Complete  
**Next Step**: Design Document
