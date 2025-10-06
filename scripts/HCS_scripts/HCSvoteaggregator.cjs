/**
 * HCS Vote Aggregator Service
 * 
 * Queries Hedera Mirror Node API for HCS topic messages,
 * validates votes, builds Merkle trees, and submits batch to smart contract
 * 
 * Cost Comparison:
 * - Traditional on-chain voting: 100 votes = ~$0.10
 * - HCS voting: 100 votes = ~$0.01 + $0.01 settlement = $0.02 total
 * - Savings: 80% reduction
 */

const { ethers } = require('ethers');
const axios = require('axios');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

class HCSVoteAggregator {
    constructor(config) {
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new ethers.Wallet(config.privateKey, this.provider);
        this.governanceContract = new ethers.Contract(
            config.governanceAddress,
            config.governanceAbi,
            this.wallet
        );
        
        // Hedera configuration
        this.mirrorNodeUrl = config.mirrorNodeUrl || 'https://testnet.mirrornode.hedera.com';
        this.network = config.network || 'testnet';
        
        // Aggregator state
        this.isRegistered = false;
        this.monitoredProposals = new Map();
        
        console.log(`🚀 HCS Vote Aggregator initialized`);
        console.log(`📡 Mirror Node: ${this.mirrorNodeUrl}`);
        console.log(`🔗 Network: ${this.network}`);
    }
    
    /**
     * Register as aggregator by staking
     */
    async registerAsAggregator(stakeAmount = '1.0') {
        try {
            console.log(`\n📝 Registering as aggregator with stake: ${stakeAmount} HBAR`);
            
            const tx = await this.governanceContract.registerAggregator({
                value: ethers.parseEther(stakeAmount)
            });
            
            await tx.wait();
            this.isRegistered = true;
            
            console.log(`✅ Successfully registered as aggregator`);
            console.log(`   Tx Hash: ${tx.hash}`);
            
            return tx.hash;
        } catch (error) {
            console.error(`❌ Registration failed:`, error.message);
            throw error;
        }
    }
    
    /**
     * Monitor a proposal for votes
     */
    async monitorProposal(proposalId) {
        console.log(`\n👀 Starting to monitor proposal ${proposalId}`);
        
        // Get proposal details from contract
        const proposal = await this.governanceContract.getHCSProposalDetails(proposalId);
        
        if (!proposal[0].hcsTopicId) {
            throw new Error('HCS Topic ID not set for this proposal');
        }
        
        const topicId = this.decodeTopicId(proposal[0].hcsTopicId);
        console.log(`   HCS Topic ID: ${topicId}`);
        console.log(`   Voting ends: ${new Date(Number(proposal[0].proposalEndTime) * 1000).toISOString()}`);
        
        this.monitoredProposals.set(proposalId, {
            topicId,
            proposal: proposal[0],
            votes: new Map(),
            lastSequence: 0
        });
        
        // Start polling for votes
        this.pollVotes(proposalId);
    }
    
    /**
     * Poll Mirror Node API for new votes
     */
    async pollVotes(proposalId) {
        const proposalData = this.monitoredProposals.get(proposalId);
        if (!proposalData) return;
        
        const { topicId, lastSequence } = proposalData;
        
        try {
            // Query Mirror Node API for topic messages
            const url = `${this.mirrorNodeUrl}/api/v1/topics/${topicId}/messages`;
            const params = {
                sequencenumber: lastSequence > 0 ? `gt:${lastSequence}` : undefined,
                limit: 100,
                order: 'asc'
            };
            
            const response = await axios.get(url, { params });
            const messages = response.data.messages || [];
            
            console.log(`   📨 Found ${messages.length} new messages`);
            
            for (const message of messages) {
                await this.processVoteMessage(proposalId, message);
                proposalData.lastSequence = message.sequence_number;
            }
            
            // Check if voting period ended
            const now = Math.floor(Date.now() / 1000);
            if (now > proposalData.proposal.proposalEndTime) {
                console.log(`\n⏰ Voting period ended for proposal ${proposalId}`);
                await this.aggregateAndSubmit(proposalId);
            } else {
                // Continue polling
                setTimeout(() => this.pollVotes(proposalId), 5000); // Poll every 5 seconds
            }
            
        } catch (error) {
            console.error(`❌ Error polling votes:`, error.message);
            // Retry after delay
            setTimeout(() => this.pollVotes(proposalId), 10000);
        }
    }
    
    /**
     * Process individual vote message from HCS
     */
    async processVoteMessage(proposalId, message) {
        try {
            // Decode base64 message content
            const content = Buffer.from(message.message, 'base64').toString('utf-8');
            const vote = JSON.parse(content);
            
            // Validate vote structure
            if (!vote.proposalId || !vote.voter || vote.support === undefined) {
                console.log(`   ⚠️  Invalid vote structure, skipping`);
                return;
            }
            
            // Verify this is for the right proposal
            if (vote.proposalId !== proposalId) {
                return; // Different proposal
            }
            
            // Verify signature
            if (!this.verifyVoteSignature(vote)) {
                console.log(`   ⚠️  Invalid signature for voter ${vote.voter}, skipping`);
                return;
            }
            
            // Get voter's voting power from contract
            const votingPower = await this.governanceContract.calculateVotingPower(vote.voter);
            
            if (votingPower === 0n) {
                console.log(`   ⚠️  Voter ${vote.voter} has no voting power, skipping`);
                return;
            }
            
            const proposalData = this.monitoredProposals.get(proposalId);
            
            // Check for double voting
            if (proposalData.votes.has(vote.voter)) {
                console.log(`   ⚠️  Double vote detected from ${vote.voter}, keeping first vote`);
                return;
            }
            
            // Store valid vote
            proposalData.votes.set(vote.voter, {
                voter: vote.voter,
                support: vote.support,
                votingPower: votingPower.toString(),
                timestamp: message.consensus_timestamp,
                sequenceNumber: message.sequence_number
            });
            
            console.log(`   ✅ Valid vote from ${vote.voter.slice(0, 8)}... (power: ${ethers.formatEther(votingPower)}, support: ${vote.support})`);
            
        } catch (error) {
            console.error(`   ❌ Error processing message:`, error.message);
        }
    }
    
    /**
     * Verify vote signature
     */
    verifyVoteSignature(vote) {
        try {
            if (!vote.signature) return false;
            
            const message = ethers.solidityPackedKeccak256(
                ['uint256', 'address', 'uint8'],
                [vote.proposalId, vote.voter, vote.support]
            );
            
            const recoveredAddress = ethers.verifyMessage(
                ethers.getBytes(message),
                vote.signature
            );
            
            return recoveredAddress.toLowerCase() === vote.voter.toLowerCase();
        } catch {
            return false;
        }
    }
    
    /**
     * Aggregate votes and submit to contract
     */
    async aggregateAndSubmit(proposalId) {
        console.log(`\n📊 Aggregating votes for proposal ${proposalId}`);
        
        const proposalData = this.monitoredProposals.get(proposalId);
        if (!proposalData || proposalData.votes.size === 0) {
            console.log(`   ⚠️  No votes to aggregate`);
            return;
        }
        
        // Tally votes
        let forVotes = 0n;
        let againstVotes = 0n;
        let abstainVotes = 0n;
        
        const voteLeaves = [];
        
        for (const [voter, voteData] of proposalData.votes) {
            const power = BigInt(voteData.votingPower);
            
            if (voteData.support === 1) {
                forVotes += power;
            } else if (voteData.support === 0) {
                againstVotes += power;
            } else if (voteData.support === 2) {
                abstainVotes += power;
            }
            
            // Create leaf for Merkle tree
            const leaf = ethers.solidityPackedKeccak256(
                ['address', 'uint8', 'uint256'],
                [voter, voteData.support, power]
            );
            voteLeaves.push(leaf);
        }
        
        console.log(`   📈 Vote Tally:`);
        console.log(`      For: ${ethers.formatEther(forVotes)}`);
        console.log(`      Against: ${ethers.formatEther(againstVotes)}`);
        console.log(`      Abstain: ${ethers.formatEther(abstainVotes)}`);
        console.log(`      Total Voters: ${proposalData.votes.size}`);
        
        // Build Merkle tree
        const merkleTree = new MerkleTree(voteLeaves, keccak256, { sortPairs: true });
        const merkleRoot = merkleTree.getHexRoot();
        
        console.log(`   🌳 Merkle Root: ${merkleRoot}`);
        
        // Store tree for challenge responses
        proposalData.merkleTree = merkleTree;
        
        // Submit to contract
        try {
            console.log(`\n📤 Submitting vote batch to contract...`);
            
            const tx = await this.governanceContract.submitVoteBatch(
                proposalId,
                merkleRoot,
                forVotes,
                againstVotes,
                abstainVotes,
                proposalData.votes.size
            );
            
            console.log(`   ⏳ Waiting for confirmation...`);
            const receipt = await tx.wait();
            
            console.log(`   ✅ Vote batch submitted successfully!`);
            console.log(`      Tx Hash: ${receipt.hash}`);
            console.log(`      Gas Used: ${receipt.gasUsed.toString()}`);
            
            // Start monitoring for challenges
            this.monitorChallenges(proposalId);
            
        } catch (error) {
            console.error(`   ❌ Submission failed:`, error.message);
            throw error;
        }
    }
    
    /**
     * Monitor for challenges during challenge period
     */
    async monitorChallenges(proposalId) {
        console.log(`\n🛡️  Monitoring challenges for proposal ${proposalId}`);
        
        const proposalData = this.monitoredProposals.get(proposalId);
        const challengePeriod = 86400; // 1 day in seconds
        
        const endTime = Date.now() + (challengePeriod * 1000);
        
        const checkInterval = setInterval(async () => {
            try {
                const details = await this.governanceContract.getHCSProposalDetails(proposalId);
                
                if (details[1].challenged) {
                    console.log(`   ⚠️  Vote batch was successfully challenged!`);
                    clearInterval(checkInterval);
                    return;
                }
                
                if (Date.now() >= endTime) {
                    console.log(`   ✅ Challenge period ended - batch is valid!`);
                    clearInterval(checkInterval);
                    
                    // Try to execute if it passed
                    if (details[2]) { // canExecute
                        await this.executeProposal(proposalId);
                    }
                }
            } catch (error) {
                console.error(`   ❌ Error checking challenges:`, error.message);
            }
        }, 30000); // Check every 30 seconds
    }
    
    /**
     * Execute a passed proposal
     */
    async executeProposal(proposalId) {
        console.log(`\n⚡ Executing proposal ${proposalId}`);
        
        try {
            const tx = await this.governanceContract.executeProposal(proposalId);
            const receipt = await tx.wait();
            
            console.log(`   ✅ Proposal executed successfully!`);
            console.log(`      Tx Hash: ${receipt.hash}`);
            
        } catch (error) {
            console.error(`   ❌ Execution failed:`, error.message);
        }
    }
    
    /**
     * Get Merkle proof for a specific vote (for challenges)
     */
    getMerkleProof(proposalId, voter) {
        const proposalData = this.monitoredProposals.get(proposalId);
        if (!proposalData || !proposalData.merkleTree) {
            throw new Error('Merkle tree not found for this proposal');
        }
        
        const voteData = proposalData.votes.get(voter);
        if (!voteData) {
            throw new Error('Vote not found for this voter');
        }
        
        const leaf = ethers.solidityPackedKeccak256(
            ['address', 'uint8', 'uint256'],
            [voter, voteData.support, BigInt(voteData.votingPower)]
        );
        
        const proof = proposalData.merkleTree.getHexProof(leaf);
        
        return {
            voter,
            support: voteData.support,
            votingPower: voteData.votingPower,
            merkleProof: proof
        };
    }
    
    /**
     * Helper: Decode HCS topic ID from bytes32
     */
    decodeTopicId(bytes32TopicId) {
        // Convert bytes32 to topic ID string (e.g., "0.0.123456")
        const hex = bytes32TopicId.slice(2); // Remove 0x
        const parts = hex.match(/.{1,16}/g) || [];
        
        if (parts.length >= 3) {
            const shard = parseInt(parts[0], 16);
            const realm = parseInt(parts[1], 16);
            const num = parseInt(parts[2], 16);
            return `${shard}.${realm}.${num}`;
        }
        
        return bytes32TopicId; // Fallback to original
    }
    
    /**
     * Helper: Get aggregator stats
     */
    async getAggregatorStats() {
        const info = await this.governanceContract.getAggregatorInfo(this.wallet.address);
        
        return {
            address: this.wallet.address,
            stake: ethers.formatEther(info.stake),
            reputation: info.reputation.toString(),
            isActive: info.isActive
        };
    }
}

// ============ CLI INTERFACE ============

async function main() {
    const config = {
        rpcUrl: process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api',
        privateKey: process.env.AGGREGATOR_PRIVATE_KEY,
        governanceAddress: process.env.GOVERNANCE_CONTRACT_ADDRESS,
        governanceAbi: require('./abis/AjoGovernanceHCS.json'),
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
        network: 'testnet'
    };
    
    const aggregator = new HCSVoteAggregator(config);
    
    // Parse command line arguments
    const command = process.argv[2];
    
    switch (command) {
        case 'register':
            const stakeAmount = process.argv[3] || '1.0';
            await aggregator.registerAsAggregator(stakeAmount);
            break;
            
        case 'monitor':
            const proposalId = parseInt(process.argv[3]);
            if (isNaN(proposalId)) {
                console.error('❌ Invalid proposal ID');
                process.exit(1);
            }
            await aggregator.monitorProposal(proposalId);
            break;
            
        case 'stats':
            const stats = await aggregator.getAggregatorStats();
            console.log('\n📊 Aggregator Stats:');
            console.log(`   Address: ${stats.address}`);
            console.log(`   Stake: ${stats.stake} HBAR`);
            console.log(`   Reputation: ${stats.reputation}`);
            console.log(`   Active: ${stats.isActive}`);
            break;
            
        case 'proof':
            const pid = parseInt(process.argv[3]);
            const voter = process.argv[4];
            const proof = aggregator.getMerkleProof(pid, voter);
            console.log('\n🌳 Merkle Proof:');
            console.log(JSON.stringify(proof, null, 2));
            break;
            
        default:
            console.log(`
🚀 HCS Vote Aggregator CLI

Usage:
  node HCSVoteAggregator.js <command> [options]

Commands:
  register [stake]     Register as aggregator (default: 1.0 HBAR)
  monitor <proposalId> Monitor and aggregate votes for proposal
  stats                View aggregator statistics
  proof <proposalId> <voter>  Get Merkle proof for voter

Examples:
  node HCSVoteAggregator.js register 2.0
  node HCSVoteAggregator.js monitor 0
  node HCSVoteAggregator.js stats
  node HCSVoteAggregator.js proof 0 0x1234...

Environment Variables Required:
  AGGREGATOR_PRIVATE_KEY        Your aggregator private key
  GOVERNANCE_CONTRACT_ADDRESS   Address of governance contract
  HEDERA_RPC_URL               (Optional) Hedera RPC endpoint
            `);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = HCSVoteAggregator;