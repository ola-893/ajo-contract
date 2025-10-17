#!/usr/bin/env node
const { ethers } = require("hardhat");

// Enhanced color utilities (matching your demo style)
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
  bgGreen: (text) => `\x1b[42m\x1b[30m${text}\x1b[0m`,
  bgBlue: (text) => `\x1b[44m\x1b[37m${text}\x1b[0m`,
  bgYellow: (text) => `\x1b[43m\x1b[30m${text}\x1b[0m`,
  bgRed: (text) => `\x1b[41m\x1b[37m${text}\x1b[0m`
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ================================================================
// GOVERNANCE DEMO BANNER
// ================================================================

function printGovernanceBanner() {
  console.log(c.magenta("\n" + "═".repeat(88)));
  console.log(c.bold(c.cyan("╔══════════════════════════════════════════════════════════════════════════════════════╗")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("║") + c.bgBlue("                   🗳️  AJO.SAVE - HCS GOVERNANCE DEMO 🗳️                            ") + c.cyan("║")));
  console.log(c.bold(c.cyan("║                                                                                      ║")));
  console.log(c.bold(c.cyan("╚══════════════════════════════════════════════════════════════════════════════════════╝")));
  console.log(c.magenta("═".repeat(88)));
  
  console.log(c.bright("\n" + " ".repeat(15) + "Hedera Consensus Service (HCS) + On-Chain Tally"));
  console.log(c.dim(" ".repeat(12) + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  
  console.log(c.yellow("\n  🌟 HCS GOVERNANCE FEATURES:"));
  console.log(c.green("     ✓ Off-Chain Voting") + c.dim(" - Submit votes to HCS topic ($0.0001/vote)"));
  console.log(c.green("     ✓ On-Chain Tally") + c.dim(" - Anyone can tally votes with signature verification"));
  console.log(c.green("     ✓ No Aggregators") + c.dim(" - Direct, trustless tallying"));
  console.log(c.green("     ✓ Cost Efficient") + c.dim(" - 90%+ cost reduction vs pure on-chain voting\n"));
  
  console.log(c.bgYellow(" ℹ️  NOTE: HCS messages submitted off-chain (simulated here) "));
  console.log(c.yellow("  Real implementation uses Hedera SDK for HCS submission\n"));
}

// ================================================================
// HELPER: CREATE SIGNED VOTE
// ================================================================

/**
 * @notice Create a signed vote for HCS submission
 * @dev In production, this happens off-chain via Hedera SDK
 */
async function createSignedVote(proposalId, voter, support, hcsMessageId, hcsSequenceNumber) {
  // Create message hash
  const messageHash = ethers.utils.solidityKeccak256(
    ["uint256", "address", "uint8", "bytes32", "uint256"],
    [proposalId, voter.address, support, hcsMessageId, hcsSequenceNumber]
  );
  
  // Sign the message
  const signature = await voter.signMessage(ethers.utils.arrayify(messageHash));
  
  return {
    voter: voter.address,
    support: support,
    votingPower: 100, // Default voting power
    timestamp: Math.floor(Date.now() / 1000),
    hcsMessageId: hcsMessageId,
    hcsSequenceNumber: hcsSequenceNumber,
    signature: signature
  };
}

// ================================================================
// TEST 1: PROPOSAL CREATION
// ================================================================

async function testProposalCreation(ajoGovernance, members, ajoInfo) {
  console.log(c.bgBlue("\n" + " ".repeat(25) + "TEST 1: PROPOSAL CREATION" + " ".repeat(36)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  console.log(c.cyan("  📋 Creating Governance Proposals...\n"));
  
  const proposals = [];
  
  // Proposal 1: Update Penalty Rate
  console.log(c.dim("     → Creating Proposal #1: Update Penalty Rate to 10%"));
  
  try {
    const proposalData = ethers.utils.defaultAbiCoder.encode(
      ["uint256"],
      [10] // 10% penalty rate
    );
    
    const tx1 = await ajoGovernance.connect(members[0].signer).createProposal(
      "Increase penalty rate to 10% for late payments",
      proposalData,
      { gasLimit: 500000 }
    );
    const receipt1 = await tx1.wait();
    
    const event1 = receipt1.events?.find(e => e.event === 'ProposalCreated');
    const proposalId1 = event1?.args?.proposalId?.toNumber();
    
    console.log(c.green(`        ✅ Proposal #${proposalId1} created`));
    console.log(c.dim(`        Gas used: ${receipt1.gasUsed.toString()}\n`));
    
    proposals.push({
      id: proposalId1,
      description: "Increase penalty rate to 10%",
      proposer: members[0].name
    });
  } catch (error) {
    console.log(c.red(`        ❌ Failed: ${error.message.slice(0, 100)}\n`));
  }
  
  await sleep(1000);
  
  // Proposal 2: Remove Defaulting Member
  console.log(c.dim("     → Creating Proposal #2: Remove Defaulting Member"));
  
  try {
    const proposalData = ethers.utils.defaultAbiCoder.encode(
      ["address"],
      [members[9].address] // Last member
    );
    
    const tx2 = await ajoGovernance.connect(members[1].signer).createProposal(
      "Remove member with 3+ defaults",
      proposalData,
      { gasLimit: 500000 }
    );
    const receipt2 = await tx2.wait();
    
    const event2 = receipt2.events?.find(e => e.event === 'ProposalCreated');
    const proposalId2 = event2?.args?.proposalId?.toNumber();
    
    console.log(c.green(`        ✅ Proposal #${proposalId2} created`));
    console.log(c.dim(`        Gas used: ${receipt2.gasUsed.toString()}\n`));
    
    proposals.push({
      id: proposalId2,
      description: "Remove member with defaults",
      proposer: members[1].name
    });
  } catch (error) {
    console.log(c.red(`        ❌ Failed: ${error.message.slice(0, 100)}\n`));
  }
  
  await sleep(1000);
  
  // Display Created Proposals
  console.log(c.cyan("  📊 Active Proposals Summary:\n"));
  console.log(c.dim("     ┌────┬──────────────────────────────────────┬─────────────┐"));
  console.log(c.dim("     │ ID │ Description                          │ Proposer    │"));
  console.log(c.dim("     ├────┼──────────────────────────────────────┼─────────────┤"));
  
  for (const p of proposals) {
    console.log(c.dim(`     │ ${p.id.toString().padStart(2)} │ ${p.description.padEnd(36)} │ ${p.proposer.padEnd(11)} │`));
  }
  
  console.log(c.dim("     └────┴──────────────────────────────────────┴─────────────┘\n"));
  
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return proposals;
}

// ================================================================
// TEST 2: HCS VOTE SUBMISSION (SIMULATED)
// ================================================================

async function testHcsVoteSubmission(ajoGovernance, proposalId, members, hcsTopicId) {
  console.log(c.bgBlue("\n" + " ".repeat(22) + "TEST 2: HCS VOTE SUBMISSION (SIMULATED)" + " ".repeat(25)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  console.log(c.cyan(`  🗳️  Simulating HCS Votes for Proposal #${proposalId}...\n`));
  console.log(c.yellow(`     📡 HCS Topic: ${hcsTopicId}\n`));
  
  const votes = [];
  
  console.log(c.dim("     ┌────┬─────────────┬──────────┬────────────────┬──────────────┐"));
  console.log(c.dim("     │ #  │ Voter       │ Vote     │ HCS Seq #      │ Status       │"));
  console.log(c.dim("     ├────┼─────────────┼──────────┼────────────────┼──────────────┤"));
  
  // Simulate votes from members
  for (let i = 0; i < Math.min(7, members.length); i++) {
    const member = members[i];
    
    // Alternate voting pattern: 5 FOR, 2 AGAINST
    const support = i < 5 ? 1 : 0; // 1 = FOR, 0 = AGAINST
    const voteText = support === 1 ? c.green("FOR    ") : c.red("AGAINST");
    
    // Generate mock HCS data
    const hcsMessageId = ethers.utils.id(`hcs_msg_${proposalId}_${i}`);
    const hcsSequenceNumber = 1000 + i;
    
    try {
      // Create signed vote
      const signedVote = await createSignedVote(
        proposalId,
        member.signer,
        support,
        hcsMessageId,
        hcsSequenceNumber
      );
      
      votes.push(signedVote);
      
      console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${voteText} │ ${hcsSequenceNumber.toString().padEnd(14)} │ ${c.green('✅ Signed').padEnd(20)} │`));
      
    } catch (error) {
      console.log(c.dim(`     │ ${(i+1).toString().padStart(2)} │ ${member.name.padEnd(11)} │ ${voteText} │ ${hcsSequenceNumber.toString().padEnd(14)} │ ${c.red('❌ Failed').padEnd(20)} │`));
    }
    
    await sleep(300);
  }
  
  console.log(c.dim("     └────┴─────────────┴──────────┴────────────────┴──────────────┘\n"));
  
  // Show vote summary
  const forVotes = votes.filter(v => v.support === 1).length;
  const againstVotes = votes.filter(v => v.support === 0).length;
  
  console.log(c.bright("  📊 Vote Summary:"));
  console.log(c.green(`     ✓ FOR:     ${forVotes} votes`));
  console.log(c.red(`     ✗ AGAINST: ${againstVotes} votes`));
  console.log(c.dim(`     Total:     ${votes.length} votes\n`));
  
  console.log(c.yellow("  ℹ️  In production:"));
  console.log(c.dim("     • Votes are submitted to HCS via Hedera SDK"));
  console.log(c.dim("     • Each vote costs ~$0.0001"));
  console.log(c.dim("     • Votes are immutably recorded on HCS topic"));
  console.log(c.dim("     • Mirror Node API provides vote history\n"));
  
  console.log(c.blue("═".repeat(88) + "\n"));
  
  return votes;
}

// ================================================================
// TEST 3: ON-CHAIN VOTE TALLYING
// ================================================================

async function testVoteTallying(ajoGovernance, proposalId, votes, tallier) {
  console.log(c.bgBlue("\n" + " ".repeat(25) + "TEST 3: ON-CHAIN VOTE TALLYING" + " ".repeat(31)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  console.log(c.cyan(`  🧮 Tallying Votes for Proposal #${proposalId}...\n`));
  
  console.log(c.dim("     Tally Process:"));
  console.log(c.dim("     1. Anyone can submit votes from HCS"));
  console.log(c.dim("     2. Contract verifies signatures"));
  console.log(c.dim("     3. Contract checks membership"));
  console.log(c.dim("     4. Contract calculates voting power"));
  console.log(c.dim("     5. Contract updates proposal tallies\n"));
  
  try {
    console.log(c.yellow(`     → Submitting ${votes.length} votes for tallying...`));
    
    const tx = await ajoGovernance.connect(tallier).tallyVotesFromHCS(
      proposalId,
      votes,
      { gasLimit: 1000000 }
    );
    
    const receipt = await tx.wait();
    
    // Find tally event
    const tallyEvent = receipt.events?.find(e => e.event === 'VotesTallied');
    
    if (tallyEvent) {
      const forVotes = tallyEvent.args.forVotes.toNumber();
      const againstVotes = tallyEvent.args.againstVotes.toNumber();
      const abstainVotes = tallyEvent.args.abstainVotes.toNumber();
      
      console.log(c.green(`\n     ✅ Votes Successfully Tallied!`));
      console.log(c.dim(`        Gas used: ${receipt.gasUsed.toString()}\n`));
      
      console.log(c.bright("     📊 Final Tally:"));
      console.log(c.dim("     ┌──────────┬───────┬─────────────┐"));
      console.log(c.dim("     │ Vote     │ Count │ Voting Power│"));
      console.log(c.dim("     ├──────────┼───────┼─────────────┤"));
      console.log(c.dim(`     │ ${c.green('FOR').padEnd(16)} │ ${votes.filter(v => v.support === 1).length.toString().padStart(5)} │ ${forVotes.toString().padStart(12)} │`));
      console.log(c.dim(`     │ ${c.red('AGAINST').padEnd(16)} │ ${votes.filter(v => v.support === 0).length.toString().padStart(5)} │ ${againstVotes.toString().padStart(12)} │`));
      console.log(c.dim(`     │ ${c.yellow('ABSTAIN').padEnd(16)} │ ${votes.filter(v => v.support === 2).length.toString().padStart(5)} │ ${abstainVotes.toString().padStart(12)} │`));
      console.log(c.dim("     └──────────┴───────┴─────────────┘\n"));
      
      // Check if proposal is passing
      const isPassing = forVotes > againstVotes;
      const status = isPassing ? c.green('✅ PASSING') : c.red('❌ FAILING');
      console.log(c.bright(`     Status: ${status}\n`));
      
      return {
        forVotes,
        againstVotes,
        abstainVotes,
        isPassing,
        gasUsed: receipt.gasUsed
      };
    } else {
      throw new Error("VotesTallied event not found");
    }
    
  } catch (error) {
    console.log(c.red(`\n     ❌ Tally Failed: ${error.message.slice(0, 100)}\n`));
    throw error;
  }
  
  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// TEST 4: PROPOSAL STATUS & QUORUM
// ================================================================

async function testProposalStatus(ajoGovernance, proposalId) {
  console.log(c.bgBlue("\n" + " ".repeat(22) + "TEST 4: PROPOSAL STATUS & QUORUM CHECK" + " ".repeat(26)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  console.log(c.cyan(`  📊 Checking Proposal #${proposalId} Status...\n`));
  
  try {
    // Get proposal details
    const proposal = await ajoGovernance.getProposal(proposalId);
    
    // Get proposal status
    const status = await ajoGovernance.getProposalStatus(proposalId);
    
    console.log(c.bright("     Proposal Details:"));
    console.log(c.dim("     ┌──────────────────────────────────────────────────────────┐"));
    console.log(c.dim(`     │ Description: ${proposal.description.slice(0, 43).padEnd(43)} │`));
    console.log(c.dim(`     │ Start Time:  ${new Date(proposal.startTime.toNumber() * 1000).toISOString().slice(0, 19).padEnd(43)} │`));
    console.log(c.dim(`     │ End Time:    ${new Date(proposal.endTime.toNumber() * 1000).toISOString().slice(0, 19).padEnd(43)} │`));
    console.log(c.dim(`     │ For Votes:   ${proposal.forVotes.toString().padEnd(43)} │`));
    console.log(c.dim(`     │ Against:     ${proposal.againstVotes.toString().padEnd(43)} │`));
    console.log(c.dim(`     │ Abstain:     ${proposal.abstainVotes.toString().padEnd(43)} │`));
    console.log(c.dim("     └──────────────────────────────────────────────────────────┘\n"));
    
    console.log(c.bright("     Status Checks:"));
    console.log(c.dim("     ┌──────────────────────┬─────────┐"));
    console.log(c.dim(`     │ Active               │ ${(status.isActive ? c.green('✅ Yes') : c.red('❌ No')).padEnd(15)} │`));
    console.log(c.dim(`     │ Has Quorum           │ ${(status.hasQuorum ? c.green('✅ Yes') : c.red('❌ No')).padEnd(15)} │`));
    console.log(c.dim(`     │ Is Passing           │ ${(status.isPassing ? c.green('✅ Yes') : c.red('❌ No')).padEnd(15)} │`));
    console.log(c.dim(`     │ Votes Needed         │ ${status.votesNeeded.toString().padEnd(7)} │`));
    console.log(c.dim("     └──────────────────────┴─────────┘\n"));
    
    // Get governance settings
    const settings = await ajoGovernance.getGovernanceSettings();
    
    console.log(c.bright("     Governance Parameters:"));
    console.log(c.dim("     ┌──────────────────────────────┬──────────────┐"));
    console.log(c.dim(`     │ Voting Period                │ ${(settings._votingPeriod.toNumber() / 86400).toFixed(0).padStart(10)} days │`));
    console.log(c.dim(`     │ Quorum Required              │ ${settings._quorumPercentage.toString().padStart(11)}% │`));
    console.log(c.dim(`     │ Proposal Threshold           │ ${settings._proposalThreshold.toString().padStart(12)} │`));
    console.log(c.dim(`     │ Current Penalty Rate         │ ${settings.currentPenaltyRate.toString().padStart(11)}% │`));
    console.log(c.dim(`     │ Total Proposals              │ ${settings.totalProposals.toString().padStart(12)} │`));
    console.log(c.dim("     └──────────────────────────────┴──────────────┘\n"));
    
    return {
      proposal,
      status,
      settings
    };
    
  } catch (error) {
    console.log(c.red(`     ❌ Failed to get status: ${error.message.slice(0, 100)}\n`));
    throw error;
  }
  
  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// TEST 5: PROPOSAL EXECUTION (IF PASSED)
// ================================================================

async function testProposalExecution(ajoGovernance, proposalId, executor) {
  console.log(c.bgBlue("\n" + " ".repeat(25) + "TEST 5: PROPOSAL EXECUTION" + " ".repeat(35)));
  console.log(c.blue("═".repeat(88) + "\n"));
  
  console.log(c.cyan(`  ⚡ Attempting to Execute Proposal #${proposalId}...\n`));
  
  try {
    // Check if voting period has ended
    const proposal = await ajoGovernance.getProposal(proposalId);
    const now = Math.floor(Date.now() / 1000);
    
    if (now <= proposal.endTime.toNumber()) {
      console.log(c.yellow("     ⚠️  Voting period still active"));
      console.log(c.dim(`        Wait until: ${new Date(proposal.endTime.toNumber() * 1000).toISOString()}\n`));
      
      console.log(c.cyan("     ⏩ Fast-forwarding time for demo purposes...\n"));
      
      // In production, you'd wait. For demo, we simulate time passage
      await sleep(2000);
    }
    
    console.log(c.yellow("     → Executing proposal..."));
    
    const tx = await ajoGovernance.connect(executor).executeProposal(
      proposalId,
      { gasLimit: 1000000 }
    );
    
    const receipt = await tx.wait();
    
    // Find execution event
    const execEvent = receipt.events?.find(e => e.event === 'ProposalExecuted');
    
    if (execEvent) {
      const success = execEvent.args.success;
      
      if (success) {
        console.log(c.green(`\n     ✅ Proposal Executed Successfully!`));
        console.log(c.dim(`        Gas used: ${receipt.gasUsed.toString()}\n`));
        
        console.log(c.bright("     📝 Execution Details:"));
        console.log(c.dim(`        Transaction: ${receipt.transactionHash}`));
        console.log(c.dim(`        Block: ${receipt.blockNumber}\n`));
        
        return {
          success: true,
          gasUsed: receipt.gasUsed,
          transactionHash: receipt.transactionHash
        };
      } else {
        console.log(c.red(`\n     ❌ Proposal Execution Failed`));
        console.log(c.dim(`        Return data: ${execEvent.args.returnData}\n`));
        
        return {
          success: false,
          error: execEvent.args.returnData
        };
      }
    } else {
      throw new Error("ProposalExecuted event not found");
    }
    
  } catch (error) {
    console.log(c.red(`\n     ❌ Execution Failed: ${error.message.slice(0, 150)}\n`));
    
    // Check common failure reasons
    if (error.message.includes("Quorum not reached")) {
      console.log(c.yellow("     ℹ️  Not enough votes to reach quorum"));
    } else if (error.message.includes("Proposal failed")) {
      console.log(c.yellow("     ℹ️  More AGAINST votes than FOR votes"));
    } else if (error.message.includes("Voting ongoing")) {
      console.log(c.yellow("     ℹ️  Voting period has not ended yet"));
    }
    
    return {
      success: false,
      error: error.message
    };
  }
  
  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// MAIN GOVERNANCE DEMO
// ================================================================

async function runGovernanceDemo(ajoGovernance, members, ajoInfo) {
  printGovernanceBanner();
  
  await sleep(2000);
  
  // TEST 1: Create Proposals
  const proposals = await testProposalCreation(ajoGovernance, members, ajoInfo);
  
  if (proposals.length === 0) {
    console.log(c.red("\n❌ No proposals created. Cannot continue demo.\n"));
    return;
  }
  
  await sleep(2000);
  
  // TEST 2: Simulate HCS Voting
  const proposalId = proposals[0].id;
  const votes = await testHcsVoteSubmission(
    ajoGovernance,
    proposalId,
    members,
    ajoInfo.hcsTopicId
  );
  
  await sleep(2000);
  
  // TEST 3: Tally Votes
  const tallyResult = await testVoteTallying(
    ajoGovernance,
    proposalId,
    votes,
    members[0].signer
  );
  
  await sleep(2000);
  
  // TEST 4: Check Status
  await testProposalStatus(ajoGovernance, proposalId);
  
  await sleep(2000);
  
  // TEST 5: Execute (if conditions met)
  const execResult = await testProposalExecution(
    ajoGovernance,
    proposalId,
    members[0].signer
  );
  
  // Final Summary
  console.log(c.bgGreen("\n" + " ".repeat(28) + "🎉 GOVERNANCE DEMO COMPLETE! 🎉" + " ".repeat(26)));
  console.log(c.green("═".repeat(88) + "\n"));
  
  console.log(c.bright("  📊 Demo Summary:\n"));
  console.log(c.dim("     Proposals Created:    ") + c.green(proposals.length.toString()));
  console.log(c.dim("     Votes Cast (HCS):     ") + c.green(votes.length.toString()));
  console.log(c.dim("     Tally Gas Cost:       ") + c.yellow(tallyResult?.gasUsed?.toString() || 'N/A'));
  console.log(c.dim("     Execution Status:     ") + (execResult.success ? c.green('✅ Success') : c.red('❌ Failed')));
  
  console.log(c.yellow("\n  💡 Key Takeaways:"));
  console.log(c.dim("     • HCS voting is 90%+ cheaper than pure on-chain"));
  console.log(c.dim("     • No trusted intermediaries - anyone can tally"));
  console.log(c.dim("     • Signature verification ensures vote integrity"));
  console.log(c.dim("     • Perfect for DAOs with 10-100 members\n"));
  
  console.log(c.green("═".repeat(88) + "\n"));
  
  return {
    proposals,
    votes,
    tallyResult,
    execResult
  };
}

// ================================================================
// EXPORT FOR INTEGRATION
// ================================================================

module.exports = {
  runGovernanceDemo,
  testProposalCreation,
  testHcsVoteSubmission,
  testVoteTallying,
  testProposalStatus,
  testProposalExecution,
  createSignedVote,
  printGovernanceBanner
};