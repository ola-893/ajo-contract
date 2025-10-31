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

async function main() {
  console.log(c.cyan("🏭 4-Phase AjoFactory: Deployment with Enhanced Diagnostics 🏭\n"));
  
  try {
    // Deploy factory and components
    const { ajoFactory, usdc, whbar, deployer, masterContracts } = await deployFactory();
    
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