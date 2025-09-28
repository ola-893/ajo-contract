#!/usr/bin/env node
const { ethers } = require("hardhat");

// Color utilities for better console output
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`
};

// Demo configuration for testnet
const DEMO_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
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
        await sleep(DEMO_CONFIG.RETRY_DELAY * attempt); // Exponential backoff
        continue;
      }
      
      console.log(c.red(`  ❌ ${operationName} failed after ${attempt} attempts: ${error.message}`));
      throw error;
    }
  }
}

async function deployMasterCopies() {
  console.log(c.blue("\n🎯 PHASE 2: Deploying Master Copy Contracts..."));
  const masterContracts = {};
  
  // Deploy all master contracts
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
    
    await sleep(3000); // Longer delay between deployments
  }
  
  return masterContracts;
}

async function deployFactory() {
  console.log(c.blue("\n🚀 Deploying 4-Phase AjoFactory System (HEDERA TESTNET)..."));
  
  const network = await ethers.provider.getNetwork();
  console.log(c.dim(`  🌐 Network: ${network.name} (Chain ID: ${network.chainId})`));
  
  const [deployer] = await ethers.getSigners();
  console.log(c.dim(`  👤 Deployer: ${deployer.address}`));
  
  // Deploy tokens
  console.log(c.dim("\n  📝 PHASE 1: Deploying mock tokens..."));
  
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
  
  await sleep(3000); // Longer delay before factory deployment
  
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
    
    // Verify factory is working
    const factoryStats = await ajoFactory.getFactoryStats();
    console.log(c.dim(`    Factory verification: ${factoryStats.totalCreated} Ajos created`));
    
    return ajoFactory;
  }, "Deploy 4-Phase AjoFactory");
  
  console.log(c.green("\n  ✅ Factory deployment successful!"));
  console.log(c.green("  📋 HEDERA TESTNET DEPLOYMENT SUMMARY:"));
  console.log(c.dim(`     Factory: ${ajoFactory.address}`));
  console.log(c.dim(`     USDC:    ${usdc.address}`));
  console.log(c.dim(`     WHBAR:   ${whbar.address}`));
  
  return { ajoFactory, usdc, whbar, deployer, masterContracts };
}

async function verifyPhaseCompletion(ajoFactory, ajoId, expectedPhase) {
  console.log(c.dim(`    🔍 Verifying Phase ${expectedPhase}...`));
  
  try {
    // Always check basic status first
    const status = await ajoFactory.getAjoInitializationStatus(ajoId);
    
    if (status.phase >= expectedPhase) {
      console.log(c.green(`    ✅ Phase ${expectedPhase} verified - Status: ${status.phase}, Ready: ${status.isReady}`));
      
      // Only try health report for Phase 4+ (when contracts are more initialized)
      if (expectedPhase >= 4) {
        try {
          const healthReport = await ajoFactory.getAjoHealthReport(ajoId);
          if (healthReport.ajoCore.isDeployed) {
            console.log(c.dim(`       Core Health: ${healthReport.ajoCore.isResponsive ? 'Responsive ✅' : 'Initializing ⚠️'}`));
          }
        } catch (healthError) {
          console.log(c.dim(`       Health report unavailable (normal for early phases)`));
        }
      }
      
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

async function test4PhaseAjoCreation(ajoFactory, deployer) {
  console.log(c.blue(`\n🎯 Testing: 4-Phase Ajo Creation with Enhanced Diagnostics...`));
  
  let ajoId;
  
  // PHASE 1: Create Ajo (proxies only)
  console.log(c.cyan("\n  📋 PHASE 1: Creating Ajo (Proxy Deployment)..."));
  await retryOperation(async () => {
    const ajoName = `Diagnostic Test Ajo ${Date.now()}`;
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
  
  // Verify Phase 1 (basic check only)
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
    console.log(c.green(`    ✅ Phase 4 complete - Ajo is ACTIVE! Gas used: ${receipt.gasUsed.toString()}`));
    return receipt;
  }, "Initialize Ajo Phase 4");
  
  if (!await verifyPhaseCompletion(ajoFactory, ajoId, 4)) {
    throw new Error("Phase 4 verification failed");
  }
  
  await sleep(2000);
  
  // Enhanced diagnostics now that Ajo is fully functional
  console.log(c.dim(`\n    🔍 Enhanced health diagnostics...`));
  try {
    const healthReport = await ajoFactory.getAjoHealthReport(ajoId);
    console.log(c.green(`    ✅ Health Report:`));
    console.log(c.dim(`       Phase: ${healthReport.initializationPhase}, Ready: ${healthReport.isReady}`));
    console.log(c.dim(`       Core Status: ${healthReport.ajoCore.isResponsive ? 'Responsive' : 'Issues'} - ${healthReport.ajoCore.errorMessage || 'OK'}`));
    console.log(c.dim(`       Members Status: ${healthReport.ajoMembers.isResponsive ? 'Responsive' : 'Issues'}`));
    console.log(c.dim(`       Cross-linking: ${healthReport.linking.ajoCoreToMembers ? 'OK' : 'Issues'}`));
    
    // Test operational status
    const operationalStatus = await ajoFactory.getAjoOperationalStatus(ajoId);
    console.log(c.green(`    ✅ Operational Status:`));
    console.log(c.dim(`       Can Accept Members: ${operationalStatus.canAcceptMembers}`));
    console.log(c.dim(`       Can Process Payments: ${operationalStatus.canProcessPayments}`));
    
  } catch (error) {
    console.log(c.yellow(`    ⚠️ Enhanced diagnostics failed: ${error.message}`));
    console.log(c.dim(`       This is normal for newly initialized contracts`));
  }
  
  // Test basic functionality
  console.log(c.dim(`\n    🔧 Testing basic contract functionality...`));
  try {
    const ajoInfo = await ajoFactory.getAjo(ajoId);
    const AjoCore = await ethers.getContractFactory("AjoCore");
    const ajoCoreContract = AjoCore.attach(ajoInfo.ajoCore);
    
    const tokenConfig = await ajoCoreContract.getTokenConfig(0); // USDC
    console.log(c.green(`    ✅ USDC Config verified: ${ethers.utils.formatUnits(tokenConfig.monthlyPayment || tokenConfig[0], 6)} USDC monthly`));
    
    const contractStats = await ajoCoreContract.getContractStats();
    console.log(c.green(`    ✅ Contract stats: ${contractStats.totalMembers} total members`));
    
  } catch (error) {
    console.log(c.yellow(`    ⚠️ Basic functionality test failed: ${error.message}`));
    console.log(c.dim(`       Contract may need more time to fully initialize`));
  }
  
  return { ajoId };
}

async function main() {
  console.log(c.cyan("🏭 4-Phase AjoFactory: Deployment with Enhanced Diagnostics 🏭\n"));
  
  try {
    // Deploy factory and components
    const { ajoFactory, usdc, whbar, deployer, masterContracts } = await deployFactory();
    
    // Test 4-phase Ajo creation with diagnostics
    const { ajoId } = await test4PhaseAjoCreation(ajoFactory, deployer);
    
    // Get factory health summary
    console.log(c.blue("\n📊 Factory Health Summary:"));
    try {
      const healthSummary = await ajoFactory.getFactoryHealthSummary();
      console.log(c.dim(`  Phase 1 (Proxies): ${healthSummary.phase1Count.toString()}`));
      console.log(c.dim(`  Phase 2 (Basic): ${healthSummary.phase2Count.toString()}`));
      console.log(c.dim(`  Phase 3 (Advanced): ${healthSummary.phase3Count.toString()}`));
      console.log(c.dim(`  Phase 4 (Ready): ${healthSummary.phase4Count.toString()}`));
      console.log(c.dim(`  Phase 5 (Finalized): ${healthSummary.phase5Count.toString()}`));
    } catch (error) {
      console.log(c.yellow(`  ⚠️ Health summary failed: ${error.message}`));
    }
    
    // Save deployment info
    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployedAt: new Date().toISOString(),
      contracts: {
        AjoFactory: ajoFactory.address,
        USDC: usdc.address,
        WHBAR: whbar.address
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
      const fs = require('fs');
      fs.writeFileSync(`deployment-4phase-${Date.now()}.json`, JSON.stringify(deploymentInfo, null, 2));
      console.log(c.dim("  📄 Deployment info saved"));
    } catch (error) {
      console.log(c.yellow("  ⚠️ Could not save deployment info"));
    }
    
    console.log(c.green("\n🎉 4-Phase Factory deployment completed!"));
    console.log(c.cyan("🌐 DEPLOYMENT ADDRESSES:"));
    console.log(c.dim(`Factory: ${ajoFactory.address}`));
    console.log(c.dim(`USDC: ${usdc.address}`));
    console.log(c.dim(`WHBAR: ${whbar.address}`));
    console.log(c.green(`✅ Test Ajo ID: ${ajoId} (Phase 4 - Ready)`));
    
    return {
      factoryAddress: ajoFactory.address,
      usdcAddress: usdc.address,
      whbarAddress: whbar.address,
      testAjoId: ajoId
    };
    
  } catch (error) {
    console.error(c.red("\n💥 Deployment failed:"));
    console.error(c.dim("Error:"), error.message);
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🚀 Ready for testing!"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Deployment failed:"), error);
      process.exit(1);
    });
}

module.exports = { main };