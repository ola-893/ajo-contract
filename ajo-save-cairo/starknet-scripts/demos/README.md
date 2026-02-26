# Starknet Ajo Demo Scripts

This directory contains demonstration scripts for testing the Ajo Cairo contracts on Starknet.

## Available Demos

### 1. Quick Test (`quick-test.js`)

**Purpose**: Quick smoke test of factory and Ajo creation

**What it does**:
- Connects to Starknet Sepolia
- Displays factory statistics
- Creates a new Ajo group
- Verifies all contract deployments
- Displays Ajo information

**Usage**:
```bash
node demos/quick-test.js
```

**Requirements**:
- `STARKNET_ACCOUNT_ADDRESS` in .env
- `STARKNET_PRIVATE_KEY` in .env
- Sufficient STRK for gas fees (~0.01 STRK)

**Duration**: ~30-60 seconds

---

## Environment Setup

Before running any demo, ensure you have:

1. **Created `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Set required variables**:
   ```
   STARKNET_ACCOUNT_ADDRESS=0x...
   STARKNET_PRIVATE_KEY=0x...
   ```

3. **Funded your account**:
   - Get STRK from [Starknet Faucet](https://faucet.goerli.starknet.io/)
   - Get USDC from [Circle Faucet](https://faucet.circle.com/) (for participant demos)

## Troubleshooting

### "Missing required environment variables"
- Ensure `.env` file exists and contains all required variables
- Check that variable names match exactly (case-sensitive)

### "Insufficient balance"
- Get STRK tokens from the faucet
- Verify your account address is correct

### "Transaction failed"
- Check network status at [Starknet Status](https://status.starknet.io/)
- Try again after a few seconds
- Increase gas multiplier in `config/constants.js`

### "RPC error" or "Network timeout"
- Check your internet connection
- Try a different RPC endpoint in `config/networks.js`
- Wait a few seconds and retry

## Debug Mode

Enable verbose logging:
```bash
DEBUG=true node demos/quick-test.js
```

Enable verbose output:
```bash
VERBOSE=true node demos/quick-test.js
```

## Next Steps

After running the quick test:
1. Run participant demo to test joining (coming soon)
2. Run payment cycle demo to test payments (coming soon)
3. Run full-cycle demo for complete workflow (coming soon)

## Support

For issues or questions:
- Check the main [README.md](../README.md)
- Review [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) (coming soon)
- Check contract deployment status in `ajo-save-cairo/SUCCESSFUL_DEPLOYMENT.md`
