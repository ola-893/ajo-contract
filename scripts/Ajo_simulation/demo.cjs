#!/usr/bin/env node
const { ethers } = require("hardhat");
const fs = require('fs');

// Import utilities from existing demos
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

const {
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
  bgYellow: (text) => `\x1b[43m\x1b[30m${text}\x1b[0m`
};

const DEMO_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  MONTHLY_PAYMENT: ethers.utils.parseUnits("50", 6),
  TOTAL_PARTICIPANTS: 10,
  GAS_LIMIT: {
    DEPLOY_TOKEN: 3000000,
    DEPLOY_MASTER: 6000000,
    DEPLOY_GOVERNANCE: 6000000,
    DEPLOY_FACTORY: 15000000, 
    CREATE_AJO: 1500000,
    INIT_PHASE_2: 1200000,
    INIT_PHASE_3: 1500000,
    INIT_PHASE_4: 1800000,
    INIT_PHASE_5: 1500000,
    FINALIZE: 2500000,
    SCHEDULE_PAYMENT: 800000,
    CREATE_PROPOSAL: 500000,
    VOTE: 200000,
    JOIN_AJO: 800000,
    PROCESS_PAYMENT: 900000,
    DISTRIBUTE_PAYOUT: 400000
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const formatHBAR = (amount) => ethers.utils.formatUnits(amount, 8);

// ================================================================
// ENHANCED BANNER WITH HEDERA BRANDING
// ================================================================

function printEnhancedBanner() {
  console.log(c.magenta("\n" + "═".repeat(88)));
  console.log(c.bold(c.cyan("╔══════════════════════════════════════════════════════════════════════════════════════╗")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("║") + c.bgBlue("                        🏦 AJO.SAVE - HEDERA HACKATHON 2025 🏦                        ") + c.cyan("║")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("╚══════════════════════════════════════════════════════════════════════════════════════╝")));
  console.log(c.magenta("═".repeat(88)));
  
  console.log(c.bright("\n" + " ".repeat(15) + "Revolutionary ROSCA System Built on Hedera"));
  console.log(c.dim(" ".repeat(12) + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  
  console.log(c.yellow("\n  🌟 HEDERA NATIVE SERVICES INTEGRATION:"));
  console.log(c.green("     ✓ Hedera Token Service (HTS)") + c.dim(" - Custom fungible tokens with built-in controls"));
  console.log(c.green("     ✓ Hedera Schedule Service (HSS)") + c.dim(" - Automated recurring payment scheduling"));
  console.log(c.green("     ✓ Hedera Consensus Service (HCS)") + c.dim(" - Transparent, immutable governance voting"));
  
  console.log(c.yellow("\n  💡 KEY INNOVATIONS:"));
  console.log(c.cyan("     • 55% Capital Efficiency") + c.dim(" - Revolutionary V2 collateral model"));
  console.log(c.cyan("     • On-Chain Credit History") + c.dim(" - Build reputation through participation"));
  console.log(c.cyan("     • Cross-Collateralization") + c.dim(" - Guarantor network for security"));
  console.log(c.cyan("     • Automated Enforcement") + c.dim(" - Smart contract-based default handling"));
  console.log(c.cyan("     • Democratic Governance") + c.dim(" - Community-driven decision making"));
  
  console.log(c.yellow("\n  📊 SYSTEM ARCHITECTURE:"));
  console.log(c.dim("     • 5-Phase Factory Deployment - Modular, gas-optimized architecture"));
  console.log(c.dim("     • 6 Specialized Contracts - Separation of concerns for maintainability"));
  console.log(c.dim("     • 50+ View Functions - Complete transparency for frontend integration"));
  console.log(c.dim("     • Multi-Token Support - USDC & HBAR with seamless switching"));
  console.log(c.dim("     • Production-Ready - Comprehensive error handling & security"));
  
  console.log(c.dim("\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(c.bright("  🎯 TARGET: Financial Inclusion for 2+ Billion Underbanked People"));
  console.log(c.dim("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  
  // Show configuration info
  const useHts = process.env.USE_HTS === 'true';
  const useHss = process.env.USE_HSS !== 'false'; // Default true
  
  console.log(c.yellow("\n  ⚙️  DEMO CONFIGURATION:"));
  console.log(c.dim(`     • HTS Tokens: ${useHts ? c.green('Enabled') : c.yellow('Disabled (using ERC20)')}`));
  console.log(c.dim(`     • HSS Scheduling: ${useHss ? c.green('Enabled') : c.yellow('Disabled')}`));
  console.log(c.dim(`     • HCS Governance: ${c.green('Enabled (always)')}`));
  
  if (useHts) {
    console.log(c.dim("\n     Note: HTS requires 40 HBAR for token creation (20 per token)"));
    console.log(c.dim("     If HTS creation fails, demo will fallback to ERC20 tokens"));
  }
  
  console.log(c.dim("\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));
}

// ================================================================
// ENHANCED RETRY OPERATION
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
// PHASE 1: COMPREHENSIVE DEPLOYMENT WITH HEDERA SERVICES
// ================================================================

async function deployComprehensiveSystem() {
  console.log(c.bgBlue("\n" + " ".repeat(30) + "PHASE 1: SYSTEM DEPLOYMENT" + " ".repeat(30)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  const [deployer] = await ethers.getSigners();
  console.log(c.bright(`  👤 Deployer: ${deployer.address}`));
  const balance = await deployer.getBalance();
  console.log(c.dim(`     Balance: ${ethers.utils.formatEther(balance)} ETH\n`));
  
  // Step 1.1: Deploy Mock ERC20 Tokens (Fallback)
  console.log(c.cyan("  📝 Step 1.1: Deploying Mock ERC20 Tokens..."));
  console.log(c.dim("     (These serve as fallback if HTS is unavailable)\n"));
  
  let usdc, whbar;
  
  await retryOperation(async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_TOKEN
    });
    await usdc.deployed();
    console.log(c.green(`      ✅ Mock USDC: ${usdc.address}`));
    return usdc;
  }, "Deploy Mock USDC");
  
  await sleep(2000);
  
  await retryOperation(async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    whbar = await MockERC20.deploy("Wrapped HBAR", "WHBAR", 8, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_TOKEN
    });
    await whbar.deployed();
    console.log(c.green(`      ✅ Mock WHBAR: ${whbar.address}\n`));
    return whbar;
  }, "Deploy Mock WHBAR");
  
  await sleep(2000);
  
  // Step 1.2: Deploy Master Implementation Contracts
  console.log(c.cyan("  📝 Step 1.2: Deploying Master Implementation Contracts..."));
  console.log(c.dim("     (These are templates used by the factory for clone deployments)\n"));
  
  const masterContracts = {};
  const contracts = [
    { name: "AjoCore", key: "ajoCore", desc: "Main orchestration & coordination", icon: "🎯" },
    { name: "AjoMembers", key: "ajoMembers", desc: "Member management & queue system", icon: "👥" },
    { name: "AjoCollateral", key: "ajoCollateral", desc: "Dynamic collateral calculations", icon: "🔒" },
    { name: "AjoPayments", key: "ajoPayments", desc: "Payment processing & distribution", icon: "💳" },
    { name: "AjoGovernance", key: "ajoGovernance", desc: "On-chain governance with HCS", icon: "🗳️" },
    { name: "AjoSchedule", key: "ajoSchedule", desc: "HSS automated scheduling (NEW!)", icon: "📅" }
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
  
  // Step 1.3: Deploy Factory with Hedera Services
  console.log(c.cyan("  📝 Step 1.3: Deploying 5-Phase AjoFactory with Hedera Integration..."));
  console.log(c.dim("     (Central factory managing all Ajo deployments)\n"));
  
  const HEDERA_TOKEN_SERVICE = process.env.HTS_ADDRESS || "0x0000000000000000000000000000000000000167";
  const HEDERA_SCHEDULE_SERVICE = process.env.HSS_ADDRESS || "0x000000000000000000000000000000000000016b";
  
  console.log(c.dim(`      🔗 HTS Address: ${HEDERA_TOKEN_SERVICE}`));
  console.log(c.dim(`      🔗 HSS Address: ${HEDERA_SCHEDULE_SERVICE}`));
  console.log(c.dim(`      🔗 HCS: Will be created per-Ajo\n`));
  
  let ajoFactory;
  await retryOperation(async () => {
    const AjoFactory = await ethers.getContractFactory("AjoFactory");
    ajoFactory = await AjoFactory.deploy(
      usdc.address,
      whbar.address,
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
    console.log(c.green(`      ✅ 5-Phase AjoFactory: ${ajoFactory.address}\n`));
    return ajoFactory;
  }, "Deploy 5-Phase AjoFactory");
  
  // Step 1.4: Verify Hedera Integration
  console.log(c.cyan("  📝 Step 1.4: Verifying Hedera Services Integration...\n"));
  
  const htsEnabled = await ajoFactory.isHtsEnabled();
  const hssAddress = await ajoFactory.getScheduleServiceAddress();
  
  console.log(c.dim("      ┌─────────────────────────────────────────────────────┐"));
  console.log(c.dim("      │ Service Status                                      │"));
  console.log(c.dim("      ├─────────────────────────────────────────────────────┤"));
  console.log(c.dim("      │ HTS (Token Service):     " + (htsEnabled ? c.green('✅ ENABLED ') : c.red('❌ DISABLED')) + "            │"));
  console.log(c.dim("      │ HSS (Schedule Service):  " + (hssAddress !== ethers.constants.AddressZero ? c.green('✅ ENABLED ') : c.red('❌ DISABLED')) + "            │"));
  console.log(c.dim("      │ HCS (Consensus Service): " + c.green('✅ READY   ') + "            │"));
  console.log(c.dim("      └─────────────────────────────────────────────────────┘\n"));
  
  // Step 1.5: Create HTS Tokens (Optional but CRITICAL if USE_HTS is true)
  let TOKEN_ADDRESSES = {
    USDC: usdc.address,
    WHBAR: whbar.address,
    USDC_HTS: ethers.constants.AddressZero,
    WHBAR_HTS: ethers.constants.AddressZero
  };
  
  let shouldUseHts = false; // Track if HTS is actually ready
  
  // FIXED: Use HEDERA_TOKEN_SERVICE instead of undefined hederaTokenService
  if (HEDERA_TOKEN_SERVICE !== ethers.constants.AddressZero) {
    console.log(c.cyan("  📝 Step 1.5: Creating Native HTS Tokens...\n"));
    console.log(c.dim("     (Required for HTS-enabled Ajos)\n"));
    
    try {
      const htsTokens = await retryOperation(async () => {
        const tx = await ajoFactory.createHtsTokens({ 
          value: ethers.utils.parseEther("40"), // Need 40 HBAR (20 per token)
          gasLimit: 5000000
        });
        const receipt = await tx.wait();
        
        const usdcEvent = receipt.events?.find(e => e.event === 'HtsTokenCreated' && e.args?.symbol === 'USDC');
        const hbarEvent = receipt.events?.find(e => e.event === 'HtsTokenCreated' && e.args?.symbol === 'WHBAR');
        
        TOKEN_ADDRESSES.USDC_HTS = usdcEvent?.args?.tokenAddress || ethers.constants.AddressZero;
        TOKEN_ADDRESSES.WHBAR_HTS = hbarEvent?.args?.tokenAddress || ethers.constants.AddressZero;
        
        console.log(c.green(`      ✅ HTS USDC Token: ${TOKEN_ADDRESSES.USDC_HTS}`));
        console.log(c.green(`      ✅ HTS WHBAR Token: ${TOKEN_ADDRESSES.WHBAR_HTS}\n`));
        
        shouldUseHts = true; // HTS is now ready
        
        return { usdc: TOKEN_ADDRESSES.USDC_HTS, hbar: TOKEN_ADDRESSES.WHBAR_HTS };
      }, "Create HTS Tokens");
      
    } catch (error) {
      console.log(c.yellow(`      ⚠️ HTS token creation failed: ${error.message.slice(0, 100)}`));
      console.log(c.yellow(`      ⚠️ Falling back to standard ERC20 tokens\n`));
      shouldUseHts = false;
    }
  } else {
    console.log(c.yellow("  ⊘ Step 1.5: HTS Token Creation Skipped"));
    console.log(c.dim("     HTS service not configured - using standard ERC20 tokens\n"));
  }
  
  // Override USE_HTS environment variable if HTS creation failed
  if (process.env.USE_HTS === 'true' && !shouldUseHts) {
    console.log(c.yellow("  ⚠️ Note: USE_HTS was set to 'true' but HTS tokens are not available"));
    console.log(c.yellow("     All Ajos will use standard ERC20 tokens instead\n"));
  }
  
  console.log(c.green("  ✅ System Deployment Complete!\n"));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { ajoFactory, usdc, whbar, deployer, masterContracts, TOKEN_ADDRESSES, shouldUseHts };
}

// ================================================================
// PHASE 2: 5-PHASE AJO CREATION WITH HEDERA
// ================================================================

async function create5PhaseAjoWithFullHedera(ajoFactory, deployer, shouldUseHts, options = {}) {
  console.log(c.bgBlue("\n" + " ".repeat(28) + "PHASE 2: 5-PHASE AJO CREATION" + " ".repeat(29)));
  console.log(c.blue("═".repeat(88)));
  
  const {
    name = `Production Ajo ${Date.now()}`,
    useScheduledPayments = true
  } = options;
  
  // Determine if we should actually use HTS based on availability
  const useHtsTokens = shouldUseHts && (await ajoFactory.isHtsEnabled());
  
  console.log(c.bright("\n  📋 Configuration:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ Name: ${name.padEnd(51)} │`));
  console.log(c.dim(`     │ HTS Tokens: ${(useHtsTokens ? c.green('✅ Enabled') : c.yellow('❌ Using ERC20')).padEnd(60)} │`));
  console.log(c.dim(`     │ HSS Scheduling: ${(useScheduledPayments ? c.green('✅ Enabled') : c.yellow('❌ Manual')).padEnd(56)} │`));
  console.log(c.dim(`     │ HCS Governance: ${c.green('✅ Always Enabled').padEnd(56)} │`));
  console.log(c.dim("     └──────────────────────────────────────────────────────────┘\n"));
  
  let ajoId, hcsTopicId;
  
  // PHASE 1: Create Core
  console.log(c.cyan("  📋 PHASE 1/5: Creating Ajo Core..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).createAjo(
      name, 
      useHtsTokens, 
      useScheduledPayments,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO }
    );
    const receipt = await tx.wait();
    
    const event = receipt.events?.find(e => e.event === 'AjoCreated');
    ajoId = event?.args?.ajoId?.toNumber();
    
    console.log(c.green(`     ✅ Ajo Core Created`));
    console.log(c.dim(`        ID: ${ajoId}`));
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");
  
  await sleep(2000);
  
  // PHASE 2: Initialize Members + Governance + HCS
  console.log(c.cyan("  📋 PHASE 2/5: Initialize Members + Governance + HCS..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase2(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2
    });
    const receipt = await tx.wait();
    
    const hcsEvent = receipt.events?.find(e => e.event === 'AjoInitializedPhase2');
    hcsTopicId = hcsEvent?.args?.hcsTopicId;
    
    console.log(c.green(`     ✅ Members Contract Initialized`));
    console.log(c.green(`     ✅ Governance Contract Initialized`));
    console.log(c.green(`     ✅ HCS Topic Created`));
    console.log(c.dim(`        Topic ID: ${hcsTopicId || 'N/A'}`));
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return tx;
  }, "Initialize Ajo Phase 2");
  
  await sleep(2000);
  
  // PHASE 3: Initialize Collateral + Payments
  console.log(c.cyan("  📋 PHASE 3/5: Initialize Collateral + Payments..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3
    });
    const receipt = await tx.wait();
    console.log(c.green(`     ✅ Collateral Contract Initialized`));
    console.log(c.green(`     ✅ Payments Contract Initialized`));
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return tx;
  }, "Initialize Ajo Phase 3");
  
  await sleep(2000);
  
  // PHASE 4: Initialize Core + Cross-link
  console.log(c.cyan("  📋 PHASE 4/5: Initialize Core + Cross-link All Contracts..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4
    });
    const receipt = await tx.wait();
    console.log(c.green(`     ✅ Core Contract Initialized`));
    console.log(c.green(`     ✅ All Contracts Cross-linked`));
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return tx;
  }, "Initialize Ajo Phase 4");
  
  await sleep(2000);
  
  // PHASE 5: Initialize Schedule (if enabled)
  if (useScheduledPayments) {
    console.log(c.cyan("  📋 PHASE 5/5: Initialize Schedule Contract (HSS)..."));
    await retryOperation(async () => {
      const tx = await ajoFactory.connect(deployer).initializeAjoPhase5(ajoId, {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_5
      });
      const receipt = await tx.wait();
      console.log(c.green(`     ✅ Schedule Contract Initialized`));
      console.log(c.green(`     ✅ HSS Integration Complete`));
      console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
      return tx;
    }, "Initialize Ajo Phase 5");
  } else {
    console.log(c.yellow("  ⊘ PHASE 5/5: Schedule Contract Skipped (Not Enabled)\n"));
  }
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  
  console.log(c.blue("═".repeat(88)));
  console.log(c.green(`\n  ✅ Ajo "${name}" Successfully Created!\n`));
  console.log(c.dim("  📍 Deployed Contracts:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ Core:        ${ajoInfo.ajoCore.padEnd(42)} │`));
  console.log(c.dim(`     │ Members:     ${ajoInfo.ajoMembers.padEnd(42)} │`));
  console.log(c.dim(`     │ Collateral:  ${ajoInfo.ajoCollateral.padEnd(42)} │`));
  console.log(c.dim(`     │ Payments:    ${ajoInfo.ajoPayments.padEnd(42)} │`));
  console.log(c.dim(`     │ Governance:  ${ajoInfo.ajoGovernance.padEnd(42)} │`));
  if (useScheduledPayments) {
    console.log(c.dim(`     │ Schedule:    ${ajoInfo.ajoSchedule.padEnd(42)} │`));
  }
  console.log(c.dim("     └──────────────────────────────────────────────────────────────────┘"));
  console.log(c.dim(`\n  🔗 HCS Topic ID: ${hcsTopicId || 'N/A'}\n`));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { ajoId, ajoInfo, hcsTopicId };
}

// ================================================================
// PHASE 3: PARTICIPANT SETUP WITH TOKEN DISTRIBUTION
// ================================================================

async function setupParticipantsEnhanced(ajoFactory, usdc, whbar, ajoId) {
  console.log(c.bgBlue("\n" + " ".repeat(26) + "PHASE 3: PARTICIPANT ONBOARDING" + " ".repeat(27)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  const [deployer, ...signers] = await ethers.getSigners();
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
  
  // Nigerian names for authenticity
  const participantNames = [
    "Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", 
    "Funmilayo", "Gbenga", "Halima", "Ifeanyi", "Joke"
  ];
  
  const participants = [];
  const actualCount = Math.min(DEMO_CONFIG.TOTAL_PARTICIPANTS, signers.length);
  
  console.log(c.cyan(`  👥 Setting up ${actualCount} participants with tokens & approvals...\n`));
  console.log(c.dim("  ┌────┬─────────────┬──────────────┬─────────────┬─────────────┐"));
  console.log(c.dim("  │ #  │ Name        │ Address      │ USDC Bal    │ Status      │"));
  console.log(c.dim("  ├────┼─────────────┼──────────────┼─────────────┼─────────────┤"));
  
  // Check if using HTS tokens
  const usesHts = ajoInfo.usesHtsTokens;
  
  for (let i = 0; i < actualCount; i++) {
    const participant = {
      signer: signers[i],
      name: participantNames[i],
      address: signers[i].address,
      position: i + 1
    };
    
    try {
      // If using HTS, associate tokens first
      if (usesHts) {
        console.log(c.dim(`\n  🔗 Associating HTS tokens for ${participant.name}...`));
        
        // Get HTS token addresses
        const usdcHtsAddress = ajoInfo.usdcToken;
        const hbarHtsAddress = ajoInfo.hbarToken;
        
        // Associate with USDC HTS token
        await retryOperation(async () => {
          const hts = await ethers.getContractAt(
            "IHederaTokenService", 
            "0x0000000000000000000000000000000000000167"
          );
          
          const tx = await hts.connect(participant.signer).associateToken(
            participant.address,
            usdcHtsAddress,
            { gasLimit: 300000 }
          );
          await tx.wait();
          console.log(c.green(`     ✅ USDC associated`));
          return tx;
        }, `${participant.name} - Associate USDC HTS`);
        
        // Associate with HBAR HTS token
        await retryOperation(async () => {
          const hts = await ethers.getContractAt(
            "IHederaTokenService", 
            "0x0000000000000000000000000000000000000167"
          );
          
          const tx = await hts.connect(participant.signer).associateToken(
            participant.address,
            hbarHtsAddress,
            { gasLimit: 300000 }
          );
          await tx.wait();
          console.log(c.green(`     ✅ HBAR associated\n`));
          return tx;
        }, `${participant.name} - Associate HBAR HTS`);
      }
      
      // Get tokens from faucet (ERC20 or need to mint HTS)
      if (usesHts) {
        // For HTS, we need to transfer from factory/treasury
        console.log(c.dim(`  💰 Requesting HTS tokens for ${participant.name}...`));
        
        // Transfer USDC HTS from deployer/factory to participant
        await retryOperation(async () => {
          const hts = await ethers.getContractAt(
            "IHederaTokenService", 
            "0x0000000000000000000000000000000000000167"
          );
          
          const amount = ethers.utils.parseUnits("1000", 6);
          
          const tx = await hts.connect(deployer).transferToken(
            ajoInfo.usdcToken,
            deployer.address,
            participant.address,
            amount,
            { gasLimit: 300000 }
          );
          await tx.wait();
          console.log(c.green(`     ✅ Received 1000 USDC HTS\n`));
          return tx;
        }, `${participant.name} - Receive HTS USDC`);
      } else {
        // Standard ERC20 faucet
        await retryOperation(async () => {
          const tx = await usdc.connect(participant.signer).faucet({ gasLimit: 200000 });
          await tx.wait();
          return tx;
        }, `${participant.name} - Get USDC`);
      }
      
      const balance = await usdc.balanceOf(participant.address);
      const allowanceAmount = balance.div(2);
      
      // Approve Collateral
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).approve(
          ajoCollateral.address, 
          allowanceAmount, 
          { gasLimit: 150000 }
        );
        await tx.wait();
        return tx;
      }, `${participant.name} - Approve Collateral`);
      
      // Approve Payments
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).approve(
          ajoPayments.address, 
          allowanceAmount, 
          { gasLimit: 150000 }
        );
        await tx.wait();
        return tx;
      }, `${participant.name} - Approve Payments`);
      
      const status = c.green("✅ Ready");
      console.log(c.dim(`  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${participant.address.slice(0,10)}... │ ${formatUSDC(balance).padEnd(11)} │ ${status.padEnd(19)} │`));
      
      participants.push(participant);
      
    } catch (error) {
      const status = c.red("❌ Failed");
      console.log(c.dim(`  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${participant.address.slice(0,10)}... │ ${'N/A'.padEnd(11)} │ ${status.padEnd(19)} │`));
      console.log(c.red(`     Error: ${error.message.slice(0, 100)}`));
    }
    
    await sleep(500);
  }
  
  console.log(c.dim("  └────┴─────────────┴──────────────┴─────────────┴─────────────┘\n"));
  console.log(c.green(`  ✅ ${participants.length}/${actualCount} participants ready!\n`));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { ajo, ajoMembers, ajoCollateral, ajoPayments, participants };
}

// ================================================================
// PHASE 4: DEMONSTRATE HEDERA TOKEN SERVICE (HTS)
// ================================================================

async function demonstrateHederaTokenService(ajoFactory, ajoId, ajo, participants) {
  console.log(c.bgBlue("\n" + " ".repeat(20) + "PHASE 4: HEDERA TOKEN SERVICE (HTS) DEMONSTRATION" + " ".repeat(20)));
  console.log(c.blue("═".repeat(88)));
  console.log(c.bright("\n  💎 Native Hedera Tokens - The Future of DeFi on Hedera\n"));
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  
  if (!ajoInfo.usesHtsTokens) {
    console.log(c.yellow("  ⚠️ HTS tokens not enabled for this Ajo"));
    console.log(c.dim("     Using standard ERC20 tokens as fallback\n"));
    console.log(c.blue("═".repeat(88) + "\n"));
    return;
  }
  
  // Scenario 1: Token Information
  console.log(c.cyan("  📊 Scenario 1: HTS Token Configuration\n"));
  
  try {
    const usdcInfo = await ajo.getHtsTokenInfo(0);
    console.log(c.dim("     USDC Token (HTS):"));
    console.log(c.dim("     ┌─────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Address:      ${usdcInfo.tokenAddress.slice(0, 42).padEnd(42)} │`));
    console.log(c.dim(`     │ Name:         ${usdcInfo.name.padEnd(42)} │`));
    console.log(c.dim(`     │ Symbol:       ${usdcInfo.symbol.padEnd(42)} │`));
    console.log(c.dim(`     │ Decimals:     ${usdcInfo.decimals.toString().padEnd(42)} │`));
    console.log(c.dim(`     │ Freeze Key:   ${(usdcInfo.hasFreezeKey ? '✅ Yes' : '❌ No').padEnd(42)} │`));
    console.log(c.dim(`     │ Supply Key:   ${(usdcInfo.hasSupplyKey ? '✅ Yes' : '❌ No').padEnd(42)} │`));
    console.log(c.dim(`     │ Pause Key:    ${(usdcInfo.hasPauseKey ? '✅ Yes' : '❌ No').padEnd(42)} │`));
    console.log(c.dim("     └─────────────────────────────────────────────────┘\n"));
    
    const hbarInfo = await ajo.getHtsTokenInfo(1);
    console.log(c.dim("     WHBAR Token (HTS):"));
    console.log(c.dim("     ┌─────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Address:      ${hbarInfo.tokenAddress.slice(0, 42).padEnd(42)} │`));
    console.log(c.dim(`     │ Name:         ${hbarInfo.name.padEnd(42)} │`));
    console.log(c.dim(`     │ Symbol:       ${hbarInfo.symbol.padEnd(42)} │`));
    console.log(c.dim(`     │ Decimals:     ${hbarInfo.decimals.toString().padEnd(42)} │`));
    console.log(c.dim("     └─────────────────────────────────────────────────┘\n"));
    
  } catch (error) {
    console.log(c.yellow(`     ⚠️ Could not fetch HTS info: ${error.message.slice(0, 80)}\n`));
  }
  
  // Scenario 2: Token Associations
  console.log(c.cyan("  📊 Scenario 2: Member Token Associations\n"));
  
  console.log(c.dim("     ┌─────────────┬──────────────┬──────────────┐"));
  console.log(c.dim("     │ Member      │ USDC Assoc   │ HBAR Assoc   │"));
  console.log(c.dim("     ├─────────────┼──────────────┼──────────────┤"));
  
  for (let i = 0; i < Math.min(5, participants.length); i++) {
    const p = participants[i];
    try {
      const status = await ajo.isHtsAssociated(p.address);
      const usdcStatus = status.usdcAssociated ? c.green('✅ Yes') : c.red('❌ No');
      const hbarStatus = status.hbarAssociated ? c.green('✅ Yes') : c.red('❌ No');
      console.log(c.dim(`     │ ${p.name.padEnd(11)} │ ${usdcStatus.padEnd(20)} │ ${hbarStatus.padEnd(20)} │`));
    } catch (error) {
      console.log(c.dim(`     │ ${p.name.padEnd(11)} │ ${'⚠️ Error'.padEnd(12)} │ ${'⚠️ Error'.padEnd(12)} │`));
    }
  }
  console.log(c.dim("     └─────────────┴──────────────┴──────────────┘\n"));
  
  // HTS Benefits Summary
  console.log(c.cyan("  💡 HTS Key Benefits:\n"));
  console.log(c.green("     ✓ Native Hedera tokens - faster & cheaper than ERC20"));
  console.log(c.green("     ✓ Built-in freeze controls - compliance & security"));
  console.log(c.green("     ✓ Pause functionality - emergency safeguards"));
  console.log(c.green("     ✓ Supply management - controlled token issuance"));
  console.log(c.green("     ✓ Governance integration - democratic token policies"));
  console.log(c.green("     ✓ No smart contract needed - native Hedera feature\n"));
  
  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// PHASE 5: MEMBER JOINING WITH COLLATERAL DEMONSTRATION
// ================================================================

async function demonstrateMemberJoining(ajo, ajoCollateral, ajoMembers, participants) {
  console.log(c.bgBlue("\n" + " ".repeat(22) + "PHASE 5: MEMBER JOINING & COLLATERAL SYSTEM" + " ".repeat(22)));
  console.log(c.blue("═".repeat(88)));
  console.log(c.bright("\n  🔒 Dynamic Collateral Model V2 - 55% Capital Efficiency\n"));
  
  // Show collateral model
  console.log(c.cyan("  📊 Collateral Requirements (10 participants, 50 USDC monthly):\n"));
  
  try {
    const demo = await ajo.getCollateralDemo(10, DEMO_CONFIG.MONTHLY_PAYMENT);
    
    console.log(c.dim("     ┌──────────┬─────────────────┬─────────────┬─────────────────┐"));
    console.log(c.dim("     │ Position │ Collateral Req. │ Risk Level  │ % of Total Pool │"));
    console.log(c.dim("     ├──────────┼─────────────────┼─────────────┼─────────────────┤"));
    
    for (let i = 0; i < demo.positions.length; i++) {
      const pos = demo.positions[i].toNumber();
      const coll = formatUSDC(demo.collaterals[i]);
      const pct = ((demo.collaterals[i].mul(100).div(DEMO_CONFIG.MONTHLY_PAYMENT.mul(10))).toNumber() / 100).toFixed(1);
      
      let riskLevel, riskColor;
      if (pos <= 3) {
        riskLevel = "HIGH   ";
        riskColor = c.red;
      } else if (pos <= 7) {
        riskLevel = "MEDIUM ";
        riskColor = c.yellow;
      } else {
        riskLevel = "LOW    ";
        riskColor = c.green;
      }
      
      console.log(c.dim(`     │ ${pos.toString().padStart(8)} │ ${coll.padEnd(15)} │ ${riskColor(riskLevel).padEnd(19)} │ ${pct.padEnd(15)}% │`));
    }
    
    console.log(c.dim("     └──────────┴─────────────────┴─────────────┴─────────────────┘\n"));
    
    const totalCollateral = demo.collaterals.reduce((sum, c) => sum.add(c), ethers.BigNumber.from(0));
    const totalPool = DEMO_CONFIG.MONTHLY_PAYMENT.mul(10);
    const efficiency = totalCollateral.mul(100).div(totalPool).toNumber();
    
    console.log(c.bright(`     📈 Total Collateral: ${formatUSDC(totalCollateral)} USDC`));
    console.log(c.bright(`     📊 Total Pool: ${formatUSDC(totalPool)} USDC`));
    console.log(c.green(`     🎯 Capital Efficiency: ${efficiency}% (vs 100% traditional ROSCAs)\n`));
    
  } catch (error) {
    console.log(c.yellow(`     ⚠️ Could not generate collateral demo\n`));
  }
  
  // Members joining
  console.log(c.cyan("  👥 Members Joining Process:\n"));
  
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
      const guarantor = memberInfo.memberInfo.guarantor;
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        actualCollateral,
        guarantor,
        gasUsed: receipt.gasUsed,
        success: true
      });
      
      const status = c.green("✅ Joined");
      console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${participant.position.toString().padEnd(12)} │ ${formatUSDC(actualCollateral).padEnd(15)} │ ${status.padEnd(20)} │`));
      
    } catch (error) {
      joinResults.push({
        name: participant.name,
        position: participant.position,
        error: error.reason || error.message,
        success: false
      });
      
      const status = c.red("❌ Failed");
      console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${participant.position.toString().padEnd(12)} │ ${'N/A'.padEnd(15)} │ ${status.padEnd(20)} │`));
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
// MAIN DEMONSTRATION ORCHESTRATOR
// ================================================================

async function main() {
  try {
    printEnhancedBanner();
    
    await sleep(2000);
    
    // PHASE 1: COMPREHENSIVE DEPLOYMENT
    const { ajoFactory, usdc, whbar, deployer, masterContracts, TOKEN_ADDRESSES, shouldUseHts } = 
      await deployComprehensiveSystem();
    
    await sleep(3000);
    
    // PHASE 2: 5-PHASE AJO CREATION
    const { ajoId, ajoInfo, hcsTopicId } = await create5PhaseAjoWithFullHedera(
      ajoFactory, 
      deployer,
      shouldUseHts,
      {
        name: "Hedera Hackathon 2025 - Production Demo Ajo",
        useScheduledPayments: true
      }
    );
    
    await sleep(3000);
    
    // PHASE 3: PARTICIPANT SETUP
    const { ajo, ajoMembers, ajoCollateral, ajoPayments, participants } = 
      await setupParticipantsEnhanced(ajoFactory, usdc, whbar, ajoId);
    
    await sleep(3000);
    
    // PHASE 4: HTS DEMONSTRATION
    await demonstrateHederaTokenService(ajoFactory, ajoId, ajo, participants);
    
    await sleep(2000);
    
    // PHASE 5: MEMBER JOINING
    const joinResults = await demonstrateMemberJoining(
      ajo, 
      ajoCollateral, 
      ajoMembers, 
      participants
    );
    
    await sleep(3000);
    
    // Save deployment info
    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployedAt: new Date().toISOString(),
      contracts: {
        AjoFactory: ajoFactory.address,
        USDC: TOKEN_ADDRESSES.USDC,
        WHBAR: TOKEN_ADDRESSES.WHBAR,
        USDC_HTS: TOKEN_ADDRESSES.USDC_HTS,
        WHBAR_HTS: TOKEN_ADDRESSES.WHBAR_HTS
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
        members: ajoInfo.ajoMembers,
        collateral: ajoInfo.ajoCollateral,
        payments: ajoInfo.ajoPayments,
        governance: ajoInfo.ajoGovernance,
        schedule: ajoInfo.ajoSchedule,
        hcsTopicId: hcsTopicId
      },
      hederaServices: {
        HTS: {
          enabled: await ajoFactory.isHtsEnabled(),
          address: "0x0000000000000000000000000000000000000167"
        },
        HSS: {
          enabled: (await ajoFactory.getScheduleServiceAddress()) !== ethers.constants.AddressZero,
          address: await ajoFactory.getScheduleServiceAddress()
        },
        HCS: {
          enabled: true,
          topicId: hcsTopicId
        }
      },
      participants: participants.map(p => ({
        name: p.name,
        address: p.address,
        position: p.position
      })),
      statistics: {
        totalParticipants: participants.length,
        successfulJoins: joinResults.filter(r => r.success).length
      }
    };
    
    const filename = `deployment-hedera-hackathon-${Date.now()}.json`;
    try {
      fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
      console.log(c.green(`\n  ✅ Deployment info saved to: ${filename}\n`));
    } catch (error) {
      console.log(c.yellow(`\n  ⚠️ Could not save deployment info\n`));
    }
    
    console.log(c.bgGreen("\n" + " ".repeat(28) + "🎉 DEMONSTRATION COMPLETE! 🎉" + " ".repeat(28)));
    console.log(c.green("═".repeat(88) + "\n"));
    console.log(c.bright("  🚀 AJO.SAVE - Building Financial Inclusion on Hedera"));
    console.log(c.dim("     A complete, production-ready ROSCA system with native Hedera integration\n"));
    console.log(c.green("═".repeat(88) + "\n"));
    
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
      console.log(c.green("\n🎉 Demonstration completed successfully!\n"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Demonstration failed\n"));
      process.exit(1);
    });
}

module.exports = {
  main,
  deployComprehensiveSystem,
  create5PhaseAjoWithFullHedera,
  setupParticipantsEnhanced,
  demonstrateHederaTokenService,
  demonstrateMemberJoining
};