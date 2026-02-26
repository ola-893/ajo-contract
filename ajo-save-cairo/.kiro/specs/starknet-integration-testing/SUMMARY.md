# Starknet Integration Testing Scripts - Specification Summary

## Overview

This specification defines the implementation of comprehensive integration testing scripts for the Ajo.Save Cairo contracts deployed on Starknet Sepolia. The scripts will replicate the functionality of the existing Hedera simulation scripts (`scripts/Ajo_simulation/`) but adapted for Starknet's architecture.

## Key Information

- **Spec Location**: `.kiro/specs/starknet-integration-testing/`
- **Implementation Location**: `starknet-scripts/`
- **Reference Scripts**: `scripts/Ajo_simulation/demo.cjs` and related files
- **Estimated Effort**: 11-15 hours
- **Complexity**: Medium-High (requires Starknet.js expertise)

## Deployed Contracts (Starknet Sepolia)

- **Factory**: `0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c`
- **USDC Token**: `0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343`
- **Network**: Starknet Sepolia Testnet

## Scope

### In Scope
1. ✅ Factory contract interactions (create Ajo, get stats)
2. ✅ Ajo lifecycle management (creation, initialization, verification)
3. ✅ Multi-participant simulation (10+ test accounts)
4. ✅ Payment cycle processing (monthly payments, payouts)
5. ✅ Governance operations (proposals, voting, execution)
6. ✅ Collateral management (calculations, defaults, seizure)
7. ✅ Comprehensive view functions (all contract queries)
8. ✅ Error handling and retry logic
9. ✅ Formatted console output (colors, tables, banners)
10. ✅ Configuration management (env variables, networks)

### Out of Scope
- ❌ Mainnet deployment and testing
- ❌ Automated test suite (Jest/Mocha)
- ❌ Frontend integration
- ❌ Performance benchmarking
- ❌ Gas optimization analysis

## Architecture

```
starknet-scripts/
├── config/              # Network configs, contract addresses, constants
├── utils/               # Starknet connection, formatting, retry logic, tokens
├── core/                # Factory, lifecycle, participants, payments, governance
├── demos/               # Full cycle, quick test, governance, advanced features
└── abis/                # Contract ABIs
```

## Implementation Phases

### Phase 1: Project Setup & Core Utilities (2-3 hours)
- Project structure creation
- Configuration files (networks, contracts, constants)
- Utility functions (Starknet.js, formatting, retry, accounts, tokens)
- Helper utilities (sleep, transaction waiting, event parsing)

### Phase 2: Factory & Ajo Lifecycle (2-3 hours)
- Factory operations (create, get stats, get Ajo info)
- Ajo lifecycle (setup, verification, display)
- Basic demo script (quick test)

### Phase 3: Participant Management (2-3 hours)
- Participant setup (balance check, token approval)
- Joining functionality (join Ajo, get member info)
- Member queries (all members, positions, collateral)
- Participant demo script

### Phase 4: Payment Cycles (2-3 hours)
- Payment operations (process payment, distribute payout)
- Cycle management (get cycle, advance cycle)
- Payment queries (history, recipient, totals)
- Multi-cycle demo script

### Phase 5: Advanced Features (3-4 hours)
- Governance operations (proposals, voting, execution)
- Collateral operations (calculate, simulate default, seize)
- Comprehensive view functions
- Advanced demo scripts

### Phase 6: Full Integration & Testing (2 hours)
- Main demo script (full lifecycle)
- CLI interface (command-line arguments, menu)
- Testing and validation
- Error handling improvements

### Phase 7: Documentation (2 hours)
- README.md (overview, setup, usage)
- CONFIGURATION.md (env variables, networks)
- API.md (function documentation)
- EXAMPLES.md (code examples)
- TROUBLESHOOTING.md (common issues, solutions)

## Key Features

### 1. Starknet.js Integration
- RpcProvider for network connection
- Account management for transactions
- Contract interactions (calls and invokes)
- Transaction confirmation handling

### 2. Multi-Account Support
- Load test accounts from environment
- Balance checking and validation
- Token approval management
- Concurrent transaction handling

### 3. Formatted Output
- Colored console output (green/red/blue/yellow)
- Progress indicators and status updates
- Formatted tables for data display
- Summary reports and banners

### 4. Error Handling
- Exponential backoff retry logic
- Network error detection and recovery
- Clear error messages with context
- Transaction failure handling

### 5. Configuration Management
- Environment variable support
- Network switching (testnet/mainnet)
- Customizable test parameters
- Deployment address persistence

## Technical Stack

- **Language**: JavaScript (ES6+)
- **Runtime**: Node.js v18+
- **Main Library**: starknet.js v6.11.0
- **Utilities**: dotenv, chalk (colors), commander (CLI)
- **Optional**: inquirer (interactive prompts)

## Success Criteria

- ✅ All 8 user stories implemented
- ✅ Scripts successfully complete full Ajo lifecycle
- ✅ Clear and informative console output
- ✅ Error rate < 5% on stable network
- ✅ Documentation covers all use cases
- ✅ Code is modular and maintainable

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| RPC rate limiting | Implement delays, use multiple RPCs |
| Transaction failures | Retry logic, better error handling |
| Account funding | Clear instructions, faucet links |
| Network instability | Exponential backoff, timeout handling |

## Next Steps

1. **Review Specification**: Ensure all requirements are clear
2. **Setup Environment**: Install dependencies, configure accounts
3. **Start Phase 1**: Create project structure and utilities
4. **Iterate Through Phases**: Complete each phase sequentially
5. **Test Thoroughly**: Validate all operations on Sepolia
6. **Document**: Create comprehensive documentation

## Resources

- **Requirements**: [requirements.md](./requirements.md)
- **Design**: [design.md](./design.md)
- **Tasks**: [tasks.md](./tasks.md)
- **Hedera Reference**: `scripts/Ajo_simulation/demo.cjs`
- **Starknet.js Docs**: https://www.starknetjs.com/
- **Cairo Contracts**: `ajo-save-cairo/src/`

## Questions to Address

1. **Account Funding**: How will test accounts be funded with USDC?
   - *Answer*: Manual funding from Circle faucet or deployer distribution

2. **RPC Provider**: Which RPC should be primary?
   - *Answer*: Alchemy (configured), with fallback to public RPCs

3. **Test Data**: Should we persist test results?
   - *Answer*: Optional enhancement, save deployment info to JSON

4. **Parallel Execution**: Should operations run in parallel?
   - *Answer*: Where safe (independent operations), yes

5. **Interactive Mode**: Should there be a CLI menu?
   - *Answer*: Optional enhancement, start with command-line args

## Approval Checklist

- [x] Requirements documented and clear
- [x] Design architecture defined
- [x] Tasks broken down into phases
- [x] Success criteria established
- [x] Risks identified and mitigated
- [x] Timeline estimated
- [ ] Stakeholder approval received
- [ ] Ready to begin implementation

---

**Status**: ✅ Specification Complete - Ready for Implementation

**Created**: February 26, 2026
**Last Updated**: February 26, 2026
