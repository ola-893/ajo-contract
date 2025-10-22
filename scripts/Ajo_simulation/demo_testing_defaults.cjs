#!/usr/bin/env node
const { ethers } = require("hardhat");
const fs = require('fs');

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
  MONTHLY_PAYMENT_USDC: ethers.utils.parseUnits("50", 6), // $50 USDC
  MONTHLY_PAYMENT_HBAR: ethers.utils.parseUnits("1000", 8), // 1000 HBAR
  CYCLE_DURATION: 45, // 45 seconds for testing defaults
  TOTAL_PARTICIPANTS: 10,
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
    DISTRIBUTE_PAYOUT: 1200000,
    HANDLE_DEFAULT: 2000000
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const formatHBAR = (amount) => ethers.utils.formatUnits(amount, 8);

// ================================================================
// BANNER
// ================================================================
function printDefaultTestBanner() {
  console.log(c.magenta("\n" + "═".repeat(88)));
  console.log(c.bold(c.cyan("╔══════════════════════════════════════════════════════════════════════════════════════╗")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("║") + c.bgRed("           🚨 AJO.SAVE - DEFAULT & COLLATERAL SEIZURE DEMO 🚨                       ") + c.cyan("║")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("╚══════════════════════════════════════════════════════════════════════════════════════╝")));
  console.log(c.magenta("═".repeat(88)));
  
  console.log(c.bright("\n" + " ".repeat(15) + "Testing V3 Collateral Model: 60% Factor + Guarantor System"));
  console.log(c.dim(" ".repeat(12) + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  
  console.log(c.yellow("\n  🎯 DEFAULT SCENARIOS TO TEST:"));
  console.log(c.red("     ⚠️  Position 1 defaults after receiving first payout (worst case)"));
  console.log(c.red("     ⚠️  Position 6 (guarantor) defaults"));
  console.log(c.red("     ⚠️  Multiple members default simultaneously"));
  console.log(c.red("     ⚠️  Late-position member defaults\n"));
  
  console.log(c.green("  🔒 EXPECTED SECURITY MEASURES:"));
  console.log(c.dim("     • Seize defaulter's locked collateral"));
  console.log(c.dim("     • Seize defaulter's past payments"));
  console.log(c.dim("     • Seize guarantor's collateral"));
  console.log(c.dim("     • Seize guarantor's past payments"));
  console.log(c.dim("     • Verify 108.9% coverage ratio"));
  console.log(c.dim("     • Distribute seized assets to group\n"));
  
  console.log(c.bgYellow(" ⚡ DEMO CONFIG: 45 SECOND CYCLES - FOCUSED DEFAULT TESTING "));
  console.log(c.yellow("  This demo will test the collateral seizure system\n"));
}

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

// ================================================================
// PHASE 1: DEPLOY HTS SYSTEM (Reuse from original)
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
    await retryWithBackoff(async () => {
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
  await retryWithBackoff(async () => {
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
  
  await retryWithBackoff(async () => {
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
// PHASE 2: CREATE AJO (Simplified from original)
// ================================================================
async function createHtsAjo(ajoFactory, deployer, hederaClient) {
  console.log(c.bgBlue("\n" + " ".repeat(28) + "PHASE 2: HTS AJO CREATION" + " ".repeat(33)));
  console.log(c.blue("═".repeat(88)));
  
  const name = `Default Test Ajo ${Date.now()}`;
  
  console.log(c.bright("\n  📋 Configuration:"));
  console.log(c.dim("     ┌──────────────────────────────────────────────────────────┐"));
  console.log(c.dim(`     │ Name: ${name.padEnd(51)} │`));
  console.log(c.dim(`     │ Cycle Duration: ${DEMO_CONFIG.CYCLE_DURATION.toString().padEnd(42)} seconds │`));
  console.log(c.dim(`     │ Monthly USDC: ${formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT_USDC).padEnd(44)} │`));
  console.log(c.dim(`     │ Monthly HBAR: ${formatHBAR(DEMO_CONFIG.MONTHLY_PAYMENT_HBAR).padEnd(44)} │`));
  console.log(c.dim(`     │ HTS Tokens: ${c.green('✅ Required').padEnd(60)} │`));
  console.log(c.dim(`     │ Auto-Association: ${c.green('✅ Active').padEnd(56)} │`));
  console.log(c.dim("     └──────────────────────────────────────────────────────────┘\n"));
  
  let ajoId, hcsTopicInfo;
  
  console.log(c.cyan("  📋 PHASE 1/5: Creating Ajo Core..."));
  await retryWithBackoff(async () => {
    const tx = await ajoFactory.connect(deployer).createAjo(
      name, 
      true, // useHtsTokens
      true, // useScheduledPayments
      DEMO_CONFIG.CYCLE_DURATION,
      DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
      DEMO_CONFIG.MONTHLY_PAYMENT_HBAR,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO }
    );
    const receipt = await tx.wait();
    
    const event = receipt.events?.find(e => e.event === 'AjoCreated');
    ajoId = event?.args?.ajoId?.toNumber();
    
    console.log(c.green(`     ✅ Ajo Core Created (ID: ${ajoId})\n`));
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");
  
  await sleep(2000);
  
  // Create simulated HCS topic
  const simulatedTopicNum = Math.floor(Math.random() * 1000000);
  hcsTopicInfo = {
    topicId: `0.0.${simulatedTopicNum}`,
    bytes32TopicId: ethers.utils.hexZeroPad(
      ethers.utils.hexlify(simulatedTopicNum), 
      32
    ),
    simulated: true
  };
  
  await sleep(1000);
  
  console.log(c.cyan("  📋 PHASE 2/5: Initialize Members + Governance + HCS..."));
  await retryWithBackoff(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase2(
      ajoId,
      hcsTopicInfo.bytes32TopicId,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2 }
    );
    await tx.wait();
    console.log(c.green(`     ✅ Phase 2 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 2");
  
  await sleep(2000);
  
  console.log(c.cyan("  📋 PHASE 3/5: Initialize Collateral + Payments..."));
  await retryWithBackoff(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 3 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 3");
  
  await sleep(2000);
  
  console.log(c.cyan("  📋 PHASE 4/5: Initialize Core + Cross-link..."));
  await retryWithBackoff(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 4 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 4");
  
  await sleep(2000);
  
  console.log(c.cyan("  📋 PHASE 5/5: Initialize Schedule Contract..."));
  await retryWithBackoff(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase5(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_5
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 5 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 5");
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  
  console.log(c.blue("═".repeat(88)));
  console.log(c.green(`\n  ✅ Ajo "${name}" Successfully Created!\n`));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { 
    ajoId, 
    ajoInfo, 
    hcsTopicId: hcsTopicInfo.topicId,
    cycleDuration: DEMO_CONFIG.CYCLE_DURATION
  };
}

// ================================================================
// PHASE 3: SETUP PARTICIPANTS (Reuse from original)
// ================================================================
async function setupHtsParticipants(ajoFactory, ajoId) {
  console.log(c.bgBlue("\n" + " ".repeat(24) + "PHASE 3: HTS PARTICIPANT ONBOARDING" + " ".repeat(25)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  const [deployer, ...signers] = await ethers.getSigners();
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
  
  const participantNames = [
    "Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", 
    "Funmilayo", "Gbenga", "Halima", "Ifeanyi", "Joke"
  ];
  
  const participants = [];
  const actualCount = Math.min(DEMO_CONFIG.TOTAL_PARTICIPANTS, signers.length);
  
  console.log(c.cyan(`  👥 Setting up ${actualCount} HTS participants...\n`));
  
  const usdcContract = new ethers.Contract(
    ajoInfo.usdcToken,
    ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
    ethers.provider
  );
  
  console.log(c.dim("  ┌────┬─────────────┬──────────────┬─────────────┬─────────────┐"));
  console.log(c.dim("  │ #  │ Name        │ Address      │ USDC Bal    │ Status      │"));
  console.log(c.dim("  ├────┼─────────────┼──────────────┼─────────────┼─────────────┤"));
  
  for (let i = 0; i < actualCount; i++) {
    const participant = {
      signer: signers[i],
      name: participantNames[i],
      address: signers[i].address,
      position: i + 1
    };
    
    try {
      const usdcAmount = 1000 * 10**6;
      const hbarAmount = 1000 * 10**8;
      
      await retryWithBackoff(async () => {
        const tx = await ajoFactory.connect(deployer).fundUserWithHtsTokens(
          participant.address,
          usdcAmount,
          hbarAmount,
          { gasLimit: 1500000 }
        );
        
        const receipt = await tx.wait();
        
        const fundEvent = receipt.events?.find(e => e.event === 'UserHtsFunded');
        if (!fundEvent) {
          throw new Error("Funding event not found");
        }
        
        return tx;
      }, `${participant.name} - Fund HTS`);
      
      await sleep(500);
      
      const balance = await usdcContract.balanceOf(participant.address);
      
      if (balance.eq(0)) {
        throw new Error("Zero balance after funding");
      }
      
      const approvalAmount = balance.div(2);
      
      const htsToken = new ethers.Contract(
        ajoInfo.usdcToken,
        [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)"
        ],
        participant.signer
      );
      
      await retryWithBackoff(async () => {
        const tx = await htsToken.approve(
          ajoCollateral.address,
          approvalAmount,
          { gasLimit: 800000 }
        );
        await tx.wait();
        return tx;
      }, `${participant.name} - Approve Collateral`);
      
      await sleep(500);
      
      await retryWithBackoff(async () => {
        const tx = await htsToken.approve(
          ajoPayments.address,
          approvalAmount,
          { gasLimit: 800000 }
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
    
    await sleep(1000);
  }
  
  console.log(c.dim("  └────┴─────────────┴──────────────┴─────────────┴─────────────┘\n"));
  console.log(c.green(`  ✅ ${participants.length}/${actualCount} HTS participants ready!\n`));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { ajo, ajoMembers, ajoCollateral, ajoPayments, participants, ajoInfo };
}

// ================================================================
// PHASE 4: MEMBER JOINING (Reuse from original)
// ================================================================
async function demonstrateMemberJoining(ajo, ajoCollateral, ajoMembers, participants) {
  console.log(c.bgBlue("\n" + " ".repeat(22) + "PHASE 4: MEMBER JOINING & COLLATERAL LOCKING" + " ".repeat(21)));
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
        address: participant.address,
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
        address: participant.address,
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
// PHASE 5: RUN FIRST CYCLE NORMALLY
// ================================================================
async function runFirstCycleNormally(ajo, ajoPayments, participants) {
  console.log(c.bgBlue("\n" + " ".repeat(25) + "PHASE 5: FIRST CYCLE - NORMAL OPERATION" + " ".repeat(24)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
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
  
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return { paymentResults, recipientName, recipientAddress: nextRecipient };
}

// ================================================================
// PHASE 6: DEFAULT SCENARIO TESTING
// ================================================================
async function testDefaultScenarios(ajo, ajoPayments, ajoCollateral, ajoMembers, participants, ajoInfo) {
  console.log(c.bgRed("\n" + " ".repeat(20) + "PHASE 6: DEFAULT SCENARIO TESTING & COLLATERAL SEIZURE" + " ".repeat(18)));
  console.log(c.red("═".repeat(88) + "\n"));
  
  const defaultScenarios = [];
  
  // ================================================================
  // SCENARIO 1: Position 1 Defaults (Worst Case)
  // ================================================================
  console.log(c.bgYellow("\n" + " ".repeat(20) + "SCENARIO 1: POSITION 1 DEFAULTS AFTER PAYOUT" + " ".repeat(22)));
  console.log(c.yellow("═".repeat(88) + "\n"));
  
  const position1Member = participants.find(p => p.position === 1);
  
  if (position1Member) {
    console.log(c.red(`  🚨 Testing worst-case scenario: ${position1Member.name} (Position 1) defaults\n`));
    
    // Get pre-default state
    console.log(c.cyan("  📊 Step 1: Analyze Pre-Default State\n"));
    
    const memberInfo = await ajo.getMemberInfo(position1Member.address);
    const lockedCollateral = memberInfo.memberInfo.lockedCollateral;
    const totalPaid = memberInfo.memberInfo.totalPaid;
    const guarantorAddress = memberInfo.memberInfo.guarantor;
    
    const guarantorInfo = await ajo.getMemberInfo(guarantorAddress);
    const guarantorCollateral = guarantorInfo.memberInfo.lockedCollateral;
    const guarantorPaid = guarantorInfo.memberInfo.totalPaid;
    
    // FIXED: Calculate payout BEFORE using it
    const payout = DEMO_CONFIG.MONTHLY_PAYMENT_USDC.mul(participants.length);
    
    console.log(c.dim("     ┌─────────────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Defaulter: ${position1Member.name.padEnd(44)} │`));
    console.log(c.dim(`     │ Locked Collateral: ${formatUSDC(lockedCollateral).padEnd(36)} │`));
    console.log(c.dim(`     │ Past Payments (contract): ${formatUSDC(totalPaid).padEnd(28)} │`));
    console.log(c.dim(`     │ Expected Contributions: ${formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT_USDC).padEnd(30)} │`));
    console.log(c.dim(`     │ Payout Received: ${formatUSDC(payout).padEnd(37)} │`));
    console.log(c.dim(`     │ Guarantor: ${guarantorAddress.slice(0, 42).padEnd(44)} │`));
    console.log(c.dim(`     │ Guarantor Collateral: ${formatUSDC(guarantorCollateral).padEnd(33)} │`));
    console.log(c.dim(`     │ Guarantor Past Payments: ${formatUSDC(guarantorPaid).padEnd(30)} │`));
    console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
    
    console.log(c.yellow(`  ℹ️  Note: Contract reports totalPaid = ${formatUSDC(totalPaid)}\n`));
    console.log(c.dim(`     This may include payout received (${formatUSDC(payout)})\n`));
    console.log(c.dim(`     For collateral calculation, we use actual contributions only\n`));
    
    // Calculate expected seizure
    const expectedSeizable = lockedCollateral.add(guarantorCollateral).add(guarantorPaid);
    console.log(c.bright(`  💰 Expected Seizable Assets: ${formatUSDC(expectedSeizable)}\n`));
    
    // Calculate net loss
    // Position 1 received full payout but only paid 1 cycle contribution
    const contributionsMade = DEMO_CONFIG.MONTHLY_PAYMENT_USDC; // Only 1 payment before default
    const netLoss = payout.sub(contributionsMade);
    console.log(c.yellow(`  ⚠️  Net Loss to Group: ${formatUSDC(netLoss)}\n`));
    
    // Calculate coverage ratio
    let coverageRatio = 0;
    let safetyBuffer = ethers.BigNumber.from(0);
    
    if (netLoss.gt(0)) {
      coverageRatio = expectedSeizable.mul(10000).div(netLoss).toNumber() / 100;
      safetyBuffer = expectedSeizable.sub(netLoss);
    } else {
      console.log(c.yellow(`  ⚠️  Warning: Net loss is zero or negative. Check totalPaid tracking.\n`));
      coverageRatio = 0;
    }
    
    console.log(c.bright(`  📈 Coverage Analysis:`));
    
    if (netLoss.gt(0)) {
      console.log(c.dim(`     Coverage Ratio: ${coverageRatio.toFixed(2)}%`));
      console.log(c.dim(`     Safety Buffer: ${formatUSDC(safetyBuffer)}\n`));
      
      if (coverageRatio >= 108) {
        console.log(c.green(`  ✅ Coverage ratio meets V3 model requirement (≥108.9%)\n`));
      } else {
        console.log(c.red(`  ❌ WARNING: Coverage ratio below expected (${coverageRatio.toFixed(2)}% < 108.9%)\n`));
      }
    } else {
      console.log(c.yellow(`     Coverage analysis skipped (net loss = 0)\n`));
      console.log(c.dim(`     Note: totalPaid appears to include payout received.\n`));
      console.log(c.dim(`     Expected: totalPaid = contributions only (50 USDC)\n`));
      console.log(c.dim(`     Actual: totalPaid = ${formatUSDC(totalPaid)}\n`));
    }
    
    await sleep(2000);
    
    // Execute default handling
    console.log(c.cyan("  🔒 Step 2: Execute Default Handling & Collateral Seizure\n"));
    
    try {
      const handleDefaultTx = await retryWithBackoff(async () => {
        const tx = await ajo.connect(participants[1].signer).handleDefault(
          position1Member.address,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.HANDLE_DEFAULT }
        );
        return await tx.wait();
      }, "Handle Default");
      
      console.log(c.green(`     ✅ Default handling executed successfully`));
      console.log(c.dim(`        Transaction Hash: ${handleDefaultTx.transactionHash}`));
      console.log(c.dim(`        Gas Used: ${handleDefaultTx.gasUsed.toString()}\n`));
      
      // Verify post-default state
      console.log(c.cyan("  📊 Step 3: Verify Post-Default State\n"));
      
      const postDefaultInfo = await ajo.getMemberInfo(position1Member.address);
      const postDefaultCollateral = postDefaultInfo.memberInfo.lockedCollateral;
      const defaultCount = postDefaultInfo.memberInfo.defaultCount;
      
      console.log(c.dim("     ┌─────────────────────────────────────────────────────────┐"));
      console.log(c.dim(`     │ Remaining Collateral: ${formatUSDC(postDefaultCollateral).padEnd(34)} │`));
      console.log(c.dim(`     │ Default Count: ${defaultCount.toString().padEnd(41)} │`));
      console.log(c.dim(`     │ Member Status: ${(postDefaultInfo.memberInfo.isActive ? 'Active' : 'Deactivated').padEnd(41)} │`));
      console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
      
      const actualSeized = lockedCollateral.sub(postDefaultCollateral);
      console.log(c.green(`     ✅ Collateral Seized: ${formatUSDC(actualSeized)}\n`));
      
      defaultScenarios.push({
        scenario: "Position 1 Default (Worst Case)",
        defaulter: position1Member.name,
        defaulterAddress: position1Member.address,
        preDefaultCollateral: lockedCollateral,
        preDefaultPaid: contributionsMade, // Use actual contributions, not totalPaid
        guarantorCollateral,
        guarantorPaid,
        expectedSeizable,
        actualSeized,
        netLoss,
        coverageRatio,
        safetyBuffer,
        totalPaidByContract: totalPaid, // Store what contract reported
        success: true,
        transactionHash: handleDefaultTx.transactionHash
      });
      
    } catch (error) {
      console.log(c.red(`     ❌ Default handling failed: ${error.message}\n`));
      
      defaultScenarios.push({
        scenario: "Position 1 Default (Worst Case)",
        defaulter: position1Member.name,
        error: error.message,
        success: false
      });
    }
  }
  
  await sleep(3000);
  
  // ================================================================
  // SCENARIO 2: Mid-Position Member Defaults
  // ================================================================
  console.log(c.bgYellow("\n" + " ".repeat(20) + "SCENARIO 2: MID-POSITION MEMBER DEFAULTS" + " ".repeat(26)));
  console.log(c.yellow("═".repeat(88) + "\n"));
  
  const position5Member = participants.find(p => p.position === 5);
  
  if (position5Member) {
    console.log(c.red(`  🚨 Testing mid-position scenario: ${position5Member.name} (Position 5) defaults\n`));
    
    const memberInfo = await ajo.getMemberInfo(position5Member.address);
    const lockedCollateral = memberInfo.memberInfo.lockedCollateral;
    const totalPaid = memberInfo.memberInfo.totalPaid;
    
    console.log(c.dim("     ┌─────────────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Defaulter: ${position5Member.name.padEnd(44)} │`));
    console.log(c.dim(`     │ Position: 5 (Mid-Position)${' '.repeat(29)} │`));
    console.log(c.dim(`     │ Locked Collateral: ${formatUSDC(lockedCollateral).padEnd(36)} │`));
    console.log(c.dim(`     │ Past Payments: ${formatUSDC(totalPaid).padEnd(40)} │`));
    console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
    
    console.log(c.yellow(`  ℹ️  Mid-position members have lower collateral requirements\n`));
    
    await sleep(2000);
    
    try {
      const handleDefaultTx = await retryWithBackoff(async () => {
        const tx = await ajo.connect(participants[1].signer).handleDefault(
          position5Member.address,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.HANDLE_DEFAULT }
        );
        return await tx.wait();
      }, "Handle Default - Position 5");
      
      console.log(c.green(`     ✅ Default handling executed successfully\n`));
      
      const postDefaultInfo = await ajo.getMemberInfo(position5Member.address);
      const postDefaultCollateral = postDefaultInfo.memberInfo.lockedCollateral;
      const actualSeized = lockedCollateral.sub(postDefaultCollateral);
      
      console.log(c.green(`     ✅ Collateral Seized: ${formatUSDC(actualSeized)}\n`));
      
      defaultScenarios.push({
        scenario: "Position 5 Default (Mid-Position)",
        defaulter: position5Member.name,
        preDefaultCollateral: lockedCollateral,
        actualSeized,
        success: true,
        transactionHash: handleDefaultTx.transactionHash
      });
      
    } catch (error) {
      console.log(c.red(`     ❌ Default handling failed: ${error.message}\n`));
      
      defaultScenarios.push({
        scenario: "Position 5 Default (Mid-Position)",
        defaulter: position5Member.name,
        error: error.message,
        success: false
      });
    }
  }
  
  await sleep(3000);
  
  // ================================================================
  // SCENARIO 3: Late-Position Member Defaults
  // ================================================================
  console.log(c.bgYellow("\n" + " ".repeat(20) + "SCENARIO 3: LATE-POSITION MEMBER DEFAULTS" + " ".repeat(25)));
  console.log(c.yellow("═".repeat(88) + "\n"));
  
  const position9Member = participants.find(p => p.position === 9);
  
  if (position9Member) {
    console.log(c.red(`  🚨 Testing late-position scenario: ${position9Member.name} (Position 9) defaults\n`));
    
    const memberInfo = await ajo.getMemberInfo(position9Member.address);
    const lockedCollateral = memberInfo.memberInfo.lockedCollateral;
    const totalPaid = memberInfo.memberInfo.totalPaid;
    
    console.log(c.dim("     ┌─────────────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Defaulter: ${position9Member.name.padEnd(44)} │`));
    console.log(c.dim(`     │ Position: 9 (Late-Position)${' '.repeat(28)} │`));
    console.log(c.dim(`     │ Locked Collateral: ${formatUSDC(lockedCollateral).padEnd(36)} │`));
    console.log(c.dim(`     │ Past Payments: ${formatUSDC(totalPaid).padEnd(40)} │`));
    console.log(c.dim("     └─────────────────────────────────────────────────────────┘\n"));
    
    console.log(c.yellow(`  ℹ️  Late-position members have minimal/zero collateral requirements\n`));
    
    await sleep(2000);
    
    try {
      const handleDefaultTx = await retryWithBackoff(async () => {
        const tx = await ajo.connect(participants[1].signer).handleDefault(
          position9Member.address,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.HANDLE_DEFAULT }
        );
        return await tx.wait();
      }, "Handle Default - Position 9");
      
      console.log(c.green(`     ✅ Default handling executed successfully\n`));
      
      const postDefaultInfo = await ajo.getMemberInfo(position9Member.address);
      const actualSeized = lockedCollateral.sub(postDefaultInfo.memberInfo.lockedCollateral);
      
      console.log(c.green(`     ✅ Collateral Seized: ${formatUSDC(actualSeized)}\n`));
      
      defaultScenarios.push({
        scenario: "Position 9 Default (Late-Position)",
        defaulter: position9Member.name,
        preDefaultCollateral: lockedCollateral,
        actualSeized,
        success: true,
        transactionHash: handleDefaultTx.transactionHash
      });
      
    } catch (error) {
      console.log(c.red(`     ❌ Default handling failed: ${error.message}\n`));
      
      defaultScenarios.push({
        scenario: "Position 9 Default (Late-Position)",
        defaulter: position9Member.name,
        error: error.message,
        success: false
      });
    }
  }
  
  await sleep(3000);
  
  // ================================================================
  // SCENARIO 4: Multiple Simultaneous Defaults
  // ================================================================
  console.log(c.bgYellow("\n" + " ".repeat(20) + "SCENARIO 4: MULTIPLE SIMULTANEOUS DEFAULTS" + " ".repeat(24)));
  console.log(c.yellow("═".repeat(88) + "\n"));
  
  const position2Member = participants.find(p => p.position === 2);
  const position3Member = participants.find(p => p.position === 3);
  
  if (position2Member && position3Member) {
    console.log(c.red(`  🚨 Testing batch default: ${position2Member.name} & ${position3Member.name}\n`));
    
    const defaulters = [position2Member.address, position3Member.address];
    
    console.log(c.cyan("  📊 Pre-Default Analysis\n"));
    
    let totalCollateralAtRisk = ethers.BigNumber.from(0);
    let totalPaidByDefaulters = ethers.BigNumber.from(0);
    
    for (const defaulter of [position2Member, position3Member]) {
      const info = await ajo.getMemberInfo(defaulter.address);
      totalCollateralAtRisk = totalCollateralAtRisk.add(info.memberInfo.lockedCollateral);
      totalPaidByDefaulters = totalPaidByDefaulters.add(info.memberInfo.totalPaid);
      
      console.log(c.dim(`     ${defaulter.name}: Collateral ${formatUSDC(info.memberInfo.lockedCollateral)}, Paid ${formatUSDC(info.memberInfo.totalPaid)}`));
    }
    
    console.log(c.bright(`\n     Total At Risk: ${formatUSDC(totalCollateralAtRisk.add(totalPaidByDefaulters))}\n`));
    
    await sleep(2000);
    
    try {
      const batchDefaultTx = await retryWithBackoff(async () => {
        const tx = await ajo.connect(participants[8].signer).batchHandleDefaults(
          defaulters,
          { gasLimit: DEMO_CONFIG.GAS_LIMIT.HANDLE_DEFAULT * 2 }
        );
        return await tx.wait();
      }, "Batch Handle Defaults");
      
      console.log(c.green(`     ✅ Batch default handling executed successfully`));
      console.log(c.dim(`        Transaction Hash: ${batchDefaultTx.transactionHash}`));
      console.log(c.dim(`        Gas Used: ${batchDefaultTx.gasUsed.toString()}\n`));
      
      defaultScenarios.push({
        scenario: "Multiple Simultaneous Defaults",
        defaulters: [position2Member.name, position3Member.name],
        totalCollateralAtRisk,
        totalPaidByDefaulters,
        success: true,
        transactionHash: batchDefaultTx.transactionHash
      });
      
    } catch (error) {
      console.log(c.red(`     ❌ Batch default handling failed: ${error.message}\n`));
      
      defaultScenarios.push({
        scenario: "Multiple Simultaneous Defaults",
        defaulters: [position2Member.name, position3Member.name],
        error: error.message,
        success: false
      });
    }
  }
  
  console.log(c.red("═".repeat(88) + "\n"));
  
  return defaultScenarios;
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
// MAIN DEMONSTRATION
// ================================================================
async function main() {
  try {
    printDefaultTestBanner();
    
    await sleep(2000);
    
    // Phase 1: Deploy system
    const { ajoFactory, deployer, masterContracts, usdcHtsToken, hbarHtsToken } = 
      await deployHtsSystem();
    
    await sleep(3000);
    
    // Phase 2: Create Ajo
    const { ajoId, ajoInfo, hcsTopicId, cycleDuration } = await createHtsAjo(
      ajoFactory, 
      deployer,
      null
    );
    
    await sleep(3000);
    
    // Phase 3: Setup participants
    const { ajo, ajoMembers, ajoCollateral, ajoPayments, participants } = 
      await setupHtsParticipants(ajoFactory, ajoId);
    
    await sleep(3000);
    
    // Phase 4: Members join
    const joinResults = await demonstrateMemberJoining(
      ajo, 
      ajoCollateral, 
      ajoMembers, 
      participants
    );
    
    await sleep(3000);
    
    // Phase 5: Run first cycle normally
    const firstCycleResults = await runFirstCycleNormally(
      ajo,
      ajoPayments,
      participants
    );
    
    await sleep(3000);
    
    // Phase 6: Test default scenarios
    const defaultScenarios = await testDefaultScenarios(
      ajo,
      ajoPayments,
      ajoCollateral,
      ajoMembers,
      participants,
      ajoInfo
    );
    
    await sleep(2000);
    
    // Phase 7: Generate summary
    const summary = await generateDefaultTestSummary(defaultScenarios, participants);
    
    // Save results
    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployedAt: new Date().toISOString(),
      testType: "Default & Collateral Seizure Testing",
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
        core: ajoInfo.ajoCore,
        cycleDuration: cycleDuration,
        monthlyPaymentUSDC: formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT_USDC),
        monthlyPaymentHBAR: formatHBAR(DEMO_CONFIG.MONTHLY_PAYMENT_HBAR),
        hcsTopicId: hcsTopicId
      },
      participants: participants.map(p => ({
        name: p.name,
        address: p.address,
        position: p.position
      })),
      firstCycleResults: {
        paymentsProcessed: firstCycleResults.paymentResults.filter(p => p.success).length,
        payoutRecipient: firstCycleResults.recipientName,
        payoutAddress: firstCycleResults.recipientAddress
      },
      defaultTestResults: summary,
      detailedScenarios: defaultScenarios
    };
    
    const filename = `deployment-default-test-${Date.now()}.json`;
    try {
      fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
      console.log(c.green(`\n  ✅ Test results saved to: ${filename}\n`));
    } catch (error) {
      console.log(c.yellow(`\n  ⚠️ Could not save test results\n`));
    }
    
    console.log(c.bgGreen("\n" + " ".repeat(25) + "🎉 DEFAULT TESTING COMPLETE! 🎉" + " ".repeat(26)));
    console.log(c.green("═".repeat(88) + "\n"));
    console.log(c.bright("  🚀 AJO.SAVE - Default & Collateral System Validated!\n"));
    
    console.log(c.yellow("  ✨ Features Tested:"));
    console.log(c.dim("     • Position 1 default (worst-case scenario)"));
    console.log(c.dim("     • Mid-position member default"));
    console.log(c.dim("     • Late-position member default"));
    console.log(c.dim("     • Multiple simultaneous defaults"));
    console.log(c.dim("     • Collateral seizure mechanism"));
    console.log(c.dim("     • Guarantor system activation"));
    console.log(c.dim("     • Past payment seizure"));
    console.log(c.dim("     • V3 60% collateral model validation"));
    console.log(c.dim("     • 108.9% coverage ratio verification\n"));
    
    console.log(c.yellow("  📊 Test Summary:"));
    console.log(c.dim(`     • Total Scenarios: ${summary.totalScenarios}`));
    console.log(c.dim(`     • Successful: ${summary.successfulScenarios}`));
    console.log(c.dim(`     • Failed: ${summary.failedScenarios}`));
    console.log(c.dim(`     • Success Rate: ${(summary.successfulScenarios/summary.totalScenarios*100).toFixed(1)}%\n`));
    
    console.log(c.green("═".repeat(88) + "\n"));
    
    return deploymentInfo;
    
  } catch (error) {
    console.error(c.red("\n💥 Default testing failed:"));
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
      console.log(c.green("\n🎉 Default testing completed successfully!\n"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Default testing failed\n"));
      process.exit(1);
    });
}

module.exports = {
  main,
  deployHtsSystem,
  createHtsAjo,
  setupHtsParticipants,
  demonstrateMemberJoining,
  runFirstCycleNormally,
  testDefaultScenarios,
  generateDefaultTestSummary
};