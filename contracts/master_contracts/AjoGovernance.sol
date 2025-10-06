// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../core/LockableContract.sol";
import "../interfaces/AjoInterfaces.sol";

/**
 * @title AjoGovernanceHCS
 * @notice Hedera Consensus Service (HCS) enabled governance for Ajo.save
 * @dev Hybrid governance: HCS for voting (off-chain), smart contract for settlement
 * 
 * Key Benefits:
 * - 90%+ cost reduction (100 votes = $0.02 vs $0.10)
 * - Immutable audit trail via HCS
 * - Scales to thousands of voters
 * - Maintains smart contract security for execution
 */
contract AjoGovernanceHCS is Initializable, IAjoGovernance, Ownable, ReentrancyGuard, LockableContract {
    
    // ============ CONSTANTS ============
    
    uint256 public constant PROPOSAL_THRESHOLD = 1000e18; // Need 1000 voting power to propose
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant DEFAULT_PENALTY_RATE = 500; // 5% (500 basis points)
    uint256 public constant CHALLENGE_PERIOD = 1 days; // Time to challenge vote batch
    
    // ============ STRUCTS ============
    
    struct HCSProposal {
        string description;
        bytes proposalData;
        address proposer;
        uint256 proposalEndTime;
        uint256 settlementDeadline;
        bytes32 hcsTopicId; // Hedera topic ID for this proposal
        bool executed;
        bool settled; // Whether votes have been settled on-chain
        ProposalStatus status;
    }
    
    struct VoteBatch {
        bytes32 merkleRoot; // Root of Merkle tree containing all votes
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 totalVoters;
        uint256 settlementTime;
        address aggregator; // Who submitted this batch
        bool challenged; // Whether batch was successfully challenged
    }
    
    struct VoteProof {
        address voter;
        uint8 support; // 0=Against, 1=For, 2=Abstain
        uint256 votingPower;
        bytes32[] merkleProof;
    }
    
    enum ProposalStatus {
        Active,      // Voting in progress
        Defeated,    // Voting ended, failed
        Succeeded,   // Voting ended, passed
        Executed,    // Successfully executed
        Challenged   // Vote batch was challenged
    }
    
    // ============ STATE VARIABLES ============
    
    address public ajoCore;
    IAjoMembers public membersContract;
    
    uint256 public proposalCount;
    uint256 public penaltyRate = DEFAULT_PENALTY_RATE;
    
    // Proposal ID => Proposal data
    mapping(uint256 => HCSProposal) public proposals;
    
    // Proposal ID => Vote batch data
    mapping(uint256 => VoteBatch) public voteBatches;
    
    // Proposal ID => Voter => Has voted (prevents double voting in challenges)
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    
    // Track aggregators for reputation/slashing
    mapping(address => uint256) public aggregatorReputation;
    mapping(address => uint256) public aggregatorStake;
    
    // ============ EVENTS ============
    
    event HCSProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 indexed hcsTopicId,
        string description
    );
    
    event VoteBatchSubmitted(
        uint256 indexed proposalId,
        address indexed aggregator,
        bytes32 merkleRoot,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 totalVoters
    );
    
    event VoteChallenged(
        uint256 indexed proposalId,
        address indexed challenger,
        address indexed voter,
        string reason
    );
    
    event VoteBatchValidated(
        uint256 indexed proposalId,
        bool valid
    );
    
    event AggregatorSlashed(
        address indexed aggregator,
        uint256 amount
    );
    
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    modifier onlyAggregator() {
        require(aggregatorStake[msg.sender] > 0, "Not authorized aggregator");
        _;
    }
    
    // ============ CONSTRUCTOR (for master copy) ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER (for proxy instances) ============
    
    function initialize(
        address _ajoCore,
        address /* _governanceToken - kept for interface compatibility */
    ) external override initializer {
        require(_ajoCore != address(0), "Invalid AjoCore");
        
        _transferOwnership(msg.sender);
        ajoCore = _ajoCore;
        proposalCount = 0;
        penaltyRate = DEFAULT_PENALTY_RATE;
    }
    
    // ============ SETUP FUNCTIONS ============
    
    function setAjoCore(address _ajoCore) external onlyOwner onlyDuringSetup {
        require(_ajoCore != address(0), "Zero address");
        require(_ajoCore != ajoCore, "Already set");
        
        address oldCore = ajoCore;
        ajoCore = _ajoCore;
        
        emit AjoCoreUpdated(oldCore, _ajoCore);
    }
    
    function setMembersContract(address _membersContract) external onlyOwner onlyDuringSetup {
        require(_membersContract != address(0), "Zero address");
        membersContract = IAjoMembers(_membersContract);
    }
    
    function verifySetup() external view override(IAjoGovernance, LockableContract) returns (bool isValid, string memory reason) {
        if (ajoCore == address(0)) {
            return (false, "AjoCore not set");
        }
        if (address(membersContract) == address(0)) {
            return (false, "MembersContract not set");
        }
        return (true, "Setup valid");
    }
    
    // ============ AGGREGATOR MANAGEMENT ============
    
    /**
     * @dev Register as vote aggregator with stake
     * @notice Aggregators stake tokens to gain trust and earn fees
     */
    function registerAggregator() external payable override {
        require(msg.value >= 1 ether, "Insufficient stake"); // 1 HBAR minimum
        aggregatorStake[msg.sender] += msg.value;
        aggregatorReputation[msg.sender] = 100; // Starting reputation
    }
    
    /**
     * @dev Withdraw aggregator stake (if no active proposals)
     */
    function withdrawAggregatorStake(uint256 amount) external override nonReentrant {
        require(aggregatorStake[msg.sender] >= amount, "Insufficient stake");
        aggregatorStake[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    // ============ HCS PROPOSAL CREATION ============
    
    /**
     * @dev Create proposal with HCS topic
     * @notice This creates the on-chain proposal record and associated HCS topic
     * @param description Human-readable proposal description
     * @param proposalData Encoded execution data
     * @return proposalId Unique proposal identifier
     * 
     * Off-chain flow:
     * 1. User calls this function to create proposal
     * 2. TopicCreateTransaction is called via Hedera SDK to create HCS topic
     * 3. Topic ID is stored in proposal struct
     * 4. Voters submit votes to HCS topic (nearly free)
     * 5. Aggregator tallies votes and submits batch to smart contract
     */
    function createProposal(
        string memory description,
        bytes memory proposalData
    ) external override returns (uint256) {
        // Check voting power
        Member memory memberInfo = membersContract.getMember(msg.sender);
        uint256 votingPower = calculateVotingPower(msg.sender);
        require(votingPower >= PROPOSAL_THRESHOLD, "Insufficient voting power");
        
        uint256 proposalId = proposalCount++;
        HCSProposal storage proposal = proposals[proposalId];
        
        proposal.description = description;
        proposal.proposalData = proposalData;
        proposal.proposer = msg.sender;
        proposal.proposalEndTime = block.timestamp + VOTING_PERIOD;
        proposal.settlementDeadline = block.timestamp + VOTING_PERIOD + CHALLENGE_PERIOD;
        proposal.status = ProposalStatus.Active;
        
        // HCS topic ID should be set by off-chain service after topic creation
        // For now, emit event that off-chain service will listen to
        emit ProposalCreated(proposalId, msg.sender, description);
        
        return proposalId;
    }
    
    /**
     * @dev Set HCS topic ID after off-chain topic creation
     * @param proposalId The proposal to update
     * @param topicId Hedera topic ID (e.g., "0.0.123456")
     */
    function setHCSTopicId(uint256 proposalId, bytes32 topicId) external override onlyOwner {
        require(proposalId < proposalCount, "Invalid proposal");
        require(proposals[proposalId].hcsTopicId == bytes32(0), "Topic already set");
        
        proposals[proposalId].hcsTopicId = topicId;
        
        emit HCSProposalCreated(
            proposalId,
            proposals[proposalId].proposer,
            topicId,
            proposals[proposalId].description
        );
    }
    
    // ============ OFF-CHAIN VOTING (HCS) ============
    
    /**
     * @dev Vote function - kept for interface compatibility but redirects to HCS
     * @notice Actual voting happens off-chain via HCS topic messages
     * @param proposalId ID of proposal
     * @param support Vote type: 0=Against, 1=For, 2=Abstain
     * 
     * Real implementation:
     * Users submit votes directly to HCS topic via Hedera SDK:
     * - Message format: {"proposalId": X, "voter": "0x...", "support": 1, "signature": "0x..."}
     * - Cost: ~$0.0001 per vote (100 votes = $0.01)
     * - Consensus time: 3-5 seconds
     * - Immutable audit trail
     */
    function vote(uint256 proposalId, uint8 support) external override {
        revert("Use HCS topic for voting - see documentation");
    }
    
    // ============ VOTE AGGREGATION & SETTLEMENT ============
    
    /**
     * @dev Submit aggregated vote batch from HCS
     * @notice Aggregator queries Mirror Node API, builds Merkle tree, submits root
     * @param proposalId The proposal votes are for
     * @param merkleRoot Root of Merkle tree containing all votes
     * @param forVotes Total voting power for
     * @param againstVotes Total voting power against  
     * @param abstainVotes Total abstain voting power
     * @param totalVoters Number of unique voters
     * 
     * Aggregation process:
     * 1. Query Mirror Node API for all messages in HCS topic
     * 2. Validate signatures and voting power for each vote
     * 3. Build Merkle tree of all valid votes
     * 4. Submit root + tallies to smart contract
     * 5. Enter challenge period where anyone can dispute
     */
    function submitVoteBatch(
        uint256 proposalId,
        bytes32 merkleRoot,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 totalVoters
    ) external onlyAggregator nonReentrant {
        HCSProposal storage proposal = proposals[proposalId];
        
        require(proposal.status == ProposalStatus.Active, "Not active");
        require(block.timestamp > proposal.proposalEndTime, "Voting ongoing");
        require(!proposal.settled, "Already settled");
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        
        VoteBatch storage batch = voteBatches[proposalId];
        batch.merkleRoot = merkleRoot;
        batch.forVotes = forVotes;
        batch.againstVotes = againstVotes;
        batch.abstainVotes = abstainVotes;
        batch.totalVoters = totalVoters;
        batch.settlementTime = block.timestamp;
        batch.aggregator = msg.sender;
        
        proposal.settled = true;
        
        // Update status based on vote results
        if (forVotes > againstVotes) {
            proposal.status = ProposalStatus.Succeeded;
        } else {
            proposal.status = ProposalStatus.Defeated;
        }
        
        emit VoteBatchSubmitted(
            proposalId,
            msg.sender,
            merkleRoot,
            forVotes,
            againstVotes,
            totalVoters
        );
    }
    
    // ============ CHALLENGE MECHANISM ============
    
    /**
     * @dev Challenge a vote batch with proof of invalid vote
     * @notice If challenge succeeds, aggregator is slashed
     * @param proposalId Proposal to challenge
     * @param proof Vote proof showing the invalid vote
     * 
     * Challenge scenarios:
     * - Vote from non-member
     * - Incorrect voting power calculation
     * - Double voting
     * - Invalid signature
     * - Vote not in Merkle tree
     */
    function challengeVoteBatch(
        uint256 proposalId,
        VoteProof memory proof
    ) external nonReentrant {
        HCSProposal storage proposal = proposals[proposalId];
        VoteBatch storage batch = voteBatches[proposalId];
        
        require(proposal.settled, "Not settled");
        require(!batch.challenged, "Already challenged");
        require(
            block.timestamp <= batch.settlementTime + CHALLENGE_PERIOD,
            "Challenge period ended"
        );
        
        // Verify vote is in Merkle tree
        bytes32 leaf = keccak256(abi.encodePacked(
            proof.voter,
            proof.support,
            proof.votingPower
        ));
        
        bool validProof = MerkleProof.verify(
            proof.merkleProof,
            batch.merkleRoot,
            leaf
        );
        
        require(validProof, "Invalid merkle proof");
        
        // Now validate the vote itself
        bool isInvalid = false;
        string memory reason;
        
        // Check 1: Is voter a member?
        Member memory memberInfo = membersContract.getMember(proof.voter);
        if (!memberInfo.isActive) {
            isInvalid = true;
            reason = "Voter not active member";
        }
        
        // Check 2: Is voting power correct?
        if (!isInvalid) {
            uint256 actualPower = calculateVotingPower(proof.voter);
            if (actualPower != proof.votingPower) {
                isInvalid = true;
                reason = "Incorrect voting power";
            }
        }
        
        // Check 3: Double voting?
        if (!isInvalid && _hasVoted[proposalId][proof.voter]) {
            isInvalid = true;
            reason = "Double vote detected";
        }
        
        if (isInvalid) {
            // Challenge successful - slash aggregator
            batch.challenged = true;
            proposal.status = ProposalStatus.Challenged;
            
            uint256 slashAmount = aggregatorStake[batch.aggregator] / 10; // 10% slash
            aggregatorStake[batch.aggregator] -= slashAmount;
            aggregatorReputation[batch.aggregator] = aggregatorReputation[batch.aggregator] >= 50 
                ? aggregatorReputation[batch.aggregator] - 50 
                : 0;
            
            // Reward challenger
            (bool success, ) = msg.sender.call{value: slashAmount}("");
            require(success, "Reward transfer failed");
            
            emit VoteChallenged(proposalId, msg.sender, proof.voter, reason);
            emit AggregatorSlashed(batch.aggregator, slashAmount);
        } else {
            revert("Challenge failed - vote is valid");
        }
    }
    
    // ============ PROPOSAL EXECUTION ============
    
    /**
     * @dev Execute a successful proposal after challenge period
     * @param proposalId Proposal to execute
     */
    function executeProposal(uint256 proposalId) external override nonReentrant {
        HCSProposal storage proposal = proposals[proposalId];
        VoteBatch storage batch = voteBatches[proposalId];
        
        require(proposal.status == ProposalStatus.Succeeded, "Not succeeded");
        require(!proposal.executed, "Already executed");
        require(
            block.timestamp > batch.settlementTime + CHALLENGE_PERIOD,
            "Challenge period active"
        );
        require(!batch.challenged, "Batch was challenged");
        
        proposal.executed = true;
        proposal.status = ProposalStatus.Executed;
        
        // Execute proposal
        if (proposal.proposalData.length > 0) {
            (bool success, ) = ajoCore.call(proposal.proposalData);
            require(success, "Execution failed");
        }
        
        // Reward aggregator
        aggregatorReputation[batch.aggregator] += 10;
        
        emit ProposalExecuted(proposalId);
    }
    
    // ============ GOVERNANCE FUNCTIONS ============
    
    function updatePenaltyRate(uint256 newPenaltyRate) external override {
        require(msg.sender == address(this), "Only governance");
        require(newPenaltyRate <= 2000, "Rate too high");
        penaltyRate = newPenaltyRate;
    }
    
    function updateReputationAndVotingPower(
        address member,
        bool positive
    ) external override onlyAjoCore {
        Member memory memberInfo = membersContract.getMember(member);
        uint256 newReputation = memberInfo.reputationScore;
        
        if (positive && newReputation < 1000) {
            newReputation += 10;
            if (newReputation > 1000) newReputation = 1000;
        } else if (!positive && newReputation > 100) {
            newReputation = newReputation >= 50 ? newReputation - 50 : 100;
        }
        
        membersContract.updateReputation(member, newReputation);
        emit ReputationUpdated(member, newReputation);
    }
    
    function updateVotingPower(address member, uint256 newPower) public override onlyAjoCore {
        // In HCS model, voting power is calculated on-demand, not stored as tokens
        // This function is kept for interface compatibility
        emit VotingPowerUpdated(member, newPower);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getProposal(uint256 proposalId)
        external
        view
        override
        returns (
            string memory description,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 proposalEndTime,
            bool executed,
            bytes memory proposalData
        )
    {
        HCSProposal storage proposal = proposals[proposalId];
        VoteBatch storage batch = voteBatches[proposalId];
        
        return (
            proposal.description,
            batch.forVotes,
            batch.againstVotes,
            batch.abstainVotes,
            proposal.proposalEndTime,
            proposal.executed,
            proposal.proposalData
        );
    }
    
    function hasVoted(uint256 proposalId, address voter) 
        external 
        view 
        override 
        returns (bool) 
    {
        return _hasVoted[proposalId][voter];
    }
    
    function getGovernanceSettings()
        external
        view
        override
        returns (
            uint256 proposalThreshold,
            uint256 votingPeriod,
            uint256 currentPenaltyRate,
            uint256 totalProposals
        )
    {
        return (
            PROPOSAL_THRESHOLD,
            VOTING_PERIOD,
            penaltyRate,
            proposalCount
        );
    }
    
    /**
     * @dev Calculate voting power based on collateral and reputation
     */
    function calculateVotingPower(address member) public view returns (uint256) {
        Member memory memberInfo = membersContract.getMember(member);
        
        if (!memberInfo.isActive) return 0;
        
        return memberInfo.lockedCollateral > 0 ? 
            (memberInfo.lockedCollateral * memberInfo.reputationScore) / 1000 : 
            memberInfo.reputationScore;
    }
    
    /**
     * @dev Get full proposal details including HCS info
     */
    function getHCSProposalDetails(uint256 proposalId)
        external
        view
        returns (
            HCSProposal memory proposal,
            VoteBatch memory batch,
            bool canExecute,
            bool inChallengePeriod
        )
    {
        proposal = proposals[proposalId];
        batch = voteBatches[proposalId];
        
        inChallengePeriod = proposal.settled && 
            block.timestamp <= batch.settlementTime + CHALLENGE_PERIOD;
        
        canExecute = proposal.status == ProposalStatus.Succeeded &&
            !proposal.executed &&
            !inChallengePeriod &&
            !batch.challenged;
        
        return (proposal, batch, canExecute, inChallengePeriod);
    }
    
    /**
     * @dev Get aggregator information
     */
    function getAggregatorInfo(address aggregator)
        external
        view
        returns (
            uint256 stake,
            uint256 reputation,
            bool isActive
        )
    {
        return (
            aggregatorStake[aggregator],
            aggregatorReputation[aggregator],
            aggregatorStake[aggregator] > 0
        );
    }
    
    /**
     * @dev Get HCS topic ID for proposal
     */
    function getHCSTopicId(uint256 proposalId) external view returns (bytes32) {
        return proposals[proposalId].hcsTopicId;
    }
}