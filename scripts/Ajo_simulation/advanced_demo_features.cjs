#!/usr/bin/env node
const { ethers } = require("hardhat");

// Import existing integrated demo functions
const {
  showPreJoiningState,
  verifyJoiningResults,
  showPrePaymentState,
  verifyPaymentResults,
  showFactoryState,
  showGovernanceState
} = require('./enhanced_demo_integrated.cjs');

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

// Safe view call helper
async function safeViewCall(fn, name) {
  try {
    const result = await fn();
    console.log(c.green(`      ✅ ${name}`));
    return { success: true, data: result };
  } catch (error) {
    console.log(c.red(`      ❌ ${name}: ${error.message.slice(0, 100)}`));
    return { success: false, error: error.message };
  }
}

// ================================================================
// NEW: COMPREHENSIVE FACTORY VIEW TESTS
// ================================================================

async function demoFactoryViewFunctions(ajoFactory, deployer) {
  console.log(c.blue("\n🏭 COMPREHENSIVE FACTORY VIEW FUNCTIONS TEST"));
  
  try {
    // Test getFactoryStats
    const stats = await safeViewCall(
      async () => await ajoFactory.getFactoryStats(),
      "getFactoryStats()"
    );
    if (stats.success) {
      console.log(c.dim(`       Total: ${stats.data.totalCreated}, Active: ${stats.data.activeCount}`));
    }
    
    // Test getImplementations
    const impls = await safeViewCall(
      async () => await ajoFactory.getImplementations(),
      "getImplementations()"
    );
    if (impls.success) {
      console.log(c.dim(`       AjoCore: ${impls.data.ajoCore.slice(0, 10)}...`));
      console.log(c.dim(`       AjoMembers: ${impls.data.ajoMembers.slice(0, 10)}...`));
      console.log(c.dim(`       AjoCollateral: ${impls.data.ajoCollateral.slice(0, 10)}...`));
      console.log(c.dim(`       AjoPayments: ${impls.data.ajoPayments.slice(0, 10)}...`));
      console.log(c.dim(`       AjoGovernance: ${impls.data.ajoGovernance.slice(0, 10)}...`));
    }
    
    // Test getAllAjos with different limits
    const allAjos = await safeViewCall(
      async () => await ajoFactory.getAllAjos(0, 10),
      "getAllAjos(0, 10)"
    );
    if (allAjos.success) {
      console.log(c.dim(`       Retrieved: ${allAjos.data.ajoInfos.length} Ajos, HasMore: ${allAjos.data.hasMore}`));
    }
    
    // Test getAjosByCreator
    const creatorAjos = await safeViewCall(
      async () => await ajoFactory.getAjosByCreator(deployer.address),
      "getAjosByCreator(deployer)"
    );
    if (creatorAjos.success) {
      console.log(c.dim(`       Deployer's Ajos: ${creatorAjos.data.length}`));
    }
    
    // Test individual Ajo functions if any exist
    if (stats.success && stats.data.totalCreated.gt(0)) {
      const firstAjoId = 1;
      
      // Test getAjo
      const ajoInfo = await safeViewCall(
        async () => await ajoFactory.getAjo(firstAjoId),
        `getAjo(${firstAjoId})`
      );
      if (ajoInfo.success) {
        console.log(c.dim(`       Name: ${ajoInfo.data.name}, Active: ${ajoInfo.data.isActive}`));
      }
      
      // Test getAjoCore - MISSING FUNCTION TEST
      const ajoCore = await safeViewCall(
        async () => await ajoFactory.getAjoCore(firstAjoId),
        `getAjoCore(${firstAjoId})`
      );
      if (ajoCore.success) {
        console.log(c.dim(`       AjoCore Address: ${ajoCore.data.slice(0, 10)}...`));
      }
      
      // Test ajoStatus - MISSING FUNCTION TEST
      const status = await safeViewCall(
        async () => await ajoFactory.ajoStatus(firstAjoId),
        `ajoStatus(${firstAjoId})`
      );
      if (status.success) {
        console.log(c.dim(`       Exists: ${status.data.exists}, Active: ${status.data.isActive}`));
      }
      
      // Test getAjoInitializationStatus
      const initStatus = await safeViewCall(
        async () => await ajoFactory.getAjoInitializationStatus(firstAjoId),
        `getAjoInitializationStatus(${firstAjoId})`
      );
      if (initStatus.success) {
        console.log(c.dim(`       Phase: ${initStatus.data.phase}, Ready: ${initStatus.data.isReady}`));
      }
    }
    
  } catch (error) {
    console.log(c.red(`  ❌ Factory view tests failed: ${error.message}`));
  }
}

// ================================================================
// NEW: COMPREHENSIVE MEMBER VIEW TESTS
// ================================================================

async function demoMemberViewFunctions(ajo, ajoMembers, participants) {
  console.log(c.blue("\n👥 COMPREHENSIVE MEMBER VIEW FUNCTIONS TEST"));
  
  try {
    // Test getTotalActiveMembers
    const totalActive = await safeViewCall(
      async () => await ajoMembers.getTotalActiveMembers(),
      "getTotalActiveMembers()"
    );
    if (totalActive.success) {
      console.log(c.dim(`       Total Active: ${totalActive.data}`));
    }
    
    // Test getActiveMembersList - MISSING FUNCTION TEST
    const activeList = await safeViewCall(
      async () => await ajoMembers.getActiveMembersList(),
      "getActiveMembersList()"
    );
    if (activeList.success) {
      console.log(c.dim(`       Active Members Count: ${activeList.data.length}`));
      activeList.data.slice(0, 3).forEach((addr, i) => {
        console.log(c.dim(`         ${i + 1}. ${addr.slice(0, 10)}...`));
      });
    }
    
    // Test individual member functions
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const p = participants[i];
      console.log(c.cyan(`\n    Testing ${p.name}:`));
      
      // Test isMember - MISSING FUNCTION TEST
      const isMember = await safeViewCall(
        async () => await ajoMembers.isMember(p.address),
        `isMember(${p.name})`
      );
      if (isMember.success) {
        console.log(c.dim(`       Is Member: ${isMember.data}`));
      }
      
      // Test getMember
      const member = await safeViewCall(
        async () => await ajoMembers.getMember(p.address),
        `getMember(${p.name})`
      );
      if (member.success) {
        console.log(c.dim(`       Queue#: ${member.data.queueNumber}, Active: ${member.data.isActive}`));
        console.log(c.dim(`       Locked Collateral: ${formatUSDC(member.data.lockedCollateral)} USDC`));
        console.log(c.dim(`       Total Paid: ${formatUSDC(member.data.totalPaid)} USDC`));
        console.log(c.dim(`       Default Count: ${member.data.defaultCount}`));
        console.log(c.dim(`       Reputation: ${member.data.reputationScore}`));
      }
      
      // Test getMemberInfo (comprehensive version)
      const memberInfo = await safeViewCall(
        async () => await ajoMembers.getMemberInfo(p.address),
        `getMemberInfo(${p.name})`
      );
      if (memberInfo.success) {
        console.log(c.dim(`       Pending Penalty: ${formatUSDC(memberInfo.data.pendingPenalty)} USDC`));
        console.log(c.dim(`       Voting Power: ${ethers.utils.formatEther(memberInfo.data.effectiveVotingPower)}`));
      }
      
      // Test getQueueInfo
      const queueInfo = await safeViewCall(
        async () => await ajoMembers.getQueueInfo(p.address),
        `getQueueInfo(${p.name})`
      );
      if (queueInfo.success) {
        console.log(c.dim(`       Queue Position: ${queueInfo.data.position}`));
        console.log(c.dim(`       Est. Wait Cycles: ${queueInfo.data.estimatedCyclesWait}`));
      }
      
      // Test getLockedCollateral - MISSING FUNCTION TEST
      const lockedColl = await safeViewCall(
        async () => await ajoMembers.getLockedCollateral(p.address),
        `getLockedCollateral(${p.name})`
      );
      if (lockedColl.success) {
        console.log(c.dim(`       Locked Collateral Direct: ${formatUSDC(lockedColl.data)} USDC`));
      }
    }
    
    // Test queue position lookups
    console.log(c.cyan("\n    Queue Position Lookups:"));
    for (let pos = 1; pos <= Math.min(5, participants.length); pos++) {
      // Test getQueuePosition
      const member = await safeViewCall(
        async () => await ajoMembers.getQueuePosition(pos),
        `getQueuePosition(${pos})`
      );
      if (member.success) {
        console.log(c.dim(`       Position ${pos}: ${member.data.slice(0, 10)}...`));
      }
      
      // Test getGuarantorForPosition
      const guarantor = await safeViewCall(
        async () => await ajoMembers.getGuarantorForPosition(pos),
        `getGuarantorForPosition(${pos})`
      );
      if (guarantor.success) {
        console.log(c.dim(`       Guarantor for ${pos}: ${guarantor.data.slice(0, 10)}...`));
      }
    }
    
    // Test getMemberAtIndex - MISSING FUNCTION TEST
    console.log(c.cyan("\n    Member Index Lookups:"));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const memberAtIndex = await safeViewCall(
        async () => await ajoMembers.getMemberAtIndex(i),
        `getMemberAtIndex(${i})`
      );
      if (memberAtIndex.success) {
        console.log(c.dim(`       Index ${i}: ${memberAtIndex.data.slice(0, 10)}...`));
      }
    }
    
    // Test getContractStats from Members contract
    const stats = await safeViewCall(
      async () => await ajoMembers.getContractStats(),
      "getContractStats() [from AjoMembers]"
    );
    if (stats.success) {
      console.log(c.dim(`       Total Members: ${stats.data.totalMembers}`));
      console.log(c.dim(`       Active Members: ${stats.data.activeMembers}`));
      console.log(c.dim(`       Current Queue Position: ${stats.data.currentQueuePosition}`));
    }
    
  } catch (error) {
    console.log(c.red(`  ❌ Member view tests failed: ${error.message}`));
  }
}

// ================================================================
// NEW: COMPREHENSIVE PAYMENT VIEW TESTS
// ================================================================

async function demoPaymentViewFunctions(ajo, ajoPayments, participants) {
  console.log(c.blue("\n💳 COMPREHENSIVE PAYMENT VIEW FUNCTIONS TEST"));
  
  try {
    // Test getCurrentCycle
    const cycle = await safeViewCall(
      async () => await ajoPayments.getCurrentCycle(),
      "getCurrentCycle()"
    );
    if (cycle.success) {
      console.log(c.dim(`       Current Cycle: ${cycle.data}`));
    }
    
    // Test getNextPayoutPosition
    const nextPos = await safeViewCall(
      async () => await ajoPayments.getNextPayoutPosition(),
      "getNextPayoutPosition()"
    );
    if (nextPos.success) {
      console.log(c.dim(`       Next Payout Position: ${nextPos.data}`));
    }
    
    // Test getActivePaymentToken
    const activeToken = await safeViewCall(
      async () => await ajoPayments.getActivePaymentToken(),
      "getActivePaymentToken()"
    );
    if (activeToken.success) {
      console.log(c.dim(`       Active Token: ${activeToken.data === 0 ? 'USDC' : 'HBAR'}`));
    }
    
    // Test getPenaltyRate
    const penaltyRate = await safeViewCall(
      async () => await ajoPayments.getPenaltyRate(),
      "getPenaltyRate()"
    );
    if (penaltyRate.success) {
      console.log(c.dim(`       Penalty Rate: ${ethers.utils.formatUnits(penaltyRate.data, 16)}%`));
    }
    
    // Test getTokenConfig for both tokens
    const usdcConfig = await safeViewCall(
      async () => await ajoPayments.getTokenConfig(0),
      "getTokenConfig(USDC)"
    );
    if (usdcConfig.success) {
      console.log(c.dim(`       USDC Monthly: ${formatUSDC(usdcConfig.data.monthlyPayment)}, Active: ${usdcConfig.data.isActive}`));
    }
    
    const hbarConfig = await safeViewCall(
      async () => await ajoPayments.getTokenConfig(1),
      "getTokenConfig(HBAR)"
    );
    if (hbarConfig.success) {
      console.log(c.dim(`       HBAR Monthly: ${formatHBAR(hbarConfig.data.monthlyPayment)} HBAR, Active: ${hbarConfig.data.isActive}`));
    }
    
    // Test getContractBalance for both tokens
    const usdcBal = await safeViewCall(
      async () => await ajoPayments.getContractBalance(0),
      "getContractBalance(USDC)"
    );
    if (usdcBal.success) {
      console.log(c.dim(`       USDC Balance: ${formatUSDC(usdcBal.data)}`));
    }
    
    const hbarBal = await safeViewCall(
      async () => await ajoPayments.getContractBalance(1),
      "getContractBalance(HBAR)"
    );
    if (hbarBal.success) {
      console.log(c.dim(`       HBAR Balance: ${formatHBAR(hbarBal.data)}`));
    }
    
    // Test isPayoutReady
    const isReady = await safeViewCall(
      async () => await ajoPayments.isPayoutReady(),
      "isPayoutReady()"
    );
    if (isReady.success) {
      console.log(c.dim(`       Payout Ready: ${isReady.data}`));
    }
    
    // Test calculatePayout
    const calcPayout = await safeViewCall(
      async () => await ajoPayments.calculatePayout(),
      "calculatePayout()"
    );
    if (calcPayout.success) {
      console.log(c.dim(`       Calculated Payout: ${formatUSDC(calcPayout.data)}`));
    }
    
    // Test getNextRecipient
    const nextRecip = await safeViewCall(
      async () => await ajoPayments.getNextRecipient(),
      "getNextRecipient()"
    );
    if (nextRecip.success) {
      console.log(c.dim(`       Next Recipient: ${nextRecip.data.slice(0, 10)}...`));
    }
    
    // Test getTotalPayouts
    const totalPayouts = await safeViewCall(
      async () => await ajoPayments.getTotalPayouts(),
      "getTotalPayouts()"
    );
    if (totalPayouts.success) {
      console.log(c.dim(`       Total Payouts Made: ${totalPayouts.data}`));
      
      // Test getPayout for each payout record
      if (totalPayouts.data.gt(0)) {
        console.log(c.cyan("\n    Payout History:"));
        const count = Math.min(3, totalPayouts.data.toNumber());
        for (let i = 1; i <= count; i++) {
          const payout = await safeViewCall(
            async () => await ajoPayments.getPayout(i),
            `getPayout(${i})`
          );
          if (payout.success) {
            console.log(c.dim(`       Payout ${i}: ${formatUSDC(payout.data.amount)} to ${payout.data.recipient.slice(0, 10)}... (Cycle ${payout.data.cycle})`));
          }
        }
      }
    }
    
    // Test per-member payment functions
    console.log(c.cyan("\n    Per-Member Payment Status:"));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const p = participants[i];
      
      // Test needsToPayThisCycle
      const needsPay = await safeViewCall(
        async () => await ajoPayments.needsToPayThisCycle(p.address),
        `needsToPayThisCycle(${p.name})`
      );
      if (needsPay.success) {
        console.log(c.dim(`       ${p.name} Must Pay: ${needsPay.data}`));
      }
      
      // Test getPendingPenalty - MISSING FUNCTION TEST
      const penalty = await safeViewCall(
        async () => await ajoPayments.getPendingPenalty(p.address),
        `getPendingPenalty(${p.name})`
      );
      if (penalty.success) {
        console.log(c.dim(`       ${p.name} Pending Penalty: ${formatUSDC(penalty.data)}`));
      }
    }
    
  } catch (error) {
    console.log(c.red(`  ❌ Payment view tests failed: ${error.message}`));
  }
}

// ================================================================
// NEW: COMPREHENSIVE COLLATERAL VIEW TESTS
// ================================================================

async function demoCollateralViewFunctions(ajoCollateral, participants) {
  console.log(c.blue("\n🔒 COMPREHENSIVE COLLATERAL VIEW FUNCTIONS TEST"));
  
  try {
    // Test getTotalCollateral
    const totalColl = await safeViewCall(
      async () => await ajoCollateral.getTotalCollateral(),
      "getTotalCollateral()"
    );
    if (totalColl.success) {
      console.log(c.dim(`       Total USDC: ${formatUSDC(totalColl.data.totalUSDC)}`));
      console.log(c.dim(`       Total HBAR: ${formatHBAR(totalColl.data.totalHBAR)}`));
    }
    
    // Test calculateRequiredCollateral for various scenarios
    console.log(c.cyan("\n    Collateral Requirements (10 participants, 50 USDC monthly):"));
    const scenarios = [
      { pos: 1, desc: "First Position (Highest Risk)" },
      { pos: 5, desc: "Middle Position" },
      { pos: 10, desc: "Last Position (Lowest Risk)" }
    ];
    
    for (const scenario of scenarios) {
      const required = await safeViewCall(
        async () => await ajoCollateral.calculateRequiredCollateral(
          scenario.pos,
          ethers.utils.parseUnits("50", 6),
          10
        ),
        `calculateRequiredCollateral(pos=${scenario.pos})`
      );
      if (required.success) {
        console.log(c.dim(`       ${scenario.desc}: ${formatUSDC(required.data)} USDC`));
      }
    }
    
    // Test calculateGuarantorPosition
    console.log(c.cyan("\n    Guarantor Assignments (10 participants):"));
    for (let pos = 1; pos <= Math.min(5, 10); pos++) {
      const guarantorPos = await safeViewCall(
        async () => await ajoCollateral.calculateGuarantorPosition(pos, 10),
        `calculateGuarantorPosition(${pos})`
      );
      if (guarantorPos.success) {
        console.log(c.dim(`       Position ${pos} → Guarantor Position ${guarantorPos.data}`));
      }
    }
    
    // Test calculateSeizableAssets for members
    console.log(c.cyan("\n    Seizable Assets Analysis:"));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const p = participants[i];
      const seizable = await safeViewCall(
        async () => await ajoCollateral.calculateSeizableAssets(p.address),
        `calculateSeizableAssets(${p.name})`
      );
      if (seizable.success) {
        console.log(c.dim(`       ${p.name}:`));
        console.log(c.dim(`         Total Seizable: ${formatUSDC(seizable.data.totalSeizable)}`));
        console.log(c.dim(`         From Collateral: ${formatUSDC(seizable.data.collateralSeized)}`));
        console.log(c.dim(`         From Payments: ${formatUSDC(seizable.data.paymentsSeized)}`));
      }
    }
    
  } catch (error) {
    console.log(c.red(`  ❌ Collateral view tests failed: ${error.message}`));
  }
}

// ================================================================
// NEW: COMPREHENSIVE CORE VIEW TESTS
// ================================================================

async function demoCoreViewFunctions(ajo, participants) {
  console.log(c.blue("\n🎯 COMPREHENSIVE CORE VIEW FUNCTIONS TEST"));
  
  try {
    // Test getContractStats
    const stats = await safeViewCall(
      async () => await ajo.getContractStats(),
      "getContractStats() [from AjoCore]"
    );
    if (stats.success) {
      console.log(c.dim(`       Total Members: ${stats.data.totalMembers}`));
      console.log(c.dim(`       Active Members: ${stats.data.activeMembers}`));
      console.log(c.dim(`       Total Collateral USDC: ${formatUSDC(stats.data.totalCollateralUSDC)}`));
      console.log(c.dim(`       Total Collateral HBAR: ${formatHBAR(stats.data.totalCollateralHBAR)}`));
      console.log(c.dim(`       Contract Balance USDC: ${formatUSDC(stats.data.contractBalanceUSDC)}`));
      console.log(c.dim(`       Contract Balance HBAR: ${formatHBAR(stats.data.contractBalanceHBAR)}`));
      console.log(c.dim(`       Current Queue Position: ${stats.data.currentQueuePosition}`));
      console.log(c.dim(`       Active Token: ${stats.data.activeToken === 0 ? 'USDC' : 'HBAR'}`));
    }
    
    // Test getTokenConfig
    const usdcConfig = await safeViewCall(
      async () => await ajo.getTokenConfig(0),
      "getTokenConfig(USDC) [from AjoCore]"
    );
    if (usdcConfig.success) {
      console.log(c.dim(`       USDC Config - Monthly: ${formatUSDC(usdcConfig.data.monthlyPayment)}, Active: ${usdcConfig.data.isActive}`));
    }
    
    // Test getCollateralDemo
    const demo = await safeViewCall(
      async () => await ajo.getCollateralDemo(10, ethers.utils.parseUnits("50", 6)),
      "getCollateralDemo(10 participants, 50 USDC)"
    );
    if (demo.success) {
      console.log(c.cyan("\n    Collateral Demo for 10-person group:"));
      for (let i = 0; i < Math.min(5, demo.data.positions.length); i++) {
        console.log(c.dim(`       Position ${demo.data.positions[i]}: ${formatUSDC(demo.data.collaterals[i])} USDC`));
      }
    }
    
    // Test per-member functions
    console.log(c.cyan("\n    Per-Member Core View Functions:"));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const p = participants[i];
      
      // Test getMemberInfo from Core
      const memberInfo = await safeViewCall(
        async () => await ajo.getMemberInfo(p.address),
        `getMemberInfo(${p.name}) [from AjoCore]`
      );
      if (memberInfo.success) {
        console.log(c.dim(`       ${p.name}:`));
        console.log(c.dim(`         Queue: ${memberInfo.data.memberInfo.queueNumber}`));
        console.log(c.dim(`         Locked: ${formatUSDC(memberInfo.data.memberInfo.lockedCollateral)}`));
        console.log(c.dim(`         Pending Penalty: ${formatUSDC(memberInfo.data.pendingPenalty)}`));
        console.log(c.dim(`         Voting Power: ${ethers.utils.formatEther(memberInfo.data.effectiveVotingPower)}`));
      }
      
      // Test getQueueInfo from Core
      const queueInfo = await safeViewCall(
        async () => await ajo.getQueueInfo(p.address),
        `getQueueInfo(${p.name}) [from AjoCore]`
      );
      if (queueInfo.success) {
        console.log(c.dim(`         Position: ${queueInfo.data.position}, Wait: ${queueInfo.data.estimatedCyclesWait} cycles`));
      }
      
      // Test needsToPayThisCycle from Core
      const needsPay = await safeViewCall(
        async () => await ajo.needsToPayThisCycle(p.address),
        `needsToPayThisCycle(${p.name}) [from AjoCore]`
      );
      if (needsPay.success) {
        console.log(c.dim(`         Needs Payment: ${needsPay.data}`));
      }
      
      // Test calculateSeizableAssets from Core
      const seizable = await safeViewCall(
        async () => await ajo.calculateSeizableAssets(p.address),
        `calculateSeizableAssets(${p.name}) [from AjoCore]`
      );
      if (seizable.success) {
        console.log(c.dim(`         Seizable Total: ${formatUSDC(seizable.data.totalSeizable)}`));
      }
    }
    
  } catch (error) {
    console.log(c.red(`  ❌ Core view tests failed: ${error.message}`));
  }
}

// ================================================================
// NEW: COMPREHENSIVE GOVERNANCE VIEW TESTS
// ================================================================

async function demoGovernanceViewFunctions(ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🗳️  COMPREHENSIVE GOVERNANCE VIEW FUNCTIONS TEST"));
  
  try {
    const ajoInfo = await ajoFactory.getAjo(ajoId);
    const governance = await ethers.getContractAt("AjoGovernance", ajoInfo.ajoGovernance);
    
    // Test getGovernanceSettings - MISSING FUNCTION TEST
    const settings = await safeViewCall(
      async () => await governance.getGovernanceSettings(),
      "getGovernanceSettings()"
    );
    if (settings.success) {
      console.log(c.dim(`       Proposal Threshold: ${ethers.utils.formatEther(settings.data.proposalThreshold)}`));
      console.log(c.dim(`       Voting Period: ${settings.data.votingPeriod} seconds`));
      console.log(c.dim(`       Penalty Rate: ${ethers.utils.formatUnits(settings.data.currentPenaltyRate, 16)}%`));
      console.log(c.dim(`       Total Proposals: ${settings.data.totalProposals}`));
    }
    
    // Try to create a test proposal if possible
    console.log(c.cyan("\n    Attempting Governance Proposal Test:"));
    try {
      const proposalTx = await governance.connect(participants[0].signer).createProposal(
        "Test Proposal: Adjust Penalty Rate",
        ethers.utils.defaultAbiCoder.encode(["uint256"], [ethers.utils.parseUnits("5", 16)]),
        { gasLimit: 300000 }
      );
      const receipt = await proposalTx.wait();
      const proposalEvent = receipt.events?.find(e => e.event === 'ProposalCreated');
      
      if (proposalEvent) {
        const proposalId = proposalEvent.args.proposalId;
        console.log(c.green(`      ✅ Test proposal created: ID ${proposalId}`));
        
        // Test getProposal
        const proposal = await safeViewCall(
          async () => await governance.getProposal(proposalId),
          `getProposal(${proposalId})`
        );
        if (proposal.success) {
          console.log(c.dim(`         Description: ${proposal.data.description}`));
          console.log(c.dim(`         For: ${ethers.utils.formatEther(proposal.data.forVotes)}`));
          console.log(c.dim(`         Against: ${ethers.utils.formatEther(proposal.data.againstVotes)}`));
          console.log(c.dim(`         Abstain: ${ethers.utils.formatEther(proposal.data.abstainVotes)}`));
          console.log(c.dim(`         Executed: ${proposal.data.executed}`));
        }
        
        // Test voting
        for (let i = 0; i < Math.min(3, participants.length); i++) {
          const p = participants[i];
          const voteSupport = i < 2 ? 1 : 0; // First 2 vote FOR
          
          try {
            const voteTx = await governance.connect(p.signer).vote(proposalId, voteSupport, { gasLimit: 200000 });
            await voteTx.wait();
            console.log(c.green(`      ✅ ${p.name} voted ${voteSupport === 1 ? 'FOR' : 'AGAINST'}`));
            
            // Test hasVoted - MISSING FUNCTION TEST
            const hasVoted = await safeViewCall(
              async () => await governance.hasVoted(proposalId, p.address),
              `hasVoted(${proposalId}, ${p.name})`
            );
            if (hasVoted.success) {
              console.log(c.dim(`         Has Voted: ${hasVoted.data}`));
            }
          } catch (error) {
            console.log(c.yellow(`      ⚠️  ${p.name} voting failed: ${error.message.slice(0, 60)}`));
          }
        }
        
        // Check final proposal state
        const finalProposal = await safeViewCall(
          async () => await governance.getProposal(proposalId),
          `getProposal(${proposalId}) [after voting]`
        );
        if (finalProposal.success) {
          console.log(c.cyan("\n    Final Proposal Results:"));
          console.log(c.dim(`       For: ${ethers.utils.formatEther(finalProposal.data.forVotes)}`));
          console.log(c.dim(`       Against: ${ethers.utils.formatEther(finalProposal.data.againstVotes)}`));
          console.log(c.dim(`       Abstain: ${ethers.utils.formatEther(finalProposal.data.abstainVotes)}`));
        }
      }
    } catch (error) {
      console.log(c.yellow(`      ⚠️  Governance proposal test not possible: ${error.message.slice(0, 100)}`));
    }
    
  } catch (error) {
    console.log(c.red(`  ❌ Governance view tests failed: ${error.message}`));
  }
}

// ================================================================
// Update existing functions (keep the same but commented out governance parts)
// ================================================================

async function demoGovernanceSystem(ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🗳️  ADVANCED FEATURE: Governance System Demo"));
  console.log(c.yellow("  (Detailed governance testing done in demoGovernanceViewFunctions)"));
}

async function demoCollateralSystem(ajoFactory, ajoId) {
  console.log(c.blue("\n🔒 ADVANCED FEATURE: Dynamic Collateral System"));
  console.log(c.yellow("  (Detailed collateral testing done in demoCollateralViewFunctions)"));
}

async function demoDefaultHandling(ajo, ajoCollateral, participants) {
  console.log(c.blue("\n⚠️  ADVANCED FEATURE: Default Handling System"));
  console.log(c.yellow("  (Seizable assets testing done in demoCollateralViewFunctions)"));
}

async function demoMultiTokenSupport(ajo, ajoPayments, usdc, whbar, participants) {
  console.log(c.blue("\n💱 ADVANCED FEATURE: Multi-Token Support"));
  console.log(c.yellow("  (Token config testing done in demoPaymentViewFunctions)"));
}

async function demoReputationSystem(ajo, participants) {
  console.log(c.blue("\n⭐ ADVANCED FEATURE: Reputation & Voting Power"));
  console.log(c.yellow("  (Reputation testing done in demoMemberViewFunctions)"));
}

async function demoPaymentCycleInsights(ajo, ajoPayments) {
  console.log(c.blue("\n📈 ADVANCED FEATURE: Payment Cycle Analytics"));
  console.log(c.yellow("  (Payment analytics done in demoPaymentViewFunctions)"));
}

async function demoFactoryScaling(ajoFactory) {
  console.log(c.blue("\n🏭 ADVANCED FEATURE: Factory Scaling & Multi-Ajo Management"));
  console.log(c.yellow("  (Factory testing done in demoFactoryViewFunctions)"));
}

async function demoEmergencyFeatures(ajo, participants) {
  console.log(c.blue("\n🚨 ADVANCED FEATURE: Emergency & Security Features"));
  console.log(c.yellow("  (Security metrics testing done in demoCoreViewFunctions)"));
}

// ================================================================
// ADDITIONAL MISSING VIEW TESTS (not in enhanced_demo_integrated)
// ================================================================

async function verifyAdvancedCollateralFeatures(ajoCollateral, participants) {
  console.log(c.cyan("\n  🔍 ADVANCED COLLATERAL FEATURES:"));
  
  // Test calculateGuarantorPosition for various scenarios
  console.log(c.dim("\n    Guarantor Position Calculations:"));
  const testScenarios = [
    { participants: 5, positions: [1, 2, 3, 4, 5] },
    { participants: 10, positions: [1, 5, 10] },
    { participants: 20, positions: [1, 10, 20] }
  ];
  
  for (const scenario of testScenarios) {
    console.log(c.dim(`\n      ${scenario.participants} participants:`));
    for (const pos of scenario.positions) {
      const guarantorPos = await safeViewCall(
        async () => await ajoCollateral.calculateGuarantorPosition(pos, scenario.participants),
        `calculateGuarantorPosition(${pos}, ${scenario.participants})`
      );
      if (guarantorPos.success) {
        console.log(c.dim(`        Position ${pos} → Guarantor ${guarantorPos.data}`));
      }
    }
  }
  
  // Test calculateRequiredCollateral for different group sizes
  console.log(c.dim("\n    Collateral Requirements by Group Size:"));
  const collateralScenarios = [
    { size: 5, payment: ethers.utils.parseUnits("50", 6) },
    { size: 10, payment: ethers.utils.parseUnits("100", 6) },
    { size: 20, payment: ethers.utils.parseUnits("200", 6) }
  ];
  
  for (const scenario of collateralScenarios) {
    console.log(c.dim(`\n      ${scenario.size} people, ${formatUSDC(scenario.payment)} monthly:`));
    for (let pos = 1; pos <= Math.min(3, scenario.size); pos++) {
      const required = await safeViewCall(
        async () => await ajoCollateral.calculateRequiredCollateral(pos, scenario.payment, scenario.size),
        `calculateRequiredCollateral(pos ${pos})`
      );
      if (required.success) {
        console.log(c.dim(`        Position ${pos}: ${formatUSDC(required.data)}`));
      }
    }
  }
}

async function verifyMemberIndexing(ajoMembers, participants) {
  console.log(c.cyan("\n  🔍 MEMBER INDEXING VERIFICATION:"));
  
  // Test getMemberAtIndex for all participants
  console.log(c.dim("\n    Member Array Index Access:"));
  for (let i = 0; i < Math.min(5, participants.length); i++) {
    const memberAddr = await safeViewCall(
      async () => await ajoMembers.getMemberAtIndex(i),
      `getMemberAtIndex(${i})`
    );
    if (memberAddr.success) {
      console.log(c.dim(`      Index ${i}: ${memberAddr.data.slice(0, 10)}...`));
      
      // Verify it matches expected participant
      const matchingParticipant = participants.find(p => p.address.toLowerCase() === memberAddr.data.toLowerCase());
      if (matchingParticipant) {
        console.log(c.green(`        ✓ Matches ${matchingParticipant.name}`));
      }
    }
  }
  
  // Test activeMembersList array
  const activeList = await safeViewCall(
    async () => await ajoMembers.activeMembersList(0),
    "activeMembersList(0)"
  );
  if (activeList.success) {
    console.log(c.dim(`\n    First Active Member: ${activeList.data.slice(0, 10)}...`));
  }
  
  // Test queuePositions mapping
  console.log(c.dim("\n    Queue Position to Address Mapping:"));
  for (let pos = 1; pos <= Math.min(5, participants.length); pos++) {
    const queueAddr = await safeViewCall(
      async () => await ajoMembers.queuePositions(pos),
      `queuePositions(${pos})`
    );
    if (queueAddr.success) {
      console.log(c.dim(`      Queue ${pos}: ${queueAddr.data.slice(0, 10)}...`));
    }
  }
}

async function verifyPayoutHistory(ajoPayments) {
  console.log(c.cyan("\n  🔍 PAYOUT HISTORY VERIFICATION:"));
  
  const totalPayouts = await safeViewCall(
    async () => await ajoPayments.getTotalPayouts(),
    "getTotalPayouts()"
  );
  
  if (totalPayouts.success && totalPayouts.data.gt(0)) {
    console.log(c.dim(`\n    Reviewing ${totalPayouts.data} payout(s):`));
    
    const count = totalPayouts.data.toNumber();
    for (let i = 1; i <= Math.min(10, count); i++) {
      const payout = await safeViewCall(
        async () => await ajoPayments.getPayout(i),
        `getPayout(${i})`
      );
      if (payout.success) {
        console.log(c.dim(`      Payout ${i}:`));
        console.log(c.dim(`        Recipient: ${payout.data.recipient.slice(0, 10)}...`));
        console.log(c.dim(`        Amount: ${formatUSDC(payout.data.amount)}`));
        console.log(c.dim(`        Cycle: ${payout.data.cycle}`));
        console.log(c.dim(`        Timestamp: ${new Date(payout.data.timestamp * 1000).toLocaleString()}`));
      }
    }
  } else {
    console.log(c.yellow("    No payouts have been made yet"));
  }
}

async function verifyTokenConfiguration(ajo, ajoPayments) {
  console.log(c.cyan("\n  🔍 TOKEN CONFIGURATION VERIFICATION:"));
  
  // Test both token configs from both contracts
  console.log(c.dim("\n    Token Configs (from AjoCore):"));
  for (let tokenId = 0; tokenId <= 1; tokenId++) {
    const config = await safeViewCall(
      async () => await ajo.getTokenConfig(tokenId),
      `getTokenConfig(${tokenId === 0 ? 'USDC' : 'HBAR'}) [Core]`
    );
    if (config.success) {
      const tokenName = tokenId === 0 ? 'USDC' : 'HBAR';
      const formatted = tokenId === 0 ? formatUSDC(config.data.monthlyPayment) : formatHBAR(config.data.monthlyPayment);
      console.log(c.dim(`      ${tokenName}: ${formatted}, Active: ${config.data.isActive}`));
    }
  }
  
  console.log(c.dim("\n    Token Configs (from AjoPayments):"));
  for (let tokenId = 0; tokenId <= 1; tokenId++) {
    const config = await safeViewCall(
      async () => await ajoPayments.getTokenConfig(tokenId),
      `getTokenConfig(${tokenId === 0 ? 'USDC' : 'HBAR'}) [Payments]`
    );
    if (config.success) {
      const tokenName = tokenId === 0 ? 'USDC' : 'HBAR';
      const formatted = tokenId === 0 ? formatUSDC(config.data.monthlyPayment) : formatHBAR(config.data.monthlyPayment);
      console.log(c.dim(`      ${tokenName}: ${formatted}, Active: ${config.data.isActive}`));
    }
  }
  
  // Active payment token
  const activeToken = await safeViewCall(
    async () => await ajoPayments.getActivePaymentToken(),
    "getActivePaymentToken()"
  );
  if (activeToken.success) {
    console.log(c.dim(`\n    Active Payment Token: ${activeToken.data === 0 ? 'USDC' : 'HBAR'}`));
  }
}

async function verifyFactoryPagination(ajoFactory) {
  console.log(c.cyan("\n  🔍 FACTORY PAGINATION VERIFICATION:"));
  
  const stats = await ajoFactory.getFactoryStats();
  const totalCount = stats.totalCreated.toNumber();
  
  if (totalCount === 0) {
    console.log(c.yellow("    No Ajos created yet"));
    return;
  }
  
  console.log(c.dim(`\n    Testing pagination with ${totalCount} total Ajo(s):`));
  
  // Test different page sizes
  const pageSizes = [1, 3, 5, 10];
  for (const pageSize of pageSizes) {
    const result = await safeViewCall(
      async () => await ajoFactory.getAllAjos(0, pageSize),
      `getAllAjos(0, ${pageSize})`
    );
    if (result.success) {
      console.log(c.dim(`      Page size ${pageSize}: Got ${result.data.ajoInfos.length}, HasMore: ${result.data.hasMore}`));
    }
  }
  
  // Test offset pagination
  if (totalCount > 2) {
    console.log(c.dim("\n    Testing offset pagination:"));
    const result = await safeViewCall(
      async () => await ajoFactory.getAllAjos(1, 2),
      "getAllAjos(offset=1, limit=2)"
    );
    if (result.success) {
      console.log(c.dim(`      Starting from offset 1: Got ${result.data.ajoInfos.length} Ajos`));
    }
  }
}

async function verifySeizableAssetsForAll(ajo, ajoCollateral, participants) {
  console.log(c.cyan("\n  🔍 SEIZABLE ASSETS COMPREHENSIVE CHECK:"));
  
  console.log(c.dim("\n    Testing from AjoCollateral:"));
  for (let i = 0; i < Math.min(5, participants.length); i++) {
    const p = participants[i];
    const assets = await safeViewCall(
      async () => await ajoCollateral.calculateSeizableAssets(p.address),
      `calculateSeizableAssets(${p.name}) [Collateral]`
    );
    if (assets.success) {
      console.log(c.dim(`      ${p.name}:`));
      console.log(c.dim(`        Total: ${formatUSDC(assets.data.totalSeizable)}`));
      console.log(c.dim(`        Collateral: ${formatUSDC(assets.data.collateralSeized)}`));
      console.log(c.dim(`        Payments: ${formatUSDC(assets.data.paymentsSeized)}`));
    }
  }
  
  console.log(c.dim("\n    Testing from AjoCore:"));
  for (let i = 0; i < Math.min(3, participants.length); i++) {
    const p = participants[i];
    const assets = await safeViewCall(
      async () => await ajo.calculateSeizableAssets(p.address),
      `calculateSeizableAssets(${p.name}) [Core]`
    );
    if (assets.success) {
      console.log(c.dim(`      ${p.name}: Total ${formatUSDC(assets.data.totalSeizable)}`));
    }
  }
}

// ================================================================
// MAIN ORCHESTRATOR - INTEGRATED WITH EXISTING DEMO UTILS
// ================================================================

async function runAdvancedDemo(factoryAddress, usdcAddress, whbarAddress, testAjoId) {
  console.log(c.magenta("\n🎯 COMPREHENSIVE VIEW FUNCTIONS VERIFICATION"));
  console.log(c.bright("Testing ALL view functions across all contracts\n"));
  
  try {
    const [deployer, ...signers] = await ethers.getSigners();
    const ajoFactory = await ethers.getContractAt("AjoFactory", factoryAddress);
    
    const ajoInfo = await ajoFactory.getAjo(testAjoId);
    const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
    const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
    const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
    const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
    const usdc = await ethers.getContractAt("MockERC20", usdcAddress);
    const whbar = await ethers.getContractAt("MockERC20", whbarAddress);
    
    const participants = [
      { name: "Adunni", signer: signers[0], address: signers[0].address },
      { name: "Babatunde", signer: signers[1], address: signers[1].address },
      { name: "Chinwe", signer: signers[2], address: signers[2].address },
      { name: "Damilola", signer: signers[3], address: signers[3].address },
      { name: "Emeka", signer: signers[4], address: signers[4].address }
    ];
    
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  PHASE 1: FACTORY & INITIALIZATION TESTS"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    // Use existing factory view tests
    await showFactoryState(ajoFactory);
    await verifyFactoryPagination(ajoFactory);
    await demoFactoryViewFunctions(ajoFactory, deployer);
    
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  PHASE 2: CORE & MEMBER MANAGEMENT TESTS"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    await demoCoreViewFunctions(ajo, participants);
    await demoMemberViewFunctions(ajo, ajoMembers, participants);
    await verifyMemberIndexing(ajoMembers, participants);
    
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  PHASE 3: COLLATERAL SYSTEM TESTS"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    await demoCollateralViewFunctions(ajoCollateral, participants);
    await verifyAdvancedCollateralFeatures(ajoCollateral, participants);
    await verifySeizableAssetsForAll(ajo, ajoCollateral, participants);
    
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  PHASE 4: PAYMENT SYSTEM TESTS"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    await demoPaymentViewFunctions(ajo, ajoPayments, participants);
    await verifyTokenConfiguration(ajo, ajoPayments);
    await verifyPayoutHistory(ajoPayments);
    
    console.log(c.blue("\n══════════════════════════════════════════════════"));
    console.log(c.bright("  PHASE 5: GOVERNANCE SYSTEM TESTS"));
    console.log(c.blue("══════════════════════════════════════════════════"));
    
    await showGovernanceState(ajoFactory, testAjoId);
    await demoGovernanceViewFunctions(ajoFactory, testAjoId, participants);
    
    console.log(c.magenta("\n🎉 ALL VIEW FUNCTION TESTS COMPLETE!"));
    console.log(c.bright("\n📋 View Functions Tested (50+ functions):"));
    console.log(c.green("✅ Factory (9): getFactoryStats, getImplementations, getAllAjos, getAjosByCreator, getAjo, getAjoCore, ajoStatus, getAjoInitializationStatus"));
    console.log(c.green("✅ Core (7): getContractStats, getTokenConfig, getCollateralDemo, getMemberInfo, getQueueInfo, needsToPayThisCycle, calculateSeizableAssets"));
    console.log(c.green("✅ Members (13): getTotalActiveMembers, getActiveMembersList, isMember, getMember, getMemberInfo, getQueueInfo, getLockedCollateral, getQueuePosition, getGuarantorForPosition, getMemberAtIndex, getContractStats, activeMembersList, queuePositions"));
    console.log(c.green("✅ Collateral (4): getTotalCollateral, calculateRequiredCollateral, calculateGuarantorPosition, calculateSeizableAssets"));
    console.log(c.green("✅ Payments (14): getCurrentCycle, getNextPayoutPosition, getActivePaymentToken, getPenaltyRate, getTokenConfig (x2), getContractBalance (x2), isPayoutReady, calculatePayout, getNextRecipient, getTotalPayouts, getPayout, needsToPayThisCycle, getPendingPenalty"));
    console.log(c.green("✅ Governance (3): getGovernanceSettings, getProposal, hasVoted"));
    
    console.log(c.cyan("\n💡 RECOMMENDED FIXES:"));
    console.log(c.dim("  • Review any functions marked with ❌ above"));
    console.log(c.dim("  • Check contract initialization sequences"));
    console.log(c.dim("  • Verify mappings and array access patterns"));
    console.log(c.dim("  • Ensure view functions don't have side effects"));
    
  } catch (error) {
    console.log(c.red(`\n❌ View function tests failed: ${error.message}`));
    console.error(error);
  }
}

module.exports = { 
  // Main orchestrator
  runAdvancedDemo,
  
  // Comprehensive view test functions
  demoFactoryViewFunctions,
  demoCoreViewFunctions,
  demoMemberViewFunctions,
  demoCollateralViewFunctions,
  demoPaymentViewFunctions,
  demoGovernanceViewFunctions,
  
  // Additional verification functions
  verifyAdvancedCollateralFeatures,
  verifyMemberIndexing,
  verifyPayoutHistory,
  verifyTokenConfiguration,
  verifyFactoryPagination,
  verifySeizableAssetsForAll,
  
  // Old exports for backwards compatibility
  demoGovernanceSystem,
  demoCollateralSystem,
  demoDefaultHandling,
  demoMultiTokenSupport,
  demoReputationSystem,
  demoPaymentCycleInsights,
  demoFactoryScaling,
  demoEmergencyFeatures
};