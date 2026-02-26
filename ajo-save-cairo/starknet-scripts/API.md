# API Documentation

Complete API reference for all functions in the Starknet Ajo Integration Testing Scripts.

## Table of Contents

- [Utility Functions](#utility-functions)
  - [Starknet Utils](#starknet-utils)
  - [Account Utils](#account-utils)
  - [Token Utils](#token-utils)
  - [Formatting Utils](#formatting-utils)
  - [Retry Utils](#retry-utils)
  - [Error Utils](#error-utils)
- [Core Operations](#core-operations)
  - [Factory Operations](#factory-operations)
  - [Ajo Lifecycle](#ajo-lifecycle)
  - [Participant Management](#participant-management)
  - [Payment Operations](#payment-operations)
  - [Governance Operations](#governance-operations)
  - [Collateral Operations](#collateral-operations)

---

## Utility Functions

### Starknet Utils

Located in `utils/starknet.js`

#### `initializeStarknet(network)`

Initialize Starknet provider and account.

**Parameters:**
- `network` (string, optional): Network name ('sepolia' or 'mainnet'). Default: 'sepolia'

**Returns:**
- `Object`: Contains `provider`, `account`, and `config`

**Example:**
```javascript
import { initializeStarknet } from './utils/starknet.js';

const { provider, account, config } = await initializeStarknet('sepolia');
console.log(`Connected to ${config.name}`);
```

#### `waitForTransaction(provider, txHash, timeout)`

Wait for transaction confirmation with timeout.

**Parameters:**
- `provider` (RpcProvider): Starknet provider instance
- `txHash` (string): Transaction hash to wait for
- `timeout` (number, optional): Timeout in milliseconds. Default: 60000

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt when confirmed

**Throws:**
- Error if transaction times out or fails

**Example:**
```javascript
const receipt = await waitForTransaction(provider, txHash, 120000);
console.log(`Transaction confirmed: ${receipt.status}`);
```

#### `sleep(ms)`

Delay execution for specified milliseconds.

**Parameters:**
- `ms` (number): Milliseconds to sleep

**Returns:**
- `Promise<void>`

**Example:**
```javascript
await sleep(2000); // Wait 2 seconds
```

---

### Account Utils

Located in `utils/accounts.js`

#### `loadTestAccounts(provider, count)`

Load test accounts from environment variables.

**Parameters:**
- `provider` (RpcProvider): Starknet provider instance
- `count` (number, optional): Number of accounts to load. Default: 10

**Returns:**
- `Array<Account>`: Array of Account instances

**Example:**
```javascript
const accounts = loadTestAccounts(provider, 5);
console.log(`Loaded ${accounts.length} test accounts`);
```

#### `checkAccountBalance(account, tokenAddress)`

Check account's token balance.

**Parameters:**
- `account` (Account): Starknet account instance
- `tokenAddress` (string): ERC20 token contract address

**Returns:**
- `Promise<BigInt>`: Token balance (in token's smallest unit)

**Example:**
```javascript
const balance = await checkAccountBalance(account, usdcAddress);
console.log(`Balance: ${formatUSDC(balance)} USDC`);
```

#### `fundAccount(fromAccount, toAddress, amount, tokenAddress)`

Transfer tokens from one account to another.

**Parameters:**
- `fromAccount` (Account): Source account
- `toAddress` (string): Recipient address
- `amount` (BigInt): Amount to transfer
- `tokenAddress` (string): Token contract address

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await fundAccount(mainAccount, testAddress, parseUnits("100", 6), usdcAddress);
```

---

### Token Utils

Located in `utils/tokens.js`

#### `approveToken(account, tokenAddress, spenderAddress, amount)`

Approve token spending for a spender.

**Parameters:**
- `account` (Account): Account approving the spending
- `tokenAddress` (string): ERC20 token contract address
- `spenderAddress` (string): Address allowed to spend tokens
- `amount` (BigInt): Amount to approve

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await approveToken(account, usdcAddress, collateralAddress, parseUnits("1000", 6));
```

#### `transferToken(account, tokenAddress, recipientAddress, amount)`

Transfer tokens to another address.

**Parameters:**
- `account` (Account): Sender account
- `tokenAddress` (string): ERC20 token contract address
- `recipientAddress` (string): Recipient address
- `amount` (BigInt): Amount to transfer

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await transferToken(account, usdcAddress, recipientAddress, parseUnits("50", 6));
```

#### `checkAllowance(account, tokenAddress, spenderAddress)`

Check token allowance for a spender.

**Parameters:**
- `account` (Account): Token owner account
- `tokenAddress` (string): ERC20 token contract address
- `spenderAddress` (string): Spender address

**Returns:**
- `Promise<BigInt>`: Approved amount

**Example:**
```javascript
const allowance = await checkAllowance(account, usdcAddress, spenderAddress);
console.log(`Allowance: ${formatUSDC(allowance)} USDC`);
```

---

### Formatting Utils

Located in `utils/formatting.js`

#### `colors`

Color utilities for console output.

**Methods:**
- `colors.green(text)`: Green text
- `colors.red(text)`: Red text
- `colors.blue(text)`: Blue text
- `colors.yellow(text)`: Yellow text
- `colors.cyan(text)`: Cyan text
- `colors.magenta(text)`: Magenta text
- `colors.dim(text)`: Dimmed text
- `colors.bright(text)`: Bright text

**Example:**
```javascript
console.log(colors.green('✅ Success!'));
console.log(colors.red('❌ Error!'));
```

#### `formatUSDC(amount)`

Format USDC amount (6 decimals) to readable string.

**Parameters:**
- `amount` (BigInt): Amount in smallest unit (6 decimals)

**Returns:**
- `string`: Formatted amount with 2 decimal places

**Example:**
```javascript
const formatted = formatUSDC(50000000n); // "50.00"
```

#### `formatAddress(address, length)`

Format Starknet address for display.

**Parameters:**
- `address` (string): Full address
- `length` (number, optional): Characters to show on each side. Default: 6

**Returns:**
- `string`: Shortened address (e.g., "0x1234...abcd")

**Example:**
```javascript
const short = formatAddress("0x1234567890abcdef...", 4); // "0x1234...cdef"
```

#### `printBanner(title)`

Print formatted banner with title.

**Parameters:**
- `title` (string): Banner title

**Example:**
```javascript
printBanner("AJO CREATION");
// Outputs:
// ════════════════════════════════════════════════════════════════════════════════════════
// ║                                    AJO CREATION                                      ║
// ════════════════════════════════════════════════════════════════════════════════════════
```

#### `printTable(headers, rows)`

Print formatted table.

**Parameters:**
- `headers` (Array<string>): Column headers
- `rows` (Array<Array<string>>): Table rows

**Example:**
```javascript
printTable(
  ['Name', 'Position', 'Balance'],
  [
    ['Alice', '1', '100.00'],
    ['Bob', '2', '150.00']
  ]
);
```

---

### Retry Utils

Located in `utils/retry.js`

#### `retryWithBackoff(operation, operationName, maxRetries, baseDelay)`

Retry operation with exponential backoff.

**Parameters:**
- `operation` (Function): Async function to retry
- `operationName` (string): Name for logging
- `maxRetries` (number, optional): Maximum retry attempts. Default: 3
- `baseDelay` (number, optional): Base delay in ms. Default: 2000

**Returns:**
- `Promise<any>`: Result of successful operation

**Throws:**
- Error if all retries fail

**Example:**
```javascript
const result = await retryWithBackoff(
  async () => await contract.someMethod(),
  'Contract call',
  3,
  2000
);
```

---

### Error Utils

Located in `utils/errors.js`

#### `formatError(error, context)`

Format and display error with suggestions.

**Parameters:**
- `error` (Error): Error object
- `context` (string, optional): Context description

**Example:**
```javascript
try {
  await riskyOperation();
} catch (error) {
  formatError(error, 'Processing payment');
}
```

#### `handleTransactionFailure(txHash, error, context)`

Handle transaction failure with detailed output.

**Parameters:**
- `txHash` (string): Failed transaction hash
- `error` (Error): Error object
- `context` (string, optional): Context description

**Example:**
```javascript
handleTransactionFailure(txHash, error, 'Token approval');
```

#### `validateEnvironment()`

Validate environment configuration.

**Returns:**
- `boolean`: True if valid, false otherwise

**Example:**
```javascript
if (!validateEnvironment()) {
  process.exit(1);
}
```

---

## Core Operations

### Factory Operations

Located in `core/factory.js`

#### `getFactoryStats(factoryContract)`

Get factory statistics.

**Parameters:**
- `factoryContract` (Contract): Factory contract instance

**Returns:**
- `Promise<Object>`: Contains `totalCreated` and `activeCount`

**Example:**
```javascript
const stats = await getFactoryStats(factory);
console.log(`Total Ajos created: ${stats.totalCreated}`);
```

#### `createAjo(account, factoryAddress, config)`

Create new Ajo group.

**Parameters:**
- `account` (Account): Creator account
- `factoryAddress` (string): Factory contract address
- `config` (Object): Ajo configuration
  - `name` (string): Ajo name
  - `owner` (string): Owner address
  - `core_class_hash` (string): Core contract class hash
  - `members_class_hash` (string): Members contract class hash
  - `collateral_class_hash` (string): Collateral contract class hash
  - `payments_class_hash` (string): Payments contract class hash
  - `governance_class_hash` (string): Governance contract class hash
  - `schedule_class_hash` (string): Schedule contract class hash

**Returns:**
- `Promise<Object>`: Contains `ajoId` and `receipt`

**Example:**
```javascript
const { ajoId, receipt } = await createAjo(account, factoryAddress, {
  name: "My Ajo Group",
  owner: account.address,
  ...classHashes
});
```

#### `getAjoInfo(factoryContract, ajoId)`

Get Ajo information.

**Parameters:**
- `factoryContract` (Contract): Factory contract instance
- `ajoId` (BigInt): Ajo ID

**Returns:**
- `Promise<Object>`: Ajo information including contract addresses

**Example:**
```javascript
const info = await getAjoInfo(factory, ajoId);
console.log(`Core contract: ${info.ajo_core}`);
```

---

### Ajo Lifecycle

Located in `core/ajo-lifecycle.js`

#### `setupAjo(account, factoryAddress, config)`

Complete Ajo setup workflow.

**Parameters:**
- `account` (Account): Creator account
- `factoryAddress` (string): Factory contract address
- `config` (Object): Ajo configuration

**Returns:**
- `Promise<Object>`: Contains `ajoId` and `ajoInfo`

**Example:**
```javascript
const { ajoId, ajoInfo } = await setupAjo(account, factoryAddress, config);
```

#### `initializeAjo(account, coreAddress, config)`

Initialize Ajo with parameters.

**Parameters:**
- `account` (Account): Owner account
- `coreAddress` (string): Core contract address
- `config` (Object): Initialization parameters
  - `cycle_duration` (number): Cycle duration in seconds
  - `monthly_payment` (BigInt): Payment amount per cycle
  - `token_address` (string): Payment token address

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await initializeAjo(account, coreAddress, {
  cycle_duration: 2592000, // 30 days
  monthly_payment: parseUnits("50", 6),
  token_address: usdcAddress
});
```

---

### Participant Management

Located in `core/participants.js`

#### `setupParticipants(accounts, usdcAddress, ajoInfo, config)`

Setup participants with tokens and approvals.

**Parameters:**
- `accounts` (Array<Account>): Participant accounts
- `usdcAddress` (string): USDC token address
- `ajoInfo` (Object): Ajo contract addresses
- `config` (Object): Configuration
  - `requiredBalance` (BigInt): Minimum balance required

**Returns:**
- `Promise<Array<Object>>`: Array of participant objects

**Example:**
```javascript
const participants = await setupParticipants(
  testAccounts,
  usdcAddress,
  ajoInfo,
  { requiredBalance: parseUnits("100", 6) }
);
```

#### `participantsJoinAjo(participants, coreAddress)`

Participants join Ajo.

**Parameters:**
- `participants` (Array<Object>): Participant objects
- `coreAddress` (string): Core contract address

**Returns:**
- `Promise<Array<Object>>`: Join results for each participant

**Example:**
```javascript
const results = await participantsJoinAjo(participants, coreAddress);
console.log(`${results.filter(r => r.success).length} joined successfully`);
```

#### `getMemberInfo(coreContract, memberAddress)`

Get member information.

**Parameters:**
- `coreContract` (Contract): Core contract instance
- `memberAddress` (string): Member address

**Returns:**
- `Promise<Object>`: Member information

**Example:**
```javascript
const info = await getMemberInfo(core, memberAddress);
console.log(`Position: ${info.position}, Collateral: ${info.locked_collateral}`);
```

---

### Payment Operations

Located in `core/payments.js`

#### `processPaymentCycle(participants, coreAddress, paymentsAddress)`

Process complete payment cycle.

**Parameters:**
- `participants` (Array<Object>): Participant objects
- `coreAddress` (string): Core contract address
- `paymentsAddress` (string): Payments contract address

**Returns:**
- `Promise<Array<Object>>`: Payment results

**Example:**
```javascript
const results = await processPaymentCycle(participants, coreAddress, paymentsAddress);
```

#### `processPayment(account, coreAddress)`

Process payment for single participant.

**Parameters:**
- `account` (Account): Participant account
- `coreAddress` (string): Core contract address

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await processPayment(account, coreAddress);
```

#### `distributePayout(account, paymentsAddress)`

Distribute payout to cycle recipient.

**Parameters:**
- `account` (Account): Any member account
- `paymentsAddress` (string): Payments contract address

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await distributePayout(account, paymentsAddress);
```

---

### Governance Operations

Located in `core/governance.js`

#### `createProposal(account, governanceAddress, proposalData)`

Create governance proposal.

**Parameters:**
- `account` (Account): Proposer account
- `governanceAddress` (string): Governance contract address
- `proposalData` (Object): Proposal details
  - `title` (string): Proposal title
  - `description` (string): Proposal description
  - `proposal_type` (number): Type of proposal
  - `target` (string): Target contract address
  - `calldata` (Array): Call data

**Returns:**
- `Promise<Object>`: Contains `proposalId` and `receipt`

**Example:**
```javascript
const { proposalId } = await createProposal(account, governanceAddress, {
  title: "Increase cycle duration",
  description: "Proposal to increase cycle duration to 60 days",
  proposal_type: 1,
  target: coreAddress,
  calldata: [...]
});
```

#### `submitVote(account, governanceAddress, proposalId, vote)`

Submit vote on proposal.

**Parameters:**
- `account` (Account): Voter account
- `governanceAddress` (string): Governance contract address
- `proposalId` (BigInt): Proposal ID
- `vote` (boolean): True for yes, false for no

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await submitVote(account, governanceAddress, proposalId, true);
```

#### `executeProposal(account, governanceAddress, proposalId)`

Execute approved proposal.

**Parameters:**
- `account` (Account): Executor account
- `governanceAddress` (string): Governance contract address
- `proposalId` (BigInt): Proposal ID

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await executeProposal(account, governanceAddress, proposalId);
```

---

### Collateral Operations

Located in `core/collateral.js`

#### `calculateCollateral(collateralContract, position, totalMembers)`

Calculate collateral requirement for position.

**Parameters:**
- `collateralContract` (Contract): Collateral contract instance
- `position` (number): Member position
- `totalMembers` (number): Total number of members

**Returns:**
- `Promise<BigInt>`: Required collateral amount

**Example:**
```javascript
const required = await calculateCollateral(collateral, 5, 10);
console.log(`Required collateral: ${formatUSDC(required)} USDC`);
```

#### `getCollateralRequirement(collateralContract, memberAddress)`

Get collateral requirement for member.

**Parameters:**
- `collateralContract` (Contract): Collateral contract instance
- `memberAddress` (string): Member address

**Returns:**
- `Promise<BigInt>`: Required collateral amount

**Example:**
```javascript
const required = await getCollateralRequirement(collateral, memberAddress);
```

#### `seizeCollateral(account, collateralAddress, defaulterAddress)`

Seize collateral from defaulter.

**Parameters:**
- `account` (Account): Executor account
- `collateralAddress` (string): Collateral contract address
- `defaulterAddress` (string): Defaulter address

**Returns:**
- `Promise<TransactionReceipt>`: Transaction receipt

**Example:**
```javascript
await seizeCollateral(account, collateralAddress, defaulterAddress);
```

---

## Type Definitions

### Account
Starknet account instance from starknet.js

### Contract
Starknet contract instance from starknet.js

### TransactionReceipt
```typescript
{
  transaction_hash: string;
  status: 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED';
  block_number: number;
  block_hash: string;
  // ... other fields
}
```

### AjoInfo
```typescript
{
  ajo_id: BigInt;
  owner: string;
  ajo_core: string;
  ajo_members: string;
  ajo_collateral: string;
  ajo_payments: string;
  ajo_governance: string;
  ajo_schedule: string;
  is_active: boolean;
}
```

### MemberInfo
```typescript
{
  address: string;
  position: number;
  locked_collateral: BigInt;
  has_paid_current_cycle: boolean;
  has_received_payout: boolean;
  is_active: boolean;
}
```

---

## Error Handling

All async functions may throw errors. Use try-catch blocks:

```javascript
try {
  const result = await someOperation();
} catch (error) {
  formatError(error, 'Operation context');
  // Handle error appropriately
}
```

For automatic retry on network errors, use `retryWithBackoff`:

```javascript
const result = await retryWithBackoff(
  async () => await unreliableOperation(),
  'Operation name',
  3, // max retries
  2000 // base delay
);
```

---

## Best Practices

1. **Always wait for transactions**: Use `waitForTransaction()` after sending transactions
2. **Check balances first**: Verify sufficient balance before operations
3. **Use retry logic**: Wrap network calls in `retryWithBackoff()`
4. **Handle errors gracefully**: Use `formatError()` for user-friendly messages
5. **Validate inputs**: Check addresses and amounts before contract calls
6. **Log operations**: Use formatted console output for clarity
7. **Test on Sepolia**: Always test on testnet before mainnet

---

For more examples, see [EXAMPLES.md](./EXAMPLES.md)
