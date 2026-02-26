# Starknet Scripts - Utility Functions

This directory contains utility functions for Starknet integration testing scripts.

## Modules

### `starknet.js`
Core Starknet connection and transaction utilities:
- `initializeStarknet()` - Initialize provider and account
- `waitForTransaction()` - Wait for transaction confirmation
- `sleep()` - Delay utility
- `parseEvents()` - Parse transaction events
- `formatAddress()` - Format addresses for display
- `formatTxHash()` - Format transaction hashes
- `getExplorerTxUrl()` - Get explorer URLs

### `formatting.js`
Console output formatting utilities:
- `colors` - ANSI color codes for terminal output
- `printBanner()` - Print decorative banners
- `printTable()` - Print formatted tables
- `formatUSDC()` - Format USDC amounts (6 decimals)
- `formatTokenAmount()` - Format token amounts with custom decimals
- `printSuccess()`, `printError()`, `printWarning()` - Status messages
- `printStep()` - Print numbered steps
- `createProgressBar()` - Create progress bars

### `retry.js`
Retry logic and error handling:
- `retryWithBackoff()` - Retry operations with exponential backoff
- `retryTransaction()` - Retry transactions with nonce handling
- `retryRead()` - Retry read operations
- `withTimeout()` - Wrap operations with timeout
- `handleError()` - Parse and categorize errors
- `printError()` - Print formatted error information

### `accounts.js`
Account management utilities:
- `loadTestAccounts()` - Load test accounts from environment
- `checkTokenBalance()` - Check ERC20 token balance
- `checkUSDCBalance()` - Check USDC balance
- `validateBalance()` - Validate sufficient balance
- `displayAccountInfo()` - Display account information
- `displayAccountsTable()` - Display accounts in table format
- `filterAccountsByBalance()` - Filter accounts by minimum balance
- `loadTestAccountsWithNames()` - Load accounts with friendly names

### `tokens.js`
ERC20 token operations:
- `approveToken()` - Approve token spending
- `transferToken()` - Transfer tokens
- `checkAllowance()` - Check token allowance
- `getTokenBalance()` - Get token balance
- `ensureAllowance()` - Approve if allowance insufficient
- `approveMax()` - Approve maximum amount
- `revokeApproval()` - Revoke token approval
- `prepareToken()` - Check balance and approve in one call
- `parseTokenAmount()` - Parse human-readable amounts
- `formatAmount()` - Format token amounts

## Usage Examples

### Initialize Starknet
```javascript
import { initializeStarknet } from './utils/starknet.js';

const { provider, account, config } = await initializeStarknet('sepolia');
```

### Load Test Accounts
```javascript
import { loadTestAccountsWithNames } from './utils/accounts.js';

const accounts = loadTestAccountsWithNames(provider, 10);
```

### Approve Tokens
```javascript
import { approveToken } from './utils/tokens.js';

await approveToken(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress,
  amount
);
```

### Retry Operations
```javascript
import { retryWithBackoff } from './utils/retry.js';

const result = await retryWithBackoff(
  async () => await someOperation(),
  'Operation name',
  { maxRetries: 3, baseDelay: 2000 }
);
```

### Format Output
```javascript
import { printBanner, printTable, colors } from './utils/formatting.js';

printBanner('MY DEMO');

printTable(
  ['Name', 'Balance'],
  [
    ['Alice', '100.00'],
    ['Bob', '250.50']
  ]
);

console.log(colors.green('✅ Success!'));
```

## Testing

Run the utility test script:
```bash
node starknet-scripts/utils/test-utils.js
```

## Environment Variables

Required for account operations:
```
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...

TEST_ACCOUNT_1_ADDRESS=0x...
TEST_ACCOUNT_1_PRIVATE_KEY=0x...
# ... up to TEST_ACCOUNT_10_ADDRESS/PRIVATE_KEY
```

## Error Handling

All utilities include built-in error handling and retry logic:
- Network errors are automatically retried with exponential backoff
- Transaction nonce issues are handled automatically
- Clear error messages with suggestions for resolution
- Graceful degradation when operations fail

## Best Practices

1. Always use retry wrappers for network operations
2. Use verbose logging for debugging
3. Validate balances before operations
4. Check allowances before token operations
5. Use formatted output for better readability
6. Handle errors gracefully with try-catch blocks
