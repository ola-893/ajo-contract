#!/usr/bin/env node
const { ethers } = require("hardhat");
const fs = require('fs');

// Import integrated utilities
const {
  showPreJoiningState,
  verifyJoiningResults,
  showPrePaymentState,
  verifyPaymentResults,
  showFactoryState,
  showGovernanceState,
  demonstrateJoiningWithVerification,
  demonstratePaymentCycleWithVerification
} = require('./enhanced_demo_integrated.cjs');

// Import advanced view tests
const {
  runAdvancedDemo,
  demoFactoryViewFunctions,
  demoCoreViewFunctions,
  demoMemberViewFunctions,
  demoCollateralViewFunctions,
  demoPaymentViewFunctions,
  demoGovernanceViewFunctions,
  verifyAdvancedCollateralFeatures,
  verifyMemberIndexing,
  verifyPayoutHistory,
  verifyTokenConfiguration,
  verifyFactoryPagination,
  verifySeizableAssetsForAll
} = require('./advanced_demo_features.cjs');

// Import governance HCS demo
const {
  runGovernanceDemo,
  testProposalCreation,
  testHcsVoteSubmission,
  testVoteTallying,
  testProposalStatus,
  testProposalExecution
} = require('./governance_hcs_demo.cjs');

// Enhanced color utilities
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
  bright: (text) => `\x1b[1m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  underline: (text) => `\x1b[4m${text}\x1b[0m`,
  bgGreen: (text) => `\x1b[42m\x1b[30m${text}\x1b[0m`,
  bgBlue: (text) => `\x1b[44m\x1b[37m${text}\x1b[0m`,
  bgYellow: (text) => `\x1b[43m\x1b[30m${text}\x1b[0m`,
  bgRed: (text) => `\x1b[41m\x1b[37m${text}\x1b[0m`
};

const DEMO_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  MONTHLY_PAYMENT_USDC: ethers.utils.parseUnits("1", 6), // $50 USDC
  MONTHLY_PAYMENT_HBAR: ethers.utils.parseUnits("0", 8), // 1000 HBAR
  CYCLE_DURATION: 30, // 30 seconds for testing (pass 0 to use default 30 days)
  TOTAL_PARTICIPANTS: 13,
  MIN_HBAR_FOR_HTS: ethers.utils.parseEther("50"),
  GAS_LIMIT: {
    DEPLOY_MASTER: 15000000,
    DEPLOY_GOVERNANCE: 15000000,
    DEPLOY_FACTORY: 15000000,
    CREATE_HTS: 15000000,
    CREATE_AJO: 15000000,
    INIT_PHASE_2: 15000000,
    INIT_PHASE_3: 15000000,
    INIT_PHASE_4: 15000000,
    INIT_PHASE_5: 15000000,
    JOIN_AJO: 15000000,
    HTS_ASSOCIATE: 15000000,
    HTS_FUND: 15000000,
    HTS_APPROVE: 15000000,
    PROCESS_PAYMENT: 15000000,
    DISTRIBUTE_PAYOUT: 15000000
  }
};


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const formatHBAR = (amount) => ethers.utils.formatUnits(amount, 8);

// ================================================================
// ENHANCED BANNER
// ================================================================
/**
 * Enhanced sleep with progress indicator
 */
async function sleepWithProgress(seconds, label = "Waiting") {
  const steps = 5;
  const interval = seconds * 1000 / steps;
  
  for (let i = 1; i <= steps; i++) {
    await sleep(interval);
    const progress = '█'.repeat(i) + '░'.repeat(steps - i);
    process.stdout.write(`\r     ${label}: [${progress}] ${Math.round(i/steps * 100)}%`);
  }
  console.log(); // New line after completion
}

/**
 * Enhanced retry with exponential backoff and network reset
 */
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
        
        // Try to recover provider connection
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

function printEnhancedBanner() {
  console.log(c.magenta("\n" + "═".repeat(88)));
  console.log(c.bold(c.cyan("╔══════════════════════════════════════════════════════════════════════════════════════╗")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("║") + c.bgBlue("              🏦 AJO.SAVE - FULL HEDERA INTEGRATION DEMO 🏦                          ") + c.cyan("║")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("╚══════════════════════════════════════════════════════════════════════════════════════╝")));
  console.log(c.magenta("═".repeat(88)));
  
  console.log(c.bright("\n" + " ".repeat(15) + "HTS + HCS + HSS - Complete 10-Cycle Demo"));
  console.log(c.dim(" ".repeat(12) + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  
  console.log(c.yellow("\n  🌟 HEDERA SERVICES INTEGRATION:"));
  console.log(c.green("     ✓ HTS Auto-Association") + c.dim(" - Seamless token distribution"));
  console.log(c.green("     ✓ HCS Governance") + c.dim(" - Off-chain voting, on-chain tally"));
  console.log(c.green("     ✓ HSS Scheduling") + c.dim(" - Automated payment execution"));
  console.log(c.green("     ✓ Factory Treasury") + c.dim(" - Centralized token management"));
  console.log(c.green("     ✓ Full ROSCA Cycle") + c.dim(" - Payment → Payout → Next Cycle"));
  console.log(c.green("     ✓ Native Hedera") + c.dim(" - 90%+ cost reduction\n"));
  
  console.log(c.bgYellow(" ⚡ DEMO CONFIG: 30 SECOND CYCLES - FULL 10 CYCLES "));
  console.log(c.yellow("  This demo will run through all 10 payment cycles\n"));
}

// ================================================================
// RETRY OPERATION
// ================================================================

async function retryOperation(operation, operationName, maxRetries = DEMO_CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(c.dim(`    ⏳ Attempt ${attempt}/${maxRetries}: ${operationName}`));
      const result = await operation();
      console.log(c.green(`    ✅ ${operationName} succeeded`));
      return result;
    } catch (error) {
      const isNetworkError = error.message.includes('other-side closed') || 
                           error.message.includes('SocketError') ||
                           error.message.includes('network') ||
                           error.message.includes('timeout');
      
      if (isNetworkError && attempt < maxRetries) {
        console.log(c.yellow(`    ⚠️ Network error on attempt ${attempt}: ${error.message.slice(0, 100)}`));
        console.log(c.dim(`    🔄 Retrying in ${DEMO_CONFIG.RETRY_DELAY/1000} seconds...`));
        await sleep(DEMO_CONFIG.RETRY_DELAY * attempt);
        continue;
      }
      
      console.log(c.red(`    ❌ ${operationName} failed: ${error.message.slice(0, 150)}`));
      throw error;
    }
  }
}




// ================================================================
// PHASE 1: OFFICIAL TOKEN DEPLOYMENT (No Token Creation!)
// ================================================================

async function deployHtsSystem() {
  console.log(c.bgBlue("\n" + " ".repeat(30) + "PHASE 1: HTS SYSTEM DEPLOYMENT" + " ".repeat(28)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  const [deployer] = await ethers.getSigners();
  console.log(c.bright(`  👤 Deployer: ${deployer.address}`));
  const balance = await deployer.getBalance();
  console.log(c.dim(`     Balance: ${ethers.utils.formatEther(balance)} HBAR\n`));
  
  // ✅ UPDATED: Lower HBAR requirement (no token creation needed)
  const MIN_HBAR_REQUIRED = ethers.utils.parseEther("10"); // Just for deployment
  if (balance.lt(MIN_HBAR_REQUIRED)) {
    throw new Error(
      `Insufficient HBAR! Need ${ethers.utils.formatEther(MIN_HBAR_REQUIRED)} HBAR, ` +
      `have ${ethers.utils.formatEther(balance)} HBAR`
    );
  }
  
  console.log(c.green(`  ✅ Sufficient HBAR for deployment\n`));
  
  console.log(c.cyan("  📝 Step 1.1: Deploying Master Implementation Contracts...\n"));
  
  const masterContracts = {};
  const contracts = [
    { name: "AjoCore", key: "ajoCore", desc: "Main orchestration & coordination", icon: "🎯" },
    { name: "AjoMembers", key: "ajoMembers", desc: "Member management & queue system", icon: "👥" },
    { name: "AjoCollateral", key: "ajoCollateral", desc: "Dynamic collateral calculations", icon: "🔒" },
    { name: "AjoPayments", key: "ajoPayments", desc: "Payment processing & distribution", icon: "💳" },
    { name: "AjoGovernance", key: "ajoGovernance", desc: "On-chain governance with HCS", icon: "🗳️" },
    { name: "AjoSchedule", key: "ajoSchedule", desc: "HSS automated scheduling", icon: "📅" }
  ];
  
  for (const contract of contracts) {
    await retryOperation(async () => {
      console.log(c.cyan(`      ${contract.icon} Deploying ${contract.name}...`));
      console.log(c.dim(`         ${contract.desc}`));
      
      const ContractFactory = await ethers.getContractFactory(contract.name);
      const gasLimit = contract.name === "AjoGovernance" ? 
        DEMO_CONFIG.GAS_LIMIT.DEPLOY_GOVERNANCE : 
        DEMO_CONFIG.GAS_LIMIT.DEPLOY_MASTER;
      
      masterContracts[contract.key] = await ContractFactory.deploy({ gasLimit });
      await masterContracts[contract.key].deployed();
      
      console.log(c.green(`      ✅ ${contract.name}: ${masterContracts[contract.key].address}\n`));
      return masterContracts[contract.key];
    }, `Deploy ${contract.name} Master`);
    
    await sleep(1500);
  }
  
  console.log(c.cyan("  📝 Step 1.2: Deploying AjoFactory with Official Tokens...\n"));
  
  // ✅ NEW: Official token addresses
  const NETWORK = process.env.HEDERA_NETWORK || "testnet"; // or "mainnet"
  
  const TOKEN_ADDRESSES = {
    mainnet: {
      USDC: "0x000000000000000000000000000000000006f89a", // Circle USDC (0.0.456858)
      WHBAR: "0xb1f616b8134f602c3bb465fb5b5e6565ccad37ed"  // Official WHBAR (0.0.8840785)
    },
    testnet: {
      USDC: "0x0000000000000000000000000000000000068cda",   // Circle USDC (0.0.429274)
      WHBAR: "0xb1f616b8134f602c3bb465fb5b5e6565ccad37ed"  // Official WHBAR (0.0.1456986)
    }
  };

  const OFFICIAL_USDC = TOKEN_ADDRESSES[NETWORK].USDC;
  const OFFICIAL_WHBAR = TOKEN_ADDRESSES[NETWORK].WHBAR;
  
  const HEDERA_TOKEN_SERVICE = "0x0000000000000000000000000000000000000167";
  const HEDERA_SCHEDULE_SERVICE = "0x000000000000000000000000000000000000016b";
  
  console.log(c.bright(`      🪙 Using Official Circle USDC: ${OFFICIAL_USDC}`));
  console.log(c.bright(`      🪙 Using Official Hedera WHBAR: ${OFFICIAL_WHBAR}`));
  console.log(c.dim(`      🔗 HTS Address: ${HEDERA_TOKEN_SERVICE}`));
  console.log(c.dim(`      🔗 HSS Address: ${HEDERA_SCHEDULE_SERVICE}\n`));
  
  let ajoFactory;
  await retryOperation(async () => {
    const AjoFactory = await ethers.getContractFactory("AjoFactory");
    ajoFactory = await AjoFactory.deploy(
      OFFICIAL_USDC,  // ✅ Official Circle USDC
      OFFICIAL_WHBAR, // ✅ Official Hedera WHBAR
      masterContracts.ajoCore.address,
      masterContracts.ajoMembers.address,
      masterContracts.ajoCollateral.address,
      masterContracts.ajoPayments.address,
      masterContracts.ajoGovernance.address,
      masterContracts.ajoSchedule.address,
      HEDERA_TOKEN_SERVICE,
      HEDERA_SCHEDULE_SERVICE,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_FACTORY }
    );
    await ajoFactory.deployed();
    console.log(c.green(`      ✅ AjoFactory: ${ajoFactory.address}\n`));
    return ajoFactory;
  }, "Deploy AjoFactory");
  
  await sleep(2000);
  
  // ✅ NEW: Enable HTS mode (no token creation!)
  console.log(c.cyan("  📝 Step 1.3: Configuring Official HTS Tokens...\n"));
  
  await retryOperation(async () => {
    const tx = await ajoFactory.setHtsTokensForFactory(
      OFFICIAL_USDC,
      OFFICIAL_WHBAR,
      { gasLimit: 500000 }
    );
    const receipt = await tx.wait();
    
    console.log(c.green(`     ✅ HTS Tokens Configured!`));
    console.log(c.bright(`     📍 USDC Token: ${OFFICIAL_USDC}`));
    console.log(c.bright(`     📍 WHBAR Token: ${OFFICIAL_WHBAR}`));
    console.log(c.dim(`     Transaction hash: ${receipt.transactionHash}\n`));
    
    return receipt;
  }, "Configure HTS Tokens");
  
  await sleep(2000);
  
  // ✅ REMOVED: Token balance verification (factory doesn't own tokens)
  console.log(c.yellow(`  ⚠️  Note: Factory uses official tokens - no factory treasury\n`));
  console.log(c.dim(`     Users will bring their own USDC/WHBAR from exchanges/wallets\n`));
  
  console.log(c.green("  ✅ HTS System Deployment Complete!\n"));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { 
    ajoFactory, 
    deployer, 
    masterContracts, 
    usdcHtsToken: OFFICIAL_USDC,  // ✅ Official addresses
    hbarHtsToken: OFFICIAL_WHBAR  // ✅ Official addresses
  };
}


// ================================================================
// PHASE 2: 5-PHASE AJO CREATION WITH CONFIGURABLE PARAMETERS
// ================================================================
async function createHtsAjo(ajoFactory, deployer, hederaClient, options = {}) {
  console.log(c.bgBlue("\n" + " ".repeat(28) + "PHASE 2: HTS AJO CREATION" + " ".repeat(33)));
  console.log(c.blue("═".repeat(88)));
  
  const {
    name = `HTS Ajo ${Date.now()}`,
    useScheduledPayments = true,
    cycleDuration = DEMO_CONFIG.CYCLE_DURATION,
    monthlyPaymentUSDC = DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
    monthlyPaymentHBAR = DEMO_CONFIG.MONTHLY_PAYMENT_HBAR
  } = options;
  
  console.log(c.bright("\n  📋 Configuration:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ Name: ${name.padEnd(51)} │`));
  console.log(c.dim(`     │ Cycle Duration: ${cycleDuration.toString().padEnd(42)} seconds │`));
  console.log(c.dim(`     │ Monthly USDC: ${formatUSDC(monthlyPaymentUSDC).padEnd(44)} │`));
  console.log(c.dim(`     │ Monthly HBAR: ${formatHBAR(monthlyPaymentHBAR).padEnd(44)} │`));
  console.log(c.dim(`     │ Tokens: ${c.green('✅ Official Circle USDC & Hedera WHBAR').padEnd(60)} │`)); // ✅ UPDATED
  console.log(c.dim(`     │ Auto-Association: ${c.green('✅ Native HTS (Built-in)').padEnd(56)} │`)); // ✅ UPDATED
  console.log(c.dim(`     │ HSS Scheduling: ${(useScheduledPayments ? c.green('✅ Enabled') : c.yellow('❌ Manual')).padEnd(56)} │`));
  console.log(c.dim(`     │ HCS Governance: ${c.green('✅ Always Enabled').padEnd(56)} │`));
  console.log(c.dim("     └──────────────────────────────────────────────────────────┘\n"));
  
  // ✅ REST OF THE FUNCTION REMAINS THE SAME
  let ajoId, hcsTopicInfo;
  
  console.log(c.cyan("  📋 PHASE 1/5: Creating Ajo Core..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).createAjo(
      name, 
      true, // useHtsTokens (official tokens)
      useScheduledPayments,
      cycleDuration,
      monthlyPaymentUSDC,
      monthlyPaymentHBAR,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO }
    );
    const receipt = await tx.wait();
    
    const event = receipt.events?.find(e => e.event === 'AjoCreated');
    ajoId = event?.args?.ajoId?.toNumber();
    
    console.log(c.green(`     ✅ Ajo Core Created`));
    console.log(c.dim(`        ID: ${ajoId}`));
    console.log(c.dim(`        Using Official USDC/WHBAR`)); // ✅ UPDATED
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");
  
  // ... rest of the function remains identical
  
  await sleep(2000);
  
  console.log(c.bgYellow("\n" + " ".repeat(20) + "🌐 FRONTEND SIMULATION: CREATE HCS TOPIC" + " ".repeat(26)));
  hcsTopicInfo = await createRealHcsTopic(hederaClient, name);
  
  await sleep(2000);
  
  console.log(c.cyan("  📋 PHASE 2/5: Initialize Members + Governance + HCS..."));
  console.log(c.yellow(`     → Passing HCS Topic ID: ${hcsTopicInfo.topicId}\n`));
  
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase2(
      ajoId,
      hcsTopicInfo.bytes32TopicId,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2 }
    );
    const receipt = await tx.wait();
    
    console.log(c.green(`     ✅ Phase 2 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 2");
  
  await sleep(2000);
  
  console.log(c.cyan("  📋 PHASE 3/5: Initialize Collateral + Payments..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 3 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 3");
  
  await sleep(2000);
  
  console.log(c.cyan("  📋 PHASE 4/5: Initialize Core + Token Config..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 4 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 4");
  
  await sleep(2000);
  
  if (useScheduledPayments) {
    console.log(c.cyan("  📋 PHASE 5/5: Initialize Schedule Contract (HSS)..."));
    await retryOperation(async () => {
      const tx = await ajoFactory.connect(deployer).initializeAjoPhase5(ajoId, {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_5
      });
      await tx.wait();
      console.log(c.green(`     ✅ Phase 5 Complete\n`));
      return tx;
    }, "Initialize Ajo Phase 5");
  }
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  
  console.log(c.blue("═".repeat(88)));
  console.log(c.green(`\n  ✅ HTS Ajo "${name}" Successfully Created!\n`));
  console.log(c.dim("\n  🪙 Token Configuration:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ USDC:  Official Circle USDC (${ajoInfo.usdcToken.slice(0, 20)}...) │`)); // ✅ UPDATED
  console.log(c.dim(`     │ WHBAR: Official Hedera WHBAR (${ajoInfo.hbarToken.slice(0, 20)}...) │`)); // ✅ UPDATED
  console.log(c.dim("     └──────────────────────────────────────────────────────────────────┘\n"));
  
  return { 
    ajoId, 
    ajoInfo, 
    hcsTopicId: hcsTopicInfo.topicId,
    hcsTopicIdBytes32: hcsTopicInfo.bytes32TopicId,
    hcsTopicSimulated: hcsTopicInfo.simulated
  };
}


// ================================================================
// SETUP PARTICIPANTS WITH OFFICIAL HTS TOKENS (USDC ONLY)
// ================================================================
async function setupHtsParticipants(ajoFactory, ajoId) {
  console.log(c.bgYellow("\n" + " ".repeat(25) + "👥 SETTING UP PARTICIPANTS" + " ".repeat(31)));
  console.log(c.yellow("═".repeat(88) + "\n"));
  
  const REQUIRED_PARTICIPANTS = 10;
  const MAX_ATTEMPTS_PER_SIGNER = 5;
  
  const [deployer, ...signers] = await ethers.getSigners();
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
  
  const participantNames = [
    "Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", 
    "Funmilayo", "Gbenga", "Halima", "Ifeanyi", "Joke", 
    "Kemi", "Lekan", "Mojisola", "Ngozi", "Oluwaseun"
  ];
  
  const participants = [];
  const failedSigners = new Set();
  let signerIndex = 0;
  
  console.log(c.bright(`  🎯 Target: ${REQUIRED_PARTICIPANTS} participants\n`));
  console.log(c.yellow("     ℹ️  Using Official Circle USDC (USDC ONLY)\n"));
  console.log(c.yellow("     ℹ️  Tokens will be minted directly to test accounts\n"));
  
  // ✅ Get USDC token contract
  const usdcContract = new ethers.Contract(
    ajoInfo.usdcToken,
    [
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function approve(address spender, uint256 amount) external returns (bool)"
    ],
    ethers.provider
  );
  
  // ✅ Check deployer's USDC balance for funding
  const deployerUsdcBalance = await usdcContract.balanceOf(deployer.address);
  
  console.log(c.bright(`     💰 Deployer USDC Balance: ${formatUSDC(deployerUsdcBalance)}\n`));
  
  // ✅ If deployer has no tokens, provide instructions
  if (deployerUsdcBalance.eq(0)) {
    console.log(c.red("     ⚠️  ERROR: Deployer has no USDC tokens to distribute!\n"));
    console.log(c.yellow("     📋 For Testing: You need to fund the deployer account first:\n"));
    console.log(c.dim("        1. Get testnet USDC from: https://faucet.circle.com"));
    console.log(c.dim("        2. Or use a testnet faucet for USDC\n"));
    console.log(c.yellow("     📋 For Production: Users bring their own USDC from exchanges\n"));
    throw new Error("Deployer must have USDC to fund test participants");
  }
  
  // Calculate per-participant amounts
  const usdcPerParticipant = ethers.utils.parseUnits("5", 6);
  
  const totalUsdcNeeded = usdcPerParticipant.mul(REQUIRED_PARTICIPANTS);
  
  if (deployerUsdcBalance.lt(totalUsdcNeeded)) {
    throw new Error(
      `Insufficient USDC! Need ${formatUSDC(totalUsdcNeeded)}, have ${formatUSDC(deployerUsdcBalance)}`
    );
  }
  
  console.log(c.green(`     ✅ Sufficient USDC for ${REQUIRED_PARTICIPANTS} participants\n`));
  
  console.log(c.cyan("  🔗 Processing Users Individually...\n"));
  console.log(c.dim("  ┌────┬─────────────┬──────────────┬─────────────┬─────────────┐"));
  console.log(c.dim("  │ #  │ Name        │ Address      │ USDC Bal    │ Status      │"));
  console.log(c.dim("  ├────┼─────────────┼──────────────┼─────────────┼─────────────┤"));
  
  while (participants.length < REQUIRED_PARTICIPANTS && signerIndex < signers.length) {
    const signer = signers[signerIndex];
    const nameIndex = participants.length;
    const participantName = participantNames[nameIndex];
    
    if (failedSigners.has(signer.address)) {
      signerIndex++;
      continue;
    }
    
    let attempts = 0;
    let success = false;
    
    while (attempts < MAX_ATTEMPTS_PER_SIGNER && !success) {
      attempts++;
      
      try {
        // ✅ Transfer USDC tokens directly from deployer (simulates user having tokens)
        console.log(c.dim(`     → ${participantName} (Attempt ${attempts}/${MAX_ATTEMPTS_PER_SIGNER}): Funding with USDC...`));
        
        // Transfer USDC
        await retryWithBackoff(async () => {
          const usdcWithSigner = usdcContract.connect(deployer);
          const tx = await usdcWithSigner.transfer(
            signer.address,
            usdcPerParticipant,
            { gasLimit: 800000 }
          );
          await tx.wait();
          console.log(c.dim(`        ✓ Transferred: ${formatUSDC(usdcPerParticipant)} USDC`));
          return tx;
        }, 3, 3);
        
        await sleep(500);
        
        // Verify balance
        const usdcBalance = await usdcContract.balanceOf(signer.address);
        
        if (usdcBalance.eq(0)) {
          throw new Error("Zero USDC balance after funding");
        }
        
        console.log(c.dim(`     → ${participantName}: Verified balance:`));
        console.log(c.dim(`        • USDC: ${formatUSDC(usdcBalance)}`));
        
        // Approve collateral contract
        const approvalAmount = usdcBalance.div(2);
        console.log(c.dim(`     → ${participantName}: Approving ${formatUSDC(approvalAmount)} for contracts...`));
        
        const usdcWithSigner = usdcContract.connect(signer);
        
        await retryWithBackoff(async () => {
          const tx = await usdcWithSigner.approve(
            ajoCollateral.address,
            approvalAmount,
            { gasLimit: 800000 }
          );
          await tx.wait();
          console.log(c.dim(`        ✓ Collateral approved`));
          return tx;
        }, 3, 3);
        
        await sleep(500);
        
        // Approve payments contract
        await retryWithBackoff(async () => {
          const tx = await usdcWithSigner.approve(
            ajoPayments.address,
            approvalAmount,
            { gasLimit: 800000 }
          );
          await tx.wait();
          console.log(c.dim(`        ✓ Payments approved`));
          return tx;
        }, 3, 3);
        
        const status = c.green("✅ Ready");
        console.log(c.dim(`  │ ${(nameIndex+1).toString().padStart(2)} │ ${participantName.padEnd(11)} │ ${signer.address.slice(0,10)}... │ ${formatUSDC(usdcBalance).padEnd(11)} │ ${status.padEnd(19)} │`));
        
        participants.push({
          signer,
          address: signer.address,
          name: participantName,
          position: nameIndex + 1
        });
        
        success = true;
        
        // Show progress
        console.log(c.cyan(`\n     📊 Progress: ${participants.length}/${REQUIRED_PARTICIPANTS} participants ready\n`));
        
        await sleep(1000);
        
      } catch (error) {
        console.log(c.yellow(`     ⚠️ Attempt ${attempts}/${MAX_ATTEMPTS_PER_SIGNER} failed: ${error.message.slice(0, 80)}`));
        
        if (attempts < MAX_ATTEMPTS_PER_SIGNER) {
          console.log(c.dim(`     → Retrying in 3 seconds...\n`));
          await sleep(3000);
        } else {
          const status = c.red("❌ Failed");
          console.log(c.dim(`  │ ${(nameIndex+1).toString().padStart(2)} │ ${participantName.padEnd(11)} │ ${signer.address.slice(0,10)}... │ ${'N/A'.padEnd(11)} │ ${status.padEnd(19)} │`));
          console.log(c.red(`     ✗ Failed to set up ${participantName} after ${MAX_ATTEMPTS_PER_SIGNER} attempts\n`));
          failedSigners.add(signer.address);
        }
      }
    }
    
    signerIndex++;
  }
  
  console.log(c.dim("  └────┴─────────────┴──────────────┴─────────────┴─────────────┘\n"));
  
  // Verify we have enough participants
  if (participants.length < REQUIRED_PARTICIPANTS) {
    throw new Error(
      `Failed to set up required participants! Got ${participants.length}/${REQUIRED_PARTICIPANTS}. ` +
      `Need more signers in hardhat config or check approval issues.`
    );
  }
  
  console.log(c.green(`✅ All ${REQUIRED_PARTICIPANTS} participants ready!\n`));
  console.log(c.dim(`   Successful: ${participants.length}`));
  console.log(c.dim(`   Failed: ${failedSigners.size}\n`));
  
  // ✅ Show remaining deployer balance
  const remainingUsdc = await usdcContract.balanceOf(deployer.address);
  console.log(c.dim(`   💰 Deployer Remaining USDC Balance: ${formatUSDC(remainingUsdc)}\n`));
  
  return { ajo, ajoMembers, ajoCollateral, ajoPayments, participants, ajoInfo };
}

// ================================================================
// PHASE 4: MEMBER JOINING
// ================================================================

async function demonstrateMemberJoining(ajo, ajoCollateral, ajoMembers, participants, ajoInfo) {
  console.log(c.bgBlue("\n" + " ".repeat(22) + "PHASE 4: MEMBER JOINING & COLLATERAL SYSTEM" + " ".repeat(22)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  const joinResults = [];
  
  console.log(c.dim("     ┌────┬─────────────┬──────────────┬─────────────────┬──────────────┐"));
  console.log(c.dim("     │ #  │ Name        │ Position     │ Collateral Req. │ Status       │"));
  console.log(c.dim("     ├────┼─────────────┼──────────────┼─────────────────┼──────────────┤"));
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      const joinTx = await ajo.connect(participant.signer).joinAjo(0, { 
        gasLimit: DEMO_CONFIG.GAS_LIMIT.JOIN_AJO 
      });
      const receipt = await joinTx.wait();
      
      const memberInfo = await ajo.getMemberInfo(participant.address);
      const actualCollateral = memberInfo.memberInfo.lockedCollateral;
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        actualCollateral,
        gasUsed: receipt.gasUsed,
        success: true
      });
      
      const status = c.green("✅ Joined");
      console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${participant.position.toString().padEnd(12)} │ ${formatUSDC(actualCollateral).padEnd(15)} │ ${status.padEnd(20)} │`));
      
    } catch (error) {
      let errorMsg = error.reason || error.message;
      if (error.error && error.error.message) {
        errorMsg = error.error.message;
      }
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        error: errorMsg,
        success: false
      });
      
      const status = c.red("❌ Failed");
      console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${participant.position.toString().padEnd(12)} │ ${'N/A'.padEnd(15)} │ ${status.padEnd(20)} │`));
      console.log(c.red(`     ⚠️ ${errorMsg.slice(0, 100)}`));
    }
    
    await sleep(1500);
  }
  
  console.log(c.dim("     └────┴─────────────┴──────────────┴─────────────────┴──────────────┘\n"));
  
  const successCount = joinResults.filter(r => r.success).length;
  console.log(c.green(`  ✅ ${successCount}/${participants.length} members successfully joined!\n`));
  
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return joinResults;
}

// ================================================================
// PHASE 5: FULL 10-CYCLE DEMONSTRATION WITH PAYMENT STATUS
// ================================================================

async function demonstrateFullCycles(ajo, ajoPayments, participants, cycleDuration) {
  console.log(c.bgBlue("\n" + " ".repeat(20) + "PHASE 5: FULL 10-CYCLE PAYMENT & PAYOUT DEMONSTRATION" + " ".repeat(18)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  console.log(c.bright(`  ⏱️  Cycle Duration: ${cycleDuration} seconds\n`));
  console.log(c.yellow("  📊 Running through all 10 cycles...\n"));
  
  const cycleResults = [];
  const TOTAL_CYCLES = 10;
  
  for (let cycle = 1; cycle <= TOTAL_CYCLES; cycle++) {
    console.log(c.bgYellow(`\n${"═".repeat(35)} CYCLE ${cycle}/10 ${"═".repeat(35)}`));
    console.log(c.bright(`\n  📅 Cycle ${cycle} Started\n`));
    
    const cycleData = {
      cycle,
      payments: [],
      payout: null,
      startTime: Date.now()
    };
    
    // Get current cycle from contract with retry
    let currentCycle, nextRecipient;
    try {
      currentCycle = await retryWithBackoff(
        async () => await ajoPayments.getCurrentCycle(),
        "Get Current Cycle"
      );
      console.log(c.dim(`     Contract Cycle: ${currentCycle.toString()}`));
      
      nextRecipient = await retryWithBackoff(
        async () => await ajoPayments.getNextRecipient(),
        "Get Next Recipient"
      );
      console.log(c.bright(`     💰 Next Recipient: ${nextRecipient}\n`));
    } catch (error) {
      console.log(c.red(`\n  ❌ Failed to get cycle info: ${error.message}`));
      console.log(c.yellow(`  ⏩ Skipping to next cycle...\n`));
      continue;
    }
    
    // Find recipient name
    const recipientParticipant = participants.find(p => 
      p.address.toLowerCase() === nextRecipient.toLowerCase()
    );
    const recipientName = recipientParticipant ? recipientParticipant.name : "Unknown";
    
    if (nextRecipient === "0x0000000000000000000000000000000000000000") {
      console.log(c.red(`\n  ⚠️ WARNING: Next recipient is address(0) - getNextRecipient() issue!`));
      console.log(c.yellow(`  This indicates a contract logic problem that needs fixing.\n`));
    }
    
    console.log(c.cyan(`  💳 Step 1: Process Payments for Cycle ${cycle}\n`));
    console.log(c.dim("     ┌────┬─────────────┬──────────────┬──────────────┐"));
    console.log(c.dim("     │ #  │ Member      │ Amount       │ Status       │"));
    console.log(c.dim("     ├────┼─────────────┼──────────────┼──────────────┤"));
    
    // All members make payments with retry
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];
      
      try {
        // Call AjoCore.processPayment() with NO parameters
        await retryWithBackoff(async () => {
          const tx = await ajo.connect(participant.signer).processPayment({
            gasLimit: DEMO_CONFIG.GAS_LIMIT.PROCESS_PAYMENT
          });
          
          return await tx.wait();
        }, `${participant.name} - Payment`);
        
        cycleData.payments.push({
          member: participant.name,
          amount: DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
          success: true
        });
        
        const status = c.green("✅ Paid");
        console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT_USDC).padEnd(12)} │ ${status.padEnd(20)} │`));
        
      } catch (error) {
        cycleData.payments.push({
          member: participant.name,
          error: error.message,
          success: false
        });
        
        const status = c.red("❌ Failed");
        console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${'N/A'.padEnd(12)} │ ${status.padEnd(20)} │`));
        console.log(c.red(`        Error: ${error.message.slice(0, 150)}`));
      }
      
      await sleep(2000);
    }
    
    console.log(c.dim("     └────┴─────────────┴──────────────┴──────────────┘\n"));
    
    const successfulPayments = cycleData.payments.filter(p => p.success).length;
    console.log(c.green(`     ✅ ${successfulPayments}/${participants.length} payments processed\n`));
    
    await sleep(2000);
    
    // ============ NEW: GET CYCLE PAYMENT STATUS ============
    console.log(c.cyan(`  📊 Step 1.5: Verify Cycle Payment Status\n`));
    
    try {
      const paymentStatus = await retryWithBackoff(
        async () => await ajoPayments.getCyclePaymentStatus(currentCycle),
        "Get Cycle Payment Status"
      );
      
      const [paidMembers, unpaidMembers, totalCollected] = paymentStatus;
      
      console.log(c.bright(`     Payment Status for Cycle ${currentCycle}:\n`));
      console.log(c.dim(`     Total Collected: ${formatUSDC(totalCollected)}`));
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
    
    // ============ DISTRIBUTE PAYOUT ============
    console.log(c.cyan(`  💰 Step 2: Distribute Payout to ${recipientName}\n`));
    
    try {
      const isReady = await retryWithBackoff(
        async () => await ajoPayments.isPayoutReady(),
        "Check Payout Ready"
      );
      console.log(c.dim(`     Payout Ready: ${isReady ? c.green('✅ Yes') : c.red('❌ No')}`));
      
      if (!isReady) {
        throw new Error("Payout not ready - check member payments or contract logic");
      }
      
      const expectedPayout = await retryWithBackoff(
        async () => await ajoPayments.calculatePayout(),
        "Calculate Payout"
      );
      console.log(c.bright(`     Expected Payout: ${formatUSDC(expectedPayout)}\n`));
      
      const payoutReceipt = await retryWithBackoff(async () => {
        const payoutTx = await ajo.connect(participants[0].signer).distributePayout({
          gasLimit: DEMO_CONFIG.GAS_LIMIT.DISTRIBUTE_PAYOUT
        });
        return await payoutTx.wait();
      }, "Distribute Payout");
      
      cycleData.payout = {
        recipient: recipientName,
        recipientAddress: nextRecipient,
        amount: expectedPayout,
        success: true,
        gasUsed: payoutReceipt.gasUsed
      };
      
      console.log(c.green(`     ✅ Payout Distributed!`));
      console.log(c.dim(`        Recipient: ${recipientName}`));
      console.log(c.dim(`        Amount: ${formatUSDC(expectedPayout)}`));
      console.log(c.dim(`        Gas Used: ${payoutReceipt.gasUsed.toString()}\n`));
      
    } catch (error) {
      cycleData.payout = {
        recipient: recipientName,
        error: error.message,
        success: false
      };
      
      console.log(c.red(`     ❌ Payout Failed: ${error.message.slice(0, 100)}\n`));
    }
    
    cycleData.endTime = Date.now();
    cycleData.duration = (cycleData.endTime - cycleData.startTime) / 1000;
    
    cycleResults.push(cycleData);
    
    console.log(c.bright(`  ✅ Cycle ${cycle} Complete`));
    console.log(c.dim(`     Duration: ${cycleData.duration.toFixed(2)} seconds\n`));
    
    // Wait for next cycle with progress indicator
    if (cycle < TOTAL_CYCLES) {
      await sleepWithProgress(cycleDuration, `Waiting for Cycle ${cycle + 1}`);
      console.log();
    }
    
    console.log(c.blue("═".repeat(88) + "\n"));
  }
  
  // ============ ENHANCED SUMMARY WITH PAYMENT STATUS ============
  console.log(c.bgGreen("\n" + " ".repeat(28) + "📊 FULL CYCLE SUMMARY 📊" + " ".repeat(32)));
  console.log(c.green("═".repeat(88) + "\n"));
  
  console.log(c.bright("  Overall Statistics:\n"));
  console.log(c.dim("     ┌─────────────────────────────┬──────────────┐"));
  console.log(c.dim(`     │ Total Cycles Completed      │ ${cycleResults.length.toString().padStart(12)} │`));
  
  const totalPayments = cycleResults.reduce((sum, c) => sum + c.payments.filter(p => p.success).length, 0);
  const totalPayouts = cycleResults.filter(c => c.payout && c.payout.success).length;
  
  console.log(c.dim(`     │ Total Payments Processed    │ ${totalPayments.toString().padStart(12)} │`));
  console.log(c.dim(`     │ Total Payouts Distributed   │ ${totalPayouts.toString().padStart(12)} │`));
  
  const avgCycleDuration = cycleResults.reduce((sum, c) => sum + c.duration, 0) / cycleResults.length;
  console.log(c.dim(`     │ Avg Cycle Duration          │ ${avgCycleDuration.toFixed(2).padStart(10)}s │`));
  
  // Add payment status summary
  const cyclesWithFullPayment = cycleResults.filter(c => c.paymentStatus?.allPaid).length;
  console.log(c.dim(`     │ Cycles w/ Full Payment      │ ${cyclesWithFullPayment.toString().padStart(12)} │`));
  
  console.log(c.dim("     └─────────────────────────────┴──────────────┘\n"));
  
  console.log(c.bright("  Payout Recipients:\n"));
  console.log(c.dim("     ┌──────┬─────────────┬──────────────┬──────────────┐"));
  console.log(c.dim("     │ Cycle│ Recipient   │ Amount       │ Status       │"));
  console.log(c.dim("     ├──────┼─────────────┼──────────────┼──────────────┤"));
  
  for (const cycleData of cycleResults) {
    if (cycleData.payout) {
      const status = cycleData.payout.success ? c.green("✅ Success") : c.red("❌ Failed");
      const amount = cycleData.payout.amount ? formatUSDC(cycleData.payout.amount) : "N/A";
      console.log(c.dim(`     │ ${cycleData.cycle.toString().padStart(4)} │ ${cycleData.payout.recipient.padEnd(11)} │ ${amount.padEnd(12)} │ ${status.padEnd(20)} │`));
    }
  }
  
  console.log(c.dim("     └──────┴─────────────┴──────────────┴──────────────┘\n"));
  
  console.log(c.green("═".repeat(88) + "\n"));
  
  return cycleResults;
}

// ================================================================
// NEW: CREATE REAL HCS TOPIC
// ================================================================

async function createRealHcsTopic(hederaClient, ajoName) {
  console.log(c.cyan("  🌐 Creating Real HCS Topic for Ajo...\n"));
  
  if (!hederaClient) {
    console.log(c.yellow("     ⚠️  No Hedera client - using simulated topic ID\n"));
    const simulatedTopicNum = Math.floor(Math.random() * 1000000);
    const bytes32TopicId = ethers.utils.hexZeroPad(
      ethers.utils.hexlify(simulatedTopicNum), 
      32
    );
    return {
      topicId: `0.0.${simulatedTopicNum}`,
      bytes32TopicId: bytes32TopicId,
      simulated: true
    };
  }

  try {
    const { TopicCreateTransaction } = require("@hashgraph/sdk");
    
    console.log(c.yellow(`     → Creating HCS topic for "${ajoName}"...`));
    
    const transaction = new TopicCreateTransaction()
      .setTopicMemo(`AJO.SAVE Governance - ${ajoName}`)
      .setAdminKey(hederaClient.operatorPublicKey);
    
    const txResponse = await transaction.execute(hederaClient);
    const receipt = await txResponse.getReceipt(hederaClient);
    
    const topicId = receipt.topicId.toString();
    const topicNum = receipt.topicId.num.toString();
    const bytes32TopicId = ethers.utils.hexZeroPad(
      ethers.utils.hexlify(BigInt(topicNum)),
      32
    );
    
    console.log(c.green(`     ✅ HCS Topic Created!`));
    console.log(c.dim(`        Topic ID (Hedera): ${topicId}`));
    console.log(c.dim(`        Topic ID (bytes32): ${bytes32TopicId}\n`));
    
    return {
      topicId: topicId,
      bytes32TopicId: bytes32TopicId,
      transactionId: txResponse.transactionId.toString(),
      simulated: false
    };
    
  } catch (error) {
    console.log(c.red(`     ❌ Failed to create HCS topic: ${error.message}\n`));
    console.log(c.yellow("     Falling back to simulated topic ID...\n"));
    
    const simulatedTopicNum = Math.floor(Math.random() * 1000000);
    const bytes32TopicId = ethers.utils.hexZeroPad(
      ethers.utils.hexlify(simulatedTopicNum), 
      32
    );
    
    return {
      topicId: `0.0.${simulatedTopicNum}`,
      bytes32TopicId: bytes32TopicId,
      simulated: true,
      error: error.message
    };
  }
}
// ================================================================
// COMPREHENSIVE AJO STATE INSPECTION
// ================================================================
async function inspectAjoState(ajo, ajoMembers, ajoPayments, ajoCollateral, ajoFactory, ajoId) {
  console.log(c.cyan("\n📊 INSPECTING AJO STATE BEFORE OPERATIONS...\n"));
  
  try {
    // 1. Contract Stats from AjoMembers
    console.log(c.bright("  1️⃣ Contract Statistics (from AjoMembers):"));
    const stats = await ajoMembers.getContractStats();
    console.log(c.dim(`     Total Members: ${stats.totalMembers}`));
    console.log(c.dim(`     Active Members: ${stats.activeMembers}`));
    console.log(c.dim(`     Total Collateral USDC: ${formatUSDC(stats.totalCollateralUSDC)}`));
    console.log(c.dim(`     Total Collateral HBAR: ${formatHBAR(stats.totalCollateralHBAR)}`));
    console.log(c.dim(`     Contract Balance USDC: ${formatUSDC(stats.contractBalanceUSDC)}`));
    console.log(c.dim(`     Contract Balance HBAR: ${formatHBAR(stats.contractBalanceHBAR)}`));
    console.log(c.dim(`     Current Queue Position: ${stats.currentQueuePosition}`));
    console.log(c.dim(`     Active Token: ${stats.activeToken === 0 ? 'USDC' : 'HBAR'}\n`));
    
    // 2. Payment Cycle Information
    console.log(c.bright("  2️⃣ Payment Cycle Information (from AjoPayments):"));
    const currentCycle = await ajoPayments.getCurrentCycle();
    const nextPayoutPosition = await ajoPayments.getNextPayoutPosition();
    const activeToken = await ajoPayments.getActivePaymentToken();
    const tokenConfig = await ajoPayments.getTokenConfig(activeToken);
    const isPayoutReady = await ajoPayments.isPayoutReady();
    
    console.log(c.dim(`     Current Cycle: ${currentCycle}`));
    console.log(c.dim(`     Next Payout Position: ${nextPayoutPosition}`));
    console.log(c.dim(`     Active Payment Token: ${activeToken === 0 ? 'USDC' : 'HBAR'}`));
    console.log(c.dim(`     Monthly Payment: ${activeToken === 0 ? formatUSDC(tokenConfig.monthlyPayment) : formatHBAR(tokenConfig.monthlyPayment)}`));
    console.log(c.dim(`     Token Active: ${tokenConfig.isActive}`));
    console.log(c.dim(`     Is Payout Ready: ${isPayoutReady}\n`));
    
    // 3. Next Recipient Info
    console.log(c.bright("  3️⃣ Next Recipient Information:"));
    try {
      const nextRecipient = await ajoPayments.getNextRecipient();
      console.log(c.dim(`     Next Recipient Address: ${nextRecipient}`));
      
      if (nextRecipient !== ethers.constants.AddressZero) {
        const memberInfo = await ajoMembers.getMemberInfo(nextRecipient);
        console.log(c.dim(`     Queue Position: ${memberInfo.memberInfo.queueNumber}`));
        console.log(c.dim(`     Has Received Payout: ${memberInfo.memberInfo.hasReceivedPayout}`));
        console.log(c.dim(`     Is Active: ${memberInfo.memberInfo.isActive}\n`));
      } else {
        console.log(c.yellow(`     ⚠️ No recipient set (Ajo may be empty)\n`));
      }
    } catch (error) {
      console.log(c.yellow(`     ⚠️ Could not get next recipient: ${error.message}\n`));
    }
    
    // 4. Active Members Details
    console.log(c.bright("  4️⃣ Active Members Details:"));
    const activeMembersList = await ajoMembers.getActiveMembersList();
    
    try {
      const allMembersDetails = await ajoMembers.getAllMembersDetails();
      console.log(c.dim(`     Total Active: ${allMembersDetails.length}`));
      
      if (allMembersDetails.length > 0) {
        console.log(c.dim(`\n     📋 Member Details Table:\n`));
        console.log(c.bright(`     ${'#'.padEnd(3)} | ${'Address'.padEnd(12)} | ${'Queue'.padEnd(5)} | ${'Paid?'.padEnd(5)} | ${'Collateral'.padEnd(12)} | ${'Payout?'.padEnd(7)} | ${'Defaults'.padEnd(8)} | ${'Rep'.padEnd(4)}`));
        console.log(c.dim(`     ${'-'.repeat(80)}`));
        
        for (let i = 0; i < allMembersDetails.length; i++) {
          const detail = allMembersDetails[i];
          const num = (i + 1).toString().padEnd(3);
          const addr = detail.userAddress.slice(0, 10) + '..';
          const queue = detail.queuePosition.toString().padEnd(5);
          const paid = (detail.hasPaidThisCycle ? '✓' : '✗').padEnd(5);
          const collateral = formatUSDC(detail.collateralLocked).padEnd(12);
          const payout = (detail.hasReceivedPayout ? '✓' : '✗').padEnd(7);
          const defaults = detail.defaultCount.toString().padEnd(8);
          const rep = detail.reputationScore.toString().padEnd(4);
          
          const color = detail.hasPaidThisCycle ? c.green : c.yellow;
          console.log(color(`     ${num} | ${addr} | ${queue} | ${paid} | ${collateral} | ${payout} | ${defaults} | ${rep}`));
          
          if (detail.guarantorAddress !== ethers.constants.AddressZero) {
            console.log(c.dim(`          └─ Guarantor: ${detail.guarantorAddress.slice(0, 8)}... (Queue: ${detail.guarantorQueuePosition})`));
          }
        }
        console.log();
        
        const paidMembers = allMembersDetails.filter(d => d.hasPaidThisCycle).length;
        const receivedPayout = allMembersDetails.filter(d => d.hasReceivedPayout).length;
        const totalCollateral = allMembersDetails.reduce((sum, d) => sum.add(d.collateralLocked), ethers.BigNumber.from(0));
        const avgReputation = allMembersDetails.reduce((sum, d) => sum + d.reputationScore.toNumber(), 0) / allMembersDetails.length;
        
        console.log(c.bright(`     📊 Member Statistics:`));
        console.log(c.dim(`        Members Paid This Cycle: ${paidMembers}/${allMembersDetails.length}`));
        console.log(c.dim(`        Members Received Payout: ${receivedPayout}/${allMembersDetails.length}`));
        console.log(c.dim(`        Total Collateral Locked: ${formatUSDC(totalCollateral)} USDC`));
        console.log(c.dim(`        Average Reputation: ${avgReputation.toFixed(2)}\n`));
      }
    } catch (error) {
      console.log(c.yellow(`     ⚠️ Could not get detailed members: ${error.message}\n`));
    }
    
    // 5. Current Cycle Dashboard
    console.log(c.bright("  5️⃣ Current Cycle Dashboard:"));
    try {
      const dashboard = await ajoPayments.getCurrentCycleDashboard();
      console.log(c.dim(`     Current Cycle: ${dashboard.currentCycle}`));
      console.log(c.dim(`     Next Payout Position: ${dashboard.nextPayoutPosition}`));
      console.log(c.dim(`     Next Recipient: ${dashboard.nextRecipient}`));
      console.log(c.dim(`     Expected Payout: ${formatUSDC(dashboard.expectedPayout)}`));
      console.log(c.dim(`     Total Paid This Cycle: ${formatUSDC(dashboard.totalPaidThisCycle)}`));
      console.log(c.dim(`     Remaining To Pay: ${formatUSDC(dashboard.remainingToPay)}`));
      console.log(c.dim(`     Members Paid Count: ${dashboard.membersPaid.length}`));
      console.log(c.dim(`     Members Unpaid Count: ${dashboard.membersUnpaid.length}`));
      console.log(c.dim(`     Is Payout Ready: ${dashboard.isPayoutReady}\n`));
    } catch (error) {
      console.log(c.yellow(`     ⚠️ Could not get cycle dashboard: ${error.message}\n`));
    }
    
    // 6. Factory Health Status
    console.log(c.bright("  6️⃣ Factory Health Status:"));
    const initStatus = await ajoFactory.getAjoInitializationStatus(ajoId);
    const operationalStatus = await ajoFactory.getAjoOperationalStatus(ajoId);
    
    console.log(c.dim(`     Initialization Phase: ${initStatus.phase}/5`));
    console.log(c.dim(`     Is Ready: ${initStatus.isReady}`));
    console.log(c.dim(`     Is Fully Finalized: ${initStatus.isFullyFinalized}`));
    console.log(c.dim(`     Total Members: ${operationalStatus.totalMembers}`));
    console.log(c.dim(`     Current Cycle: ${operationalStatus.currentCycle}`));
    console.log(c.dim(`     Can Accept Members: ${operationalStatus.canAcceptMembers}\n`));
    
    console.log(c.green("✅ State inspection complete!\n"));
    
    return {
      stats,
      currentCycle,
      nextPayoutPosition,
      activeToken,
      tokenConfig,
      isPayoutReady,
      activeMembersList,
      initStatus,
      operationalStatus
    };
    
  } catch (error) {
    console.log(c.red(`❌ State inspection failed: ${error.message}\n`));
    throw error;
  }
}

// ================================================================
// UPDATED MAIN DEMONSTRATION WITH STATE INSPECTION
// ================================================================

async function main() {
  try {
    printEnhancedBanner();
    
    await sleep(2000);
    
    const { ajoFactory, deployer, masterContracts, usdcHtsToken, hbarHtsToken } = 
      await deployHtsSystem();
    
    await sleep(3000);
    
    let hederaClient = null;
    try {
      const { setupHederaClient } = require('./governance_hcs_demo.cjs');
      hederaClient = setupHederaClient();
    } catch (error) {
      console.log(c.yellow("⚠️  Hedera client setup failed - will use simulated topics"));
    }
    
    const { ajoId, ajoInfo, hcsTopicId, hcsTopicIdBytes32, hcsTopicSimulated, cycleDuration } = await createHtsAjo(
      ajoFactory, 
      deployer,
      hederaClient,
      {
        name: "African Ajo",
        useScheduledPayments: true,
        cycleDuration: DEMO_CONFIG.CYCLE_DURATION,
        monthlyPaymentUSDC: DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
        monthlyPaymentHBAR: DEMO_CONFIG.MONTHLY_PAYMENT_HBAR
      }
    );
    
    await sleep(3000);

    const { ajo, ajoMembers, ajoCollateral, ajoPayments, participants } = 
      await setupHtsParticipants(ajoFactory, ajoId);
    
    await sleep(3000);
    
    // const joinResults = await demonstrateMemberJoining(
    //   ajo, 
    //   ajoCollateral, 
    //   ajoMembers, 
    //   participants,
    //   ajoInfo
    // );
    
    await sleep(3000);
    
    // ============ NEW: INSPECT AJO STATE BEFORE CYCLES ============
    console.log(c.bgBlue("\n" + " ".repeat(25) + "🔍 PRE-CYCLE STATE INSPECTION" + " ".repeat(29)));
    console.log(c.blue("═".repeat(88) + "\n"));
    
    const preStateInspection = await inspectAjoState(
      ajo,
      ajoMembers, 
      ajoPayments, 
      ajoCollateral, 
      ajoFactory, 
      ajoId
    );
    
    await sleep(3000);
    // ============================================================
    
    // Run full 10 cycles
    // const cycleResults = await demonstrateFullCycles(
    //   ajo,
    //   ajoPayments,
    //   participants,
    //   cycleDuration
    // );
    
    await sleep(2000);
    
    // ============ NEW: INSPECT AJO STATE AFTER CYCLES ============
    console.log(c.bgBlue("\n" + " ".repeat(25) + "🔍 POST-CYCLE STATE INSPECTION" + " ".repeat(28)));
    console.log(c.blue("═".repeat(88) + "\n"));
    
    const postStateInspection = await inspectAjoState(
      ajo,
      ajoMembers, 
      ajoPayments, 
      ajoCollateral, 
      ajoFactory, 
      ajoId
    );
    
    await sleep(2000);
    // ============================================================
    
    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployedAt: new Date().toISOString(),
      htsOnly: true,
      contracts: {
        AjoFactory: ajoFactory.address,
        USDC_HTS: usdcHtsToken,
        WHBAR_HTS: hbarHtsToken
      },
      masterCopies: {
        AjoCore: masterContracts.ajoCore.address,
        AjoMembers: masterContracts.ajoMembers.address,
        AjoCollateral: masterContracts.ajoCollateral.address,
        AjoPayments: masterContracts.ajoPayments.address,
        AjoGovernance: masterContracts.ajoGovernance.address,
        AjoSchedule: masterContracts.ajoSchedule.address
      },
      testAjo: {
        id: ajoId,
        name: ajoInfo.name,
        core: ajoInfo.ajoCore,
        cycleDuration: cycleDuration,
        monthlyPaymentUSDC: formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT_USDC),
        monthlyPaymentHBAR: formatHBAR(DEMO_CONFIG.MONTHLY_PAYMENT_HBAR),
        hcsTopicId: hcsTopicId,
        hcsTopicIdBytes32: hcsTopicIdBytes32,
        hcsTopicSimulated: hcsTopicSimulated
      },
      participants: participants.map(p => ({
        name: p.name,
        address: p.address,
        position: p.position
      })),
      statistics: {
        totalParticipants: participants.length,
        successfulJoins: joinResults.filter(r => r.success).length,
        totalCycles: cycleResults.length,
        totalPayments: cycleResults.reduce((sum, c) => sum + c.payments.filter(p => p.success).length, 0),
        totalPayouts: cycleResults.filter(c => c.payout && c.payout.success).length
      },
      stateInspections: {
        preState: preStateInspection,
        postState: postStateInspection
      },
      cycleResults: cycleResults
    };
    
    const filename = `deployment-full-cycles-${Date.now()}.json`;
    try {
      fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
      console.log(c.green(`\n  ✅ Deployment info saved to: ${filename}\n`));
    } catch (error) {
      console.log(c.yellow(`\n  ⚠️ Could not save deployment info\n`));
    }
    
    console.log(c.bgGreen("\n" + " ".repeat(28) + "🎉 DEMONSTRATION COMPLETE! 🎉" + " ".repeat(28)));
    console.log(c.green("═".repeat(88) + "\n"));
    console.log(c.bright("  🚀 AJO.SAVE - Full 10-Cycle Demo Complete!\n"));
    
    console.log(c.yellow("  ✨ Features Demonstrated:"));
    console.log(c.dim("     • HTS tokens with auto-association"));
    console.log(c.dim("     • Configurable cycle duration (30 seconds)"));
    console.log(c.dim("     • Configurable monthly payments"));
    console.log(c.dim("     • Dynamic collateral system"));
    console.log(c.dim("     • Member joining workflow"));
    console.log(c.dim("     • Pre/Post cycle state inspection"));
    console.log(c.dim("     • 10 complete payment cycles"));
    console.log(c.dim("     • Payout distribution per cycle"));
    console.log(c.dim("     • Real-time cycle progression\n"));
    
    console.log(c.yellow("  📊 Demo Statistics:"));
    console.log(c.dim(`     • Participants: ${participants.length}`));
    console.log(c.dim(`     • Cycles Completed: ${cycleResults.length}`));
    console.log(c.dim(`     • Total Payments: ${deploymentInfo.statistics.totalPayments}`));
    console.log(c.dim(`     • Total Payouts: ${deploymentInfo.statistics.totalPayouts}`));
    console.log(c.dim(`     • Cycle Duration: ${cycleDuration}s\n`));
    
    // Display state comparison
    console.log(c.yellow("  🔍 State Comparison (Pre → Post):"));
    console.log(c.dim(`     • Total Members: ${preStateInspection.stats.totalMembers} → ${postStateInspection.stats.totalMembers}`));
    console.log(c.dim(`     • Current Cycle: ${preStateInspection.currentCycle} → ${postStateInspection.currentCycle}`));
    console.log(c.dim(`     • Next Payout Position: ${preStateInspection.nextPayoutPosition} → ${postStateInspection.nextPayoutPosition}`));
    console.log(c.dim(`     • Payout Ready: ${preStateInspection.isPayoutReady} → ${postStateInspection.isPayoutReady}\n`));
    
    console.log(c.green("═".repeat(88) + "\n"));
    
    if (hederaClient) {
      hederaClient.close();
    }
    
    return deploymentInfo;
    
  } catch (error) {
    console.error(c.red("\n💥 Demonstration failed:"));
    console.error(c.red(`   ${error.message}`));
    console.error(error);
    throw error;
  }
}

// ================================================================
// ENTRY POINT
// ================================================================

if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🎉 Full 10-cycle demonstration completed successfully!\n"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Demonstration failed\n"));
      process.exit(1);
    });
}

module.exports = {
  main,
  deployHtsSystem,
  createHtsAjo,
  setupHtsParticipants,
  demonstrateMemberJoining,
  demonstrateFullCycles
}; 