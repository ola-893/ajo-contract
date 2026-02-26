# Ajo Save Cairo - Starknet Deployment Guide

## Current Setup Status

✅ **Build**: Project compiles successfully  
✅ **Tools**: sncast v0.56.0 and starkli v0.4.2 installed  
✅ **Account**: Imported to sncast as "deployer"  
⚠️ **RPC Issues**: Public RPC endpoints experiencing connectivity problems

## Account Information

- **Name**: deployer
- **Address**: `0x634f84cd94953222b6e170e0ed7610af8b191b1130fa937ab5f4c476c01c539`
- **Public Key**: `0xc75299306563b52a18d931a62903141609d78295d498116f6f8f89c0053b8c`
- **Class Hash**: `0x1a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003`
- **Type**: Ready (ArgentX)
- **Network**: Sepolia Testnet

## Deployment Strategy

Your project uses a factory pattern where:
1. All module contracts (AjoCore, AjoMembers, etc.) are declared first
2. Their class hashes are passed to AjoFactory constructor
3. AjoFactory deploys individual Ajo instances using these class hashes

## Option 1: Use Alchemy or Infura RPC (Recommended)

Public RPC endpoints are unreliable. Get a free API key from:
- [Alchemy](https://www.alchemy.com/) - Sign up and create a Starknet Sepolia app
- [Infura](https://www.infura.io/) - Sign up and create a Starknet project

### Update snfoundry.toml with your RPC:

```toml
[sncast.deployer]
account = "deployer"
accounts-file = "/Users/ola/.starknet_accounts/starknet_open_zeppelin_accounts.json"
url = "https://starknet-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
# or
# url = "https://starknet-sepolia.infura.io/v3/YOUR_API_KEY"
```

## Option 2: Use Starknet Devnet (Local Testing)

For local development and testing:

```bash
# Install starknet-devnet
cargo install starknet-devnet

# Run devnet
starknet-devnet --seed 0

# Update snfoundry.toml
[sncast.deployer]
account = "deployer"
url = "http://127.0.0.1:5050"
```

## Deployment Steps (Once RPC is Working)

### Step 1: Fund Your Account

Get testnet ETH from the faucet:
- Visit: https://starknet-faucet.vercel.app/
- Enter address: `0x634f84cd94953222b6e170e0ed7610af8b191b1130fa937ab5f4c476c01c539`
- Request testnet ETH

### Step 2: Verify Account is Deployed

```bash
sncast --profile deployer account list
```

If account shows `deployed: false`, deploy it:

```bash
sncast account deploy --name deployer --network sepolia
```

### Step 3: Declare All Contracts

Use the provided script:

```bash
cd ajo-save-cairo
chmod +x scripts/declare_all.sh
./scripts/declare_all.sh
```

This will declare all contracts and save class hashes to `declared_class_hashes.json`.

### Step 4: Deploy AjoFactory

After declaring, deploy the factory with the class hashes:

```bash
sncast --profile deployer deploy \
  --class-hash <FACTORY_CLASS_HASH> \
  --constructor-calldata \
    <OWNER_ADDRESS> \
    <AJO_CORE_CLASS_HASH> \
    <AJO_MEMBERS_CLASS_HASH> \
    <AJO_PAYMENTS_CLASS_HASH> \
    <AJO_SCHEDULE_CLASS_HASH> \
    <AJO_COLLATERAL_CLASS_HASH> \
    <AJO_GOVERNANCE_CLASS_HASH>
```

## Manual Declaration (Alternative)

If the script doesn't work, declare each contract manually:

```bash
# Declare each contract
sncast --profile deployer declare --contract-name AjoCore
sncast --profile deployer declare --contract-name AjoMembers
sncast --profile deployer declare --contract-name AjoPayments
sncast --profile deployer declare --contract-name AjoSchedule
sncast --profile deployer declare --contract-name AjoCollateral
sncast --profile deployer declare --contract-name AjoGovernance
sncast --profile deployer declare --contract-name AjoFactory
```

Save each class hash from the output.

## Using Starkli (Alternative Tool)

If you prefer starkli over sncast:

```bash
# Set environment variables
export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json
export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json
export STARKNET_RPC=https://starknet-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Declare contracts
starkli declare target/dev/ajo_save_AjoCore.contract_class.json --watch
starkli declare target/dev/ajo_save_AjoMembers.contract_class.json --watch
# ... repeat for all contracts

# Deploy factory
starkli deploy <CLASS_HASH> <CONSTRUCTOR_ARGS> --watch
```

## Contracts to Deploy

1. **AjoCore** - Core Ajo logic and state management
2. **AjoMembers** - Member management
3. **AjoPayments** - Payment processing
4. **AjoSchedule** - Scheduling and cycles
5. **AjoCollateral** - Collateral management
6. **AjoGovernance** - Governance and voting
7. **AjoFactory** - Factory for deploying Ajo instances

## Verification

After deployment, verify on:
- [Starkscan Sepolia](https://sepolia.starkscan.co/)
- [Voyager Sepolia](https://sepolia.voyager.online/)

Search for your factory address and verify the deployment.

## Troubleshooting

### RPC Connection Issues
- Use Alchemy or Infura instead of public RPCs
- Check your internet connection
- Try different RPC endpoints

### Account Not Found
- Ensure account is deployed on Sepolia
- Verify you have testnet ETH
- Check the account address is correct

### Declaration Fails
- Ensure you have enough ETH for gas
- Check the contract compiles without errors
- Verify RPC endpoint is working

### Max Fee Issues
- Let sncast auto-estimate fees (don't specify --max-fee)
- Ensure you have sufficient balance

## Next Steps

1. **Get a reliable RPC endpoint** (Alchemy/Infura)
2. **Fund your account** with testnet ETH
3. **Run the declaration script**
4. **Deploy the factory** with class hashes
5. **Test the deployment** by creating an Ajo instance

## Resources

- [Starknet Book](https://book.starknet.io/)
- [Starknet Foundry Docs](https://foundry-rs.github.io/starknet-foundry/)
- [Starkli Book](https://book.starkli.rs/)
- [Starknet Faucet](https://starknet-faucet.vercel.app/)
- [Alchemy](https://www.alchemy.com/)
- [Infura](https://www.infura.io/)
