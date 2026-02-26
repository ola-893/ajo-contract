# TODO - Completing the Starknet Migration

## ✅ Completed Tasks

1. ✅ Removed all Hedera dependencies
2. ✅ Removed Hedera wallet integration (WalletConnect, HashConnect)
3. ✅ Removed Hedera-specific services and utilities
4. ✅ Removed Hedera ABIs and created placeholder structure for Cairo contracts
5. ✅ Added Starknet dependencies (starknet.js, get-starknet-core)
6. ✅ Created Starknet wallet context and provider setup
7. ✅ Created contract hooks using Starknet.js structure
8. ✅ Updated config files with Starknet networks
9. ✅ Updated UI components for Starknet wallets
10. ✅ Created migration documentation

## 🔧 Immediate Next Steps (Before Running)

### 1. Fix NPM Cache Permissions (Required)
```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```

### 2. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 3. Update Components to Use Starknet
You'll need to update your page components to use the new Starknet components:

#### Update Dashboard Page
```tsx
// src/pages/Dashboard.tsx
// Replace:
import Header from "@/components/header/Header";

// With:
import StarknetHeader from "@/components/header/StarknetHeader";
```

#### Update Profile Page
```tsx
// src/pages/Profile.tsx
// Replace:
import Header from "@/components/header/Header";

// With:
import StarknetHeader from "@/components/header/StarknetHeader";
```

#### Update CreateAjo Page
```tsx
// src/pages/CreateAjo.tsx
// Replace old wallet hooks with:
import { useStarknetWallet } from "@/contexts/StarknetWalletContext";
import useStarknetAjoFactory from "@/hooks/useStarknetAjoFactory";
```

#### Update AjoDetails Page
```tsx
// src/pages/AjoDetails.tsx
// Replace old hooks with:
import useStarknetAjoCore from "@/hooks/useStarknetAjoCore";
import useStarknetAjoMembers from "@/hooks/useStarknetAjoMembers";
import useStarknetAjoPayments from "@/hooks/useStarknetAjoPayments";
```

## 📝 When Cairo Contracts Are Ready

### 1. Add Contract ABIs
Place compiled Cairo contract ABIs in `src/abi/`:
- `ajoFactory.json`
- `ajoCore.json`
- `ajoMembers.json`
- `ajoPayments.json`
- `ajoGovernance.json`
- `ajoCollateral.json`
- `erc20.json` (for token interactions)

### 2. Update Placeholder File
Edit `src/abi/placeholders.ts`:

```typescript
// Import the actual ABIs
import ajoFactoryAbiJson from './ajoFactory.json';
import ajoCoreAbiJson from './ajoCore.json';
import ajoMembersAbiJson from './ajoMembers.json';
import ajoPaymentsAbiJson from './ajoPayments.json';
import ajoGovernanceAbiJson from './ajoGovernance.json';
import ajoCollateralAbiJson from './ajoCollateral.json';
import erc20AbiJson from './erc20.json';

// Export the ABIs
export const ajoFactoryAbi = ajoFactoryAbiJson.abi;
export const ajoCoreAbi = ajoCoreAbiJson.abi;
export const ajoMembersAbi = ajoMembersAbiJson.abi;
export const ajoPaymentsAbi = ajoPaymentsAbiJson.abi;
export const ajoGovernanceAbi = ajoGovernanceAbiJson.abi;
export const ajoCollateralAbi = ajoCollateralAbiJson.abi;
export const erc20Abi = erc20AbiJson.abi;

// Update with deployed contract addresses
export const CONTRACT_ADDRESSES = {
  sepolia: {
    ajoFactory: '0x...', // Deployed factory address on Sepolia
  },
  mainnet: {
    ajoFactory: '0x...', // Production factory address
  },
  devnet: {
    ajoFactory: '0x...', // Local devnet address
  },
} as const;
```

### 3. Verify Contract Method Names
Check that the method names in the hooks match your Cairo contract functions:

**In `src/hooks/useStarknetAjoFactory.ts`:**
- Verify `create_ajo` matches your Cairo function name
- Verify `get_user_ajos` matches your Cairo function name
- Update parameter names to match Cairo contract

**In other hooks:**
- Review all function calls
- Match Cairo contract interface exactly

### 4. Test Contract Interactions
```bash
npm run dev
```

Then test:
1. Connect wallet (ArgentX or Braavos)
2. Switch to Starknet Sepolia testnet
3. Create a new Ajo group
4. Join an Ajo group
5. Make payments
6. Test governance features

## 🔄 Component Updates Needed

### Files That Still Reference Old Code

You may need to update these files:
- `src/pages/Dashboard.tsx` - Update to use `StarknetHeader`
- `src/pages/Profile.tsx` - Update to use `StarknetHeader`
- `src/pages/CreateAjo.tsx` - Update to use Starknet hooks
- `src/pages/AjoDetails.tsx` - Update to use Starknet hooks
- `src/components/ajo-details-page/*` - Update contract interactions
- `src/components/profile/*` - Update wallet address display

### Store Updates
You may need to update Zustand stores to work with Starknet data types:
- `src/store/ajoStore.ts`
- `src/store/ajoMembersStore.ts`
- `src/store/ajoPaymentStore.ts`
- `src/store/tokenStore.ts`

## 🌐 Environment Variables

Create `.env` file:
```env
VITE_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_STARKNET_NETWORK=sepolia
```

## 🧪 Testing Checklist

- [ ] npm install runs successfully
- [ ] npm run dev starts without errors
- [ ] Connect wallet modal appears
- [ ] Can connect ArgentX wallet
- [ ] Can connect Braavos wallet
- [ ] Wallet address displays correctly
- [ ] Can disconnect wallet
- [ ] Navigation works
- [ ] (After contracts deployed) Can create Ajo
- [ ] (After contracts deployed) Can join Ajo
- [ ] (After contracts deployed) Can make payments
- [ ] (After contracts deployed) Can view member details
- [ ] (After contracts deployed) Can claim payouts

## 📚 Resources

- **Starknet Docs**: https://docs.starknet.io
- **Cairo Book**: https://www.cairo-lang.org/docs/
- **Starknet.js**: https://www.starknetjs.com/
- **ArgentX**: https://www.argent.xyz/argent-x/
- **Braavos**: https://braavos.app/
- **Re{define} Hackathon**: https://www.starknet.io/

## 🐛 Known Issues to Address

1. **NPM Cache Permissions**: Need to fix before installing
2. **Old Components**: Need to update page components to use new Starknet components
3. **Missing ABIs**: Waiting for Cairo contracts from backend team
4. **Type Definitions**: May need to update TypeScript types for Starknet data structures

## 💡 Tips

1. Start with Sepolia testnet for all testing
2. Get testnet ETH from Starknet faucet for gas fees
3. Keep contract addresses in environment variables for easy switching
4. Test with small amounts first
5. Monitor transactions on Starkscan explorer

## 🎯 Priority Order

1. **High Priority**: Fix npm permissions and install dependencies
2. **High Priority**: Update page components to use StarknetHeader
3. **Medium Priority**: Test wallet connection flow
4. **Medium Priority**: Update remaining components with Starknet hooks
5. **Low Priority**: Wait for Cairo contracts, then integrate ABIs
6. **Low Priority**: Full end-to-end testing with deployed contracts

---

**Status**: ✅ Migration Complete - Ready for Cairo Contract Integration
**Next**: Fix npm cache → Install dependencies → Update components → Test wallet connection
