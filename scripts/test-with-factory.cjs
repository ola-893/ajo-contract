#!/usr/bin/env node
const { ethers } = require("hardhat");
const console = require("console"); // Ensure console is available for debugging

// Color utilities
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`
};

// ================================================================
// 🔧 CONFIGURATION - UPDATE THESE AFTER DEPLOYMENT
// ================================================================

const FACTORY_ADDRESS = "0xBcc7701E5cbB4B09B345d3E8165A0AA07e3661aC"; // Updated
const TOKEN_ADDRESSES = {
  USDC: "0x2438BFf545829353Fc5fdD50fCf74b9f3bd09B9f", // Updated
  WHBAR: "0x6fb2087d2B8600a84742712239cb96730733807d" // Updated
};

// ================================================================

const DEMO_CONFIG = {
  MONTHLY_PAYMENT: ethers.utils.parseUnits("50", 6),
  TOTAL_PARTICIPANTS: 5,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  GAS_LIMIT: {
    CREATE_AJO: 1500000,
    INIT_PHASE_2: 1200000,
    INIT_PHASE_3: 1500000,
    INIT_PHASE_4: 1800000,
    FINALIZE: 2500000,
  }
};

const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    // Get initialization status
    const status = await ajoFactory.getAjoInitializationStatus(ajoId);
    
    if (status.phase < expectedPhase) {
      throw new Error(`Phase ${expectedPhase} not reached. Current: ${status.phase}`);
    }
    
    // Get health report
    const healthReport = await ajoFactory.getAjoHealthReport(ajoId);
    
    // Check critical components
    if (!healthReport.ajoCore.isDeployed) {
      throw new Error("AjoCore not deployed");
    }
    
    if (expectedPhase >= 4 && !healthReport.isReady) {
      throw new Error("Ajo not ready for use");
    }
    
    console.log(c.green(`    ✅ Health Check: Phase ${status.phase}, Ready: ${status.isReady}`));
    
    // Show operational status if ready
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
  
  const factoryStats = await ajoFactory.getFactoryStats();
  console.log(c.green(`  ✅ Factory connected! Total: ${factoryStats.totalCreated}, Active: ${factoryStats.activeCount}`));
  
  let ajoId, ajoInfo;
  
  // Try to use existing Ajo or create new one
  if (factoryStats.totalCreated.gt(0)) {
    console.log(c.dim("\n  🔄 Checking existing Ajos..."));
    
    // Check first few Ajos for a healthy one
    for (let id = 2; id <= Math.min(3, factoryStats.totalCreated.toNumber()); id++) {
      try {
        const status = await ajoFactory.getAjoInitializationStatus(id);
        
        if (status.isReady) {
          console.log(c.green(`  ✅ Found healthy Ajo ID: ${id}`));
          ajoId = id;
          ajoInfo = await ajoFactory.getAjo(ajoId);
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
    console.log(c.dim("\n  🎯 Creating new healthy Ajo..."));
    
    // Phase 1: Create
    const ajoName = `Health Test ${Date.now()}`;
    const creationTx = await ajoFactory.connect(deployer).createAjo(ajoName, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO
    });
    const receipt = await creationTx.wait();
    
    const createEvent = receipt.events?.find(event => event.event === 'AjoCreated');
    ajoId = createEvent.args.ajoId.toNumber();
    console.log(c.green(`    ✅ Phase 1: Ajo ${ajoId} created`));
    
    // if (!await validateAjoHealth(ajoFactory, ajoId, 1, "Phase 1")) {
    //   throw new Error("Phase 1 health check failed");
    // }
    
    // Phase 2: Basic initialization
    const phase2Tx = await ajoFactory.connect(deployer).initializeAjoPhase2(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2
    });
    await phase2Tx.wait();
    console.log(c.green(`    ✅ Phase 2: Basic contracts initialized`));
    
    // if (!await validateAjoHealth(ajoFactory, ajoId, 2, "Phase 2")) {
    //   throw new Error("Phase 2 health check failed");
    // }
    
    // Phase 3: Advanced initialization
    const phase3Tx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3
    });
    await phase3Tx.wait();
    console.log(c.green(`    ✅ Phase 3: Collateral & payments initialized`));
    
    // if (!await validateAjoHealth(ajoFactory, ajoId, 3, "Phase 3")) {
    //   throw new Error("Phase 3 health check failed");
    // }
    
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
      const finalizeTx = await ajoFactory.connect(deployer).finalizeAjoSetup(ajoId, {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.FINALIZE
      });
      await finalizeTx.wait();
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
  
  // Connect to contracts
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
  const usdc = await ethers.getContractAt("MockERC20", TOKEN_ADDRESSES.USDC);
  const whbar = await ethers.getContractAt("MockERC20", TOKEN_ADDRESSES.WHBAR);
  
  // Final functionality test
  console.log(c.dim(`\n  🔧 Testing core functionality...`));
  try {
    const tokenConfig = await ajo.getTokenConfig(0);
    const stats = await ajo.getContractStats();
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

async function setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, signers) {
  console.log(c.blue("\n👥 Setting up participants..."));
  
  const participants = [];
  const participantNames = ["Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka"];
  
  const actualCount = Math.min(DEMO_CONFIG.TOTAL_PARTICIPANTS, signers.length - 1);
  
  for (let i = 0; i < actualCount; i++) {
    const participant = {
      signer: signers[i + 1],
      name: participantNames[i],
      address: signers[i + 1].address,
      position: i + 1
    };
    
    try {
      console.log(c.dim(`  👤 Setting up ${participant.name}...`));
      
      // Get tokens from faucet
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).faucet({ gasLimit: 200000 });
        await tx.wait();
        return tx;
      }, `${participant.name} getting USDC`);
      
      const balance = await usdc.balanceOf(participant.address);
      if (balance.eq(0)) {
        throw new Error("Faucet failed");
      }
      
      // Approve contracts
      const allowanceAmount = balance.div(2);
      
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).approve(ajoCollateral.address, allowanceAmount, { gasLimit: 150000 });
        await tx.wait();
        return tx;
      }, `${participant.name} approving CollateralContract`);
      
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).approve(ajoPayments.address, allowanceAmount, { gasLimit: 150000 });
        await tx.wait();
        return tx;
      }, `${participant.name} approving PaymentsContract`);
      
      console.log(c.green(`    ✅ ${participant.name} ready: ${formatUSDC(balance)} USDC`));
      participants.push(participant);
      
    } catch (error) {
      console.log(c.yellow(`  ⚠️ ${participant.name} setup failed: ${error.message}`));
    }
    
    await sleep(1000);
  }
  
  console.log(c.green(`  ✅ ${participants.length}/${actualCount} participants ready`));
  return participants;
}

async function demonstrateJoining(ajo, ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🎯 LIVE: Participants Joining Ajo with Enhanced Debugging..."));
  
  const joinResults = [];
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`  ${i + 1}/${participants.length}: ${participant.name} joining...`));
      
      // Pre-join diagnostics
      console.log(c.dim(`    🔍 Pre-join diagnostics for ${participant.name}:`));
      
      // Check balance and approvals
      const usdc = await ethers.getContractAt("MockERC20", TOKEN_ADDRESSES.USDC);
      const balance = await usdc.balanceOf(participant.address);
      const collateralApproval = await usdc.allowance(participant.address, (await ajo.collateralContract()));
      const paymentsApproval = await usdc.allowance(participant.address, (await ajo.paymentsContract()));
      
      console.log(c.dim(`       Balance: ${ethers.utils.formatUnits(balance, 6)} USDC`));
      console.log(c.dim(`       Collateral approval: ${ethers.utils.formatUnits(collateralApproval, 6)} USDC`));
      console.log(c.dim(`       Payments approval: ${ethers.utils.formatUnits(paymentsApproval, 6)} USDC`));
      
      // Check expected collateral
      let expectedCollateral;
      try {
        expectedCollateral = await ajo.getRequiredCollateralForJoin(0);
        console.log(c.dim(`       Expected collateral: ${ethers.utils.formatUnits(expectedCollateral, 6)} USDC`));
      } catch (error) {
        console.log(c.dim(`       Could not get expected collateral: ${error.message}`));
        const demo = await ajo.getCollateralDemo(10, ethers.utils.parseUnits("50", 6));
        expectedCollateral = demo[1][i];
        console.log(c.dim(`       Expected collateral (fallback): ${ethers.utils.formatUnits(expectedCollateral, 6)} USDC`));
      }
      
      // Check if balance and approvals are sufficient
      if (balance.lt(expectedCollateral)) {
        console.log(c.red(`       ❌ Insufficient balance: need ${ethers.utils.formatUnits(expectedCollateral, 6)}, have ${ethers.utils.formatUnits(balance, 6)}`));
      }
      if (collateralApproval.lt(expectedCollateral)) {
        console.log(c.red(`       ❌ Insufficient collateral approval: need ${ethers.utils.formatUnits(expectedCollateral, 6)}, approved ${ethers.utils.formatUnits(collateralApproval, 6)}`));
      }
      
      console.log(c.dim(`    🚀 Executing joinAjo transaction...`));
      
      // Execute join with enhanced error handling
      const joinTx = await ajo.connect(participant.signer).joinAjo(0, { 
        gasLimit: 800000 // Increased gas limit for debugging
      });
      
      console.log(c.dim(`       Transaction hash: ${joinTx.hash}`));
      console.log(c.dim(`       Waiting for confirmation...`));
      
      const receipt = await joinTx.wait();
      
      if (receipt.status === 0) {
        console.log(c.red(`       ❌ Transaction reverted but no explicit error`));
        throw new Error("Transaction reverted without specific error");
      }
      
      // Verify the join was successful
      const memberInfo = await ajo.getMemberInfo(participant.address);
      const actualCollateral = memberInfo.memberInfo.lockedCollateral;
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        expectedCollateral,
        actualCollateral,
        gasUsed: receipt.gasUsed,
        success: true
      });
      
      console.log(c.green(`    ✅ SUCCESS! Locked: ${ethers.utils.formatUnits(actualCollateral, 6)} USDC | Gas: ${receipt.gasUsed.toString()}`));
      
      // Quick health check after join
      await validateAjoHealth(ajoFactory, ajoId, 4, `After ${participant.name} joined`);
      
    } catch (error) {
      console.log(c.red(`    ❌ ${participant.name} failed with detailed error analysis:`));
      
      // Enhanced error analysis
      if (error.transaction && error.receipt) {
        console.log(c.red(`       Transaction hash: ${error.transaction.hash}`));
        console.log(c.red(`       Gas used: ${error.receipt.gasUsed.toString()} / ${error.transaction.gasLimit.toString()}`));
        console.log(c.red(`       Status: ${error.receipt.status}`));
        
        if (error.receipt.status === 0) {
          console.log(c.red(`       Transaction reverted on-chain`));
        }
      }
      
      // Try to decode the revert reason
      if (error.reason) {
        console.log(c.red(`       Revert reason: ${error.reason}`));
      } else if (error.message.includes('revert')) {
        const revertMatch = error.message.match(/revert (.+?)"/);
        if (revertMatch) {
          console.log(c.red(`       Extracted revert reason: ${revertMatch[1]}`));
        }
      }
      
      // Try to call the function statically to get a better error
      try {
        console.log(c.dim(`       🔍 Attempting static call for better error...`));
        await ajo.connect(participant.signer).callStatic.joinAjo(0);
        console.log(c.yellow(`       Static call succeeded - timing issue?`));
      } catch (staticError) {
        console.log(c.red(`       Static call error: ${staticError.reason || staticError.message}`));
        
        // Check specific common issues
        if (staticError.message.includes('CollateralNotTransferred')) {
          console.log(c.red(`       🎯 ISSUE IDENTIFIED: User didn't approve collateral contract properly`));
        } else if (staticError.message.includes('InsufficientCollateralBalance')) {
          console.log(c.red(`       🎯 ISSUE IDENTIFIED: User has insufficient balance for collateral`));
        } else if (staticError.message.includes('TokenNotSupported')) {
          console.log(c.red(`       🎯 ISSUE IDENTIFIED: Token configuration issue`));
        } else if (staticError.message.includes('MemberAlreadyExists')) {
          console.log(c.red(`       🎯 ISSUE IDENTIFIED: Member already exists in system`));
        }
      }
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        error: error.reason || error.message,
        success: false
      });
    }
    
    await sleep(3000); // Longer delay for debugging
  }
  
  // Show detailed results
  console.log(c.cyan("\n📊 DETAILED JOIN RESULTS:"));
  const successful = joinResults.filter(r => r.success);
  console.log(c.dim(`  Success Rate: ${successful.length}/${participants.length}`));
  
  for (const result of joinResults) {
    if (result.success) {
      console.log(c.green(`  ✅ ${result.name}: ${ethers.utils.formatUnits(result.actualCollateral, 6)} USDC locked`));
    } else {
      console.log(c.red(`  ❌ ${result.name}: ${result.error}`));
    }
  }
  
  return joinResults;
}

async function demonstratePaymentCycle(ajo, ajoFactory, ajoId, participants) {
  console.log(c.blue("\n💳 LIVE: Payment Cycle..."));
  
  const paymentResults = [];
  
  // Monthly payments
  console.log(c.cyan("  Phase 1: Monthly Payments"));
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`    ${participant.name} making payment...`));
      
      const paymentTx = await ajo.connect(participant.signer).processPayment({ gasLimit: 300000 });
      const receipt = await paymentTx.wait();
      
      paymentResults.push({
        name: participant.name,
        gasUsed: receipt.gasUsed,
        success: true
      });
      
      console.log(c.green(`    ✅ Payment processed | Gas: ${receipt.gasUsed.toString()}`));
      
    } catch (error) {
      console.log(c.red(`    ❌ ${participant.name} payment failed: ${error.message}`));
      paymentResults.push({
        name: participant.name,
        success: false,
        error: error.message
      });
    }
    
    await sleep(1500);
  }
  
  // Distribute payout
  console.log(c.cyan("  Phase 2: Payout Distribution"));
  try {
    const payoutTx = await ajo.distributePayout({ gasLimit: 400000 });
    const receipt = await payoutTx.wait();
    console.log(c.green(`    ✅ Payout distributed | Gas: ${receipt.gasUsed.toString()}`));
    
    // Final health check after cycle
    await validateAjoHealth(ajoFactory, ajoId, 4, "After payment cycle");
    
  } catch (error) {
    console.log(c.red(`    ❌ Payout failed: ${error.message}`));
  }
  
  const successfulPayments = paymentResults.filter(r => r.success).length;
  console.log(c.green(`  ✅ Cycle complete: ${successfulPayments}/${participants.length} payments`));
  
  return paymentResults;
}

async function showFinalSummary(ajoFactory, ajoId, participants, joinResults, cycleResults) {
  console.log(c.blue("\n📋 FINAL SUMMARY"));
  
  try {
    // Get comprehensive health report
    const healthReport = await ajoFactory.getAjoHealthReport(ajoId);
    const operationalStatus = await ajoFactory.getAjoOperationalStatus(ajoId);
    const factoryHealth = await ajoFactory.getFactoryHealthSummary();
    
    console.log(c.cyan("🏥 HEALTH REPORT:"));
    console.log(c.dim(`  Ajo ID: ${ajoId}`));
    console.log(c.dim(`  Phase: ${healthReport.initializationPhase}/5`));
    console.log(c.dim(`  Ready: ${healthReport.isReady}`));
    console.log(c.dim(`  Core Health: ${healthReport.ajoCore.isResponsive ? 'Responsive' : 'Issues'}`));
    
    console.log(c.cyan("📊 OPERATIONAL STATUS:"));
    console.log(c.dim(`  Total Members: ${operationalStatus.totalMembers}`));
    console.log(c.dim(`  Active Members: ${operationalStatus.activeMembers}`));
    console.log(c.dim(`  Total Collateral: ${formatUSDC(operationalStatus.totalCollateralUSDC)} USDC`));
    console.log(c.dim(`  Can Accept Members: ${operationalStatus.canAcceptMembers}`));
    console.log(c.dim(`  Can Process Payments: ${operationalStatus.canProcessPayments}`));
    
    console.log(c.cyan("🏭 FACTORY HEALTH:"));
    console.log(c.dim(`  Phase 4 (Ready) Ajos: ${factoryHealth.phase4Count}`));
    console.log(c.dim(`  Phase 5 (Finalized) Ajos: ${factoryHealth.phase5Count}`));
    
    const successfulJoins = joinResults.filter(r => r.success).length;
    const successfulPayments = cycleResults ? cycleResults.filter(r => r.success).length : 0;
    
    console.log(c.green("\n🎯 DEMO RESULTS:"));
    console.log(c.dim(`  Participants: ${participants.length}`));
    console.log(c.dim(`  Successful Joins: ${successfulJoins}`));
    console.log(c.dim(`  Successful Payments: ${successfulPayments}`));
    console.log(c.dim(`  Overall Health: ${healthReport.isReady ? 'Excellent' : 'Needs attention'}`));
    
  } catch (error) {
    console.log(c.yellow(`  ⚠️ Summary generation failed: ${error.message}`));
  }
}

async function main() {
  console.log(c.cyan("🌟 4-Phase Factory: Core Functions Test with Health Diagnostics 🌟\n"));
  
  // Validate configuration
  if (!FACTORY_ADDRESS || FACTORY_ADDRESS === "0x44D75A793B9733Ff395a3eEC7A6E02c1fFE7c0c0") {
    console.log(c.red("❌ CONFIGURATION ERROR: Update FACTORY_ADDRESS first"));
    console.log(c.yellow("1. Run: npx hardhat run scripts/deploy-4-phase-factory.js --network hedera"));
    console.log(c.yellow("2. Update FACTORY_ADDRESS with deployed factory address"));
    console.log(c.yellow("3. Update TOKEN_ADDRESSES with USDC and WHBAR addresses"));
    process.exit(1);
  }
  
  try {
    // Connect and ensure healthy Ajo
    const {
      ajo, usdc, whbar, ajoMembers, ajoCollateral, ajoPayments,
      ajoFactory, ajoId, ajoInfo, deployer, signers
    } = await connectToFactoryAndEnsureHealthyAjo();
    
    // Setup participants
    const participants = await setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, signers);
    
    if (participants.length === 0) {
      throw new Error("No participants successfully set up");
    }
    
    // Live demonstrations
    const joinResults = await demonstrateJoining(ajo, ajoFactory, ajoId, participants);
    
    const successfulJoins = joinResults.filter(r => r.success);
    if (successfulJoins.length > 0) {
      const cycleResults = await demonstratePaymentCycle(ajo, ajoFactory, ajoId, participants.slice(0, successfulJoins.length));
      await showFinalSummary(ajoFactory, ajoId, participants, joinResults, cycleResults);
    } else {
      console.log(c.yellow("⚠️ No successful joins - skipping payment cycle"));
      await showFinalSummary(ajoFactory, ajoId, participants, joinResults, null);
    }
    
    console.log(c.green("\n🎉 Health-validated testing completed!"));
    
    return {
      factoryAddress: FACTORY_ADDRESS,
      ajoId,
      healthStatus: "validated",
      successfulParticipants: successfulJoins.length
    };
    
  } catch (error) {
    console.error(c.red("\n💥 Test failed:"), error.message);
    
    if (error.message.includes('health check failed')) {
      console.log(c.yellow("🏥 Health Check Issues:"));
      console.log(c.dim("• Check that all 4 phases completed successfully"));
      console.log(c.dim("• Verify contracts are properly initialized"));
      console.log(c.dim("• Use diagnostic functions to identify specific issues"));
    }
    
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🚀 Health-validated 4-phase system ready!"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Test failed:"), error);
      process.exit(1);
    });
}

module.exports = { main };