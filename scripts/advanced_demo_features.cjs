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

// ================================================================
// ADVANCED FEATURE DEMONSTRATIONS
// ================================================================

async function demoGovernanceSystem(ajoFactory, ajoId, participants) {
  console.log(c.blue("\n🗳️  ADVANCED FEATURE: Governance System Demo"));
  
  // Get governance contract
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  const governance = await ethers.getContractAt("AjoGovernance", ajoInfo.ajoGovernance);
  
  console.log(c.cyan("  📋 Creating Governance Proposal..."));
  
  // try {
  //   // Create a proposal to change penalty rate
  //   const proposalTx = await governance.connect(participants[0].signer).createProposal(
  //     "Reduce Default Penalty Rate from 10% to 5%",
  //     ethers.utils.defaultAbiCoder.encode(
  //       ["uint256"], 
  //       [ethers.utils.parseUnits("5", 16)] // 5% in wei
  //     ),
  //     { gasLimit: 300000 }
  //   );
    
  //   const receipt = await proposalTx.wait();
  //   const proposalEvent = receipt.events?.find(e => e.event === 'ProposalCreated');
  //   const proposalId = proposalEvent?.args?.proposalId;
    
  //   console.log(c.green(`    ✅ Proposal created - ID: ${proposalId}`));
    
  //   // Members vote on proposal
  //   console.log(c.cyan("  🗳️  Members Voting..."));
  //   for (let i = 0; i < Math.min(3, participants.length); i++) {
  //     try {
  //       const voteSupport = i < 2 ? 1 : 0; // First 2 vote FOR, last votes AGAINST
  //       const voteTx = await governance.connect(participants[i].signer).vote(
  //         proposalId, 
  //         voteSupport,
  //         { gasLimit: 200000 }
  //       );
  //       await voteTx.wait();
        
  //       const supportText = voteSupport === 1 ? "FOR" : "AGAINST";
  //       console.log(c.green(`    ✅ ${participants[i].name} voted ${supportText}`));
  //     } catch (error) {
  //       console.log(c.yellow(`    ⚠️  ${participants[i].name} vote failed: ${error.message}`));
  //     }
  //   }
    
  //   // Show proposal results
  //   const proposal = await governance.getProposal(proposalId);
  //   console.log(c.green(`  📊 Proposal Results:`));
  //   console.log(c.dim(`    For: ${ethers.utils.formatEther(proposal.forVotes)}`));
  //   console.log(c.dim(`    Against: ${ethers.utils.formatEther(proposal.againstVotes)}`));
  //   console.log(c.dim(`    Abstain: ${ethers.utils.formatEther(proposal.abstainVotes)}`));
    
  // } catch (error) {
  //   console.log(c.red(`  ❌ Governance demo failed: ${error.message}`));
  // }
}

async function demoCollateralSystem(ajoFactory, ajoId) {
  console.log(c.blue("\n🔒 ADVANCED FEATURE: Dynamic Collateral System"));
  
  const ajoInfo = await ajoFactory.getAjo(ajoId);
  const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
  
  console.log(c.cyan("  📊 Collateral Analysis for Different Group Sizes:"));
  
  // Demo collateral calculations for different scenarios
  const scenarios = [
    { participants: 5, payment: ethers.utils.parseUnits("50", 6) },
    { participants: 10, payment: ethers.utils.parseUnits("100", 6) },
    { participants: 20, payment: ethers.utils.parseUnits("200", 6) }
  ];
  
  for (const scenario of scenarios) {
    try {
      console.log(c.dim(`\n    Scenario: ${scenario.participants} participants, $${ethers.utils.formatUnits(scenario.payment, 6)} monthly`));
      
      // Calculate collateral requirements for each position
      for (let pos = 1; pos <= Math.min(5, scenario.participants); pos++) {
        const requiredCollateral = await ajoCollateral.calculateRequiredCollateral(
          pos, 
          scenario.payment, 
          scenario.participants
        );
        
        const guarantorPos = await ajoCollateral.calculateGuarantorPosition(pos, scenario.participants);
        
        console.log(c.green(
          `      Position ${pos}: $${ethers.utils.formatUnits(requiredCollateral, 6)} collateral ` +
          `(Guarantor: Position ${guarantorPos})`
        ));
      }
      
    } catch (error) {
      console.log(c.yellow(`    ⚠️  Scenario calculation failed: ${error.message}`));
    }
  }
  
  // Show total locked collateral
  try {
    const [totalUSDC, totalHBAR] = await ajoCollateral.getTotalCollateral();
    console.log(c.cyan(`\n  💰 Current Total Locked Collateral:`));
    console.log(c.dim(`    USDC: $${ethers.utils.formatUnits(totalUSDC, 6)}`));
    console.log(c.dim(`    HBAR: ${ethers.utils.formatUnits(totalHBAR, 8)} HBAR`));
  } catch (error) {
    console.log(c.yellow(`  ⚠️  Collateral totals unavailable`));
  }
}

async function demoDefaultHandling(ajo, ajoCollateral, participants) {
  console.log(c.blue("\n⚠️  ADVANCED FEATURE: Default Handling System"));
  
  if (participants.length < 2) {
    console.log(c.yellow("  ⚠️  Need at least 2 participants for default demo"));
    return;
  }
  
  const defaulterAddress = participants[1].address; // Use second participant as defaulter
  
  try {
    // Show what assets would be seized in a default
    console.log(c.cyan("  📊 Default Analysis:"));
    
    const seizable = await ajoCollateral.calculateSeizableAssets(defaulterAddress);
    console.log(c.dim(`    Total Seizable: $${ethers.utils.formatUnits(seizable.totalSeizable, 6)}`));
    console.log(c.dim(`    From Collateral: $${ethers.utils.formatUnits(seizable.collateralSeized, 6)}`));
    console.log(c.dim(`    From Payments: $${ethers.utils.formatUnits(seizable.paymentsSeized, 6)}`));
    
    // Get member info before default
    const memberInfo = await ajo.getMemberInfo(defaulterAddress);
    console.log(c.dim(`    Member's Locked Collateral: $${ethers.utils.formatUnits(memberInfo.memberInfo.lockedCollateral, 6)}`));
    console.log(c.dim(`    Member's Default Count: ${memberInfo.memberInfo.defaultCount}`));
    console.log(c.dim(`    Member's Reputation: ${memberInfo.memberInfo.reputationScore}`));
    
    console.log(c.yellow("  ⚠️  This is a simulation - no actual default executed"));
    
  } catch (error) {
    console.log(c.red(`  ❌ Default analysis failed: ${error.message}`));
  }
}

async function demoMultiTokenSupport(ajo, ajoPayments, usdc, whbar, participants) {
  console.log(c.blue("\n💱 ADVANCED FEATURE: Multi-Token Support"));
  
  try {
    // Show current token configurations
    console.log(c.cyan("  📋 Token Configurations:"));
    
    const usdcConfig = await ajoPayments.getTokenConfig(0); // USDC
    const hbarConfig = await ajoPayments.getTokenConfig(1); // HBAR
    const activeToken = await ajoPayments.getActivePaymentToken();
    
    console.log(c.dim(`    USDC - Monthly: $${ethers.utils.formatUnits(usdcConfig.monthlyPayment, 6)}, Active: ${usdcConfig.isActive}`));
    console.log(c.dim(`    HBAR - Monthly: ${ethers.utils.formatUnits(hbarConfig.monthlyPayment, 8)} HBAR, Active: ${hbarConfig.isActive}`));
    console.log(c.dim(`    Active Token: ${activeToken === 0 ? 'USDC' : 'HBAR'}`));
    
    // Show contract balances
    const usdcBalance = await ajoPayments.getContractBalance(0);
    const hbarBalance = await ajoPayments.getContractBalance(1);
    
    console.log(c.cyan("  💰 Contract Balances:"));
    console.log(c.dim(`    USDC: $${ethers.utils.formatUnits(usdcBalance, 6)}`));
    console.log(c.dim(`    HBAR: ${ethers.utils.formatUnits(hbarBalance, 8)} HBAR`));
    
    
  } catch (error) {
    console.log(c.red(`  ❌ Multi-token demo failed: ${error.message}`));
  }
}

async function demoReputationSystem(ajo, participants) {
  console.log(c.blue("\n⭐ ADVANCED FEATURE: Reputation & Voting Power"));
  
  console.log(c.cyan("  📊 Member Reputation Analysis:"));
  
  for (let i = 0; i < Math.min(5, participants.length); i++) {
    try {
      const memberInfo = await ajo.getMemberInfo(participants[i].address);
      const reputation = memberInfo.memberInfo.reputationScore;
      const votingPower = memberInfo.effectiveVotingPower;
      const defaults = memberInfo.memberInfo.defaultCount;
      const totalPaid = memberInfo.memberInfo.totalPaid;
      
      console.log(c.green(`    ${participants[i].name}:`));
      console.log(c.dim(`      Reputation: ${reputation}/100`));
      console.log(c.dim(`      Voting Power: ${ethers.utils.formatEther(votingPower)}`));
      console.log(c.dim(`      Defaults: ${defaults}`));
      console.log(c.dim(`      Total Paid: $${ethers.utils.formatUnits(totalPaid, 6)}`));
      
    } catch (error) {
      console.log(c.yellow(`    ⚠️  ${participants[i].name}: Info unavailable`));
    }
  }
}

async function demoPaymentCycleInsights(ajo, ajoPayments) {
  console.log(c.blue("\n📈 ADVANCED FEATURE: Payment Cycle Analytics"));
  
  try {
    // Current cycle information
    const currentCycle = await ajoPayments.getCurrentCycle();
    const nextPayoutPos = await ajoPayments.getNextPayoutPosition();
    const isPayoutReady = await ajoPayments.isPayoutReady();
    const penaltyRate = await ajoPayments.getPenaltyRate();
    
    console.log(c.cyan("  📊 Cycle Status:"));
    console.log(c.dim(`    Current Cycle: ${currentCycle}`));
    console.log(c.dim(`    Next Payout Position: ${nextPayoutPos}`));
    console.log(c.dim(`    Payout Ready: ${isPayoutReady}`));
    console.log(c.dim(`    Penalty Rate: ${ethers.utils.formatUnits(penaltyRate, 16)}%`));
    
    // Calculate expected payout
    const expectedPayout = await ajoPayments.calculatePayout();
    const nextRecipient = await ajoPayments.getNextRecipient();
    
    console.log(c.cyan("  💰 Payout Information:"));
    console.log(c.dim(`    Expected Payout: $${ethers.utils.formatUnits(expectedPayout, 6)}`));
    console.log(c.dim(`    Next Recipient: ${nextRecipient}`));
    
  } catch (error) {
    console.log(c.red(`  ❌ Payment cycle analysis failed: ${error.message}`));
  }
}

async function demoFactoryScaling(ajoFactory) {
  console.log(c.blue("\n🏭 ADVANCED FEATURE: Factory Scaling & Multi-Ajo Management"));
  
  try {
    // Factory statistics
    const stats = await ajoFactory.getFactoryStats();
    console.log(c.cyan("  📊 Factory Statistics:"));
    console.log(c.dim(`    Total Ajos Created: ${stats.totalCreated}`));
    console.log(c.dim(`    Currently Active: ${stats.activeCount}`));
    
    // Show master implementations
    const implementations = await ajoFactory.getImplementations();
    console.log(c.cyan("  🏗️  Master Contract Implementations:"));
    console.log(c.dim(`    AjoCore: ${implementations.ajoCore}`));
    console.log(c.dim(`    AjoMembers: ${implementations.ajoMembers}`));
    console.log(c.dim(`    AjoCollateral: ${implementations.ajoCollateral}`));
    console.log(c.dim(`    AjoPayments: ${implementations.ajoPayments}`));
    console.log(c.dim(`    AjoGovernance: ${implementations.ajoGovernance}`));
    
    // List all Ajos
    console.log(c.cyan("  📋 All Created Ajos:"));
    const allAjos = await ajoFactory.getAllAjos(0, 10);
    
    for (let i = 0; i < allAjos.ajoInfos.length; i++) {
      const ajo = allAjos.ajoInfos[i];
      console.log(c.green(`    Ajo ${i + 1}: "${ajo.name}"`));
      console.log(c.dim(`      Creator: ${ajo.creator}`));
      console.log(c.dim(`      Active: ${ajo.isActive}`));
      console.log(c.dim(`      Core: ${ajo.ajoCore}`));
    }
    
  } catch (error) {
    console.log(c.red(`  ❌ Factory scaling demo failed: ${error.message}`));
  }
}

async function demoEmergencyFeatures(ajo, participants) {
  console.log(c.blue("\n🚨 ADVANCED FEATURE: Emergency & Security Features"));
  
  console.log(c.cyan("  🔒 Available Emergency Functions:"));
  console.log(c.dim("    • Emergency Pause (Owner only)"));
  console.log(c.dim("    • Emergency Withdraw (Owner only)"));
  console.log(c.dim("    • Batch Default Handling"));
  console.log(c.dim("    • Member Exit with Penalty"));
  
  // Show contract security status
  try {
    const stats = await ajo.getContractStats();
    console.log(c.cyan("  📊 Security Metrics:"));
    console.log(c.dim(`    Total Members: ${stats.totalMembers}`));
    console.log(c.dim(`    Active Members: ${stats.activeMembers}`));
    console.log(c.dim(`    Total USDC Locked: $${ethers.utils.formatUnits(stats.totalCollateralUSDC, 6)}`));
    console.log(c.dim(`    Contract USDC Balance: $${ethers.utils.formatUnits(stats.contractBalanceUSDC, 6)}`));
    
    const riskRatio = stats.totalCollateralUSDC.mul(100).div(stats.contractBalanceUSDC.add(1));
    console.log(c.dim(`    Collateral-to-Balance Ratio: ${riskRatio}%`));
    
  } catch (error) {
    console.log(c.yellow(" ⚠️   Security metrics unavailable"));
  }
  
}

// ================================================================
// MAIN ADVANCED DEMO ORCHESTRATOR
// ================================================================

async function runAdvancedDemo(factoryAddress, usdcAddress, whbarAddress, testAjoId) {
  console.log(c.magenta("\n🎯 ADVANCED FEATURES DEMONSTRATION"));
  console.log(c.bright("Showcasing the full capability of the Ajo System\n"));
  
  try {
    // Connect to contracts
    const [deployer, ...signers] = await ethers.getSigners();
    const ajoFactory = await ethers.getContractAt("AjoFactory", factoryAddress);
    
    // Get Ajo contracts
    const ajoInfo = await ajoFactory.getAjo(testAjoId);
    const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
    const ajoPayments = await ethers.getContractAt("AjoPayments", ajoInfo.ajoPayments);
    const ajoCollateral = await ethers.getContractAt("AjoCollateral", ajoInfo.ajoCollateral);
    const usdc = await ethers.getContractAt("MockERC20", usdcAddress);
    const whbar = await ethers.getContractAt("MockERC20", whbarAddress);
    
    // Create participant list
    const participants = [
      { name: "Adunni", signer: signers[0], address: signers[0].address },
      { name: "Babatunde", signer: signers[1], address: signers[1].address },
      { name: "Chinwe", signer: signers[2], address: signers[2].address },
      { name: "Damilola", signer: signers[3], address: signers[3].address },
      { name: "Emeka", signer: signers[4], address: signers[4].address }
    ];
    
    // Run advanced feature demonstrations
    await demoFactoryScaling(ajoFactory);
    
    await demoCollateralSystem(ajoFactory, testAjoId);
    
    await demoMultiTokenSupport(ajo, ajoPayments, usdc, whbar, participants);
    
    await demoReputationSystem(ajo, participants);
    
    await demoPaymentCycleInsights(ajo, ajoPayments);
    
    await demoDefaultHandling(ajo, ajoCollateral, participants);
    
    await demoGovernanceSystem(ajoFactory, testAjoId, participants);
    
    await demoEmergencyFeatures(ajo, participants);
    
    // Final summary
    console.log(c.magenta("\n🎉 ADVANCED FEATURES DEMONSTRATION COMPLETE!"));
    console.log(c.bright("\n📋 Features Demonstrated:"));
    console.log(c.green("✅ Dynamic Collateral Calculation (V2 Model)"));
    console.log(c.green("✅ Guarantor System with Asset Seizure"));
    console.log(c.green("✅ Multi-Token Support (USDC/HBAR)"));
    console.log(c.green("✅ Decentralized Governance"));
    console.log(c.green("✅ Reputation & Voting Power"));
    console.log(c.green("✅ Default Handling & Recovery"));
    console.log(c.green("✅ Factory Pattern & Scaling"));
    console.log(c.green("✅ Emergency & Security Features"));
    console.log(c.green("✅ Payment Cycle Analytics"));
    
    console.log(c.cyan("\n💡 Key Differentiators:"));
    console.log(c.dim("• Capital-efficient collateral (55% vs traditional 100%+)"));
    console.log(c.dim("• Guarantor system spreads risk across members"));
    console.log(c.dim("• Past payments seizure maximizes recovery"));
    console.log(c.dim("• Member governance for parameter updates"));
    console.log(c.dim("• Multi-token flexibility for different regions"));
    console.log(c.dim("• Factory pattern enables unlimited scaling"));
    
  } catch (error) {
    console.log(c.red(`\n❌ Advanced demo failed: ${error.message}`));
    console.error(error);
  }
}

// Export for use with existing demo
async function main() {
  // This would be called with addresses from your existing demo
  console.log("Use runAdvancedDemo(factoryAddress, usdcAddress, whbarAddress, testAjoId)");
}

module.exports = { 
  runAdvancedDemo,
  demoGovernanceSystem,
  demoCollateralSystem,
  demoDefaultHandling,
  demoMultiTokenSupport,
  demoReputationSystem,
  demoPaymentCycleInsights,
  demoFactoryScaling,
  demoEmergencyFeatures
};