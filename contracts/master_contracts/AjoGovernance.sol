// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../interfaces/AjoInterfaces.sol";
import "../hedera/hedera-token-service/HederaTokenService.sol";
import "../hedera/HederaResponseCodes.sol";

/**
 * @title AjoGovernance
 * @notice Governance using HCS for vote submission (HSS removed - moved to separate contract)
 * @dev Simplified approach: no aggregators, no Merkle trees, no challenges
 * 
 * KEY CHANGE: Now inherits from HederaTokenService instead of using HTSHelper
 * 
 * Architecture:
 * 1. Member creates proposal on-chain
 * 2. HCS topic is created off-chain (via SDK)
 * 3. Members vote by submitting to HCS topic ($0.0001/vote)
 * 4. Anyone tallies votes by reading Mirror Node + submitting on-chain
 * 5. Contract verifies signatures and counts votes
 * 6. After voting period, proposal can be executed
 * 
 * Key Benefits:
 * - 90%+ cost reduction vs on-chain voting
 * - No trusted aggregators (anyone can tally)
 * - Simple and auditable
 * - Perfect for 10-52 member groups
 * - Direct HTS integration via inheritance
 */
contract AjoGovernance is 
    Initializable, 
    IAjoGovernance, 
    Ownable, 
    ReentrancyGuard, 
    Pausable,
    HederaTokenService  // ✅ INHERIT from HederaTokenService
{
    using ECDSA for bytes32;
    
    // ============ STATE VARIABLES ============
    
    address public ajoCore;
    address public ajoSchedule; // Separate contract for HSS
    address public membersContract;
    bytes32 public hcsTopicId;
    
    // ✅ REMOVED: address public hederaTokenService; 
    // No longer needed - inherited from HederaTokenService
    
    // Proposal tracking
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    
    // Governance parameters
    uint256 public votingPeriod;
    uint256 public proposalThreshold;
    uint256 public quorumPercentage;
    uint256 public penaltyRate;
    
    // ============ STRUCTS ============
    
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        bytes proposalData;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool canceled;
        ProposalType proposalType;
    }
    
    enum ProposalType {
        ChangeMonthlyPayment,
        ChangeDuration,
        ChangeCollateralFactor,
        RemoveMember,
        EmergencyPause,
        UpdatePenaltyRate,
        FreezeAccount,
        UnfreezeAccount,
        Custom
    }
    
    // Vote tracking
    mapping(uint256 => mapping(address => bool)) public hasVotedMap;
    mapping(uint256 => mapping(address => HcsVote)) public votes;
    
    // ============ EVENTS ============
    
    event TokenFreezeAttempt(address indexed token, address indexed account, int64 responseCode, bool success);
    event TokenUnfreezeAttempt(address indexed token, address indexed account, int64 responseCode, bool success);
    event TokenPauseAttempt(address indexed token, int64 responseCode, bool success);
    event TokenUnpauseAttempt(address indexed token, int64 responseCode, bool success);
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    modifier onlyMember() {
        require(_isMember(msg.sender), "Not a member");
        _;
    }
    
    modifier proposalExists(uint256 proposalId) {
        require(proposalId > 0 && proposalId <= proposalCount, "Proposal doesn't exist");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZATION ============
    
    /**
     * @notice Initialize the governance contract
     * @param _ajoCore Address of AjoCore contract
     * @param _ajoSchedule Address of AjoSchedule contract (for HSS integration)
     * @param _hederaTokenService DEPRECATED - kept for interface compatibility only
     * @param _hcsTopicId HCS topic ID for this Ajo's governance
     */
    function initialize(
        address _ajoCore,
        address _ajoSchedule,
        address _hederaTokenService, // ✅ Ignored - kept for interface compatibility
        bytes32 _hcsTopicId
    ) external override initializer {
        require(_ajoCore != address(0), "Invalid AjoCore");
        // ✅ No longer requiring _hederaTokenService - we inherit it
        
        _transferOwnership(msg.sender);
        
        ajoCore = _ajoCore;
        ajoSchedule = _ajoSchedule;
        // ✅ REMOVED: hederaTokenService = _hederaTokenService;
        hcsTopicId = _hcsTopicId;
        proposalCount = 0;
        
        // Set default governance parameters
        votingPeriod = 7 days;
        proposalThreshold = 1;
        quorumPercentage = 51;
        penaltyRate = 5;
    }
    
    function setMembersContract(address _membersContract) external onlyOwner {
        require(_membersContract != address(0), "Invalid address");
        membersContract = _membersContract;
    }
    
    function verifySetup() external view override returns (bool isValid, string memory reason) {
        if (ajoCore == address(0)) return (false, "AjoCore not set");
        if (membersContract == address(0)) return (false, "Members contract not set");
        if (hcsTopicId == bytes32(0)) return (false, "HCS topic not set");
        return (true, "");
    }
    
    function getHcsTopicId() external view override returns (bytes32) {
        return hcsTopicId;
    }
    
    function setHcsTopicId(bytes32 newTopicId) external onlyOwner {
        hcsTopicId = newTopicId;
    }
    
    // ============ INTERNAL HTS HELPER FUNCTIONS ============
    
    /**
     * @dev Get human-readable error message for HTS response code
     */
    function _getHtsErrorMessage(int responseCode) internal pure returns (string memory) {
        if (responseCode == 22) return "Success";
        if (responseCode == 111) return "Invalid token ID";
        if (responseCode == 15) return "Invalid account ID";
        if (responseCode == 164) return "Insufficient token balance";
        if (responseCode == 167) return "Token not associated to account";
        if (responseCode == 162) return "Account frozen for token";
        if (responseCode == 138) return "Token was deleted";
        if (responseCode == 7) return "Invalid signature";
        if (responseCode == 177) return "Token is paused";
        if (responseCode == 202) return "Invalid freeze key";
        if (responseCode == 203) return "Invalid wipe key";
        return "Unknown error";
    }
    
    /**
     * @dev Check if HTS operation was successful
     */
    function _isHtsSuccess(int responseCode) internal pure returns (bool) {
        return responseCode == HederaResponseCodes.SUCCESS;
    }
    
    // ============ PROPOSAL CREATION ============
    
    /**
     * @notice Create a new governance proposal
     * @param description Human-readable description
     * @param proposalData Encoded execution data
     * @return proposalId Unique identifier
     */
    function createProposal(
        string memory description,
        bytes memory proposalData
    ) external override onlyMember whenNotPaused returns (uint256 proposalId) {
        uint256 votingPower = getVotingPower(msg.sender);
        require(votingPower >= proposalThreshold, "Insufficient voting power");
        
        proposalCount++;
        proposalId = proposalCount;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.proposalData = proposalData;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;
        proposal.proposalType = ProposalType.Custom;
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            description,
            proposal.startTime,
            proposal.endTime
        );
        
        return proposalId;
    }
    
    /**
     * @notice Cancel a proposal (only proposer or governance)
     */
    function cancelProposal(uint256 proposalId) 
        external 
        override
        proposalExists(proposalId) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(
            msg.sender == proposal.proposer || msg.sender == ajoCore,
            "Only proposer or governance"
        );
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Already canceled");
        
        proposal.canceled = true;
        emit ProposalCanceled(proposalId, msg.sender);
    }
    
    function getProposal(uint256 proposalId) 
        external 
        view 
        override
        proposalExists(proposalId) 
        returns (
            string memory description,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 startTime,
            uint256 endTime,
            bool executed,
            bool canceled,
            bytes memory proposalData
        ) 
    {
        Proposal storage p = proposals[proposalId];
        return (
            p.description,
            p.forVotes,
            p.againstVotes,
            p.abstainVotes,
            p.startTime,
            p.endTime,
            p.executed,
            p.canceled,
            p.proposalData
        );
    }
    
    function getProposalStatus(uint256 proposalId) 
        external 
        view 
        override
        proposalExists(proposalId) 
        returns (
            bool isActive,
            bool hasQuorum,
            bool isPassing,
            uint256 votesNeeded
        ) 
    {
        Proposal storage p = proposals[proposalId];
        
        isActive = !p.executed && !p.canceled && block.timestamp <= p.endTime;
        
        uint256 totalVotes = p.forVotes + p.againstVotes + p.abstainVotes;
        uint256 totalMembers = _getTotalMembers();
        uint256 quorumRequired = (totalMembers * quorumPercentage) / 100;
        
        hasQuorum = totalVotes >= quorumRequired;
        isPassing = p.forVotes > p.againstVotes;
        votesNeeded = quorumRequired > totalVotes ? quorumRequired - totalVotes : 0;
        
        return (isActive, hasQuorum, isPassing, votesNeeded);
    }
    
    // ============ VOTING (HCS-ENABLED) ============
    
    /**
     * @notice Tally votes from HCS messages
     * @param proposalId Proposal being voted on
     * @param hcsVotes Array of votes from HCS topic
     */
    function tallyVotesFromHCS(
        uint256 proposalId,
        HcsVote[] memory hcsVotes
    ) external override proposalExists(proposalId) nonReentrant returns (
        uint256 totalForVotes,
        uint256 totalAgainstVotes,
        uint256 totalAbstainVotes
    ) {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Proposal canceled");
        
        for (uint256 i = 0; i < hcsVotes.length; i++) {
            HcsVote memory hcsVote = hcsVotes[i];
            
            // Skip if already voted
            if (hasVotedMap[proposalId][hcsVote.voter]) {
                continue;
            }
            
            // Verify signature
            if (!_verifyVoteSignature(proposalId, hcsVote)) {
                continue;
            }
            
            // Check membership
            if (!_isMember(hcsVote.voter)) {
                continue;
            }
            
            // Get voting power
            uint256 actualVotingPower = getVotingPower(hcsVote.voter);
            if (actualVotingPower == 0) {
                continue;
            }
            
            // Record vote
            hasVotedMap[proposalId][hcsVote.voter] = true;
            votes[proposalId][hcsVote.voter] = hcsVote;
            
            // Tally vote
            if (hcsVote.support == 1) {
                proposal.forVotes += actualVotingPower;
            } else if (hcsVote.support == 0) {
                proposal.againstVotes += actualVotingPower;
            } else if (hcsVote.support == 2) {
                proposal.abstainVotes += actualVotingPower;
            }
        }
        
        emit VotesTallied(
            proposalId,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            msg.sender
        );
        
        return (proposal.forVotes, proposal.againstVotes, proposal.abstainVotes);
    }
    
    function hasVoted(uint256 proposalId, address voter) external view override returns (bool) {
        return hasVotedMap[proposalId][voter];
    }
    
    function getVotingPower(address member) public view override returns (uint256) {
        if (!_isMember(member)) return 0;
        return 100;
    }
    
    /**
     * @notice Verify vote signature using ECDSA
     */
    function _verifyVoteSignature(
        uint256 proposalId,
        HcsVote memory hcsVote
    ) internal pure returns (bool) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            proposalId,
            hcsVote.voter,
            hcsVote.support,
            hcsVote.hcsMessageId,
            hcsVote.hcsSequenceNumber
        ));
        
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(hcsVote.signature);
        
        return recovered == hcsVote.voter;
    }
    
    // ============ PROPOSAL EXECUTION ============
    
    /**
     * @notice Execute a passed proposal
     */
    function executeProposal(uint256 proposalId) 
        external 
        override
        proposalExists(proposalId) 
        nonReentrant 
        returns (bool success) 
    {
        Proposal storage proposal = proposals[proposalId];
        
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Proposal canceled");
        require(block.timestamp > proposal.endTime, "Voting ongoing");
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalMembers = _getTotalMembers();
        uint256 quorumRequired = (totalMembers * quorumPercentage) / 100;
        
        require(totalVotes >= quorumRequired, "Quorum not reached");
        require(proposal.forVotes > proposal.againstVotes, "Proposal failed");
        
        proposal.executed = true;
        
        bytes memory returnData;
        (success, returnData) = _executeProposalAction(proposalId, proposal);
        
        emit ProposalExecuted(proposalId, success, returnData);
        
        return success;
    }
    
    /**
     * @notice Execute proposal action based on type
     */
    function _executeProposalAction(
        uint256 /* proposalId */,
        Proposal storage proposal
    ) internal returns (bool, bytes memory) {
        if (proposal.proposalType == ProposalType.UpdatePenaltyRate) {
            uint256 newRate = abi.decode(proposal.proposalData, (uint256));
            require(newRate <= 50, "Rate too high");
            penaltyRate = newRate;
            return (true, "");
        }
        
        if (proposal.proposalType == ProposalType.ChangeMonthlyPayment) {
            return ajoCore.call(proposal.proposalData);
        }
        
        if (proposal.proposalType == ProposalType.RemoveMember) {
            address member = abi.decode(proposal.proposalData, (address));
            return ajoCore.call(
                abi.encodeWithSignature("removeMember(address)", member)
            );
        }
        
        if (proposal.proposalType == ProposalType.EmergencyPause) {
            return ajoCore.call(
                abi.encodeWithSignature("emergencyPause()")
            );
        }
        
        if (proposal.proposalType == ProposalType.Custom) {
            return ajoCore.call(proposal.proposalData);
        }
        
        return (false, "Unknown proposal type");
    }
    
    // ============ HTS ADMIN FUNCTIONS (Using Inherited HederaTokenService) ============
    
    /**
     * @notice Freeze member's token (governance-controlled)
     * @dev Uses inherited freezeToken function from HederaTokenService
     */
    function freezeMemberToken(
        address token,
        address member
    ) external override onlyAjoCore returns (int64 responseCode) {
        // ✅ Direct call to inherited HederaTokenService function
        int response = freezeToken(token, member);
        
        // Convert int to int64
        responseCode = int64(response);
        bool success = _isHtsSuccess(response);
        
        emit TokenFrozen(token, member, responseCode);
        emit TokenFreezeAttempt(token, member, responseCode, success);
        
        // Log error if failed
        if (!success) {
            // Don't revert - allow governance to continue even if freeze fails
            // The event will show the failure
        }
        
        return responseCode;
    }
    
    /**
     * @notice Unfreeze member's token
     * @dev Uses inherited unfreezeToken function from HederaTokenService
     */
    function unfreezeMemberToken(
        address token,
        address member
    ) external override onlyAjoCore returns (int64 responseCode) {
        // ✅ Direct call to inherited HederaTokenService function
        int response = unfreezeToken(token, member);
        
        // Convert int to int64
        responseCode = int64(response);
        bool success = _isHtsSuccess(response);
        
        emit TokenUnfrozen(token, member, responseCode);
        emit TokenUnfreezeAttempt(token, member, responseCode, success);
        
        // Log error if failed
        if (!success) {
            // Don't revert - allow governance to continue
        }
        
        return responseCode;
    }
    
    // /**
    // * @notice Pause token (emergency)
    // * @dev Overrides inherited pauseToken function from HederaTokenService
    // */
    // function pauseToken(
    //     address token
    // ) internal override virtual returns (int responseCode) {
    //     // Call the parent implementation
    //     responseCode = super.pauseToken(token);
        
    //     bool success = _isHtsSuccess(responseCode);
        
    //     emit TokenPaused(token, int64(responseCode));
    //     emit TokenPauseAttempt(token, int64(responseCode), success);
        
    //     // For pause, we might want to revert on failure in emergency situations
    //     require(success, _getHtsErrorMessage(responseCode));
        
    //     return responseCode;
    // }

    // /**
    // * @notice Unpause token
    // * @dev Overrides inherited unpauseToken function from HederaTokenService
    // */
    // function unpauseToken(
    //     address token
    // ) internal override  virtual returns (int responseCode) {
    //     // Call the parent implementation
    //     responseCode = super.unpauseToken(token);
        
    //     bool success = _isHtsSuccess(responseCode);
        
    //     emit TokenUnpaused(token, int64(responseCode));
    //     emit TokenUnpauseAttempt(token, int64(responseCode), success);
        
    //     // Require success for unpause
    //     require(success, _getHtsErrorMessage(responseCode));
        
    //     return responseCode;
    // }
    
    // ============ GOVERNANCE PARAMETER UPDATES ============
    
    function updatePenaltyRate(uint256 newPenaltyRate) external override onlyAjoCore {
        require(newPenaltyRate <= 50, "Rate too high");
        penaltyRate = newPenaltyRate;
    }
    
    function updateVotingPeriod(uint256 newVotingPeriod) external override onlyAjoCore {
        require(newVotingPeriod >= 1 days && newVotingPeriod <= 30 days, "Invalid period");
        votingPeriod = newVotingPeriod;
    }
    
    function updateProposalThreshold(uint256 newThreshold) external override onlyAjoCore {
        proposalThreshold = newThreshold;
    }
    
    function updateReputationAndVotingPower(
        address member,
        bool positive
    ) external override onlyAjoCore {
        (bool success,) = membersContract.call(
            abi.encodeWithSignature(
                "updateReputation(address,uint256)",
                member,
                positive ? 10 : 0
            )
        );
        
        require(success, "Reputation update failed");
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getGovernanceSettings() 
        external 
        view 
        override
        returns (
            uint256 _proposalThreshold, 
            uint256 _votingPeriod, 
            uint256 _quorumPercentage, 
            uint256 currentPenaltyRate, 
            uint256 totalProposals
        )
    {
        return (
            proposalThreshold,
            votingPeriod,
            quorumPercentage,
            penaltyRate,
            proposalCount
        );
    }
    
    function getAllProposals(uint256 offset, uint256 limit) 
        external 
        view 
        override
        returns (uint256[] memory proposalIds, bool hasMore) 
    {
        uint256 remaining = proposalCount > offset ? proposalCount - offset : 0;
        uint256 size = remaining < limit ? remaining : limit;
        
        proposalIds = new uint256[](size);
        
        for (uint256 i = 0; i < size; i++) {
            proposalIds[i] = offset + i + 1;
        }
        
        hasMore = remaining > limit;
    }
    
    function getActiveProposals() external view override returns (uint256[] memory proposalIds) {
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i <= proposalCount; i++) {
            Proposal storage p = proposals[i];
            if (!p.executed && !p.canceled && block.timestamp <= p.endTime) {
                activeCount++;
            }
        }
        
        proposalIds = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= proposalCount; i++) {
            Proposal storage p = proposals[i];
            if (!p.executed && !p.canceled && block.timestamp <= p.endTime) {
                proposalIds[index] = i;
                index++;
            }
        }
        
        return proposalIds;
    }
    
    // ============ INTERNAL HELPERS ============
    
    function _isMember(address account) internal view returns (bool) {
        (bool success, bytes memory data) = membersContract.staticcall(
            abi.encodeWithSignature("isMember(address)", account)
        );
        
        if (!success || data.length == 0) return false;
        return abi.decode(data, (bool));
    }
    
    function _getTotalMembers() internal view returns (uint256) {
        (bool success, bytes memory data) = membersContract.staticcall(
            abi.encodeWithSignature("getTotalActiveMembers()")
        );
        
        if (!success || data.length == 0) return 0;
        return abi.decode(data, (uint256));
    }
}