# Starknet Ajo Integration Testing Scripts

Comprehensive integration testing scripts for the Ajo Cairo contracts deployed on Starknet Sepolia. These scripts provide end-to-end testing of the complete Ajo lifecycle including group creation, participant management, payment cycles, and governance operations.

## 🎯 Overview

The Ajo system is a decentralized rotating savings and credit association (ROSCA) built on Starknet. These testing scripts allow you to:

- ✅ Create and configure Ajo groups via the factory contract
- ✅ Simulate multiple participants joining and contributing
- ✅ Process payment cycles and distribute payouts
- ✅ Test governance proposals and voting
- ✅ Simulate collateral management and default scenarios
- ✅ Query and display comprehensive contract state

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **Starknet Account**: Deployed account on Sepolia testnet
- **STRK Tokens**: For gas fees (get from [Starknet Sepolia Faucet](https://faucet.goerli.starknet.io/))
- **USDC Tokens**: For testing operations (Circle USDC on Sepolia)

## 🚀 Quick Start

### 1. Installation

```bash
cd starknet-scripts
npm install
```

### 2. Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add your account details:

```env
# Required
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_PRIVATE_KEY=0x...

# Optional
STARKNET_RPC=https://starknet-sepolia.g.alchemy.com/v2/YOUR_KEY
TEST_ACCOUNT_1_ADDRESS=0x...
TEST_ACCOUNT_1_PRIVATE_KEY=0x...
# ... add more test accounts for multi-participant demos
```

### 3. Run Interactive Menu

```bash
npm start
```

This launches an interactive menu where you can select from available demos:

```
   █████╗      ██╗ ██████╗     ████████╗███████╗███████╗████████╗██╗███████╗
  ██╔══██╗     ██║██╔═══██╗    ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝██║██╔════╝
  ███████║     ██║██║   ██║       ██║   █████╗  ███████╗   ██║   ██║███████╗
  ██╔══██║██   ██║██║   ██║       ██║   ██╔══╝  ╚════██║   ██║   ██║╚════██║
  ██║  ██║╚█████╔╝╚██████╔╝       ██║   ███████╗███████║   ██║   ██║███████║
  ╚═╝  ╚═╝ ╚════╝  ╚═════╝        ╚═╝   ╚══════╝╚══════╝   ╚═╝   ╚═╝╚══════╝

? Select a demo to run:
  ❯ Full Lifecycle Demo (~8-10 minutes)
    Quick Test (~2-3 minutes)
    Governance Demo (~4-5 minutes)
    Advanced Features (~5-6 minutes)
    Exit
```

### 4. Run Specific Demo

```bash
# Full lifecycle test
npm start -- full-cycle

# Quick smoke test
npm start -- quick-test

# Governance features
npm start -- governance

# Advanced features
npm start -- advanced
```

## 📚 Available Demos

### Full Lifecycle Demo (`full-cycle`)
**Duration**: ~8-10 minutes

Complete end-to-end test of the Ajo system:
1. Creates a new Ajo group via factory
2. Sets up multiple participants with USDC
3. Participants join the Ajo with collateral
4. Processes multiple payment cycles
5. Distributes payouts to recipients
6. Displays comprehensive statistics

```bash
npm start -- full-cycle
```

### Quick Test (`quick-test`)
**Duration**: ~2-3 minutes

Fast smoke test for basic functionality:
- Factory statistics and operations
- Ajo creation and verification
- Basic contract interactions
- View function queries

```bash
npm start -- quick-test
```

### Governance Demo (`governance`)
**Duration**: ~4-5 minutes

Tests governance features:
- Proposal creation
- Multi-member voting
- Vote tallying
- Proposal execution
- Voting power calculations

```bash
npm start -- governance
```

### Advanced Features (`advanced`)
**Duration**: ~5-6 minutes

Tests advanced scenarios:
- Collateral calculations
- Default simulation
- Guarantor liability
- Asset recovery
- Edge cases

```bash
npm start -- advanced
```

## 🏗️ Project Structure

```
starknet-scripts/
├── config/              # Configuration files
│   ├── networks.js      # Network configurations (Sepolia, Mainnet)
│   ├── contracts.js     # Contract addresses and class hashes
│   └── constants.js     # Test parameters and constants
├── utils/               # Utility functions
│   ├── starknet.js      # Starknet provider and account setup
│   ├── accounts.js      # Account management utilities
│   ├── tokens.js        # ERC20 token operations
│   ├── formatting.js    # Console output formatting
│   ├── retry.js         # Retry logic with exponential backoff
│   └── errors.js        # Error handling and recovery
├── core/                # Core contract operations
│   ├── factory.js       # Factory contract interactions
│   ├── ajo-lifecycle.js # Ajo creation and setup
│   ├── participants.js  # Participant management
│   ├── payments.js      # Payment cycle operations
│   ├── governance.js    # Governance operations
│   └── collateral.js    # Collateral management
├── demos/               # Demo scripts
│   ├── full-cycle.js    # Complete lifecycle demo
│   ├── quick-test.js    # Quick smoke test
│   ├── governance-demo.js # Governance features
│   └── advanced-features.js # Advanced scenarios
├── abis/                # Contract ABIs
│   ├── factory.json
│   ├── core.json
│   ├── members.json
│   ├── payments.json
│   ├── collateral.json
│   ├── governance.json
│   └── erc20.json
├── index.js             # Main CLI entry point
├── package.json
└── .env.example         # Environment template
```

## 🔧 Configuration

See [CONFIGURATION.md](./CONFIGURATION.md) for detailed configuration options including:
- Environment variables
- Network settings
- Contract addresses
- Test parameters
- RPC endpoints

## 📖 API Documentation

See [API.md](./API.md) for detailed documentation of all functions including:
- Utility functions
- Core operations
- Contract interactions
- Error handling

## 💡 Examples

See [EXAMPLES.md](./EXAMPLES.md) for code examples including:
- Custom test scenarios
- Integration with your own code
- Advanced usage patterns
- Batch operations

## 🐛 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for solutions to common issues:
- Network errors
- Transaction failures
- Configuration problems
- Account issues

### Common Issues

**"Missing required environment variables"**
- Ensure `.env` file exists with `STARKNET_ACCOUNT_ADDRESS` and `STARKNET_PRIVATE_KEY`

**"Insufficient balance"**
- Fund your account with STRK from the [Sepolia faucet](https://faucet.goerli.starknet.io/)
- Ensure you have USDC tokens for operations

**"Network error" or "RPC timeout"**
- Check your internet connection
- Try using a different RPC endpoint (Alchemy, Infura, etc.)
- Wait a few moments and retry

**"Transaction failed"**
- Check transaction on [Voyager](https://sepolia.voyager.online/)
- Verify account has sufficient gas
- Ensure contract parameters are valid

## 🔗 Deployed Contracts

### Starknet Sepolia Testnet

- **Factory**: `0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c`
- **USDC**: `0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343`

### Class Hashes

- **Core**: `0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe`
- **Members**: `0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e`
- **Collateral**: `0x0489c8e8e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5`
- **Payments**: `0x0489c8e8e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5`
- **Governance**: `0x0489c8e8e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5`
- **Schedule**: `0x0489c8e8e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5`

## 🧪 Testing

The scripts include comprehensive error handling and retry logic:

- **Automatic Retries**: Network errors are automatically retried with exponential backoff
- **Transaction Monitoring**: All transactions are monitored until confirmation
- **Balance Checks**: Automatic balance verification before operations
- **Clear Output**: Formatted console output with progress indicators
- **Error Recovery**: Detailed error messages with recovery suggestions

## 🛠️ Development

### Adding New Demos

1. Create a new file in `demos/` directory
2. Import required utilities and core functions
3. Implement your demo logic
4. Export a main function
5. Add to `index.js` DEMOS object

Example:

```javascript
// demos/my-demo.js
import { initializeStarknet } from '../utils/starknet.js';
import { printBanner } from '../utils/formatting.js';

export async function runMyDemo() {
  printBanner("MY CUSTOM DEMO");
  
  const { provider, account } = await initializeStarknet();
  
  // Your demo logic here
  
  console.log("✅ Demo complete!");
}
```

### Running with Debug Output

```bash
DEBUG=true npm start -- full-cycle
```

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code follows existing style
- Error handling is comprehensive
- Console output is clear and formatted
- Documentation is updated

## 📞 Support

For issues or questions:
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [API.md](./API.md) for function documentation
- See [EXAMPLES.md](./EXAMPLES.md) for usage patterns

## 🔗 Resources

- [Starknet Documentation](https://docs.starknet.io/)
- [Starknet.js Documentation](https://www.starknetjs.com/)
- [Cairo Book](https://book.cairo-lang.org/)
- [Voyager Explorer](https://sepolia.voyager.online/)
- [Starknet Faucet](https://faucet.goerli.starknet.io/)

---

**Built with ❤️ for the Starknet ecosystem**
