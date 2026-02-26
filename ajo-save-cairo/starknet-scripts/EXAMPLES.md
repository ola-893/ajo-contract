# Examples

Practical code examples for using the Starknet Ajo Integration Testing Scripts.

## Table of Contents

- [Quick Start](#quick-start)
- [Custom Configuration](#custom-configuration)
- [Creating an Ajo](#creating-an-ajo)
- [Managing Participants](#managing-participants)
- [Processing Payments](#processing-payments)
- [Governance Operations](#governance-operations)
- [Querying Contract State](#querying-contract-state)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)

---

## Quick Start

### Running the Interactive Menu

```bash
cd starknet-scripts
npm install
npm start
```

Select a demo from the menu and follow the prompts.

### Running a Specific Demo

```bash
# Full lifecycle demo
npm start -- full-cycle

# Quick smoke test
npm start -- quick-test

# Governance features
npm start -- governance

# Advanced features
npm start -- advanced
```

---

## Custom Configuration

### Basic Setup

```javascript
import dotenv from 'dotenv';
import { initializeStarknet } from './utils/starknet.js';
import { CONTRACTS } from './config/contracts.js';

// Load environment variables
dotenv.config();

// Initialize Starknet connection
const { provider, account, config } = await initializeStarknet('sepolia');

console.log(`Connected to ${config.name}`);
console.log(`Account: ${account.address}`);
```

### Custom Network Configuration

```javascript
// Add custom network to config/networks.js
export const NETWORKS = {
  // ... existing networks
  custom: {
    name: "My Custom Network",
    rpcUrl: "https://my-rpc-endpoint.com",
    chainId: "CUSTOM_CHAIN_ID",
    explorer: "https://my-explorer.com"
  }
};

// Use custom network
const { provider, account } = await initializeStarknet('custom');
```

### Custom Test Parameters

```javascript
// Modify config/constants.js
export const TEST_CONFIG = {
  CYCLE_DURATION: 60, // 1 minute cycles for faster testing
  MONTHLY_PAYMENT_USDC: "25", // $25 per cycle
  TOTAL_PARTICIPANTS: 5, // Fewer participants for quick tests
  MAX_RETRIES: 5,
  RETRY_DELAY: 3000,
  TRANSACTION_TIMEOUT: 120000
};
```

---

## Creating an Ajo

### Simple Ajo Creation

```javascript
import { createAjo, getAjoInfo } from './core/factory.js';
import { CONTRACTS } from './config/contracts.js';

// Create Ajo
const { ajoId, receipt } = await createAjo(
  account,
  CONTRACTS.sepolia.factory,
  {
    name: "My Savings Group",
    owner: account.address,
    ...CONTRACTS.sepolia.classHashes
  }
);

console.log(`Ajo created with ID: ${ajoId}`);
console.log(`Transaction: ${receipt.transaction_hash}`);

// Get Ajo information
const factory = new Contract(
  FACTORY_ABI,
  CONTRACTS.sepolia.factory,
  provider
);

const ajoInfo = await getAjoInfo(factory, ajoId);
console.log('Contract addresses:', ajoInfo);
```

### Complete Ajo Setup

```javascript
import { setupAjo } from './core/ajo-lifecycle.js';
import { initializeAjo } from './core/ajo-lifecycle.js';

// Create and setup Ajo
const { ajoId, ajoInfo } = await setupAjo(
  account,
  CONTRACTS.sepolia.factory,
  {
    name: "Community Savings",
    owner: account.address,
    ...CONTRACTS.sepolia.classHashes
  }
);

// Initialize with parameters
await initializeAjo(account, ajoInfo.ajo_core, {
  cycle_duration: 2592000, // 30 days
  monthly_payment: parseUnits("100", 6), // $100 USDC
  token_address: CONTRACTS.sepolia.usdc
});

console.log(`Ajo ${ajoId} ready for participants!`);
```

---

## Managing Participants

### Setup Single Participant

```javascript
import { approveToken, checkAccountBalance } from './utils/tokens.js';
import { formatUSDC } from './utils/formatting.js';

// Check balance
const balance = await checkAccountBalance(
  participantAccount,
  CONTRACTS.sepolia.usdc
);

console.log(`Balance: ${formatUSDC(balance)} USDC`);

// Approve collateral contract
await approveToken(
  participantAccount,
  CONTRACTS.sepolia.usdc,
  ajoInfo.ajo_collateral,
  parseUnits("500", 6) // Approve $500
);

// Approve payments contract
await approveToken(
  participantAccount,
  CONTRACTS.sepolia.usdc,
  ajoInfo.ajo_payments,
  parseUnits("1000", 6) // Approve $1000
);

console.log('Approvals complete!');
```

### Join Ajo

```javascript
import { Contract } from 'starknet';
import { CORE_ABI } from './abis/index.js';

const core = new Contract(CORE_ABI, ajoInfo.ajo_core, participantAccount);

// Join with preferred position (0 = any position)
const call = core.populate('join_ajo', [0]);
const tx = await participantAccount.execute(call);
const receipt = await waitForTransaction(provider, tx.transaction_hash);

console.log('Joined Ajo successfully!');

// Get member info
const memberInfo = await core.get_member_info(participantAccount.address);
console.log(`Position: ${memberInfo.position}`);
console.log(`Collateral: ${formatUSDC(memberInfo.locked_collateral)} USDC`);
```

### Setup Multiple Participants

```javascript
import { setupParticipants, participantsJoinAjo } from './core/participants.js';
import { loadTestAccounts } from './utils/accounts.js';

// Load test accounts
const testAccounts = loadTestAccounts(provider, 10);

// Setup participants
const participants = await setupParticipants(
  testAccounts,
  CONTRACTS.sepolia.usdc,
  ajoInfo,
  { requiredBalance: parseUnits("200", 6) }
);

console.log(`${participants.length} participants ready`);

// All join Ajo
const results = await participantsJoinAjo(participants, ajoInfo.ajo_core);

const successful = results.filter(r => r.success).length;
console.log(`${successful}/${participants.length} joined successfully`);
```

---

## Processing Payments

### Single Payment

```javascript
import { processPayment } from './core/payments.js';

// Process payment for one participant
await processPayment(participantAccount, ajoInfo.ajo_core);

console.log('Payment processed!');
```

### Complete Payment Cycle

```javascript
import { processPaymentCycle } from './core/payments.js';

// Process payments from all participants
const results = await processPaymentCycle(
  participants,
  ajoInfo.ajo_core,
  ajoInfo.ajo_payments
);

const successful = results.filter(r => r.success).length;
console.log(`${successful}/${participants.length} payments processed`);
```

### Multiple Cycles

```javascript
import { sleep } from './utils/starknet.js';
import { TEST_CONFIG } from './config/constants.js';

// Run 3 payment cycles
for (let cycle = 1; cycle <= 3; cycle++) {
  console.log(`\n=== CYCLE ${cycle} ===\n`);
  
  // Process payments
  await processPaymentCycle(
    participants,
    ajoInfo.ajo_core,
    ajoInfo.ajo_payments
  );
  
  // Wait for next cycle
  if (cycle < 3) {
    console.log('Waiting for next cycle...');
    await sleep(TEST_CONFIG.CYCLE_DURATION * 1000);
  }
}

console.log('All cycles complete!');
```

### Query Payment Status

```javascript
const payments = new Contract(
  PAYMENTS_ABI,
  ajoInfo.ajo_payments,
  provider
);

// Get current cycle
const currentCycle = await payments.get_current_cycle();
console.log(`Current cycle: ${currentCycle}`);

// Get payout recipient
const recipient = await payments.get_payout_recipient(currentCycle);
console.log(`Cycle ${currentCycle} recipient: ${recipient}`);

// Get payment history
const history = await payments.get_payment_history(participantAddress);
console.log(`Payments made: ${history.length}`);
```

---

## Governance Operations

### Create Proposal

```javascript
import { createProposal } from './core/governance.js';

const { proposalId, receipt } = await createProposal(
  account,
  ajoInfo.ajo_governance,
  {
    title: "Increase Cycle Duration",
    description: "Proposal to change cycle duration from 30 to 60 days",
    proposal_type: 1, // Parameter change
    target: ajoInfo.ajo_core,
    calldata: [60 * 24 * 60 * 60] // 60 days in seconds
  }
);

console.log(`Proposal ${proposalId} created!`);
```

### Vote on Proposal

```javascript
import { submitVote } from './core/governance.js';

// Multiple members vote
for (const participant of participants) {
  await submitVote(
    participant.account,
    ajoInfo.ajo_governance,
    proposalId,
    true // Vote yes
  );
  
  console.log(`${participant.name} voted YES`);
}
```

### Execute Proposal

```javascript
import { executeProposal } from './core/governance.js';

// Check if proposal passed
const governance = new Contract(
  GOVERNANCE_ABI,
  ajoInfo.ajo_governance,
  provider
);

const proposal = await governance.get_proposal(proposalId);

if (proposal.status === 'Approved') {
  // Execute proposal
  await executeProposal(account, ajoInfo.ajo_governance, proposalId);
  console.log('Proposal executed!');
} else {
  console.log(`Proposal status: ${proposal.status}`);
}
```

---

## Querying Contract State

### Factory Statistics

```javascript
import { getFactoryStats } from './core/factory.js';

const factory = new Contract(
  FACTORY_ABI,
  CONTRACTS.sepolia.factory,
  provider
);

const stats = await getFactoryStats(factory);

console.log('Factory Statistics:');
console.log(`  Total Ajos Created: ${stats.totalCreated}`);
console.log(`  Active Ajos: ${stats.activeCount}`);
```

### Member Information

```javascript
const core = new Contract(CORE_ABI, ajoInfo.ajo_core, provider);

// Get all members
const memberCount = await core.get_member_count();
console.log(`Total members: ${memberCount}`);

// Get specific member info
const memberInfo = await core.get_member_info(memberAddress);

console.log('Member Info:');
console.log(`  Position: ${memberInfo.position}`);
console.log(`  Collateral: ${formatUSDC(memberInfo.locked_collateral)} USDC`);
console.log(`  Paid this cycle: ${memberInfo.has_paid_current_cycle}`);
console.log(`  Received payout: ${memberInfo.has_received_payout}`);
console.log(`  Active: ${memberInfo.is_active}`);
```

### Collateral Information

```javascript
const collateral = new Contract(
  COLLATERAL_ABI,
  ajoInfo.ajo_collateral,
  provider
);

// Get collateral requirement
const required = await collateral.get_collateral_requirement(memberAddress);
console.log(`Required collateral: ${formatUSDC(required)} USDC`);

// Get total locked collateral
const totalLocked = await collateral.get_total_locked_collateral();
console.log(`Total locked: ${formatUSDC(totalLocked)} USDC`);
```

---

## Error Handling

### Basic Error Handling

```javascript
import { formatError } from './utils/errors.js';

try {
  await riskyOperation();
} catch (error) {
  formatError(error, 'Operation description');
  // Continue or exit based on error severity
}
```

### Retry Logic

```javascript
import { retryWithBackoff } from './utils/retry.js';

const result = await retryWithBackoff(
  async () => {
    // Operation that might fail due to network issues
    return await contract.someMethod();
  },
  'Contract method call',
  3, // max retries
  2000 // base delay in ms
);
```

### Transaction Error Handling

```javascript
import { handleTransactionFailure } from './utils/errors.js';

try {
  const tx = await account.execute(call);
  const receipt = await waitForTransaction(provider, tx.transaction_hash);
  
  if (receipt.status === 'REJECTED') {
    throw new Error('Transaction rejected');
  }
  
  console.log('Transaction successful!');
} catch (error) {
  handleTransactionFailure(tx.transaction_hash, error, 'Payment processing');
}
```

### Graceful Degradation

```javascript
import { withErrorHandling } from './utils/errors.js';

// Continue even if operation fails
const result = await withErrorHandling(
  async () => await optionalOperation(),
  'Optional operation',
  { silent: false, throwOnError: false }
);

if (result) {
  console.log('Operation succeeded');
} else {
  console.log('Operation failed, continuing anyway');
}
```

---

## Advanced Usage

### Batch Operations

```javascript
// Process multiple operations in parallel
const operations = participants.map(p => 
  processPayment(p.account, ajoInfo.ajo_core)
);

const results = await Promise.allSettled(operations);

const successful = results.filter(r => r.status === 'fulfilled').length;
console.log(`${successful}/${participants.length} payments processed`);
```

### Custom Demo Script

```javascript
// my-custom-demo.js
import dotenv from 'dotenv';
import { initializeStarknet } from './utils/starknet.js';
import { printBanner, colors } from './utils/formatting.js';
import { setupAjo } from './core/ajo-lifecycle.js';
import { CONTRACTS } from './config/contracts.js';

dotenv.config();

export async function runMyCustomDemo() {
  printBanner("MY CUSTOM DEMO");
  
  // Initialize
  const { provider, account } = await initializeStarknet();
  
  // Your custom logic here
  console.log(colors.cyan('Starting custom operations...'));
  
  // Create Ajo
  const { ajoId, ajoInfo } = await setupAjo(
    account,
    CONTRACTS.sepolia.factory,
    {
      name: "Custom Ajo",
      owner: account.address,
      ...CONTRACTS.sepolia.classHashes
    }
  );
  
  // More custom operations...
  
  console.log(colors.green('✅ Custom demo complete!'));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMyCustomDemo().catch(console.error);
}
```

### Integration with Your Code

```javascript
// your-app.js
import { initializeStarknet } from './starknet-scripts/utils/starknet.js';
import { createAjo } from './starknet-scripts/core/factory.js';
import { CONTRACTS } from './starknet-scripts/config/contracts.js';

async function createSavingsGroup(groupName, ownerAddress) {
  const { account } = await initializeStarknet();
  
  const { ajoId, receipt } = await createAjo(
    account,
    CONTRACTS.sepolia.factory,
    {
      name: groupName,
      owner: ownerAddress,
      ...CONTRACTS.sepolia.classHashes
    }
  );
  
  return {
    id: ajoId.toString(),
    transactionHash: receipt.transaction_hash
  };
}

// Use in your application
const group = await createSavingsGroup("My Group", userAddress);
console.log(`Created group ${group.id}`);
```

### Event Monitoring

```javascript
import { Contract } from 'starknet';

// Monitor events from a contract
const core = new Contract(CORE_ABI, ajoInfo.ajo_core, provider);

// Get events from recent blocks
const events = await provider.getEvents({
  address: ajoInfo.ajo_core,
  from_block: { block_number: startBlock },
  to_block: 'latest',
  keys: [['MemberJoined', 'PaymentProcessed']]
});

console.log(`Found ${events.events.length} events`);

events.events.forEach(event => {
  console.log(`Event: ${event.keys[0]}`);
  console.log(`Data:`, event.data);
});
```

### Performance Monitoring

```javascript
// Track operation timing
const startTime = Date.now();

await someOperation();

const duration = Date.now() - startTime;
console.log(`Operation took ${duration}ms`);

// Track gas usage
const tx = await account.execute(call);
const receipt = await waitForTransaction(provider, tx.transaction_hash);

console.log(`Gas used: ${receipt.actual_fee}`);
```

---

## Testing Tips

1. **Start with quick-test**: Verify basic functionality before running full demos
2. **Use small cycle durations**: Set to 30-60 seconds for faster testing
3. **Limit participants**: Start with 3-5 participants for quicker tests
4. **Check balances first**: Ensure accounts have sufficient STRK and USDC
5. **Monitor transactions**: Use Voyager explorer to track transaction status
6. **Enable debug mode**: Set `DEBUG=true` for detailed error information
7. **Test incrementally**: Test each phase separately before running full cycle

---

## Common Patterns

### Safe Transaction Execution

```javascript
async function safeExecute(account, call, context) {
  try {
    const tx = await account.execute(call);
    console.log(`Transaction sent: ${tx.transaction_hash}`);
    
    const receipt = await waitForTransaction(
      account.provider,
      tx.transaction_hash,
      120000 // 2 minute timeout
    );
    
    if (receipt.status !== 'ACCEPTED_ON_L2') {
      throw new Error(`Transaction failed: ${receipt.status}`);
    }
    
    console.log('Transaction confirmed!');
    return receipt;
  } catch (error) {
    handleTransactionFailure(tx?.transaction_hash, error, context);
    throw error;
  }
}
```

### Balance Verification

```javascript
async function ensureSufficientBalance(account, tokenAddress, required) {
  const balance = await checkAccountBalance(account, tokenAddress);
  
  if (balance < required) {
    throw new Error(
      `Insufficient balance: ${formatUSDC(balance)} < ${formatUSDC(required)}`
    );
  }
  
  return balance;
}
```

### Progress Tracking

```javascript
async function processWithProgress(items, operation, label) {
  const results = [];
  
  for (let i = 0; i < items.length; i++) {
    console.log(`[${i + 1}/${items.length}] ${label}...`);
    
    try {
      const result = await operation(items[i]);
      results.push({ success: true, result });
      console.log('✅ Success');
    } catch (error) {
      results.push({ success: false, error });
      console.log('❌ Failed:', error.message);
    }
  }
  
  return results;
}
```

---

For more information, see:
- [API Documentation](./API.md)
- [Configuration Guide](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
