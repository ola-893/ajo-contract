#!/usr/bin/env node
const { ethers } = require("hardhat");
const fs = require('fs');

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

const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const formatHBAR = (amount) => ethers.utils.formatUnits(amount, 8);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to safely call view functions
async function safeViewCall(fn, name, context = "") {
  try {
    const result = await fn();
    console.log(c.green(`      ✅ ${name}`));
    return { success: true, data: result };
  } catch (error) {
    console.log(c.red(`      ❌ ${name} - ${error.message}`));
    return { success: false, error: error.message };
  }
}

// ================================================================
// PRE-JOINING VIEW TESTS
// ================================================================

async function showPreJoiningState(ajo, ajoCollateral, ajoMembers, ajoPayments) {
  console.log(c.cyan("\n  📊 PRE-JOINING STATE VERIFICATION:"));
  
  // Token Configuration
  console.log(c.dim("\n    Token Configuration:"));
  const usdcConfig = await safeViewCall(
    async () => await ajo.getTokenConfig(0),
    "getTokenConfig(USDC)"
  );
  if (usdcConfig.success) {
    console.log(c.dim(`       Monthly Payment: ${formatUSDC(usdcConfig.data.monthlyPayment)}`));
    console.log(c.dim(`       Active: ${usdcConfig.data.isActive}`));
  }
  
  const hbarConfig = await safeViewCall(
    async () => await ajo.getTokenConfig(1),
    "getTokenConfig(HBAR)"
  );
  if (hbarConfig.success) {
    console.log(c.dim(`       Monthly Payment: ${formatHBAR(hbarConfig.data.monthlyPayment)}`));
    console.log(c.dim(`       Active: ${hbarConfig.data.isActive}`));
  }
  
  // Collateral Model Demo
  console.log(c.dim("\n    Collateral Model (V2 - 55% efficiency):"));
  const collateralDemo = await safeViewCall(
    async () => await ajo.getCollateralDemo(10, ethers.utils.parseUnits("50", 6)),
    "getCollateralDemo(10 participants, 50 USDC)"
  );
  if (collateralDemo.success) {
    console.log(c.dim(`       Position 1: ${formatUSDC(collateralDemo.data.collaterals[0])}`));
    console.log(c.dim(`       Position 5: ${formatUSDC(collateralDemo.data.collaterals[4])}`));
    console.log(c.dim(`       Position 10: ${formatUSDC(collateralDemo.data.collaterals[9])}`));
  }
  
  // Initial member count
  console.log(c.dim("\n    Member Statistics:"));
  const totalMembers = await safeViewCall(
    async () => await ajoMembers.getTotalActiveMembers(),
    "getTotalActiveMembers()"
  );
  if (totalMembers.success) {
    console.log(c.dim(`       Total Active Members: ${totalMembers.data}`));
  }
  
  // Payment cycle info
  console.log(c.dim("\n    Payment Cycle Info:"));
  const currentCycle = await safeViewCall(
    async () => await ajoPayments.getCurrentCycle(),
    "getCurrentCycle()"
  );
  if (currentCycle.success) {
    console.log(c.dim(`       Current Cycle: ${currentCycle.data}`));
  }
  
  const activeToken = await safeViewCall(
    async () => await ajoPayments.getActivePaymentToken(),
    "getActivePaymentToken()"
  );
  if (activeToken.success) {
    console.log(c.dim(`       Active Token: ${activeToken.data === 0 ? 'USDC' : 'HBAR'}`));
  }
}

// ================================================================
// POST-JOINING VIEW TESTS
// ================================================================

async function verifyJoiningResults(ajo, ajoCollateral, ajoMembers, participants) {
  console.log(c.cyan("\n  📊 POST-JOINING VERIFICATION:"));
  
  // Total collateral locked
  console.log(c.dim("\n    Collateral Verification:"));
  const totalCollateral = await safeViewCall(
    async () => await ajoCollateral.getTotalCollateral(),
    "getTotalCollateral()"
  );
  if (totalCollateral.success) {
    console.log(c.dim(`       Total USDC Locked: ${formatUSDC(totalCollateral.data.totalUSDC)}`));
    console.log(c.dim(`       Total HBAR Locked: ${formatHBAR(totalCollateral.data.totalHBAR)}`));
  }
  
  // Contract statistics
  const stats = await safeViewCall(
    async () => await ajo.getContractStats(),
    "getContractStats()"
  );
  if (stats.success) {
    console.log(c.dim(`       Total Members: ${stats.data.totalMembers}`));
    console.log(c.dim(`       Active Members: ${stats.data.activeMembers}`));
    console.log(c.dim(`       Current Queue Position: ${stats.data.currentQueuePosition}`));
    console.log(c.dim(`       Contract Balance USDC: ${formatUSDC(stats.data.contractBalanceUSDC)}`));
  }
  
  // Active members list
  const membersList = await safeViewCall(
    async () => await ajoMembers.getActiveMembersList(),
    "getActiveMembersList()"
  );
  if (membersList.success) {
    console.log(c.dim(`       Active Members Array Length: ${membersList.data.length}`));
  }
  
  // Verify individual members (first 3)
  console.log(c.dim("\n    Individual Member Verification:"));
  for (let i = 0; i < Math.min(3, participants.length); i++) {
    const p = participants[i];
    console.log(c.dim(`\n      ${p.name}:`));
    
    // Get full member info
    const memberInfo = await safeViewCall(
      async () => await ajo.getMemberInfo(p.address),
      `getMemberInfo(${p.name})`
    );
    if (memberInfo.success) {
      console.log(c.dim(`         Queue: ${memberInfo.data.memberInfo.queueNumber}`));
      console.log(c.dim(`         Locked Collateral: ${formatUSDC(memberInfo.data.memberInfo.lockedCollateral)}`));
      console.log(c.dim(`         Required Collateral: ${formatUSDC(memberInfo.data.memberInfo.requiredCollateral)}`));
      console.log(c.dim(`         Guarantor: ${memberInfo.data.memberInfo.guarantor}`));
      console.log(c.dim(`         Reputation: ${memberInfo.data.memberInfo.reputationScore}`));
    }
    
    // Queue info
    const queueInfo = await safeViewCall(
      async () => await ajo.getQueueInfo(p.address),
      `getQueueInfo(${p.name})`
    );
    if (queueInfo.success) {
      console.log(c.dim(`         Position: ${queueInfo.data.position}, Wait: ${queueInfo.data.estimatedCyclesWait} cycles`));
    }
    
    // Is member check
    const isMember = await safeViewCall(
      async () => await ajoMembers.isMember(p.address),
      `isMember(${p.name})`
    );
    if (isMember.success) {
      console.log(c.dim(`         Is Member: ${isMember.data}`));
    }
    
    // Locked collateral
    const locked = await safeViewCall(
      async () => await ajoMembers.getLockedCollateral(p.address),
      `getLockedCollateral(${p.name})`
    );
    if (locked.success) {
      console.log(c.dim(`         Locked (from Members): ${formatUSDC(locked.data)}`));
    }
  }
  
  // Verify queue positions
  console.log(c.dim("\n    Queue Position Verification:"));
  for (let pos = 1; pos <= Math.min(3, participants.length); pos++) {
    const address = await safeViewCall(
      async () => await ajoMembers.getQueuePosition(pos),
      `getQueuePosition(${pos})`
    );
    if (address.success) {
      console.log(c.dim(`       Position ${pos}: ${address.data.slice(0, 10)}...`));
    }
    
    // Guarantor for this position
    const guarantor = await safeViewCall(
      async () => await ajoMembers.getGuarantorForPosition(pos),
      `getGuarantorForPosition(${pos})`
    );
    if (guarantor.success) {
      console.log(c.dim(`       Guarantor: ${guarantor.data.slice(0, 10)}...`));
    }
  }
  
  // Verify collateral calculations
  console.log(c.dim("\n    Collateral Calculation Verification:"));
  for (let pos = 1; pos <= Math.min(3, participants.length); pos++) {
    const required = await safeViewCall(
      async () => await ajoCollateral.calculateRequiredCollateral(
        pos,
        ethers.utils.parseUnits("50", 6),
        participants.length
      ),
      `calculateRequiredCollateral(pos ${pos})`
    );
    if (required.success) {
      console.log(c.dim(`       Position ${pos}: ${formatUSDC(required.data)}`));
    }
  }
}

// ================================================================
// PRE-PAYMENT VIEW TESTS
// ================================================================

async function showPrePaymentState(ajo, ajoPayments, participants) {
  console.log(c.cyan("\n  📊 PRE-PAYMENT STATE VERIFICATION:"));
  
  // Payment requirements
  console.log(c.dim("\n    Payment Requirements:"));
  for (let i = 0; i < Math.min(5, participants.length); i++) {
    const p = participants[i];
    const needsPay = await safeViewCall(
      async () => await ajo.needsToPayThisCycle(p.address),
      `needsToPayThisCycle(${p.name})`
    );
    if (needsPay.success) {
      console.log(c.dim(`       ${p.name}: ${needsPay.data ? 'NEEDS TO PAY' : 'No payment needed'}`));
    }
    
    const penalty = await safeViewCall(
      async () => await ajoPayments.getPendingPenalty(p.address),
      `getPendingPenalty(${p.name})`
    );
    if (penalty.success && penalty.data.gt(0)) {
      console.log(c.dim(`       ${p.name} Penalty: ${formatUSDC(penalty.data)}`));
    }
  }
  
  // Payout information
  console.log(c.dim("\n    Payout Information:"));
  const nextRecipient = await safeViewCall(
    async () => await ajoPayments.getNextRecipient(),
    "getNextRecipient()"
  );
  if (nextRecipient.success) {
    console.log(c.dim(`       Next Recipient: ${nextRecipient.data.slice(0, 10)}...`));
  }
  
  const nextPosition = await safeViewCall(
    async () => await ajoPayments.getNextPayoutPosition(),
    "getNextPayoutPosition()"
  );
  if (nextPosition.success) {
    console.log(c.dim(`       Next Position: ${nextPosition.data}`));
  }
  
  const payoutReady = await safeViewCall(
    async () => await ajoPayments.isPayoutReady(),
    "isPayoutReady()"
  );
  if (payoutReady.success) {
    console.log(c.dim(`       Payout Ready: ${payoutReady.data}`));
  }
  
  const calculatedPayout = await safeViewCall(
    async () => await ajoPayments.calculatePayout(),
    "calculatePayout()"
  );
  if (calculatedPayout.success) {
    console.log(c.dim(`       Expected Payout: ${formatUSDC(calculatedPayout.data)}`));
  }
  
  const penaltyRate = await safeViewCall(
    async () => await ajoPayments.getPenaltyRate(),
    "getPenaltyRate()"
  );
  if (penaltyRate.success) {
    console.log(c.dim(`       Penalty Rate: ${penaltyRate.data}%`));
  }
}

// ================================================================
// POST-PAYMENT VIEW TESTS
// ================================================================

async function verifyPaymentResults(ajo, ajoPayments, participants) {
  console.log(c.cyan("\n  📊 POST-PAYMENT VERIFICATION:"));
  
  // Contract balances
  console.log(c.dim("\n    Contract Balances:"));
  const usdcBalance = await safeViewCall(
    async () => await ajoPayments.getContractBalance(0),
    "getContractBalance(USDC)"
  );
  if (usdcBalance.success) {
    console.log(c.dim(`       USDC Balance: ${formatUSDC(usdcBalance.data)}`));
  }
  
  const hbarBalance = await safeViewCall(
    async () => await ajoPayments.getContractBalance(1),
    "getContractBalance(HBAR)"
  );
  if (hbarBalance.success) {
    console.log(c.dim(`       HBAR Balance: ${formatHBAR(hbarBalance.data)}`));
  }
  
  // Payout statistics
  console.log(c.dim("\n    Payout Statistics:"));
  const totalPayouts = await safeViewCall(
    async () => await ajoPayments.getTotalPayouts(),
    "getTotalPayouts()"
  );
  if (totalPayouts.success) {
    console.log(c.dim(`       Total Payouts Made: ${totalPayouts.data}`));
    
    // If payouts exist, get the latest one
    if (totalPayouts.data.gt(0)) {
      const latestPayout = await safeViewCall(
        async () => await ajoPayments.getPayout(totalPayouts.data),
        `getPayout(${totalPayouts.data})`
      );
      if (latestPayout.success) {
        console.log(c.dim(`       Latest Payout:`));
        console.log(c.dim(`         Recipient: ${latestPayout.data.recipient.slice(0, 10)}...`));
        console.log(c.dim(`         Amount: ${formatUSDC(latestPayout.data.amount)}`));
        console.log(c.dim(`         Cycle: ${latestPayout.data.cycle}`));
      }
    }
  }
  
  // Updated member info
  console.log(c.dim("\n    Updated Member Info (First 3):"));
  for (let i = 0; i < Math.min(3, participants.length); i++) {
    const p = participants[i];
    const memberInfo = await safeViewCall(
      async () => await ajo.getMemberInfo(p.address),
      `getMemberInfo(${p.name})`
    );
    if (memberInfo.success) {
      console.log(c.dim(`       ${p.name}:`));
      console.log(c.dim(`         Total Paid: ${formatUSDC(memberInfo.data.memberInfo.totalPaid)}`));
      console.log(c.dim(`         Last Payment Cycle: ${memberInfo.data.memberInfo.lastPaymentCycle}`));
      console.log(c.dim(`         Has Received Payout: ${memberInfo.data.memberInfo.hasReceivedPayout}`));
      console.log(c.dim(`         Default Count: ${memberInfo.data.memberInfo.defaultCount}`));
    }
  }
  
  // Cycle information
  const currentCycle = await safeViewCall(
    async () => await ajoPayments.getCurrentCycle(),
    "getCurrentCycle()"
  );
  if (currentCycle.success) {
    console.log(c.dim(`\n    Current Cycle: ${currentCycle.data}`));
  }
}

// ================================================================
// FACTORY VIEW TESTS
// ================================================================

async function showFactoryState(ajoFactory) {
  console.log(c.cyan("\n  📊 FACTORY STATE VERIFICATION:"));
  
  // Factory stats
  const stats = await safeViewCall(
    async () => await ajoFactory.getFactoryStats(),
    "getFactoryStats()"
  );
  if (stats.success) {
    console.log(c.dim(`       Total Created: ${stats.data.totalCreated}`));
    console.log(c.dim(`       Active Count: ${stats.data.activeCount}`));
  }
  
  // All Ajos
  const allAjos = await safeViewCall(
    async () => await ajoFactory.getAllAjos(0, 5),
    "getAllAjos(0, 5)"
  );
  if (allAjos.success) {
    console.log(c.dim(`       Returned ${allAjos.data.ajoInfos.length} Ajos`));
    console.log(c.dim(`       Has More: ${allAjos.data.hasMore}`));
  }
  
  // Creator's Ajos
  const [deployer] = await ethers.getSigners();
  const creatorAjos = await safeViewCall(
    async () => await ajoFactory.getAjosByCreator(deployer.address),
    "getAjosByCreator(deployer)"
  );
  if (creatorAjos.success) {
    console.log(c.dim(`       Deployer's Ajos: ${creatorAjos.data.length}`));
  }
  
  // Implementation addresses
  const impls = await safeViewCall(
    async () => await ajoFactory.getImplementations(),
    "getImplementations()"
  );
  if (impls.success) {
    console.log(c.dim(`       Master Implementations:`));
    console.log(c.dim(`         AjoCore: ${impls.data.ajoCore.slice(0, 10)}...`));
    console.log(c.dim(`         AjoMembers: ${impls.data.ajoMembers.slice(0, 10)}...`));
    console.log(c.dim(`         AjoCollateral: ${impls.data.ajoCollateral.slice(0, 10)}...`));
  }
  
  // Specific Ajo status
  if (stats.success && stats.data.totalCreated.gt(0)) {
    const ajoStatus = await safeViewCall(
      async () => await ajoFactory.ajoStatus(1),
      "ajoStatus(1)"
    );
    if (ajoStatus.success) {
      console.log(c.dim(`       Ajo 1 Status: Exists=${ajoStatus.data.exists}, Active=${ajoStatus.data.isActive}`));
    }
    
    const coreAddress = await safeViewCall(
      async () => await ajoFactory.getAjoCore(1),
      "getAjoCore(1)"
    );
    if (coreAddress.success) {
      console.log(c.dim(`       Ajo 1 Core: ${coreAddress.data.slice(0, 10)}...`));
    }
  }
}

// ================================================================
// GOVERNANCE VIEW TESTS
// ================================================================

async function showGovernanceState(ajoFactory, ajoId) {
  console.log(c.cyan("\n  📊 GOVERNANCE STATE VERIFICATION:"));
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  const ajoGovernance = await ethers.getContractAt("AjoGovernance", ajoInfo.ajoGovernance);
  
  const settings = await safeViewCall(
    async () => await ajoGovernance.getGovernanceSettings(),
    "getGovernanceSettings()"
  );
  if (settings.success) {
    console.log(c.dim(`       Proposal Threshold: ${settings.data.proposalThreshold}`));
    console.log(c.dim(`       Voting Period: ${settings.data.votingPeriod}`));
    console.log(c.dim(`       Current Penalty Rate: ${settings.data.currentPenaltyRate}%`));
    console.log(c.dim(`       Total Proposals: ${settings.data.totalProposals}`));
    
    // If proposals exist, check them
    if (settings.data.totalProposals.gt(0)) {
      const proposal = await safeViewCall(
        async () => await ajoGovernance.getProposal(1),
        "getProposal(1)"
      );
      if (proposal.success) {
        console.log(c.dim(`       Proposal 1:`));
        console.log(c.dim(`         For Votes: ${proposal.data.forVotes}`));
        console.log(c.dim(`         Against Votes: ${proposal.data.againstVotes}`));
        console.log(c.dim(`         Executed: ${proposal.data.executed}`));
      }
      
      const [deployer] = await ethers.getSigners();
      const hasVoted = await safeViewCall(
        async () => await ajoGovernance.hasVoted(1, deployer.address),
        "hasVoted(1, deployer)"
      );
      if (hasVoted.success) {
        console.log(c.dim(`         Deployer Voted: ${hasVoted.data}`));
      }
    }
  }
}

// ================================================================
// MODIFIED DEMO FUNCTIONS WITH INTEGRATED VIEWS
// ================================================================

async function demonstrateJoiningWithVerification(ajo, ajoCollateral, ajoMembers, participants) {
  console.log(c.blue("\n🎯 LIVE: Participants Joining Ajo..."));
  
  const joinResults = [];
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`  ${i + 1}/${participants.length}: ${participant.name} joining...`));
      
      const joinTx = await ajo.connect(participant.signer).joinAjo(0, { gasLimit: 800000 });
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
  
  // INTEGRATED VIEW VERIFICATION
  await verifyJoiningResults(ajo, ajoCollateral, ajoMembers, participants);
  
  return joinResults;
}

async function demonstratePaymentCycleWithVerification(ajo, ajoPayments, participants) {
  console.log(c.blue("\n💳 LIVE: Payment Cycle..."));
  
  // PRE-PAYMENT VERIFICATION
  await showPrePaymentState(ajo, ajoPayments, participants);
  
  const paymentResults = [];
  
  // Monthly payments
  console.log(c.cyan("\n  Phase 1: Monthly Payments"));
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      console.log(c.dim(`    ${participant.name} making payment...`));
      
      const paymentTx = await ajo.connect(participant.signer).processPayment({ gasLimit: 900000 });
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
  console.log(c.cyan("\n  Phase 2: Payout Distribution"));
  try {
    const payoutTx = await ajo.distributePayout({ gasLimit: 400000 });
    const receipt = await payoutTx.wait();
    console.log(c.green(`    ✅ Payout distributed | Gas: ${receipt.gasUsed.toString()}`));
    
  } catch (error) {
    console.log(c.red(`    ❌ Payout failed: ${error.message}`));
  }
  
  // POST-PAYMENT VERIFICATION
  await verifyPaymentResults(ajo, ajoPayments, participants);
  
  return paymentResults;
}

module.exports = {
  showPreJoiningState,
  verifyJoiningResults,
  showPrePaymentState,
  verifyPaymentResults,
  showFactoryState,
  showGovernanceState,
  demonstrateJoiningWithVerification,
  demonstratePaymentCycleWithVerification
};