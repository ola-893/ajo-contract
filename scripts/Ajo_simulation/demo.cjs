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
  MONTHLY_PAYMENT_USDC: ethers.utils.parseUnits("5", 6), // $50 USDC
  MONTHLY_PAYMENT_HBAR: ethers.utils.parseUnits("10", 8), // 1000 HBAR
  CYCLE_DURATION: 30, // 30 seconds for testing (pass 0 to use default 30 days)
  TOTAL_PARTICIPANTS: 13,
  MIN_HBAR_FOR_HTS: ethers.utils.parseEther("50"),
  GAS_LIMIT: {
    DEPLOY_MASTER: 6000000,
    DEPLOY_GOVERNANCE: 6000000,
    DEPLOY_FACTORY: 15000000,
    CREATE_HTS: 5000000,
    CREATE_AJO: 1500000,
    INIT_PHASE_2: 1200000,
    INIT_PHASE_3: 1500000,
    INIT_PHASE_4: 1800000,
    INIT_PHASE_5: 1500000,
    JOIN_AJO: 1000000,
    HTS_ASSOCIATE: 300000,
    HTS_FUND: 800000,
    HTS_APPROVE: 400000,
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
// PHASE 7: SUMMARY & ANALYSIS
// ================================================================
async function generateDefaultTestSummary(defaultScenarios, participants) {
  console.log(c.bgGreen("\n" + " ".repeat(25) + "📊 DEFAULT TEST SUMMARY 📊" + " ".repeat(31)));
  console.log(c.green("═".repeat(88) + "\n"));
  
  console.log(c.bright("  Test Results Overview:\n"));
  console.log(c.dim("     ┌───────────────────────────────────────────┬──────────────┐"));
  console.log(c.dim("     │ Scenario                                  │ Result       │"));
  console.log(c.dim("     ├───────────────────────────────────────────┼──────────────┤"));
  
  for (const scenario of defaultScenarios) {
    const status = scenario.success ? c.green("✅ Success") : c.red("❌ Failed");
    console.log(c.dim(`     │ ${scenario.scenario.padEnd(41)} │ ${status.padEnd(20)} │`));
  }
  
  console.log(c.dim("     └───────────────────────────────────────────┴──────────────┘\n"));
  
  // Detailed analysis for Position 1 default (most critical)
  const position1Scenario = defaultScenarios.find(s => s.scenario.includes("Position 1"));
  
  if (position1Scenario && position1Scenario.success) {
    console.log(c.bright("  🎯 V3 Collateral Model Validation (Position 1 Default):\n"));
    console.log(c.dim("     ┌─────────────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Expected Seizable: ${formatUSDC(position1Scenario.expectedSeizable).padEnd(36)} │`));
    console.log(c.dim(`     │ Net Loss to Group: ${formatUSDC(position1Scenario.netLoss).padEnd(36)} │`));
    
    if (position1Scenario.netLoss.gt(0)) {
      console.log(c.dim(`     │ Safety Buffer: ${formatUSDC(position1Scenario.safetyBuffer).padEnd(40)} │`));
      console.log(c.dim(`     │ Coverage Ratio: ${position1Scenario.coverageRatio.toFixed(2)}%${' '.repeat(38)} │`));
      console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
      
      if (position1Scenario.coverageRatio >= 108) {
        console.log(c.green("  ✅ V3 Model VALIDATED: Coverage ratio ≥108.9%\n"));
        console.log(c.dim("     The 60% collateral factor with guarantor system provides"));
        console.log(c.dim("     sufficient protection against worst-case defaults.\n"));
      } else {
        console.log(c.yellow(`  ⚠️  Coverage ratio: ${position1Scenario.coverageRatio.toFixed(2)}% (expected ≥108.9%)\n`));
      }
    } else {
      console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
      console.log(c.yellow("  ⚠️  Coverage analysis incomplete (net loss = 0)\n"));
      console.log(c.dim(`     Contract totalPaid: ${formatUSDC(position1Scenario.totalPaidByContract)}\n`));
      console.log(c.dim("     This suggests the contract may be tracking payout receipts"));
      console.log(c.dim("     as 'totalPaid' rather than just contributions made.\n"));
    }
  }
  
  const successCount = defaultScenarios.filter(s => s.success).length;
  console.log(c.bright(`  📈 Overall Success Rate: ${successCount}/${defaultScenarios.length} scenarios (${(successCount/defaultScenarios.length*100).toFixed(1)}%)\n`));
  
  console.log(c.green("═".repeat(88) + "\n"));
  
  return {
    totalScenarios: defaultScenarios.length,
    successfulScenarios: successCount,
    failedScenarios: defaultScenarios.length - successCount,
    scenarios: defaultScenarios
  };
}

// ================================================================
// PHASE 5: RUN FIRST CYCLE NORMALLY
// ================================================================
async function runFirstCycleNormally(ajo, ajoPayments, participants) {
  console.log(c.bgBlue("\n" + " ".repeat(25) + "PHASE 5: FIRST CYCLE - NORMAL OPERATION" + " ".repeat(24)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  // ============ VERIFY CURRENT CYCLE ============
  const currentCycle = await ajoPayments.getCurrentCycle();
  console.log(c.bright(`  📅 Current Cycle: ${currentCycle.toString()}\n`));
  
  console.log(c.bright(`  📅 Cycle 1: All members pay, Position 1 receives payout\n`));
  
  // Get next recipient
  const nextRecipient = await ajoPayments.getNextRecipient();
  const recipientParticipant = participants.find(p => 
    p.address.toLowerCase() === nextRecipient.toLowerCase()
  );
  const recipientName = recipientParticipant ? recipientParticipant.name : "Unknown";
  
  console.log(c.cyan(`  💰 Next Recipient: ${recipientName} (${nextRecipient})\n`));
  
  console.log(c.cyan(`  💳 Step 1: Process Payments for Cycle 1\n`));
  console.log(c.dim("     ┌────┬─────────────┬──────────────┬──────────────┐"));
  console.log(c.dim("     │ #  │ Member      │ Amount       │ Status       │"));
  console.log(c.dim("     ├────┼─────────────┼──────────────┼──────────────┤"));
  
  const paymentResults = [];
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      await retryWithBackoff(async () => {
        const tx = await ajo.connect(participant.signer).processPayment({
          gasLimit: DEMO_CONFIG.GAS_LIMIT.PROCESS_PAYMENT
        });
        
        return await tx.wait();
      }, `${participant.name} - Payment`);
      
      paymentResults.push({
        member: participant.name,
        success: true
      });
      
      const status = c.green("✅ Paid");
      console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ${formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT_USDC).padEnd(12)} │ ${status.padEnd(20)} │`));
      
    } catch (error) {
      paymentResults.push({
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
  
  const successfulPayments = paymentResults.filter(p => p.success).length;
  console.log(c.green(`     ✅ ${successfulPayments}/${participants.length} payments processed\n`));
  
  await sleep(2000);
  
  // Distribute payout
  console.log(c.cyan(`  💰 Step 2: Distribute Payout to ${recipientName}\n`));
  
  try {
    const isReady = await ajoPayments.isPayoutReady();
    console.log(c.dim(`     Payout Ready: ${isReady ? c.green('✅ Yes') : c.red('❌ No')}`));
    
    if (!isReady) {
      throw new Error("Payout not ready");
    }
    
    const expectedPayout = await ajoPayments.calculatePayout();
    console.log(c.bright(`     Expected Payout: ${formatUSDC(expectedPayout)}\n`));
    
    const payoutReceipt = await retryWithBackoff(async () => {
      const payoutTx = await ajo.connect(participants[0].signer).distributePayout({
        gasLimit: DEMO_CONFIG.GAS_LIMIT.DISTRIBUTE_PAYOUT
      });
      return await payoutTx.wait();
    }, "Distribute Payout");
    
    console.log(c.green(`     ✅ Payout Distributed!`));
    console.log(c.dim(`        Recipient: ${recipientName}`));
    console.log(c.dim(`        Amount: ${formatUSDC(expectedPayout)}\n`));
    
  } catch (error) {
    console.log(c.red(`     ❌ Payout Failed: ${error.message.slice(0, 100)}\n`));
  }
  
  // ============ VERIFY POST-PAYOUT CYCLE ============
  const postPayoutCycle = await ajoPayments.getCurrentCycle();
  console.log(c.bright(`  📅 After Payout - Current Cycle: ${postPayoutCycle.toString()}\n`));
  
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { paymentResults, recipientName, recipientAddress: nextRecipient };
}

// ================================================================
// PHASE 6: ADVANCE TO CYCLE 2 & SIMULATE DEFAULTS
// ================================================================
async function advanceToCycle2AndSimulateDefaults(ajo, ajoPayments, participants) {
  console.log(c.bgYellow("\n" + " ".repeat(20) + "PHASE 6: ADVANCE TO CYCLE 2 & SIMULATE DEFAULTS" + " ".repeat(20)));
  console.log(c.yellow("═".repeat(88) + "\n"));
  
  // Check current cycle
  const currentCycle = await ajoPayments.getCurrentCycle();
  console.log(c.bright(`  📅 Current Cycle: ${currentCycle.toString()}\n`));
  
  console.log(c.cyan("  ⏰ Waiting for Cycle 2 to begin...\n"));
  console.log(c.dim(`     Cycle Duration: ${DEMO_CONFIG.CYCLE_DURATION} seconds\n`));
  
  // Wait for cycle duration
  await sleepWithProgress(DEMO_CONFIG.CYCLE_DURATION, "Advancing to Cycle 2");
  console.log();
  
  // Verify cycle advanced
  const newCycle = await ajoPayments.getCurrentCycle();
  console.log(c.bright(`  📅 New Cycle: ${newCycle.toString()}\n`));
  
  // if (newCycle.toString() === currentCycle.toString()) {
  //   console.log(c.yellow("  ⚠️  Cycle hasn't auto-advanced. Manually triggering...\n"));
    
  //   // Manually trigger cycle advance by attempting payout distribution
  //   try {
  //     // This will advance the cycle if time has passed
  //     const advanceTx = await ajo.connect(participants[0].signer).distributePayout({
  //       gasLimit: DEMO_CONFIG.GAS_LIMIT.DISTRIBUTE_PAYOUT
  //     });
  //     await advanceTx.wait();
      
  //     const finalCycle = await ajoPayments.getCurrentCycle();
  //     console.log(c.green(`  ✅ Cycle Advanced to: ${finalCycle.toString()}\n`));
  //   } catch (error) {
  //     console.log(c.red(`  ❌ Failed to advance cycle: ${error.message}\n`));
  //   }
  // }
  
  console.log(c.bgRed("\n" + " ".repeat(15) + "🚨 CYCLE 2: SIMULATING DEFAULTS (MEMBERS DON'T PAY) 🚨" + " ".repeat(15)));
  console.log(c.red("═".repeat(88) + "\n"));
  
  console.log(c.yellow("  📋 Default Simulation Strategy:\n"));
  console.log(c.dim("     • Members in Cycle 2 will NOT make payments"));
  console.log(c.dim("     • This creates REAL defaults (missed payments)"));
  console.log(c.dim("     • After cycle duration passes, we'll handle defaults"));
  console.log(c.dim("     • This tests the actual default scenario\n"));
  
  // Show which members would be in default
  console.log(c.red("  🚨 Members who will default (not paying in Cycle 2):\n"));
  console.log(c.dim("     ┌────┬─────────────┬──────────────┬─────────────────┐"));
  console.log(c.dim("     │ #  │ Name        │ Position     │ Collateral      │"));
  console.log(c.dim("     ├────┼─────────────┼──────────────┼─────────────────┤"));
  
  // Select members to default (Position 1, 5, 9)
  const defaulters = [
    participants.find(p => p.position === 1),  // Worst case
    participants.find(p => p.position === 5),  // Mid position
    participants.find(p => p.position === 9)   // Late position
  ];
  
  for (let i = 0; i < defaulters.length; i++) {
    const member = defaulters[i];
    const memberInfo = await ajo.getMemberInfo(member.address);
    const collateral = memberInfo.memberInfo.lockedCollateral;
    
    console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${member.position.toString().padEnd(12)} │ ${formatUSDC(collateral).padEnd(15)} │`));
  }
  
  console.log(c.dim("     └────┴─────────────┴──────────────┴─────────────────┘\n"));
  
  console.log(c.yellow("  ℹ️  Other members WILL pay to keep the Ajo running\n"));
  
  // Other members pay
  console.log(c.cyan("  💳 Processing Payments for Non-Defaulters:\n"));
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    // Skip defaulters
    if (defaulters.find(d => d.address === participant.address)) {
      console.log(c.red(`     ⏭️  Skipping ${participant.name} (will default)`));
      continue;
    }
    
    try {
      await retryWithBackoff(async () => {
        const tx = await ajo.connect(participant.signer).processPayment({
          gasLimit: DEMO_CONFIG.GAS_LIMIT.PROCESS_PAYMENT
        });
        return await tx.wait();
      }, `${participant.name} - Payment`);
      
      console.log(c.green(`     ✅ ${participant.name} paid`));
      
    } catch (error) {
      console.log(c.red(`     ❌ ${participant.name} payment failed: ${error.message.slice(0, 100)}`));
    }
    
    await sleep(1000);
  }
  
  console.log();
  console.log(c.yellow("═".repeat(88) + "\n"));
  
  return defaulters;
}

// ================================================================
// PHASE 7: HANDLE DEFAULTS AFTER CYCLE 2
// ================================================================
async function testDefaultScenarios(ajo, ajoPayments, ajoCollateral, ajoMembers, participants, defaulters, ajoInfo) {
  console.log(c.bgRed("\n" + " ".repeat(20) + "PHASE 7: DEFAULT HANDLING & COLLATERAL SEIZURE" + " ".repeat(21)));
  console.log(c.red("═".repeat(88) + "\n"));
  
  // Verify current cycle
  const currentCycle = await ajoPayments.getCurrentCycle();
  console.log(c.bright(`  📅 Current Cycle: ${currentCycle.toString()}\n`));
  
  console.log(c.yellow("  ⏰ Waiting for grace period to expire...\n"));
  console.log(c.dim("     After this, members who didn't pay are officially in default\n"));
  
  // Wait another cycle duration to ensure defaults are recognized
  await sleepWithProgress(DEMO_CONFIG.CYCLE_DURATION, "Grace Period");
  console.log();
  
  const defaultScenarios = [];
  
  // ================================================================
  // TEST EACH DEFAULTER
  // ================================================================
  for (let i = 0; i < defaulters.length; i++) {
    const defaulter = defaulters[i];
    
    console.log(c.bgYellow(`\n${"═".repeat(25)} SCENARIO ${i+1}: ${defaulter.name.toUpperCase()} DEFAULTS ${"═".repeat(25)}`));
    console.log(c.yellow("═".repeat(88) + "\n"));
    
    console.log(c.red(`  🚨 Processing default for ${defaulter.name} (Position ${defaulter.position})\n`));
    
    // Get pre-default state
    console.log(c.cyan("  📊 Step 1: Analyze Pre-Default State\n"));
    
    const memberInfo = await ajo.getMemberInfo(defaulter.address);
    const lockedCollateral = memberInfo.memberInfo.lockedCollateral;
    const lastPaymentCycle = memberInfo.memberInfo.lastPaymentCycle;
    const totalPaid = memberInfo.memberInfo.totalPaid;
    const guarantorAddress = memberInfo.memberInfo.guarantor;
    
    console.log(c.dim("     ┌─────────────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Defaulter: ${defaulter.name.padEnd(44)} │`));
    console.log(c.dim(`     │ Position: ${defaulter.position.toString().padEnd(46)} │`));
    console.log(c.dim(`     │ Last Payment Cycle: ${lastPaymentCycle.toString().padEnd(34)} │`));
    console.log(c.dim(`     │ Current Cycle: ${currentCycle.toString().padEnd(39)} │`));
    console.log(c.dim(`     │ Cycles Missed: ${currentCycle.sub(lastPaymentCycle).toString().padEnd(39)} │`));
    console.log(c.dim(`     │ Locked Collateral: ${formatUSDC(lockedCollateral).padEnd(36)} │`));
    console.log(c.dim(`     │ Total Paid: ${formatUSDC(totalPaid).padEnd(42)} │`));
    console.log(c.dim(`     │ Guarantor: ${guarantorAddress.slice(0, 42).padEnd(44)} │`));
    console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
    
    let guarantorCollateral = ethers.BigNumber.from(0);
    if (guarantorAddress !== "0x0000000000000000000000000000000000000000") {
      const guarantorInfo = await ajo.getMemberInfo(guarantorAddress);
      guarantorCollateral = guarantorInfo.memberInfo.lockedCollateral;
      console.log(c.dim(`     Guarantor Collateral: ${formatUSDC(guarantorCollateral)}\n`));
    }
    
    const expectedSeizable = lockedCollateral.add(guarantorCollateral);
    console.log(c.bright(`  💰 Expected Seizable Collateral: ${formatUSDC(expectedSeizable)}\n`));
    
    await sleep(2000);
    
    // Execute default handling
    console.log(c.cyan("  🔒 Step 2: Execute Default Handling & Collateral Seizure\n"));
    
    try {
      const handleDefaultTx = await retryWithBackoff(async () => {
        const tx = await ajo.connect(participants[1].signer).handleDefault(
          defaulter.address,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.HANDLE_DEFAULT }
        );
        return await tx.wait();
      }, "Handle Default");
      
      console.log(c.green(`     ✅ Default handling executed successfully`));
      console.log(c.dim(`        Transaction Hash: ${handleDefaultTx.transactionHash}`));
      console.log(c.dim(`        Gas Used: ${handleDefaultTx.gasUsed.toString()}\n`));
      
      // Verify post-default state
      console.log(c.cyan("  📊 Step 3: Verify Post-Default State\n"));
      
      try {
        const postDefaultInfo = await ajo.getMemberInfo(defaulter.address);
        const postDefaultCollateral = postDefaultInfo.memberInfo.lockedCollateral;
        const isActive = postDefaultInfo.memberInfo.isActive;
        
        console.log(c.dim("     ┌─────────────────────────────────────────────────────────┐"));
        console.log(c.dim(`     │ Remaining Collateral: ${formatUSDC(postDefaultCollateral).padEnd(34)} │`));
        console.log(c.dim(`     │ Member Status: ${(isActive ? 'Active' : 'Removed').padEnd(41)} │`));
        console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
        
        const actualSeized = lockedCollateral.sub(postDefaultCollateral);
        console.log(c.green(`     ✅ Collateral Seized: ${formatUSDC(actualSeized)}\n`));
      } catch (error) {
        console.log(c.yellow(`     ℹ️  Member removed from contract (expected after seizure)\n`));
      }
      
      defaultScenarios.push({
        scenario: `Position ${defaulter.position} Default`,
        defaulter: defaulter.name,
        defaulterAddress: defaulter.address,
        preDefaultCollateral: lockedCollateral,
        guarantorCollateral,
        expectedSeizable,
        success: true,
        transactionHash: handleDefaultTx.transactionHash
      });
      
    } catch (error) {
      console.log(c.red(`     ❌ Default handling failed: ${error.message}\n`));
      
      defaultScenarios.push({
        scenario: `Position ${defaulter.position} Default`,
        defaulter: defaulter.name,
        error: error.message,
        success: false
      });
    }
    
    await sleep(3000);
  }
  
  console.log(c.red("═".repeat(88) + "\n"));
  
  return defaultScenarios;
}

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

// ================================================================
// PHASE 1: HTS-ONLY DEPLOYMENT
// ================================================================

async function deployHtsSystem() {
  console.log(c.bgBlue("\n" + " ".repeat(30) + "PHASE 1: HTS SYSTEM DEPLOYMENT" + " ".repeat(28)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  const [deployer] = await ethers.getSigners();
  console.log(c.bright(`  👤 Deployer: ${deployer.address}`));
  const balance = await deployer.getBalance();
  console.log(c.dim(`     Balance: ${ethers.utils.formatEther(balance)} HBAR\n`));
  
  if (balance.lt(DEMO_CONFIG.MIN_HBAR_FOR_HTS)) {
    throw new Error(
      `Insufficient HBAR! Need ${ethers.utils.formatEther(DEMO_CONFIG.MIN_HBAR_FOR_HTS)} HBAR, ` +
      `have ${ethers.utils.formatEther(balance)} HBAR`
    );
  }
  
  console.log(c.green(`  ✅ Sufficient HBAR for HTS token creation\n`));
  
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
  
  console.log(c.cyan("  📝 Step 1.2: Deploying AjoFactory...\n"));
  
  const HEDERA_TOKEN_SERVICE = "0x0000000000000000000000000000000000000167";
  const HEDERA_SCHEDULE_SERVICE = "0x000000000000000000000000000000000000016b";
  const DUMMY_TOKEN = "0x0000000000000000000000000000000000000001";
  
  console.log(c.dim(`      🔗 HTS Address: ${HEDERA_TOKEN_SERVICE}`));
  console.log(c.dim(`      🔗 HSS Address: ${HEDERA_SCHEDULE_SERVICE}\n`));
  
  let ajoFactory;
  await retryOperation(async () => {
    const AjoFactory = await ethers.getContractFactory("AjoFactory");
    ajoFactory = await AjoFactory.deploy(
      DUMMY_TOKEN,
      DUMMY_TOKEN,
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
  
  console.log(c.cyan("  📝 Step 1.3: Creating HTS Tokens with Auto-Association...\n"));
  console.log(c.yellow("     ⚠️  This will cost 40 HBAR (20 HBAR per token)\n"));
  
  let usdcHtsToken, hbarHtsToken;
  
  await retryOperation(async () => {
    const tx = await ajoFactory.createHtsTokens({ 
      value: ethers.utils.parseEther("40"),
      gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_HTS
    });
    const receipt = await tx.wait();
    
    console.log(c.dim(`     Transaction hash: ${receipt.transactionHash}`));
    console.log(c.dim(`     Gas used: ${receipt.gasUsed.toString()}\n`));
    
    const autoAssocEvent = receipt.events?.find(e => e.event === 'HtsTokensCreatedWithAutoAssociation');
    
    if (autoAssocEvent) {
      usdcHtsToken = autoAssocEvent.args[0];
      hbarHtsToken = autoAssocEvent.args[1];
      
      console.log(c.green(`     ✅ HTS Tokens Created with Auto-Association!`));
      console.log(c.bright(`     📍 USDC Token: ${usdcHtsToken}`));
      console.log(c.bright(`     📍 WHBAR Token: ${hbarHtsToken}\n`));
    } else {
      throw new Error("HtsTokensCreatedWithAutoAssociation event not found");
    }
    
    return { usdcHtsToken, hbarHtsToken };
  }, "Create HTS Tokens");
  
  await sleep(2000);
  
  console.log(c.cyan("  📝 Step 1.4: Verifying Factory Token Balances...\n"));
  
  const usdcContract = new ethers.Contract(
    usdcHtsToken,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider
  );
  
  const hbarContract = new ethers.Contract(
    hbarHtsToken,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider
  );
  
  const factoryUsdcBalance = await usdcContract.balanceOf(ajoFactory.address);
  const factoryHbarBalance = await hbarContract.balanceOf(ajoFactory.address);
  
  console.log(c.green(`     ✅ Factory USDC Balance: ${formatUSDC(factoryUsdcBalance)}`));
  console.log(c.green(`     ✅ Factory WHBAR Balance: ${formatHBAR(factoryHbarBalance)}\n`));
  
  if (factoryUsdcBalance.eq(0) || factoryHbarBalance.eq(0)) {
    throw new Error("Factory has zero token balance! HTS token creation failed.");
  }
  
  console.log(c.green("  ✅ HTS System Deployment Complete!\n"));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { 
    ajoFactory, 
    deployer, 
    masterContracts, 
    usdcHtsToken, 
    hbarHtsToken 
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
    cycleDuration = DEMO_CONFIG.CYCLE_DURATION, // 30 seconds for testing
    monthlyPaymentUSDC = DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
    monthlyPaymentHBAR = DEMO_CONFIG.MONTHLY_PAYMENT_HBAR
  } = options;
  
  console.log(c.bright("\n  📋 Configuration:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ Name: ${name.padEnd(51)} │`));
  console.log(c.dim(`     │ Cycle Duration: ${cycleDuration.toString().padEnd(42)} seconds │`));
  console.log(c.dim(`     │ Monthly USDC: ${formatUSDC(monthlyPaymentUSDC).padEnd(44)} │`));
  console.log(c.dim(`     │ Monthly HBAR: ${formatHBAR(monthlyPaymentHBAR).padEnd(44)} │`));
  console.log(c.dim(`     │ HTS Tokens: ${c.green('✅ Required (No ERC20 Fallback)').padEnd(60)} │`));
  console.log(c.dim(`     │ Auto-Association: ${c.green('✅ Active').padEnd(56)} │`));
  console.log(c.dim(`     │ HSS Scheduling: ${(useScheduledPayments ? c.green('✅ Enabled') : c.yellow('❌ Manual')).padEnd(56)} │`));
  console.log(c.dim(`     │ HCS Governance: ${c.green('✅ Always Enabled').padEnd(56)} │`));
  console.log(c.dim("     └──────────────────────────────────────────────────────────┘\n"));
  
  let ajoId, hcsTopicInfo;
  
  console.log(c.cyan("  📋 PHASE 1/5: Creating Ajo Core..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).createAjo(
      name, 
      true, // useHtsTokens
      useScheduledPayments,
      cycleDuration, // NEW: cycle duration in seconds
      monthlyPaymentUSDC, // NEW: USDC payment amount
      monthlyPaymentHBAR, // NEW: HBAR payment amount
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO }
    );
    const receipt = await tx.wait();
    
    const event = receipt.events?.find(e => e.event === 'AjoCreated');
    ajoId = event?.args?.ajoId?.toNumber();
    
    console.log(c.green(`     ✅ Ajo Core Created`));
    console.log(c.dim(`        ID: ${ajoId}`));
    console.log(c.dim(`        Cycle Duration: ${cycleDuration}s`));
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");
  
  await sleep(2000);
  
  // Create real HCS topic BEFORE Phase 2
  console.log(c.bgYellow("\n" + " ".repeat(20) + "🌐 FRONTEND SIMULATION: CREATE HCS TOPIC" + " ".repeat(26)));
  hcsTopicInfo = await createRealHcsTopic(hederaClient, name);
  
  await sleep(2000);
  
  console.log(c.cyan("  📋 PHASE 2/5: Initialize Members + Governance + HCS..."));
  console.log(c.yellow(`     → Passing HCS Topic ID: ${hcsTopicInfo.topicId}\n`));
  
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase2(
      ajoId,
      hcsTopicInfo.bytes32TopicId,
      {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2
      }
    );
    const receipt = await tx.wait();
    
    const hcsEvent = receipt.events?.find(e => e.event === 'AjoInitializedPhase2');
    const returnedTopicId = hcsEvent?.args?.hcsTopicId;
    
    console.log(c.green(`     ✅ Phase 2 Complete`));
    console.log(c.dim(`        HCS Topic (stored): ${returnedTopicId}`));
    console.log(c.dim(`        HCS Topic (Hedera): ${hcsTopicInfo.topicId}\n`));
    
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
  
  console.log(c.cyan("  📋 PHASE 4/5: Initialize Core + Cross-link + Token Config..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 4 Complete`));
    console.log(c.dim(`        Cycle duration set to: ${cycleDuration}s\n`));
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
  
  // Verify cycle duration was set correctly
  const ajoCoreContract = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const actualCycleDuration = await ajoCoreContract.getCycleDuration();
  
  console.log(c.blue("═".repeat(88)));
  console.log(c.green(`\n  ✅ HTS Ajo "${name}" Successfully Created!\n`));
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
  
  console.log(c.dim("\n  ⚙️  Configuration:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ Cycle Duration: ${actualCycleDuration.toString().padEnd(48)} seconds │`));
  console.log(c.dim(`     │ Monthly USDC:   ${formatUSDC(monthlyPaymentUSDC).padEnd(48)} │`));
  console.log(c.dim(`     │ Monthly HBAR:   ${formatHBAR(monthlyPaymentHBAR).padEnd(48)} │`));
  console.log(c.dim("     └──────────────────────────────────────────────────────────────────┘"));
  
  console.log(c.dim("\n  🌐 HCS Integration:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ Topic ID (Hedera): ${hcsTopicInfo.topicId.padEnd(41)} │`));
  console.log(c.dim(`     │ Topic ID (bytes32): ${hcsTopicInfo.bytes32TopicId.slice(0, 40).padEnd(40)} │`));
  console.log(c.dim(`     │ Simulated:         ${(hcsTopicInfo.simulated ? 'Yes' : 'No').padEnd(41)} │`));
  console.log(c.dim("     └──────────────────────────────────────────────────────────────────┘\n"));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { 
    ajoId, 
    ajoInfo, 
    hcsTopicId: hcsTopicInfo.topicId,
    hcsTopicIdBytes32: hcsTopicInfo.bytes32TopicId,
    hcsTopicSimulated: hcsTopicInfo.simulated,
    cycleDuration: actualCycleDuration.toNumber()
  };
}

// ================================================================
// SETUP PARTICIPANTS WITH HTS TOKENS (WITH PERSISTENT RETRY)
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
  let signerIndex = 0; // Start from first signer
  
  console.log(c.bright(`  🎯 Target: ${REQUIRED_PARTICIPANTS} participants\n`));
  console.log(c.yellow("     ℹ️  Auto-association ENABLED - tokens transfer automatically\n"));
  
  // Check factory balance
  const usdcContract = new ethers.Contract(
    ajoInfo.usdcToken,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider
  );
  
  const factoryBalance = await usdcContract.balanceOf(ajoFactory.address);
  console.log(c.bright(`     💰 Factory USDC Balance: ${formatUSDC(factoryBalance)}\n`));
  
  if (factoryBalance.eq(0)) {
    throw new Error("Factory has no tokens to distribute!");
  }
  
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
        // Fund user with HTS tokens via factory (handles auto-association)
        console.log(c.dim(`     → ${participantName} (Attempt ${attempts}/${MAX_ATTEMPTS_PER_SIGNER}): Funding with tokens...`));
        
        const usdcAmount = ethers.utils.parseUnits("1000", 6);  // 1000 USDC
        const hbarAmount = ethers.utils.parseUnits("1000", 8);  // 1000 WHBAR
        
        await retryWithBackoff(async () => {
          const tx = await ajoFactory.connect(deployer).fundUserWithHtsTokens(
            signer.address,
            usdcAmount,
            hbarAmount,
            { gasLimit: 1500000 }
          );
          
          const receipt = await tx.wait();
          
          const fundEvent = receipt.events?.find(e => e.event === 'UserHtsFunded');
          if (!fundEvent) {
            throw new Error("Funding event not found");
          }
          
          const usdcResponse = fundEvent.args.usdcResponse.toNumber();
          const hbarResponse = fundEvent.args.hbarResponse.toNumber();
          
          if (usdcResponse !== 22 && hbarResponse !== 22) {
            throw new Error(`Both token transfers failed (USDC: ${usdcResponse}, HBAR: ${hbarResponse})`);
          }
          
          console.log(c.dim(`        ✓ Funded: ${formatUSDC(usdcAmount)} USDC, ${formatHBAR(hbarAmount)} WHBAR`));
          return tx;
        }, 3, 3);
        
        await sleep(500);
        
        // Verify balance
        const balance = await usdcContract.balanceOf(signer.address);
        if (balance.eq(0)) {
          throw new Error("Zero balance after funding");
        }
        
        console.log(c.dim(`     → ${participantName}: Balance verified: ${formatUSDC(balance)} USDC`));
        
        // Approve collateral contract
        const approvalAmount = balance.div(2);
        console.log(c.dim(`     → ${participantName}: Approving ${formatUSDC(approvalAmount)} for contracts...`));
        
        const htsToken = new ethers.Contract(
          ajoInfo.usdcToken,
          ["function approve(address spender, uint256 amount) external returns (bool)"],
          signer
        );
        
        await retryWithBackoff(async () => {
          const tx = await htsToken.approve(
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
          const tx = await htsToken.approve(
            ajoPayments.address,
            approvalAmount,
            { gasLimit: 800000 }
          );
          await tx.wait();
          console.log(c.dim(`        ✓ Payments approved`));
          return tx;
        }, 3, 3);
        
        const status = c.green("✅ Ready");
        console.log(c.dim(`  │ ${(nameIndex+1).toString().padStart(2)} │ ${participantName.padEnd(11)} │ ${signer.address.slice(0,10)}... │ ${formatUSDC(balance).padEnd(11)} │ ${status.padEnd(19)} │`));
        
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

async function demonstrateFullCycles(ajo, ajoMembers, ajoPayments, ajoCollateral, ajoFactory, ajoId,  participants, cycleDuration) {
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

    // DEBUG: Test batch payment status
console.log(c.yellow("\n🔍 DEBUG: Testing Batch Payment Status...\n"));

try {
    const activeMembers = await ajoMembers.getActiveMembersList();
    console.log(c.dim(`   Active members count: ${activeMembers.length}`));
    console.log(c.dim(`   Sample addresses: ${activeMembers.slice(0, 3).map(a => a.slice(0, 10)).join(', ')}...\n`));
    
    // Test the batch call directly
    const debugResult = await ajoPayments.batchCheckPaymentStatus(activeMembers);
    console.log(c.green(`   ✅ Batch call succeeded!`));
    console.log(c.dim(`   Current Cycle: ${debugResult.currentCycleValue}`));
    console.log(c.dim(`   Members Checked: ${debugResult.memberCount}`));
    console.log(c.dim(`   Statuses: ${debugResult.statuses.map(s => s ? '✓' : '✗').join(', ')}\n`));
    
} catch (error) {
    console.log(c.red(`   ❌ Batch call FAILED!`));
    console.log(c.red(`   Error: ${error.message}\n`));
}




     const postStateInspection = await inspectAjoState(
      ajo,
      ajoMembers, 
      ajoPayments, 
      ajoCollateral, 
      ajoFactory, 
      ajoId
    );

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

    const preStateInspection = await inspectAjoState(
      ajo,
      ajoMembers, 
      ajoPayments, 
      ajoCollateral, 
      ajoFactory, 
      ajoId
    );
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
        name: "Hedera Hackathon 2025 - 10 Cycle Demo",
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
    
    const joinResults = await demonstrateMemberJoining(
      ajo, 
      ajoCollateral, 
      ajoMembers, 
      participants,
      ajoInfo
    );
    
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
        
        // Phase 5: Run first cycle normally (all pay, position 1 gets payout)
        const firstCycleResults = await runFirstCycleNormally(
          ajo,
          ajoPayments,
          participants
        );
        
        await sleep(3000);
        
        // Phase 6: Advance to Cycle 2 and simulate defaults (members DON'T pay)
        const defaulters = await advanceToCycle2AndSimulateDefaults(
          ajo,
          ajoPayments,
          participants
        );
        
        await sleep(3000);
        
        // Phase 7: Handle the defaults and seize collateral
        const defaultScenarios = await testDefaultScenarios(
          ajo,
          ajoPayments,
          ajoCollateral,
          ajoMembers,
          participants,
          defaulters,
          ajoInfo
        );
        
        await sleep(2000);
        
        // Phase 8: Generate summary
        const summary = await generateDefaultTestSummary(defaultScenarios, participants);
        
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
    // console.log(c.dim(`     • Cycles Completed: ${cycleResults.length}`));
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