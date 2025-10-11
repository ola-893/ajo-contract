/**
 * HCS Vote Tallying Script
 * 
 * Queries Hedera Mirror Node for HCS votes and submits them on-chain
 * Anyone can run this (permissionless tallying)
 * 
 * Usage:
 *   node scripts/tally-hcs-votes.js --proposal 1 --topic 0.0.12345
 */

const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs');

// ============ CONFIGURATION ============

const CONFIG = {
    network: process.env.HEDERA_NETWORK || 'testnet',
    mirrorNodeUrl: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
    rpcUrl: process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api',
    privateKey: process.env.PRIVATE_KEY,
    governanceAddress: process.env.GOVERNANCE_CONTRACT_ADDRESS,
    
    // Governance ABI
    governanceAbi: [
        "function tallyVotesFromHCS(uint256 proposalId, tuple(address voter, uint8 support, uint256 votingPower, uint256 timestamp, bytes32 hcsMessageId, uint256 hcsSequenceNumber, bytes signature)[] hcsVotes) external returns (uint256 totalForVotes, uint256 totalAgainstVotes, uint256 totalAbstainVotes)",
        "function getProposal(uint256 proposalId) external view returns (string description, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 startTime, uint256 endTime, bool executed, bool canceled, bytes proposalData)",
        "function hasVoted(uint256 proposalId, address voter) external view returns (bool)"
    ]
};

// ============ MIRROR NODE QUERIES ============

async function fetchHcsMessages(topicId, startSequence = 0) {
    console.log(`\n📡 Fetching HCS messages from Mirror Node...`);
    console.log(`   Topic: ${topicId}`);
    console.log(`   Starting from sequence: ${startSequence}`);
    
    try {
        const url = `${CONFIG.mirrorNodeUrl}/api/v1/topics/${topicId}/messages`;
        const params = {
            sequencenumber: startSequence > 0 ? `gt:${startSequence}` : undefined,
            limit: 100,
            order: 'asc'
        };
        
        const response = await axios.get(url, { params });
        const messages = response.data.messages || [];
        
        console.log(`   ✅ Found ${messages.length} messages`);
        
        return messages;
        
    } catch (error) {
        console.error(`   ❌ Failed to fetch messages:`, error.message);
        throw error;
    }
}

async function parseVoteMessages(messages, proposalId) {
    console.log(`\n📊 Parsing vote messages...`);
    
    const votes = [];
    
    for (const message of messages) {
        try {
            // Decode base64 message
            const content = Buffer.from(message.message, 'base64').toString('utf-8');
            const voteData = JSON.parse(content);
            
            // Check if this vote is for our proposal
            if (voteData.proposalId !== proposalId) {
                continue; // Different proposal
            }
            
            // Validate vote structure
            if (!voteData.voter || voteData.support === undefined || !voteData.signature) {
                console.log(`   ⚠️  Invalid vote structure, skipping`);
                continue;
            }
            
            // Create HcsVote struct
            const hcsVote = {
                voter: voteData.voter,
                support: voteData.support,
                votingPower: 0, // Will be calculated on-chain
                timestamp: voteData.timestamp || Date.parse(message.consensus_timestamp),
                hcsMessageId: ethers.zeroPadValue(ethers.toBeHex(message.sequence_number), 32),
                hcsSequenceNumber: message.sequence_number,
                signature: voteData.signature
            };
            
            votes.push(hcsVote);
            
            console.log(`   ✓ Vote from ${voteData.voter.slice(0, 8)}... (support: ${voteData.support})`);
            
        } catch (error) {
            console.log(`   ⚠️  Failed to parse message: ${error.message}`);
            continue;
        }
    }
    
    console.log(`   ✅ Parsed ${votes.length} valid votes`);
    
    return votes;
}

// ============ ON-CHAIN TALLYING ============

async function submitVoteTally(provider, governanceAddress, proposalId, votes, signer) {
    console.log(`\n📤 Submitting vote tally to smart contract...`);
    console.log(`   Proposal: ${proposalId}`);
    console.log(`   Votes to submit: ${votes.length}`);
    
    const governance = new ethers.Contract(
        governanceAddress,
        CONFIG.governanceAbi,
        signer
    );
    
    try {
        // Filter out votes that are already counted
        const newVotes = [];
        
        for (const vote of votes) {
            const hasVoted = await governance.hasVoted(proposalId, vote.voter);
            if (!hasVoted) {
                newVotes.push(vote);
            } else {
                console.log(`   ⏭️  Skipping ${vote.voter.slice(0, 8)}... (already voted)`);
            }
        }
        
        if (newVotes.length === 0) {
            console.log(`   ℹ️  No new votes to submit`);
            return null;
        }
        
        console.log(`   📝 Submitting ${newVotes.length} new votes...`);
        
        // Submit in batches of 20 to avoid gas limits
        const BATCH_SIZE = 20;
        const results = [];
        
        for (let i = 0; i < newVotes.length; i += BATCH_SIZE) {
            const batch = newVotes.slice(i, i + BATCH_SIZE);
            
            console.log(`   📦 Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} votes)...`);
            
            // Estimate gas
            const gasEstimate = await governance.tallyVotesFromHCS.estimateGas(
                proposalId,
                batch
            );
            
            console.log(`      Gas estimate: ${gasEstimate.toString()}`);
            
            // Submit transaction
            const tx = await governance.tallyVotesFromHCS(
                proposalId,
                batch,
                {
                    gasLimit: gasEstimate * 120n / 100n // 20% buffer
                }
            );
            
            console.log(`      Tx submitted: ${tx.hash}`);
            console.log(`      ⏳ Waiting for confirmation...`);
            
            const receipt = await tx.wait();
            
            console.log(`      ✅ Confirmed! Gas used: ${receipt.gasUsed.toString()}`);
            
            // Decode return values from logs
            const iface = new ethers.Interface(CONFIG.governanceAbi);
            const log = receipt.logs.find(log => {
                try {
                    return iface.parseLog(log).name === 'VotesTallied';
                } catch {
                    return false;
                }
            });
            
            if (log) {
                const parsed = iface.parseLog(log);
                results.push({
                    forVotes: parsed.args.forVotes.toString(),
                    againstVotes: parsed.args.againstVotes.toString(),
                    abstainVotes: parsed.args.abstainVotes.toString()
                });
            }
        }
        
        console.log(`\n   ✅ All votes tallied successfully!`);
        
        return results;
        
    } catch (error) {
        console.error(`   ❌ Tally submission failed:`, error.message);
        throw error;
    }
}

// ============ PROPOSAL STATUS ============

async function getProposalStatus(governance, proposalId) {
    console.log(`\n📊 Fetching proposal status...`);
    
    try {
        const proposal = await governance.getProposal(proposalId);
        
        console.log(`   Proposal ${proposalId}:`);
        console.log(`      Description: ${proposal.description}`);
        console.log(`      For: ${proposal.forVotes.toString()}`);
        console.log(`      Against: ${proposal.againstVotes.toString()}`);
        console.log(`      Abstain: ${proposal.abstainVotes.toString()}`);
        console.log(`      Start: ${new Date(Number(proposal.startTime) * 1000).toISOString()}`);
        console.log(`      End: ${new Date(Number(proposal.endTime) * 1000).toISOString()}`);
        console.log(`      Executed: ${proposal.executed}`);
        console.log(`      Canceled: ${proposal.canceled}`);
        
        const now = Math.floor(Date.now() / 1000);
        const isActive = now <= Number(proposal.endTime) && !proposal.executed && !proposal.canceled;
        const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        const isPassing = proposal.forVotes > proposal.againstVotes;
        
        console.log(`\n   Status:`);
        console.log(`      Active: ${isActive}`);
        console.log(`      Total Votes: ${totalVotes.toString()}`);
        console.log(`      Passing: ${isPassing ? '✅ YES' : '❌ NO'}`);
        
        return {
            proposal,
            isActive,
            totalVotes,
            isPassing
        };
        
    } catch (error) {
        console.error(`   ❌ Failed to fetch proposal:`, error.message);
        throw error;
    }
}

// ============ CONTINUOUS MONITORING ============

async function monitorAndTally(provider, governanceAddress, proposalId, topicId, signer) {
    console.log(`\n👀 Starting continuous monitoring...`);
    console.log(`   Proposal: ${proposalId}`);
    console.log(`   Topic: ${topicId}`);
    console.log(`   Interval: 30 seconds`);
    
    const governance = new ethers.Contract(
        governanceAddress,
        CONFIG.governanceAbi,
        signer
    );
    
    let lastSequence = 0;
    
    const checkInterval = setInterval(async () => {
        try {
            console.log(`\n🔄 Checking for new votes...`);
            
            // Check if proposal is still active
            const status = await getProposalStatus(governance, proposalId);
            
            if (!status.isActive) {
                console.log(`\n⏹️  Proposal is no longer active. Stopping monitor.`);
                clearInterval(checkInterval);
                return;
            }
            
            // Fetch new messages
            const messages = await fetchHcsMessages(topicId, lastSequence);
            
            if (messages.length === 0) {
                console.log(`   ℹ️  No new messages`);
                return;
            }
            
            // Parse votes
            const votes = await parseVoteMessages(messages, proposalId);
            
            if (votes.length > 0) {
                // Submit tally
                await submitVoteTally(provider, governanceAddress, proposalId, votes, signer);
                
                // Update last sequence
                lastSequence = Math.max(...messages.map(m => m.sequence_number));
            }
            
        } catch (error) {
            console.error(`   ❌ Monitor error:`, error.message);
        }
    }, 30000); // Check every 30 seconds
    
    console.log(`\n✅ Monitor started. Press Ctrl+C to stop.`);
}

// ============ MAIN EXECUTION ============

async function main() {
    console.log(`\n🗳️  Ajo.save HCS Vote Tallying`);
    console.log(`================================\n`);
    
    // Parse arguments
    const args = process.argv.slice(2);
    const proposalId = parseInt(args[args.indexOf('--proposal') + 1]);
    const topicId = args[args.indexOf('--topic') + 1];
    const monitor = args.includes('--monitor');
    const fromSequence = parseInt(args[args.indexOf('--from') + 1]) || 0;
    
    if (!proposalId || !topicId) {
        console.log(`Usage: node tally-hcs-votes.js --proposal <id> --topic <0.0.X>`);
        console.log(``);
        console.log(`Options:`);
        console.log(`  --proposal <id>   Proposal ID to tally`);
        console.log(`  --topic <0.0.X>   HCS Topic ID`);
        console.log(`  --monitor         Continuous monitoring mode`);
        console.log(`  --from <seq>      Start from sequence number (default: 0)`);
        console.log(``);
        console.log(`Examples:`);
        console.log(`  # One-time tally`);
        console.log(`  node tally-hcs-votes.js --proposal 1 --topic 0.0.12345`);
        console.log(``);
        console.log(`  # Continuous monitoring`);
        console.log(`  node tally-hcs-votes.js --proposal 1 --topic 0.0.12345 --monitor`);
        process.exit(1);
    }
    
    // Validate environment
    if (!CONFIG.privateKey || !CONFIG.governanceAddress) {
        throw new Error('Missing PRIVATE_KEY or GOVERNANCE_CONTRACT_ADDRESS');
    }
    
    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    const signer = new ethers.Wallet(CONFIG.privateKey, provider);
    
    console.log(`📡 Connected to Hedera ${CONFIG.network}`);
    console.log(`   Tallier: ${signer.address}`);
    console.log(`   Governance: ${CONFIG.governanceAddress}`);
    
    // Get current proposal status
    const governance = new ethers.Contract(
        CONFIG.governanceAddress,
        CONFIG.governanceAbi,
        signer
    );
    
    await getProposalStatus(governance, proposalId);
    
    if (monitor) {
        // Start continuous monitoring
        await monitorAndTally(provider, CONFIG.governanceAddress, proposalId, topicId, signer);
    } else {
        // One-time tally
        const messages = await fetchHcsMessages(topicId, fromSequence);
        const votes = await parseVoteMessages(messages, proposalId);
        
        if (votes.length > 0) {
            await submitVoteTally(provider, CONFIG.governanceAddress, proposalId, votes, signer);
            
            // Show final status
            await getProposalStatus(governance, proposalId);
        } else {
            console.log(`\nℹ️  No votes found for proposal ${proposalId}`);
        }
        
        console.log(`\n✅ Tallying complete!`);
    }
}

// ============ ERROR HANDLING ============

process.on('unhandledRejection', (error) => {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n\n👋 Gracefully shutting down...');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { fetchHcsMessages, parseVoteMessages, submitVoteTally };