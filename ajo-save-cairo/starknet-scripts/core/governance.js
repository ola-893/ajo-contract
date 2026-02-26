import { Contract } from 'starknet';
import { colors, printBanner } from '../utils/formatting.js';
import { waitForTransaction, sleep } from '../utils/starknet.js';
import { retryWithBackoff } from '../utils/retry.js';
import { GOVERNANCE_ABI } from '../abis/index.js';

/**
 * Create governance proposal
 * @param {Account} account - Account to create proposal
 * @param {string} governanceAddress - Governance contract address
 * @param {string} title - Proposal title
 * @param {string} description - Proposal description
 * @param {number} proposalType - Proposal type (0=ParameterChange, 1=MemberRemoval, 2=Emergency)
 * @returns {Object} Transaction receipt and proposal ID
 */
export async function createProposal(account, governanceAddress, title, description, proposalType) {
  console.log(colors.cyan(`  📋 Creating proposal: ${title}\n`));
  
  const receipt = await retryWithBackoff(
    async () => {
      const governance = new Contract(GOVERNANCE_ABI, governanceAddress, account);
      const call = governance.populate('create_proposal', [title, description, proposalType]);
      const tx = await account.execute(call);
      return await waitForTransaction(account.provider, tx.transaction_hash);
    },
    'Create proposal'
  );
  
  // Parse proposal ID from events
  const proposalId = parseProposalIdFromReceipt(receipt);
  
  console.log(colors.green(`  ✅ Proposal created with ID: ${proposalId}\n`));
  
  return { receipt, proposalId };
}

/**
 * Submit vote on proposal
 * @param {Account} account - Account to vote
 * @param {string} governanceAddress - Governance contract address
 * @param {number} proposalId - Proposal ID
 * @param {boolean} support - True for yes, false for no
 * @returns {Object} Transaction receipt
 */
export async function submitVote(account, governanceAddress, proposalId, support) {
  const governance = new Contract(GOVERNANCE_ABI, governanceAddress, account);
  const call = governance.populate('vote', [proposalId, support]);
  const tx = await account.execute(call);
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Tally votes for proposal
 * @param {Account} account - Account to execute tally
 * @param {string} governanceAddress - Governance contract address
 * @param {number} proposalId - Proposal ID
 * @returns {Object} Transaction receipt
 */
export async function tallyVotes(account, governanceAddress, proposalId) {
  const governance = new Contract(GOVERNANCE_ABI, governanceAddress, account);
  const call = governance.populate('tally_votes', [proposalId]);
  const tx = await account.execute(call);
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Execute proposal
 * @param {Account} account - Account to execute proposal
 * @param {string} governanceAddress - Governance contract address
 * @param {number} proposalId - Proposal ID
 * @returns {Object} Transaction receipt
 */
export async function executeProposal(account, governanceAddress, proposalId) {
  const governance = new Contract(GOVERNANCE_ABI, governanceAddress, account);
  const call = governance.populate('execute_proposal', [proposalId]);
  const tx = await account.execute(call);
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Get proposal information
 * @param {string} governanceAddress - Governance contract address
 * @param {number} proposalId - Proposal ID
 * @param {Account} account - Account to use for query
 * @returns {Object} Proposal information
 */
export async function getProposalInfo(governanceAddress, proposalId, account) {
  const governance = new Contract(GOVERNANCE_ABI, governanceAddress, account);
  const proposal = await governance.get_proposal(proposalId);
  
  return {
    id: Number(proposal.id),
    title: proposal.title,
    description: proposal.description,
    proposalType: Number(proposal.proposal_type),
    proposer: proposal.proposer,
    votesFor: proposal.votes_for,
    votesAgainst: proposal.votes_against,
    status: Number(proposal.status),
    createdAt: Number(proposal.created_at),
    executedAt: Number(proposal.executed_at)
  };
}

/**
 * Get voting power for member
 * @param {string} governanceAddress - Governance contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {bigint} Voting power
 */
export async function getVotingPower(governanceAddress, memberAddress, account) {
  const governance = new Contract(GOVERNANCE_ABI, governanceAddress, account);
  return await governance.get_voting_power(memberAddress);
}

/**
 * Display proposal information
 * @param {Object} proposal - Proposal object
 */
export function displayProposalInfo(proposal) {
  console.log(colors.cyan("\n  📊 Proposal Information\n"));
  console.log(colors.dim(`  ID:          ${proposal.id}`));
  console.log(colors.dim(`  Title:       ${proposal.title}`));
  console.log(colors.dim(`  Description: ${proposal.description}`));
  console.log(colors.dim(`  Type:        ${getProposalTypeName(proposal.proposalType)}`));
  console.log(colors.dim(`  Proposer:    ${proposal.proposer}`));
  console.log(colors.dim(`  Votes For:   ${proposal.votesFor}`));
  console.log(colors.dim(`  Votes Against: ${proposal.votesAgainst}`));
  console.log(colors.dim(`  Status:      ${getProposalStatusName(proposal.status)}`));
  console.log(colors.dim(`  Created:     ${new Date(proposal.createdAt * 1000).toLocaleString()}`));
  
  if (proposal.executedAt > 0) {
    console.log(colors.dim(`  Executed:    ${new Date(proposal.executedAt * 1000).toLocaleString()}`));
  }
  
  console.log();
}

/**
 * Run governance demo
 * @param {Array} participants - Array of participant objects
 * @param {string} governanceAddress - Governance contract address
 * @param {string} proposalTitle - Proposal title
 * @param {string} proposalDescription - Proposal description
 */
export async function runGovernanceDemo(participants, governanceAddress, proposalTitle, proposalDescription) {
  printBanner("GOVERNANCE DEMO");
  
  // Step 1: Create proposal
  console.log(colors.cyan("  📋 Step 1: Creating Proposal\n"));
  
  const { proposalId } = await createProposal(
    participants[0].account,
    governanceAddress,
    proposalTitle,
    proposalDescription,
    0 // ParameterChange
  );
  
  await sleep(2000);
  
  // Step 2: Members vote
  console.log(colors.cyan("  📋 Step 2: Members Voting\n"));
  
  const voteResults = [];
  
  for (let i = 0; i < Math.min(participants.length, 5); i++) {
    const participant = participants[i];
    const support = i < 3; // First 3 vote yes, rest vote no
    
    try {
      console.log(colors.dim(`    ${participant.name} voting ${support ? 'YES' : 'NO'}...`));
      
      await retryWithBackoff(
        () => submitVote(participant.account, governanceAddress, proposalId, support),
        `Vote from ${participant.name}`
      );
      
      voteResults.push({ name: participant.name, vote: support ? 'YES' : 'NO', success: true });
      console.log(colors.green(`    ✅ Vote recorded\n`));
      
    } catch (error) {
      voteResults.push({ name: participant.name, success: false, error: error.message });
      console.log(colors.red(`    ❌ Vote failed: ${error.message}\n`));
    }
    
    await sleep(1500);
  }
  
  // Step 3: Tally votes
  console.log(colors.cyan("  📋 Step 3: Tallying Votes\n"));
  
  try {
    await retryWithBackoff(
      () => tallyVotes(participants[0].account, governanceAddress, proposalId),
      'Tally votes'
    );
    
    console.log(colors.green(`    ✅ Votes tallied\n`));
    
  } catch (error) {
    console.log(colors.red(`    ❌ Tally failed: ${error.message}\n`));
  }
  
  await sleep(2000);
  
  // Step 4: Get proposal status
  console.log(colors.cyan("  📋 Step 4: Checking Proposal Status\n"));
  
  try {
    const proposalInfo = await getProposalInfo(governanceAddress, proposalId, participants[0].account);
    displayProposalInfo(proposalInfo);
    
    // Step 5: Execute if passed
    if (proposalInfo.status === 2) { // Passed
      console.log(colors.cyan("  📋 Step 5: Executing Proposal\n"));
      
      await retryWithBackoff(
        () => executeProposal(participants[0].account, governanceAddress, proposalId),
        'Execute proposal'
      );
      
      console.log(colors.green(`    ✅ Proposal executed\n`));
    }
    
  } catch (error) {
    console.log(colors.red(`    ❌ Failed to check/execute proposal: ${error.message}\n`));
  }
  
  // Summary
  const successfulVotes = voteResults.filter(r => r.success).length;
  console.log(colors.green(`  ✅ Governance demo complete: ${successfulVotes} votes recorded\n`));
  
  return { proposalId, voteResults };
}

/**
 * Parse proposal ID from transaction receipt
 * @param {Object} receipt - Transaction receipt
 * @returns {number} Proposal ID
 */
function parseProposalIdFromReceipt(receipt) {
  // Look for ProposalCreated event
  if (receipt.events) {
    for (const event of receipt.events) {
      if (event.keys && event.keys[0] && event.keys[0].includes('ProposalCreated')) {
        // Proposal ID is typically in the first data field
        return Number(event.data[0]);
      }
    }
  }
  
  // Default to 0 if not found
  return 0;
}

/**
 * Get proposal type name
 * @param {number} type - Proposal type number
 * @returns {string} Type name
 */
function getProposalTypeName(type) {
  const types = ['Parameter Change', 'Member Removal', 'Emergency'];
  return types[type] || 'Unknown';
}

/**
 * Get proposal status name
 * @param {number} status - Proposal status number
 * @returns {string} Status name
 */
function getProposalStatusName(status) {
  const statuses = ['Pending', 'Active', 'Passed', 'Failed', 'Executed', 'Cancelled'];
  return statuses[status] || 'Unknown';
}

/**
 * Display voting results table
 * @param {Array} voteResults - Array of vote result objects
 */
export function displayVotingResults(voteResults) {
  console.log(colors.cyan("\n  📊 Voting Results\n"));
  console.log(colors.dim("  ┌────┬─────────────┬──────────────┬──────────────┐"));
  console.log(colors.dim("  │ #  │ Name        │ Vote         │ Status       │"));
  console.log(colors.dim("  ├────┼─────────────┼──────────────┼──────────────┤"));
  
  voteResults.forEach((result, index) => {
    const vote = result.vote || 'N/A';
    const status = result.success ? colors.green('✅ Recorded') : colors.red('❌ Failed');
    
    console.log(colors.dim(
      `  │ ${(index+1).toString().padStart(2)} │ ${result.name.padEnd(11)} │ ` +
      `${vote.padEnd(12)} │ ${status.padEnd(20)} │`
    ));
  });
  
  console.log(colors.dim("  └────┴─────────────┴──────────────┴──────────────┘\n"));
}
