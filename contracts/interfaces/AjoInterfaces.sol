// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// ============ ENUMS AND STRUCTS ============

enum PaymentToken { USDC, HBAR }

struct Member {
    uint256 queueNumber;
    uint256 joinedCycle;
    uint256 totalPaid;
    uint256 requiredCollateral;
    uint256 lockedCollateral;
    uint256 lastPaymentCycle;
    uint256 defaultCount;
    bool hasReceivedPayout;
    bool isActive;
    address guarantor;
    PaymentToken preferredToken;
    uint256 reputationScore;
    uint256[] pastPayments;
    uint256 guaranteePosition;
}

struct TokenConfig {
    uint256 monthlyPayment;
    bool isActive;
}

struct PayoutRecord {
    address recipient;
    uint256 amount;
    uint256 cycle;
    uint256 timestamp;
}

// ============ NEW FRONTEND STRUCTS ============

struct MemberDetails {
    address userAddress;
    bool hasReceivedPayout;
    uint256 queuePosition;
    bool hasPaidThisCycle;
    uint256 collateralLocked;
    address guarantorAddress;
    uint256 guarantorQueuePosition;
    uint256 totalPaid;
    uint256 defaultCount;
    uint256 reputationScore;
}

struct GlobalStats {
    uint256 totalAjos;
    uint256 activeAjos;
    uint256 totalMembers;
    uint256 totalCollateralUSDC;
    uint256 totalCollateralHBAR;
    uint256 totalPaymentsProcessed;
    uint256 totalPayoutsDistributed;
}

struct PaymentStatus {
    uint256 cycle;
    bool hasPaid;
    uint256 amountPaid;
    uint256 penaltyApplied;
    uint256 timestamp;
}

struct CycleDashboard {
    uint256 currentCycle;
    uint256 nextPayoutPosition;
    address nextRecipient;
    uint256 expectedPayout;
    uint256 totalPaidThisCycle;
    uint256 remainingToPay;
    address[] membersPaid;
    address[] membersUnpaid;
    bool isPayoutReady;
}

struct MemberActivity {
    uint256 cyclesParticipated;
    uint256 paymentsCompleted;
    uint256 paymentsMissed;
    uint256 totalPaid;
    uint256 totalReceived;
    uint256 netPosition; // received - paid
    uint256 consecutivePayments;
    uint256 lastActiveTimestamp;
}

struct AjoSummary {
    uint256 ajoId;
    string name;
    uint256 currentCycle;
    uint256 totalMembers;
    uint256 activeMembers;
    uint256 totalCollateral;
    uint256 monthlyPayment;
    bool isAcceptingMembers;
    address creator;
    uint256 createdAt;
}

struct UpcomingEvent {
    uint256 eventType; // 0=payment due, 1=payout, 2=cycle end
    uint256 timestamp;
    address affectedMember;
    uint256 amount;
}

// ============ MAIN AJO INTERFACE ============

interface IAjoCore {
    // Initialize Function
    function initialize(
        address _usdc,
        address _whbar,
        address _ajoMembers,
        address _ajoCollateral,
        address _ajoPayments,
        address _ajoGovernance
    ) external;
    
    // Core Ajo Functions
    function joinAjo(PaymentToken tokenChoice) external;
    function processPayment() external;
    function distributePayout() external;
    function handleDefault(address defaulter) external;
    function exitAjo() external;
    
    // View Functions - Member Information
    function getMemberInfo(address member) external view returns (
        Member memory memberInfo, 
        uint256 pendingPenalty,
        uint256 effectiveVotingPower
    );
    function getQueueInfo(address member) external view returns (
        uint256 position, 
        uint256 estimatedCyclesWait
    );
    function needsToPayThisCycle(address member) external view returns (bool);
    
    // View Functions - Contract Statistics
    function getContractStats() external view returns (
        uint256 totalMembers,
        uint256 activeMembers,
        uint256 totalCollateralUSDC,
        uint256 totalCollateralHBAR,
        uint256 contractBalanceUSDC,
        uint256 contractBalanceHBAR,
        uint256 currentQueuePosition,
        PaymentToken activeToken
    );
    
    // View Functions - Token Configuration
    function getTokenConfig(PaymentToken token) external view returns (TokenConfig memory);
    
    // View Functions - V2 Collateral Demo
    function getCollateralDemo(uint256 participants, uint256 monthlyPayment) external view returns (
        uint256[] memory positions, 
        uint256[] memory collaterals
    );
    
    // View Functions - Security Model
    function calculateSeizableAssets(address defaulterAddress) external view returns (
        uint256 totalSeizable, 
        uint256 collateralSeized, 
        uint256 paymentsSeized
    );
    
    // Admin Functions
    function emergencyWithdraw(PaymentToken token) external;
    function updateCycleDuration(uint256 newDuration) external;
    function emergencyPause() external;
    function batchHandleDefaults(address[] calldata defaulters) external;
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external;
}

// ============ GOVERNANCE INTERFACE ============
// ============ GOVERNANCE INTERFACE (HCS-ENABLED) ============
/**
 * @title IAjoGovernance
 * @notice Interface for Ajo.save governance system with HCS support
 */
interface IAjoGovernance {
    
    // ============ EVENTS ============
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description
    );
    
    event ProposalExecuted(uint256 indexed proposalId);
    
    event ReputationUpdated(
        address indexed member,
        uint256 newReputation
    );
    
    event VotingPowerUpdated(
        address indexed member,
        uint256 newPower
    );
    
    // ============ INITIALIZATION ============
    
    /**
     * @dev Initialize governance contract
     * @param _ajoCore Address of AjoCore contract
     * @param _governanceToken Address of governance token (may be unused in HCS model)
     */
    function initialize(
        address _ajoCore,
        address _governanceToken
    ) external;
    
    /**
     * @dev Verify setup is complete
     * @return isValid Whether setup is valid
     * @return reason Reason if invalid
     */
    function verifySetup() external view returns (bool isValid, string memory reason);
    
    // ============ PROPOSAL MANAGEMENT ============
    
    /**
     * @dev Create a new proposal
     * @param description Human-readable description
     * @param proposalData Encoded execution data
     * @return proposalId Unique identifier for the proposal
     */
    function createProposal(
        string memory description,
        bytes memory proposalData
    ) external returns (uint256 proposalId);
    
    /**
     * @dev Set HCS topic ID for a proposal
     * @param proposalId The proposal to update
     * @param hcsTopicId Hedera topic ID
     */
    function setHCSTopicId(uint256 proposalId, bytes32 hcsTopicId) external;
    
    /**
     * @dev Execute a successful proposal
     * @param proposalId Proposal to execute
     */
    function executeProposal(uint256 proposalId) external;
    
    // ============ VOTING ============
    
    /**
     * @dev Vote on a proposal
     * @param proposalId ID of proposal
     * @param support Vote type: 0=Against, 1=For, 2=Abstain
     */
    function vote(uint256 proposalId, uint8 support) external;
    
    /**
     * @dev Check if address has voted on proposal
     * @param proposalId Proposal ID
     * @param voter Address to check
     * @return hasVoted Whether the address has voted
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool);
    
    // ============ AGGREGATOR MANAGEMENT ============
    
    /**
     * @dev Register as vote aggregator with stake
     */
    function registerAggregator() external payable;
    
    /**
     * @dev Withdraw aggregator stake
     * @param amount Amount to withdraw
     */
    function withdrawAggregatorStake(uint256 amount) external;
    
    // ============ GOVERNANCE UPDATES ============
    
    /**
     * @dev Update penalty rate
     * @param newPenaltyRate New penalty rate in basis points
     */
    function updatePenaltyRate(uint256 newPenaltyRate) external;
    
    /**
     * @dev Update member reputation and voting power
     * @param member Address of member
     * @param positive Whether update is positive
     */
    function updateReputationAndVotingPower(
        address member,
        bool positive
    ) external;
    
    /**
     * @dev Update voting power for a member
     * @param member Address of member
     * @param newPower New voting power
     */
    function updateVotingPower(address member, uint256 newPower) external;
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get proposal details
     * @param proposalId Proposal ID
     * @return description Proposal description
     * @return forVotes Votes in favor
     * @return againstVotes Votes against
     * @return abstainVotes Abstain votes
     * @return proposalEndTime When voting ends
     * @return executed Whether executed
     * @return proposalData Encoded execution data
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            string memory description,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 proposalEndTime,
            bool executed,
            bytes memory proposalData
        );
    
    /**
     * @dev Get governance settings
     * @return proposalThreshold Minimum voting power to propose
     * @return votingPeriod Duration of voting period
     * @return currentPenaltyRate Current penalty rate
     * @return totalProposals Total number of proposals
     */
    function getGovernanceSettings()
        external
        view
        returns (
            uint256 proposalThreshold,
            uint256 votingPeriod,
            uint256 currentPenaltyRate,
            uint256 totalProposals
        );
}

// ============ COLLATERAL INTERFACE ============

interface IAjoCollateral {
    // Initialize Function
    function initialize(
        address _usdc,
        address _whbar,
        address _ajoCore,
        address _ajoMembers
    ) external;
    
    // Pure Calculation Functions
    function calculateRequiredCollateral(
        uint256 position,
        uint256 monthlyPayment,
        uint256 totalParticipants
    ) external view returns (uint256);
    
    function calculateGuarantorPosition(
        uint256 memberPosition,
        uint256 totalParticipants
    ) external pure returns (uint256);
    
    // View Functions
    function getTotalCollateral() external view returns (uint256 totalUSDC, uint256 totalHBAR);
    
    function calculateSeizableAssets(address defaulterAddress) external view returns (
        uint256 totalSeizable, 
        uint256 collateralSeized, 
        uint256 paymentsSeized
    );
        
    function lockCollateral(address member, uint256 amount, PaymentToken token) external;
    
    function unlockCollateral(address member, uint256 amount, PaymentToken token) external;
    
    function executeSeizure(address defaulter) external;
    
    function emergencyWithdraw(PaymentToken token, address to, uint256 amount) external;
    
    // Events
    event CollateralLiquidated(address indexed member, uint256 amount, PaymentToken token);
    event PaymentSeized(address indexed member, uint256 amount, string reason);
    event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
    event CollateralCalculated(address indexed member, uint256 requiredAmount, uint256 actualAmount);
}

// ============ PAYMENT INTERFACE ============

interface IAjoPayments {
    // Initialize Function
    function initialize(
        address _usdc,
        address _whbar,
        address _ajoCore,
        address _ajoMembers,
        address _ajoCollateral
    ) external;
    
    // Core Payment Functions
    function processPayment(address member, uint256 amount, PaymentToken token) external;
    function distributePayout() external;
    function handleDefault(address defaulter) external;
    function batchHandleDefaults(address[] calldata defaulters) external;
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external;
    function advanceCycle() external;
    function emergencyWithdraw(PaymentToken token) external;
    function updatePenaltyRate(uint256 newPenaltyRate) external;
    function updateNextPayoutPosition(uint256 position) external;
    
    // View Functions - Existing
    function needsToPayThisCycle(address member) external view returns (bool);
    function getTokenConfig(PaymentToken token) external view returns (TokenConfig memory);
    function getCurrentCycle() external view returns (uint256);
    function getNextPayoutPosition() external view returns (uint256);
    function getActivePaymentToken() external view returns (PaymentToken);
    function getPendingPenalty(address member) external view returns (uint256);
    function getPenaltyRate() external view returns (uint256);
    function getContractBalance(PaymentToken token) external view returns (uint256);
    function getTotalPayouts() external view returns (uint256);
    function isPayoutReady() external view returns (bool);
    function getPayout(uint256 cycle) external view returns (PayoutRecord memory);
    function calculatePayout() external view returns (uint256);
    function getNextRecipient() external view returns (address);
    
    // ============ NEW FRONTEND VIEW FUNCTIONS ============
    
    // Payment History & Tracking
    function getMemberPaymentHistory(address member) external view returns (PaymentStatus[] memory);
    
    function getCyclePaymentStatus(uint256 cycle) external view returns (
        address[] memory paidMembers,
        address[] memory unpaidMembers,
        uint256 totalCollected
    );
    
    // Active Cycle Dashboard
    function getCurrentCycleDashboard() external view returns (CycleDashboard memory);
    
    // Timeline & Deadlines
    function getUpcomingEvents(address member) external view returns (UpcomingEvent[] memory);
    function getNextPaymentDeadline() external view returns (uint256 timestamp);
    
    // Events
    event PaymentMade(address indexed member, uint256 amount, uint256 cycle, PaymentToken token);
    event PayoutDistributed(address indexed recipient, uint256 amount, uint256 cycle, PaymentToken token);
    event MemberDefaulted(address indexed member, uint256 cycle, uint256 penalty);
    event CycleAdvanced(uint256 newCycle, uint256 timestamp);
    event TokenSwitched(PaymentToken oldToken, PaymentToken newToken);
    event PaymentPulled(address indexed member, uint256 amount, uint256 cycle, PaymentToken token);
    event PaymentProcessed(address indexed member, uint256 baseAmount, uint256 penalty, uint256 total);
}

// ============ MEMBER MANAGEMENT INTERFACE ============

interface IAjoMembers {
    // Initialize Function
    function initialize(
        address _ajoCore,
        address _usdc,
        address _whbar
    ) external;
    
    // Contract Address Management
    function setContractAddresses(
        address _ajoCollateral,
        address _ajoPayments
    ) external;
    
    // Core Member Functions
    function updateReputation(address member, uint256 newReputation) external;
    
    // Member Management Functions
    function addMember(address member, Member memory memberData) external;
    function removeMember(address member) external;
    function updateMember(address member, Member memory memberData) external;
    
    // Additional Member Management Functions
    function updateCollateral(address member, uint256 newAmount) external;
    function addPastPayment(address member, uint256 payment) external;
    function updateLastPaymentCycle(address member, uint256 cycle) external;
    function incrementDefaultCount(address member) external;
    function updateTotalPaid(address member, uint256 amount) external;
    function markPayoutReceived(address member) external;
    
    // View Functions - Existing
    function getMember(address member) external view returns (Member memory);
    function getTotalActiveMembers() external view returns (uint256);
    
    function getMemberInfo(address member) external view returns (
        Member memory memberInfo, 
        uint256 pendingPenalty,
        uint256 effectiveVotingPower
    );
    
    function getQueueInfo(address member) external view returns (
        uint256 position, 
        uint256 estimatedCyclesWait
    );
    
    function getContractStats() external view returns (
        uint256 totalMembers,
        uint256 activeMembers,
        uint256 totalCollateralUSDC,
        uint256 totalCollateralHBAR,
        uint256 contractBalanceUSDC,
        uint256 contractBalanceHBAR,
        uint256 currentQueuePosition,
        PaymentToken activeToken
    );
    
    function queuePositions(uint256 position) external view returns (address);
    
    function activeMembersList(uint256 index) external view returns (address);
    
    // Additional View Functions - Existing
    function isMember(address member) external view returns (bool);
    function getActiveMembersList() external view returns (address[] memory);
    function getQueuePosition(uint256 queueNumber) external view returns (address);
    function getGuarantorForPosition(uint256 position) external view returns (address);
    function getLockedCollateral(address member) external view returns (uint256);
    function getMemberAtIndex(uint256 index) external view returns (address);
    
    // ============ NEW FRONTEND VIEW FUNCTIONS ============
    
    // Batch Member Details
    function getAllMembersDetails() external view returns (MemberDetails[] memory);
    function getMembersDetailsPaginated(uint256 offset, uint256 limit) external view returns (
        MemberDetails[] memory,
        bool hasMore
    );
    
    // Member Activity Summary
    function getMemberActivity(address member) external view returns (MemberActivity memory);
    
    // Search & Filter Functions
    function getMembersByStatus(bool isActive) external view returns (address[] memory);
    function getMembersNeedingPayment() external view returns (address[] memory);
    function getMembersWithDefaults() external view returns (address[] memory);
    function getTopMembersByReputation(uint256 limit) external view returns (
        address[] memory members,
        uint256[] memory reputations
    );
    
    // Events
    event MemberJoined(address indexed member, uint256 queueNumber, uint256 collateral, PaymentToken token);
    event MemberRemoved(address indexed member);
    event MemberUpdated(address indexed member);
    event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
}

// ============ FACTORY INTERFACE ============

interface IAjoFactory {
    struct AjoInfo {
        address ajoCore;
        address ajoMembers;
        address ajoCollateral;
        address ajoPayments;
        address ajoGovernance;
        address creator;
        uint256 createdAt;
        string name;
        bool isActive;
    }

    // Core Factory Functions
    function createAjo(string memory _name) external returns (uint256 ajoId);
    
    // View Functions - Existing
    function getAjo(uint256 ajoId) external view returns (AjoInfo memory info);
    function getAllAjos(uint256 offset, uint256 limit) external view returns (AjoInfo[] memory ajoInfos, bool hasMore);
    function getAjosByCreator(address creator) external view returns (uint256[] memory ajoIds);
    function getAjoCore(uint256 ajoId) external view returns (address ajoCore);
    function ajoStatus(uint256 ajoId) external view returns (bool exists, bool isActive);
    function getFactoryStats() external view returns (uint256 totalCreated, uint256 activeCount);
    function getImplementations() external view returns (
        address ajoCore,
        address ajoMembers,
        address ajoCollateral,
        address ajoPayments,
        address ajoGovernance
    );
    
    // ============ NEW FRONTEND VIEW FUNCTIONS ============
    
    // Global Statistics
    function getGlobalStatistics() external view returns (GlobalStats memory);
    
    // Ajo Summaries for Listing Pages
    function getAjoSummaries(uint256[] calldata ajoIds) external view returns (AjoSummary[] memory);
    function getActiveAjoSummaries(uint256 offset, uint256 limit) external view returns (AjoSummary[] memory);
    
    // Admin Functions
    function deactivateAjo(uint256 ajoId) external;
    
    // Events
    event AjoCreated(uint256 indexed ajoId, address indexed creator, address ajoCore, string name);
    event MasterImplementationsSet(address ajoCore, address ajoMembers, address ajoCollateral, address ajoPayments, address ajoGovernance);
}

// ============ ERC20 VOTES INTERFACE (Inherited) ============

interface IERC20Votes {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    // Voting specific functions
    function delegates(address account) external view returns (address);
    function delegate(address delegatee) external;
    function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external;
    function getCurrentVotes(address account) external view returns (uint256);
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256);
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
}

// ============ OWNABLE INTERFACE (Inherited) ============

interface IOwnable {
    function owner() external view returns (address);
    function renounceOwnership() external;
    function transferOwnership(address newOwner) external;
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
}

// ============ REENTRANCY GUARD INTERFACE (Inherited) ============

interface IReentrancyGuard {
    // No external functions, just internal protection
}

// ============ INITIALIZABLE INTERFACE (Inherited) ============

interface IInitializable {
    // Events
    event Initialized(uint8 version);
    
    // Note: initialize functions are contract-specific and defined in each interface above
}