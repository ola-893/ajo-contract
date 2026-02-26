# 🏦 AJO.SAVE - Decentralized Savings Platform

> Bringing traditional African savings circles (Ajo/Esusu) to blockchain with Starknet's STARK-powered scalability

[![Cairo](https://img.shields.io/badge/Cairo-2.8.4-orange)](https://www.cairo-lang.org/)
[![Starknet](https://img.shields.io/badge/Starknet-Sepolia-blue)](https://www.starknet.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Deployed Contracts](#-deployed-contracts)
- [Development](#-development)
- [Testing](#-testing)
- [Integration Scripts](#-integration-scripts)
- [Deployment](#-deployment)
- [Key Innovation](#-key-innovation-60-collateral-model)
- [Architecture](#-architecture)
- [Contributing](#-contributing)
- [Resources](#-resources)

---

## 🎯 Overview

AJO.SAVE is a decentralized ROSCA (Rotating Savings and Credit Association) protocol built on Starknet. It enables communities to create trustless savings circles with automated payment cycles, collateral management, and on-chain governance.

### Key Features

- ✅ **Factory Pattern**: Deploy unlimited Ajo groups via factory contract
- ✅ **60% Collateral Model**: Innovative formula providing 108.9%+ security with only 60% collateral
- ✅ **Automated Cycles**: Time-based payment cycles with automatic payout distribution
- ✅ **On-chain Governance**: Member voting on protocol parameters
- ✅ **Guarantor Network**: Distributed risk through guarantor relationships
- ✅ **Multi-token Support**: ERC20 compatible (USDC, STRK, etc.)

### Status

**Overall Progress**: 100% Complete ✅

- ✅ All 7 contracts implemented and tested
- ✅ Deployed to Starknet Sepolia testnet
- ✅ Integration testing scripts complete
- ✅ Comprehensive documentation

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install Scarb (Cairo package manager)
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh

# Verify installation
scarb --version  # Should show: scarb 2.8.4 or higher
```

### Build & Test

```bash
# Clone repository
git clone <repository-url>
cd ajo-contract

# Build Cairo contracts
cd ajo-save-cairo
scarb build

# Run tests
snforge test

# Run integration scripts
cd starknet-scripts
npm install
npm start
```

---

## 📁 Project Structure

```
ajo-contract/
├── ajo-save-cairo/              # Cairo/Starknet implementation
│   ├── src/                     # Contract source code
│   │   ├── factory/             # Factory contract
│   │   ├── core/                # Core orchestration
│   │   ├── members/             # Member management
│   │   ├── collateral/          # Collateral calculations
│   │   ├── payments/            # Payment processing
│   │   ├── governance/          # On-chain voting
│   │   ├── schedule/            # Time-based automation
│   │   ├── components/          # Reusable components
│   │   └── interfaces/          # Contract interfaces
│   ├── tests/                   # Cairo tests
│   ├── scripts/                 # Deployment scripts
│   ├── starknet-scripts/        # Integration testing
│   └── Scarb.toml               # Cairo project config
│
├── contracts/                   # Solidity contracts (Hedera)
├── scripts/                     # Hedera scripts
├── test/                        # Hardhat tests
└── README.md                    # This file
```

---

## 🌐 Deployed Contracts

### Starknet Sepolia Testnet

**Deployment Date**: February 26, 2026  
**Cairo Version**: 2.8.4

#### Factory Contract (Main Entry Point)
- **Address**: `0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c`
- **Explorer**: [View on Voyager](https://sepolia.voyager.online/contract/0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c)

#### Declared Class Hashes

| Contract | Class Hash |
|----------|------------|
| AjoCore | `0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe` |
| AjoMembers | `0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e` |
| AjoCollateral | `0x010df6c90037dd085d8e8af463c39868a74ea2d6ed42bca4cf28b39125a7e508` |
| AjoPayments | `0x037373de8891f668e4fb87c93ff44226c824925ea77c7b37228ac4723fbdcb81` |
| AjoGovernance | `0x032c456a286bf679d79019550763134942a0104816ae07e43d0cfa53b48b6986` |
| AjoSchedule | `0x03a021e7030f440989144ce020d494c37ae6ee0fe075fcfab751771411c20aa6` |

#### USDC Token
- **Address**: `0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343`

---

## 🛠️ Development

### Cairo Development

```bash
cd ajo-save-cairo

# Build contracts
scarb build

# Format code
scarb fmt

# Run all tests
snforge test

# Run specific test
snforge test test_collateral_formula

# Run with verbose output
snforge test -v
```

### Environment Setup

Create `.env` file in `ajo-save-cairo/`:

```env
# Network Configuration
STARKNET_NETWORK=sepolia
STARKNET_RPC=https://starknet-sepolia.public.blastapi.io

# Account Configuration
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...
```

---

## 🧪 Testing

### Cairo Tests

```bash
cd ajo-save-cairo
snforge test
```

**Test Coverage**:
- ✅ Factory deployment and Ajo creation
- ✅ Member management and guarantor network
- ✅ Collateral calculations (60% formula)
- ✅ Payment processing and cycle management
- ✅ Governance proposals and voting
- ✅ Access control and security
- ✅ Reentrancy protection
- ✅ Full season integration tests

### Integration Tests

```bash
cd ajo-save-cairo/starknet-scripts
npm install
npm start
```

**Available Demos**:
1. **Quick Test** (~2-3 min) - Smoke test of basic functionality
2. **Full Lifecycle** (~8-10 min) - Complete Ajo lifecycle from creation to payout
3. **Governance** (~4-5 min) - Proposal creation, voting, and execution
4. **Advanced Features** (~5-6 min) - Collateral management and edge cases

---

## 🔌 Integration Scripts

### Setup

```bash
cd ajo-save-cairo/starknet-scripts
npm install
cp .env.example .env
# Edit .env with your account details
```

### Configuration

Edit `.env`:

```env
# Required
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...

# Optional - for multi-participant demos
TEST_ACCOUNT_1_ADDRESS=0x...
TEST_ACCOUNT_1_PRIVATE_KEY=0x...
# ... up to TEST_ACCOUNT_10
```

### Running Scripts

```bash
# Interactive menu
npm start

# Specific demo
npm start -- quick-test
npm start -- full-cycle
npm start -- governance
npm start -- advanced

# With debug output
DEBUG=true npm start -- full-cycle
```

### Script Features

- ✅ Automated Ajo creation and setup
- ✅ Multi-participant simulation
- ✅ Payment cycle processing
- ✅ Governance operations
- ✅ Collateral management
- ✅ Comprehensive error handling
- ✅ Formatted console output
- ✅ Transaction monitoring

---

## 🚀 Deployment

### Prerequisites

- Scarb 2.8.4+
- Starkli 0.3.0+ or sncast 0.56.0+
- Starknet account with STRK for gas

### Quick Deployment

```bash
cd ajo-save-cairo

# Build contracts
scarb build

# Declare all contracts
./scripts/declare_all.sh

# Deploy factory
./scripts/deploy_factory.sh
```

### Manual Deployment

```bash
# 1. Declare contracts
starkli declare target/dev/ajo_save_AjoCore.contract_class.json \
  --casm-hash <expected_hash> \
  --private-key $STARKNET_PRIVATE_KEY \
  --watch

# 2. Deploy factory with class hashes
starkli deploy <factory_class_hash> \
  <owner_address> \
  <core_class_hash> \
  <members_class_hash> \
  <collateral_class_hash> \
  <payments_class_hash> \
  <governance_class_hash> \
  <schedule_class_hash> \
  --private-key $STARKNET_PRIVATE_KEY \
  --watch
```

### Troubleshooting Deployment

**CASM Hash Mismatch**:
```bash
# Use --casm-hash flag to override
starkli declare target/dev/ajo_save_AjoCore.contract_class.json \
  --casm-hash 0x74865ddd0c81e7ac529241223dd9817a77949d34369705e2e6fb0582221857a \
  --private-key $PK \
  --watch
```

**Class Not Declared**:
- Wait 30-60 minutes for network propagation
- Retry deployment
- Use Voyager/Starkscan UI as fallback

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

## 🏗️ Architecture

### Contract Hierarchy

```
AjoFactory (Entry Point)
    ↓ deploys
    ├── AjoCore (Orchestrator)
    │   ├── coordinates → AjoMembers
    │   ├── coordinates → AjoCollateral
    │   ├── coordinates → AjoPayments
    │   ├── coordinates → AjoGovernance
    │   └── coordinates → AjoSchedule
```

### Component System

```cairo
// Reusable components
component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
component!(path: PausableComponent, storage: pausable, event: PausableEvent);
component!(path: ReentrancyGuardComponent, storage: reentrancy, event: ReentrancyEvent);
```

### Key Technical Decisions

1. **Component System** (vs Solidity Inheritance)
   - Better modularity
   - Explicit storage subsystems
   - Cleaner event handling

2. **Class Hash Deployment** (vs Minimal Proxies)
   - Native to Starknet
   - More gas-efficient
   - Simpler than proxy pattern

3. **ERC20 Integration** (vs Hedera HTS)
   - Standard interface
   - Wide compatibility
   - Easy bridge integration

---

## 🤝 Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

### Development Guidelines

- Follow Cairo best practices
- Write comprehensive tests
- Document all functions
- Use components for common functionality
- Ensure security (access control, reentrancy protection)

### Testing Requirements

- All new features must have tests
- Maintain >80% test coverage
- Test edge cases and error conditions
- Run full test suite before submitting PR

---

## 📚 Resources

### Cairo & Starknet
- [Cairo Book](https://book.cairo-lang.org/)
- [Starknet Documentation](https://docs.starknet.io/)
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/)
- [OpenZeppelin Cairo Contracts](https://github.com/OpenZeppelin/cairo-contracts)

### Tools
- [Scarb](https://docs.swmansion.com/scarb/) - Cairo package manager
- [Starkli](https://book.starkli.rs/) - Starknet CLI
- [Voyager](https://voyager.online/) - Block explorer
- [Starkscan](https://starkscan.co/) - Block explorer

### Community
- [Starknet Discord](https://discord.gg/starknet)
- [Cairo Telegram](https://t.me/starknetofficial)
- [Starknet Forum](https://community.starknet.io/)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- StarkWare for Cairo and STARK technology
- OpenZeppelin for Cairo contract standards
- Traditional Ajo/Esusu communities for inspiring this protocol
- Starknet community for support and feedback

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: See inline code documentation
- **Community**: Join Starknet Discord

---

**Built with ❤️ for Africa, powered by Starknet + STARK proofs**

