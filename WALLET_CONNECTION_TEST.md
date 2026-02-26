# Starknet Wallet Connection Testing Guide

## Prerequisites

Before testing, make sure you have one of the following Starknet wallets installed:

### ArgentX (Recommended)
1. Install from Chrome Web Store: https://www.argent.xyz/argent-x/
2. Create a new wallet or import existing one
3. Switch to **Starknet Sepolia Testnet**
4. Get test ETH from faucet: https://starknet-faucet.vercel.app/

### Braavos
1. Install from Chrome Web Store: https://braavos.app/
2. Create a new wallet or import existing one
3. Switch to **Starknet Sepolia Testnet**
4. Get test ETH from faucet: https://starknet-faucet.vercel.app/

## Testing Steps

### 1. Start the Application
```bash
npm run dev
```
Visit http://localhost:5173/

### 2. Test Wallet Connection

#### Connect Wallet
1. Click the **"Connect Wallet"** button in the header
2. A modal should appear with "Starknet Wallet (ArgentX, Braavos)" option
3. Click the wallet option
4. Your wallet extension should popup asking for connection approval
5. Approve the connection in your wallet
6. The modal should close automatically
7. You should see:
   - Your wallet address (shortened) in the header
   - Balance display showing "0.00 ETH | 0.00 USDC"
   - A green dot indicator showing "Connected"

#### Verify Connection
1. Click on the wallet balance dropdown
2. You should see:
   - ✅ "Connected Wallet" header
   - ✅ "Starknet Wallet" label with green dot
   - ✅ Your full address (truncated with copy button)
   - ✅ ETH Balance: 0.00
   - ✅ USDC Balance: 0.00
   - ✅ "Disconnect" button

#### Test Copy Address
1. Click the copy icon next to your address
2. You should see a toast notification: "Address copied!"
3. The icon should briefly change to a checkmark
4. Paste somewhere to verify the full address was copied

#### Test Disconnect
1. Click the **"Disconnect"** button
2. You should see a toast notification: "Wallet disconnected"
3. The header should return to showing "Connect Wallet" button
4. Balances should be cleared

### 3. Test Wallet Switching (If you have multiple wallets)

1. Connect with ArgentX
2. Disconnect
3. Connect with Braavos
4. Both should work seamlessly

### 4. Test Persistence (Page Refresh)

1. Connect your wallet
2. Refresh the page (F5)
3. The wallet should **automatically reconnect** without showing the modal
4. Your address and connection status should be restored

### 5. Mobile Responsive Testing

1. Open the app on mobile or resize browser to mobile size
2. Click the hamburger menu (☰)
3. The mobile menu should show:
   - Navigation links (Dashboard, Profile)
   - Wallet section at the bottom
4. Test connect/disconnect from mobile menu

## Expected Behavior

### ✅ Success Indicators
- Modal opens and closes smoothly
- Wallet extension popup appears
- Connection completes without errors
- Address displays correctly
- Toast notifications appear for all actions
- Disconnect clears all wallet data
- Reconnection works after page refresh

### ❌ Common Issues & Solutions

#### Issue: "No Starknet wallet detected"
**Solution:** Install ArgentX or Braavos wallet extension

#### Issue: Wallet doesn't popup
**Solution:** 
- Check if wallet extension is installed and unlocked
- Try refreshing the page
- Check browser console for errors

#### Issue: Connection fails
**Solution:**
- Make sure wallet is on Starknet Sepolia Testnet
- Try disconnecting and reconnecting
- Clear browser cache and try again

#### Issue: Balance not showing
**Solution:**
- This is expected! Contract integration for balance fetching will be implemented when Cairo contracts are ready
- Currently shows placeholder "0.00" values

## Console Logs to Check

Open browser DevTools (F12) and check console for:
- ✅ "Connected to Starknet wallet: 0x..." (on successful connection)
- ✅ "Disconnected from Starknet wallet" (on disconnect)
- ✅ "Loading balances for: 0x..." (when connected)
- ❌ No error messages in red

## Next Steps After Successful Testing

Once wallet connection is verified:
1. ✅ Wallet can connect/disconnect
2. ⏳ Wait for Cairo contracts to be deployed
3. ⏳ Update contract addresses in `src/abi/placeholders.ts`
4. ⏳ Implement balance fetching using Starknet.js
5. ⏳ Implement contract interactions (create Ajo, join, pay, etc.)

## Network Configuration

Current configuration (see `src/config/networks.ts`):
- **Network:** Starknet Sepolia Testnet
- **Chain ID:** 0x534e5f5345504f4c4941
- **RPC:** https://starknet-sepolia.public.blastapi.io/rpc/v0_7
- **Explorer:** https://sepolia.starkscan.co

## Questions or Issues?

If you encounter any issues:
1. Check the browser console for error messages
2. Verify wallet is installed and on Sepolia testnet
3. Try clearing cache and reconnecting
4. Check that `npm install --legacy-peer-deps` completed successfully

---

**Status:** ✅ Ready for Testing
**Last Updated:** 2026-02-23
