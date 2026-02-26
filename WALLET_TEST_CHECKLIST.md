# 🔐 Wallet Connection Test Checklist

## ✅ Dev Server Status
- **Status**: ✅ Running at http://localhost:5173/
- **Network**: Starknet Sepolia Testnet

---

## 📋 Testing Steps

### 1️⃣ **Prepare Your Wallet**
Before testing, make sure you have:
- [ ] ArgentX wallet extension installed **OR** Braavos wallet extension
- [ ] Wallet set to **Starknet Sepolia Testnet**
- [ ] Some test ETH in your wallet (get from [Starknet Faucet](https://faucet.goerli.starknet.io/))

### 2️⃣ **Test Wallet Connection**
- [ ] Open http://localhost:5173/ in your browser
- [ ] Click the "Connect Wallet" button in the header
- [ ] Wallet modal should appear with ArgentX and Braavos options
- [ ] Click on your wallet (ArgentX or Braavos)
- [ ] Wallet extension should pop up requesting connection
- [ ] Approve the connection in your wallet
- [ ] Your address should appear in the header (formatted as `0x1234...5678`)
- [ ] Toast notification: "Wallet connected successfully"

### 3️⃣ **Verify Wallet Display**
After connecting, check:
- [ ] Wallet dropdown in header shows your full address
- [ ] Green dot indicator shows "Connected"
- [ ] "Starknet Wallet" label is displayed
- [ ] Copy button works (click and verify "Address copied!" toast)
- [ ] ETH balance shows (currently 0.00 - will work when contracts ready)
- [ ] USDC balance shows (currently 0.00 - will work when contracts ready)

### 4️⃣ **Test Wallet Disconnection**
- [ ] Click on the wallet dropdown
- [ ] Click "Disconnect" button
- [ ] Wallet should disconnect
- [ ] Header should show "Connect Wallet" button again
- [ ] Toast notification: "Wallet disconnected"

### 5️⃣ **Test Auto-Reconnect**
- [ ] Connect your wallet
- [ ] Refresh the page (F5 or Cmd+R)
- [ ] Wallet should automatically reconnect
- [ ] Your address should still be displayed

### 6️⃣ **Test Mobile Responsive**
- [ ] Open browser DevTools (F12)
- [ ] Toggle device toolbar (mobile view)
- [ ] Test wallet connection on mobile view
- [ ] Verify modal works properly
- [ ] Check hamburger menu shows wallet status

---

## 🐛 Known Issues / Expected Behavior

### ⚠️ Normal Warnings (Ignore These)
- **Node.js version warning**: Vite prefers newer Node but 20.18.0 works fine
- **Console warnings**: "Awaiting Cairo contract implementation" - This is expected!

### ✅ What Should Work
- ✅ Wallet connection (ArgentX & Braavos)
- ✅ Wallet disconnection
- ✅ Address display & copy
- ✅ Auto-reconnect on page refresh
- ✅ Toast notifications
- ✅ Modal interactions

### ⏳ What Won't Work Yet (Needs Cairo Contracts)
- ⏳ Balance fetching (ETH, USDC)
- ⏳ Creating Ajo groups
- ⏳ Joining Ajo
- ⏳ Making payments
- ⏳ Governance/voting
- ⏳ All transaction functions

---

## 🎯 Success Criteria

**Your wallet integration is working if:**
1. ✅ You can connect ArgentX or Braavos
2. ✅ Your address appears in the header
3. ✅ You can copy your address
4. ✅ You can disconnect the wallet
5. ✅ Auto-reconnect works after page refresh
6. ✅ No console errors related to wallet connection

---

## 📸 What to Look For

### **Connected State:**
```
┌─────────────────────────────────────┐
│  Header                              │
│  ┌──────────────────────┐           │
│  │ ● Starknet Wallet    │ ← Green dot
│  │ 0x1234...5678        │ ← Your address
│  │ 0.00 ETH | 0.00 USDC │           │
│  └──────────────────────┘           │
└─────────────────────────────────────┘
```

### **Disconnected State:**
```
┌─────────────────────────────────────┐
│  Header                              │
│  ┌──────────────────┐               │
│  │ Connect Wallet   │               │
│  └──────────────────┘               │
└─────────────────────────────────────┘
```

---

## 🆘 Troubleshooting

### Problem: Wallet doesn't connect
**Solutions:**
1. Make sure wallet is on **Starknet Sepolia Testnet**
2. Try refreshing the page
3. Check if wallet extension is unlocked
4. Clear browser cache and try again

### Problem: Address not showing
**Solutions:**
1. Open browser console (F12) - check for errors
2. Disconnect and reconnect wallet
3. Make sure wallet approved the connection

### Problem: Console errors
**Solutions:**
1. If error mentions "Cairo contracts" - this is expected!
2. If error mentions wallet connection - check wallet extension
3. Share the error in the console for help

---

## 📝 Test Results

**Date**: _________________  
**Wallet Used**: □ ArgentX  □ Braavos  
**Browser**: _________________  
**Network**: Starknet Sepolia  

### Results:
- [ ] Connection works
- [ ] Disconnection works  
- [ ] Auto-reconnect works
- [ ] Address display works
- [ ] Copy address works
- [ ] No critical errors

**Notes:**
_______________________________________
_______________________________________
_______________________________________

---

## ✨ Next Steps After Successful Test

Once wallet connection is confirmed working:
1. ✅ Mark this task as complete
2. 🔄 Wait for Cairo contracts from backend dev
3. 🔌 Integrate contract ABIs when ready
4. 🧪 Test contract interactions
5. 🚀 Deploy to production

---

**Ready to test? Open http://localhost:5173/ and start checking items!** 🎉
