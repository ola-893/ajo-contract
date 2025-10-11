#!/usr/bin/env node
const { ethers } = require("hardhat");

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

// Track test results
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function logTest(name, success, details = "") {
  if (success) {
    testResults.passed++;
    console.log(c.green(`    ✅ ${name}`));
    if (details) console.log(c.dim(`       ${details}`));
  } else {
    testResults.failed++;
    console.log(c.red(`    ❌ ${name}`));
    if (details) console.log(c.dim(`       ${details}`));
    testResults.errors.push({ test: name, error: details });
  }
}

// ================================================================
// AjoCore VIEW FUNCTIONS TESTING
// ================================================================

async function testAjoCoreViews(ajo, ajoId, participants) {
  console.log(c.blue("\n🔍 Testing AjoCore View Functions..."));
  
  try {
    // Test getQueueInfo for each participant
    console.log(c.cyan("\n  Testing getQueueInfo()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const queueInfo = await ajo.getQueueInfo(participant.address);
        logTest(
          `getQueueInfo(${participant.name})`,
          true,
          `Position: ${queueInfo.position}, Est. Cycles Wait: ${queueInfo.estimatedCyclesWait}`
        );
      } catch (error) {
        logTest(`getQueueInfo(${participant.name})`, false, error.message);
      }
    }
    
    // Test needsToPayThisCycle
    console.log(c.cyan("\n  Testing needsToPayThisCycle()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const needsPay = await ajo.needsToPayThisCycle(participant.address);
        logTest(
          `needsToPayThisCycle(${participant.name})`,
          true,
          `Needs to pay: ${needsPay}`
        );
      } catch (error) {
        logTest(`needsToPayThisCycle(${participant.name})`, false, error.message);
      }
    }
    
    // Test getContractStats
    console.log(c.cyan("\n  Testing getContractStats()..."));
    try {
      const stats = await ajo.getContractStats();
      logTest(
        "getContractStats()",
        true,
        `Total: ${stats.totalMembers}, Active: ${stats.activeMembers}, Queue: ${stats.currentQueuePosition}, USDC: ${formatUSDC(stats.contractBalanceUSDC)}`
      );
    } catch (error) {
      logTest("getContractStats()", false, error.message);
    }
    
    // Test getTokenConfig for both tokens
    console.log(c.cyan("\n  Testing getTokenConfig()..."));
    try {
      const usdcConfig = await ajo.getTokenConfig(0); // USDC
      logTest(
        "getTokenConfig(USDC)",
        true,
        `Monthly: ${formatUSDC(usdcConfig.monthlyPayment)}, Active: ${usdcConfig.isActive}`
      );
    } catch (error) {
      logTest("getTokenConfig(USDC)", false, error.message);
    }
    
    try {
      const hbarConfig = await ajo.getTokenConfig(1); // HBAR
      logTest(
        "getTokenConfig(HBAR)",
        true,
        `Monthly: ${formatHBAR(hbarConfig.monthlyPayment)}, Active: ${hbarConfig.isActive}`
      );
    } catch (error) {
      logTest("getTokenConfig(HBAR)", false, error.message);
    }
    
    // Test getCollateralDemo
    console.log(c.cyan("\n  Testing getCollateralDemo()..."));
    try {
      const demo = await ajo.getCollateralDemo(10, ethers.utils.parseUnits("50", 6));
      logTest(
        "getCollateralDemo(10 participants, 50 USDC)",
        demo.positions.length === 10,
        `Positions: [${demo.positions.slice(0, 3).join(", ")}...], Collaterals: [${demo.collaterals.slice(0, 3).map(c => formatUSDC(c)).join(", ")}...]`
      );
    } catch (error) {
      logTest("getCollateralDemo()", false, error.message);
    }
    
    // Test calculateSeizableAssets
    console.log(c.cyan("\n  Testing calculateSeizableAssets()..."));
    if (participants.length > 0) {
      try {
        const assets = await ajo.calculateSeizableAssets(participants[0].address);
        logTest(
          `calculateSeizableAssets(${participants[0].name})`,
          true,
          `Total: ${formatUSDC(assets.totalSeizable)}, Collateral: ${formatUSDC(assets.collateralSeized)}, Payments: ${formatUSDC(assets.paymentsSeized)}`
        );
      } catch (error) {
        logTest(`calculateSeizableAssets()`, false, error.message);
      }
    }
    
  } catch (error) {
    console.log(c.red(`\n  ❌ AjoCore view tests failed: ${error.message}`));
  }
}

// ================================================================
// AjoGovernanceHCS VIEW FUNCTIONS TESTING
// ================================================================

async function testAjoGovernanceViews(ajoFactory, ajoId) {
  console.log(c.blue("\n🔍 Testing AjoGovernanceHCS View Functions..."));
  
  try {
    const ajoInfo = await ajoFactory.getAjo(ajoId);
    const ajoGovernanceHCS = await ethers.getContractAt("AjoGovernanceHCS", ajoInfo.ajoGovernanceHCS);
    
    // Test getGovernanceSettings
    console.log(c.cyan("\n  Testing getGovernanceSettings()..."));
    try {
      const settings = await ajoGovernanceHCS.getGovernanceSettings();
      logTest(
        "getGovernanceSettings()",
        true,
        `Threshold: ${settings.proposalThreshold}, Period: ${settings.votingPeriod}, Penalty: ${settings.currentPenaltyRate}%, Total Proposals: ${settings.totalProposals}`
      );
      
      // If there are proposals, test getProposal and hasVoted
      if (settings.totalProposals.gt(0)) {
        console.log(c.cyan("\n  Testing getProposal()..."));
        try {
          const proposal = await ajoGovernanceHCS.getProposal(1);
          logTest(
            "getProposal(1)",
            true,
            `For: ${proposal.forVotes}, Against: ${proposal.againstVotes}, Executed: ${proposal.executed}`
          );
        } catch (error) {
          logTest("getProposal(1)", false, error.message);
        }
        
        console.log(c.cyan("\n  Testing hasVoted()..."));
        const [deployer] = await ethers.getSigners();
        try {
          const voted = await ajoGovernanceHCS.hasVoted(1, deployer.address);
          logTest(
            "hasVoted(1, deployer)",
            true,
            `Has voted: ${voted}`
          );
        } catch (error) {
          logTest("hasVoted()", false, error.message);
        }
      } else {
        console.log(c.dim("       No proposals yet - skipping proposal-specific tests"));
      }
      
    } catch (error) {
      logTest("getGovernanceSettings()", false, error.message);
    }
    
  } catch (error) {
    console.log(c.red(`\n  ❌ AjoGovernanceHCS view tests failed: ${error.message}`));
  }
}

// ================================================================
// AjoCollateral VIEW FUNCTIONS TESTING
// ================================================================

async function testAjoCollateralViews(ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🔍 Testing AjoCollateral View Functions..."));
  
  try {
    const ajoInfo = await ajoFactory.getAjo(ajoId);
    const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
    
    // Test calculateRequiredCollateral
    console.log(c.cyan("\n  Testing calculateRequiredCollateral()..."));
    for (let pos = 1; pos <= Math.min(5, 10); pos++) {
      try {
        const required = await ajoCollateral.calculateRequiredCollateral(
          pos,
          ethers.utils.parseUnits("50", 6),
          10
        );
        logTest(
          `calculateRequiredCollateral(pos ${pos})`,
          true,
          `Required: ${formatUSDC(required)} USDC`
        );
      } catch (error) {
        logTest(`calculateRequiredCollateral(pos ${pos})`, false, error.message);
      }
    }
    
    // Test calculateGuarantorPosition
    console.log(c.cyan("\n  Testing calculateGuarantorPosition()..."));
    for (let pos = 1; pos <= Math.min(3, 10); pos++) {
      try {
        const guarantorPos = await ajoCollateral.calculateGuarantorPosition(pos, 10);
        logTest(
          `calculateGuarantorPosition(member ${pos})`,
          true,
          `Guarantor at position: ${guarantorPos}`
        );
      } catch (error) {
        logTest(`calculateGuarantorPosition(${pos})`, false, error.message);
      }
    }
    
    // Test getTotalCollateral
    console.log(c.cyan("\n  Testing getTotalCollateral()..."));
    try {
      const totals = await ajoCollateral.getTotalCollateral();
      logTest(
        "getTotalCollateral()",
        true,
        `USDC: ${formatUSDC(totals.totalUSDC)}, HBAR: ${formatHBAR(totals.totalHBAR)}`
      );
    } catch (error) {
      logTest("getTotalCollateral()", false, error.message);
    }
    
    // Test calculateSeizableAssets
    console.log(c.cyan("\n  Testing calculateSeizableAssets()..."));
    if (participants.length > 0) {
      try {
        const assets = await ajoCollateral.calculateSeizableAssets(participants[0].address);
        logTest(
          `calculateSeizableAssets(${participants[0].name})`,
          true,
          `Total: ${formatUSDC(assets.totalSeizable)}, Collateral: ${formatUSDC(assets.collateralSeized)}, Payments: ${formatUSDC(assets.paymentsSeized)}`
        );
      } catch (error) {
        logTest(`calculateSeizableAssets()`, false, error.message);
      }
    }
    
  } catch (error) {
    console.log(c.red(`\n  ❌ AjoCollateral view tests failed: ${error.message}`));
  }
}

// ================================================================
// AjoPayments VIEW FUNCTIONS TESTING
// ================================================================

async function testAjoPaymentsViews(ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🔍 Testing AjoPayments View Functions..."));
  
  try {
    const ajoInfo = await ajoFactory.getAjo(ajoId);
    const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
    
    // Test getCurrentCycle
    console.log(c.cyan("\n  Testing getCurrentCycle()..."));
    try {
      const cycle = await ajoPayments.getCurrentCycle();
      logTest("getCurrentCycle()", true, `Current cycle: ${cycle}`);
    } catch (error) {
      logTest("getCurrentCycle()", false, error.message);
    }
    
    // Test getNextPayoutPosition
    console.log(c.cyan("\n  Testing getNextPayoutPosition()..."));
    try {
      const position = await ajoPayments.getNextPayoutPosition();
      logTest("getNextPayoutPosition()", true, `Next position: ${position}`);
    } catch (error) {
      logTest("getNextPayoutPosition()", false, error.message);
    }
    
    // Test getActivePaymentToken
    console.log(c.cyan("\n  Testing getActivePaymentToken()..."));
    try {
      const token = await ajoPayments.getActivePaymentToken();
      logTest("getActivePaymentToken()", true, `Token: ${token === 0 ? 'USDC' : 'HBAR'}`);
    } catch (error) {
      logTest("getActivePaymentToken()", false, error.message);
    }
    
    // Test getPenaltyRate
    console.log(c.cyan("\n  Testing getPenaltyRate()..."));
    try {
      const rate = await ajoPayments.getPenaltyRate();
      logTest("getPenaltyRate()", true, `Penalty rate: ${rate}%`);
    } catch (error) {
      logTest("getPenaltyRate()", false, error.message);
    }
    
    // Test getContractBalance
    console.log(c.cyan("\n  Testing getContractBalance()..."));
    try {
      const usdcBalance = await ajoPayments.getContractBalance(0);
      logTest("getContractBalance(USDC)", true, `Balance: ${formatUSDC(usdcBalance)}`);
    } catch (error) {
      logTest("getContractBalance(USDC)", false, error.message);
    }
    
    try {
      const hbarBalance = await ajoPayments.getContractBalance(1);
      logTest("getContractBalance(HBAR)", true, `Balance: ${formatHBAR(hbarBalance)}`);
    } catch (error) {
      logTest("getContractBalance(HBAR)", false, error.message);
    }
    
    // Test getTotalPayouts
    console.log(c.cyan("\n  Testing getTotalPayouts()..."));
    try {
      const total = await ajoPayments.getTotalPayouts();
      logTest("getTotalPayouts()", true, `Total payouts: ${total}`);
    } catch (error) {
      logTest("getTotalPayouts()", false, error.message);
    }
    
    // Test isPayoutReady
    console.log(c.cyan("\n  Testing isPayoutReady()..."));
    try {
      const ready = await ajoPayments.isPayoutReady();
      logTest("isPayoutReady()", true, `Ready: ${ready}`);
    } catch (error) {
      logTest("isPayoutReady()", false, error.message);
    }
    
    // Test calculatePayout
    console.log(c.cyan("\n  Testing calculatePayout()..."));
    try {
      const payout = await ajoPayments.calculatePayout();
      logTest("calculatePayout()", true, `Amount: ${formatUSDC(payout)}`);
    } catch (error) {
      logTest("calculatePayout()", false, error.message);
    }
    
    // Test getNextRecipient
    console.log(c.cyan("\n  Testing getNextRecipient()..."));
    try {
      const recipient = await ajoPayments.getNextRecipient();
      logTest("getNextRecipient()", true, `Address: ${recipient}`);
    } catch (error) {
      logTest("getNextRecipient()", false, error.message);
    }
    
    // Test needsToPayThisCycle for participants
    console.log(c.cyan("\n  Testing needsToPayThisCycle()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const needs = await ajoPayments.needsToPayThisCycle(participant.address);
        logTest(
          `needsToPayThisCycle(${participant.name})`,
          true,
          `Needs payment: ${needs}`
        );
      } catch (error) {
        logTest(`needsToPayThisCycle(${participant.name})`, false, error.message);
      }
    }
    
    // Test getPendingPenalty
    console.log(c.cyan("\n  Testing getPendingPenalty()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const penalty = await ajoPayments.getPendingPenalty(participant.address);
        logTest(
          `getPendingPenalty(${participant.name})`,
          true,
          `Penalty: ${formatUSDC(penalty)}`
        );
      } catch (error) {
        logTest(`getPendingPenalty(${participant.name})`, false, error.message);
      }
    }
    
    // Test getTokenConfig
    console.log(c.cyan("\n  Testing getTokenConfig()..."));
    try {
      const usdcConfig = await ajoPayments.getTokenConfig(0);
      logTest(
        "getTokenConfig(USDC)",
        true,
        `Monthly: ${formatUSDC(usdcConfig.monthlyPayment)}, Active: ${usdcConfig.isActive}`
      );
    } catch (error) {
      logTest("getTokenConfig(USDC)", false, error.message);
    }
    
    // Test getPayout (if there are payouts)
    try {
      const totalPayouts = await ajoPayments.getTotalPayouts();
      if (totalPayouts.gt(0)) {
        console.log(c.cyan("\n  Testing getPayout()..."));
        const payoutRecord = await ajoPayments.getPayout(1);
        logTest(
          "getPayout(1)",
          true,
          `Recipient: ${payoutRecord.recipient}, Amount: ${formatUSDC(payoutRecord.amount)}, Cycle: ${payoutRecord.cycle}`
        );
      }
    } catch (error) {
      // Silently skip if no payouts yet
    }
    
  } catch (error) {
    console.log(c.red(`\n  ❌ AjoPayments view tests failed: ${error.message}`));
  }
}

// ================================================================
// AjoMembers VIEW FUNCTIONS TESTING
// ================================================================

async function testAjoMembersViews(ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🔍 Testing AjoMembers View Functions..."));
  
  try {
    const ajoInfo = await ajoFactory.getAjo(ajoId);
    const ajoMembers = await ethers.getContractAt("AjoMembers", ajoInfo.ajoMembers);
    
    // Test getTotalActiveMembers
    console.log(c.cyan("\n  Testing getTotalActiveMembers()..."));
    try {
      const total = await ajoMembers.getTotalActiveMembers();
      logTest("getTotalActiveMembers()", true, `Total: ${total}`);
    } catch (error) {
      logTest("getTotalActiveMembers()", false, error.message);
    }
    
    // Test getMember for participants
    console.log(c.cyan("\n  Testing getMember()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const member = await ajoMembers.getMember(participant.address);
        logTest(
          `getMember(${participant.name})`,
          true,
          `Queue: ${member.queueNumber}, Paid: ${formatUSDC(member.totalPaid)}, Collateral: ${formatUSDC(member.lockedCollateral)}`
        );
      } catch (error) {
        logTest(`getMember(${participant.name})`, false, error.message);
      }
    }
    
    // Test isMember
    console.log(c.cyan("\n  Testing isMember()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const is = await ajoMembers.isMember(participant.address);
        logTest(
          `isMember(${participant.name})`,
          true,
          `Is member: ${is}`
        );
      } catch (error) {
        logTest(`isMember(${participant.name})`, false, error.message);
      }
    }
    
    // Test getActiveMembersList
    console.log(c.cyan("\n  Testing getActiveMembersList()..."));
    try {
      const list = await ajoMembers.getActiveMembersList();
      logTest(
        "getActiveMembersList()",
        true,
        `Count: ${list.length}, First: ${list[0] || 'none'}`
      );
    } catch (error) {
      logTest("getActiveMembersList()", false, error.message);
    }
    
    // Test getQueuePosition
    console.log(c.cyan("\n  Testing getQueuePosition()..."));
    for (let pos = 1; pos <= Math.min(3, participants.length); pos++) {
      try {
        const address = await ajoMembers.getQueuePosition(pos);
        logTest(
          `getQueuePosition(${pos})`,
          true,
          `Address: ${address}`
        );
      } catch (error) {
        logTest(`getQueuePosition(${pos})`, false, error.message);
      }
    }
    
    // Test getGuarantorForPosition
    console.log(c.cyan("\n  Testing getGuarantorForPosition()..."));
    for (let pos = 1; pos <= Math.min(3, participants.length); pos++) {
      try {
        const guarantor = await ajoMembers.getGuarantorForPosition(pos);
        logTest(
          `getGuarantorForPosition(${pos})`,
          true,
          `Guarantor: ${guarantor}`
        );
      } catch (error) {
        logTest(`getGuarantorForPosition(${pos})`, false, error.message);
      }
    }
    
    // Test getLockedCollateral
    console.log(c.cyan("\n  Testing getLockedCollateral()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const locked = await ajoMembers.getLockedCollateral(participant.address);
        logTest(
          `getLockedCollateral(${participant.name})`,
          true,
          `Locked: ${formatUSDC(locked)}`
        );
      } catch (error) {
        logTest(`getLockedCollateral(${participant.name})`, false, error.message);
      }
    }
    
    // Test getMemberAtIndex
    console.log(c.cyan("\n  Testing getMemberAtIndex()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      try {
        const address = await ajoMembers.getMemberAtIndex(i);
        logTest(
          `getMemberAtIndex(${i})`,
          true,
          `Address: ${address}`
        );
      } catch (error) {
        logTest(`getMemberAtIndex(${i})`, false, error.message);
      }
    }
    
    // Test queuePositions
    console.log(c.cyan("\n  Testing queuePositions()..."));
    for (let pos = 1; pos <= Math.min(3, participants.length); pos++) {
      try {
        const address = await ajoMembers.queuePositions(pos);
        logTest(
          `queuePositions(${pos})`,
          true,
          `Address: ${address}`
        );
      } catch (error) {
        logTest(`queuePositions(${pos})`, false, error.message);
      }
    }
    
    // Test activeMembersList
    console.log(c.cyan("\n  Testing activeMembersList()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      try {
        const address = await ajoMembers.activeMembersList(i);
        logTest(
          `activeMembersList(${i})`,
          true,
          `Address: ${address}`
        );
      } catch (error) {
        logTest(`activeMembersList(${i})`, false, error.message);
      }
    }
    
    // Test getContractStats
    console.log(c.cyan("\n  Testing getContractStats()..."));
    try {
      const stats = await ajoMembers.getContractStats();
      logTest(
        "getContractStats()",
        true,
        `Total: ${stats.totalMembers}, Active: ${stats.activeMembers}, Queue: ${stats.currentQueuePosition}`
      );
    } catch (error) {
      logTest("getContractStats()", false, error.message);
    }
    
    // Test getQueueInfo
    console.log(c.cyan("\n  Testing getQueueInfo()..."));
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      const participant = participants[i];
      try {
        const info = await ajoMembers.getQueueInfo(participant.address);
        logTest(
          `getQueueInfo(${participant.name})`,
          true,
          `Position: ${info.position}, Wait: ${info.estimatedCyclesWait} cycles`
        );
      } catch (error) {
        logTest(`getQueueInfo(${participant.name})`, false, error.message);
      }
    }
    
  } catch (error) {
    console.log(c.red(`\n  ❌ AjoMembers view tests failed: ${error.message}`));
  }
}

// ================================================================
// AjoFactory VIEW FUNCTIONS TESTING
// ================================================================

async function testAjoFactoryViews(ajoFactory) {
  console.log(c.blue("\n🔍 Testing AjoFactory View Functions..."));
  
  try {
    // Test getAllAjos
    console.log(c.cyan("\n  Testing getAllAjos()..."));
    try {
      const result = await ajoFactory.getAllAjos(0, 10);
      logTest(
        "getAllAjos(0, 10)",
        true,
        `Count: ${result.ajoInfos.length}, HasMore: ${result.hasMore}`
      );
    } catch (error) {
      logTest("getAllAjos()", false, error.message);
    }
    
    // Test getAjosByCreator
    console.log(c.cyan("\n  Testing getAjosByCreator()..."));
    const [deployer] = await ethers.getSigners();
    try {
      const ajoIds = await ajoFactory.getAjosByCreator(deployer.address);
      logTest(
        `getAjosByCreator(deployer)`,
        true,
        `Count: ${ajoIds.length}, IDs: [${ajoIds.slice(0, 3).join(", ")}]`
      );
    } catch (error) {
      logTest("getAjosByCreator()", false, error.message);
    }
    
    // Test getAjoCore
    console.log(c.cyan("\n  Testing getAjoCore()..."));
    const stats = await ajoFactory.getFactoryStats();
    if (stats.totalCreated.gt(0)) {
      try {
        const coreAddress = await ajoFactory.getAjoCore(1);
        logTest(
          "getAjoCore(1)",
          true,
          `Address: ${coreAddress}`
        );
      } catch (error) {
        logTest("getAjoCore(1)", false, error.message);
      }
    }
    
    // Test ajoStatus
    console.log(c.cyan("\n  Testing ajoStatus()..."));
    if (stats.totalCreated.gt(0)) {
      try {
        const status = await ajoFactory.ajoStatus(1);
        logTest(
          "ajoStatus(1)",
          true,
          `Exists: ${status.exists}, Active: ${status.isActive}`
        );
      } catch (error) {
        logTest("ajoStatus(1)", false, error.message);
      }
    }
    
    // Test getImplementations
    console.log(c.cyan("\n  Testing getImplementations()..."));
    try {
      const impls = await ajoFactory.getImplementations();
      logTest(
        "getImplementations()",
        true,
        `Core: ${impls.ajoCore.slice(0, 10)}...`
      );
    } catch (error) {
      logTest("getImplementations()", false, error.message);
    }
    
  } catch (error) {
    console.log(c.red(`\n  ❌ AjoFactory view tests failed: ${error.message}`));
  }
}

// ================================================================
// MAIN TEST RUNNER
// ================================================================

async function runAllViewTests(ajoFactory, ajoId, participants) {
  console.log(c.magenta("\n" + "=".repeat(60)));
  console.log(c.bright("🧪 COMPREHENSIVE VIEW FUNCTIONS TEST SUITE"));
  console.log(c.magenta("=".repeat(60)));
  
  // Reset test results
  testResults = { passed: 0, failed: 0, errors: [] };
  
  try {
    // Get contract instances
    const ajoInfo = await ajoFactory.getAjo(ajoId);
    const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
    
    // Run all test suites
    await testAjoCoreViews(ajo, ajoId, participants);
    await testAjoGovernanceViews(ajoFactory, ajoId);
    await testAjoCollateralViews(ajoFactory, ajoId, participants);
    await testAjoPaymentsViews(ajoFactory, ajoId, participants);
    await testAjoMembersViews(ajoFactory, ajoId, participants);
    await testAjoFactoryViews(ajoFactory);
    
    // Print summary
    console.log(c.magenta("\n" + "=".repeat(60)));
    console.log(c.bright("📊 TEST SUMMARY"));
    console.log(c.magenta("=".repeat(60)));
    console.log(c.green(`✅ Passed: ${testResults.passed}`));
    console.log(c.red(`❌ Failed: ${testResults.failed}`));
    console.log(c.cyan(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`));
    
    if (testResults.failed > 0) {
      console.log(c.red("\n⚠️  FAILED TESTS:"));
      testResults.errors.forEach((err, i) => {
        console.log(c.dim(`${i + 1}. ${err.test}`));
        console.log(c.dim(`   ${err.error}`));
      });
    }
    
  } catch (error) {
    console.log(c.red(`\n💥 Test suite failed: ${error.message}`));
    throw error;
  }
}

module.exports = {
  runAllViewTests,
  testAjoCoreViews,
  testAjoGovernanceViews,
  testAjoCollateralViews,
  testAjoPaymentsViews,
  testAjoMembersViews,
  testAjoFactoryViews
};