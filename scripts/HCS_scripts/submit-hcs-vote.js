/**
 * HCS Vote Submission Script
 * 
 * Allows members to vote on proposals via Hedera Consensus Service
 * Cost: ~$0.0001 per vote (vs $0.001+ on-chain)
 * 
 * Usage:
 *   node scripts/submit-hcs-vote.js --proposal 1 --support 1 --topic 0.0.12345
 */

const {
    Client,
    PrivateKey,
    AccountId,
    TopicMessageSubmitTransaction,
    TopicInfoQuery
} = require("@hashgraph/sdk");
const { ethers } = require("ethers");
const fs = require('fs');

// ============ CONFIGURATION ============

const CONFIG = {
    network: process.env.HEDERA_NETWORK || 'testnet',
    operatorId: process.env.HEDERA_ACCOUNT_ID,
    operatorKey: process.env.HEDERA_PRIVATE_KEY,
    
    // Contract addresses (load from deployment)
    governanceAddress: process.env.GOVERNANCE_CONTRACT_ADDRESS,
    rpcUrl: process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api'
};

// ============ VOTE SUBMISSION ============

async function submitVoteToHCS(hederaClient, ethWallet, topicId, proposalId, support) {
    console.log(`\n📝 Submitting vote to HCS...`);
    console.log(`   Topic: ${topicId}`);
    console.log(`   Proposal: ${proposalId}`);
    console.log(`   Support: ${support === 1 ? 'FOR' : support === 0 ? 'AGAINST' : 'ABSTAIN'}`);
    console.log(`   Voter: ${ethWallet.address}`);
    
    try {
        // Create vote message
        const voteMessage = {
            proposalId: proposalId,
            voter: ethWallet.address,
            support: support,
            timestamp: Date.now()
        };
        
        // Sign vote with Ethereum wallet
        const messageHash = ethers.solidityPackedKeccak256(
            ['uint256', 'address', 'uint8'],
            [proposalId, ethWallet.address, support]
        );
        
        const signature = await ethWallet.signMessage(ethers.getBytes(messageHash));
        
        voteMessage.signature = signature;
        
        console.log(`   ✓ Vote signed`);
        
        // Submit to HCS
        const submitTx = new TopicMessageSubmitTransaction()
            .setTopicId(topicId)
            .setMessage(JSON.stringify(voteMessage));
        
        const submitResponse = await submitTx.execute(hederaClient);
        const receipt = await submitResponse.getReceipt(hederaClient);
        
        console.log(`   ✅ Vote submitted to HCS!`);
        console.log(`      Sequence Number: ${receipt.topicSequenceNumber}`);
        console.log(`      Message ID: ${receipt.topicRunningHash}`);
        
        // Estimate cost
        const txRecord = await submitResponse.getRecord(hederaClient);
        const cost = txRecord.transactionFee;
        
        console.log(`      Cost: ${cost.toString()} (~$0.0001)`);
        
        return {
            sequenceNumber: receipt.topicSequenceNumber.toString(),
            messageId: receipt.topicRunningHash.toString(),
            voter: ethWallet.address,
            support: support,
            signature: signature,
            timestamp: voteMessage.timestamp,
            cost: cost.toString()
        };
        
    } catch (error) {
        console.error(`   ❌ Vote submission failed:`, error.message);
        throw error;
    }
}

// ============ VOTE VERIFICATION ============

async function verifyVoteOnChain(provider, governanceAddress, proposalId, voter) {
    console.log(`\n🔍 Verifying vote on-chain...`);
    
    const governanceAbi = [
        "function hasVoted(uint256 proposalId, address voter) external view returns (bool)",
        "function getVote(uint256 proposalId, address voter) external view returns (bool voted, uint8 support, uint256 votingPower, bytes32 hcsMessageId)"
    ];
    
    const governance = new ethers.Contract(governanceAddress, governanceAbi, provider);
    
    try {
        const voted = await governance.hasVoted(proposalId, voter);
        
        if (voted) {
            const voteDetails = await governance.getVote(proposalId, voter);
            console.log(`   ✅ Vote recorded on-chain`);
            console.log(`      Support: ${voteDetails.support === 1n ? 'FOR' : voteDetails.support === 0n ? 'AGAINST' : 'ABSTAIN'}`);
            console.log(`      Voting Power: ${voteDetails.votingPower.toString()}`);
            console.log(`      HCS Message ID: ${voteDetails.hcsMessageId}`);
        } else {
            console.log(`   ⏳ Vote not yet tallied on-chain`);
            console.log(`      Run: node scripts/tally-hcs-votes.js --proposal ${proposalId}`);
        }
        
        return voted;
        
    } catch (error) {
        console.error(`   ❌ Verification failed:`, error.message);
        return false;
    }
}

// ============ BATCH VOTING ============

async function batchSubmitVotes(hederaClient, ethWallet, topicId, votes) {
    console.log(`\n📊 Batch submitting ${votes.length} votes...`);
    
    const results = [];
    
    for (const vote of votes) {
        try {
            const result = await submitVoteToHCS(
                hederaClient,
                ethWallet,
                topicId,
                vote.proposalId,
                vote.support
            );
            
            results.push({ success: true, ...result });
            
            // Rate limit: 1 vote per second
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            results.push({
                success: false,
                proposalId: vote.proposalId,
                error: error.message
            });
        }
    }
    
    console.log(`\n✅ Batch submission complete`);
    console.log(`   Successful: ${results.filter(r => r.success).length}`);
    console.log(`   Failed: ${results.filter(r => !r.success).length}`);
    
    return results;
}

// ============ TOPIC INFO ============

async function getTopicInfo(client, topicId) {
    console.log(`\n📡 Fetching HCS topic info...`);
    
    try {
        const query = new TopicInfoQuery()
            .setTopicId(topicId);
        
        const info = await query.execute(client);
        
        console.log(`   Topic ID: ${topicId}`);
        console.log(`   Memo: ${info.topicMemo}`);
        console.log(`   Sequence Number: ${info.sequenceNumber}`);
        console.log(`   Running Hash: ${info.runningHash}`);
        console.log(`   Admin Key: ${info.adminKey ? 'Set' : 'None'}`);
        console.log(`   Submit Key: ${info.submitKey ? 'Set' : 'None (anyone can submit)'}`);
        
        return info;
        
    } catch (error) {
        console.error(`   ❌ Failed to fetch topic info:`, error.message);
        throw error;
    }
}

// ============ MAIN EXECUTION ============

async function main() {
    console.log(`\n🗳️  Ajo.save HCS Vote Submission`);
    console.log(`================================\n`);
    
    // Parse arguments
    const args = process.argv.slice(2);
    const proposalId = parseInt(args[args.indexOf('--proposal') + 1]);
    const support = parseInt(args[args.indexOf('--support') + 1]);
    const topicIdStr = args[args.indexOf('--topic') + 1];
    const batch = args.includes('--batch');
    const verify = args.includes('--verify');
    
    if (!proposalId || support === undefined || !topicIdStr) {
        console.log(`Usage: node submit-hcs-vote.js --proposal <id> --support <0|1|2> --topic <0.0.X>`);
        console.log(``);
        console.log(`Options:`);
        console.log(`  --proposal <id>   Proposal ID to vote on`);
        console.log(`  --support <0|1|2> Vote: 0=Against, 1=For, 2=Abstain`);
        console.log(`  --topic <0.0.X>   HCS Topic ID for this Ajo group`);
        console.log(`  --batch           Submit multiple votes from file`);
        console.log(`  --verify          Verify vote was recorded on-chain`);
        console.log(``);
        console.log(`Examples:`);
        console.log(`  # Vote FOR proposal 1`);
        console.log(`  node submit-hcs-vote.js --proposal 1 --support 1 --topic 0.0.12345`);
        console.log(``);
        console.log(`  # Vote AGAINST with verification`);
        console.log(`  node submit-hcs-vote.js --proposal 1 --support 0 --topic 0.0.12345 --verify`);
        process.exit(1);
    }
    
    // Validate environment
    if (!CONFIG.operatorId || !CONFIG.operatorKey) {
        throw new Error('Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY');
    }
    
    // Initialize Hedera client
    const hederaClient = CONFIG.network === 'mainnet'
        ? Client.forMainnet()
        : Client.forTestnet();
    
    hederaClient.setOperator(
        AccountId.fromString(CONFIG.operatorId),
        PrivateKey.fromString(CONFIG.operatorKey)
    );
    
    console.log(`📡 Connected to Hedera ${CONFIG.network}`);
    console.log(`   Account: ${CONFIG.operatorId}`);
    
    // Initialize Ethereum wallet (for signing)
    const ethProvider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    const ethWallet = new ethers.Wallet(CONFIG.operatorKey, ethProvider);
    
    console.log(`   Ethereum Address: ${ethWallet.address}`);
    
    // Get topic info
    await getTopicInfo(hederaClient, topicIdStr);
    
    // Submit vote
    let result;
    
    if (batch) {
        // Load votes from file
        const votesFile = args[args.indexOf('--batch') + 1] || 'votes.json';
        const votes = JSON.parse(fs.readFileSync(votesFile, 'utf8'));
        result = await batchSubmitVotes(hederaClient, ethWallet, topicIdStr, votes);
    } else {
        // Single vote
        result = await submitVoteToHCS(
            hederaClient,
            ethWallet,
            topicIdStr,
            proposalId,
            support
        );
        
        // Save result
        const outputFile = `./votes/vote-${proposalId}-${Date.now()}.json`;
        const outputDir = './votes';
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
        console.log(`\n💾 Vote saved to: ${outputFile}`);
    }
    
    // Verify on-chain if requested
    if (verify && CONFIG.governanceAddress) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s for indexing
        await verifyVoteOnChain(ethProvider, CONFIG.governanceAddress, proposalId, ethWallet.address);
    }
    
    console.log(`\n✅ Vote submission complete!`);
    console.log(`\nNext steps:`);
    console.log(`1. Wait for voting period to end`);
    console.log(`2. Run tallying script: node scripts/tally-hcs-votes.js --proposal ${proposalId}`);
    console.log(`3. Execute proposal if passed: node scripts/execute-proposal.js --proposal ${proposalId}`);
    
    hederaClient.close();
}

// ============ ERROR HANDLING ============

process.on('unhandledRejection', (error) => {
    console.error('\n❌ Unhandled error:', error);
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { submitVoteToHCS, verifyVoteOnChain, batchSubmitVotes };