# 🏦 AJO.SAVE - Decentralized ROSCA Protocol on Starknet

# Track - Onchain Finance & Real-World Assets (RWA)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Starknet](https://img.shields.io/badge/Starknet-Sepolia-purple.svg)](https://starknet.io)
[![Track](https://img.shields.io/badge/Track-DeFi-brightgreen.svg)]()

> **Bringing traditional African savings circles (Ajo/Esusu) to Web3 with Starknet and Cairo for low-cost, transparent, programmable community finance**

---

## 📋 Table of Contents

- [Project Links](#project-links)
- [Project Overview](#project-overview)
- [Starknet Integration Summary](#starknet-integration-summary)
- [Architecture Diagram](#architecture-diagram)
- [Key Features](#key-features)
- [Deployed Starknet IDs](#deployed-starknet-ids)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [Smart Contract Architecture](#smart-contract-architecture)
- [Demo & Testing](#demo--testing)
- [Economic Model](#economic-model)
- [Project Links (Resources)](#project-links-resources)
- [Team](#team)

---

## Project Links

**GitHub Repository:** [Ajo.Save](https://github.com/Deonorla/Ajo.Save)

**Pitch Deck:** [Pitch deck](https://www.canva.com/design/DAG0d1jQ7_c/Yq8DAVK2hGs0xhpd_xfmWQ/view?utm_content=DAG0d1jQ7_c&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hc7f6fc03ab)

**Frontend Demo:** [ajo-save.vercel.app](https://ajo-save.vercel.app)

---

## 🎯 Project Overview

**Track:** Onchain Finance & Real-World Assets (RWA)

**Problem:** Traditional African savings circles (ROSCAs) rely on social trust, manual bookkeeping, and weak default enforcement. Existing blockchain versions are often too expensive or too complex for low-ticket recurring contributions.

**Solution:** AJO.SAVE on Starknet uses Cairo smart contracts, class-hash-based deployment, ERC20 payment rails, and on-chain governance/event transparency to run ROSCA groups with programmable rules and lower execution cost than Ethereum L1.

**Impact:** Enables financially inclusive, transparent, and enforceable savings circles for underserved communities while preserving a familiar Ajo/Esusu model.

---

## 🔗 Starknet Integration Summary

AJO.SAVE is built on **Starknet (Sepolia for current testing)** with Cairo contracts and a modular architecture (`AjoFactory`, `AjoCore`, `AjoMembers`, `AjoCollateral`, `AjoPayments`, `AjoGovernance`, `AjoSchedule`).

### 1. **Cairo Contracts + Class Hashes** - Core Execution Layer

**Why this matters:** Starknet deploys reusable logic via class hashes, then instantiates per-Ajo contracts from a factory flow. This keeps deployment efficient and modular.

**Deployment flow in codebase:**

- `create_ajo(...)`
- `deploy_core(...)`
- `deploy_members(...)`
- `deploy_collateral_and_payments(...)`
- `deploy_governance_and_schedule(...)`

**Factory interface excerpt:**

```cairo
// src/interfaces/i_ajo_factory.cairo
fn create_ajo(
    ref self: TContractState,
    name: felt252,
    monthly_contribution: u256,
    total_participants: u256,
    cycle_duration: u64,
    payment_token: PaymentToken,
) -> u256;

fn deploy_core(ref self: TContractState, ajo_id: u256) -> ContractAddress;
fn deploy_members(ref self: TContractState, ajo_id: u256) -> ContractAddress;
fn deploy_collateral_and_payments(
    ref self: TContractState, ajo_id: u256
) -> (ContractAddress, ContractAddress);
fn deploy_governance_and_schedule(
    ref self: TContractState, ajo_id: u256
) -> (ContractAddress, ContractAddress);
```

### 2. **ERC20 Payment Rail on Starknet** - Treasury & Contribution Layer

**Why this matters:** Contributions, collateral, and payouts are tokenized with standard ERC20 transfer flow on Starknet (currently configured with USDC address in repo configs).

**Core token actions:**

- `approve` from member wallet
- `transfer_from` for collateral and recurring contributions
- `transfer` for payouts/refunds/seizures

**Collateral contract excerpt:**

```cairo
// src/collateral/ajo_collateral.cairo
fn deposit_collateral(ref self: ContractState, amount: u256) {
    let caller = get_caller_address();
    let token_address = self.payment_token.read();
    let token = IERC20Dispatcher { contract_address: token_address };

    let success = token.transfer_from(caller, get_contract_address(), amount);
    assert(success, 'Token transfer failed');

    let current = self.member_collateral.read(caller);
    self.member_collateral.write(caller, current + amount);
}
```

### 3. **On-Chain Governance + Event Transparency** - Coordination Layer

**Why this matters:** Governance is native to Starknet contracts. Votes, proposals, defaults, and payout actions are emitted as events and are queryable through explorers/RPC.

**Governance interface excerpt:**

```cairo
// src/interfaces/i_ajo_governance.cairo
fn create_proposal(
    ref self: TContractState,
    proposal_type: ProposalType,
    description: felt252,
    target: ContractAddress,
    calldata: Span<felt252>,
) -> u256;

fn cast_vote(ref self: TContractState, proposal_id: u256, support: bool);
fn execute_proposal(ref self: TContractState, proposal_id: u256);
```

### 4. **Scheduling Module (`AjoSchedule`)** - Automation Layer

**Why this matters:** Scheduling is modeled on-chain with task structs and execution windows. Off-chain executors can call scheduled actions when due.

**Schedule interface excerpt:**

```cairo
// src/interfaces/i_ajo_schedule.cairo
fn schedule_task(
    ref self: TContractState,
    schedule_type: ScheduleType,
    execution_time: u64,
    target: ContractAddress,
    calldata: felt252,
) -> u256;

fn execute_task(ref self: TContractState, task_id: u256);
fn schedule_cycle_payments(ref self: TContractState, cycle: u256, start_time: u64);
```

### **Combined Economic Impact (High-Level)**

| Operation | Ethereum L1 (Typical) | Starknet (Typical) | Savings |
|-----------|------------------------|---------------------|---------|
| Token Operations | High per-tx gas volatility | Lower L2 execution cost | Significant |
| Governance Voting | Expensive per vote on L1 | Lower-cost on-chain voting | Significant |
| Multi-contract Deployment | Expensive full deployments | Class hash + instance flow | Significant |

Starknet reduces transaction friction for recurring micro-contribution groups and makes ROSCA automation economically practical.

---

## 🏗️ Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Create Ajo  │  │  Join Group  │  │ Make Payment │  │ Vote/Govern │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                │                  │                 │         │
│         └────────────────┴──────────────────┴─────────────────┘         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                   ┌──────────────────┼──────────────────┐
                   ▼                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌────────────────┐
           │ starknet.js  │   │ Wallets      │   │ RPC Provider   │
           │ + ABI calls  │   │ Argent/Braavos│  │ (Sepolia)      │
           └──────┬───────┘   └──────┬───────┘   └──────┬─────────┘
                  │                  │                  │
                  └──────────────────┴──────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        STARKNET (SEPOLIA TESTNET)                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                           AjoFactory                              │   │
│  │  create_ajo → deploy_core → deploy_members → deploy_* modules   │   │
│  └───────────────────────┬──────────────────────────────────────────┘   │
│                          │                                              │
│          ┌───────────────┴─────────────────────────────────┐           │
│          │ Per-Ajo Module Set (6 deployed module contracts) │           │
│          │ AjoCore | AjoMembers | AjoCollateral | AjoPayments│          │
│          │ AjoGovernance | AjoSchedule                        │          │
│          └───────────────┬───────────────────────────────────┘          │
│                          │                                              │
│    ERC20 (USDC) <──── collateral / contributions / payouts ────> Users │
│                          │                                              │
│               Events: AjoCreated, MemberJoined, PaymentProcessed,      │
│                       PayoutDistributed, ProposalCreated, VoteCast      │
└─────────────────────────────────────────────────────────────────────────┘
```

### DATA FLOW EXAMPLES

**1️⃣ CREATE AJO GROUP**

`User → Factory.create_ajo() → Deploy module contracts → Emit AjoCreated`

**2️⃣ JOIN AJO**

`User → Approve USDC → Core.join_ajo() → Members.add_member() + Collateral.deposit_collateral()`

**3️⃣ MAKE PAYMENT**

`User → Core.process_payment() → Payments.make_payment() → cycle tracking`

**4️⃣ GOVERNANCE VOTE**

`User → Governance.create_proposal()/cast_vote() → on-chain tally + status updates`

**5️⃣ PAYOUT**

`Cycle complete → Payments.distribute_payout() → recipient transfer + cycle advancement`

### KEY ADVANTAGES

✅ Lower recurring transaction cost profile than Ethereum L1  
✅ Native account abstraction ecosystem (Argent/Braavos wallets)  
✅ Strong modularity via class hash + factory deployment flow  
✅ Transparent event audit trail via Starknet explorers  
✅ Contract-level governance and automation modules included

---

## ✨ Key Features

### 1. **Dynamic Collateral System (V3 - 60% Factor)**

Core protocol math is implemented in Cairo and tested across collateral scenarios.

**Formula:**

```text
Debt(n) = Payout - (n × monthlyContribution)
Collateral(n) = Debt(n) × 0.60
```

### 2. **Guarantor Network**

Guarantor assignment is position-based with offset logic in member/collateral flow.

```cairo
let offset = total_participants / 2;
let guarantor_position = ((position - 1 + offset) % total_participants) + 1;
```

### 3. **5-Step Factory Deployment Sequence**

Current factory deployment flow is phase-based and explicit:

1. `create_ajo`
2. `deploy_core`
3. `deploy_members`
4. `deploy_collateral_and_payments`
5. `deploy_governance_and_schedule`

### 4. **Tokenized Contributions**

Protocol-level payment token enum currently supports:

- `USDC`
- `BTC`

(Frontend configs also include STRK/ETH addresses for network/token context.)

### 5. **Configurable Cycles with Safety Bounds**

From protocol constants (`src/interfaces/types.cairo`):

- Minimum cycle duration: `86400` seconds (1 day)
- Maximum cycle duration: `5356800` seconds (62 days)
- Participants bounds: `3` to `100`

---

## 📍 Deployed Starknet IDs

### Starknet Sepolia (Current Repo Configuration)

**Network:** Starknet Sepolia  
**RPC (default in scripts):** `https://starknet-sepolia.public.blastapi.io`  
**Explorer:** `https://sepolia.voyager.online`

#### Core Entry Contract

| Contract | Address | Source |
|----------|---------|--------|
| **AjoFactory** | `0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c` | `ajo-save-cairo/starknet-scripts/config/contracts.js` |

#### Latest Declared Class Hashes (from `declared_class_hashes.json`)

| Contract | Class Hash |
|----------|------------|
| **AjoCore** | `0x0551db2358a30daedf21c9adf6b9dadfe6efa0c787012207700bc73a62241fdc` |
| **AjoMembers** | `0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07` |
| **AjoPayments** | `0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d` |
| **AjoSchedule** | `0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae` |
| **AjoCollateral** | `0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb` |
| **AjoGovernance** | `0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2` |
| **AjoFactory (class hash)** | `0x04562a6212841de1e66e97119948df7f5bb97387cb3a6e44bf92bef922f80d6b` |

#### Token Addresses (Frontend Config)

| Token | Sepolia Address |
|-------|------------------|
| **USDC** | `0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343` |
| **STRK** | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |
| **ETH** | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` |

---

## 🚀 Setup & Installation

### Prerequisites

- **Scarb** `2.8.4+`
- **Starknet Foundry** (`snforge`, `sncast`)
- **Node.js** `18+` (frontend currently uses modern Vite/React stack)
- **Git**
- **Starknet wallet** (ArgentX or Braavos)

### Step 1: Clone Repository

```bash
git clone https://github.com/Deonorla/Ajo.Save.git
cd Ajo.Save
```

### Step 2: Build Cairo Contracts

```bash
cd ajo-save-cairo
scarb build
```

### Step 3: Install Script Dependencies

```bash
cd starknet-scripts
npm install
```

### Step 4: Install Frontend Dependencies

```bash
cd ../../frontend
npm install
```

### Step 5: Configure Environment Variables

Create frontend env:

```bash
cp .env.example .env
```

Update `frontend/.env`:

```bash
VITE_STARKNET_NETWORK=sepolia
VITE_AJO_FACTORY_ADDRESS=0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c
VITE_WALLET_CONNECT_PROJECT_ID=
```

Create script env:

```bash
cd ../ajo-save-cairo/starknet-scripts
cp .env.example .env
```

Minimum required script keys:

```bash
STARKNET_RPC=https://starknet-sepolia.public.blastapi.io
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...
FACTORY_ADDRESS=0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c
USDC_ADDRESS=0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343
```

### Step 6: Fund Accounts

- Fund deployer/operator account with STRK for fees
- Fund participant accounts with test USDC for demos

---

## 🎮 Running the Application

### Frontend

```bash
cd frontend
npm run dev
```

**Frontend URL:** `http://localhost:5173`

### Cairo Unit + Integration Tests

```bash
cd ajo-save-cairo
snforge test
```

### Interactive Starknet Demo CLI

```bash
cd ajo-save-cairo/starknet-scripts
npm start
```

### Direct Demo Commands

```bash
npm run demo:quick
npm run demo:full
npm run demo:governance
npm run demo:advanced
```

### Factory Deployment Script (Sncast-based)

```bash
cd ajo-save-cairo
./scripts/full_deployment.sh
```

---

## 📦 Smart Contract Architecture

### Contract Hierarchy

```text
AjoFactory (Entry Point)
├── Declared Class Hashes
│   ├── AjoCore
│   ├── AjoMembers
│   ├── AjoCollateral
│   ├── AjoPayments
│   ├── AjoGovernance
│   └── AjoSchedule
│
└── Per-Ajo Deployments
    ├── Core instance
    ├── Members instance
    ├── Collateral instance
    ├── Payments instance
    ├── Governance instance
    └── Schedule instance
```

### Key Contract Functions

#### AjoFactory

```cairo
fn create_ajo(...) -> u256;
fn deploy_core(ref self: TContractState, ajo_id: u256) -> ContractAddress;
fn deploy_members(ref self: TContractState, ajo_id: u256) -> ContractAddress;
fn deploy_collateral_and_payments(...) -> (ContractAddress, ContractAddress);
fn deploy_governance_and_schedule(...) -> (ContractAddress, ContractAddress);
fn get_ajo_info(self: @TContractState, ajo_id: u256) -> AjoInfo;
fn get_user_ajos(self: @TContractState, user: ContractAddress) -> Span<u256>;
fn get_total_ajos(self: @TContractState) -> u256;
```

#### AjoCore

```cairo
fn initialize(...);
fn join_ajo(ref self: TContractState, token_index: u256);
fn start_ajo(ref self: TContractState);
fn process_payment(ref self: TContractState);
fn process_cycle(ref self: TContractState, cycle_number: u256);
fn handle_default(ref self: TContractState, defaulter: ContractAddress);
fn finalize_ajo(ref self: TContractState);
fn get_ajo_status(self: @TContractState) -> AjoStatus;
fn get_member_info(self: @TContractState, member: ContractAddress) -> MemberInfo;
```

#### AjoCollateral

```cairo
fn calculate_required_collateral(...) -> u256;
fn calculate_debt(...) -> u256;
fn deposit_collateral(ref self: TContractState, amount: u256);
fn withdraw_collateral(ref self: TContractState, amount: u256);
fn seize_collateral(ref self: TContractState, member: ContractAddress) -> u256;
fn calculate_recovery_assets(...) -> u256;
fn get_coverage_ratio(...) -> u256;
```

#### AjoPayments

```cairo
fn make_payment(ref self: TContractState, cycle: u256, amount: u256);
fn distribute_payout(ref self: TContractState, cycle: u256, recipient: ContractAddress);
fn start_cycle(ref self: TContractState, cycle_number: u256);
fn advance_cycle(ref self: TContractState);
fn get_current_cycle(self: @TContractState) -> u256;
fn get_cycle_contributions(self: @TContractState, cycle: u256) -> u256;
fn is_defaulted(self: @TContractState, member: ContractAddress) -> bool;
```

#### AjoGovernance

```cairo
fn create_proposal(... ) -> u256;
fn cast_vote(ref self: TContractState, proposal_id: u256, support: bool);
fn execute_proposal(ref self: TContractState, proposal_id: u256);
fn get_proposal_status(self: @TContractState, proposal_id: u256) -> ProposalStatus;
fn get_quorum(self: @TContractState) -> u256;
```

#### AjoSchedule

```cairo
fn schedule_task(...) -> u256;
fn execute_task(ref self: TContractState, task_id: u256);
fn schedule_cycle_payments(ref self: TContractState, cycle: u256, start_time: u64);
fn schedule_payout(
    ref self: TContractState,
    cycle: u256,
    recipient: ContractAddress,
    payout_time: u64,
);
```

---

## 🧪 Demo & Testing

### Automated Test Suites

```bash
cd ajo-save-cairo
snforge test
```

### Main Test Modules

- `tests/test_factory.cairo`
- `tests/test_core.cairo`
- `tests/test_members.cairo`
- `tests/test_collateral.cairo`
- `tests/test_payments.cairo`
- `tests/test_governance.cairo`
- `tests/test_schedule.cairo`
- `tests/test_access_control.cairo`
- `tests/integration/test_factory_deployment.cairo`
- `tests/integration/test_default_handling.cairo`
- `tests/integration/test_full_season.cairo`

### Demo Scripts

#### 1. Quick Test

```bash
cd ajo-save-cairo/starknet-scripts
npm run demo:quick
```

Demonstrates:

- factory connectivity
- basic Ajo creation flow
- contract stats and explorer links

#### 2. Full Lifecycle Demo

```bash
npm run demo:full
```

Demonstrates:

- Ajo setup
- participant join flow
- cycle payment progression
- payout lifecycle

#### 3. Governance Demo

```bash
npm run demo:governance
```

Demonstrates:

- proposal creation
- voting
- proposal status and execution flow

#### 4. Advanced Features Demo

```bash
npm run demo:advanced
```

Demonstrates:

- collateral/coverage views
- richer state inspection and feature validation

---

## 💰 Economic Model

### Collateral Requirements by Position

For a 10-member Ajo with $50 monthly contribution:

| Position | Debt at Payout | Required Collateral (60%) | Recovery Assets | Coverage |
|----------|----------------|---------------------------|-----------------|----------|
| 1 | $450 | $270 | $490 | 109% |
| 2 | $400 | $240 | $440 | 110% |
| 3 | $350 | $210 | $390 | 111% |
| 4 | $300 | $180 | $340 | 113% |
| 5 | $250 | $150 | $290 | 116% |
| 6 | $200 | $120 | $240 | 120% |
| 7 | $150 | $90 | $190 | 127% |
| 8 | $100 | $60 | $140 | 140% |
| 9 | $50 | $30 | $90 | 180% |
| 10 | $0 | $0 | $50 | ∞ |

**Total Collateral Required:** $1,350 (27% of total contributions)  
**Traditional Model:** $5,000+ (100%+ of total contributions)  
**Savings:** 73% reduction in capital requirements

### Cost Comparison: Ethereum vs Starknet (Illustrative)

**Scenario:** 10-member Ajo, 12 months, monthly operations

| Operation | Volume | Ethereum Cost | Starknet Cost | Savings |
|-----------|--------|---------------|---------------|---------|
| Token Transfers | 1,200/year | High L1 cost | Lower L2 cost | Major |
| Collateral Ops | recurring | High L1 approvals/transfers | Lower L2 ops | Major |
| Governance Votes | 50/year | Expensive L1 voting | Lower L2 voting | Major |
| Deployment | one-time + instances | Expensive contract deploys | Cheaper class hash model | Major |

**Break-Even Direction:** Starknet materially lowers recurring overhead, enabling low-contribution groups to stay viable.

### Revenue Model (Future)

1. **Protocol Fee:** small basis-point fee on successful payouts
2. **Premium Features:** automation tooling, analytics, risk scoring
3. **B2B Licensing:** white-label cooperatives and fintech rails

---

## 📚 Project Links (Resources)

### Documentation & Resources

- **Root README:** `README.md`
- **Cairo Module README:** `ajo-save-cairo/README.md`
- **Frontend README:** `frontend/README.md`
- **Deployment Script Guide:** `ajo-save-cairo/deploy-scripts/README.md`

### Live / Network References

- **Frontend Demo:** [https://ajo-save.vercel.app](https://ajo-save.vercel.app)
- **Voyager (Sepolia):** [https://sepolia.voyager.online](https://sepolia.voyager.online)
- **Starkscan (Sepolia):** [https://sepolia.starkscan.co](https://sepolia.starkscan.co)

### Social & Community

- **Twitter/X:** [@ajo_save](https://x.com/@ajo_save)

---

## 👥 Team

### Core Contributors

**Olaoluwa Marvellous** - Full Stack Developer & Smart Contract Engineer

- Role: Cairo architecture, protocol logic, Starknet integration

**Oluleye Emmanuel** - Frontend Developer

- Role: React app, wallet integration, UI/UX

---

## 🔒 Security Considerations

### Current Status

⚠️ **TESTNET ONLY** - This is a prototype. **DO NOT USE WITH REAL FUNDS.**

### Security Features Implemented

- ✅ Access control via ownership components
- ✅ Pause/unpause emergency controls
- ✅ Reentrancy protection component
- ✅ Input checks and bounded config constraints
- ✅ Modular contract isolation (factory + modules)

### Required Before Mainnet

- [ ] External professional audit
- [ ] Formal review of collateral/default economics
- [ ] Adversarial simulation (default cascades, griefing, governance attacks)
- [ ] Bug bounty program
- [ ] Production-grade monitoring + incident response playbooks

### Known Limitations

1. Testnet-focused deployment/config assumptions remain
2. Off-chain executor design for schedule tasks needs production hardening
3. Mainnet addresses/class hashes are not finalized in repo configs
4. Frontend still contains a few legacy utility remnants outside core Starknet flow

---

## 🎓 Learn More

### Starknet Developer Resources

- **Starknet Docs:** https://docs.starknet.io
- **Cairo Book:** https://book.cairo-lang.org
- **Scarb:** https://docs.swmansion.com/scarb
- **Starknet Foundry:** https://foundry-rs.github.io/starknet-foundry
- **OpenZeppelin Cairo:** https://github.com/OpenZeppelin/cairo-contracts

### ROSCA Research

- **"Rotating Savings and Credit Associations: A Literature Review"** - Anderson & Baland (2002)
- **"The Economics of Rotating Savings and Credit Associations"** - Besley et al. (1993)
- **African Traditional Finance:** https://www.africancenter.org/traditional-finance/

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Starknet / StarkWare ecosystem** for Cairo + STARK infrastructure
- **OpenZeppelin** for reusable Cairo security components
- **Traditional Ajo/Esusu communities** for the model inspiration
- **Contributors and testers** helping validate the Starknet migration

---

## 🐛 Bug Reports & Feature Requests

Found a bug? Have a feature request?

1. Check [existing issues](https://github.com/Deonorla/Ajo.Save/issues)
2. Create a new issue with:
   - clear title and description
   - reproducible steps
   - expected vs actual behavior
   - logs/screenshots and environment details

---

## 🚀 What's Next?

### Near-Term Roadmap

- [ ] Stabilize full deployment pipeline and environment templates
- [ ] Tighten schedule automation execution flow
- [ ] Complete docs cleanup across all markdown files
- [ ] Increase integration test realism (multi-account + time progression)
- [ ] Harden governance parameters and emergency controls

### Mainnet Readiness Roadmap

- [ ] Security audit and remediation cycle
- [ ] Mainnet deployment plan + migration guide
- [ ] Monitoring/alerting and operational runbooks
- [ ] Partner integrations for fiat on/off-ramp user journeys

---

**Built for African community finance, powered by Starknet**

*Modernizing trusted savings circles with programmable, transparent, low-cost infrastructure*

---

**Version:** 1.0.0-beta  
**Status:** Testnet Prototype  
**Network:** Starknet Sepolia
