# WBTC Migration Summary

## Overview
Successfully replaced BTC with Wrapped BTC (WBTC) throughout the Ajo.Save frontend application.

## WBTC Contract Address
- **Starknet Sepolia**: `0x0496bef3ed20371382fBe0CA6A5a64252c5c848F9f1F0ccCF8110Fc4def912d5`

## Files Modified

### 1. Configuration Files
- **frontend/src/config/constants.ts**
  - Replaced `BTC` with `WBTC` in TOKEN_ADDRESSES
  - Added WBTC contract address for Sepolia network

### 2. Hooks
- **frontend/src/hooks/useTokenBalance.ts**
  - Updated type to support `"WBTC"` instead of `"BTC"`
  
- **frontend/src/hooks/useStarknetAjoFactory.ts**
  - Updated `AjoPaymentToken` type: `"USDC" | "WBTC"`
  - Updated `buildPaymentTokenEnum` to handle WBTC
  - Updated `parsePaymentToken` to handle WBTC (with backward compatibility for BTC)

### 3. Pages
- **frontend/src/pages/Profile.tsx**
  - Replaced `btcBalance` with `wbtcBalance`
  - Updated price fetching to use "wrapped-bitcoin" from CoinGecko API
  - Updated all state variables and props to use WBTC

- **frontend/src/pages/CreateAjo.tsx**
  - Updated payment token dropdown: `<option value="WBTC">WBTC</option>`
  - Updated type annotation: `"USDC" | "WBTC"`

- **frontend/src/pages/AjoDetails.tsx**
  - Updated decimals check to use `"WBTC"` instead of `"BTC"`

### 4. Components

#### Profile Components
- **frontend/src/components/profile/UserProfileCard.tsx**
  - Updated interface props: `wbtc`, `wbtcPrice` instead of `eth`, `ethPrice`
  - Updated card display to show "WBTC" and "Wrapped Bitcoin"
  - Updated USD calculations to use WBTC price

#### Header Components
- **frontend/src/components/header/Header.tsx**
  - Added WBTC balance fetching
  - Added WBTC to desktop dropdown balance display
  - Added WBTC to mobile menu balance display
  - Updated balance loading states to include WBTC

#### Ajo Detail Components
- **frontend/src/components/ajo-details-page/AjoDetailsCard.tsx**
  - Updated payment token checks to use `"WBTC"`
  - Updated token address references to use `TOKEN_ADDRESSES.sepolia.WBTC`

- **frontend/src/components/ajo-details-page/AjoPaymentHistory.tsx**
  - Updated token decimals check to use `"WBTC"`
  - Updated token address references

- **frontend/src/components/ajo-details-page/AjoMembers.tsx**
  - Updated token decimals check to use `"WBTC"`

- **frontend/src/components/ajo-details-page/AjoAdvancedModules.tsx**
  - Updated token decimals check to use `"WBTC"`

## Key Features Implemented

### 1. WBTC Balance Display
- Profile page now shows WBTC balance with real-time fetching
- Header dropdown displays WBTC alongside STRK and USDC
- Mobile menu includes WBTC balance

### 2. Price Integration
- Integrated CoinGecko API for Wrapped Bitcoin price
- USD value calculations for WBTC holdings
- Total portfolio value includes WBTC

### 3. Token Selection
- Create Ajo form now offers WBTC as payment token option
- All Ajo operations support WBTC with 8 decimal places

### 4. Backward Compatibility
- Factory hook maintains compatibility with existing "BTC" enum in smart contracts
- Parser functions handle both "BTC" and "WBTC" strings

## Testing Checklist
- [ ] Verify WBTC balance fetches correctly on Profile page
- [ ] Check WBTC displays in header dropdown (desktop)
- [ ] Check WBTC displays in mobile menu
- [ ] Test creating new Ajo with WBTC as payment token
- [ ] Verify WBTC price fetching from CoinGecko
- [ ] Test USD calculations for WBTC holdings
- [ ] Verify 8 decimal places for WBTC amounts
- [ ] Test joining existing WBTC-based Ajo groups

## Notes
- WBTC uses 8 decimal places (like Bitcoin)
- USDC uses 6 decimal places
- Smart contract enum still uses "BTC" internally, frontend maps WBTC → BTC enum
- All references to "Bitcoin" in UI now show "Wrapped Bitcoin"

