#!/usr/bin/env node
const { ethers } = require("hardhat");
const console = require("console");

// Color utilities
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
  bright: (text) => `\x1b[1m${text}\x1b[0m`
};

// ================================================================
// 🔧 CONFIGURATION - OFFICIAL TOKEN ADDRESSES
// ================================================================
// IMPORTANT: HTS (Hedera Token Service) tokens require association
// before accounts can hold, transfer, or approve them.
// This is a Hedera-specific requirement not present on standard EVM chains.
// ================================================================

// Your deployed factory address
const FACTORY_ADDRESS = "0x40F3645F0A0AE14565F82b49AFfdF6a8E70ba08e";

 const OFFICIAL_TOKEN_ADDRESSES = {
    mainnet: {
      USDC: "0x000000000000000000000000000000000006f89a", // Circle USDC (0.0.456858)
      WHBAR: "0xb1f616b8134f602c3bb465fb5b5e6565ccad37ed"  // Official WHBAR (0.0.8840785)
    },
    testnet: {
      USDC: "0x0000000000000000000000000000000000068cda",   // Circle USDC (0.0.429274)
      WHBAR: "0xb1f616b8134f602c3bb465fb5b5e6565ccad37ed"  // Official WHBAR (0.0.1456986)
    }
  };


// Auto-detect network from environment or default to testnet
const NETWORK = process.env.HEDERA_NETWORK || "testnet";
const TOKEN_ADDRESSES = OFFICIAL_TOKEN_ADDRESSES[NETWORK];

console.log(c.cyan(`\n🌐 Network: ${NETWORK.toUpperCase()}`));
console.log(c.dim(`   USDC: ${TOKEN_ADDRESSES.USDC}`));
console.log(c.dim(`   WHBAR: ${TOKEN_ADDRESSES.WHBAR}\n`));

// ================================================================

const DEMO_CONFIG = {
  TOTAL_PARTICIPANTS: 9,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  GAS_LIMIT: {
    CREATE_AJO: 2000000,
    INIT_PHASE_2: 1500000,
    INIT_PHASE_3: 1500000,
    INIT_PHASE_4: 1800000,
    INIT_PHASE_5: 2000000,
    JOIN_AJO: 1000000,
    FUND_USER: 1500000,
    HTS_APPROVE: 800000,
    PROCESS_PAYMENT: 1000000,
  }
};

const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const formatHBAR = (amount) => ethers.utils.formatUnits(amount, 8);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================================================================
// HTS TOKEN ASSOCIATION HELPER
// ================================================================
async function associateHtsToken(signer, tokenAddress) {
  try {
    const iHTS = new ethers.utils.Interface([
      "function associateToken(address account, address token) external returns (int64 responseCode)"
    ]);
    const htsPrecompile = new ethers.Contract(
      "0x0000000000000000000000000000000000000167",
      iHTS,
      signer
    );
    
    const tx = await htsPrecompile.associateToken(
      signer.address,
      tokenAddress,
      { gasLimit: 1000000 }
    );
    const receipt = await tx.wait();
    
    // Check response code in logs if available
    return { success: true, receipt };
  } catch (error) {
    // Common error: TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT (code 163)
    if (error.message.includes("TOKEN_ALREADY_ASSOCIATED") || 
        error.message.includes("163")) {
      return { success: true, alreadyAssociated: true };
    }
    throw error;
  }
}

// ================================================================
// RETRY UTILITIES
// ================================================================
async function retryWithBackoff(operation, operationName, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(c.dim(`    ⏳ Attempt ${attempt}/${maxRetries}: ${operationName}`));
      const result = await operation();
      console.log(c.green(`    ✅ ${operationName} succeeded`));
      return result;
    } catch (error) {
      const isNetworkError = 
        error.message.includes('could not detect network') ||
        error.message.includes('other-side closed') || 
        error.message.includes('SocketError') ||
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('502') ||
        error.message.includes('NETWORK_ERROR');
      
      if (isNetworkError && attempt < maxRetries) {
        const backoffTime = DEMO_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(c.yellow(`    ⚠️ Network error on attempt ${attempt}: ${error.message.slice(0, 100)}`));
        console.log(c.dim(`    🔄 Retrying in ${backoffTime/1000} seconds with exponential backoff...`));
        
        try {
          await ethers.provider.getNetwork();
        } catch (e) {
          console.log(c.yellow(`    ⚠️ Provider reconnection failed, continuing...`));
        }
        
        await sleep(backoffTime);
        continue;
      }
      
      console.log(c.red(`    ❌ ${operationName} failed: ${error.message.slice(0, 150)}`));
      
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}

async function retryOperation(operation, operationName, maxRetries = DEMO_CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      console.log(c.green(`  ✅ ${operationName} succeeded`));
      return result;
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(c.yellow(`  ⚠️ ${operationName} failed (attempt ${attempt}): ${error.message}`));
        await sleep(DEMO_CONFIG.RETRY_DELAY);
        continue;
      }
      console.log(c.red(`  ❌ ${operationName} failed: ${error.message}`));
      throw error;
    }
  }
}

async function validateAjoHealth(ajoFactory, ajoId, expectedPhase, operationName) {
  console.log(c.dim(`    🔍 Validating ${operationName}...`));
  
  try {
    const status = await ajoFactory.getAjoInitializationStatus(ajoId);
    
    if (status.phase < expectedPhase) {
      throw new Error(`Phase ${expectedPhase} not reached. Current: ${status.phase}`);
    }
    
    console.log(c.green(`    ✅ Health Check: Phase ${status.phase}, Ready: ${status.isReady}, Finalized: ${status.isFullyFinalized}`));
    
    // Show operational status if ready (phase 4+)
    if (status.isReady) {
      try {
        const operationalStatus = await ajoFactory.getAjoOperationalStatus(ajoId);
        console.log(c.dim(`       Members: ${operationalStatus.totalMembers}, Can Accept: ${operationalStatus.canAcceptMembers}`));
      } catch (error) {
        console.log(c.dim(`       Operational status unavailable: ${error.message}`));
      }
    }
    
    return true;
  } catch (error) {
    console.log(c.red(`    ❌ Health validation failed: ${error.message}`));
    return false;
  }
}

async function connectToFactoryAndEnsureHealthyAjo() {
  console.log(c.blue("\n🏭 Connecting to Factory & Ensuring Healthy Ajo..."));
  
  const network = await ethers.provider.getNetwork();
  console.log(c.dim(`  🌐 Network: ${network.name} (${network.chainId})`));
  
  const [deployer] = await ethers.getSigners();
  console.log(c.dim(`  👤 Deployer: ${deployer.address}`));
  
  // Connect to factory
  const AjoFactory = await ethers.getContractFactory("AjoFactory");
  const ajoFactory = AjoFactory.attach(FACTORY_ADDRESS);
  
  const totalAjos = await ajoFactory.totalAjos();
  console.log(c.green(`  ✅ Factory connected! Total Ajos: ${totalAjos}`));
  
  // Connect to official HTS tokens
  console.log(c.cyan("\n  🪙 Connecting to Official HTS Tokens..."));
  console.log(c.bright(`     Circle USDC: ${TOKEN_ADDRESSES.USDC}`));
  console.log(c.bright(`     Hedera WHBAR: ${TOKEN_ADDRESSES.WHBAR}`));
  
  const usdc = new ethers.Contract(
    TOKEN_ADDRESSES.USDC,
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)"
    ],
    ethers.provider
  );
  
  const whbar = new ethers.Contract(
    TOKEN_ADDRESSES.WHBAR,
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)"
    ],
    ethers.provider
  );
  
  // Check if factory is configured with official tokens
  console.log(c.cyan("\n  🔍 Verifying factory token configuration..."));
  try {
    const factoryUsdcToken = await ajoFactory.usdcHtsToken();
    const factoryWhbarToken = await ajoFactory.hbarHtsToken();
    
    if (factoryUsdcToken.toLowerCase() !== TOKEN_ADDRESSES.USDC.toLowerCase()) {
      console.log(c.yellow(`  ⚠️  Factory USDC mismatch!`));
      console.log(c.dim(`     Expected: ${TOKEN_ADDRESSES.USDC}`));
      console.log(c.dim(`     Found: ${factoryUsdcToken}`));
    } else {
      console.log(c.green(`  ✅ Factory configured with official Circle USDC`));
    }
    
    if (factoryWhbarToken.toLowerCase() !== TOKEN_ADDRESSES.WHBAR.toLowerCase()) {
      console.log(c.yellow(`  ⚠️  Factory WHBAR mismatch!`));
      console.log(c.dim(`     Expected: ${TOKEN_ADDRESSES.WHBAR}`));
      console.log(c.dim(`     Found: ${factoryWhbarToken}`));
    } else {
      console.log(c.green(`  ✅ Factory configured with official Hedera WHBAR`));
    }
  } catch (error) {
    console.log(c.yellow(`  ⚠️  Could not verify factory configuration: ${error.message}`));
  }
  
  // ✅ IMPORTANT: Factory doesn't own official tokens
  console.log(c.yellow(`\n  ℹ️  Note: Factory uses official tokens - no factory treasury`));
  console.log(c.dim(`     Participants must have their own USDC/WHBAR from exchanges/wallets\n`));
  
  let ajoId, ajoInfo;
  
  // Try to use existing Ajo or create new one
  if (totalAjos.gt(0)) {
    console.log(c.dim("\n  🔄 Checking existing Ajos..."));
    
    // Check first few Ajos for a healthy one
    for (let id = 1; id <= Math.min(3, totalAjos.toNumber()); id++) {
      try {
        const status = await ajoFactory.getAjoInitializationStatus(id);
        
        if (status.isReady) {
          console.log(c.green(`  ✅ Found healthy Ajo ID: ${id}`));
          ajoId = id;
          ajoInfo = await ajoFactory.getAjo(5);
          console.log(c.dim(`     Phase ${status.phase}, Ready: ${status.isReady}`));
          break;
        } else {
          console.log(c.dim(`     Ajo ${id}: Phase ${status.phase} (not ready)`));
        }
      } catch (error) {
        console.log(c.dim(`     Ajo ${id}: Error checking status`));
      }
    }
  }
  
  // Create new Ajo if none found
  if (!ajoInfo) {
    console.log(c.dim("\n  🎯 Creating new healthy Ajo with official tokens..."));
    
    // Phase 1: Create
    const ajoName = `Official Tokens Ajo ${Date.now()}`;
    const useHtsTokens = true; // Use HTS tokens (official ones)
    const useScheduledPayments = false;
    
    const creationTx = await ajoFactory.connect(deployer).createAjo(
      ajoName,
      useHtsTokens,
      useScheduledPayments,
      {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO
      }
    );
    const receipt = await creationTx.wait();
    
    const createEvent = receipt.events?.find(event => event.event === 'AjoCreated');
    ajoId = createEvent.args.ajoId.toNumber();
    console.log(c.green(`    ✅ Phase 1: Ajo ${ajoId} created with official USDC/WHBAR`));
    
    if (!await validateAjoHealth(ajoFactory, ajoId, 1, "Phase 1")) {
      throw new Error("Phase 1 health check failed");
    }
    
    // Phase 2: Basic initialization (HCS topic generated internally)
    const phase2Tx = await ajoFactory.connect(deployer).initializeAjoPhase2(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2
    });
    const phase2Receipt = await phase2Tx.wait();
    
    // Get HCS topic ID from event
    const phase2Event = phase2Receipt.events?.find(e => e.event === 'AjoInitializedPhase2');
    if (phase2Event) {
      console.log(c.dim(`       HCS Topic: ${phase2Event.args.hcsTopicId}`));
    }
    
    console.log(c.green(`    ✅ Phase 2: Basic contracts initialized`));
    
    if (!await validateAjoHealth(ajoFactory, ajoId, 2, "Phase 2")) {
      throw new Error("Phase 2 health check failed");
    }
    
    // Phase 3: Advanced initialization
    const phase3Tx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3
    });
    await phase3Tx.wait();
    console.log(c.green(`    ✅ Phase 3: Collateral & payments initialized`));
    
    if (!await validateAjoHealth(ajoFactory, ajoId, 3, "Phase 3")) {
      throw new Error("Phase 3 health check failed");
    }
    
    // Phase 4: Core activation
    const phase4Tx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4
    });
    await phase4Tx.wait();
    console.log(c.green(`    ✅ Phase 4: Core activated - Ajo ready!`));
    
    if (!await validateAjoHealth(ajoFactory, ajoId, 4, "Phase 4")) {
      throw new Error("Phase 4 health check failed");
    }
    
    // Optional Phase 5: Full finalization
    try {
      const phase5Tx = await ajoFactory.connect(deployer).initializeAjoPhase5(ajoId, {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_5
      });
      await phase5Tx.wait();
      console.log(c.green(`    ✅ Phase 5: Fully finalized`));
    } catch (error) {
      console.log(c.yellow(`    ⚠️ Phase 5 optional finalization failed: ${error.message}`));
    }
    
    ajoInfo = await ajoFactory.getAjo(ajoId);
  }
  
  // Final validation
  if (!await validateAjoHealth(ajoFactory, ajoId, 4, "Final validation")) {
    throw new Error("Final health check failed - Ajo not ready for testing");
  }
  
  // Verify Ajo is using official tokens
  console.log(c.cyan("\n  🔍 Verifying Ajo token configuration..."));
  if (ajoInfo.usdcToken.toLowerCase() === TOKEN_ADDRESSES.USDC.toLowerCase()) {
    console.log(c.green(`  ✅ Ajo using official Circle USDC`));
  } else {
    console.log(c.red(`  ❌ Token mismatch! Ajo USDC: ${ajoInfo.usdcToken}`));
  }
  
  if (ajoInfo.hbarToken.toLowerCase() === TOKEN_ADDRESSES.WHBAR.toLowerCase()) {
    console.log(c.green(`  ✅ Ajo using official Hedera WHBAR`));
  } else {
    console.log(c.red(`  ❌ Token mismatch! Ajo WHBAR: ${ajoInfo.hbarToken}`));
  }
  
  // Connect to contracts
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
  
  // Final functionality test
  console.log(c.dim(`\n  🔧 Testing core functionality...`));
  try {
    const tokenConfig = await ajo.getTokenConfig(0);
    console.log(c.green(`  ✅ Core functions working: ${formatUSDC(tokenConfig.monthlyPayment || tokenConfig[0])} USDC monthly`));
  } catch (error) {
    console.log(c.yellow(`  ⚠️ Core function test failed: ${error.message}`));
  }
  
  console.log(c.green(`  ✅ Healthy Ajo ready: ${ajoInfo.name} (ID: ${ajoId})`));
  
  return {
    ajo, usdc, whbar, ajoMembers, ajoCollateral, ajoPayments,
    ajoFactory, ajoId, ajoInfo, deployer,
    signers: await ethers.getSigners()
  };
}

async function setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, ajoFactory, deployer, signers) {
  console.log(c.blue("\n👥 Setting up participants..."));
  
  const participants = [];
  const participantNames = ["Emeka", "Funke", "Gbenga", "Halima", "Ifeanyi", "Jide", "Kemi", "Lekan", "Mojisola"];
  
  const actualCount = Math.min(DEMO_CONFIG.TOTAL_PARTICIPANTS, signers.length - 1);
  const MAX_ATTEMPTS_PER_SIGNER = 3;
  const failedSigners = new Set();
  
  console.log(c.yellow("  ℹ️  Using Official Circle USDC (USDC ONLY)"));
  console.log(c.yellow("  ℹ️  Tokens will be transferred from deployer for testing"));
  console.log(c.cyan("  ℹ️  HTS tokens require association before use (Hedera-specific)\n"));
  
  // Check deployer's USDC balance for funding
  const deployerUsdcBalance = await usdc.balanceOf(deployer.address);
  
  console.log(c.bright(`  💰 Deployer USDC Balance: ${formatUSDC(deployerUsdcBalance)}\n`));
  
  // If deployer has no tokens, provide instructions
  if (deployerUsdcBalance.eq(0)) {
    console.log(c.red("  ⚠️  ERROR: Deployer has no USDC tokens to distribute!\n"));
    console.log(c.yellow("  📋 For Testing: You need to fund the deployer account first:\n"));
    console.log(c.dim("     1. Associate deployer with USDC token (if not already)"));
    console.log(c.dim("     2. Get testnet USDC from: https://faucet.circle.com"));
    console.log(c.dim("     3. Or transfer USDC to deployer address\n"));
    console.log(c.yellow("  📋 For Production: Users bring their own USDC from exchanges\n"));
    throw new Error("Deployer must have USDC to fund test participants");
  }
  
  // Calculate per-participant amounts
  const usdcPerParticipant = ethers.utils.parseUnits("1000", 6); // 1000 USDC per participant
  const totalUsdcNeeded = usdcPerParticipant.mul(actualCount);
  
  if (deployerUsdcBalance.lt(totalUsdcNeeded)) {
    console.log(c.yellow(`  ⚠️  Warning: Insufficient USDC!`));
    console.log(c.dim(`     Need: ${formatUSDC(totalUsdcNeeded)} USDC`));
    console.log(c.dim(`     Have: ${formatUSDC(deployerUsdcBalance)} USDC`));
    console.log(c.yellow(`     Will fund as many participants as possible\n`));
  } else {
    console.log(c.green(`  ✅ Sufficient USDC for ${actualCount} participants\n`));
  }
  
  console.log(c.dim("  ┌────┬─────────────┬──────────────┬─────────────┬─────────────┐"));
  console.log(c.dim("  │ #  │ Name        │ Address      │ USDC Bal    │ Status      │"));
  console.log(c.dim("  ├────┼─────────────┼──────────────┼─────────────┼─────────────┤"));
  
  for (let i = 0; i < actualCount; i++) {
    const signer = signers[i + 1];
    const participantName = participantNames[i];
    
    if (failedSigners.has(signer.address)) {
      continue;
    }
    
    let attempts = 0;
    let success = false;
    
    while (attempts < MAX_ATTEMPTS_PER_SIGNER && !success) {
      attempts++;
      
      try {
        // ✅ STEP 1: Associate participant with HTS token (Hedera requirement)
        console.log(c.dim(`  → ${participantName}: Associating with USDC token...`));
        await retryWithBackoff(async () => {
          const result = await associateHtsToken(signer, TOKEN_ADDRESSES.USDC);
          if (result.alreadyAssociated) {
            console.log(c.dim(`     ✓ Already associated`));
          } else {
            console.log(c.dim(`     ✓ Token associated`));
          }
          return result;
        }, `Associate ${participantName} with USDC`);
        
        await sleep(1000);
        
        // // ✅ STEP 2: Transfer USDC tokens directly from deployer
        // console.log(c.dim(`  → ${participantName}: Transferring USDC...`));
        // await retryWithBackoff(async () => {
        //   const usdcWithSigner = usdc.connect(deployer);
        //   const tx = await usdcWithSigner.transfer(
        //     signer.address,
        //     usdcPerParticipant,
        //     { gasLimit: 1000000 }
        //   );
        //   await tx.wait();
        //   console.log(c.dim(`     ✓ Transferred ${formatUSDC(usdcPerParticipant)} USDC`));
        //   return tx;
        // }, `Transfer USDC to ${participantName}`);
        
        //await sleep(1000);
        
        // ✅ STEP 3: Verify balance
        const usdcBalance = await usdc.balanceOf(signer.address);
        
        if (usdcBalance.eq(0)) {
          throw new Error("Zero USDC balance after funding");
        }
        
        console.log(c.dim(`  → ${participantName}: Balance verified: ${formatUSDC(usdcBalance)} USDC`));
        
        // ✅ STEP 4: Approve collateral contract
        const approvalAmount = usdcBalance.div(2);
        const usdcWithSigner = usdc.connect(signer);
        
        console.log(c.dim(`  → ${participantName}: Approving ${formatUSDC(approvalAmount)} for contracts...`));
        
        await retryWithBackoff(async () => {
          const tx = await usdcWithSigner.approve(
            ajoCollateral.address,
            approvalAmount,
            { gasLimit: 1000000 }
          );
          await tx.wait();
          console.log(c.dim(`     ✓ Collateral approved`));
          return tx;
        }, `${participantName} approve Collateral`);
        
        await sleep(1500); // Increased delay for Hedera network
        
        // ✅ STEP 5: Approve payments contract
        await retryWithBackoff(async () => {
          const tx = await usdcWithSigner.approve(
            ajoPayments.address,
            approvalAmount,
            { gasLimit: 1000000 }
          );
          await tx.wait();
          console.log(c.dim(`     ✓ Payments approved`));
          return tx;
        }, `${participantName} approve Payments`);
        
        await sleep(1500); // Increased delay for Hedera network
        
        const status = c.green("✅ Ready");
        console.log(c.dim(`  │ ${(i+1).toString().padStart(2)} │ ${participantName.padEnd(11)} │ ${signer.address.slice(0,10)}... │ ${formatUSDC(usdcBalance).padEnd(11)} │ ${status.padEnd(19)} │`));
        
        participants.push({
          signer,
          address: signer.address,
          name: participantName,
          position: i + 1
        });
        
        success = true;
        await sleep(2000); // Increased delay between participants
        
      } catch (error) {
        if (attempts < MAX_ATTEMPTS_PER_SIGNER) {
          // Check for specific HTS errors
          let errorMsg = error.message;
          if (error.message.includes("TOKEN_NOT_ASSOCIATED")) {
            errorMsg = "Token not associated - will retry with association";
          } else if (error.message.includes("INSUFFICIENT_TOKEN_BALANCE")) {
            errorMsg = "Insufficient token balance in deployer account";
          } else if (error.message.includes("SPENDER_DOES_NOT_HAVE_ALLOWANCE")) {
            errorMsg = "Allowance issue - will retry approval";
          }
          
          console.log(c.yellow(`  ⚠️ ${participantName} attempt ${attempts}/${MAX_ATTEMPTS_PER_SIGNER} failed: ${errorMsg.slice(0, 80)}`));
          await sleep(3000); // Longer delay before retry
        } else {
          const status = c.red("❌ Failed");
          console.log(c.dim(`  │ ${(i+1).toString().padStart(2)} │ ${participantName.padEnd(11)} │ ${signer.address.slice(0,10)}... │ ${'N/A'.padEnd(11)} │ ${status.padEnd(19)} │`));
          failedSigners.add(signer.address);
        }
      }
    }
  }
  
  console.log(c.dim("  └────┴─────────────┴──────────────┴─────────────┴─────────────┘\n"));
  
  if (participants.length === 0) {
    console.log(c.red("  ❌ No participants successfully set up!"));
    console.log(c.yellow("  For production, users should:"));
    console.log(c.dim("  1. Buy USDC from exchanges (Binance, Crypto.com, Kraken, etc.)"));
    console.log(c.dim("  2. Get USDC via Circle's fiat on-ramps"));
    console.log(c.dim("  3. Transfer from other wallets\n"));
    throw new Error("No participants set up successfully");
  }
  
  // Show remaining deployer balance
  const remainingUsdc = await usdc.balanceOf(deployer.address);
  console.log(c.green(`  ✅ ${participants.length}/${actualCount} participants ready!`));
  console.log(c.dim(`  💰 Deployer Remaining USDC Balance: ${formatUSDC(remainingUsdc)}\n`));
  
  return participants;
}

async function demonstrateJoining(ajo, ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🎯 LIVE: Participants Joining Ajo..."));
  
  const joinResults = [];
  const MAX_JOIN_RETRIES = 5;
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    let joinAttempt = 0;
    let joinSuccess = false;
    
    while (joinAttempt < MAX_JOIN_RETRIES && !joinSuccess) {
      joinAttempt++;
      
      try {
        if (joinAttempt > 1) {
          console.log(c.yellow(`  ${i + 1}/${participants.length}: ${participant.name} joining (Retry ${joinAttempt}/${MAX_JOIN_RETRIES})...`));
        } else {
          console.log(c.dim(`  ${i + 1}/${participants.length}: ${participant.name} joining...`));
        }
        
        // Pre-join diagnostics
        console.log(c.dim(`    🔍 Pre-join diagnostics for ${participant.name}:`));
        
        const usdc = new ethers.Contract(
          TOKEN_ADDRESSES.USDC,
          ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
          ethers.provider
        );
        
        const balance = await retryWithBackoff(
          async () => await usdc.balanceOf(participant.address),
          `Get ${participant.name} balance`,
          3
        );
        
        const collateralContract = await ajo.collateralContract();
        const paymentsContract = await ajo.paymentsContract();
        
        const collateralApproval = await retryWithBackoff(
          async () => await usdc.allowance(participant.address, collateralContract),
          `Get ${participant.name} collateral approval`,
          3
        );
        
        const paymentsApproval = await retryWithBackoff(
          async () => await usdc.allowance(participant.address, paymentsContract),
          `Get ${participant.name} payments approval`,
          3
        );
        
        console.log(c.dim(`       Balance: ${formatUSDC(balance)} USDC`));
        console.log(c.dim(`       Collateral approval: ${formatUSDC(collateralApproval)} USDC`));
        console.log(c.dim(`       Payments approval: ${formatUSDC(paymentsApproval)} USDC`));
        
        // Get expected collateral
        let expectedCollateral;
        try {
          expectedCollateral = await retryWithBackoff(
            async () => await ajo.getRequiredCollateralForJoin(0),
            `Get expected collateral for ${participant.name}`,
            3
          );
          console.log(c.dim(`       Expected collateral: ${formatUSDC(expectedCollateral)} USDC`));
        } catch (error) {
          console.log(c.dim(`       Could not get expected collateral: ${error.message.slice(0, 50)}`));
        }
        
        console.log(c.dim(`    🚀 Executing joinAjo transaction...`));
        
        // Execute join with retry
        const { joinTx, receipt } = await retryWithBackoff(async () => {
          const tx = await ajo.connect(participant.signer).joinAjo(0, { 
            gasLimit: DEMO_CONFIG.GAS_LIMIT.JOIN_AJO
          });
          console.log(c.dim(`       Transaction hash: ${tx.hash}`));
          const rcpt = await tx.wait();
          return { joinTx: tx, receipt: rcpt };
        }, `${participant.name} join transaction`, 5);
        
        if (receipt.status === 0) {
          throw new Error("Transaction reverted without specific error");
        }
        
        // Verify the join was successful
        const memberInfo = await retryWithBackoff(
          async () => await ajo.getMemberInfo(participant.address),
          `Get ${participant.name} member info`,
          3
        );
        const actualCollateral = memberInfo.memberInfo.lockedCollateral;
        
        joinResults.push({
          name: participant.name,
          position: participant.position,
          expectedCollateral,
          actualCollateral,
          gasUsed: receipt.gasUsed,
          success: true
        });
        
        console.log(c.green(`    ✅ SUCCESS! Locked: ${formatUSDC(actualCollateral)} USDC | Gas: ${receipt.gasUsed.toString()}`));
        
        await validateAjoHealth(ajoFactory, ajoId, 4, `After ${participant.name} joined`);
        
        joinSuccess = true;
        
      } catch (error) {
        const isNetworkError = 
          error.message.includes('other side closed') ||
          error.message.includes('could not detect network') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('502') ||
          error.message.includes('NETWORK_ERROR');
        
        if (isNetworkError && joinAttempt < MAX_JOIN_RETRIES) {
          const backoffTime = 2000 * Math.pow(1.5, joinAttempt - 1);
          console.log(c.yellow(`    ⚠️ Network error (attempt ${joinAttempt}/${MAX_JOIN_RETRIES}): ${error.message.slice(0, 80)}`));
          console.log(c.dim(`    🔄 Retrying in ${(backoffTime/1000).toFixed(1)} seconds...`));
          await sleep(backoffTime);
          continue;
        }
        
        if (joinAttempt >= MAX_JOIN_RETRIES) {
          console.log(c.red(`    ❌ ${participant.name} failed after ${MAX_JOIN_RETRIES} attempts: ${error.reason || error.message.slice(0, 80)}`));
          
          // Try static call for better error
          try {
            await ajo.connect(participant.signer).callStatic.joinAjo(0);
          } catch (staticError) {
            console.log(c.red(`       Static call error: ${staticError.reason || staticError.message.slice(0, 80)}`));
          }
          
          joinResults.push({
            name: participant.name,
            position: participant.position,
            error: error.reason || error.message,
            success: false
          });
          
          break; // Move to next participant
        }
      }
    }
    
    await sleep(3000);
  }
  
  // Show results
  console.log(c.cyan("\n📊 JOIN RESULTS:"));
  const successful = joinResults.filter(r => r.success);
  console.log(c.dim(`  Success Rate: ${successful.length}/${participants.length}`));
  
  for (const result of joinResults) {
    if (result.success) {
      console.log(c.green(`  ✅ ${result.name}: ${formatUSDC(result.actualCollateral)} USDC locked`));
    } else {
      console.log(c.red(`  ❌ ${result.name}: ${result.error.slice(0, 60)}`));
    }
  }
  
  return joinResults;
}

async function demonstratePaymentCycle(ajo, ajoFactory, ajoId, participants, ajoPayments) {
  console.log(c.blue("\n💳 LIVE: Payment Cycle..."));
  
  const paymentResults = [];
  const MAX_PAYMENT_RETRIES = 5;
  
  console.log(c.cyan("  Phase 1: Monthly Payments"));
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    let paymentAttempt = 0;
    let paymentSuccess = false;
    
    while (paymentAttempt < MAX_PAYMENT_RETRIES && !paymentSuccess) {
      paymentAttempt++;
      
      try {
        if (paymentAttempt > 1) {
          console.log(c.yellow(`    ${participant.name} making payment (Retry ${paymentAttempt}/${MAX_PAYMENT_RETRIES})...`));
        } else {
          console.log(c.dim(`    ${participant.name} making payment...`));
        }
        
        const { paymentTx, receipt } = await retryWithBackoff(async () => {
          const tx = await ajo.connect(participant.signer).processPayment({ 
            gasLimit: DEMO_CONFIG.GAS_LIMIT.PROCESS_PAYMENT 
          });
          const rcpt = await tx.wait();
          return { paymentTx: tx, receipt: rcpt };
        }, `${participant.name} process payment`, 5);
        
        paymentResults.push({
          name: participant.name,
          gasUsed: receipt.gasUsed,
          success: true
        });
        
        console.log(c.green(`    ✅ Payment processed | Gas: ${receipt.gasUsed.toString()}`));
        paymentSuccess = true;
        
      } catch (error) {
        const isNetworkError = 
          error.message.includes('other side closed') ||
          error.message.includes('could not detect network') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('502') ||
          error.message.includes('NETWORK_ERROR');
        
        if (isNetworkError && paymentAttempt < MAX_PAYMENT_RETRIES) {
          const backoffTime = 2000 * Math.pow(1.5, paymentAttempt - 1);
          console.log(c.yellow(`    ⚠️ Network error (attempt ${paymentAttempt}/${MAX_PAYMENT_RETRIES}): ${error.message.slice(0, 80)}`));
          console.log(c.dim(`    🔄 Retrying in ${(backoffTime/1000).toFixed(1)} seconds...`));
          await sleep(backoffTime);
          continue;
        }
        
        if (paymentAttempt >= MAX_PAYMENT_RETRIES) {
          console.log(c.red(`    ❌ ${participant.name} payment failed after ${MAX_PAYMENT_RETRIES} attempts: ${error.message.slice(0, 80)}`));
          paymentResults.push({
            name: participant.name,
            success: false,
            error: error.message
          });
          break;
        }
      }
      
      await sleep(1500);
    }
  }
  
  const successfulPayments = paymentResults.filter(r => r.success).length;
  console.log(c.green(`  ✅ Cycle complete: ${successfulPayments}/${participants.length} payments`));
  
  // Get Cycle Payment Status
  console.log(c.cyan(`\n  📊 Step 1.5: Verify Cycle Payment Status\n`));
  
  const cycleData = { paymentResults };
  
  try {
    const currentCycle = 1;
    
    const paymentStatus = await retryWithBackoff(
      async () => await ajoPayments.getCyclePaymentStatus(currentCycle),
      "Get Cycle Payment Status",
      5
    );
    
    const [paidMembers, unpaidMembers, totalCollected] = paymentStatus;
    
    console.log(c.bright(`     Payment Status for Cycle ${currentCycle}:\n`));
    console.log(c.dim(`     Total Collected: ${formatUSDC(totalCollected)} (Official Circle USDC)`));
    console.log(c.dim(`     Members Paid: ${paidMembers.length}/${participants.length}\n`));
    
    // Display paid members
    if (paidMembers.length > 0) {
      console.log(c.green(`     ✅ Paid Members (${paidMembers.length}):`));
      for (const memberAddr of paidMembers) {
        const memberName = participants.find(p => 
          p.address.toLowerCase() === memberAddr.toLowerCase()
        )?.name || "Unknown";
        console.log(c.dim(`        • ${memberName} (${memberAddr.slice(0, 8)}...)`));
      }
      console.log();
    }
    
    // Display unpaid members (if any)
    if (unpaidMembers.length > 0) {
      console.log(c.red(`     ❌ Unpaid Members (${unpaidMembers.length}):`));
      for (const memberAddr of unpaidMembers) {
        const memberName = participants.find(p => 
          p.address.toLowerCase() === memberAddr.toLowerCase()
        )?.name || "Unknown";
        console.log(c.dim(`        • ${memberName} (${memberAddr.slice(0, 8)}...)`));
      }
      console.log();
    } else {
      console.log(c.green(`     🎉 All members have paid!\n`));
    }
    
    // Store payment status in cycle data
    cycleData.paymentStatus = {
      paidCount: paidMembers.length,
      unpaidCount: unpaidMembers.length,
      totalCollected: totalCollected.toString(),
      allPaid: unpaidMembers.length === 0
    };
    
  } catch (error) {
    console.log(c.red(`     ❌ Failed to get payment status: ${error.message}\n`));
    cycleData.paymentStatus = {
      error: error.message
    };
  }
  
  await sleep(2000);
  
  return paymentResults;
}

async function showFinalSummary(ajoFactory, ajoId, participants, joinResults, cycleResults) {
  console.log(c.blue("\n📋 FINAL SUMMARY"));
  
  try {
    const status = await retryWithBackoff(
      async () => await ajoFactory.getAjoInitializationStatus(ajoId),
      "Get Ajo initialization status",
      5
    );
    
    const operationalStatus = await retryWithBackoff(
      async () => await ajoFactory.getAjoOperationalStatus(ajoId),
      "Get Ajo operational status",
      5
    );
    
    console.log(c.cyan("🏥 HEALTH REPORT:"));
    console.log(c.dim(`  Ajo ID: ${ajoId}`));
    console.log(c.dim(`  Phase: ${status.phase}/5`));
    console.log(c.dim(`  Ready: ${status.isReady}`));
    console.log(c.dim(`  Fully Finalized: ${status.isFullyFinalized}`));
    
    console.log(c.cyan("📊 OPERATIONAL STATUS:"));
    console.log(c.dim(`  Total Members: ${operationalStatus.totalMembers}`));
    console.log(c.dim(`  Current Cycle: ${operationalStatus.currentCycle}`));
    console.log(c.dim(`  Can Accept Members: ${operationalStatus.canAcceptMembers}`));
    console.log(c.dim(`  Has Active Governance: ${operationalStatus.hasActiveGovernance}`));
    console.log(c.dim(`  Has Active Scheduling: ${operationalStatus.hasActiveScheduling}`));
    
    console.log(c.cyan("🪙 TOKEN CONFIGURATION:"));
    console.log(c.bright(`  USDC: Official Circle (${TOKEN_ADDRESSES.USDC})`));
    console.log(c.bright(`  WHBAR: Official Hedera (${TOKEN_ADDRESSES.WHBAR})`));
    console.log(c.green(`  ✅ Using battle-tested, audited tokens`));
    
    const successfulJoins = joinResults.filter(r => r.success).length;
    const successfulPayments = cycleResults ? cycleResults.filter(r => r.success).length : 0;
    
    console.log(c.green("\n🎯 DEMO RESULTS:"));
    console.log(c.dim(`  Participants: ${participants.length}`));
    console.log(c.dim(`  Successful Joins: ${successfulJoins}/${participants.length} (${((successfulJoins/participants.length)*100).toFixed(1)}%)`));
    console.log(c.dim(`  Successful Payments: ${successfulPayments}/${successfulJoins}`));
    console.log(c.dim(`  Overall Health: ${status.isReady ? 'Excellent ✅' : 'Needs attention ⚠️'}`));
    
    // Show network resilience stats
    const failedJoins = joinResults.filter(r => !r.success).length;
    if (failedJoins > 0) {
      console.log(c.yellow("\n⚠️  NETWORK ISSUES DETECTED:"));
      console.log(c.dim(`  Failed operations: ${failedJoins}`));
      console.log(c.dim(`  Retry mechanism helped recover most operations`));
    } else {
      console.log(c.green("\n✅ PERFECT RUN - No network issues!"));
    }
    
  } catch (error) {
    console.log(c.yellow(`  ⚠️ Summary generation failed: ${error.message}`));
    console.log(c.dim(`     This is usually due to network connectivity issues`));
  }
}

async function main() {
  console.log(c.cyan("🌟 5-Phase Factory: Official Circle USDC & Hedera WHBAR Test 🌟\n"));
  console.log(c.bright(`  Network: ${NETWORK.toUpperCase()}`));
  console.log(c.yellow("  Using official Circle USDC & Hedera WHBAR"));
  console.log(c.dim("  No custom token creation - production-ready configuration"));
  console.log(c.cyan("  ℹ️  HTS tokens require association before use"));
  console.log(c.green("  ✅ Automatic retry enabled for network issues\n"));
  
  try {
    const {
      ajo, usdc, whbar, ajoMembers, ajoCollateral, ajoPayments,
      ajoFactory, ajoId, ajoInfo, deployer, signers
    } = await connectToFactoryAndEnsureHealthyAjo();
    
    const participants = await setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, ajoFactory, deployer, signers);
    
    if (participants.length === 0) {
      throw new Error("No participants successfully set up - users need to acquire official USDC/WHBAR");
    }
    
    const joinResults = await demonstrateJoining(ajo, ajoFactory, ajoId, participants);
    
    const successfulJoins = joinResults.filter(r => r.success);
    if (successfulJoins.length > 0) {
      const cycleResults = await demonstratePaymentCycle(ajo, ajoFactory, ajoId, participants.slice(0, successfulJoins.length), ajoPayments);
      await showFinalSummary(ajoFactory, ajoId, participants, joinResults, cycleResults);
    } else {
      console.log(c.yellow("⚠️ No successful joins - skipping payment cycle"));
      await showFinalSummary(ajoFactory, ajoId, participants, joinResults, null);
    }
    
    console.log(c.green("\n🎉 Testing completed!"));
    
    // Calculate retry success rate
    const totalOperations = joinResults.length + (successfulJoins.length || 0);
    const successfulOps = joinResults.filter(r => r.success).length + (successfulJoins.length || 0);
    const recoveryRate = totalOperations > 0 ? ((successfulOps / totalOperations) * 100).toFixed(1) : 0;
    
    console.log(c.cyan("\n📊 NETWORK RESILIENCE STATS:"));
    console.log(c.dim(`  Total Operations: ${totalOperations}`));
    console.log(c.dim(`  Successful Operations: ${successfulOps}`));
    console.log(c.dim(`  Recovery Rate: ${recoveryRate}%`));
    console.log(c.dim(`  Retry mechanism: ${recoveryRate > 80 ? '✅ Working well' : '⚠️ May need adjustment'}`));
    
    return {
      factoryAddress: FACTORY_ADDRESS,
      tokenAddresses: TOKEN_ADDRESSES,
      network: NETWORK,
      ajoId,
      healthStatus: "validated",
      successfulParticipants: successfulJoins.length,
      usingOfficialTokens: true,
      networkRecoveryRate: recoveryRate
    };
    
  } catch (error) {
    console.error(c.red("\n💥 Test failed:"), error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🚀 Official token system validated!"));
      console.log(c.dim("   Users can now join with their own Circle USDC & Hedera WHBAR"));
      console.log(c.cyan("\n📘 IMPORTANT: HTS Token Association"));
      console.log(c.dim("   • All HTS tokens require association before use"));
      console.log(c.dim("   • Association is a one-time operation per token"));
      console.log(c.dim("   • Use HashPack wallet or Hedera SDK to associate"));
      console.log(c.dim("   • Costs: ~$0.05 in HBAR per association"));
      console.log(c.green("\n✅ Network Resilience:"));
      console.log(c.dim("   • Automatic retry enabled for all operations"));
      console.log(c.dim("   • Up to 5 attempts per operation"));
      console.log(c.dim("   • Exponential backoff for network errors"));
      console.log(c.dim("   • Handles 'other side closed' errors gracefully\n"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Test failed:"), error);
      console.log(c.yellow("\n🔧 Troubleshooting HTS Token Issues:"));
      console.log(c.dim("   1. Ensure deployer has USDC balance"));
      console.log(c.dim("   2. Check that deployer is associated with USDC token"));
      console.log(c.dim("   3. Verify participants are being associated before transfers"));
      console.log(c.dim("   4. Increase gas limits if transactions are failing"));
      console.log(c.dim("   5. Check Hedera network status at status.hedera.com"));
      console.log(c.yellow("\n🔄 Network Issues:"));
      console.log(c.dim("   • 'other side closed' = Temporary RPC issue (auto-retried)"));
      console.log(c.dim("   • 'timeout' = Network congestion (auto-retried)"));
      console.log(c.dim("   • '502' = Gateway error (auto-retried)"));
      console.log(c.dim("   • Script retries up to 5 times with exponential backoff\n"));
      process.exit(1);
    });
}

module.exports = { main };