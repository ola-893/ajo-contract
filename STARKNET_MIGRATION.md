# Starknet Migration Guide

This project has been migrated from **Hedera** to **Starknet** blockchain to participate in the Re{define} Hackathon focused on Privacy and Bitcoin on Starknet.

## 🎯 Migration Summary

### What Changed
- ✅ Removed all Hedera dependencies (@hashgraph/sdk, @hashgraph/hedera-wallet-connect, hashconnect)
- ✅ Removed Ethereum-specific dependencies (ethers.js)
- ✅ Added Starknet dependencies (starknet.js v6.11.0, @starknet-io/get-starknet-core)
- ✅ Created new Starknet wallet context for ArgentX and Braavos wallets
- ✅ Updated network configuration for Starknet (Sepolia testnet, Mainnet, Devnet)
- ✅ Created placeholder structure for Cairo contract ABIs
- ✅ Built new contract hooks compatible with Starknet.js
- ✅ Updated UI components to work with Starknet wallets

### What's Ready
1. **Wallet Integration**: Full support for ArgentX and Braavos wallets
2. **Network Configuration**: Sepolia testnet, Mainnet, and Devnet configured
3. **Contract Hooks**: Ready-to-use hooks for interacting with Cairo contracts
4. **UI Components**: Updated wallet modal and header components

## 📋 Next Steps

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

**Note**: You may need to fix npm cache permissions first:
```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```

### 2. Add Cairo Contract ABIs
Once your backend dev provides the compiled Cairo contracts:

1. Place the ABIs in `src/abi/` directory:
   - `ajoFactory.json`
   - `ajoCore.json`
   - `ajoMembers.json`
   - `ajoPayments.json`
   - `ajoGovernance.json`
   - `ajoCollateral.json`
   - `erc20.json`

2. Update `src/abi/placeholders.ts`:
```typescript
import ajoFactoryAbi from './ajoFactory.json';
import ajoCoreAbi from './ajoCore.json';
// ... import other ABIs

export { ajoFactoryAbi, ajoCoreAbi, ... };

export const CONTRACT_ADDRESSES = {
  sepolia: {
    ajoFactory: '0x...', // Your deployed factory address
  },
  mainnet: {
    ajoFactory: '0x...', // Production factory address
  },
};
```

### 3. Update Components to Use Starknet
Replace old components with Starknet versions:

**Example - Update Dashboard:**
```tsx
// Old
import Header from "@/components/header/Header";

// New
import StarknetHeader from "@/components/header/StarknetHeader";
```

**Example - Use Wallet Context:**
```tsx
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";

function MyComponent() {
  const { address, isConnected, connectWallet } = useStarknetWallet();
  
  // Your component logic
}
```

**Example - Use Contract Hooks:**
```tsx
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";

function CreateAjo() {
  const { createAjo } = useStarknetAjoFactory();
  
  const handleCreate = async () => {
    await createAjo({
      name: "My Ajo Group",
      contributionAmount: "100",
      cycleLength: 12,
      maxMembers: 10,
      collateralPercentage: 10,
      paymentToken: 0, // USDC
    });
  };
}
```

### 4. Environment Variables
Create a `.env` file:
```env
# Optional: WalletConnect Project ID for enhanced wallet connection
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# Network (sepolia, mainnet, devnet)
VITE_STARKNET_NETWORK=sepolia
```

### 5. Test the Application
```bash
npm run dev
```

## 🔧 Available Starknet Hooks

### `useStarknetWallet`
Manages wallet connection and state.
```tsx
const {
  account,      // Starknet account interface
  address,      // Connected wallet address
  provider,     // Starknet provider
  isConnected,  // Connection status
  isConnecting, // Loading state
  connectWallet,
  disconnectWallet,
  chainId,      // Current network chain ID
} = useStarknetWallet();
```

### `useStarknetAjoFactory`
Interact with the Ajo Factory contract.
```tsx
const {
  createAjo,           // Create new Ajo group
  getUserAjos,         // Get user's Ajo groups
  getAllActiveAjos,    // Get all active Ajos
} = useStarknetAjoFactory();
```

### `useStarknetAjoCore`
Interact with a specific Ajo Core contract.
```tsx
const {
  getAjoDetails,
  getOperationalStatus,
  initializeAjo,
  startCycle,
} = useStarknetAjoCore(ajoCoreAddress);
```

### `useStarknetAjoMembers`
Manage Ajo membership.
```tsx
const {
  joinAjo,
  getAllMembersDetails,
  getMemberInfo,
  leaveAjo,
} = useStarknetAjoMembers(ajoMembersAddress);
```

### `useStarknetAjoPayments`
Handle payments and payouts.
```tsx
const {
  makePayment,
  getPaymentHistory,
  claimPayout,
  getCurrentPayoutRecipient,
} = useStarknetAjoPayments(ajoPaymentsAddress);
```

## 🌐 Network Configuration

### Starknet Sepolia (Testnet)
- Chain ID: `0x534e5f5345504f4c4941`
- RPC: `https://starknet-sepolia.public.blastapi.io/rpc/v0_7`
- Explorer: `https://sepolia.starkscan.co`

### Starknet Mainnet
- Chain ID: `0x534e5f4d41494e`
- RPC: `https://starknet-mainnet.public.blastapi.io/rpc/v0_7`
- Explorer: `https://starkscan.co`

## 🔐 Supported Wallets
- **ArgentX**: https://www.argent.xyz/argent-x/
- **Braavos**: https://braavos.app/

## 📚 Cairo Contract Structure

Your Cairo contracts should follow this general structure:

```cairo
#[starknet::interface]
trait IAjoFactory<TContractState> {
    fn create_ajo(
        ref self: TContractState,
        name: felt252,
        contribution_amount: u256,
        cycle_length: u32,
        max_members: u32,
        collateral_percentage: u8,
        payment_token: u8
    ) -> ContractAddress;
    
    fn get_user_ajos(self: @TContractState, user: ContractAddress) -> Array<ContractAddress>;
}
```

## 🎨 Privacy & Bitcoin Features

As this is for the Re{define} Hackathon focusing on Privacy and Bitcoin:

### Potential Privacy Enhancements
- Private member contributions (ZK proofs)
- Encrypted payment history
- Anonymous voting in governance

### Potential Bitcoin Integration
- Bitcoin-backed collateral
- BTC payment options
- Cross-chain bridges

## 📝 Files Modified/Created

### Deleted (Hedera-specific)
- `src/auth/WalletContext.tsx`
- `src/contexts/MetamaskContext.tsx`
- `src/contexts/WalletConnectContext.tsx`
- `src/hooks/useMetamask.ts`
- `src/hooks/useHcsTopicCreation.ts`
- `src/hooks/useHcsVoting.ts`
- `src/lib/hederaConfig.ts`
- `src/services/wallets/*` (entire folder)
- All old ABI files

### Created (Starknet-specific)
- `src/contexts/StarknetWalletContext.tsx`
- `src/hooks/useStarknetAjoFactory.ts`
- `src/hooks/useStarknetAjoCore.ts`
- `src/hooks/useStarknetAjoMembers.ts`
- `src/hooks/useStarknetAjoPayments.ts`
- `src/components/header/StarknetHeader.tsx`
- `src/abi/placeholders.ts`
- `src/abi/README.md`

### Modified
- `package.json` - Updated dependencies
- `src/main.tsx` - Using StarknetWalletProvider
- `src/config/networks.ts` - Starknet networks
- `src/config/constants.ts` - Starknet configuration
- `src/components/ui/WalletModal.tsx` - Starknet wallets

## 🚀 Deployment

When deploying your Cairo contracts to Starknet:

1. Compile your Cairo contracts
2. Deploy to Starknet Sepolia testnet first
3. Update contract addresses in `src/abi/placeholders.ts`
4. Test thoroughly
5. Deploy to mainnet when ready

## 🐛 Troubleshooting

### "No Starknet wallet detected"
- Install ArgentX or Braavos browser extension
- Make sure the extension is enabled
- Refresh the page

### "Failed to connect wallet"
- Check that you're on the correct network
- Ensure wallet is unlocked
- Try disconnecting and reconnecting

### Contract interaction fails
- Verify contract addresses are correct
- Check that ABIs match deployed contracts
- Ensure sufficient funds for gas fees

## 📞 Support

For questions about:
- **Starknet Development**: https://docs.starknet.io
- **Cairo Language**: https://www.cairo-lang.org/docs/
- **Re{define} Hackathon**: https://www.starknet.io/

---

**Happy Building on Starknet! 🚀**
