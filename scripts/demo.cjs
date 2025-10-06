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

// Color utilities
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
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

let FACTORY_ADDRESS = "";
let TOKEN_ADDRESSES = {
  USDC: "",
  WHBAR: ""
};

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
                           error.message.includes('timeout');
      
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
  
  const [deployer] = await ethers.getSigners();
  console.log(c.dim(`  👤 Deployer: ${deployer.address}`));
  
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
  
  const masterContracts = await deployMasterCopies();
  
  await sleep(3000);
  
  console.log(c.dim("\n  📝 PHASE 3: Deploying AjoFactory..."));
  
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
      {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_FACTORY
      }
    );
    await ajoFactory.deployed();
    console.log(c.green(`    ✅ 4-Phase AjoFactory: ${ajoFactory.address}`));
    return ajoFactory;
  }, "Deploy 4-Phase AjoFactory");
  
  FACTORY_ADDRESS = ajoFactory.address;
  TOKEN_ADDRESSES.USDC = usdc.address;
  TOKEN_ADDRESSES.WHBAR = whbar.address;
  
  console.log(c.green("\n  ✅ Factory deployment successful!"));
  
  return { ajoFactory, usdc, whbar, deployer, masterContracts };
}

async function test5PhaseAjoCreation(ajoFactory, deployer) {
  console.log(c.blue(`\n🎯 Testing: 5-Phase Ajo Creation...`));
  
  let ajoId;
  
  console.log(c.cyan("\n  📋 PHASE 1: Creating Ajo..."));
  await retryOperation(async () => {
    const ajoName = `Demo Ajo ${Date.now()}`;
    const creationTx = await ajoFactory.connect(deployer).createAjo(ajoName, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO
    });
    
    const receipt = await creationTx.wait();
    const createEvent = receipt.events?.find(event => event.event === 'AjoCreated');
    
    if (createEvent) {
      ajoId = createEvent.args.ajoId.toNumber();
      console.log(c.green(`    🎉 Ajo created with ID: ${ajoId}`));
    } else {
      throw new Error("AjoCreated event not found");
    }
    
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");
  
  await sleep(3000);
  
  console.log(c.cyan("\n  📋 PHASE 2: Initialize Basic Contracts..."));
  await retryOperation(async () => {
    const initTx = await ajoFactory.connect(deployer).initializeAjoPhase2(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2
    });
    await initTx.wait();
    console.log(c.green(`    ✅ Phase 2 complete`));
  }, "Initialize Ajo Phase 2");
  
  await sleep(3000);
  
  console.log(c.cyan("\n  📋 PHASE 3: Initialize Collateral & Payments..."));
  await retryOperation(async () => {
    const initTx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3
    });
    await initTx.wait();
    console.log(c.green(`    ✅ Phase 3 complete`));
  }, "Initialize Ajo Phase 3");
  
  await sleep(3000);
  
  console.log(c.cyan("\n  📋 PHASE 4: Initialize Core & Activate..."));
  await retryOperation(async () => {
    const initTx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4
    });
    await initTx.wait();
    console.log(c.green(`    ✅ Phase 4 complete`));
  }, "Initialize Ajo Phase 4");
  
  await sleep(3000);

  console.log(c.cyan("\n  📋 PHASE 5: Finalize Setup & Lock Contracts..."));
  await retryOperation(async () => {
    const finalizeTx = await ajoFactory.connect(deployer).finalizeAjoSetup(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.FINALIZE
    });
    await finalizeTx.wait();
    console.log(c.green(`    ✅ Phase 5 complete - FINALIZED!`));
  }, "Finalize Ajo Phase 5");
  
  return { ajoId };
}

async function setupContracts(ajoFactory, usdc, ajoId) {
  console.log(c.blue("\n🔧 Setting up contracts and participants..."));
  
  const [deployer, ...signers] = await ethers.getSigners();
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
  
  // Setup participants
  const participants = [];
  const participantNames = ["Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", "Femi", "Funke", "Gbenga", "Halima", "Ifeanyi"];
  
  const actualCount = Math.min(DEMO_CONFIG.TOTAL_PARTICIPANTS, signers.length);
  
  for (let i = 0; i < actualCount; i++) {
    const participant = {
      signer: signers[i],
      name: participantNames[i],
      address: signers[i].address,
      position: i + 1
    };
    
    try {
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).faucet({ gasLimit: 200000 });
        await tx.wait();
        return tx;
      }, `${participant.name} getting USDC`);
      
      const balance = await usdc.balanceOf(participant.address);
      const allowanceAmount = balance.div(2);
      
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).approve(ajoCollateral.address, allowanceAmount, { gasLimit: 150000 });
        await tx.wait();
        return tx;
      }, `${participant.name} approving Collateral`);
      
      await retryOperation(async () => {
        const tx = await usdc.connect(participant.signer).approve(ajoPayments.address, allowanceAmount, { gasLimit: 150000 });
        await tx.wait();
        return tx;
      }, `${participant.name} approving Payments`);
      
      participants.push(participant);
      
    } catch (error) {
      console.log(c.yellow(`  ⚠️ ${participant.name} setup failed: ${error.message}`));
    }
    
    await sleep(1000);
  }
  
  console.log(c.green(`  ✅ ${participants.length}/${actualCount} participants ready`));
  
  return { ajo, ajoMembers, ajoCollateral, ajoPayments, participants };
}

// ================================================================
// MAIN COMPREHENSIVE DEMO
// ================================================================

async function main() {
  console.log(c.magenta("\n🏭 COMPREHENSIVE AJO DEMO WITH FULL VIEW VERIFICATION 🏭\n"));
  
  try {
    // STEP 1: Deploy everything
    console.log(c.blue("══════════════════════════════════════════════════"));
    console.log(c.bright("  STEP 1: DEPLOYMENT"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    const { ajoFactory, usdc, whbar, deployer, masterContracts } = await deployFactory();
    
    // VIEW TEST: Factory state after deployment
    console.log(c.magenta("\n📊 VIEW TEST: Factory State After Deployment"));
    await showFactoryState(ajoFactory);
    await demoFactoryViewFunctions(ajoFactory, deployer);
    await verifyFactoryPagination(ajoFactory);
    
    // STEP 2: Create Ajo
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  STEP 2: AJO CREATION (5 PHASES)"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
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
      testAjo: { id: ajoId }
    };
    
    try {
      fs.writeFileSync(`deployment-${Date.now()}.json`, JSON.stringify(deploymentInfo, null, 2));
    } catch (error) {
      console.log(c.yellow("⚠️ Could not save deployment info"));
    }
    
    // STEP 3: Setup contracts and participants
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  STEP 3: CONTRACT SETUP & PARTICIPANTS"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    const { ajo, ajoMembers, ajoCollateral, ajoPayments, participants } = 
      await setupContracts(ajoFactory, usdc, ajoId);
    
    // VIEW TEST: Pre-joining state
    console.log(c.magenta("\n📊 VIEW TEST: Pre-Joining State"));
    await showPreJoiningState(ajo, ajoCollateral, ajoMembers, ajoPayments);
    await demoCoreViewFunctions(ajo, participants);
    await verifyTokenConfiguration(ajo, ajoPayments);
    
    // STEP 4: Members join
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  STEP 4: MEMBERS JOINING"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    const joinResults = await demonstrateJoiningWithVerification(
      ajo, 
      ajoCollateral, 
      ajoMembers, 
      participants
    );
    
    // VIEW TEST: Post-joining comprehensive checks
    console.log(c.magenta("\n📊 VIEW TEST: Post-Joining Comprehensive Verification"));
    await demoMemberViewFunctions(ajo, ajoMembers, participants);
    await verifyMemberIndexing(ajoMembers, participants);
    await demoCollateralViewFunctions(ajoCollateral, participants);
    await verifyAdvancedCollateralFeatures(ajoCollateral, participants);
    await verifySeizableAssetsForAll(ajo, ajoCollateral, participants);
    
    // STEP 5: Payment cycle
    const successfulJoins = joinResults.filter(r => r.success);
    if (successfulJoins.length > 0) {
      console.log(c.blue("\n══════════════════════════════════════════════════"));
      console.log(c.bright("  STEP 5: PAYMENT CYCLE"));
      console.log(c.blue("══════════════════════════════════════════════════"));
      
      const paymentResults = await demonstratePaymentCycleWithVerification(
        ajo, 
        ajoPayments, 
        participants.slice(0, successfulJoins.length)
      );
      
      // VIEW TEST: Post-payment comprehensive checks
      console.log(c.magenta("\n📊 VIEW TEST: Post-Payment Comprehensive Verification"));
      await demoPaymentViewFunctions(ajo, ajoPayments, participants);
      await verifyPayoutHistory(ajoPayments);
    } else {
      console.log(c.yellow("\n⚠️ No successful joins - skipping payment cycle"));
    }
    
    // STEP 6: Governance
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  STEP 6: GOVERNANCE SYSTEM"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    await showGovernanceState(ajoFactory, ajoId);
    await demoGovernanceViewFunctions(ajoFactory, ajoId, participants);
    
    // FINAL SUMMARY
    console.log(c.magenta("\n🎉 COMPLETE DEMO WITH VIEW VERIFICATION FINISHED!"));
    console.log(c.bright("\n📊 SUMMARY OF VIEW FUNCTIONS TESTED:"));
    
    const viewFunctionStats = {
      factory: 9,
      core: 7,
      members: 13,
      collateral: 4,
      payments: 14,
      governance: 3
    };
    
    const total = Object.values(viewFunctionStats).reduce((a, b) => a + b, 0);
    
    console.log(c.green(`\n  ✅ Total View Functions Tested: ${total}`));
    Object.entries(viewFunctionStats).forEach(([contract, count]) => {
      console.log(c.green(`     • ${contract.charAt(0).toUpperCase() + contract.slice(1)}: ${count} functions`));
    });
    
    console.log(c.bright("\n💡 NEXT STEPS:"));
    console.log("  1. Review any ❌ errors above - those view functions need fixes");
    console.log("  2. Check console for specific error messages");
    console.log("  3. Fix the failing view functions in your contracts");
    console.log("  4. Re-run this demo to verify fixes");
    console.log("  5. Once all green ✅, proceed to frontend integration");
    
    return {
      factoryAddress: FACTORY_ADDRESS,
      ajoId,
      deploymentInfo
    };
    
  } catch (error) {
    console.error(c.red("\n💥 Demo failed:"), error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🚀 Demo completed successfully!"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Demo failed:"), error);
      process.exit(1);
    });
}

module.exports = { main };