# Starknet Integration Testing Scripts - Design Document

## Architecture Overview

The testing scripts will follow a modular architecture similar to the Hedera scripts but adapted for Starknet's unique characteristics:

```
starknet-scripts/
├── config/
│   ├── networks.js          # Network configurations
│   ├── contracts.js          # Contract addresses and ABIs
│   └── constants.js          # Test parameters and constants
├── utils/
│   ├── starknet.js          # Starknet connection utilities
│   ├── accounts.js          # Account management
│   ├── formatting.js        # Console output formatting
│   ├── retry.js             # Retry logic and error handling
│   └── tokens.js            # ERC20 token operations
├── core/
│   ├── factory.js           # Factory contract interactions
│   ├── ajo-lifecycle.js     # Ajo creation and management
│   ├── participants.js      # Participant setup and management
│   ├── payments.js          # Payment cycle operations
│   ├── governance.js        # Governance operations
│   └── collateral.js        # Collateral and default handling
├── demos/
│   ├── full-cycle.js        # Complete Ajo lifecycle demo
│   ├── quick-test.js        # Quick smoke test
│   ├── governance-demo.js   # Governance features demo
│   └── advanced-features.js # Advanced features showcase
└── index.js                 # Main entry point
```

## Component Design

### 1. Configuration Management (`config/`)

#### networks.js
```javascript
export const NETWORKS = {
  sepolia: {
    name: "Starknet Sepolia",
    rpcUrl: process.env.STARKNET_RPC || "https://starknet-sepolia.g.alchemy.com/v2/...",
    chainId: "SN_SEPOLIA",
    explorer: "https://sepolia.voyager.online"
  },
  mainnet: {
    name: "Starknet Mainnet",
    rpcUrl: process.env.STARKNET_MAINNET_RPC,
    chainId: "SN_MAIN",
    explorer: "https://voyager.online"
  }
};
```

#### contracts.js
```javascript
export const CONTRACTS = {
  sepolia: {
    factory: "0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c",
    usdc: "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343",
    // Class hashes for deployed contracts
    classHashes: {
      core: "0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe",
      members: "0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e",
      // ... other class hashes
    }
  }
};
```

#### constants.js
```javascript
export const TEST_CONFIG = {
  CYCLE_DURATION: 30, // seconds for testing
  MONTHLY_PAYMENT_USDC: "50", // $50 USDC
  TOTAL_PARTICIPANTS: 10,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  TRANSACTION_TIMEOUT: 60000,
  GAS_MULTIPLIER: 1.5
};
```

### 2. Utility Functions (`utils/`)

#### starknet.js
```javascript
/**
 * Initialize Starknet provider and account
 */
export async function initializeStarknet(network = 'sepolia') {
  const config = NETWORKS[network];
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  
  const account = new Account(
    provider,
    process.env.STARKNET_ACCOUNT_ADDRESS,
    process.env.STARKNET_PRIVATE_KEY
  );
  
  return { provider, account, config };
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(provider, txHash, timeout = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt.status === 'ACCEPTED_ON_L2' || receipt.status === 'ACCEPTED_ON_L1') {
        return receipt;
      }
    } catch (error) {
      // Transaction not yet available
    }
    await sleep(2000);
  }
  
  throw new Error(`Transaction ${txHash} timeout after ${timeout}ms`);
}
```

#### accounts.js
```javascript
/**
 * Load test accounts from environment
 */
export function loadTestAccounts(provider, count = 10) {
  const accounts = [];
  
  for (let i = 1; i <= count; i++) {
    const address = process.env[`TEST_ACCOUNT_${i}_ADDRESS`];
    const privateKey = process.env[`TEST_ACCOUNT_${i}_PRIVATE_KEY`];
    
    if (address && privateKey) {
      accounts.push(new Account(provider, address, privateKey));
    }
  }
  
  return accounts;
}

/**
 * Check account balance
 */
export async function checkAccountBalance(account, tokenAddress) {
  const erc20 = new Contract(ERC20_ABI, tokenAddress, account);
  const balance = await erc20.balanceOf(account.address);
  return balance;
}
```

#### formatting.js
```javascript
/**
 * Color utilities for console output
 */
export const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
  bright: (text) => `\x1b[1m${text}\x1b[0m`
};

/**
 * Format USDC amount (6 decimals)
 */
export function formatUSDC(amount) {
  return (Number(amount) / 1e6).toFixed(2);
}

/**
 * Print formatted table
 */
export function printTable(headers, rows) {
  // Implementation for formatted table output
}

/**
 * Print banner
 */
export function printBanner(title) {
  console.log(colors.magenta("\n" + "═".repeat(88)));
  console.log(colors.cyan(`║${title.padStart(44 + title.length/2).padEnd(86)}║`));
  console.log(colors.magenta("═".repeat(88) + "\n"));
}
```

#### retry.js
```javascript
/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff(
  operation,
  operationName,
  maxRetries = 3,
  baseDelay = 2000
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(colors.dim(`  ⏳ Attempt ${attempt}/${maxRetries}: ${operationName}`));
      const result = await operation();
      console.log(colors.green(`  ✅ ${operationName} succeeded`));
      return result;
    } catch (error) {
      const isNetworkError = 
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('502') ||
        error.message.includes('ECONNRESET');
      
      if (isNetworkError && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(colors.yellow(`  ⚠️ Network error: ${error.message.slice(0, 100)}`));
        console.log(colors.dim(`  🔄 Retrying in ${delay/1000}s...`));
        await sleep(delay);
        continue;
      }
      
      console.log(colors.red(`  ❌ ${operationName} failed: ${error.message}`));
      throw error;
    }
  }
}
```

#### tokens.js
```javascript
/**
 * Approve token spending
 */
export async function approveToken(account, tokenAddress, spenderAddress, amount) {
  const erc20 = new Contract(ERC20_ABI, tokenAddress, account);
  
  const call = erc20.populate('approve', [spenderAddress, amount]);
  const tx = await account.execute(call);
  
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Transfer tokens
 */
export async function transferToken(account, tokenAddress, recipientAddress, amount) {
  const erc20 = new Contract(ERC20_ABI, tokenAddress, account);
  
  const call = erc20.populate('transfer', [recipientAddress, amount]);
  const tx = await account.execute(call);
  
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Check token allowance
 */
export async function checkAllowance(account, tokenAddress, spenderAddress) {
  const erc20 = new Contract(ERC20_ABI, tokenAddress, account);
  return await erc20.allowance(account.address, spenderAddress);
}
```

### 3. Core Operations (`core/`)

#### factory.js
```javascript
/**
 * Get factory statistics
 */
export async function getFactoryStats(factoryContract) {
  const stats = await factoryContract.get_factory_stats();
  return {
    totalCreated: stats.total_created,
    activeCount: stats.active_count
  };
}

/**
 * Create new Ajo group
 */
export async function createAjo(account, factoryAddress, config) {
  const factory = new Contract(FACTORY_ABI, factoryAddress, account);
  
  const call = factory.populate('create_ajo', [
    config.name,
    config.owner,
    config.core_class_hash,
    config.members_class_hash,
    config.collateral_class_hash,
    config.payments_class_hash,
    config.governance_class_hash,
    config.schedule_class_hash
  ]);
  
  const tx = await account.execute(call);
  const receipt = await waitForTransaction(account.provider, tx.transaction_hash);
  
  // Parse events to get Ajo ID
  const ajoId = parseAjoCreatedEvent(receipt);
  
  return { ajoId, receipt };
}

/**
 * Get Ajo information
 */
export async function getAjoInfo(factoryContract, ajoId) {
  return await factoryContract.get_ajo(ajoId);
}
```

#### ajo-lifecycle.js
```javascript
/**
 * Complete Ajo setup workflow
 */
export async function setupAjo(account, factoryAddress, config) {
  printBanner("AJO CREATION & SETUP");
  
  // Step 1: Create Ajo
  console.log(colors.cyan("  📋 Step 1: Creating Ajo..."));
  const { ajoId } = await createAjo(account, factoryAddress, config);
  console.log(colors.green(`  ✅ Ajo created with ID: ${ajoId}\n`));
  
  await sleep(2000);
  
  // Step 2: Verify deployment
  console.log(colors.cyan("  📋 Step 2: Verifying deployment..."));
  const ajoInfo = await getAjoInfo(factoryContract, ajoId);
  console.log(colors.green(`  ✅ Ajo contracts deployed\n`));
  
  // Display contract addresses
  console.log(colors.dim("  Contract Addresses:"));
  console.log(colors.dim(`    Core:       ${ajoInfo.ajo_core}`));
  console.log(colors.dim(`    Members:    ${ajoInfo.ajo_members}`));
  console.log(colors.dim(`    Collateral: ${ajoInfo.ajo_collateral}`));
  console.log(colors.dim(`    Payments:   ${ajoInfo.ajo_payments}`));
  console.log(colors.dim(`    Governance: ${ajoInfo.ajo_governance}`));
  console.log(colors.dim(`    Schedule:   ${ajoInfo.ajo_schedule}\n`));
  
  return { ajoId, ajoInfo };
}
```

#### participants.js
```javascript
/**
 * Setup participants with tokens and approvals
 */
export async function setupParticipants(accounts, usdcAddress, ajoInfo, config) {
  printBanner("PARTICIPANT SETUP");
  
  const participants = [];
  const names = ["Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", 
                 "Funmilayo", "Gbenga", "Halima", "Ifeanyi", "Joke"];
  
  console.log(colors.cyan(`  🎯 Setting up ${accounts.length} participants\n`));
  
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const name = names[i];
    
    try {
      console.log(colors.dim(`  👤 ${name}...`));
      
      // Check USDC balance
      const balance = await checkAccountBalance(account, usdcAddress);
      console.log(colors.dim(`     Balance: ${formatUSDC(balance)} USDC`));
      
      if (balance < config.requiredBalance) {
        console.log(colors.yellow(`     ⚠️ Insufficient balance, skipping`));
        continue;
      }
      
      // Approve collateral contract
      await approveToken(
        account,
        usdcAddress,
        ajoInfo.ajo_collateral,
        balance / 2n
      );
      console.log(colors.dim(`     ✓ Collateral approved`));
      
      // Approve payments contract
      await approveToken(
        account,
        usdcAddress,
        ajoInfo.ajo_payments,
        balance / 2n
      );
      console.log(colors.dim(`     ✓ Payments approved`));
      
      participants.push({
        account,
        name,
        address: account.address,
        position: i + 1
      });
      
      console.log(colors.green(`     ✅ ${name} ready\n`));
      
    } catch (error) {
      console.log(colors.red(`     ❌ Setup failed: ${error.message}\n`));
    }
    
    await sleep(1000);
  }
  
  console.log(colors.green(`  ✅ ${participants.length} participants ready\n`));
  return participants;
}

/**
 * Participants join Ajo
 */
export async function participantsJoinAjo(participants, coreAddress) {
  printBanner("MEMBER JOINING");
  
  const joinResults = [];
  
  console.log(colors.dim("  ┌────┬─────────────┬──────────────┬─────────────────┬──────────────┐"));
  console.log(colors.dim("  │ #  │ Name        │ Position     │ Collateral Req. │ Status       │"));
  console.log(colors.dim("  ├────┼─────────────┼──────────────┼─────────────────┼──────────────┤"));
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      const core = new Contract(CORE_ABI, coreAddress, participant.account);
      
      const call = core.populate('join_ajo', [0]); // preferred_position = 0 (any)
      const tx = await participant.account.execute(call);
      await waitForTransaction(participant.account.provider, tx.transaction_hash);
      
      // Get member info
      const memberInfo = await core.get_member_info(participant.address);
      const collateral = memberInfo.locked_collateral;
      
      joinResults.push({
        name: participant.name,
        position: memberInfo.position,
        collateral,
        success: true
      });
      
      const status = colors.green("✅ Joined");
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `${memberInfo.position.toString().padEnd(12)} │ ${formatUSDC(collateral).padEnd(15)} │ ${status.padEnd(20)} │`
      ));
      
    } catch (error) {
      joinResults.push({
        name: participant.name,
        error: error.message,
        success: false
      });
      
      const status = colors.red("❌ Failed");
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `${'N/A'.padEnd(12)} │ ${'N/A'.padEnd(15)} │ ${status.padEnd(20)} │`
      ));
    }
    
    await sleep(2000);
  }
  
  console.log(colors.dim("  └────┴─────────────┴──────────────┴─────────────────┴──────────────┘\n"));
  
  const successful = joinResults.filter(r => r.success).length;
  console.log(colors.green(`  ✅ ${successful}/${participants.length} participants joined\n`));
  
  return joinResults;
}
```

#### payments.js
```javascript
/**
 * Process payment cycle
 */
export async function processPaymentCycle(participants, coreAddress, paymentsAddress) {
  printBanner("PAYMENT CYCLE");
  
  // Phase 1: Monthly payments
  console.log(colors.cyan("  📋 Phase 1: Monthly Payments\n"));
  
  const paymentResults = [];
  
  for (const participant of participants) {
    try {
      console.log(colors.dim(`    ${participant.name} making payment...`));
      
      const core = new Contract(CORE_ABI, coreAddress, participant.account);
      const call = core.populate('process_payment', []);
      const tx = await participant.account.execute(call);
      await waitForTransaction(participant.account.provider, tx.transaction_hash);
      
      paymentResults.push({ name: participant.name, success: true });
      console.log(colors.green(`    ✅ Payment processed\n`));
      
    } catch (error) {
      paymentResults.push({ name: participant.name, success: false, error: error.message });
      console.log(colors.red(`    ❌ Payment failed: ${error.message}\n`));
    }
    
    await sleep(1500);
  }
  
  // Phase 2: Payout distribution
  console.log(colors.cyan("  📋 Phase 2: Payout Distribution\n"));
  
  try {
    const payments = new Contract(PAYMENTS_ABI, paymentsAddress, participants[0].account);
    const call = payments.populate('distribute_payout', []);
    const tx = await participants[0].account.execute(call);
    await waitForTransaction(participants[0].account.provider, tx.transaction_hash);
    
    console.log(colors.green(`    ✅ Payout distributed\n`));
    
  } catch (error) {
    console.log(colors.red(`    ❌ Payout failed: ${error.message}\n`));
  }
  
  const successful = paymentResults.filter(r => r.success).length;
  console.log(colors.green(`  ✅ Cycle complete: ${successful}/${participants.length} payments\n`));
  
  return paymentResults;
}
```

### 4. Demo Scripts (`demos/`)

#### full-cycle.js
```javascript
/**
 * Complete Ajo lifecycle demonstration
 */
export async function runFullCycleDemo() {
  printBanner("FULL AJO LIFECYCLE DEMO");
  
  // Initialize Starknet
  const { provider, account, config } = await initializeStarknet('sepolia');
  
  // Load contracts
  const factoryAddress = CONTRACTS.sepolia.factory;
  const usdcAddress = CONTRACTS.sepolia.usdc;
  
  // Create Ajo
  const { ajoId, ajoInfo } = await setupAjo(account, factoryAddress, {
    name: `Demo Ajo ${Date.now()}`,
    owner: account.address,
    ...CONTRACTS.sepolia.classHashes
  });
  
  // Setup participants
  const testAccounts = loadTestAccounts(provider, 10);
  const participants = await setupParticipants(testAccounts, usdcAddress, ajoInfo, {
    requiredBalance: parseUnits("100", 6) // 100 USDC
  });
  
  // Join Ajo
  const joinResults = await participantsJoinAjo(participants, ajoInfo.ajo_core);
  
  // Run payment cycles
  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(colors.magenta(`\n${"═".repeat(88)}`));
    console.log(colors.bright(`  CYCLE ${cycle}`));
    console.log(colors.magenta(`${"═".repeat(88)}\n`));
    
    await processPaymentCycle(participants, ajoInfo.ajo_core, ajoInfo.ajo_payments);
    
    if (cycle < 3) {
      console.log(colors.yellow(`  ⏳ Waiting for next cycle...\n`));
      await sleep(TEST_CONFIG.CYCLE_DURATION * 1000);
    }
  }
  
  // Final summary
  printFinalSummary(ajoId, participants, joinResults);
}
```

## Data Flow

```
User → Demo Script
         ↓
    Initialize Starknet (provider, account)
         ↓
    Load Configuration (networks, contracts, constants)
         ↓
    Factory Operations (create_ajo, get_ajo)
         ↓
    Participant Setup (fund, approve, join)
         ↓
    Payment Cycles (process_payment, distribute_payout)
         ↓
    View Functions (get stats, member info, etc.)
         ↓
    Console Output (formatted tables, status updates)
```

## Error Handling Strategy

1. **Network Errors**: Retry with exponential backoff
2. **Transaction Failures**: Log details, provide recovery steps
3. **Insufficient Balance**: Skip participant, continue with others
4. **Contract Errors**: Parse revert reason, display clearly
5. **Timeout Errors**: Increase timeout, retry operation

## Testing Strategy

1. **Unit Testing**: Test individual utility functions
2. **Integration Testing**: Test contract interactions
3. **End-to-End Testing**: Run full demo scripts
4. **Error Scenarios**: Test failure handling
5. **Network Conditions**: Test with slow/unstable connections

## Security Considerations

1. **Private Keys**: Store in environment variables, never commit
2. **RPC URLs**: Use secure HTTPS endpoints
3. **Token Approvals**: Limit approval amounts
4. **Account Validation**: Verify addresses before operations
5. **Transaction Signing**: Confirm all parameters before signing

## Performance Optimizations

1. **Parallel Operations**: Execute independent operations concurrently
2. **Batch Calls**: Use multicall for view functions
3. **Caching**: Cache contract instances and ABIs
4. **Connection Pooling**: Reuse provider connections
5. **Efficient Polling**: Optimize transaction confirmation polling

## Deployment Strategy

1. Create directory structure
2. Implement utility functions
3. Implement core operations
4. Create demo scripts
5. Test on Sepolia
6. Document usage
7. Create example .env file

## Maintenance Plan

1. **Version Updates**: Keep starknet.js updated
2. **Contract Changes**: Update ABIs when contracts change
3. **Network Changes**: Update RPC URLs as needed
4. **Bug Fixes**: Address issues promptly
5. **Feature Additions**: Add new demos as features are added

## Documentation Requirements

1. **README.md**: Overview, setup instructions, usage examples
2. **CONFIGURATION.md**: Detailed configuration guide
3. **API.md**: Function documentation
4. **TROUBLESHOOTING.md**: Common issues and solutions
5. **EXAMPLES.md**: Code examples for each feature

## Success Criteria

- ✅ All core operations working
- ✅ Clear console output
- ✅ Error handling robust
- ✅ Documentation complete
- ✅ Easy to configure and run
- ✅ Matches Hedera script functionality
