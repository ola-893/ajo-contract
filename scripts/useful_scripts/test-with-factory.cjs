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
  dim: (text) => `\x1b[2m${text}\x1b[0m`
};

// ================================================================
// 🔧 CONFIGURATION - DEPLOYED ADDRESSES
// ================================================================

const FACTORY_ADDRESS = "0x7F55125919C0AB25c10e06334499aE4Ce9041aDD";
const TOKEN_ADDRESSES = {
  USDC: "0x00000000000000000000000000000000006CcB58",
  WHBAR: "0x00000000000000000000000000000000006CCB59"
};
 
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
  
  // Connect to HTS tokens
  console.log(c.cyan("\n  🪙 Connecting to HTS Tokens..."));
  console.log(c.dim(`     USDC: ${TOKEN_ADDRESSES.USDC}`));
  console.log(c.dim(`     WHBAR: ${TOKEN_ADDRESSES.WHBAR}`));
  
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
  
  // Verify factory has tokens
  const factoryUsdcBalance = await usdc.balanceOf(ajoFactory.address);
  const factoryWhbarBalance = await whbar.balanceOf(ajoFactory.address);
  
  console.log(c.green(`  ✅ Factory USDC: ${formatUSDC(factoryUsdcBalance)}`));
  console.log(c.green(`  ✅ Factory WHBAR: ${formatHBAR(factoryWhbarBalance)}`));
  
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
          ajoInfo = await ajoFactory.getAjo(3);
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
    console.log(c.dim("\n  🎯 Creating new healthy Ajo..."));
    
    // Phase 1: Create
    const ajoName = `Health Test ${Date.now()}`;
    const useHtsTokens = true; // CHANGED: Use HTS tokens
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
    console.log(c.green(`    ✅ Phase 1: Ajo ${ajoId} created`));
    
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
  const participantNames = ["Emeka", "Funke", "Gbenga", "Halima", "Ifeanyi", "Jide", "Kemi", "Lekan", "Mojisola", "Nkechi", "Ola", "Peter", "Queen"];
  
  const actualCount = Math.min(DEMO_CONFIG.TOTAL_PARTICIPANTS, signers.length - 1);
  
  console.log(c.yellow("  ℹ️  Using HTS tokens with auto-association via factory\n"));
  
  for (let i = 0; i < actualCount; i++) {
    const participant = {
      signer: signers[i + 1],
      name: participantNames[i],
      address: signers[i + 1].address,
      position: i + 1
    };
    
    try {
      console.log(c.dim(`  👤 Setting up ${participant.name}...`));
      
      // Fund user with HTS tokens via factory (auto-association)
      const usdcAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC
      const hbarAmount = ethers.utils.parseUnits("1000", 8); // 1000 WHBAR
      
      await retryOperation(async () => {
        const tx = await ajoFactory.connect(deployer).fundUserWithHtsTokens(
          participant.address,
          usdcAmount,
          hbarAmount,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.FUND_USER }
        );
        
        const receipt = await tx.wait();
        
        const fundEvent = receipt.events?.find(e => e.event === 'UserHtsFunded');
        if (fundEvent) {
          console.log(c.dim(`       USDC Response: ${fundEvent.args.usdcResponse}`));
          console.log(c.dim(`       HBAR Response: ${fundEvent.args.hbarResponse}`));
        }
        
        return tx;
      }, `${participant.name} getting HTS tokens`);
      
      await sleep(500);
      
      // Verify balance
      const balance = await usdc.balanceOf(participant.address);
      if (balance.eq(0)) {
        throw new Error("Zero balance after funding");
      }
      
      console.log(c.dim(`       Balance: ${formatUSDC(balance)} USDC`));
      
      // Approve contracts for HTS tokens
      const approvalAmount = balance.div(2);
      
      console.log(c.dim(`     → Approving ${formatUSDC(approvalAmount)} for contracts...`));
      
      const htsToken = new ethers.Contract(
        TOKEN_ADDRESSES.USDC,
        ["function approve(address,uint256) returns (bool)"],
        participant.signer
      );
      
      await retryOperation(async () => {
        const tx = await htsToken.approve(
          ajoCollateral.address,
          approvalAmount,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.HTS_APPROVE }
        );
        await tx.wait();
        console.log(c.dim(`        ✓ Collateral approved`));
        return tx;
      }, `${participant.name} approving CollateralContract`);
      
      await sleep(500);
      
      await retryOperation(async () => {
        const tx = await htsToken.approve(
          ajoPayments.address,
          approvalAmount,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.HTS_APPROVE }
        );
        await tx.wait();
        console.log(c.dim(`        ✓ Payments approved`));
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
  console.log(c.blue("\n🎯 LIVE: Participants Joining Ajo..."));
  
  const joinResults = [];
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`  ${i + 1}/${participants.length}: ${participant.name} joining...`));
      
      // Pre-join diagnostics
      console.log(c.dim(`    🔍 Pre-join diagnostics for ${participant.name}:`));
      
      const usdc = new ethers.Contract(
        TOKEN_ADDRESSES.USDC,
        ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
        ethers.provider
      );
      
      const balance = await usdc.balanceOf(participant.address);
      const collateralApproval = await usdc.allowance(participant.address, (await ajo.collateralContract()));
      const paymentsApproval = await usdc.allowance(participant.address, (await ajo.paymentsContract()));
      
      console.log(c.dim(`       Balance: ${formatUSDC(balance)} USDC`));
      console.log(c.dim(`       Collateral approval: ${formatUSDC(collateralApproval)} USDC`));
      console.log(c.dim(`       Payments approval: ${formatUSDC(paymentsApproval)} USDC`));
      
      // Get expected collateral
      let expectedCollateral;
      try {
        expectedCollateral = await ajo.getRequiredCollateralForJoin(0);
        console.log(c.dim(`       Expected collateral: ${formatUSDC(expectedCollateral)} USDC`));
      } catch (error) {
        console.log(c.dim(`       Could not get expected collateral: ${error.message}`));
      }
      
      console.log(c.dim(`    🚀 Executing joinAjo transaction...`));
      
      const joinTx = await ajo.connect(participant.signer).joinAjo(0, { 
        gasLimit: DEMO_CONFIG.GAS_LIMIT.JOIN_AJO
      });
      
      console.log(c.dim(`       Transaction hash: ${joinTx.hash}`));
      const receipt = await joinTx.wait();
      
      if (receipt.status === 0) {
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
      
      console.log(c.green(`    ✅ SUCCESS! Locked: ${formatUSDC(actualCollateral)} USDC | Gas: ${receipt.gasUsed.toString()}`));
      
      await validateAjoHealth(ajoFactory, ajoId, 4, `After ${participant.name} joined`);
      
    } catch (error) {
      console.log(c.red(`    ❌ ${participant.name} failed: ${error.reason || error.message}`));
      
      // Try static call for better error
      try {
        await ajo.connect(participant.signer).callStatic.joinAjo(0);
      } catch (staticError) {
        console.log(c.red(`       Static call error: ${staticError.reason || staticError.message}`));
      }
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        error: error.reason || error.message,
        success: false
      });
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
      console.log(c.red(`  ❌ ${result.name}: ${result.error}`));
    }
  }
  
  return joinResults;
}

async function demonstratePaymentCycle(ajo, ajoFactory, ajoId, participants, ajoPayments) {
  console.log(c.blue("\n💳 LIVE: Payment Cycle..."));
  
  const paymentResults = [];
  
  console.log(c.cyan("  Phase 1: Monthly Payments"));
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`    ${participant.name} making payment...`));
      
      const paymentTx = await ajo.connect(participant.signer).processPayment({ gasLimit: DEMO_CONFIG.GAS_LIMIT.PROCESS_PAYMENT });
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
  
  const successfulPayments = paymentResults.filter(r => r.success).length;
  console.log(c.green(`  ✅ Cycle complete: ${successfulPayments}/${participants.length} payments`));
  
  // ============ NEW: GET CYCLE PAYMENT STATUS ============
  console.log(c.cyan(`\n  📊 Step 1.5: Verify Cycle Payment Status\n`));
  
  const cycleData = { paymentResults };
  
  try {
    const currentCycle = 1;
    
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
  
  return paymentResults;
}

async function showFinalSummary(ajoFactory, ajoId, participants, joinResults, cycleResults) {
  console.log(c.blue("\n📋 FINAL SUMMARY"));
  
  try {
    const status = await ajoFactory.getAjoInitializationStatus(ajoId);
    const operationalStatus = await ajoFactory.getAjoOperationalStatus(ajoId);
    
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
    
    const successfulJoins = joinResults.filter(r => r.success).length;
    const successfulPayments = cycleResults ? cycleResults.filter(r => r.success).length : 0;
    
    console.log(c.green("\n🎯 DEMO RESULTS:"));
    console.log(c.dim(`  Participants: ${participants.length}`));
    console.log(c.dim(`  Successful Joins: ${successfulJoins}`));
    console.log(c.dim(`  Successful Payments: ${successfulPayments}`));
    console.log(c.dim(`  Overall Health: ${status.isReady ? 'Excellent' : 'Needs attention'}`));
    
  } catch (error) {
    console.log(c.yellow(`  ⚠️ Summary generation failed: ${error.message}`));
  }
}





async function main() {
  console.log(c.cyan("🌟 5-Phase Factory: HTS Core Functions Test 🌟\n"));
  console.log(c.yellow("  Using deployed HTS tokens with auto-association\n"));
  
  try {
    const {
      ajo, usdc, whbar, ajoMembers, ajoCollateral, ajoPayments,
      ajoFactory, ajoId, ajoInfo, deployer, signers
    } = await connectToFactoryAndEnsureHealthyAjo();
    
    const participants = await setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, ajoFactory, deployer, signers);
    
    if (participants.length === 0) {
      throw new Error("No participants successfully set up");
    }
    
    const joinResults = await demonstrateJoining(ajo, ajoFactory, ajoId, participants);
    
    const successfulJoins = joinResults.filter(r => r.success);
    if (successfulJoins.length > 0) {
      const cycleResults = await demonstratePaymentCycle(ajo, ajoFactory, ajoId, participants.slice(0, successfulJoins.length));
      await showFinalSummary(ajoFactory, ajoId, participants, joinResults, cycleResults);
    } else {
      console.log(c.yellow("⚠️ No successful joins - skipping payment cycle"));
      await showFinalSummary(ajoFactory, ajoId, participants, joinResults, null);
    }
    
    console.log(c.green("\n🎉 Testing completed!"));
    
    console.log(c.green("\n🎉 Testing completed!"));
    
    return {
      factoryAddress: FACTORY_ADDRESS,
      tokenAddresses: TOKEN_ADDRESSES,
      ajoId,
      healthStatus: "validated",
      successfulParticipants: successfulJoins.length
    };
    
  } catch (error) {
    console.error(c.red("\n💥 Test failed:"), error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🚀 HTS system ready!"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Test failed:"), error);
      process.exit(1);
    });
}

module.exports = { main };