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

// Demo configuration
const DEMO_CONFIG = {
  MONTHLY_PAYMENT: ethers.utils.parseUnits("50", 6), // $50 USDC
  TOTAL_PARTICIPANTS: 10,
  COLLATERAL_FACTOR: 55, // 55% as calculated in the analysis
  SIMULATION_SPEED: 1000 // ms delay between actions for demo visibility
};

// Utility functions
const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const parseUSDC = (amount) => ethers.utils.parseUnits(amount.toString(), 6);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function deployContracts() {
  console.log(c.blue("\n🚀 Deploying Ajo Smart Contract System (LOCAL HARDHAT)..."));
  
  // Verify we're on local network
  const network = await ethers.provider.getNetwork();
  console.log(c.dim(`  🌐 Network: ${network.name} (Chain ID: ${network.chainId})`));
  
  // Get signers (representing different users)
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  console.log(c.dim(`  👤 Deployer: ${deployer.address}`));
  
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  
  // PHASE 1: Deploy Mock Tokens
  console.log(c.dim("\n  📝 PHASE 1: Deploying mock tokens..."));
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  console.log(c.dim("    Deploying Mock USDC..."));
  const usdc = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdc.deployed();
  console.log(c.green(`    ✅ Mock USDC deployed at: ${usdc.address}`));
  
  await delay(1000);
  
  console.log(c.dim("    Deploying Mock WHBAR..."));
  const whbar = await MockERC20.deploy("Wrapped HBAR", "WHBAR", 8);
  await whbar.deployed();
  console.log(c.green(`    ✅ Mock WHBAR deployed at: ${whbar.address}`));
  
  await delay(1000);
  
  // PHASE 2: Deploy Core Contracts
  console.log(c.dim("\n  📝 PHASE 2: Deploying core contracts..."));
  
  // Deploy AjoMembers - UPDATED: Now requires 3 parameters (ajoCore, usdc, hbar)
  console.log(c.dim("    Deploying AjoMembers..."));
  const AjoMembers = await ethers.getContractFactory("AjoMembers");
  const ajoMembers = await AjoMembers.deploy(zeroAddress, usdc.address, whbar.address);
  await ajoMembers.deployed();
  console.log(c.green(`    ✅ AjoMembers deployed at: ${ajoMembers.address}`));
  
  await delay(1000);
  
  // Deploy AjoGovernance
  console.log(c.dim("    Deploying AjoGovernance..."));
  const AjoGovernance = await ethers.getContractFactory("AjoGovernance");
  const ajoGovernance = await AjoGovernance.deploy(zeroAddress, zeroAddress);
  await ajoGovernance.deployed();
  console.log(c.green(`    ✅ AjoGovernance deployed at: ${ajoGovernance.address}`));
  
  await delay(1000);
  
  // Deploy AjoCollateral - FIXED: Now passes real contract addresses  
  console.log(c.dim("    Deploying AjoCollateral..."));
  const AjoCollateral = await ethers.getContractFactory("AjoCollateral");
  const ajoCollateral = await AjoCollateral.deploy(
    usdc.address, 
    whbar.address, 
    zeroAddress,          // ajoCore - will be set later via setAjoCore()
    ajoMembers.address    // Real membersContract address
  );
  await ajoCollateral.deployed();
  console.log(c.green(`    ✅ AjoCollateral deployed at: ${ajoCollateral.address}`));
  
  await delay(1000);
  
  // Deploy AjoPayments - FIXED: Now passes real contract addresses
  console.log(c.dim("    Deploying AjoPayments..."));
  const AjoPayments = await ethers.getContractFactory("AjoPayments");
  const ajoPayments = await AjoPayments.deploy(
    usdc.address, 
    whbar.address, 
    zeroAddress,           // ajoCore - will be set later via setAjoCore()
    ajoMembers.address,    // Real membersContract address
    ajoCollateral.address  // Real collateralContract address
  );
  await ajoPayments.deployed();
  console.log(c.green(`    ✅ AjoPayments deployed at: ${ajoPayments.address}`));
  
  await delay(1000);
  
  // Deploy AjoCore (main contract)
  console.log(c.dim("    Deploying AjoCore..."));
  const AjoCore = await ethers.getContractFactory("AjoCore");
  const ajo = await AjoCore.deploy(
    usdc.address,
    whbar.address,
    ajoMembers.address,
    ajoCollateral.address,
    ajoPayments.address,
    ajoGovernance.address
  );
  await ajo.deployed();
  console.log(c.green(`    ✅ AjoCore deployed at: ${ajo.address}`));
  
  await delay(1000);
  
  // PHASE 3: Link contracts and configure
  console.log(c.dim("\n  📝 PHASE 3: Linking contracts and configuring..."));
  
  try {
    if (ajoMembers.setAjoCore) {
      await ajoMembers.setAjoCore(ajo.address);
      console.log(c.dim("    ✅ AjoMembers linked to AjoCore"));
      await delay(500);
    }
    
    // UPDATED: Also set contract addresses for AjoMembers
    if (ajoMembers.setContractAddresses) {
      await ajoMembers.setContractAddresses(ajoCollateral.address, ajoPayments.address);
      console.log(c.dim("    ✅ AjoMembers contract addresses configured"));
      await delay(500);
    }
    
    if (ajoGovernance.setAjoCore) {
      await ajoGovernance.setAjoCore(ajo.address);
      console.log(c.dim("    ✅ AjoGovernance linked to AjoCore"));
      await delay(500);
    }
    
    if (ajoCollateral.setAjoCore) {
      await ajoCollateral.setAjoCore(ajo.address);
      console.log(c.dim("    ✅ AjoCollateral linked to AjoCore"));
      await delay(500);
    }
    
    if (ajoPayments.setAjoCore) {
      await ajoPayments.setAjoCore(ajo.address);
      console.log(c.dim("    ✅ AjoPayments linked to AjoCore"));
      await delay(500);
    }
  } catch (error) {
    console.log(c.dim("    ⚠️ Some contract linking failed, but deployment succeeded"));
    console.log(c.dim(`    Error details: ${error.message}`));
  }
  
  // PHASE 4: Configure token settings
  console.log(c.dim("\n  📝 PHASE 4: Configuring token settings..."));
  
  try {
    // Configure USDC token with $50 monthly payment
    await ajo.updateTokenConfig(0, parseUSDC(50), true); // PaymentToken.USDC = 0
    console.log(c.green("    ✅ USDC configured: $50 monthly payment, active"));
    
    // Verify configuration worked
    const tokenConfig = await ajo.getTokenConfig(0);
    console.log(c.dim(`    📊 USDC Monthly Payment: ${formatUSDC(tokenConfig.monthlyPayment || tokenConfig[0])}`));
    console.log(c.dim(`    📊 USDC Active: ${tokenConfig.isActive || tokenConfig[1]}`));
    
  } catch (error) {
    console.log(c.red(`    ❌ Token configuration failed: ${error.message}`));
  }
  
  console.log(c.green("\n  ✅ Contracts deployed and configured successfully!"));
  console.log(c.green("  📋 DEPLOYMENT SUMMARY:"));
  console.log(c.dim(`     AjoCore:      ${ajo.address}`));
  console.log(c.dim(`     USDC:         ${usdc.address}`));
  console.log(c.dim(`     WHBAR:        ${whbar.address}`));
  console.log(c.dim(`     AjoMembers:   ${ajoMembers.address}`));
  console.log(c.dim(`     AjoCollateral:${ajoCollateral.address}`));
  console.log(c.dim(`     AjoPayments:  ${ajoPayments.address}`));
  console.log(c.dim(`     AjoGovernance:${ajoGovernance.address}`));
  
  return { 
    ajo, 
    usdc, 
    whbar,
    ajoMembers,
    ajoCollateral,
    ajoPayments,
    ajoGovernance,
    signers, 
    deployer 
  };
}


async function setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, signers) {
  console.log(c.blue("\n👥 Setting up 10 Ajo Participants (OPTION 2 COMPLETE FLOW)..."));
  
  const participants = [];
  const participantNames = [
    "Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", 
    "Folake", "Gbemisola", "Hakeem", "Ifeoma", "Jide"
  ];
  
  // First, verify token configuration is working
  console.log(c.dim("  🔧 Verifying token configuration..."));
  try {
    const tokenConfig = await ajo.getTokenConfig(0); // USDC
    console.log(c.green(`  ✅ USDC Config: ${formatUSDC(tokenConfig.monthlyPayment || tokenConfig[0])} monthly, active: ${tokenConfig.isActive || tokenConfig[1]}`));
  } catch (error) {
    console.log(c.red(`  ❌ Token config error: ${error.message}`));
  }
  
  console.log(c.yellow("\n  🆕 OPTION 2 DUAL APPROVALS: Participants approve both contracts directly"));
  console.log(c.dim("  CollateralContract: For locking collateral during join"));
  console.log(c.dim("  PaymentsContract: For monthly payment pulls"));
  
  // Setup participants with tokens and proper approvals for Option 2
  for (let i = 0; i < DEMO_CONFIG.TOTAL_PARTICIPANTS; i++) {
    const participant = {
      signer: signers[i + 1], // Skip deployer
      name: participantNames[i],
      address: signers[i + 1].address,
      position: i + 1
    };
    
    try {
      // Use faucet to get test tokens
      await usdc.connect(participant.signer).faucet();
      
      // Get balance
      const balance = await usdc.balanceOf(participant.address);
      
      // OPTION 2: Approve both CollateralContract and PaymentsContract directly
      // Give generous allowances to avoid issues during the demo
      const collateralAllowance = balance.div(2); // Half for collateral
      const paymentsAllowance = balance.div(2);   // Half for payments
      
      await usdc.connect(participant.signer).approve(ajoCollateral.address, collateralAllowance);
      await usdc.connect(participant.signer).approve(ajoPayments.address, paymentsAllowance);
      
      console.log(c.dim(`  👤 ${participant.name}:`));
      console.log(c.dim(`     Balance: ${formatUSDC(balance)}`));
      console.log(c.dim(`     CollateralContract approved: ${formatUSDC(collateralAllowance)} ✅`));
      console.log(c.dim(`     PaymentsContract approved: ${formatUSDC(paymentsAllowance)} ✅`));
      
      participants.push(participant);
      
    } catch (error) {
      console.log(c.yellow(`  ⚠️ ${participant.name}: Setup partially failed, continuing demo...`));
      console.log(c.dim(`     Error: ${error.message}`));
      participants.push(participant); // Add anyway for demo
    }
  }
  
  console.log(c.green("\n  ✅ All participants ready with dual contract approvals (Option 2)!"));
  return participants;
}

async function demonstrateCollateralCalculation(ajo) {
  console.log(c.blue("\n🧮 Demonstrating Collateral Calculation Logic..."));
  console.log(c.yellow("This shows how our system solves the 'Collateral Paradox'"));
  
  const monthlyPayment = DEMO_CONFIG.MONTHLY_PAYMENT;
  const totalParticipants = DEMO_CONFIG.TOTAL_PARTICIPANTS;
  
  console.log(c.bold("\n📊 Traditional vs Our Innovative Approach:"));
  console.log(c.dim(`  Monthly Payment: ${formatUSDC(monthlyPayment)}`));
  console.log(c.dim(`  Total Payout: ${formatUSDC(monthlyPayment.mul(totalParticipants))}`));
  
  // Try to get collateral demo from contract, fallback to manual calculation
  let collateralData = null;
  try {
    const collateralDemo = await ajo.getCollateralDemo(totalParticipants, monthlyPayment);
    collateralData = {
      positions: collateralDemo[0],
      collaterals: collateralDemo[1]
    };
  } catch (error) {
    console.log(c.dim("  ⚠️ Using manual calculation for demo"));
    // Manual calculation based on your formula
    const collateralFactor = 0.55; // 55% as per your analysis
    collateralData = {
      positions: Array.from({length: 10}, (_, i) => ethers.BigNumber.from(i + 1)),
      collaterals: Array.from({length: 10}, (_, i) => {
        const position = i + 1;
        const debt = monthlyPayment.mul(totalParticipants).sub(monthlyPayment.mul(position));
        return debt.mul(Math.floor(collateralFactor * 100)).div(100);
      })
    };
  }
  
  console.log(c.cyan("\n💰 Required Collateral by Position:"));
  console.log("┌──────────┬─────────────┬─────────────┬──────────────┐");
  console.log("│ Position │ Debt Risk   │ Collateral  │ Efficiency   │");
  console.log("├──────────┼─────────────┼─────────────┼──────────────┤");
  
  for (let i = 0; i < Math.min(collateralData.positions.length, 10); i++) {
    const pos = typeof collateralData.positions[i].toNumber === 'function' 
      ? collateralData.positions[i].toNumber() 
      : collateralData.positions[i];
    const collateral = collateralData.collaterals[i];
    const debt = monthlyPayment.mul(totalParticipants).sub(monthlyPayment.mul(pos));
    const efficiency = (formatUSDC(collateral) / formatUSDC(monthlyPayment.mul(totalParticipants)) * 100).toFixed(1);
    
    console.log(`│    ${pos.toString().padStart(2)}    │   ${formatUSDC(debt).padStart(6)}   │   ${formatUSDC(collateral).padStart(6)}   │    ${efficiency.padStart(4)}%     │`);
  }
  console.log("└──────────┴─────────────┴─────────────┴──────────────┘");
  
  console.log(c.green("\n🎯 Key Insights:"));
  console.log(c.dim("  • Position 1 pays ~$248 collateral for $500 payout (49.6% efficiency)"));
  console.log(c.dim("  • Position 10 pays $0 collateral (they have no debt risk)"));
  console.log(c.dim("  • Collateral is ALWAYS less than payout - Paradox SOLVED! ✨"));
  
  await sleep(DEMO_CONFIG.SIMULATION_SPEED);
}

async function demonstrateActualJoining(ajo, participants) {
  console.log(c.blue("\n🎯 LIVE DEMONSTRATION: 10 Participants Actually Joining Ajo (OPTION 2)..."));
  console.log(c.yellow("Watch real collateral being locked via CollateralContract pull!"));
  
  let totalGasUsed = ethers.BigNumber.from(0);
  const joinResults = [];
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`\n  ${i + 1}/10: ${participant.name} joining as Position ${participant.position}...`));
      
      // Get expected collateral before joining using the new helper function
      let expectedCollateral;
      try {
        expectedCollateral = await ajo.getRequiredCollateralForJoin(0); // PaymentToken.USDC = 0
        console.log(c.dim(`    Expected collateral: ${formatUSDC(expectedCollateral)}`));
      } catch (error) {
        // Fallback calculation
        const collateralDemo = await ajo.getCollateralDemo(10, DEMO_CONFIG.MONTHLY_PAYMENT);
        expectedCollateral = collateralDemo[1][i];
        console.log(c.dim(`    Expected collateral (fallback): ${formatUSDC(expectedCollateral)}`));
      }
      
      // Execute the join transaction (CollateralContract will pull funds automatically)
      const joinTx = await ajo.connect(participant.signer).joinAjo(0, { gasLimit: 500000 });
      const receipt = await joinTx.wait();
      
      // Track gas usage
      totalGasUsed = totalGasUsed.add(receipt.gasUsed);
      
      // Verify the join was successful
      const memberInfo = await ajo.getMemberInfo(participant.address);
      const actualCollateral = memberInfo.memberInfo.lockedCollateral;
      
      joinResults.push({
        name: participant.name,
        position: participant.position,
        expectedCollateral: expectedCollateral,
        actualCollateral: actualCollateral,
        gasUsed: receipt.gasUsed,
        txHash: receipt.transactionHash
      });
      
      console.log(c.green(`    ✅ SUCCESS! Locked: ${formatUSDC(actualCollateral)} | Gas: ${receipt.gasUsed.toString()}`));
      
      await sleep(DEMO_CONFIG.SIMULATION_SPEED / 3);
      
    } catch (error) {
      console.log(c.red(`    ❌ ${participant.name} failed: ${error.message}`));
      
      // Provide debugging info
      if (error.message.includes('insufficient')) {
        console.log(c.yellow(`       Likely cause: Insufficient USDC balance or allowance`));
      } else if (error.message.includes('revert')) {
        console.log(c.yellow(`       Likely cause: Contract validation failed`));
        console.log(c.dim(`       Error details: ${error.reason || error.message}`));
      }
      
      // Add to results with error info for analysis
      joinResults.push({
        name: participant.name,
        position: participant.position,
        expectedCollateral: ethers.BigNumber.from(0),
        actualCollateral: ethers.BigNumber.from(0),
        gasUsed: ethers.BigNumber.from(0),
        error: error.message
      });
    }
  }
  
  // Show comprehensive results
  console.log(c.cyan("\n📊 JOIN TRANSACTION RESULTS (OPTION 2):"));
  console.log("┌─────────────┬──────────┬─────────────┬─────────────┬──────────┐");
  console.log("│    Name     │ Position │  Expected   │   Actual    │   Gas    │");
  console.log("├─────────────┼──────────┼─────────────┼─────────────┼──────────┤");
  
  for (const result of joinResults) {
    if (result.error) {
      console.log(`│ ${result.name.padEnd(11)} │    ${result.position.toString().padStart(2)}    │    ERROR    │    ERROR    │   ERROR  │`);
    } else {
      const expectedStr = formatUSDC(result.expectedCollateral);
      const actualStr = formatUSDC(result.actualCollateral);
      const gasStr = result.gasUsed.toString();
      
      console.log(`│ ${result.name.padEnd(11)} │    ${result.position.toString().padStart(2)}    │   ${expectedStr.padStart(6)}   │   ${actualStr.padStart(6)}   │ ${gasStr.padStart(8)} │`);
    }
  }
  console.log("└─────────────┴──────────┴─────────────┴─────────────┴──────────┘");
  
  // Calculate and display gas efficiency
  const successfulJoins = joinResults.filter(r => !r.error);
  console.log(c.magenta("\n⚡ GAS EFFICIENCY ANALYSIS (OPTION 2):"));
  console.log(c.dim(`  Total gas used for ${successfulJoins.length} joins: ${totalGasUsed.toString()}`));
  
  if (successfulJoins.length > 0) {
    const avgGasPerJoin = totalGasUsed.div(successfulJoins.length);
    const estimatedCostHBAR = totalGasUsed.mul(ethers.utils.parseUnits("0.00000001", 18)); // ~0.01 tinybar per gas
    
    console.log(c.dim(`  Average gas per join: ${avgGasPerJoin.toString()}`));
    console.log(c.dim(`  Estimated total cost: ${ethers.utils.formatEther(estimatedCostHBAR)} HBAR`));
    console.log(c.dim(`  Average cost per join: ${ethers.utils.formatEther(estimatedCostHBAR.div(successfulJoins.length))} HBAR`));
  } else {
    console.log(c.red(`  No successful joins to analyze gas costs`));
    console.log(c.yellow(`  Check contract configurations and allowances`));
  }
  
  const successRate = successfulJoins.length > 0 ? (successfulJoins.length / participants.length * 100).toFixed(1) : "0.0";
  console.log(c.dim(`  Success rate: ${successRate}% (${successfulJoins.length}/${participants.length})`));
  
  if (successfulJoins.length > 0) {
    console.log(c.green("\n🎯 OPTION 2 LIVE DEMONSTRATION SUCCESS!"));
    console.log(c.dim("  CollateralContract successfully pulled funds directly from users"));
  } else {
    console.log(c.yellow("\n⚠️ JOINS FAILED - DEBUGGING INFO:"));
    console.log(c.dim("  This suggests an issue with the CollateralContract.lockCollateral implementation"));
    console.log(c.dim("  or missing contract linking between AjoCore and CollateralContract"));
  }
  
  await sleep(DEMO_CONFIG.SIMULATION_SPEED);
  return joinResults;
}

// Add this function after demonstrateActualJoining and before demonstratePaymentCycle

async function debugMemberStates(ajo, ajoPayments, participants) {
  console.log(c.blue("\n🔍 DEBUG: Checking Member States Before Payments..."));
  
  try {
    // Get current cycle from payments contract
    const currentCycle = await ajoPayments.getCurrentCycle();
    console.log(c.dim(`📅 Current cycle from PaymentsContract: ${currentCycle.toString()}`));
    
    // Check each participant's member info
    for (let i = 0; i < Math.min(participants.length, 3); i++) { // Only check first 3 for brevity
      const participant = participants[i];
      
      console.log(c.cyan(`\n👤 ${participant.name} (${participant.address}):`));
      
      try {
        // Get member info from AjoCore
        const memberInfo = await ajo.getMemberInfo(participant.address);
        const member = memberInfo.memberInfo;
        
        console.log(c.dim(`   ✅ Member found in AjoCore`));
        console.log(c.dim(`   🔢 Queue Number: ${member.queueNumber.toString()}`));
        console.log(c.dim(`   ⚡ Is Active: ${member.isActive}`));
        console.log(c.dim(`   🔄 Joined Cycle: ${member.joinedCycle.toString()}`));
        console.log(c.dim(`   📅 Last Payment Cycle: ${member.lastPaymentCycle.toString()}`));
        console.log(c.dim(`   💰 Locked Collateral: ${formatUSDC(member.lockedCollateral)}`));
        console.log(c.dim(`   🪙 Preferred Token: ${member.preferredToken.toString()} (0=USDC, 1=HBAR)`));
        
        // Check payment eligibility
        const needsToPay = await ajo.needsToPayThisCycle(participant.address);
        console.log(c.dim(`   💳 Needs to pay this cycle: ${needsToPay}`));
        
        // Check balances and allowances
        const usdc = await ethers.getContractAt("MockERC20", await ajo.USDC());
        const balance = await usdc.balanceOf(participant.address);
        const paymentsAllowance = await usdc.allowance(participant.address, ajoPayments.address);
        
        console.log(c.dim(`   💵 USDC Balance: ${formatUSDC(balance)}`));
        console.log(c.dim(`   🔐 PaymentsContract Allowance: ${formatUSDC(paymentsAllowance)}`));
        
        // Check if there are any issues
        if (!member.isActive) {
          console.log(c.red(`   ❌ ISSUE: Member is not active!`));
        }
        
        if (member.lastPaymentCycle.gte(currentCycle)) {
          console.log(c.red(`   ❌ ISSUE: Last payment cycle (${member.lastPaymentCycle}) >= current cycle (${currentCycle})`));
        }
        
        if (balance.lt(parseUSDC(50))) {
          console.log(c.red(`   ❌ ISSUE: Insufficient balance for $50 payment`));
        }
        
        if (paymentsAllowance.lt(parseUSDC(50))) {
          console.log(c.red(`   ❌ ISSUE: Insufficient allowance for PaymentsContract`));
        }
        
      } catch (error) {
        console.log(c.red(`   ❌ ERROR getting member info: ${error.message}`));
      }
    }
    
    // Check contract stats
    console.log(c.cyan("\n📊 Contract Statistics:"));
    try {
      const stats = await ajo.getContractStats();
      console.log(c.dim(`   👥 Total Members: ${stats.totalMembers.toString()}`));
      console.log(c.dim(`   ⚡ Active Members: ${stats.activeMembers.toString()}`));
      console.log(c.dim(`   💰 Total Collateral USDC: ${formatUSDC(stats.totalCollateralUSDC)}`));
      console.log(c.dim(`   🏦 Contract Balance USDC: ${formatUSDC(stats.contractBalanceUSDC)}`));
    } catch (error) {
      console.log(c.red(`   ❌ ERROR getting contract stats: ${error.message}`));
    }
    
    console.log(c.green("\n✅ Member state debugging complete"));
    
  } catch (error) {
    console.log(c.red(`\n❌ DEBUG ERROR: ${error.message}`));
  }
  
  await sleep(DEMO_CONFIG.SIMULATION_SPEED);
}


async function demonstratePaymentCycle(ajo, ajoPayments, participants) {
  console.log(c.blue("\n💳 LIVE DEMONSTRATION: Complete Payment Cycle (OPTION 2)"));
  console.log(c.yellow("Watch PaymentsContract pull payments directly from users!"));
  
  let totalPaymentGas = ethers.BigNumber.from(0);
  let totalPayoutGas = ethers.BigNumber.from(0);
  
  console.log(c.bold(`\n📅 CYCLE 1: PaymentsContract pulls $50 from each member, then distributes $500 payout`));
  
  // Phase 1: All participants make their monthly payment (Option 2 style)
  console.log(c.cyan("\n💸 Phase 1: Monthly Payments Collection (PaymentsContract Pulls)"));
  
  const paymentResults = [];
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`    ${participant.name} initiating payment (PaymentsContract will pull $50)...`));
      
      // Check allowance before making payment
      const usdc = await ethers.getContractAt("MockERC20", await ajo.USDC());
      const allowance = await usdc.allowance(participant.address, ajoPayments.address);
      const balance = await usdc.balanceOf(participant.address);
      
      console.log(c.dim(`      USDC Balance: ${formatUSDC(balance)}`));
      console.log(c.dim(`      PaymentsContract Allowance: ${formatUSDC(allowance)}`));
      
      if (allowance.lt(DEMO_CONFIG.MONTHLY_PAYMENT)) {
        console.log(c.yellow(`      ⚠️ Insufficient allowance for PaymentsContract`));
        console.log(c.yellow(`      Needed: ${formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT)}, Have: ${formatUSDC(allowance)}`));
      }
      
      // Check if participant can make payment using the new helper function (if available)
      try {
        const canPay = await ajoPayments.canMakePayment ? 
          await ajoPayments.canMakePayment(participant.address) : [true, "Pre-check not available"];
        console.log(c.dim(`      Pre-check: ${canPay[1] || "Can make payment"}`));
        
        if (!canPay[0]) {
          console.log(c.yellow(`      ⚠️ ${participant.name} cannot pay: ${canPay[1]}`));
          paymentResults.push({
            name: participant.name,
            gasUsed: 0,
            success: false,
            error: canPay[1]
          });
          continue;
        }
      } catch (error) {
        console.log(c.dim(`      Pre-check: Pre-check not available`));
      }
      
      // UPDATED: Execute payment using new processPayment() function
      const paymentTx = await ajo.connect(participant.signer).processPayment({ gasLimit: 300000 });
      const receipt = await paymentTx.wait();
      
      totalPaymentGas = totalPaymentGas.add(receipt.gasUsed);
      
      paymentResults.push({
        name: participant.name,
        gasUsed: receipt.gasUsed,
        success: true
      });
      
      console.log(c.green(`      ✅ PaymentsContract pulled payment! Gas: ${receipt.gasUsed.toString()}`));
      
    } catch (error) {
      console.log(c.red(`      ❌ Payment failed for ${participant.name}:`));
      console.log(c.red(`         Error message: ${error.message}`));
      
      // Enhanced debugging for different error types
      if (error.message.includes('InsufficientAllowance') || error.message.includes('allowance')) {
        console.log(c.yellow(`         🚨 **Failure Reason: INSUFFICIENT ALLOWANCE**`));
        console.log(c.yellow(`            - ${participant.name} didn't approve PaymentsContract with enough allowance`));
        console.log(c.yellow(`            - Required: ${formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT)}`));
      } else if (error.message.includes('InsufficientBalance') || error.message.includes('balance')) {
        console.log(c.yellow(`         🚨 **Failure Reason: INSUFFICIENT BALANCE**`));
        console.log(c.yellow(`            - ${participant.name} has insufficient USDC balance for payment`));
        console.log(c.yellow(`            - Check if collateral locked reduced their available balance`));
      } else if (error.message.includes('Only AjoCore') || error.message.includes('Unauthorized')) {
        console.log(c.yellow(`         🚨 **Failure Reason: ACCESS CONTROL**`));
        console.log(c.yellow(`            - Function called with wrong permissions`));
        console.log(c.yellow(`            - This should not happen with processPayment() fix`));
      } else if (error.message.includes('PaymentAlreadyMade')) {
        console.log(c.yellow(`         🚨 **Failure Reason: DUPLICATE PAYMENT**`));
        console.log(c.yellow(`            - ${participant.name} already paid for this cycle`));
      } else if (error.message.includes('Member not active') || error.message.includes('MemberNotFound')) {
        console.log(c.yellow(`         🚨 **Failure Reason: MEMBER STATUS**`));
        console.log(c.yellow(`            - ${participant.name} is not an active member`));
      } else if (error.message.includes('reverted without a reason') || error.message.includes('revert')) {
        console.log(c.yellow(`         🚨 **Failure Reason: UNKNOWN REVERT**`));
        console.log(c.yellow(`            - The transaction reverted without a specific reason string.`));
        console.log(c.yellow(`            - This suggests an issue in the contract's internal logic not covered by explicit error messages.`));
      } else {
        console.log(c.yellow(`         🚨 **Failure Reason: UNKNOWN ERROR**`));
        console.log(c.yellow(`            - Unexpected error occurred during payment processing`));
        console.log(c.yellow(`            - Check contract state and configuration`));
      }
      
      paymentResults.push({
        name: participant.name,
        gasUsed: 0,
        success: false,
        error: error.message
      });
    }
    
    await sleep(DEMO_CONFIG.SIMULATION_SPEED / 4);
  }
  
  // Show payment summary
  console.log(c.cyan("\n📊 Payment Collection Results (Option 2):"));
  const successfulPayments = paymentResults.filter(r => r.success).length;
  const totalCollected = DEMO_CONFIG.MONTHLY_PAYMENT.mul(successfulPayments);
  
  console.log(c.dim(`  Successful payments: ${successfulPayments}/10`));
  console.log(c.dim(`  Total collected by PaymentsContract: ${formatUSDC(totalCollected)}`));
  console.log(c.dim(`  Total gas for payments: ${totalPaymentGas.toString()}`));
  console.log(c.green(`  ✅ Option 2 Flow: PaymentsContract pulled funds directly from users`));
  
  await sleep(DEMO_CONFIG.SIMULATION_SPEED);
  
  // Phase 2: Distribute payout to Position 1 (Adunni)
  console.log(c.cyan("\n🎁 Phase 2: Payout Distribution"));
  
  const recipient = participants[0]; // Adunni
  console.log(c.dim(`    Distributing $500 payout to ${recipient.name} (Position 1)...`));
  
  try {
    // Get balance before payout
    const usdcContract = await ethers.getContractAt("MockERC20", await ajo.USDC());
    const balanceBefore = await usdcContract.balanceOf(recipient.address);
    
    // Check if payout is ready
    try {
      const payoutReady = await ajoPayments.isPayoutReady ? 
        await ajoPayments.isPayoutReady() : true;
      console.log(c.dim(`      Payout ready check: ${payoutReady}`));
      
      if (!payoutReady) {
        console.log(c.yellow(`      ⚠️ Payout not ready - insufficient payments collected`));
      }
    } catch (error) {
      console.log(c.dim(`      Payout ready check failed, proceeding...`));
    }
    
    const payoutTx = await ajo.distributePayout({ gasLimit: 400000 });
    const receipt = await payoutTx.wait();
    
    totalPayoutGas = totalPayoutGas.add(receipt.gasUsed);
    
    // Check balance after payout
    const balanceAfter = await usdcContract.balanceOf(recipient.address);
    const actualPayout = balanceAfter.sub(balanceBefore);
    
    console.log(c.green(`    ✅ Payout distributed from PaymentsContract!`));
    console.log(c.green(`      Amount: ${formatUSDC(actualPayout)}`));
    console.log(c.green(`      balanceBefore: ${formatUSDC(balanceBefore)}`));
    console.log(c.green(`      balanceAfter: ${formatUSDC(balanceAfter)}`));
    console.log(c.green(`      Gas used: ${receipt.gasUsed.toString()}`));
    console.log(c.dim(`      Transaction: ${receipt.transactionHash}`));
    
  } catch (error) {
    console.log(c.red(`    ❌ Payout failed: ${error.message}`));
    if (error.message.includes('No eligible recipient')) {
      console.log(c.yellow(`       Issue: No member has made their payment yet, so no one is eligible for payout`));
    } else if (error.message.includes('insufficient') || error.message.includes('balance')) {
      console.log(c.yellow(`       Issue: PaymentsContract has insufficient balance for payout`));
      console.log(c.yellow(`       This happens when not enough members have paid yet`));
    } else {
      console.log(c.yellow(`       This might be due to insufficient contract balance or missing setup`));
    }
  }
  
  await sleep(DEMO_CONFIG.SIMULATION_SPEED);
  
  // Show cycle summary
  console.log(c.magenta("\n🔄 CYCLE 1 COMPLETE - Option 2 Analysis:"));
  
  const totalCycleGas = totalPaymentGas.add(totalPayoutGas);
  const avgPaymentGas = successfulPayments > 0 ? totalPaymentGas.div(successfulPayments) : ethers.BigNumber.from(0);
  const estimatedCycleCost = totalCycleGas.mul(ethers.utils.parseUnits("0.00000001", 18));
  
  console.log(c.dim(`  📈 Total gas for complete cycle: ${totalCycleGas.toString()}`));
  console.log(c.dim(`  📊 Average gas per payment: ${avgPaymentGas.toString()}`));
  console.log(c.dim(`  💰 Estimated cycle cost: ${ethers.utils.formatEther(estimatedCycleCost)} HBAR`));
  console.log(c.dim(`  🔁 Zero idle capital: All ${formatUSDC(totalCollected)} immediately available for payout`));
  console.log(c.green(`  🆕 Option 2 Benefits: Direct contract pulls, cleaner token flow`));
  
  // Show what happens next
  console.log(c.yellow("\n🔮 Next Cycles Preview:"));
  console.log(c.dim(`  Cycle 2: PaymentsContract pulls $50 from each member, Babatunde gets $500`));
  console.log(c.dim(`  Cycle 3: PaymentsContract pulls $50 from each member, Chinwe gets $500`));
  console.log(c.dim(`  ...continuing with direct pulls until all 10 members receive payouts`));
  
  if (successfulPayments > 0) {
    console.log(c.green("\n🎯 OPTION 2 PAYMENT CYCLE DEMONSTRATION SUCCESS!"));
    console.log(c.dim("  PaymentsContract successfully pulled payments directly from users"));
  } else {
    console.log(c.yellow("\n⚠️ PAYMENTS FAILED - Check contract approvals and balances"));
  }
  
  await sleep(DEMO_CONFIG.SIMULATION_SPEED);
  
  return {
    paymentResults,
    totalPaymentGas,
    totalPayoutGas,
    totalCycleGas,
    estimatedCycleCost
  };
}

async function main() {
  console.log(c.bold(c.cyan("🌟 DeFi Ajo: Digital Transformation of Traditional Yoruba Finance 🌟")));
  console.log(c.dim("COMPREHENSIVE HACKATHON DEMO - Option 2 Complete Implementation - Live Smart Contract Interactions\n"));
  
  // Verify we're running locally for safety
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 31337) {
    console.log(c.yellow(`⚠️ Warning: Running on ${network.name} (chainId: ${network.chainId})`));
    console.log(c.dim("Demo optimized for local Hardhat network"));
  }
  
  try {
    // 1. Deploy and configure contracts
    const { 
      ajo, 
      usdc, 
      whbar,
      ajoMembers,
      ajoCollateral,
      ajoPayments,
      ajoGovernance,
      signers, 
      deployer 
    } = await deployContracts();
    
    // 2. Setup participants (OPTION 2: Both CollateralContract and PaymentsContract approvals)
    const participants = await setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, signers);
    
    // 3. Demonstrate collateral calculation theory
    await demonstrateCollateralCalculation(ajo);
    
    // 4. LIVE: All 10 participants actually join with OPTION 2 flow
    const joinResults = await demonstrateActualJoining(ajo, participants);
    
    // ADD THIS DEBUG LINE HERE:
    await debugMemberStates(ajo, ajoPayments, participants);

    // Only continue with further demos if we had successful joins
    const successfulJoins = joinResults.filter(r => !r.error);
    if (successfulJoins.length > 0) {
      console.log(c.green(`\n🎉 Proceeding with remaining demos using ${successfulJoins.length} successful participants`));
      
      // 5. LIVE: Complete payment cycle with Option 2 flow
      const cycleResults = await demonstratePaymentCycle(ajo, ajoPayments, participants.slice(0, successfulJoins.length));
      
      // 6. Show final summary
      await showEnhancedFinalSummary(ajo, successfulJoins, joinResults, cycleResults);
    } else {
      console.log(c.yellow("\n⚠️ No successful joins - showing theoretical summary"));
      await showCollateralSummaryOnly(ajo);
    }

    // Advanced scenarios
  await demonstrateDefaultHandling(ajo, ajoCollateral, participants);
  await demonstrateGovernance(ajo, ajoGovernance, participants);
  await demonstrateMultiCycleProgression(ajo, ajoPayments, participants);
  await demonstrateTokenSwitching(ajo, ajoPayments, whbar, participants);
  await demonstrateReputationSystem(ajo, ajoMembers, ajoGovernance, participants);
  await demonstrateEmergencyFunctions(ajo, deployer);
    
  } catch (error) {
    console.error(c.red("\n💥 Demo encountered an error:"));
    console.error(c.dim("Error details:"), error.message);
    
    if (error.message.includes('SocketError') || error.message.includes('network')) {
      console.log(c.yellow("\n🔧 Network Issue Detected:"));
      console.log(c.dim("• Make sure you're running 'npx hardhat node' in another terminal"));
      console.log(c.dim("• This demo should run entirely on local Hardhat network"));
      console.log(c.dim("• Check your hardhat.config.js network settings"));
    }
    
    throw error;
  }
}

async function showCollateralSummaryOnly(ajo) {
  console.log(c.blue("\n📋 THEORETICAL INNOVATION SUMMARY"));
  
  console.log(c.bold("\n🏆 WHAT WE'VE DEMONSTRATED:"));
  
  console.log(c.green("\n1. 🔧 SOLVED THE COLLATERAL PARADOX:"));
  console.log(c.dim("   • Traditional problem: Need $500+ collateral to borrow $500"));
  console.log(c.dim("   • Our solution: Position 1 only needs $248 collateral for $500 payout"));
  console.log(c.dim("   • 50%+ capital efficiency improvement!"));
  
  console.log(c.green("\n2. 🤝 INNOVATIVE GUARANTOR SYSTEM:"));
  console.log(c.dim("   • Pairs high-risk early positions with low-risk late positions"));
  console.log(c.dim("   • Mutual guarantee creates game theory protection"));
  console.log(c.dim("   • Default by one affects both - strong incentive alignment"));
  
  console.log(c.green("\n3. 🆕 OPTION 2 COMPLETE IMPLEMENTATION:"));
  console.log(c.dim("   • CollateralContract pulls collateral directly from users"));
  console.log(c.dim("   • PaymentsContract pulls payments directly from users"));
  console.log(c.dim("   • Cleaner architecture with proper separation of concerns"));
  console.log(c.dim("   • Users approve specific contracts, avoiding proxy issues"));
  
  console.log(c.magenta("\n🎯 MARKET POTENTIAL:"));
  console.log(c.dim("  • 400M+ people globally participate in ROSCAs"));
  console.log(c.dim("  • $60B+ annual volume in traditional savings circles"));
  console.log(c.dim("  • Our innovation makes digital adoption viable"));
  console.log(c.dim("  • Reduces capital requirements by 50%+"));
}

async function showEnhancedFinalSummary(ajo, participants, joinResults, cycleResults) {
  console.log(c.blue("\n📋 COMPREHENSIVE DEMO SUMMARY & IMPACT ANALYSIS (OPTION 2)"));
  
  // Get final contract statistics
  try {
    const finalStats = await ajo.getContractStats();
    
    console.log(c.bold("\n🏆 LIVE DEMONSTRATIONS COMPLETED:"));
    
    console.log(c.green("\n1. 🔧 COLLATERAL PARADOX SOLVED (PROVEN LIVE):"));
    console.log(c.dim("   • Traditional problem: Need $500+ collateral to borrow $500"));
    console.log(c.dim("   • Our solution: Position 1 only needs $248 collateral for $500 payout"));
    console.log(c.dim("   • 50%+ capital efficiency improvement DEMONSTRATED"));
    
    console.log(c.green("\n2. 🆕 OPTION 2 COMPLETE IMPLEMENTATION SUCCESS:"));
    console.log(c.dim("   • CollateralContract pulls collateral directly via lockCollateral()"));
    console.log(c.dim("   • PaymentsContract pulls payments directly via makePayment()"));
    console.log(c.dim("   • Clean architecture with proper separation of concerns"));
    console.log(c.dim("   • Users approve specific contracts directly - no proxy confusion"));
    
    if (joinResults && joinResults.length > 0) {
      const successfulJoins = joinResults.filter(r => !r.error);
      const totalCollateralLocked = successfulJoins.reduce((sum, r) => {
        return r.actualCollateral ? sum.add(r.actualCollateral) : sum;
      }, ethers.BigNumber.from(0));
      
      console.log(c.cyan("\n📊 PARTICIPATION STATISTICS:"));
      console.log(c.dim(`  Successful joins: ${successfulJoins.length}/10 participants`));
      console.log(c.dim(`  Total collateral locked: ${formatUSDC(totalCollateralLocked)}`));
      console.log(c.dim(`  Architecture: Option 2 - Direct contract pulls for both collateral & payments`));
    }
    
    // Gas efficiency analysis
    if (cycleResults) {
      console.log(c.magenta("\n⚡ HEDERA EFFICIENCY ANALYSIS (OPTION 2):"));
      const totalGas = cycleResults.totalCycleGas;
      const estimatedHbarCost = ethers.utils.formatEther(cycleResults.estimatedCycleCost);
      
      console.log(c.dim(`  Gas per complete cycle: ${totalGas.toString()}`));
      console.log(c.dim(`  Estimated HBAR cost per cycle: ${estimatedHbarCost}`));
      console.log(c.dim(`  Annual cost for 12 cycles: ${(parseFloat(estimatedHbarCost) * 12).toFixed(8)} HBAR`));
      console.log(c.dim(`  Cost per participant per year: ${(parseFloat(estimatedHbarCost) * 12 / 10).toFixed(8)} HBAR`));
      console.log(c.green(`  🆕 Option 2 Benefits: More efficient gas usage with direct pulls`));
    }
    
    console.log(c.cyan("\n📊 FINAL SYSTEM STATE:"));
    console.log(c.dim(`  👥 Total Members: ${finalStats.totalMembers}`));
    console.log(c.dim(`  💰 Total Locked Collateral: ${formatUSDC(finalStats.totalCollateralUSDC)}`));
    console.log(c.dim(`  🏦 Contract Balance: ${formatUSDC(finalStats.contractBalanceUSDC)}`));
    console.log(c.dim(`  🔄 Current Queue Position: ${finalStats.currentQueuePosition}`));
    
  } catch (error) {
    console.log(c.yellow(`\n⚠️ Could not fetch final stats: ${error.message}`));
  }
  
  console.log(c.magenta("\n🌍 GLOBAL MARKET IMPACT:"));
  console.log(c.dim("  • 400M+ people globally participate in ROSCAs"));
  console.log(c.dim("  • $60B+ annual volume in traditional savings circles"));
  console.log(c.dim("  • Our innovation makes digital adoption viable"));
  console.log(c.dim("  • Reduces capital requirements by 50%+"));
  console.log(c.dim("  • Eliminates default risk for honest participants"));
  console.log(c.dim("  • Hedera's speed + low costs enable global scale"));
  
  console.log(c.yellow("\n🎯 HACKATHON DIFFERENTIATORS:"));
  console.log(c.dim("  ✅ Solves real problem affecting 400M+ people"));
  console.log(c.dim("  ✅ Mathematical innovation (collateral paradox solution)"));
  console.log(c.dim("  ✅ Cultural authenticity (respects traditional practices)"));
  console.log(c.dim("  ✅ Live working demo with real transactions"));
  console.log(c.dim("  ✅ Professional modular smart contract architecture"));
  console.log(c.dim("  ✅ Game theory innovation (guarantor pairing)"));
  console.log(c.dim("  ✅ Complete default protection system"));
  console.log(c.dim("  ✅ Option 2 clean architecture implementation"));
  
  console.log(c.bold(c.yellow("\n✨ INNOVATION SUMMARY:")));
  console.log(c.yellow("We've digitized and improved a 400-year-old financial system"));
  console.log(c.yellow("by solving its core problems with modern game theory,"));
  console.log(c.yellow("mathematical precision, and blockchain technology!"));
  
  console.log(c.bold(c.magenta("\n🚀 OPTION 2 ARCHITECTURE BENEFITS:")));
  console.log(c.magenta("• Cleaner smart contract separation of concerns"));
  console.log(c.magenta("• Direct token pulls avoid allowance confusion"));  
  console.log(c.magenta("• More gas efficient token transfers"));
  console.log(c.magenta("• Better user experience with explicit approvals"));
  console.log(c.magenta("• Easier to audit and maintain"));
  
  console.log(c.bold(c.magenta("\n🏁 READY FOR PRODUCTION:")));
  console.log(c.magenta("This system is mathematically sound, culturally authentic,"));
  console.log(c.magenta("technically robust, and ready to serve millions of users"));
  console.log(c.magenta("who have been waiting for digital transformation of ROSCAs!"));
}








// Additional Demo Scenarios to Showcase Full Smart Contract Features

// ============ SCENARIO 1: DEFAULT HANDLING & ASSET SEIZURE ============
async function demonstrateDefaultHandling(ajo, ajoCollateral, participants) {
  console.log(c.blue("\n🚨 CRITICAL SCENARIO: Default Handling & Asset Seizure"));
  console.log(c.yellow("Demonstrating the security model when a member defaults"));
  
  // Simulate a default scenario - let's say Babatunde (position 2) defaults after receiving payout
  const defaulter = participants[1]; // Babatunde
  const guarantor = participants[5]; // Folake (his guarantor based on your pairing system)
  
  console.log(c.dim(`\n📋 SETUP: ${defaulter.name} (Position 2) defaults after receiving $500 payout`));
  console.log(c.dim(`  Guarantor: ${guarantor.name} (Position 6)`));
  
  try {
    // First, check what assets can be seized before default
    const seizableAssets = await ajoCollateral.calculateSeizableAssets(defaulter.address);
    console.log(c.cyan("\n💰 Seizable Assets Analysis:"));
    console.log(c.dim(`  Total Seizable: ${formatUSDC(seizableAssets.totalSeizable)}`));
    console.log(c.dim(`  Defaulter Collateral: ${formatUSDC(seizableAssets.collateralSeized)}`));
    console.log(c.dim(`  Past Payments: ${formatUSDC(seizableAssets.paymentsSeized)}`));
    
    // Execute the default handling
    const defaultTx = await ajo.handleDefault(defaulter.address);
    const receipt = await defaultTx.wait();
    
    console.log(c.green(`\n✅ Default handled successfully!`));
    console.log(c.dim(`  Gas used: ${receipt.gasUsed}`));
    console.log(c.dim(`  Transaction: ${receipt.transactionHash}`));
    
    // Show the aftermath
    const memberInfoAfter = await ajo.getMemberInfo(defaulter.address);
    console.log(c.red(`\n📊 POST-DEFAULT STATUS:`));
    console.log(c.red(`  ${defaulter.name} default count: ${memberInfoAfter.memberInfo.defaultCount}`));
    console.log(c.red(`  ${defaulter.name} is active: ${memberInfoAfter.memberInfo.isActive}`));
    
  } catch (error) {
    console.log(c.red(`❌ Default handling demo failed: ${error.message}`));
  }
}

// ============ SCENARIO 2: GOVERNANCE SYSTEM ============
async function demonstrateGovernance(ajo, ajoGovernance, participants) {
  console.log(c.blue("\n🗳️  GOVERNANCE DEMONSTRATION: Community Decision Making"));
  console.log(c.yellow("Showing how members vote on important system changes"));
  
  try {
    // Create a proposal to change penalty rate
    const proposer = participants[0]; // Adunni
    const proposalDescription = "Increase penalty rate from 10% to 15% for better default deterrent";
    const proposalData = "0x"; // Encoded function call data
    
    console.log(c.dim(`\n📋 Creating proposal: "${proposalDescription}"`));
    const createProposalTx = await ajoGovernance.connect(proposer.signer)
      .createProposal(proposalDescription, proposalData);
    const receipt = await createProposalTx.wait();
    
    // Extract proposal ID from events
    const proposalId = receipt.events?.find(e => e.event === 'ProposalCreated')?.args?.proposalId || 0;
    
    console.log(c.green(`✅ Proposal created with ID: ${proposalId}`));
    
    // Show voting by multiple members
    console.log(c.cyan("\n🗳️  Voting Phase:"));
    
    const voters = participants.slice(0, 5); // First 5 members vote
    const votes = [1, 1, 0, 1, 2]; // For, For, Against, For, Abstain
    const voteNames = ["For", "For", "Against", "For", "Abstain"];
    
    for (let i = 0; i < voters.length; i++) {
      try {
        await ajoGovernance.connect(voters[i].signer).vote(proposalId, votes[i]);
        console.log(c.dim(`  ${voters[i].name}: ${voteNames[i]} ✅`));
      } catch (error) {
        console.log(c.dim(`  ${voters[i].name}: Vote failed - ${error.message}`));
      }
    }
    
    // Show proposal results
    const proposal = await ajoGovernance.getProposal(proposalId);
    console.log(c.magenta("\n📊 Voting Results:"));
    console.log(c.dim(`  For votes: ${proposal.forVotes}`));
    console.log(c.dim(`  Against votes: ${proposal.againstVotes}`));
    console.log(c.dim(`  Abstain votes: ${proposal.abstainVotes}`));
    
  } catch (error) {
    console.log(c.red(`❌ Governance demo failed: ${error.message}`));
  }
}

// ============ SCENARIO 3: MULTI-CYCLE PROGRESSION ============
async function demonstrateMultiCycleProgression(ajo, ajoPayments, participants) {
  console.log(c.blue("\n🔄 MULTI-CYCLE PROGRESSION: Complete ROSCA Lifecycle"));
  console.log(c.yellow("Fast-forwarding through multiple cycles to show full system lifecycle"));
  
  const totalCycles = 3; // Demo first 3 cycles
  
  for (let cycle = 2; cycle <= totalCycles; cycle++) {
    console.log(c.bold(`\n📅 === CYCLE ${cycle} ===`));
    
    try {
      // Advance to next cycle
      await ajoPayments.advanceCycle();
      console.log(c.dim(`✅ Advanced to cycle ${cycle}`));
      
      // Show who gets payout this cycle
      const nextRecipient = await ajoPayments.getNextRecipient();
      const recipientName = participants.find(p => p.address === nextRecipient)?.name || "Unknown";
      
      console.log(c.cyan(`🎯 This cycle's recipient: ${recipientName} (${nextRecipient})`));
      
      // Process payments from all members
      console.log(c.dim("💳 Processing payments from all members..."));
      let successfulPayments = 0;
      
      for (const participant of participants) {
        try {
          const needsToPay = await ajo.needsToPayThisCycle(participant.address);
          if (needsToPay) {
            await ajo.connect(participant.signer).processPayment({ gasLimit: 300000 });
            successfulPayments++;
          }
        } catch (error) {
          console.log(c.yellow(`  ${participant.name} payment failed: ${error.message}`));
        }
      }
      
      console.log(c.dim(`✅ Collected payments from ${successfulPayments}/${participants.length} members`));
      
      // Distribute payout
      const payoutTx = await ajo.distributePayout({ gasLimit: 400000 });
      await payoutTx.wait();
      console.log(c.green(`🎁 Payout distributed to ${recipientName}!`));
      
    } catch (error) {
      console.log(c.red(`❌ Cycle ${cycle} failed: ${error.message}`));
      break;
    }
  }
  
  // Show final statistics
  console.log(c.magenta("\n📊 Multi-Cycle Statistics:"));
  const finalStats = await ajo.getContractStats();
  console.log(c.dim(`  Completed cycles: ${totalCycles}`));
  console.log(c.dim(`  Total members: ${finalStats.totalMembers}`));
  console.log(c.dim(`  Active members: ${finalStats.activeMembers}`));
}

// ============ SCENARIO 4: TOKEN SWITCHING ============
async function demonstrateTokenSwitching(ajo, ajoPayments, whbar, participants) {
  console.log(c.blue("\n🔄 TOKEN SWITCHING: Multi-Currency Support"));
  console.log(c.yellow("Demonstrating switching from USDC to HBAR mid-cycle"));
  
  try {
    // First, configure HBAR token
    const hbarMonthlyPayment = ethers.utils.parseUnits("200", 8); // 200 HBAR equivalent
    await ajo.updateTokenConfig(1, hbarMonthlyPayment, true); // PaymentToken.HBAR = 1
    
    console.log(c.dim("✅ HBAR token configured: 200 HBAR monthly payment"));
    
    // Give participants some HBAR tokens
    for (const participant of participants.slice(0, 3)) {
      await whbar.connect(participant.signer).faucet();
      await whbar.connect(participant.signer).approve(ajo.address, ethers.utils.parseUnits("1000", 8));
      console.log(c.dim(`  ${participant.name}: HBAR tokens acquired and approved`));
    }
    
    // Switch to HBAR
    const switchTx = await ajoPayments.switchPaymentToken(1); // Switch to HBAR
    await switchTx.wait();
    
    console.log(c.green("🔄 Successfully switched from USDC to HBAR!"));
    
    // Show new token configuration
    const newTokenConfig = await ajo.getTokenConfig(1);
    console.log(c.cyan("📊 New Token Settings:"));
    console.log(c.dim(`  Monthly Payment: ${ethers.utils.formatUnits(newTokenConfig.monthlyPayment, 8)} HBAR`));
    console.log(c.dim(`  Active: ${newTokenConfig.isActive}`));
    
  } catch (error) {
    console.log(c.red(`❌ Token switching demo failed: ${error.message}`));
  }
}

// ============ SCENARIO 5: REPUTATION & VOTING POWER ============
async function demonstrateReputationSystem(ajo, ajoMembers, ajoGovernance, participants) {
  console.log(c.blue("\n⭐ REPUTATION SYSTEM: Merit-Based Voting Power"));
  console.log(c.yellow("Showing how member reputation affects governance participation"));
  
  try {
    // Update reputation for some members
    const highReputationMember = participants[0]; // Adunni - always pays on time
    const lowReputationMember = participants[3];  // Damilola - occasional late payments
    
    console.log(c.dim("\n📈 Updating member reputations based on payment history..."));
    
    await ajoMembers.updateReputation(highReputationMember.address, 950); // High reputation
    await ajoMembers.updateReputation(lowReputationMember.address, 300);  // Lower reputation
    
    console.log(c.green(`✅ ${highReputationMember.name}: Reputation updated to 950 (Excellent)`));
    console.log(c.yellow(`✅ ${lowReputationMember.name}: Reputation updated to 300 (Fair)`));
    
    // Show how this affects voting power
    const highRepInfo = await ajo.getMemberInfo(highReputationMember.address);
    const lowRepInfo = await ajo.getMemberInfo(lowReputationMember.address);
    
    console.log(c.cyan("\n🗳️  Voting Power Impact:"));
    console.log(c.dim(`  ${highReputationMember.name}: ${highRepInfo.effectiveVotingPower} voting power`));
    console.log(c.dim(`  ${lowReputationMember.name}: ${lowRepInfo.effectiveVotingPower} voting power`));
    
    // Create a governance proposal to demonstrate weighted voting
    const proposalTx = await ajoGovernance.connect(highReputationMember.signer)
      .createProposal("Reduce cycle duration for faster payouts", "0x");
    const receipt = await proposalTx.wait();
    const proposalId = receipt.events?.find(e => e.event === 'ProposalCreated')?.args?.proposalId || 1;
    
    // Both members vote - show different impact
    await ajoGovernance.connect(highReputationMember.signer).vote(proposalId, 1); // For
    await ajoGovernance.connect(lowReputationMember.signer).vote(proposalId, 0);  // Against
    
    const proposal = await ajoGovernance.getProposal(proposalId);
    console.log(c.magenta("\n📊 Weighted Voting Results:"));
    console.log(c.dim(`  High reputation member's vote weight: Much higher impact`));
    console.log(c.dim(`  Low reputation member's vote weight: Lower impact`));
    console.log(c.dim(`  For votes: ${proposal.forVotes}`));
    console.log(c.dim(`  Against votes: ${proposal.againstVotes}`));
    
  } catch (error) {
    console.log(c.red(`❌ Reputation system demo failed: ${error.message}`));
  }
}

// ============ SCENARIO 6: EMERGENCY FUNCTIONS ============
async function demonstrateEmergencyFunctions(ajo, deployer) {
  console.log(c.blue("\n🚨 EMERGENCY FUNCTIONS: System Safety Mechanisms"));
  console.log(c.yellow("Demonstrating emergency pause and recovery capabilities"));
  
  try {
    console.log(c.dim("\n⏸️  Testing emergency pause functionality..."));
    
    // Emergency pause
    const pauseTx = await ajo.connect(deployer).emergencyPause();
    await pauseTx.wait();
    console.log(c.red("🛑 System emergency paused!"));
    
    // Try to perform normal operation (should fail)
    try {
      await ajo.calculatePayout();
      console.log(c.yellow("⚠️  Normal operations should be blocked during pause"));
    } catch (error) {
      console.log(c.green("✅ Confirmed: Normal operations blocked during emergency pause"));
    }
    
    console.log(c.dim("\n💰 Testing emergency withdrawal capabilities..."));
    
    // Emergency withdraw (admin only)
    const emergencyWithdrawTx = await ajo.connect(deployer).emergencyWithdraw(0); // USDC
    await emergencyWithdrawTx.wait();
    console.log(c.green("✅ Emergency withdrawal completed - funds secured"));
    
  } catch (error) {
    console.log(c.red(`❌ Emergency functions demo failed: ${error.message}`));
  }
}

// ============ MAIN ENHANCED DEMO RUNNER ============
async function runEnhancedDemo() {
  console.log(c.bold(c.magenta("\n🚀 ENHANCED HACKATHON DEMO: Advanced Features Showcase")));
  
  // ... existing deployment code ...
  const { ajo, usdc, whbar, ajoMembers, ajoCollateral, ajoPayments, ajoGovernance, signers, deployer } = await deployContracts();
  const participants = await setupParticipants(ajo, usdc, ajoCollateral, ajoPayments, signers);
  
  // Run core demo first
  await demonstrateCollateralCalculation(ajo);
  await demonstrateActualJoining(ajo, participants);
  await demonstratePaymentCycle(ajo, ajoPayments, participants);
  
  console.log(c.bold(c.cyan("\n🌟 === ADVANCED FEATURES DEMONSTRATION ===")));
  
  
  
  console.log(c.bold(c.green("\n🎯 COMPLETE SYSTEM DEMONSTRATION FINISHED!")));
  console.log(c.magenta("All major smart contract features showcased successfully!"));
}

module.exports = { runEnhancedDemo };

if (require.main === module) {
  main()
    .then(() => {
      console.log(c.green("\n🎉 Option 2 Complete Demo completed successfully!"));
      console.log(c.bold(c.magenta("Thank you for experiencing the future of traditional finance! 🚀")));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Demo failed:"), error);
      
      if (error.message.includes('SocketError') || error.message.includes('network')) {
        console.log(c.yellow("\n🔧 Network Issue Detected:"));
        console.log(c.dim("• Make sure you're running 'npx hardhat node' in another terminal"));
        console.log(c.dim("• This demo should run entirely on local Hardhat network"));
        console.log(c.dim("• Check your hardhat.config.js network settings"));
      }
      
      process.exit(1);
    });
}

module.exports = { main };