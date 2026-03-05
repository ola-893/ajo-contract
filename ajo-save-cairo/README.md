# 🏦 AJO.SAVE - Cairo Implementation for StarkNet + Bitcoin

Bringing traditional African savings circles (Ajo/Esusu) to Bitcoin with StarkNet's STARK-powered scalability

**Track**: ₿ Bitcoin - BTC-Native DeFi on StarkNet

---

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Quick Start](#-quick-start)
- [Project Status](#-project-status)
- [Architecture](#-architecture)
- [Key Innovation: 60% Collateral Model](#-key-innovation-60-collateral-model)
- [Development Guide](#-development-guide)
- [Testing](#-testing)
- [Roadmap](#-roadmap)
- [Migration from Hedera](#-migration-from-hedera)
- [Resources](#-resources)

---

## 🎯 Project Overview

AJO.SAVE is a decentralized ROSCA (Rotating Savings and Credit Association) protocol originally built on Hedera, now translated to Cairo for StarkNet + Bitcoin integration.

### Why Bitcoin Category?

- **Bitcoin Settlement Layer**: Final asset ownership and collateral locks secured on Bitcoin
- **StarkNet Computation Layer**: Complex ROSCA logic with STARK proofs for computational integrity
- **OP_CAT Integration**: Covenant-based collateral enforcement on Bitcoin
- **Bridge Architecture**: Seamless USDC/BTC movement between layers
- **Atomic Swaps**: Trustless payout distributions

### Key Innovation: 60% Collateral Model

Traditional ROSCAs require 100%+ collateral. AJO.SAVE uses mathematical proof to achieve 108.9% security coverage with only **60% collateral requirement**, making savings circles accessible to low-income users.

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Scarb (Cairo package manager)
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh

# Verify installation
scarb --version  # Should show: scarb 2.6.0 or higher
```

### Build & Test

```bash
# Clone and navigate to project
cd ajo-save-cairo

# Build contracts
scarb build

# Run tests
snforge test

# Run specific test
snforge test test_collateral_formula
```

---

## 📊 Project Status

**Current Status**: BTC-track prototype implemented and deployable on Starknet Sepolia.

### ✅ Implemented

- ✅ Modular ROSCA core (`Factory`, `Core`, `Members`, `Collateral`, `Payments`, `Governance`, `Schedule`)
- ✅ Access control, pause, and reentrancy protections across critical modules
- ✅ BTC/cross-chain adapters:
  - `BridgeAdapter` (deposit/withdraw lifecycle + replay protection)
  - `SwapRouter` (optional payout conversion path)
  - `BTCCollateralAdapter` (OP_CAT-compatible commitment state machine)
- ✅ Collateral mode abstraction:
  - `L2Escrow`
  - `BTCCommitment`
- ✅ Deployment/verification scripts plus full BTC demo flow:
  - `deploy:sepolia`
  - `verify:deployment`
  - `smoke:deployed`
  - `btc:full-flow`

### ⚠️ Known Gaps

- ⚠️ Test suite modernization is still required before production hardening (`snforge test` currently has legacy breakage).
- ⚠️ OP_CAT path is modeled as an adapter abstraction for testnet, not a production Bitcoin covenant execution engine.
- ⚠️ Mainnet risk controls, monitoring, and economic parameter audits are pending.

---

## 🏗️ Architecture

### Project Structure

```
ajo-save-cairo/
├── src/
│   ├── interfaces/          # Contract interfaces (7/7 complete)
│   │   ├── types.cairo      # Core data structures
│   │   ├── i_ajo_factory.cairo
│   │   ├── i_ajo_core.cairo
│   │   ├── i_ajo_members.cairo
│   │   ├── i_ajo_collateral.cairo
│   │   ├── i_ajo_payments.cairo
│   │   ├── i_ajo_governance.cairo
│   │   └── i_ajo_schedule.cairo
│   │
│   ├── components/          # Reusable components (3/3 complete)
│   │   ├── ownable.cairo
│   │   ├── pausable.cairo
│   │   └── reentrancy_guard.cairo
│   │
│   ├── factory/             # ✅ COMPLETE
│   │   └── ajo_factory.cairo
│   │
│   ├── core/                # 📋 TODO
│   ├── members/             # 📋 TODO
│   ├── collateral/          # 📋 TODO (HIGH PRIORITY)
│   ├── payments/            # 📋 TODO
│   ├── governance/          # 📋 TODO
│   └── schedule/            # � TODO
│
└── tests/                   # Comprehensive test suite
    ├── test_*.cairo         # Unit tests
    ├── integration/         # Integration tests
    └── utils/               # Test utilities
```

### Contract Hierarchy

```
AjoFactory (Entry Point)
    ↓ create_ajo_and_initialize (creator-signed atomic flow)
    ├── AjoCore (Orchestrator)
    │   ├── coordinates → AjoMembers
    │   ├── coordinates → AjoCollateral
    │   ├── coordinates → AjoPayments
    │   ├── coordinates → AjoGovernance
    │   └── coordinates → AjoSchedule
```

Legacy phased functions (`deploy_members`, `deploy_collateral_and_payments`, `deploy_governance_and_schedule`, `deploy_core`) remain available for recovery/debug and are creator-gated per Ajo.

### From Hedera to StarkNet + Bitcoin

| Hedera Component | StarkNet + Bitcoin Equivalent |
|-----------------|-------------------------------|
| HTS (Token Service) | ERC20 on StarkNet + Bitcoin bridges |
| HCS (Consensus Service) | StarkNet Sequencer + on-chain events |
| HSS (Schedule Service) | Time-based execution + keeper bots |
| Minimal Proxies | Class Hash System (Cairo's proxy pattern) |
| Solidity Contracts | Cairo Smart Contracts |

---

## 💡 Key Innovation: 60% Collateral Model

### The Problem
Traditional ROSCAs require 100%+ collateral, making them inaccessible to low-income users.

### The Solution
Mathematical proof shows 60% collateral provides 108.9%+ security coverage.

### Example (10 members, $50/month)

| Position | Debt | Collateral (60%) | Recovery Assets | Coverage |
|----------|------|------------------|-----------------|----------|
| 1 | $450 | $270 | $490 | 109% |
| 2 | $400 | $240 | $440 | 110% |
| 5 | $250 | $150 | $290 | 116% |
| 10 | $0 | $0 | $50 | ∞ |

**Total Collateral**: $1,350 (27% of contributions)  
**Traditional Model**: $5,000+ (100%+ of contributions)  
**Savings**: 73% reduction

### Formula

```cairo
Payout = monthly_contribution × total_participants
Debt(n) = Payout - (n × monthly_contribution)
Collateral(n) = Debt(n) × 0.60
Recovery_Assets(n) = Collateral(n) + (n × monthly_contribution)
Coverage(n) = Recovery_Assets(n) / Debt(n)
```

### Guarantor Network

Each member is backed by another member at offset = participants/2:

```cairo
fn calculate_guarantor_position(position: u256, total: u256) -> u256 {
    ((position - 1 + (total / 2)) % total) + 1
}
```

---

## 🛠️ Development Guide

### Cairo Version Requirements
- Cairo: 2.6.0+
- Scarb: 2.6.0+
- StarkNet Foundry: 0.56.0+

### Common Commands

```bash
# Build contracts
scarb build

# Format code
scarb fmt

# Clean build artifacts
scarb clean

# Run all tests
snforge test

# Run specific test file
snforge test --path tests/test_factory.cairo

# Run with verbose output
snforge test -v
```

### Key Technical Decisions

#### 1. Component System (vs Solidity Inheritance)
```cairo
component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
component!(path: PausableComponent, storage: pausable, event: PausableEvent);
```

Benefits: Better modularity, explicit storage subsystems, cleaner event handling

#### 2. Class Hash Deployment (vs Minimal Proxies)
```cairo
let (address, _) = deploy_syscall(
    class_hash,
    salt,
    calldata.span(),
    false
).unwrap_syscall();
```

Benefits: Native to StarkNet, more gas-efficient, simpler than proxy pattern

#### 3. ERC20 Integration (vs Hedera HTS)
```cairo
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
```

Benefits: Standard interface, wide compatibility, easy bridge integration

---

## 🧪 Testing

### Test Framework: StarkNet Foundry

**Status**: ✅ Fully configured and operational

### Test Structure

```
tests/
├── test_factory.cairo          # Factory contract tests
├── test_collateral.cairo       # Collateral formula tests
├── test_members.cairo          # Member management tests
├── test_payments.cairo         # Payment processing tests
├── test_core.cairo             # Core orchestration tests
├── test_governance.cairo       # Governance tests
├── test_schedule.cairo         # Scheduling tests
├── test_access_control.cairo   # Security tests (30+ tests)
├── integration/
│   ├── test_factory_deployment.cairo
│   ├── test_full_season.cairo  # Complete 10-cycle test
│   └── test_default_handling.cairo
└── utils/
    ├── mock_erc20.cairo        # Mock token for testing
    ├── test_helpers.cairo      # Helper functions
    └── constants.cairo         # Test constants
```

### Test Coverage

#### ✅ Completed Tests

1. **Access Control Tests** (30+ tests)
   - Factory owner-only functions
   - Core admin functions
   - Member-only functions
   - AjoCore-only functions in child contracts

2. **Reentrancy Protection Tests** (8 tests)
   - Direct reentrancy attacks
   - Cross-function reentrancy
   - Critical state-changing functions

3. **Integration Tests**
   - Full season completion (10 cycles)
   - Factory atomic initialization workflow
   - Default handling workflow

#### 📋 Pending Tests

- Formula verification (property-based tests)
- Edge case tests
- Governance workflow tests
- Bitcoin integration tests

### Running Tests

```bash
# Run all tests
snforge test

# Run access control tests
snforge test test_access_control

# Run reentrancy tests
snforge test test_reentrancy

# Run integration tests
snforge test integration

# Run with gas reporting
snforge test --gas-report
```

---

## 🗺️ Roadmap

### Phase 1: Foundation ✅ COMPLETE (25%)
- [x] Type system and interfaces
- [x] Reusable components
- [x] AjoFactory contract
- [x] Documentation

### Phase 2: Core Contracts 🔄 IN PROGRESS (0% → 50%)

**Week 1: Critical Business Logic**
- [ ] AjoCollateral (3-4 days) - 60% formula implementation
- [ ] AjoMembers (2-3 days) - Member queue and guarantor network

**Week 2: Payment Processing**
- [ ] AjoPayments (3-4 days) - Payment tracking and distribution
- [ ] AjoCore (2-3 days) - Main orchestration

**Week 3: Governance & Scheduling**
- [ ] AjoGovernance (2-3 days) - On-chain voting
- [ ] AjoSchedule (2 days) - Time-based automation

### Phase 3: Testing & Validation 📋 TODO (50% → 75%)
- [ ] Unit tests for all contracts
- [ ] Integration tests
- [ ] Property-based tests
- [ ] Formula verification

### Phase 4: Bitcoin Integration 📋 TODO (75% → 90%)
- [ ] Research OP_CAT covenant patterns
- [ ] Design Bitcoin collateral lock mechanism
- [ ] Implement USDC/BTC bridge interface
- [ ] Bitcoin testnet integration

### Phase 5: Deployment & Frontend 📋 TODO (90% → 100%)
- [ ] StarkNet testnet deployment
- [ ] Translate React frontend to StarkNet.js
- [ ] Add Bitcoin wallet integration (Xverse, Leather)
- [ ] Dashboard for collateral monitoring

### Phase 6: Launch & Maintenance 📋 TODO (100%)
- [ ] Security audit
- [ ] Bug bounty program
- [ ] Mainnet deployment
- [ ] Community building

**Target Timeline**: 8-10 weeks to mainnet launch

---

## 🔄 Migration from Hedera

### Key Differences

#### Storage Patterns
**Solidity**: Direct mappings
```solidity
mapping(address => Member) public members;
address[] public memberList;
```

**Cairo**: Typed storage with Map and Vec
```cairo
#[storage]
struct Storage {
    members: Map<ContractAddress, Member>,
    member_list: Vec<ContractAddress>,
}
```

#### Error Handling
**Solidity**: require/revert
```solidity
require(amount > 0, "Amount must be positive");
```

**Cairo**: assert with felt252 constants
```cairo
assert(amount > 0, Errors::INVALID_AMOUNT);
```

#### Events
**Solidity**: Direct emission
```solidity
emit AjoCreated(1, msg.sender, "My Ajo");
```

**Cairo**: Structured events
```cairo
self.emit(AjoCreated { ajo_id: 1, creator, name: 'My Ajo' });
```

### Service Migrations

- **HTS → ERC20**: Standard token interface
- **HCS → StarkNet Events**: On-chain vote recording
- **HSS → Keeper Pattern**: Manual execution with time checks

---

## 📚 Resources

### Cairo Learning
- [Cairo Book](https://book.cairo-lang.org/) - Start here
- [Cairo by Example](https://cairo-by-example.com/) - Practical examples
- [Starknet Book](https://book.starknet.io/) - StarkNet specifics

### StarkNet Development
- [StarkNet Docs](https://docs.starknet.io/)
- [StarkNet Foundry](https://foundry-rs.github.io/starknet-foundry/)
- [OpenZeppelin Cairo Contracts](https://github.com/OpenZeppelin/cairo-contracts)

### Bitcoin + StarkNet
- [OP_CAT Proposal](https://github.com/bitcoin/bips/pull/1525)
- [Bitcoin Covenants Research](https://bitcoinops.org/en/topics/covenants/)
- [StarkNet Bitcoin Bridge Research](https://community.starknet.io/)

---

## 👥 Team

**Original Project**: AJO.SAVE on Hedera
- Ola Oluwa Marvellous - Smart Contracts & Architecture
- Oluleye Emmanuel - Frontend Development

**Cairo Translation**: [Your Name]
- Cairo smart contract development
- Bitcoin integration architecture
- StarkNet deployment

---

## 🤝 Contributing

### Getting Started

1. Start with high-priority contracts (AjoCollateral, AjoMembers, AjoPayments)
2. Follow the interfaces - they're all defined
3. Use components for common functionality (Ownable, Pausable, ReentrancyGuard)
4. Write tests for each function
5. Document the 60% collateral math

### Next Immediate Action

**Implement AjoCollateral Contract** (`src/collateral/ajo_collateral.cairo`)

This is the most critical component as it implements the innovative 60% collateral formula.

Key functions to implement:
1. `calculate_debt()` - Calculate debt for position
2. `calculate_required_collateral()` - Calculate 60% collateral
3. `deposit_collateral()` - Handle collateral deposits
4. `withdraw_collateral()` - Handle collateral withdrawals
5. `seize_collateral()` - Handle default seizures

---

## 📄 License

MIT License - Same as original AJO.SAVE project

---

## 🙏 Acknowledgments

- Original AJO.SAVE Team for the innovative 60% collateral model
- StarkWare for Cairo and STARK technology
- Bitcoin Core for OP_CAT covenant research
- Traditional Ajo/Esusu Communities for inspiring this protocol

---

**Status**: 🚧 Foundation Complete (25%)  
**Next Milestone**: Implement AjoCollateral (60% formula)  
**Target**: Bitcoin Track Submission

Built with ❤️ for Africa, powered by Bitcoin + StarkNet + STARK proofs
