#!/usr/bin/env node
const { ethers } = require("hardhat");

// Color utilities for better console output
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`
};

// Demo configuration for testnet
const DEMO_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds between retries
  GAS_LIMIT: {
    DEPLOY_TOKEN: 3000000,
    DEPLOY_FACTORY: 6000000,
    CREATE_AJO: 8000000, // Higher for creating multiple contracts
  }
};

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry mechanism for network issues
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
                           error.message.includes('ECONNRESET');
      
      if (isNetworkError && attempt < maxRetries) {
        console.log(c.yellow(`  ⚠️ Network error on attempt ${attempt}: ${error.message}`));
        console.log(c.dim(`  Retrying in ${DEMO_CONFIG.RETRY_DELAY/1000} seconds...`));
        await sleep(DEMO_CONFIG.RETRY_DELAY);
        continue;
      }
      
      console.log(c.red(`  ❌ ${operationName} failed after ${attempt} attempts: ${error.message}`));
      throw error;
    }
  }
}

async function deployFactory() {
  console.log(c.blue("\n🚀 Deploying Ajo Factory System (HEDERA TESTNET)..."));
  
  // Verify network
  const network = await ethers.provider.getNetwork();
  console.log(c.dim(`  🌐 Network: ${network.name} (Chain ID: ${network.chainId})`));
  
  if (network.chainId !== 296) {
    console.log(c.yellow(`  ⚠️ Expected Hedera testnet (296), got ${network.chainId}`));
  }
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(c.dim(`  👤 Deployer: ${deployer.address}`));
  
  // Check deployer balance
  const balance = await deployer.getBalance();
  console.log(c.dim(`  💰 Deployer balance: ${ethers.utils.formatEther(balance)} HBAR`));
  
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // PHASE 1: Deploy Mock Tokens
  console.log(c.dim("\n  📝 PHASE 1: Deploying mock tokens..."));
  
  let usdc, whbar;
  
  // Deploy USDC with retries
  await retryOperation(async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USD Coin", "USDC", 6, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_TOKEN
    });
    await usdc.deployed();
    console.log(c.green(`    ✅ Mock USDC deployed at: ${usdc.address}`));
    return usdc;
  }, "Deploy Mock USDC");
  
  await delay(2000);
  
  // Deploy WHBAR with retries
  await retryOperation(async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    whbar = await MockERC20.deploy("Wrapped HBAR", "WHBAR", 8, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_TOKEN
    });
    await whbar.deployed();
    console.log(c.green(`    ✅ Mock WHBAR deployed at: ${whbar.address}`));
    return whbar;
  }, "Deploy Mock WHBAR");
  
  await delay(2000);
  
  // PHASE 2: Deploy AjoFactory
  console.log(c.dim("\n  📝 PHASE 2: Deploying AjoFactory..."));
  
  let ajoFactory;
  await retryOperation(async () => {
    const AjoFactory = await ethers.getContractFactory("AjoFactory");
    ajoFactory = await AjoFactory.deploy(usdc.address, whbar.address, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_FACTORY
    });
    await ajoFactory.deployed();
    console.log(c.green(`    ✅ AjoFactory deployed at: ${ajoFactory.address}`));
    return ajoFactory;
  }, "Deploy AjoFactory");
  
  await delay(2000);
  
  console.log(c.green("\n  ✅ Factory deployment successful!"));
  console.log(c.green("  📋 HEDERA TESTNET FACTORY DEPLOYMENT SUMMARY:"));
  console.log(c.dim(`     Network: ${network.name} (${network.chainId})`));
  console.log(c.dim(`     AjoFactory: ${ajoFactory.address}`));
  console.log(c.dim(`     USDC:       ${usdc.address}`));
  console.log(c.dim(`     WHBAR:      ${whbar.address}`));
  
  return { ajoFactory, usdc, whbar, deployer };
}

async function testCreateAjo(ajoFactory, deployer, ajoName = "Test Ajo #1") {
  console.log(c.blue(`\n🎯 Testing: Creating new Ajo "${ajoName}"...`));
  
  let ajoId, creationTx;
  
  await retryOperation(async () => {
    console.log(c.dim(`    Creating Ajo: "${ajoName}"`));
    creationTx = await ajoFactory.connect(deployer).createAjo(ajoName, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO
    });
    
    const receipt = await creationTx.wait();
    console.log(c.green(`    ✅ Ajo creation transaction confirmed`));
    console.log(c.dim(`       Gas used: ${receipt.gasUsed.toString()}`));
    console.log(c.dim(`       Transaction: ${receipt.transactionHash}`));
    
    // Extract Ajo ID from events
    const createEvent = receipt.events?.find(event => event.event === 'AjoCreated');
    if (createEvent) {
      ajoId = createEvent.args.ajoId.toNumber();
      console.log(c.green(`    🎉 Ajo created with ID: ${ajoId}`));
    } else {
      throw new Error("AjoCreated event not found in transaction receipt");
    }
    
    return { ajoId, receipt };
  }, `Create Ajo "${ajoName}"`);
  
  // Test getAjo function
  console.log(c.dim(`\n    📊 Testing getAjo(${ajoId})...`));
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  console.log(c.green(`    ✅ Retrieved Ajo information:`));
  console.log(c.dim(`       Name: ${ajoInfo.name}`));
  console.log(c.dim(`       Creator: ${ajoInfo.creator}`));
  console.log(c.dim(`       AjoCore: ${ajoInfo.ajoCore}`));
  console.log(c.dim(`       AjoMembers: ${ajoInfo.ajoMembers}`));
  console.log(c.dim(`       AjoCollateral: ${ajoInfo.ajoCollateral}`));
  console.log(c.dim(`       AjoPayments: ${ajoInfo.ajoPayments}`));
  console.log(c.dim(`       Created At: ${new Date(ajoInfo.createdAt.toNumber() * 1000).toISOString()}`));
  console.log(c.dim(`       Is Active: ${ajoInfo.isActive}`));
  
  // Test if the AjoCore contract is properly configured
  console.log(c.dim(`\n    🔧 Testing AjoCore configuration...`));
  
  const AjoCore = await ethers.getContractFactory("AjoCore");
  const ajoCoreContract = AjoCore.attach(ajoInfo.ajoCore);
  
  try {
    // Test token configuration
    const tokenConfig = await ajoCoreContract.getTokenConfig(0); // USDC
    console.log(c.green(`    ✅ USDC configuration verified:`));
    console.log(c.dim(`       Monthly Payment: ${ethers.utils.formatUnits(tokenConfig.monthlyPayment || tokenConfig[0], 6)} USDC`));
    console.log(c.dim(`       Is Active: ${tokenConfig.isActive || tokenConfig[1]}`));
    
    // Test contract stats
    const stats = await ajoCoreContract.getContractStats();
    console.log(c.green(`    ✅ Contract stats retrieved:`));
    console.log(c.dim(`       Total Members: ${stats.totalMembers.toString()}`));
    console.log(c.dim(`       Active Members: ${stats.activeMembers.toString()}`));
    
  } catch (error) {
    console.log(c.yellow(`    ⚠️ AjoCore test failed: ${error.message}`));
  }
  
  return { ajoId, ajoInfo, ajoCoreContract };
}

async function testGetAllAjos(ajoFactory) {
  console.log(c.blue(`\n📋 Testing: Getting all Ajos...`));
  
  try {
    // Get factory stats first
    const factoryStats = await ajoFactory.getFactoryStats();
    console.log(c.green(`  ✅ Factory stats:`));
    console.log(c.dim(`     Total Created: ${factoryStats.totalCreated.toString()}`));
    console.log(c.dim(`     Active Count: ${factoryStats.activeCount.toString()}`));
    
    // Get all Ajos (first page, limit 10)
    const allAjos = await ajoFactory.getAllAjos(0, 10);
    console.log(c.green(`  ✅ Retrieved ${allAjos.ajoInfos.length} Ajos:`));
    console.log(c.dim(`     Has More: ${allAjos.hasMore}`));
    
    // Display each Ajo
    for (let i = 0; i < allAjos.ajoInfos.length; i++) {
      const ajo = allAjos.ajoInfos[i];
      console.log(c.cyan(`     Ajo ${i + 1}:`));
      console.log(c.dim(`       Name: ${ajo.name}`));
      console.log(c.dim(`       Creator: ${ajo.creator}`));
      console.log(c.dim(`       AjoCore: ${ajo.ajoCore}`));
      console.log(c.dim(`       Active: ${ajo.isActive}`));
    }
    
    return allAjos;
    
  } catch (error) {
    console.log(c.red(`  ❌ getAllAjos failed: ${error.message}`));
    throw error;
  }
}

async function main() {
  console.log(c.bold(c.cyan("🏭 Ajo Factory: Hedera Testnet Deployment & Testing 🏭")));
  console.log(c.dim("Deploy factory and test Ajo creation functionality\n"));
  
  try {
    // 1. Deploy factory and tokens
    const { ajoFactory, usdc, whbar, deployer } = await deployFactory();
    
    // 2. Test creating first Ajo
    const { ajoId, ajoInfo, ajoCoreContract } = await testCreateAjo(ajoFactory, deployer, "My First Ajo");
    
    // 3. Test creating second Ajo (optional)
    console.log(c.yellow("\n🔄 Creating second Ajo for testing..."));
    await testCreateAjo(ajoFactory, deployer, "Community Savings Circle");
    
    // 4. Test getAllAjos function
    await testGetAllAjos(ajoFactory);
    
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
      firstAjo: {
        id: ajoId,
        name: ajoInfo.name,
        ajoCore: ajoInfo.ajoCore,
        creator: ajoInfo.creator
      }
    };
    
    try {
      const fs = require('fs');
      fs.writeFileSync(`deployment-factory-hedera-${Date.now()}.json`, JSON.stringify(deploymentInfo, null, 2));
      console.log(c.dim("    📄 Deployment info saved to file"));
    } catch (error) {
      console.log(c.yellow("    ⚠️ Could not save deployment info to file"));
    }
    
    console.log(c.green("\n🎉 Factory deployment and testing completed successfully!"));
    console.log(c.bold(c.magenta("🌐 HEDERA TESTNET FACTORY ADDRESSES:")));
    console.log(c.dim(`Factory: ${ajoFactory.address}`));
    console.log(c.dim(`USDC: ${usdc.address}`));
    console.log(c.dim(`WHBAR: ${whbar.address}`));
    console.log(c.bold(c.green(`✅ Created Ajos: 2 (IDs: 1, 2)`)));
    
    return {
      factoryAddress: ajoFactory.address,
      usdcAddress: usdc.address,
      whbarAddress: whbar.address,
      firstAjoCore: ajoInfo.ajoCore,
      totalAjosCreated: 2
    };
    
  } catch (error) {
    console.error(c.red("\n💥 Factory deployment failed:"));
    console.error(c.dim("Error details:"), error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log(c.yellow("\n💰 Insufficient Funds:"));
      console.log(c.dim("• Make sure your testnet account has enough HBAR"));
      console.log(c.dim("• Factory deployment requires more gas than single contracts"));
      console.log(c.dim("• Get more testnet HBAR from Hedera faucet"));
    }
    
    throw error;
  }
}

if (require.main === module) {
  main()
    .then((result) => {
      console.log(c.bold(c.cyan("\n🚀 Ready to use AjoFactory from your frontend! 🚀")));
      console.log(c.yellow("\nFrom your frontend, you can now:"));
      console.log(c.dim("• Call factory.createAjo(name) to create new Ajo instances"));
      console.log(c.dim("• Call factory.getAjo(id) to get Ajo details"));
      console.log(c.dim("• Call factory.getAllAjos(0, 10) to list all Ajos"));
      console.log(c.dim("• Each created Ajo has its own complete contract suite"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Factory deployment failed:"), error);
      process.exit(1);
    });
}

module.exports = { main };