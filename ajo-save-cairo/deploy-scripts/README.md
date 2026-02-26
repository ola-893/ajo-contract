# Starknet Deployment Scripts

This directory contains Node.js scripts for declaring and deploying Starknet contracts using starknet.js.

## Setup

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

## Usage

### Declare and Deploy AjoFactory

```bash
npm run declare-deploy
```

This script will:
1. Connect to Starknet Sepolia testnet
2. Check if the AjoFactory class is already declared
3. Declare it if not already declared
4. Deploy the AjoFactory contract with the configured constructor arguments
5. Save deployment information to `../ajo-save-cairo/factory_deployment.json`

## Configuration

Edit `declare_and_deploy_factory.js` to modify:
- RPC URL
- Account address and private key
- Constructor arguments
- Contract class file path

## Output

On successful deployment, you'll see:
- Transaction hashes for declaration and deployment
- Deployed contract address
- Links to view the contract on Voyager and Starkscan
- Deployment info saved to JSON file

## Troubleshooting

If the script fails:
1. Check your internet connection
2. Verify the RPC endpoint is accessible
3. Ensure your account has sufficient STRK for gas fees
4. Try using Voyager UI as an alternative: https://sepolia.voyager.online/

## Alternative: Voyager UI

If the script doesn't work, use the Voyager UI (recommended):
1. Declare: https://sepolia.voyager.online/declare-contract
2. Deploy: https://sepolia.voyager.online/deploy-contract

See `../ajo-save-cairo/DECLARE_AND_DEPLOY_GUIDE.md` for detailed instructions.
