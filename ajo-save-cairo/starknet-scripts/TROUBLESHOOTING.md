# Troubleshooting Guide

Solutions to common issues when using the Starknet Ajo Integration Testing Scripts.

## Table of Contents

- [Configuration Issues](#configuration-issues)
- [Network Errors](#network-errors)
- [Transaction Failures](#transaction-failures)
- [Account Issues](#account-issues)
- [Balance Problems](#balance-problems)
- [Contract Errors](#contract-errors)
- [Performance Issues](#performance-issues)
- [FAQ](#faq)

---

## Configuration Issues

### "Missing required environment variables"

**Problem**: Script exits with error about missing environment variables.

**Solution**:
1. Ensure `.env` file exists in `starknet-scripts/` directory
2. Copy from template: `cp .env.example .env`
3. Add required variables:
   ```env
   STARKNET_ACCOUNT_ADDRESS=0x...
   STARKNET_PRIVATE_KEY=0x...
   ```
4. Verify no extra spaces around `=` sign
5. Check variable names match exactly (case-sensitive)

**Verification**:
```bash
cat .env | grep STARKNET_ACCOUNT_ADDRESS
cat .env | grep STARKNET_PRIVATE_KEY
```

---

### "Invalid account address"

**Problem**: Account address format is incorrect.

**Solution**:
1. Address must start with `0x`
2. Address must be 66 characters long (including `0x`)
3. Get address from your wallet (ArgentX or Braavos)
4. Ensure you copied the full address

**Example of valid address**:
```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

---

### "Invalid private key"

**Problem**: Private key format is incorrect.

**Solution**:
1. Private key must start with `0x`
2. Private key must be 66 characters long
3. Export from wallet settings
4. Never share or commit private keys

**Security Note**: Use test accounts only for testing!

---

### ".env file not found"

**Problem**: Script can't find `.env` file.

**Solution**:
1. Ensure `.env` is in `starknet-scripts/` directory (same level as `index.js`)
2. Check file name is exactly `.env` (not `env.txt` or `.env.example`)
3. On Unix/Mac, files starting with `.` are hidden by default
4. Use `ls -la` to see hidden files

---

## Network Errors

### "Network error" or "fetch failed"

**Problem**: Cannot connect to Starknet RPC endpoint.

**Symptoms**:
- `ECONNREFUSED`
- `ECONNRESET`
- `fetch failed`
- `502 Bad Gateway`
- `503 Service Unavailable`

**Solutions**:

1. **Check Internet Connection**
   ```bash
   ping google.com
   ```

2. **Try Different RPC Endpoint**
   ```env
   # In .env file
   STARKNET_RPC=https://starknet-sepolia.g.alchemy.com/v2/YOUR_KEY
   ```

3. **Use Public Endpoint**
   ```env
   STARKNET_RPC=https://free-rpc.nethermind.io/sepolia-juno
   ```

4. **Check RPC Status**
   - Visit provider's status page
   - Check for maintenance or outages

5. **Wait and Retry**
   - Network may be temporarily congested
   - Scripts have automatic retry logic
   - Wait 5-10 minutes and try again

---

### "RPC timeout"

**Problem**: RPC requests taking too long.

**Solutions**:

1. **Increase Timeout**
   ```javascript
   // In config/constants.js
   TRANSACTION_TIMEOUT: 120000, // 2 minutes
   ```

2. **Use Faster RPC**
   - Switch to paid RPC provider (Alchemy, Infura)
   - Paid providers have better performance

3. **Check Network Congestion**
   - Visit [Voyager](https://sepolia.voyager.online/)
   - Check recent block times
   - Wait for congestion to clear

---

### "Rate limit exceeded"

**Problem**: Too many requests to RPC endpoint.

**Solutions**:

1. **Use Private RPC Endpoint**
   - Sign up for Alchemy or Infura
   - Get API key
   - Add to `.env`:
     ```env
     STARKNET_RPC=https://starknet-sepolia.g.alchemy.com/v2/YOUR_KEY
     ```

2. **Add Delays Between Operations**
   ```javascript
   await sleep(2000); // Wait 2 seconds
   ```

3. **Reduce Concurrent Requests**
   - Process operations sequentially instead of parallel
   - Limit number of participants in demos

---

## Transaction Failures

### "Transaction rejected"

**Problem**: Transaction was rejected by the network.

**Symptoms**:
- Status: `REJECTED`
- Transaction appears on explorer but failed

**Solutions**:

1. **Check Account Balance**
   ```bash
   starkli balance <ACCOUNT_ADDRESS> --rpc <RPC_URL>
   ```
   - Ensure sufficient STRK for gas

2. **Verify Contract Parameters**
   - Check all function parameters are correct
   - Verify addresses are valid
   - Ensure amounts are in correct units

3. **Check Contract State**
   - Verify contract is in correct state for operation
   - Check if operation is allowed at this time
   - Review contract requirements

4. **View on Explorer**
   ```
   https://sepolia.voyager.online/tx/<TRANSACTION_HASH>
   ```
   - Check revert reason
   - Review execution trace

---

### "Insufficient gas"

**Problem**: Transaction ran out of gas.

**Solutions**:

1. **Increase Gas Multiplier**
   ```javascript
   // In config/constants.js
   GAS_MULTIPLIER: 2.0, // Increase from 1.5 to 2.0
   ```

2. **Fund Account with STRK**
   - Visit [Starknet Faucet](https://faucet.goerli.starknet.io/)
   - Request STRK tokens
   - Wait for confirmation

3. **Simplify Operation**
   - Break complex operations into smaller steps
   - Reduce batch sizes

---

### "Nonce too high" or "Nonce too low"

**Problem**: Account nonce mismatch.

**Solutions**:

1. **Wait for Pending Transactions**
   - Check pending transactions on explorer
   - Wait for all to confirm before new operations

2. **Reset Account Connection**
   ```javascript
   // Reinitialize account
   const { account } = await initializeStarknet();
   ```

3. **Check for Concurrent Operations**
   - Ensure not running multiple scripts simultaneously
   - Process operations sequentially

---

### "Transaction timeout"

**Problem**: Transaction not confirmed within timeout period.

**Solutions**:

1. **Increase Timeout**
   ```javascript
   await waitForTransaction(provider, txHash, 180000); // 3 minutes
   ```

2. **Check Transaction Status**
   ```
   https://sepolia.voyager.online/tx/<TRANSACTION_HASH>
   ```
   - Transaction may still be pending
   - May confirm after timeout

3. **Network Congestion**
   - Wait for network to clear
   - Try during off-peak hours

---

## Account Issues

### "Account not deployed"

**Problem**: Account contract not deployed on network.

**Solutions**:

1. **Deploy Account**
   - Use wallet to deploy account
   - Or use starkli:
     ```bash
     starkli account deploy <ACCOUNT_FILE>
     ```

2. **Verify Deployment**
   ```
   https://sepolia.voyager.online/contract/<ACCOUNT_ADDRESS>
   ```

3. **Use Different Account**
   - Create new account in wallet
   - Export and use in `.env`

---

### "Invalid signature"

**Problem**: Transaction signature verification failed.

**Solutions**:

1. **Verify Private Key**
   - Ensure private key matches account address
   - Re-export from wallet if needed

2. **Check Account Type**
   - Ensure using correct account type (ArgentX vs Braavos)
   - Different wallets use different account contracts

3. **Update starknet.js**
   ```bash
   npm update starknet
   ```

---

## Balance Problems

### "Insufficient balance"

**Problem**: Account doesn't have enough tokens.

**Solutions**:

1. **Check STRK Balance** (for gas)
   ```bash
   starkli balance <ACCOUNT_ADDRESS>
   ```
   - Get STRK from [faucet](https://faucet.goerli.starknet.io/)

2. **Check USDC Balance** (for operations)
   ```bash
   starkli balance <ACCOUNT_ADDRESS> --erc20 0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343
   ```
   - Bridge from Ethereum Sepolia
   - Or swap STRK for USDC on DEX

3. **Fund Test Accounts**
   - All test accounts need STRK and USDC
   - Fund before running multi-participant demos

---

### "Insufficient allowance"

**Problem**: Token allowance not approved.

**Solutions**:

1. **Approve Token Spending**
   ```javascript
   await approveToken(
     account,
     tokenAddress,
     spenderAddress,
     amount
   );
   ```

2. **Check Current Allowance**
   ```javascript
   const allowance = await checkAllowance(
     account,
     tokenAddress,
     spenderAddress
   );
   ```

3. **Approve Larger Amount**
   - Approve more than minimum required
   - Reduces need for multiple approvals

---

## Contract Errors

### "Contract not found"

**Problem**: Contract address is invalid or not deployed.

**Solutions**:

1. **Verify Contract Address**
   - Check address in `config/contracts.js`
   - Ensure no typos

2. **Check on Explorer**
   ```
   https://sepolia.voyager.online/contract/<CONTRACT_ADDRESS>
   ```

3. **Update Contract Addresses**
   - If contracts redeployed, update addresses
   - Check deployment documentation

---

### "Function not found"

**Problem**: Contract function doesn't exist or ABI mismatch.

**Solutions**:

1. **Verify ABI**
   - Check ABI file in `abis/` directory
   - Ensure ABI matches deployed contract

2. **Check Function Name**
   - Cairo uses snake_case: `join_ajo` not `joinAjo`
   - Verify exact function name

3. **Update ABIs**
   - If contracts updated, regenerate ABIs
   - Copy from contract compilation output

---

### "Execution reverted"

**Problem**: Contract execution failed with revert.

**Solutions**:

1. **Check Revert Reason**
   - View transaction on explorer
   - Read revert message

2. **Verify Contract State**
   - Check if operation is allowed
   - Verify all requirements met

3. **Review Contract Logic**
   - Check contract source code
   - Understand requirements and constraints

---

## Performance Issues

### "Script running very slow"

**Problem**: Operations taking too long.

**Solutions**:

1. **Use Faster RPC**
   - Switch to paid provider
   - Better performance and reliability

2. **Reduce Participants**
   ```javascript
   // In config/constants.js
   TOTAL_PARTICIPANTS: 5, // Reduce from 10
   ```

3. **Shorten Cycle Duration**
   ```javascript
   CYCLE_DURATION: 30, // 30 seconds instead of 30 days
   ```

4. **Enable Parallel Processing**
   ```javascript
   // Process operations in parallel
   await Promise.all(operations);
   ```

---

### "High gas costs"

**Problem**: Transactions using too much gas.

**Solutions**:

1. **Optimize Operations**
   - Batch operations where possible
   - Reduce unnecessary contract calls

2. **Check Gas Multiplier**
   ```javascript
   GAS_MULTIPLIER: 1.5, // Don't set too high
   ```

3. **Wait for Lower Congestion**
   - Gas prices vary with network usage
   - Try during off-peak hours

---

## FAQ

### Q: How do I get STRK tokens for gas?

**A**: Visit the [Starknet Sepolia Faucet](https://faucet.goerli.starknet.io/), enter your account address, and request tokens. You can request once per day.

---

### Q: How do I get USDC for testing?

**A**: Options:
1. Bridge from Ethereum Sepolia using [Starkgate](https://sepolia.starkgate.starknet.io/)
2. Swap STRK for USDC on a Sepolia DEX
3. Ask in Starknet Discord for test USDC

---

### Q: Can I use this on mainnet?

**A**: The scripts are designed for Sepolia testnet. For mainnet:
1. Change network to `mainnet` in config
2. Use real funds (be careful!)
3. Test thoroughly on testnet first
4. Consider security audits

---

### Q: How many test accounts do I need?

**A**: Depends on demo:
- Quick test: 1 account (main account)
- Full cycle: 10 accounts recommended
- Governance: 5+ accounts for voting
- Can run with fewer, but some features limited

---

### Q: Why is my transaction pending for so long?

**A**: Possible reasons:
1. Network congestion - wait longer
2. Gas price too low - increase gas multiplier
3. RPC issues - try different endpoint
4. Check status on [Voyager](https://sepolia.voyager.online/)

---

### Q: Can I run multiple demos simultaneously?

**A**: Not recommended:
- May cause nonce conflicts
- Increases network load
- Harder to debug issues
- Run demos sequentially

---

### Q: How do I reset everything and start over?

**A**: Steps:
1. Stop all running scripts
2. Create new Ajo group (don't reuse old ones)
3. Ensure all accounts have fresh balances
4. Clear any pending transactions
5. Restart from beginning

---

### Q: Where can I get help?

**A**: Resources:
1. Check this troubleshooting guide
2. Review [API.md](./API.md) for function details
3. See [EXAMPLES.md](./EXAMPLES.md) for code examples
4. Check [Starknet Discord](https://discord.gg/starknet)
5. Review [Starknet Documentation](https://docs.starknet.io/)

---

### Q: How do I enable debug mode?

**A**: Add to `.env`:
```env
DEBUG=true
```

Or run with:
```bash
DEBUG=true npm start -- full-cycle
```

This shows:
- Full stack traces
- Detailed error information
- Additional logging

---

### Q: What if I see "Module not found" errors?

**A**: Solutions:
1. Install dependencies:
   ```bash
   npm install
   ```

2. Check Node.js version:
   ```bash
   node --version  # Should be v18+
   ```

3. Clear cache and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

---

### Q: How do I update contract addresses after redeployment?

**A**: Edit `config/contracts.js`:
```javascript
export const CONTRACTS = {
  sepolia: {
    factory: "0xNEW_FACTORY_ADDRESS",
    usdc: "0xNEW_USDC_ADDRESS",
    classHashes: {
      core: "0xNEW_CORE_CLASS_HASH",
      // ... update all class hashes
    }
  }
};
```

---

## Still Having Issues?

If you're still experiencing problems:

1. **Enable Debug Mode**
   ```bash
   DEBUG=true npm start -- quick-test
   ```

2. **Check Logs**
   - Review full error messages
   - Note transaction hashes
   - Check explorer for details

3. **Verify Setup**
   - Run through configuration guide again
   - Ensure all prerequisites met
   - Test with quick-test first

4. **Simplify**
   - Start with minimal configuration
   - Test one operation at a time
   - Gradually add complexity

5. **Get Help**
   - Starknet Discord: https://discord.gg/starknet
   - Starknet Forum: https://community.starknet.io/
   - GitHub Issues: (if applicable)

---

## Error Code Reference

| Error Code | Meaning | Solution |
|------------|---------|----------|
| ECONNREFUSED | Connection refused | Check RPC endpoint |
| ECONNRESET | Connection reset | Network issue, retry |
| ETIMEDOUT | Operation timeout | Increase timeout |
| 502 | Bad Gateway | RPC issue, try different endpoint |
| 503 | Service Unavailable | RPC down, wait or switch |
| REJECTED | Transaction rejected | Check gas, params, state |
| REVERTED | Execution reverted | Check contract requirements |

---

**Last Updated**: 2024

For more information, see:
- [README.md](./README.md) - Overview and quick start
- [CONFIGURATION.md](./CONFIGURATION.md) - Detailed configuration
- [API.md](./API.md) - Function documentation
- [EXAMPLES.md](./EXAMPLES.md) - Code examples
