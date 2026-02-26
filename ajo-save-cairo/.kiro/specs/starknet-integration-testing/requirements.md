# Starknet Integration Testing Scripts - Requirements

## Overview
Create comprehensive integration testing scripts for the deployed Ajo Cairo contracts on Starknet Sepolia, similar to the Hedera simulation scripts but adapted for Starknet's architecture and tooling.

## Context
- **Deployed Factory**: `0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c`
- **Network**: Starknet Sepolia Testnet
- **USDC Token**: `0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343` (Circle USDC)
- **Reference**: Hedera scripts in `scripts/Ajo_simulation/` folder
- **Technology Stack**: Node.js + starknet.js library

## User Stories

### 1. As a developer, I want to test the complete Ajo lifecycle on Starknet
**Acceptance Criteria:**
- 1.1 Script can create a new Ajo group via the factory
- 1.2 Script can configure Ajo parameters (cycle duration, payment amounts)
- 1.3 Script verifies all contract deployments and initializations
- 1.4 Script provides clear console output with status indicators
- 1.5 Script handles Starknet transaction confirmation delays

### 2. As a developer, I want to simulate multiple participants joining an Ajo
**Acceptance Criteria:**
- 2.1 Script can generate or use multiple test accounts
- 2.2 Script can fund accounts with USDC tokens
- 2.3 Script can approve USDC spending for collateral and payments
- 2.4 Script can execute joinAjo for each participant
- 2.5 Script verifies collateral calculations for each position
- 2.6 Script displays participant status in a formatted table

### 3. As a developer, I want to test the payment cycle workflow
**Acceptance Criteria:**
- 3.1 Script can process monthly payments from all participants
- 3.2 Script can trigger payout distribution
- 3.3 Script can advance to the next cycle
- 3.4 Script verifies payment amounts and balances
- 3.5 Script tracks cycle progression and completion
- 3.6 Script can run multiple cycles sequentially

### 4. As a developer, I want to test governance features
**Acceptance Criteria:**
- 4.1 Script can create governance proposals
- 4.2 Script can submit votes from multiple members
- 4.3 Script can tally votes and execute proposals
- 4.4 Script verifies voting power calculations
- 4.5 Script tests proposal status transitions

### 5. As a developer, I want to test collateral and default scenarios
**Acceptance Criteria:**
- 5.1 Script can simulate a member default
- 5.2 Script can trigger collateral seizure
- 5.3 Script verifies guarantor liability distribution
- 5.4 Script tests asset recovery mechanisms
- 5.5 Script validates collateral recalculations

### 6. As a developer, I want comprehensive view function testing
**Acceptance Criteria:**
- 6.1 Script can query and display factory statistics
- 6.2 Script can retrieve and format Ajo group information
- 6.3 Script can display member details and positions
- 6.4 Script can show payment history and cycle data
- 6.5 Script can query collateral requirements
- 6.6 Script provides formatted output for all view functions

### 7. As a developer, I want error handling and retry logic
**Acceptance Criteria:**
- 7.1 Script handles Starknet RPC errors gracefully
- 7.2 Script implements exponential backoff for retries
- 7.3 Script provides clear error messages
- 7.4 Script can recover from network interruptions
- 7.5 Script logs failed operations for debugging

### 8. As a developer, I want configuration management
**Acceptance Criteria:**
- 8.1 Script reads configuration from environment variables
- 8.2 Script supports different networks (testnet/mainnet)
- 8.3 Script allows customizable test parameters
- 8.4 Script can save deployment addresses
- 8.5 Script can load and reuse existing deployments

## Technical Requirements

### TR-1: Starknet.js Integration
- Use starknet.js v6.11.0 or compatible
- Support both Account and RpcProvider
- Handle Cairo 1.0 contract interactions
- Implement proper transaction waiting and confirmation

### TR-2: Account Management
- Support multiple test accounts
- Secure private key handling (env variables)
- Account balance checking and funding
- Nonce management for concurrent transactions

### TR-3: Token Operations
- ERC20 approve/transfer operations
- Balance queries and verification
- Support for 6-decimal USDC
- Token allowance management

### TR-4: Contract Interactions
- Factory contract calls (create_ajo, get_ajo, etc.)
- Core contract calls (join_ajo, process_payment, etc.)
- Members contract queries
- Collateral contract operations
- Payments contract interactions
- Governance contract operations

### TR-5: Output Formatting
- Colored console output (similar to Hedera scripts)
- Progress indicators and status updates
- Formatted tables for data display
- Summary reports after each phase
- Transaction hash and explorer links

### TR-6: Testing Utilities
- Sleep/delay functions for transaction confirmation
- Retry logic with configurable attempts
- Balance formatting helpers
- Address formatting utilities
- Event parsing and display

## Non-Functional Requirements

### NFR-1: Performance
- Scripts should complete within reasonable time (< 10 minutes for full cycle)
- Efficient RPC usage to avoid rate limiting
- Parallel operations where possible

### NFR-2: Reliability
- Handle network failures gracefully
- Retry failed transactions automatically
- Validate all operations before proceeding
- Provide rollback guidance on failures

### NFR-3: Usability
- Clear documentation and usage instructions
- Helpful error messages
- Progress indicators for long operations
- Easy configuration via environment variables

### NFR-4: Maintainability
- Modular code structure
- Reusable utility functions
- Clear separation of concerns
- Comprehensive inline comments

## Out of Scope
- Mainnet deployment and testing
- Automated test suite (unit tests)
- Frontend integration
- Performance benchmarking
- Gas optimization analysis
- Multi-network deployment scripts

## Dependencies
- Node.js v18+
- starknet.js library
- Deployed Ajo contracts on Sepolia
- Test accounts with STRK for gas
- USDC tokens for testing

## Success Metrics
- All user stories have working scripts
- Scripts successfully complete full Ajo lifecycle
- Clear and informative console output
- Error rate < 5% on stable network
- Documentation covers all use cases

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RPC rate limiting | High | Implement delays, use multiple RPCs |
| Transaction failures | Medium | Retry logic, better error handling |
| Account funding issues | Medium | Clear funding instructions, faucet links |
| Contract interface changes | Low | Version pinning, interface validation |
| Network instability | Medium | Exponential backoff, timeout handling |

## Timeline Estimate
- Phase 1 (Basic Setup & Factory): 2-3 hours
- Phase 2 (Participant Management): 2-3 hours
- Phase 3 (Payment Cycles): 2-3 hours
- Phase 4 (Advanced Features): 3-4 hours
- Phase 5 (Testing & Documentation): 2 hours

**Total**: 11-15 hours of development time

## References
- Hedera scripts: `scripts/Ajo_simulation/demo.cjs`
- Starknet.js docs: https://www.starknetjs.com/
- Cairo contracts: `ajo-save-cairo/src/`
- Deployment info: `ajo-save-cairo/SUCCESSFUL_DEPLOYMENT.md`
