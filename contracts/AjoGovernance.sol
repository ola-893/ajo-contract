// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "./AjoInterfaces.sol";

contract AjoGovernance is IAjoGovernance, ERC20, ERC20Votes {
    
    // ============ CONSTANTS ============
    
    uint256 public constant PROPOSAL_THRESHOLD = 1000e18; // Need 1000 voting power to propose
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant DEFAULT_PENALTY_RATE = 500; // 5% (500 basis points)
    
    // ============ STATE VARIABLES ============
    
    address public ajoCore;
    IAjoMembers public immutable membersContract;
    
    uint256 public proposalCount;
    uint256 public penaltyRate = DEFAULT_PENALTY_RATE;
    
    struct GovernanceProposal {
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        mapping(address => bool) hasVoted;
        mapping(address => uint8) votes; // 0=Against, 1=For, 2=Abstain
        uint256 proposalEndTime;
        bool executed;
        bytes proposalData;
    }
    
    mapping(uint256 => GovernanceProposal) public proposals;
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _ajoCore, address _membersContract) 
        ERC20("AjoGovernanceToken", "AGT")
        ERC20Permit("AjoGovernanceToken")
    {
        ajoCore = _ajoCore;
        membersContract = IAjoMembers(_membersContract);
    }
    
    function setAjoCore(address _ajoCore) external {
       ajoCore = _ajoCore;
   }

    // ============ CORE GOVERNANCE FUNCTIONS (IAjoGovernance) ============
    
    function createProposal(
        string memory description,
        bytes memory proposalData
    ) external override returns (uint256) {
        require(balanceOf(msg.sender) >= PROPOSAL_THRESHOLD, "Insufficient voting power");
        
        uint256 proposalId = proposalCount++;
        GovernanceProposal storage proposal = proposals[proposalId];
        
        proposal.description = description;
        proposal.proposalEndTime = block.timestamp + VOTING_PERIOD;
        proposal.executed = false;
        proposal.proposalData = proposalData;
        
        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }
    
    function vote(uint256 proposalId, uint8 support) external override {
        GovernanceProposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.proposalEndTime, "Proposal not active");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(support <= 2, "Invalid vote type");
        
        uint256 votingWeight = balanceOf(msg.sender);
        require(votingWeight > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = support;
        
        if (support == 0) {
            proposal.againstVotes += votingWeight;
        } else if (support == 1) {
            proposal.forVotes += votingWeight;
        } else {
            proposal.abstainVotes += votingWeight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingWeight);
    }
    
    function executeProposal(uint256 proposalId) external override {
        GovernanceProposal storage proposal = proposals[proposalId];
        
        require(block.timestamp > proposal.proposalEndTime, "Voting still active");
        require(!proposal.executed, "Already executed");
        require(proposal.forVotes > proposal.againstVotes, "Proposal failed");
        
        proposal.executed = true;
        
        // Execute the proposal
        if (proposal.proposalData.length > 0) {
            (bool success,) = ajoCore.call(proposal.proposalData);
            require(success, "Execution failed");
        }
        
        emit ProposalExecuted(proposalId);
    }
    
    // ============ GOVERNANCE-ONLY FUNCTIONS (IAjoGovernance) ============
    
    function updatePenaltyRate(uint256 newPenaltyRate) external override {
        require(msg.sender == address(this), "Only governance");
        require(newPenaltyRate <= 2000, "Penalty rate too high"); // Max 20%
        penaltyRate = newPenaltyRate;
    }
    
    function switchPaymentToken(PaymentToken newToken) external override {
        require(msg.sender == address(this), "Only governance");
        // This would typically call the core contract to switch tokens
        // Implementation depends on how AjoCore handles token switching
    }
    
    // ============ VIEW FUNCTIONS (IAjoGovernance) ============
    
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
        GovernanceProposal storage proposal = proposals[proposalId];
        return (
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.proposalEndTime,
            proposal.executed,
            proposal.proposalData
        );
    }
    
    function hasVoted(uint256 proposalId, address voter) external view override returns (bool) {
        return proposals[proposalId].hasVoted[voter];
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
    
    // ============ VOTING POWER MANAGEMENT ============
    
    function updateVotingPower(address member, uint256 newPower) public onlyAjoCore {
        uint256 currentBalance = balanceOf(member);
        
        if (newPower > currentBalance) {
            _mint(member, newPower - currentBalance);
        } else if (newPower < currentBalance) {
            _burn(member, currentBalance - newPower);
        }
        
        emit VotingPowerUpdated(member, newPower);
    }
    
    function calculateVotingPower(address member) external view returns (uint256) {
        Member memory memberInfo = membersContract.getMember(member);
        
        if (!memberInfo.isActive) return 0;
        
        // Base voting power calculation: collateral * reputation / 1000
        uint256 votingPower = memberInfo.lockedCollateral > 0 ? 
            (memberInfo.lockedCollateral * memberInfo.reputationScore) / 1000 : 
            memberInfo.reputationScore; // Base voting power for zero collateral users
            
        return votingPower;
    }
    
    function updateReputationAndVotingPower(address member, bool positive) external onlyAjoCore {
        Member memory memberInfo = membersContract.getMember(member);
        uint256 newReputation = memberInfo.reputationScore;
        
        if (positive && newReputation < 1000) {
            newReputation += 10;
            if (newReputation > 1000) newReputation = 1000;
        } else if (!positive && newReputation > 100) {
            newReputation = newReputation >= 50 ? newReputation - 50 : 100;
        }
        
        // Update reputation in members contract
        membersContract.updateReputation(member, newReputation);
        
        // Update voting power based on new reputation
        uint256 newVotingPower = memberInfo.lockedCollateral > 0 ? 
            (memberInfo.lockedCollateral * newReputation) / 1000 : 
            newReputation; // Base voting power for zero collateral users
        
        updateVotingPower(member, newVotingPower);
        
        emit ReputationUpdated(member, newReputation);
    }
    
    // ============ ADDITIONAL VIEW FUNCTIONS ============
    
    function getVote(uint256 proposalId, address voter) external view returns (uint8) {
        return proposals[proposalId].votes[voter];
    }
    
    function isProposalActive(uint256 proposalId) external view returns (bool) {
        return block.timestamp <= proposals[proposalId].proposalEndTime && !proposals[proposalId].executed;
    }
    
    function getProposalResult(uint256 proposalId) external view returns (bool passed) {
        GovernanceProposal storage proposal = proposals[proposalId];
        return proposal.forVotes > proposal.againstVotes;
    }
    
    function getCurrentPenaltyRate() external view returns (uint256) {
        return penaltyRate;
    }
    
    // ============ ERC20Votes OVERRIDES ============
    
    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
}