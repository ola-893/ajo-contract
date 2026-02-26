# Configuration Guide

Complete guide to configuring the Starknet Ajo Integration Testing Scripts.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Network Configuration](#network-configuration)
- [Contract Addresses](#contract-addresses)
- [Test Parameters](#test-parameters)
- [RPC Endpoints](#rpc-endpoints)
- [Account Setup](#account-setup)

## Environment Variables

### Required Variables

These variables must be set in your `.env` file:

```env
# Main account for operations
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...
```

**STARKNET_ACCOUNT_ADDRESS**
- Your deployed Starknet account address
- Must be a valid Starknet address (starts with `0x`)
- Account must be deployed on Sepolia testnet
- Example: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

**STARKNET_PRIVATE_KEY**
- Private key for your Starknet account
- Keep this secret and never commit to version control
- Must match the account address
- Example: `0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`

### Optional Variables

These variables enhance functionality but are not required:

```env
# Custom RPC endpoint (optional)
STARKNET_RPC=https://starknet-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Test accounts for multi-participant demos (optional)
TEST_ACCOUNT_1_ADDRESS=0x...
TEST_ACCOUNT_1_PRIVATE_KEY=0x...
TEST_ACCOUNT_2_ADDRESS=0x...
TEST_ACCOUNT_2_PRIVATE_KEY=0x...
TEST_ACCOUNT_3_ADDRESS=0x...
TEST_ACCOUNT_3_PRIVATE_KEY=0x...
# ... up to TEST_ACCOUNT_10

# Network selection (optional, defaults to sepolia)
STARKNET_NETWORK=sepolia

# Debug mode (optional)
DEBUG=true
```

**STARKNET_RPC**
- Custom RPC endpoint URL
- Defaults to public Starknet Sepolia RPC if not set
- Recommended providers:
  - Alchemy: `https://starknet-sepolia.g.alchemy.com/v2/YOUR_KEY`
  - Infura: `https://starknet-sepolia.infura.io/v3/YOUR_KEY`
  - Blast: `https://starknet-sepolia.blastapi.io/YOUR_KEY`

**TEST_ACCOUNT_N_ADDRESS / TEST_ACCOUNT_N_PRIVATE_KEY**
- Additional test accounts for multi-participant demos
- Number from 1 to 10
- Each account needs both address and private key
- Used in full-cycle and advanced demos

**STARKNET_NETWORK**
- Network to use: `sepolia` or `mainnet`
- Defaults to `sepolia`
- Mainnet support is limited (use with caution)

**DEBUG**
- Enable debug output including stack traces
- Set to `true` to enable
- Useful for troubleshooting

## Network Configuration

Networks are configured in `config/networks.js`:

### Sepolia Testnet (Default)

```javascript
sepolia: {
  name: "Starknet Sepolia",
  rpcUrl: process.env.STARKNET_RPC || "https://free-rpc.nethermind.io/sepolia-juno",
  chainId: "SN_SEPOLIA",
  explorer: "https://sepolia.voyager.online"
}
```

### Mainnet

```javascript
mainnet: {
  name: "Starknet Mainnet",
  rpcUrl: process.env.STARKNET_MAINNET_RPC || "https://free-rpc.nethermind.io/mainnet-juno",
  chainId: "SN_MAIN",
  explorer: "https://voyager.online"
}
```

### Custom Network

To add a custom network, edit `config/networks.js`:

```javascript
export const NETWORKS = {
  // ... existing networks
  custom: {
    name: "My Custom Network",
    rpcUrl: "https://my-rpc-endpoint.com",
    chainId: "CUSTOM_CHAIN_ID",
    explorer: "https://my-explorer.com"
  }
};
```

## Contract Addresses

Contract addresses are configured in `config/contracts.js`:

### Sepolia Testnet Contracts

```javascript
sepolia: {
  // Factory contract
  factory: "0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c",
  
  // USDC token
  usdc: "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343",
  
  // Class hashes for Ajo components
  classHashes: {
    core: "0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe",
    members: "0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e",
    collateral: "0x...",
    payments: "0x...",
    governance: "0x...",
    schedule: "0x..."
  }
}
```

### Updating Contract Addresses

If contracts are redeployed, update the addresses in `config/contracts.js`:

```javascript
export const CONTRACTS = {
  sepolia: {
    factory: "0xNEW_FACTORY_ADDRESS",
    usdc: "0xNEW_USDC_ADDRESS",
    classHashes: {
      core: "0xNEW_CORE_CLASS_HASH",
      // ... other class hashes
    }
  }
};
```

## Test Parameters

Test parameters are configured in `config/constants.js`:

```javascript
export const TEST_CONFIG = {
  // Cycle duration in seconds (30s for testing, 2592000s for production)
  CYCLE_DURATION: 30,
  
  // Monthly payment amount in USDC (6 decimals)
  MONTHLY_PAYMENT_USDC: "50",
  
  // Number of participants for demos
  TOTAL_PARTICIPANTS: 10,
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // milliseconds
  
  // Transaction timeout
  TRANSACTION_TIMEOUT: 60000, // milliseconds
  
  // Gas multiplier for safety margin
  GAS_MULTIPLIER: 1.5
};
```

### Customizing Test Parameters

Edit `config/constants.js` to customize:

**CYCLE_DURATION**
- Duration of each payment cycle in seconds
- Use 30-60 seconds for testing
- Use 2592000 (30 days) for production
- Affects how long demos take to run

**MONTHLY_PAYMENT_USDC**
- Payment amount per participant per cycle
- Specified in USDC (6 decimals)
- Example: "50" = $50 USDC
- Ensure test accounts have sufficient balance

**TOTAL_PARTICIPANTS**
- Number of participants in demos
- Maximum 10 (limited by test accounts)
- Affects demo duration and complexity

**MAX_RETRIES**
- Number of retry attempts for failed operations
- Recommended: 3-5
- Higher values increase reliability but slow down failures

**RETRY_DELAY**
- Base delay between retries in milliseconds
- Uses exponential backoff (delay * 2^attempt)
- Recommended: 2000-5000ms

**TRANSACTION_TIMEOUT**
- Maximum time to wait for transaction confirmation
- In milliseconds
- Recommended: 60000-120000ms (1-2 minutes)

**GAS_MULTIPLIER**
- Safety margin for gas estimation
- Multiplies estimated gas by this factor
- Recommended: 1.5-2.0

## RPC Endpoints

### Public Endpoints

Free public RPC endpoints (may have rate limits):

```env
# Nethermind (recommended for testing)
STARKNET_RPC=https://free-rpc.nethermind.io/sepolia-juno

# Blast API
STARKNET_RPC=https://starknet-sepolia.public.blastapi.io
```

### Private Endpoints

Recommended for production use:

**Alchemy**
```env
STARKNET_RPC=https://starknet-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```
- Sign up: https://www.alchemy.com/
- Free tier: 300M compute units/month
- Excellent reliability and performance

**Infura**
```env
STARKNET_RPC=https://starknet-sepolia.infura.io/v3/YOUR_PROJECT_ID
```
- Sign up: https://infura.io/
- Free tier: 100k requests/day
- Good reliability

**Blast API**
```env
STARKNET_RPC=https://starknet-sepolia.blastapi.io/YOUR_PROJECT_ID
```
- Sign up: https://blastapi.io/
- Free tier available
- Multiple endpoints

### RPC Configuration Tips

1. **Use private endpoints for production**: Public endpoints may be rate-limited
2. **Configure multiple endpoints**: Add fallback RPC URLs for reliability
3. **Monitor usage**: Track API calls to avoid hitting limits
4. **Enable caching**: Reduce redundant RPC calls
5. **Use websockets**: For real-time updates (if supported)

## Account Setup

### Creating a Starknet Account

1. **Install Starknet Wallet**
   - ArgentX: https://www.argent.xyz/argent-x/
   - Braavos: https://braavos.app/

2. **Create Account**
   - Follow wallet instructions
   - Save seed phrase securely
   - Deploy account on Sepolia testnet

3. **Export Private Key**
   - In wallet settings, export private key
   - Copy account address and private key
   - Add to `.env` file

### Funding Your Account

**Get STRK for Gas**
```
Visit: https://faucet.goerli.starknet.io/
Enter your account address
Request STRK tokens
```

**Get USDC for Testing**
```
USDC Contract: 0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343

Option 1: Use a faucet (if available)
Option 2: Bridge from Ethereum Sepolia
Option 3: Swap STRK for USDC on a DEX
```

### Multiple Test Accounts

For multi-participant demos, you need multiple accounts:

1. **Create 10 accounts** using wallet or CLI
2. **Fund each account** with STRK and USDC
3. **Export private keys** for each account
4. **Add to .env**:
   ```env
   TEST_ACCOUNT_1_ADDRESS=0x...
   TEST_ACCOUNT_1_PRIVATE_KEY=0x...
   TEST_ACCOUNT_2_ADDRESS=0x...
   TEST_ACCOUNT_2_PRIVATE_KEY=0x...
   # ... up to 10
   ```

### Account Security

⚠️ **Security Best Practices**:

1. **Never commit `.env` file** to version control
2. **Use test accounts only** for testing
3. **Keep private keys secure** and encrypted
4. **Rotate keys regularly** for production
5. **Use hardware wallets** for mainnet
6. **Limit account permissions** where possible
7. **Monitor account activity** for suspicious transactions

### Account Verification

Verify your account setup:

```bash
# Check account balance
starkli balance <ACCOUNT_ADDRESS> --rpc https://free-rpc.nethermind.io/sepolia-juno

# Check account nonce
starkli nonce <ACCOUNT_ADDRESS> --rpc https://free-rpc.nethermind.io/sepolia-juno

# View account on explorer
https://sepolia.voyager.online/contract/<ACCOUNT_ADDRESS>
```

## Environment File Template

Complete `.env` template:

```env
# ============================================
# REQUIRED CONFIGURATION
# ============================================

# Main account for operations
STARKNET_ACCOUNT_ADDRESS=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
STARKNET_PRIVATE_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890

# ============================================
# OPTIONAL CONFIGURATION
# ============================================

# Custom RPC endpoint (optional, uses public endpoint if not set)
STARKNET_RPC=https://starknet-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Network selection (optional, defaults to sepolia)
STARKNET_NETWORK=sepolia

# Debug mode (optional, enables verbose logging)
DEBUG=false

# ============================================
# TEST ACCOUNTS (Optional, for multi-participant demos)
# ============================================

TEST_ACCOUNT_1_ADDRESS=0x...
TEST_ACCOUNT_1_PRIVATE_KEY=0x...

TEST_ACCOUNT_2_ADDRESS=0x...
TEST_ACCOUNT_2_PRIVATE_KEY=0x...

TEST_ACCOUNT_3_ADDRESS=0x...
TEST_ACCOUNT_3_PRIVATE_KEY=0x...

TEST_ACCOUNT_4_ADDRESS=0x...
TEST_ACCOUNT_4_PRIVATE_KEY=0x...

TEST_ACCOUNT_5_ADDRESS=0x...
TEST_ACCOUNT_5_PRIVATE_KEY=0x...

TEST_ACCOUNT_6_ADDRESS=0x...
TEST_ACCOUNT_6_PRIVATE_KEY=0x...

TEST_ACCOUNT_7_ADDRESS=0x...
TEST_ACCOUNT_7_PRIVATE_KEY=0x...

TEST_ACCOUNT_8_ADDRESS=0x...
TEST_ACCOUNT_8_PRIVATE_KEY=0x...

TEST_ACCOUNT_9_ADDRESS=0x...
TEST_ACCOUNT_9_PRIVATE_KEY=0x...

TEST_ACCOUNT_10_ADDRESS=0x...
TEST_ACCOUNT_10_PRIVATE_KEY=0x...
```

## Validation

The scripts automatically validate configuration on startup:

```javascript
// Checks performed:
✓ Required environment variables present
✓ Account addresses are valid
✓ Private keys are valid
✓ RPC endpoint is accessible
✓ Network configuration is correct
⚠ Optional variables missing (warnings only)
```

If validation fails, you'll see detailed error messages with suggestions for fixing the issues.

## Troubleshooting Configuration

**"Missing required environment variables"**
- Ensure `.env` file exists in `starknet-scripts/` directory
- Check variable names match exactly (case-sensitive)
- Verify no extra spaces around `=` sign

**"Invalid account address"**
- Address must start with `0x`
- Address must be 66 characters long (including `0x`)
- Verify address is correct from wallet

**"Invalid private key"**
- Private key must start with `0x`
- Private key must be 66 characters long
- Ensure you copied the full key from wallet

**"RPC endpoint not accessible"**
- Check internet connection
- Verify RPC URL is correct
- Try a different RPC provider
- Check for API key if using private endpoint

---

For more help, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
