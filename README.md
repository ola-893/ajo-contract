# Ajo.save

**Decentralized Rotating Savings and Credit Association (ROSCA) Protocol on Hedera**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hedera](https://img.shields.io/badge/Hedera-Testnet-purple.svg)](https://hedera.com)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)

> Bringing traditional African savings circles (Ajo/Esusu) to the blockchain with enhanced security, transparency, and efficiency.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technical Architecture](#technical-architecture)
- [Getting Started](#getting-started)
- [Smart Contract Components](#smart-contract-components)
- [Usage Examples](#usage-examples)
- [Advanced Features](#advanced-features)
- [Gas Optimization](#gas-optimization)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Overview

Ajo.save is a decentralized protocol that modernizes traditional rotating savings and credit associations (ROSCAs), known as "Ajo" in Nigeria and "Esusu" across West Africa. The protocol enables groups of people to pool funds together, with each member receiving the collective pot in rotation.

### The Problem We Solve

Traditional ROSCAs face several challenges:
- **Trust Issues**: Reliance on personal relationships and informal agreements
- **Default Risk**: No collateral or enforcement mechanisms
- **Capital Inefficiency**: Typically require 100%+ collateral per participant
- **Limited Transparency**: No clear audit trail or dispute resolution
- **Scalability**: Difficult to manage across geographical boundaries

### Our Solution

Ajo.save introduces a revolutionary **60% Collateral Model (V3)** with:
- **Dynamic Collateral System**: Reduces capital requirements by 46% compared to traditional models
- **Guarantor Network**: Distributed risk across all participants
- **Smart Recovery**: Automatic asset seizure from past payments for default recovery
- **Mathematical Security**: 108.9% coverage ratio with 40 USDC safety buffer
- **Decentralized Governance**: Member-driven decision making
- **Multi-Token Support**: Flexibility with USDC, HBAR, and other tokens
- **Factory Pattern**: Unlimited scalability for group creation

## Key Features

### Core Functionality

- **4-Phase Initialization**: Secure, gas-optimized contract deployment
- **Dynamic Collateral (V3)**: 60% collateral factor with mathematical security proof
- **Guarantor System**: Risk distribution across all members with 108.9% coverage
- **Payment Cycles**: Automated monthly contributions and payouts
- **Default Handling**: Collateral + past payment seizure with $40 safety buffer
- **Reputation System**: Track member reliability and voting power

### Advanced Features

- **Governance Module**: On-chain voting for parameter changes
- **Multi-Token Support**: USDC and WHBAR (extensible to more)
- **Emergency Controls**: Pause mechanisms and fund recovery
- **Payment Analytics**: Comprehensive cycle insights and reporting
- **Factory Scaling**: Minimal-proxy pattern for unlimited group creation
- **Health Diagnostics**: Real-time contract monitoring and status checks

### Economic Innovation

Our V3 Collateral Model achieves 60% collateral efficiency with enhanced security:
1. **Position-Based Collateral**: Earlier positions require more collateral
2. **Guarantor Network**: Each member backs others proportionally
3. **Past Payment Seizure**: Failed members lose accumulated benefits
4. **Risk Distribution**: No single point of failure
5. **Enhanced Safety Buffer**: 60% collateral factor provides robust protection

**Example** (10 members, 50 USDC monthly):
- Traditional Model: 100%+ × 50 USDC = 50+ USDC per member
- Ajo.save V3: 60% collateral factor with mathematical proof
- **Position 1 (Highest Risk)**: 270 USDC collateral for 500 USDC payout
- **Position 6 (Guarantor)**: 120 USDC collateral
- **Safety Buffer**: 40 USDC excess coverage over worst-case loss

#### Collateral Formula

```
Debt(n) = Payout - (n × monthlyContribution)
Collateral(n) = Debt(n) × 0.60
```

**Worst-Case Scenario Protection:**
- If Position 1 defaults after receiving 500 USDC payout
- Net Loss: 450 USDC (500 - 50 already paid)
- Recoverable Assets: 490 USDC
  - P1 Collateral: 270 USDC
  - P6 Guarantor Collateral: 120 USDC  
  - Past Payments: 100 USDC (50 + 50)
- **Result**: 40 USDC safety buffer (109% coverage)

## Technical Architecture

### Smart Contract Structure

```
AjoFactory (Main Entry Point)
├── Master Copies (Implementation Contracts)
│   ├── AjoCore (Main logic & coordination)
│   ├── AjoMembers (Membership management)
│   ├── AjoCollateral (Collateral tracking)
│   ├── AjoPayments (Payment processing)
│   └── AjoGovernance (Voting & proposals)
│
└── Minimal Proxies (Per Group Instance)
    ├── Proxy → AjoCore
    ├── Proxy → AjoMembers
    ├── Proxy → AjoCollateral
    ├── Proxy → AjoPayments
    └── Proxy → AjoGovernance
```

### 4-Phase Initialization

1. **Phase 1**: Deploy minimal proxies for all contracts
2. **Phase 2**: Initialize AjoMembers and AjoGovernance
3. **Phase 3**: Initialize AjoCollateral and AjoPayments
4. **Phase 4**: Initialize AjoCore and activate system

This phased approach prevents circular dependencies and optimizes gas usage.

## Getting Started

### Prerequisites

- Node.js v16 or higher
- npm or yarn
- A Hedera testnet account ([Get one free](https://portal.hedera.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/ola-893/ajo-contract.git
cd ajo-contract

# Install dependencies
npm install
```

### Environment Setup

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` and configure:

```bash
# Hedera Network Configuration
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT_ID

# Testnet Configuration
TESTNET_OPERATOR_PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
TESTNET_ENDPOINT=https://testnet.hashio.io/api

# Optional: Additional test accounts
PRIVATE_KEY_1=0xOPTIONAL_TEST_ACCOUNT_1
PRIVATE_KEY_2=0xOPTIONAL_TEST_ACCOUNT_2
# ... (up to PRIVATE_KEY_10)
```

**Get Your Credentials:**
1. Visit [Hedera Portal](https://portal.hedera.com)
2. Create a testnet account (free)
3. Copy your Account ID and Private Key to `.env`

### Quick Start

```bash
# Compile contracts
npx hardhat compile

# Deploy to Hedera testnet
npx hardhat run scripts/deploy-4-phase-factory.js --network hedera

# Run comprehensive demo (deploy + test + advanced features)
npx hardhat run scripts/hackathon-demo-complete.cjs --network hedera

# Run core functionality test on existing deployment
npx hardhat run scripts/test-core-functions.cjs --network hedera
```

## Smart Contract Components

### AjoFactory

Main factory contract for creating and managing Ajo groups.

**Key Functions:**
```solidity
// Create new Ajo group
function createAjo(string memory name) external returns (uint256 ajoId)

// Initialize phases
function initializeAjoPhase2(uint256 ajoId) external
function initializeAjoPhase3(uint256 ajoId) external
function initializeAjoPhase4(uint256 ajoId) external

// Health monitoring
function getAjoHealthReport(uint256 ajoId) external view returns (...)
function getAjoOperationalStatus(uint256 ajoId) external view returns (...)
```

### AjoCore

Core coordination contract for each Ajo group.

**Key Functions:**
```solidity
// Join group
function joinAjo(uint256 tokenIndex) external

// Process payment
function processPayment() external

// Distribute payout
function distributePayout() external

// Get member info
function getMemberInfo(address member) external view returns (...)
```

### AjoMembers

Manages membership, positions, and reputation.

**Key Functions:**
```solidity
function addMember(address member, uint256 position) external
function getMemberDetails(address member) external view returns (...)
function updateReputation(address member, int256 change) external
```

### AjoCollateral

Handles collateral deposits, tracking, and seizure.

**Key Functions:**
```solidity
function depositCollateral(address member, uint256 amount) external
function seizeCollateral(address member) external
function releaseCollateral(address member, uint256 amount) external
function getCollateralDetails(address member) external view returns (...)
```

### AjoPayments

Processes payments and manages distribution.

**Key Functions:**
```solidity
function processPayment(address from, uint256 amount) external
function distributePayout(address recipient, uint256 amount) external
function getPaymentHistory(address member) external view returns (...)
```

### AjoGovernance

Decentralized governance for parameter updates.

**Key Functions:**
```solidity
function createProposal(string memory description, ...) external
function vote(uint256 proposalId, bool support) external
function executeProposal(uint256 proposalId) external
```

## Usage Examples

### Creating a New Ajo Group

```javascript
const { ethers } = require("hardhat");

async function createAjoGroup() {
  const [creator] = await ethers.getSigners();
  const factory = await ethers.getContractAt("AjoFactory", FACTORY_ADDRESS);
  
  // Phase 1: Create
  const tx1 = await factory.createAjo("My Ajo Group");
  const receipt1 = await tx1.wait();
  const ajoId = receipt1.events[0].args.ajoId;
  
  // Phase 2-4: Initialize
  await factory.initializeAjoPhase2(ajoId);
  await factory.initializeAjoPhase3(ajoId);
  await factory.initializeAjoPhase4(ajoId);
  
  console.log(`Ajo group created with ID: ${ajoId}`);
}
```

### Joining an Ajo Group

```javascript
async function joinAjo(ajoAddress, tokenIndex) {
  const [member] = await ethers.getSigners();
  const ajo = await ethers.getContractAt("AjoCore", ajoAddress);
  const usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS);
  
  // Get required collateral
  const requiredCollateral = await ajo.getRequiredCollateralForJoin(tokenIndex);
  
  // Approve tokens
  await usdc.approve(collateralAddress, requiredCollateral);
  await usdc.approve(paymentsAddress, monthlyPayment);
  
  // Join
  await ajo.joinAjo(tokenIndex);
  console.log("Successfully joined Ajo group!");
}
```

### Making Monthly Payment

```javascript
async function makePayment(ajoAddress) {
  const [member] = await ethers.getSigners();
  const ajo = await ethers.getContractAt("AjoCore", ajoAddress);
  
  await ajo.processPayment();
  console.log("Payment processed successfully!");
}
```

## Advanced Features

### Dynamic Collateral Calculation

The V3 model calculates position-based collateral with a 60% collateral factor:

```solidity
// Debt calculation for each position
Debt(n) = Payout - (n × monthlyContribution)

// Collateral requirement (60% factor for enhanced security)
Collateral(n) = Debt(n) × 0.60
```

**Example Breakdown** (10 members, $50 monthly):
- **Position 1** (receives first): Debt = $450 → Collateral = $270
- **Position 6** (guarantor for P1): Debt = $200 → Collateral = $120
- **Position 10** (receives last): Debt = $0 → Collateral = $0

**Mathematical Proof of Security:**

The minimum collateral factor required for break-even is 0.5384 (53.84%). We use 60% for enhanced protection.

When Position 1 defaults after receiving $500 payout:
```
Net Loss to Group = $500 - $50 (P1's contribution) = $450

Recoverable Assets:
+ P1's Collateral: $270
+ P1's Past Payment: $50
+ P6's Collateral (Guarantor): $120
+ P6's Past Payment: $50
= Total: $490

Safety Buffer = $490 - $450 = $40 (8.9% excess coverage)
Coverage Ratio = $490 / $450 = 108.9%
```

This design ensures:
- **Capital Efficiency**: Position 1 locks $270 (54% of payout) vs 100%+ in traditional systems
- **Robust Protection**: System can absorb defaults with 8.9% safety margin
- **Fair Risk Distribution**: Collateral proportional to position risk

### Governance Proposals

```javascript
async function createAndVoteProposal(ajoAddress) {
  const ajo = await ethers.getContractAt("AjoCore", ajoAddress);
  const governance = await ethers.getContractAt(
    "AjoGovernance", 
    await ajo.governanceContract()
  );
  
  // Create proposal
  const proposalId = await governance.createProposal(
    "Increase monthly payment to 60 USDC",
    [/* parameters */]
  );
  
  // Vote (weighted by reputation)
  await governance.vote(proposalId, true);
  
  // Execute if passed
  await governance.executeProposal(proposalId);
}
```

### Health Monitoring

```javascript
async function checkAjoHealth(ajoId) {
  const factory = await ethers.getContractAt("AjoFactory", FACTORY_ADDRESS);
  
  const health = await factory.getAjoHealthReport(ajoId);
  console.log("Phase:", health.initializationPhase);
  console.log("Ready:", health.isReady);
  console.log("Core Responsive:", health.ajoCore.isResponsive);
  
  const operational = await factory.getAjoOperationalStatus(ajoId);
  console.log("Total Members:", operational.totalMembers);
  console.log("Can Accept Members:", operational.canAcceptMembers);
}
```

## Gas Optimization

### Deployment Costs (Hedera Testnet)

| Component | Gas Usage |
|-----------|-----------|
| Mock Tokens | ~300,000 each |
| Master Contracts | ~3-6M total |
| AjoFactory | ~6M |
| 4-Phase Ajo Creation | ~6.6M total |

### User Interaction Costs

| Action | Avg Gas |
|--------|---------|
| Join Ajo | ~800,000 |
| Process Payment | ~300,000 |
| Distribute Payout | ~400,000 |

### Optimization Techniques

- **Minimal Proxy Pattern**: 99% gas savings on group creation
- **Phased Initialization**: Prevents deployment failures
- **Batch Operations**: Reduced transaction count
- **Storage Optimization**: Packed structs and mappings

## Security

### Security Features

- **Reentrancy Protection**: OpenZeppelin's ReentrancyGuard
- **Access Control**: Role-based permissions
- **Pause Mechanisms**: Emergency circuit breakers
- **Input Validation**: Comprehensive checks
- **Safe Math**: Solidity 0.8.20+ built-in overflow protection

### Audit Status

⚠️ **Not Yet Audited** - This is prototype code for hackathon demonstration. Do not use in production without professional security audit.

### Best Practices

```solidity
// Always check-effects-interactions pattern
function processPayment() external nonReentrant whenNotPaused {
    // 1. Checks
    require(isMember[msg.sender], "Not a member");
    
    // 2. Effects
    paymentsMade[msg.sender]++;
    
    // 3. Interactions
    token.transferFrom(msg.sender, address(this), amount);
}
```

## Testing

### Run Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/AjoCore.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with coverage
npx hardhat coverage
```

### Demo Scripts

```bash
# Complete deployment + testing + advanced features
npx hardhat run scripts/hackathon-demo-complete.cjs --network hedera

# Deploy only
npx hardhat run scripts/deploy-4-phase-factory.js --network hedera

# Test existing deployment
npx hardhat run scripts/test-core-functions.cjs --network hedera
```

## Deployment

### Hedera Testnet

```bash
# Configure .env first!
# Then deploy
npx hardhat run scripts/deploy-4-phase-factory.js --network hedera
```

Deployment creates a JSON file with all contract addresses:
```json
{
  "network": "hedera-testnet",
  "contracts": {
    "AjoFactory": "0x...",
    "USDC": "0x...",
    "WHBAR": "0x..."
  },
  "masterCopies": {
    "AjoCore": "0x...",
    "AjoMembers": "0x...",
    ...
  }
}
```

### Mainnet Deployment

⚠️ **Not Recommended Yet** - Complete security audit required before mainnet deployment.

## Competitive Advantages

1. **Capital Efficiency**: 46% less collateral required (60% vs 100%+)
2. **Mathematical Security**: 108.9% coverage ratio with proven safety buffer
3. **Risk Distribution**: Guarantor network prevents single points of failure
4. **Governance**: Member-driven, preventing centralization
5. **Multi-Token**: Serve diverse markets globally
6. **Scalability**: Factory pattern enables unlimited groups
7. **Transparency**: On-chain audit trail and analytics
8. **Collateral Paradox Solved**: Position 1 pays $270 to receive $500 (54% requirement)

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow Solidity style guide
- Add tests for new features
- Update documentation
- Run `npm run lint` before committing

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Traditional Ajo/Esusu communities for inspiration
- Hedera for blockchain infrastructure
- OpenZeppelin for secure contract libraries
- The Ethereum community for development tools

## Contact & Support

- **GitHub**: [ola-893/ajo-contract](https://github.com/ola-893/ajo-contract)
- **Issues**: [Report a bug](https://github.com/ola-893/ajo-contract/issues)
- **Discussions**: [Join the conversation](https://github.com/ola-893/ajo-contract/discussions)

## Roadmap

- [x] Core ROSCA functionality
- [x] Dynamic collateral system (V3 - 60% factor)
- [x] Mathematical security proof with safety buffer
- [x] Factory pattern implementation
- [x] Governance module
- [x] Multi-token support
- [ ] Security audit
- [ ] Frontend interface
- [ ] Mobile app
- [ ] Mainnet deployment
- [ ] Additional token integrations
- [ ] Cross-chain bridges

---

**Built with ❤️ for the Hedera community**

*Empowering traditional savings circles with blockchain technology*

---

## Technical Documentation: V3 Collateral System

### Analysis of the Ajo Collateral and Guarantor System

**Last Updated:** September 29, 2025

#### 1. Core Principles & Goals

- **Mitigate Default Risk**: Protect the Ajo group from losses if a member defaults after receiving payout
- **Solve the Collateral Paradox**: Required collateral must be substantially less than the payout received
- **Fairness and Risk Proportionality**: Collateral proportional to financial risk introduced
- **Enhanced Security**: Significant buffer between seizable assets and maximum potential loss

#### 2. The Worst-Case Scenario

The moment of maximum financial risk occurs when Participant 1 receives their payout in Month 1 and immediately defaults.

- **Net Loss to Group**: Payout - P1's Contribution = ($500 - $50) = $450
- **Total Seizable Assets**:
  - Participant 1's Locked Collateral: Collateral(1)
  - Participant 1's Past Payments: 1 × $50
  - Guarantor 6's Locked Collateral: Collateral(6)
  - Guarantor 6's Past Payments: 1 × $50

#### 3. The Collateral Calculation Logic

```
Debt for Participant n = Payout - (n × monthlyContribution)
Collateral(n) = Debt(n) × collateralFactor
```

#### 4. Determining the collateralFactor

- **Mathematical Minimum**: 0.5384 (53.84%) for break-even
- **V3 collateralFactor**: 0.60 (60%) for enhanced security
- **Result**: Significantly higher safety margin than V2 (0.55)

#### 5. Verification Example (collateralFactor = 0.60)

**Collateral Requirements:**
- **Position 1**: ($500 - 1×$50) × 0.60 = $450 × 0.60 = **$270**
- **Position 6 (Guarantor)**: ($500 - 6×$50) × 0.60 = $200 × 0.60 = **$120**

**Default Recovery:**
- Seized Collateral (P1): $270
- Seized Collateral (P6): $120
- Seized Past Payments: $50 + $50 = $100
- **Total Recoverable**: $490

**Security Analysis:**
- Maximum Potential Loss: $450
- Total Recoverable Assets: $490
- **Safety Buffer**: $40 ($490 - $450)
- **Coverage Ratio**: 108.9% ($490 / $450)

**Conclusion:** The V3 model with 60% collateral factor provides robust security while maintaining capital efficiency. The highest-risk user (Position 1) locks only $270 to receive a $500 payout—well below the traditional 100%+ requirement.