#!/usr/bin/env node
const { ethers } = require("hardhat");
const fs = require('fs');
// Import the advanced features (add this at the top of your file)
const {
  demoGovernanceSystem,
  demoCollateralSystem,
  demoDefaultHandling,
  demoMultiTokenSupport,
  demoReputationSystem,
  demoPaymentCycleInsights,
  demoFactoryScaling,
  demoEmergencyFeatures
} = require('./advanced_demo_features.cjs');


// Color utilities for better console output
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,  // ADD THIS LINE
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
  bright: (text) => `\x1b[1m${text}\x1b[0m`
};

const DEMO_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  MONTHLY_PAYMENT: ethers.utils.parseUnits("50", 6),
  TOTAL_PARTICIPANTS: 10,
  GAS_LIMIT: {
    DEPLOY_TOKEN: 3000000,
    DEPLOY_MASTER: 5000000,
    DEPLOY_GOVERNANCE: 6000000,
    DEPLOY_FACTORY: 6000000,
    CREATE_AJO: 1500000,
    INIT_PHASE_2: 1200000,
    INIT_PHASE_3: 1500000,
    INIT_PHASE_4: 1800000,
    FINALIZE: 2500000,
  }
};

// These will be populated after deployment
let FACTORY_ADDRESS = "";
let TOKEN_ADDRESSES = {
  USDC: "",
  WHBAR: ""
};

const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation(operation, operationName, maxRetries = DEMO_CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(c.dim(`  Attempt ${attempt}/${maxRetries}: ${operationName}`));
      const result = await operation();
      console.log(c.green(`  ✅ ${operationName} succeeded on attempt ${attempt}`));
      return result;
    } catch (error) {
      const isNetworkError = error.message.includes('other-side closed') || 
                           error.message.includes('SocketError') ||
                           error.message.includes('network') ||
                           error.message.includes('timeout') ||
                           error.message.includes('ETIMEDOUT') ||
                           error.message.includes('ECONNRESET') ||
                           error.message.includes('UND_ERR_SOCKET');
      
      if (isNetworkError && attempt < maxRetries) {
        console.log(c.yellow(`  ⚠️ Network error on attempt ${attempt}: ${error.message}`));
        console.log(c.dim(`  Retrying in ${DEMO_CONFIG.RETRY_DELAY/1000} seconds...`));
        await sleep(DEMO_CONFIG.RETRY_DELAY * attempt);
        continue;
      }
      
      console.log(c.red(`  ❌ ${operationName} failed after ${attempt} attempts: ${error.message}`));
      throw error;
    }
  }
}

// ================================================================
// DEPLOYMENT FUNCTIONS
// ================================================================

async function deployMasterCopies() {
  console.log(c.blue("\n🎯 PHASE 2: Deploying Master Copy Contracts..."));
  const masterContracts = {};
  
  const contracts = [
    { name: "AjoCore", key: "ajoCore" },
    { name: "AjoMembers", key: "ajoMembers" },
    { name: "AjoCollateral", key: "ajoCollateral" },
    { name: "AjoPayments", key: "ajoPayments" },
    { name: "AjoGovernance", key: "ajoGovernance" }
  ];
  
  for (const contract of contracts) {
    await retryOperation(async () => {
      console.log(c.dim(`    Deploying ${contract.name}...`));
      const ContractFactory = await ethers.getContractFactory(contract.name);
      const gasLimit = contract.name === "AjoGovernance" ? 
        DEMO_CONFIG.GAS_LIMIT.DEPLOY_GOVERNANCE : 
        DEMO_CONFIG.GAS_LIMIT.DEPLOY_MASTER;
      
      masterContracts[contract.key] = await ContractFactory.deploy({ gasLimit });
      await masterContracts[contract.key].deployed();
      
      console.log(c.green(`    ✅ ${contract.name} master: ${masterContracts[contract.key].address}`));
      return masterContracts[contract.key];
    }, `Deploy ${contract.name} Master`);
    
    await sleep(3000);
  }
  
  return masterContracts;
}

async function deployFactory() {
  console.log(c.blue("\n🚀 PHASE 1: Deploying 4-Phase AjoFactory System..."));
  
  const network = await ethers.provider.getNetwork();
  console.log(c.dim(`  🌐 Network: ${network.name} (Chain ID: ${network.chainId})`));
  
  const [deployer] = await ethers.getSigners();
  console.log(c.dim(`  👤 Deployer: ${deployer.address}`));
  
  // Deploy tokens
  console.log(c.dim("\n  📝 Deploying mock tokens..."));
  
  let usdc, whbar;
  
  await retryOperation(async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_TOKEN
    });
    await usdc.deployed();
    console.log(c.green(`    ✅ Mock USDC: ${usdc.address}`));
    return usdc;
  }, "Deploy Mock USDC");
  
  await sleep(2000);
  
  await retryOperation(async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    whbar = await MockERC20.deploy("Wrapped HBAR", "WHBAR", 8, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_TOKEN
    });
    await whbar.deployed();
    console.log(c.green(`    ✅ Mock WHBAR: ${whbar.address}`));
    return whbar;
  }, "Deploy Mock WHBAR");
  
  // Deploy master copies
  const masterContracts = await deployMasterCopies();
  
  await sleep(3000);
  
  // Deploy factory
  console.log(c.dim("\n  📝 PHASE 3: Deploying AjoFactory..."));
  
  let ajoFactory;
  await retryOperation(async () => {
    console.log(c.dim("    Deploying 4-Phase AjoFactory with all master implementations..."));
    const AjoFactory = await ethers.getContractFactory("AjoFactory");
    ajoFactory = await AjoFactory.deploy(
      usdc.address, 
      whbar.address,
      masterContracts.ajoCore.address,
      masterContracts.ajoMembers.address,
      masterContracts.ajoCollateral.address,
      masterContracts.ajoPayments.address,
      masterContracts.ajoGovernance.address,
      {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_FACTORY
      }
    );
    await ajoFactory.deployed();
    console.log(c.green(`    ✅ 4-Phase AjoFactory: ${ajoFactory.address}`));
    
    return ajoFactory;
  }, "Deploy 4-Phase AjoFactory");
  
  // Update global addresses
  FACTORY_ADDRESS = ajoFactory.address;
  TOKEN_ADDRESSES.USDC = usdc.address;
  TOKEN_ADDRESSES.WHBAR = whbar.address;
  
  console.log(c.green("\n  ✅ Factory deployment successful!"));
  console.log(c.green("  📋 DEPLOYMENT SUMMARY:"));
  console.log(c.dim(`     Factory: ${FACTORY_ADDRESS}`));
  console.log(c.dim(`     USDC:    ${TOKEN_ADDRESSES.USDC}`));
  console.log(c.dim(`     WHBAR:   ${TOKEN_ADDRESSES.WHBAR}`));
  
  return { ajoFactory, usdc, whbar, deployer, masterContracts };
}

async function verifyPhaseCompletion(ajoFactory, ajoId, expectedPhase) {
  console.log(c.dim(`    🔍 Verifying Phase ${expectedPhase}...`));
  
  try {
    const status = await ajoFactory.getAjoInitializationStatus(ajoId);
    
    if (status.phase >= expectedPhase) {
      console.log(c.green(`    ✅ Phase ${expectedPhase} verified - Status: ${status.phase}, Ready: ${status.isReady}`));
      return true;
    } else {
      console.log(c.yellow(`    ⚠️ Phase ${expectedPhase} incomplete - Current: ${status.phase}`));
      return false;
    }
  } catch (error) {
    console.log(c.red(`    ❌ Phase verification failed: ${error.message}`));
    return false;
  }
}

async function test5PhaseAjoCreation(ajoFactory, deployer) {
  console.log(c.blue(`\n🎯 Testing: 5-Phase Ajo Creation (with Final Lockdown)...`));
  
  let ajoId;
  
  // PHASE 1: Create Ajo
  console.log(c.cyan("\n  📋 PHASE 1: Creating Ajo (Proxy Deployment)..."));
  await retryOperation(async () => {
    const ajoName = `Demo Ajo ${Date.now()}`;
    console.log(c.dim(`    Creating "${ajoName}"...`));
    
    const creationTx = await ajoFactory.connect(deployer).createAjo(ajoName, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO
    });
    
    const receipt = await creationTx.wait();
    console.log(c.green(`    ✅ Phase 1 complete - Gas used: ${receipt.gasUsed.toString()}`));
    
    const createEvent = receipt.events?.find(event => event.event === 'AjoCreated');
    if (createEvent) {
      ajoId = createEvent.args.ajoId.toNumber();
      console.log(c.green(`    🎉 Ajo created with ID: ${ajoId}`));
    } else {
      throw new Error("AjoCreated event not found");
    }
    
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");
  
  if (!await verifyPhaseCompletion(ajoFactory, ajoId, 1)) {
    throw new Error("Phase 1 verification failed");
  }
  await sleep(3000);
  
  // PHASE 2: Initialize basic contracts
  console.log(c.cyan("\n  📋 PHASE 2: Initialize Basic Contracts..."));
  await retryOperation(async () => {
    console.log(c.dim(`    Initializing AjoMembers & AjoGovernance for ID ${ajoId}...`));
    const initTx = await ajoFactory.connect(deployer).initializeAjoPhase2(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2
    });
    const receipt = await initTx.wait();
    console.log(c.green(`    ✅ Phase 2 complete - Gas used: ${receipt.gasUsed.toString()}`));
    return receipt;
  }, "Initialize Ajo Phase 2");
  
  if (!await verifyPhaseCompletion(ajoFactory, ajoId, 2)) {
    throw new Error("Phase 2 verification failed");
  }
  await sleep(3000);
  
  // PHASE 3: Initialize collateral and payments
  console.log(c.cyan("\n  📋 PHASE 3: Initialize Collateral & Payments..."));
  await retryOperation(async () => {
    console.log(c.dim(`    Initializing AjoCollateral & AjoPayments for ID ${ajoId}...`));
    const initTx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3
    });
    const receipt = await initTx.wait();
    console.log(c.green(`    ✅ Phase 3 complete - Gas used: ${receipt.gasUsed.toString()}`));
    return receipt;
  }, "Initialize Ajo Phase 3");
  
  if (!await verifyPhaseCompletion(ajoFactory, ajoId, 3)) {
    throw new Error("Phase 3 verification failed");
  }
  await sleep(3000);
  
  // PHASE 4: Initialize core and activate
  console.log(c.cyan("\n  📋 PHASE 4: Initialize Core & Activate..."));
  await retryOperation(async () => {
    console.log(c.dim(`    Initializing AjoCore & activating for ID ${ajoId}...`));
    const initTx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4
    });
    const receipt = await initTx.wait();
    console.log(c.green(`    ✅ Phase 4 complete - Gas used: ${receipt.gasUsed.toString()}`));
    return receipt;
  }, "Initialize Ajo Phase 4");
  
  if (!await verifyPhaseCompletion(ajoFactory, ajoId, 4)) {
    throw new Error("Phase 4 verification failed");
  }
  await sleep(3000);

  // ----------------------------------------------------------------
  // NEW PHASE 5: Finalize Setup & Lock Contracts
  // ----------------------------------------------------------------
  console.log(c.cyan("\n  📋 PHASE 5: Finalize Setup & Lock Contracts..."));
  await retryOperation(async () => {
    console.log(c.dim(`    Finalizing setup and locking sub-contracts for ID ${ajoId}...`));
    // This calls the smart contract function `finalizeAjoSetup(uint256 ajoId)`
    const finalizeTx = await ajoFactory.connect(deployer).finalizeAjoSetup(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.FINALIZE_SETUP // Assuming you define this new gas limit
    });
    const receipt = await finalizeTx.wait();
    console.log(c.green(`    ✅ Phase 5 complete - Ajo fully FINALIZED and LOCKED! Gas used: ${receipt.gasUsed.toString()}`));
    return receipt;
  }, "Finalize Ajo Phase 5");
  
  if (!await verifyPhaseCompletion(ajoFactory, ajoId, 5)) {
    throw new Error("Phase 5 verification failed");
  }
  
  return { ajoId };
}

// ================================================================
// TESTING FUNCTIONS
// ================================================================

async function connectToFactory() {
  console.log(c.blue("\n🏭 Connecting to Deployed Factory..."));
  
  const network = await ethers.provider.getNetwork();
  console.log(c.dim(`  🌐 Network: ${network.name} (${network.chainId})`));
  
  const [deployer] = await ethers.getSigners();
  console.log(c.dim(`  👤 Deployer: ${deployer.address}`));
  
  // Connect to factory
  const AjoFactory = await ethers.getContractFactory("AjoFactory");
  const ajoFactory = AjoFactory.attach(FACTORY_ADDRESS);
  
  const factoryStats = await ajoFactory.getFactoryStats();
  console.log(c.green(`  ✅ Factory connected! Total: ${factoryStats.totalCreated}, Active: ${factoryStats.activeCount}`));
  
  return { ajoFactory, deployer, signers: await ethers.getSigners() };
}

async function ensureHealthyAjo(ajoFactory, deployer) {
  console.log(c.blue("\n🔍 Ensuring we have a healthy Ajo for testing..."));
  
  let ajoId, ajoInfo;
  const factoryStats = await ajoFactory.getFactoryStats();
  
  // Try to use existing Ajo first
  if (factoryStats.totalCreated.gt(0)) {
    console.log(c.dim("  Checking existing Ajos..."));
    
    for (let id = 1; id <= Math.min(3, factoryStats.totalCreated.toNumber()); id++) {
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
    console.log(c.dim("  Creating new healthy Ajo..."));
    const { ajoId: newId } = await test5PhaseAjoCreation(ajoFactory, deployer);
    ajoId = newId;
    ajoInfo = await ajoFactory.getAjo(ajoId);
  }
  
  // Connect to contracts
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
  const usdc = await ethers.getContractAt("MockERC20", TOKEN_ADDRESSES.USDC);
  const whbar = await ethers.getContractAt("MockERC20", TOKEN_ADDRESSES.WHBAR);
  
  console.log(c.green(`  ✅ Healthy Ajo ready: ${ajoInfo.name} (ID: ${ajoId})`));
  
  return { ajo, usdc, whbar, ajoMembers, ajoCollateral, ajoPayments, ajoId, ajoInfo };
}

async function setupParticipants(usdc, ajoCollateral, ajoPayments, signers) {
  console.log(c.blue("\n👥 Setting up participants..."));
  
  const participants = [];
  const participantNames = ["Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", "deon", "Funke", "Gbenga", "Halima", "Ifeanyi"];
  
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

async function demonstrateJoining(ajo, participants) {
  console.log(c.blue("\n🎯 LIVE: Participants Joining Ajo..."));
  
  const joinResults = [];
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`  ${i + 1}/${participants.length}: ${participant.name} joining...`));
      
      // Execute join
      const joinTx = await ajo.connect(participant.signer).joinAjo(0, { 
        gasLimit: 800000
      });
      
      const receipt = await joinTx.wait();
      
      // Verify the join was successful
      const memberInfo = await ajo.getMemberInfo(participant.address);
      const actualCollateral = memberInfo.memberInfo.lockedCollateral;
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        actualCollateral,
        gasUsed: receipt.gasUsed,
        success: true
      });
      
      console.log(c.green(`    ✅ SUCCESS! Locked: ${ethers.utils.formatUnits(actualCollateral, 6)} USDC | Gas: ${receipt.gasUsed.toString()}`));
      
    } catch (error) {
      console.log(c.red(`    ❌ ${participant.name}: ${error.reason || error.message}`));
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        error: error.reason || error.message,
        success: false
      });
    }
    
    await sleep(2000);
  }
  
  // Show results
  const successful = joinResults.filter(r => r.success);
  console.log(c.cyan(`\n📊 JOIN RESULTS: ${successful.length}/${participants.length} successful`));
  
  for (const result of joinResults) {
    if (result.success) {
      console.log(c.green(`  ✅ ${result.name}: ${formatUSDC(result.actualCollateral)} USDC locked`));
    } else {
      console.log(c.red(`  ❌ ${result.name}: Failed`));
    }
  }
  
  return joinResults;
}

async function demonstratePaymentCycle(ajo, participants) {
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
    
  } catch (error) {
    console.log(c.red(`    ❌ Payout failed: ${error.message}`));
  }
  
  const successfulPayments = paymentResults.filter(r => r.success).length;
  console.log(c.green(`  ✅ Cycle complete: ${successfulPayments}/${participants.length} payments`));
  
  return paymentResults;
}

async function showFinalSummary(ajoId, participants, joinResults, cycleResults) {
  console.log(c.blue("\n📋 FINAL SUMMARY"));
  
  const successfulJoins = joinResults.filter(r => r.success).length;
  const successfulPayments = cycleResults ? cycleResults.filter(r => r.success).length : 0;
  
  console.log(c.cyan("🎯 DEMO RESULTS:"));
  console.log(c.dim(`  Ajo ID: ${ajoId}`));
  console.log(c.dim(`  Participants: ${participants.length}`));
  console.log(c.dim(`  Successful Joins: ${successfulJoins}`));
  console.log(c.dim(`  Successful Payments: ${successfulPayments}`));
  
  console.log(c.cyan("🌐 DEPLOYMENT ADDRESSES:"));
  console.log(c.dim(`  Factory: ${FACTORY_ADDRESS}`));
  console.log(c.dim(`  USDC: ${TOKEN_ADDRESSES.USDC}`));
  console.log(c.dim(`  WHBAR: ${TOKEN_ADDRESSES.WHBAR}`));
}

// ================================================================
// MAIN DEMO ORCHESTRATOR
// ================================================================

async function main() {
  console.log(c.cyan("🏭 HACKATHON DEMO: Complete Deploy + Test + Advanced Features 🏭\n"));
  console.log(c.bright("Step 1: Deploy everything from scratch"));
  console.log(c.bright("Step 2: Create and initialize a demo Ajo"));  
  console.log(c.bright("Step 3: Run live user demonstrations"));
  console.log(c.bright("Step 4: Showcase advanced features"));
  
  try {
    // ============================================================
    // STEP 1-3: YOUR EXISTING DEMO CODE (unchanged)
    // ============================================================
    const { ajoFactory, usdc, whbar, deployer, masterContracts } = await deployFactory();
    const { ajoId } = await test5PhaseAjoCreation(ajoFactory, deployer);
    
    // Save deployment info
    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployedAt: new Date().toISOString(),
      contracts: {
        AjoFactory: FACTORY_ADDRESS,
        USDC: TOKEN_ADDRESSES.USDC,
        WHBAR: TOKEN_ADDRESSES.WHBAR
      },
      masterCopies: {
        AjoCore: masterContracts.ajoCore.address,
        AjoMembers: masterContracts.ajoMembers.address,
        AjoCollateral: masterContracts.ajoCollateral.address,
        AjoPayments: masterContracts.ajoPayments.address,
        AjoGovernance: masterContracts.ajoGovernance.address
      },
      testAjo: {
        id: ajoId,
        phase: 4
      }
    };
    
    try {
      fs.writeFileSync(`deployment-hackathon-${Date.now()}.json`, JSON.stringify(deploymentInfo, null, 2));
      console.log(c.dim("📄 Deployment info saved"));
    } catch (error) {
      console.log(c.yellow("⚠️ Could not save deployment info"));
    }
    
    // Live user demonstrations (your existing code)
    console.log(c.bright("\n🎬 Starting live user demonstrations..."));
    
    const { ajoFactory: connectedFactory, deployer: testDeployer, signers } = await connectToFactory();
    const { ajo, usdc: testUsdc, ajoCollateral, ajoPayments, ajoId: testAjoId } = await ensureHealthyAjo(connectedFactory, testDeployer);
    
    const participants = await setupParticipants(testUsdc, ajoCollateral, ajoPayments, signers);
    
    if (participants.length === 0) {
      throw new Error("No participants successfully set up");
    }
    
    const joinResults = await demonstrateJoining(ajo, participants);
    
    const successfulJoins = joinResults.filter(r => r.success);
    let cycleResults = null;
    if (successfulJoins.length > 0) {
      cycleResults = await demonstratePaymentCycle(ajo, participants.slice(0, successfulJoins.length));
    } else {
      console.log(c.yellow("⚠️ No successful joins - skipping payment cycle"));
    }
    
    await showFinalSummary(testAjoId, participants, joinResults, cycleResults);
    
    // ============================================================
    // STEP 4: ADVANCED FEATURES DEMONSTRATION
    // ============================================================
    console.log(c.magenta("\n🚀 STEP 4: ADVANCED FEATURES SHOWCASE"));
    console.log(c.bright("Demonstrating the full power of the Ajo System...\n"));
    
    // 1. Factory & Scaling Features
    await demoFactoryScaling(connectedFactory);
    await sleep(2000);
    
    // 2. Dynamic Collateral System (Your V2 Model)
    await demoCollateralSystem(connectedFactory, testAjoId);
    await sleep(2000);
    
    // 3. Multi-Token Support
    await demoMultiTokenSupport(ajo, ajoPayments, testUsdc, whbar, participants);
    await sleep(2000);
    
    // 4. Reputation & Voting System
    await demoReputationSystem(ajo, participants);
    await sleep(2000);
    
    // 5. Payment Analytics
    await demoPaymentCycleInsights(ajo, ajoPayments);
    await sleep(2000);
    
    // 6. Default Handling (Simulation)
    await demoDefaultHandling(ajo, ajoCollateral, participants);
    await sleep(2000);
    
    // 7. Governance System
    await demoGovernanceSystem(connectedFactory, testAjoId, participants);
    await sleep(2000);
    
    // 8. Security & Emergency Features
    await demoEmergencyFeatures(ajo, participants);
    
    // ============================================================
    // FINAL COMPREHENSIVE SUMMARY
    // ============================================================
    await showComprehensiveSummary(testAjoId, participants, joinResults, cycleResults, deploymentInfo);
    
    return {
      factoryAddress: FACTORY_ADDRESS,
      usdcAddress: TOKEN_ADDRESSES.USDC,
      whbarAddress: TOKEN_ADDRESSES.WHBAR,
      testAjoId: testAjoId,
      deploymentInfo
    };
    
  } catch (error) {
    console.error(c.red("\n💥 Enhanced demo failed:"));
    console.error(c.dim("Error:"), error.message);
    throw error;
  }
}

// Enhanced summary function
async function showComprehensiveSummary(ajoId, participants, joinResults, cycleResults, deploymentInfo) {
  console.log(c.magenta("\n📋 COMPREHENSIVE DEMO SUMMARY"));
  
  const successfulJoins = joinResults.filter(r => r.success).length;
  const successfulPayments = cycleResults ? cycleResults.filter(r => r.success).length : 0;
  
  console.log(c.cyan("🎯 BASIC DEMO RESULTS:"));
  console.log(c.dim(`  Ajo ID: ${ajoId}`));
  console.log(c.dim(`  Participants: ${participants.length}`));
  console.log(c.dim(`  Successful Joins: ${successfulJoins}`));
  console.log(c.dim(`  Successful Payments: ${successfulPayments}`));
  
  console.log(c.cyan("🌐 DEPLOYMENT ADDRESSES:"));
  console.log(c.dim(`  Factory: ${deploymentInfo.contracts.AjoFactory}`));
  console.log(c.dim(`  USDC: ${deploymentInfo.contracts.USDC}`));
  console.log(c.dim(`  WHBAR: ${deploymentInfo.contracts.WHBAR}`));
  
  console.log(c.cyan("🏗️  MASTER CONTRACTS:"));
  Object.entries(deploymentInfo.masterCopies).forEach(([name, address]) => {
    console.log(c.dim(`  ${name}: ${address}`));
  });
  
  console.log(c.magenta("✨ ADVANCED FEATURES DEMONSTRATED:"));
  console.log(c.green("  ✅ Dynamic Collateral System (V2 - 55% efficiency)"));
  console.log(c.green("  ✅ Guarantor Network & Asset Seizure"));
  console.log(c.green("  ✅ Multi-Token Support (USDC/HBAR)"));
  console.log(c.green("  ✅ Decentralized Governance & Voting"));
  console.log(c.green("  ✅ Reputation-Based Voting Power"));
  console.log(c.green("  ✅ Default Recovery & Asset Seizure"));
  console.log(c.green("  ✅ Factory Pattern for Unlimited Scaling"));
  console.log(c.green("  ✅ Emergency Controls & Security"));
  console.log(c.green("  ✅ Payment Analytics & Cycle Management"));
  
  console.log(c.cyan("💡 TECHNICAL INNOVATIONS:"));
  console.log(c.dim("  • Solves collateral paradox with 55% efficiency vs 100%+"));
  console.log(c.dim("  • Guarantor system distributes risk across members"));
  console.log(c.dim("  • Past payment seizure maximizes default recovery"));
  console.log(c.dim("  • Member-driven governance for parameter updates"));
  console.log(c.dim("  • Multi-token flexibility for global adoption"));
  console.log(c.dim("  • Proxy factory pattern enables unlimited groups"));
  console.log(c.dim("  • Reputation system incentivizes good behavior"));
  
  console.log(c.yellow("🏆 COMPETITIVE ADVANTAGES:"));
  console.log(c.dim("  • Lower capital requirements = higher user adoption"));
  console.log(c.dim("  • Risk distribution prevents single points of failure"));
  console.log(c.dim("  • Governance prevents centralization risks"));
  console.log(c.dim("  • Multi-token support serves diverse markets"));
  console.log(c.dim("  • Analytics provide transparency and trust"));
}

// Additional demo functions you can run individually
async function demoSpecificFeature(featureName, contracts, participants) {
  console.log(c.magenta(`\n🔍 FOCUSED DEMO: ${featureName.toUpperCase()}`));
  
  switch(featureName.toLowerCase()) {
    case 'collateral':
      await demoCollateralSystem(contracts.factory, contracts.ajoId);
      break;
    case 'governance':
      await demoGovernanceSystem(contracts.factory, contracts.ajoId, participants);
      break;
    case 'defaults':
      await demoDefaultHandling(contracts.ajo, contracts.ajoCollateral, participants);
      break;
    case 'tokens':
      await demoMultiTokenSupport(contracts.ajo, contracts.ajoPayments, contracts.usdc, contracts.whbar, participants);
      break;
    case 'reputation':
      await demoReputationSystem(contracts.ajo, participants);
      break;
    case 'analytics':
      await demoPaymentCycleInsights(contracts.ajo, contracts.ajoPayments);
      break;
    case 'factory':
      await demoFactoryScaling(contracts.factory);
      break;
    case 'emergency':
      await demoEmergencyFeatures(contracts.ajo, participants);
      break;
    default:
      console.log(c.red(`  ❌ Unknown feature: ${featureName}`));
      console.log(c.cyan("  Available: collateral, governance, defaults, tokens, reputation, analytics, factory, emergency"));
  }
}

// Interactive demo selector
async function interactiveDemo(contracts, participants) {
  console.log(c.magenta("\n🎮 INTERACTIVE FEATURE DEMO"));
  console.log(c.cyan("Select features to demonstrate:"));
  console.log(c.dim("1. Dynamic Collateral System"));
  console.log(c.dim("2. Governance & Voting"));
  console.log(c.dim("3. Default Handling"));
  console.log(c.dim("4. Multi-Token Support"));
  console.log(c.dim("5. Reputation System"));
  console.log(c.dim("6. Payment Analytics"));
  console.log(c.dim("7. Factory Scaling"));
  console.log(c.dim("8. Emergency Features"));
  console.log(c.dim("9. All Features"));
  
  // For demo purposes, we'll show all features
  console.log(c.green("Running all features for comprehensive demo..."));
  
  const features = ['collateral', 'governance', 'defaults', 'tokens', 'reputation', 'analytics', 'factory', 'emergency'];
  
  for (const feature of features) {
    await demoSpecificFeature(feature, contracts, participants);
    await sleep(1500);
  }
}

// Performance metrics demo
async function demoPerformanceMetrics(deploymentInfo, joinResults, cycleResults) {
  console.log(c.magenta("\n📊 PERFORMANCE METRICS ANALYSIS"));
  
  console.log(c.cyan("⛽ Gas Usage Analysis:"));
  
  // Deployment gas costs
  console.log(c.dim("  Deployment Phase:"));
  console.log(c.dim("    • Token Deployment: ~300,000 gas each"));
  console.log(c.dim("    • Master Contracts: ~3-6M gas total"));
  console.log(c.dim("    • Factory Deployment: ~6M gas"));
  console.log(c.dim("    • 4-Phase Ajo Creation: ~1.6M gas total"));
  
  // User interaction costs
  if (joinResults && joinResults.length > 0) {
    const avgJoinGas = joinResults
      .filter(r => r.success && r.gasUsed)
      .reduce((sum, r) => sum + r.gasUsed.toNumber(), 0) / joinResults.filter(r => r.success).length;
    
    console.log(c.dim("  User Interactions:"));
    console.log(c.dim(`    • Average Join Cost: ~${Math.round(avgJoinGas).toLocaleString()} gas`));
  }
  
  if (cycleResults && cycleResults.length > 0) {
    const avgPaymentGas = cycleResults
      .filter(r => r.success && r.gasUsed)
      .reduce((sum, r) => sum + r.gasUsed.toNumber(), 0) / cycleResults.filter(r => r.success).length;
    
    console.log(c.dim(`    • Average Payment: ~${Math.round(avgPaymentGas).toLocaleString()} gas`));
  }
  
  console.log(c.cyan("💰 Economic Efficiency:"));
  console.log(c.dim("  Collateral Efficiency:"));
  console.log(c.dim("    • Traditional ROSCAs: 100%+ collateral"));
  console.log(c.dim("    • Our V2 Model: 55% collateral"));
  console.log(c.dim("    • Efficiency Gain: 45% capital savings"));
  
  console.log(c.dim("  Risk Distribution:"));
  console.log(c.dim("    • Individual Risk: Reduced via guarantors"));
  console.log(c.dim("    • Group Risk: Spread across all members"));
  console.log(c.dim("    • Recovery Rate: Up to 100% via asset seizure"));
  
  console.log(c.cyan("🚀 Scalability Metrics:"));
  console.log(c.dim("  Factory Pattern Benefits:"));
  console.log(c.dim("    • Unlimited Ajo groups"));
  console.log(c.dim("    • Reduced deployment costs (proxy pattern)"));
  console.log(c.dim("    • Upgradeable implementations"));
  console.log(c.dim("    • Cross-group analytics possible"));
}
if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🚀 Complete hackathon demo finished!"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Demo failed:"), error);
      process.exit(1);
    });
}

module.exports = { main };