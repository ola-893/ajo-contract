// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// ============================================================================
// AJO.SAVE UNIFIED INTERFACE (HTS + HSS INTEGRATION)
// Separated Hedera Schedule Service into dedicated contract
// ============================================================================

// ============ ENUMS ============

enum PaymentToken { USDC, HBAR }

// ============ HTS HELPER STRUCTS (Used by HTSHelper library) ============

struct HtsTransferResult {
    int64 responseCode;
    bool success;
    string errorMessage;
}

struct HtsAssociationResult {
    int64 responseCode;
    bool success;
    bool alreadyAssociated;
    string errorMessage;
}

struct HtsFreezeResult {
    int64 responseCode;
    bool success;
    bool alreadyFrozen;
    string errorMessage;
}

// ============ CORE STRUCTS ============

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
    uint256 totalHtsTokensCreated;
    uint256 totalScheduledPayments;
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
    bool hasScheduledPayment;
    address scheduledPaymentAddress;
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
    bool usesHtsTokens;
    bool usesScheduledPayments;
}

struct UpcomingEvent {
    uint256 eventType;
    uint256 timestamp;
    address affectedMember;
    uint256 amount;
}

// ============ HTS-SPECIFIC STRUCTS ============

struct HtsTokenInfo {
    address tokenAddress;
    bytes32 tokenId;
    string name;
    string symbol;
    uint8 decimals;
    uint256 totalSupply;
    bool hasFreezeKey;
    bool hasWipeKey;
    bool hasSupplyKey;
    bool hasPauseKey;
    address treasury;
}

struct HtsAdminKeys {
    address adminKey;
    address freezeKey;
    address supplyKey;
    address pauseKey;
}

struct HcsVote {
    address voter;
    uint8 support;
    uint256 votingPower;
    uint256 timestamp;
    bytes32 hcsMessageId;
    uint256 hcsSequenceNumber;
    bytes signature;
}

// ============ HSS-SPECIFIC STRUCTS ============

struct ScheduledPayment {
    address scheduleAddress;
    uint256 cycle;
    uint256 executionTime;
    uint256 amount;
    address recipient;
    PaymentToken token;
    bool isExecuted;
    bool isCanceled;
    bool isExpired;
    uint256 signaturesCollected;
    uint256 signaturesRequired;
    uint256 createdAt;
    address creator;
}

struct ScheduleSignature {
    address signer;
    uint256 timestamp;
    bool isContractKey;
}

struct ScheduleInfo {
    address scheduleId;
    address scheduledTransactionId;
    address payerAccountId;
    address creatorAccountId;
    bytes32 scheduledTransactionBody;
    KeyList signatories;
    address adminKey;
    string memo;
    int64 expirationTime;
    int64 executedTime;
    int64 deletedTime;
    bool waitForExpiry;
}

struct KeyList {
    address[] keys;
}

struct ScheduledGovernanceAction {
    uint256 proposalId;
    address scheduleAddress;
    uint256 executionTime;
    bool isExecuted;
    bool isCanceled;
}

struct ScheduleStatistics {
    uint256 totalScheduled;
    uint256 totalExecuted;
    uint256 totalCanceled;
    uint256 totalExpired;
    uint256 pendingSchedules;
    uint256 upcomingIn24Hours;
    uint256 upcomingInWeek;
}

// ============ HTS HELPER STRUCTS ============

struct HederaToken {
    string name;
    string symbol;
    address treasury;
    string memo;
    bool tokenSupplyType;
    int64 maxSupply;
    bool freezeDefault;
    TokenKey[] tokenKeys;
    Expiry expiry;
}

struct TokenKey {
    uint256 keyType;
    KeyValue key;
}

struct KeyValue {
    bool inheritAccountKey;
    address contractId;
    bytes ed25519;
    bytes ECDSA_secp256k1;
    address delegatableContractId;
}

struct Expiry {
    int64 second;
    address autoRenewAccount;
    int64 autoRenewPeriod;
}

struct FixedFee {
    int64 amount;
    address tokenId;
    bool useHbarsForPayment;
    bool useCurrentTokenForPayment;
    address feeCollector;
}

struct FractionalFee {
    int64 numerator;
    int64 denominator;
    int64 minimumAmount;
    int64 maximumAmount;
    bool netOfTransfers;
    address feeCollector;
}

struct TokenInfo {
    HederaToken token;
    int64 totalSupply;
    bool deleted;
    bool defaultKycStatus;
    bool pauseStatus;
    FixedFee[] fixedFees;
    FractionalFee[] fractionalFees;
    string ledgerId;
}

struct TopicInfo {
    string memo;
    bytes32 runningHash;
    uint64 sequenceNumber;
    Expiry autoRenewAccount;
    address adminKey;
    address submitKey;
}

struct TransferList {
    AccountAmount[] transfers;
}

struct AccountAmount {
    address accountID;
    int64 amount;
}

struct TokenTransferList {
    address token;
    AccountAmount[] transfers;
    NftTransfer[] nftTransfers;
}

struct NftTransfer {
    address senderAccountID;
    address receiverAccountID;
    int64 serialNumber;
}

// ============ HEDERA TOKEN SERVICE INTERFACE (0x167) ============

// interface IHederaTokenService {
//     function createFungibleToken(
//         HederaToken memory token,
//         int64 initialTotalSupply,
//         int32 decimals
//     ) external payable returns (int64 responseCode, address tokenAddress);
    
//     function createFungibleTokenWithCustomFees(
//         HederaToken memory token,
//         int64 initialTotalSupply,
//         int32 decimals,
//         FixedFee[] memory fixedFees,
//         FractionalFee[] memory fractionalFees
//     ) external payable returns (int64 responseCode, address tokenAddress);
    
//     function associateToken(address account, address token) external returns (int64 responseCode);
//     function associateTokens(address account, address[] memory tokens) external returns (int64 responseCode);
//     function dissociateToken(address account, address token) external returns (int64 responseCode);
    
//     function transferToken(address token, address sender, address recipient, int64 amount) external returns (int64 responseCode);
//     function transferTokens(address token, address[] memory accountId, int64[] memory amount) external returns (int64 responseCode);
//     function cryptoTransfer(TransferList memory transferList, TokenTransferList[] memory tokenTransfers) external returns (int64 responseCode);
    
//     function freezeToken(address token, address account) external returns (int64 responseCode);
//     function unfreezeToken(address token, address account) external returns (int64 responseCode);
//     function wipeTokenAccount(address token, address account, int64 amount) external returns (int64 responseCode);
//     function pauseToken(address token) external returns (int64 responseCode);
//     function unpauseToken(address token) external returns (int64 responseCode);
    
//     function getTokenInfo(address token) external returns (int64 responseCode, TokenInfo memory tokenInfo);
//     function isAssociated(address account, address token) external view returns (bool);
//     function isFrozen(address token, address account) external view returns (bool);
//     function getTokenDefaultFreezeStatus(address token) external returns (int64, bool);
//     function getTokenDefaultKycStatus(address token) external returns (int64, bool);
// }

// ============ HEDERA CONSENSUS SERVICE INTERFACE ============

interface IHederaConsensusService {
    function createTopic(
        HederaToken memory token,
        address adminKey,
        address submitKey,
        uint256 autoRenewPeriod,
        address autoRenewAccount,
        string memory memo
    ) external payable returns (int64 responseCode, bytes32 topicId);
    
    function submitMessage(bytes32 topicId, bytes memory message) external payable returns (int64 responseCode, uint64 sequenceNumber);
    function updateTopic(bytes32 topicId, string memory memo, uint256 autoRenewPeriod) external returns (int64 responseCode);
    function deleteTopic(bytes32 topicId) external returns (int64 responseCode);
    function getTopicInfo(bytes32 topicId) external returns (int64 responseCode, TopicInfo memory info);
}

// ============ HEDERA SCHEDULE SERVICE INTERFACE (0x16b) ============

// interface IHederaScheduleService {
//     // Sign a schedule transaction using the public key of the caller (EOA only)
//     function signSchedule(address scheduleAddress) external returns (int64 responseCode);
    
//     // Authorize a schedule transaction with a contract key (contracts only)
//     function authorizeSchedule(address scheduleAddress) external returns (int64 responseCode);
    
//     // Get information about a scheduled transaction
//     function getScheduleInfo(address scheduleAddress) external returns (int64 responseCode, ScheduleInfo memory info);
// }

// ============ AJO SCHEDULE INTERFACE (NEW - DEDICATED HSS CONTRACT) ============

interface IAjoSchedule {
    function initialize(
        address _ajoCore,
        address _ajoPayments,
        address _ajoGovernance,
        address _hederaScheduleService
    ) external;
    
    // Payment Scheduling Functions
    function schedulePayment(
        uint256 cycle,
        uint256 executionTime,
        address member,
        uint256 amount,
        PaymentToken token
    ) external returns (address scheduleAddress);
    
    function scheduleMultiplePayments(
        uint256[] calldata cycles,
        uint256[] calldata executionTimes,
        address[] calldata members,
        uint256[] calldata amounts,
        PaymentToken token
    ) external returns (address[] memory scheduleAddresses);
    
    function scheduleRollingPayments(
        uint256 startCycle,
        uint256 numberOfCycles,
        uint256 intervalDays,
        address member,
        uint256 amount,
        PaymentToken token
    ) external returns (address[] memory scheduleAddresses);
    
    function schedulePayout(
        uint256 cycle,
        uint256 executionTime,
        address recipient,
        uint256 amount,
        PaymentToken token
    ) external returns (address scheduleAddress);
    
    // Governance Scheduling Functions
    function scheduleProposalExecution(
        uint256 proposalId,
        uint256 executionTime
    ) external returns (address scheduleAddress);
    
    function scheduleGovernanceAction(
        uint256 proposalId,
        uint256 executionTime,
        bytes memory actionData
    ) external returns (address scheduleAddress);
    
    // Authorization & Execution Functions
    function authorizeSchedule(address scheduleAddress) external returns (int64 responseCode);
    function executeSchedule(address scheduleAddress) external returns (bool success, bytes memory returnData);
    function cancelSchedule(address scheduleAddress) external;
    function deleteSchedule(address scheduleAddress) external;
    
    // Batch Operations
    function batchAuthorizeSchedules(address[] calldata scheduleAddresses) external returns (int64[] memory responseCodes);
    function batchCancelSchedules(address[] calldata scheduleAddresses) external;
    
    // Query Functions - Payment Schedules
    function getScheduledPayment(address scheduleAddress) external view returns (ScheduledPayment memory);
    function getAllScheduledPayments() external view returns (ScheduledPayment[] memory);
    function getActiveScheduledPayments() external view returns (ScheduledPayment[] memory);
    function getScheduledPaymentsForCycle(uint256 cycle) external view returns (ScheduledPayment[] memory);
    function getScheduledPaymentsForMember(address member) external view returns (ScheduledPayment[] memory);
    function getUpcomingSchedules(uint256 timeframe) external view returns (ScheduledPayment[] memory);
    function getPendingSchedules() external view returns (ScheduledPayment[] memory);
    function getExecutedSchedules(uint256 offset, uint256 limit) external view returns (ScheduledPayment[] memory);
    
    // Query Functions - Governance Schedules
    function getScheduledProposal(address scheduleAddress) external view returns (ScheduledGovernanceAction memory);
    function getAllScheduledProposals() external view returns (ScheduledGovernanceAction[] memory);
    function getScheduledProposalsForProposalId(uint256 proposalId) external view returns (ScheduledGovernanceAction[] memory);
    
    // Query Functions - Schedule Details
    function getScheduleInfo(address scheduleAddress) external view returns (ScheduleInfo memory);
    function isScheduleReady(address scheduleAddress) external view returns (bool);
    function isScheduleExpired(address scheduleAddress) external view returns (bool);
    function hasScheduleForCycle(uint256 cycle) external view returns (bool);
    function getScheduleSignatures(address scheduleAddress) external view returns (ScheduleSignature[] memory);
    function getScheduleProgress(address scheduleAddress) external view returns (uint256 collected, uint256 required, bool isReady);
    
    // Statistics & Analytics
    function getScheduleStatistics() external view returns (ScheduleStatistics memory);
    function getTotalScheduledAmount(PaymentToken token) external view returns (uint256);
    function getSchedulesByDateRange(uint256 startTime, uint256 endTime) external view returns (ScheduledPayment[] memory);
    function getMemberScheduleHistory(address member) external view returns (ScheduledPayment[] memory);
    
    // Configuration Functions
    function updateScheduleServiceAddress(address newAddress) external;
    function setMaxSchedulesPerCycle(uint256 maxSchedules) external;
    function setMinExecutionDelay(uint256 minDelay) external;
    function setMaxExecutionDelay(uint256 maxDelay) external;
    function pauseScheduling() external;
    function unpauseScheduling() external;
    
    // Health & Status Functions
    function isSchedulingEnabled() external view returns (bool);
    function getScheduleServiceStatus() external view returns (bool isEnabled, address serviceAddress, uint256 totalScheduled, uint256 totalExecuted);
    function validateScheduleAddress(address scheduleAddress) external view returns (bool isValid, string memory reason);
    
    // Events
    event PaymentScheduled(address indexed scheduleAddress, uint256 cycle, uint256 executionTime, address member, uint256 amount, PaymentToken token);
    event PayoutScheduled(address indexed scheduleAddress, uint256 cycle, uint256 executionTime, address recipient, uint256 amount, PaymentToken token);
    event ProposalScheduled(uint256 indexed proposalId, address indexed scheduleAddress, uint256 executionTime);
    event GovernanceActionScheduled(uint256 indexed proposalId, address indexed scheduleAddress, uint256 executionTime);
    event ScheduleAuthorized(address indexed scheduleAddress, address indexed authorizer, uint256 signaturesCollected, uint256 signaturesRequired);
    event ScheduleExecuted(address indexed scheduleAddress, bool success, bytes returnData);
    event ScheduleCanceled(address indexed scheduleAddress, address indexed canceler, string reason);
    event ScheduleExpired(address indexed scheduleAddress, uint256 expirationTime);
    event ScheduleDeleted(address indexed scheduleAddress, address indexed deleter);
    event SchedulingPaused(address indexed admin);
    event SchedulingUnpaused(address indexed admin);
    event ScheduleServiceUpdated(address indexed oldAddress, address indexed newAddress);
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
    // function handleDefault(address defaulter) external;
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
    function getCycleDuration() external view returns (uint256);
    function needsToPayThisCycle(address member) external view returns (bool);
    function paymentsContractAddress() external view returns (IAjoPayments);
    
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
    function setAutomationAuthorization(address automationAddress, bool authorized) 
    external ;
    function setAutomationEnabled(bool enabled) external;
    function shouldAutomationRun() external view returns (
    bool shouldRun,
    string memory reason,
    uint256 defaultersCount
) ;
    
    // Admin Functions
    function emergencyWithdraw(PaymentToken token) external;
    function updateCycleDuration(uint256 newDuration) external;
    function emergencyPause() external;
    // function batchHandleDefaults(address[] calldata defaulters) external;
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external;
}


// ============================================================================
// AJO.SAVE GOVERNANCE INTERFACE (SEASON TERMINOLOGY)
// ============================================================================

/**
 * TERMINOLOGY CLARIFICATION:
 * - Season: The full period where all members receive payout once (e.g., 10 cycles)
 * - Cycle: Individual monthly payment slot within a season
 * 
 * Example: If there are 10 members, a season consists of 10 cycles.
 * After all 10 cycles complete, the season is done and a new season can start.
 */

interface IAjoGovernance {
    // Initialization
    function initialize(
        address _ajoCore, 
        address _ajoMembers,  
        address _ajoSchedule, 
        address _hederaTokenService, 
        bytes32 _hcsTopicId
    ) external;
    function verifySetup() external view returns (bool isValid, string memory reason);
    function getHcsTopicId() external view returns (bytes32);
    
    // ============ CORE PROPOSAL FUNCTIONS ============
    function createProposal(string memory description, bytes memory proposalData) external returns (uint256 proposalId);
    function cancelProposal(uint256 proposalId) external;
    function getProposal(uint256 proposalId) external view returns (
        string memory description, 
        uint256 forVotes, 
        uint256 againstVotes, 
        uint256 abstainVotes, 
        uint256 startTime, 
        uint256 endTime, 
        bool executed, 
        bool canceled, 
        bytes memory proposalData
    );
    function getProposalStatus(uint256 proposalId) external view returns (
        bool isActive, 
        bool hasQuorum, 
        bool isPassing, 
        uint256 votesNeeded
    );
    
    // ============ SEASON MANAGEMENT PROPOSALS ============
    function proposeSeasonCompletion(string memory description) external returns (uint256 proposalId);
    function proposeNewSeasonRestart(
        string memory description,
        uint256 newDuration,
        uint256 newMonthlyContribution,
        address[] memory newMembers
    ) external returns (uint256 proposalId);
    function proposeNewMember(
        address newMember,
        string memory description
    ) external returns (uint256 proposalId);
    function proposeUpdateSeasonParameters(
        string memory description,
        uint256 newDuration,
        uint256 newMonthlyPayment
    ) external returns (uint256 proposalId);
    function proposeCarryOverRules(
        string memory description,
        bool _carryReputation,
        bool _carryPenalties
    ) external returns (uint256 proposalId);
    
    // ============ MEMBER PARTICIPATION ============
    function declareNextSeasonParticipation(bool participate) external;
    function getMemberParticipationStatus(address member) external view returns (bool willParticipate);
    
    // ============ VOTING FUNCTIONS ============
    function tallyVotesFromHCS(uint256 proposalId, HcsVote[] memory votes) external returns (
        uint256 totalForVotes, 
        uint256 totalAgainstVotes, 
        uint256 totalAbstainVotes
    );
    function hasVoted(uint256 proposalId, address voter) external view returns (bool);
    function getVotingPower(address member) external view returns (uint256);
    function executeProposal(uint256 proposalId) external returns (bool success);
    
    // ============ TOKEN CONTROL FUNCTIONS ============
    function freezeMemberToken(address token, address member) external returns (int64 responseCode);
    function unfreezeMemberToken(address token, address member) external returns (int64 responseCode);
    
    // ============ SETTINGS FUNCTIONS ============
    function updatePenaltyRate(uint256 newPenaltyRate) external;
    function updateVotingPeriod(uint256 newVotingPeriod) external;
    function updateProposalThreshold(uint256 newThreshold) external;
    function updateReputationAndVotingPower(address member, bool positive) external;
    
    // ============ QUERY FUNCTIONS - GOVERNANCE ============
    function getGovernanceSettings() external view returns (
        uint256 proposalThreshold, 
        uint256 votingPeriod, 
        uint256 quorumPercentage, 
        uint256 currentPenaltyRate, 
        uint256 totalProposals
    );
    function getAllProposals(uint256 offset, uint256 limit) external view returns (
        uint256[] memory proposalIds, 
        bool hasMore
    );
    function getActiveProposals() external view returns (uint256[] memory proposalIds);
    
    // ============ QUERY FUNCTIONS - SEASON MANAGEMENT ============
    function getSeasonStatus() external view returns (
        uint256 _currentSeason,
        bool _isSeasonCompleted,
        uint256 _participationDeadline,
        uint256 _declaredParticipants
    );
    function getCarryOverRules() external view returns (
        bool _carryReputation, 
        bool _carryPenalties
    );
    function getContinuingMembersCount() external view returns (uint256);
    function getContinuingMembersList() external view returns (address[] memory);
    function getOptOutMembersList() external view returns (address[] memory);
    
    // ============ EVENTS - CORE GOVERNANCE ============
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description, uint256 startTime, uint256 endTime);
    event VoteSubmittedToHCS(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 votingPower, bytes32 hcsMessageId, uint64 sequenceNumber);
    event VotesTallied(uint256 indexed proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, address indexed tallier);
    event ProposalExecuted(uint256 indexed proposalId, bool success, bytes returnData);
    event ProposalCanceled(uint256 indexed proposalId, address indexed canceler);
    
    // ============ EVENTS - TOKEN CONTROL ============
    event TokenFrozen(address indexed token, address indexed account, int64 responseCode);
    event TokenUnfrozen(address indexed token, address indexed account, int64 responseCode);
    event TokenPaused(address indexed token, int64 responseCode);
    event TokenUnpaused(address indexed token, int64 responseCode);
    
    // ============ EVENTS - SEASON MANAGEMENT ============
    event ParticipationDeclared(address indexed member, bool willParticipate, uint256 indexed nextSeason);
    event SeasonCompleted(uint256 indexed season, uint256 timestamp);
    event NewSeasonStarted(uint256 indexed season, uint256 duration, uint256 monthlyContribution, address[] members);
    event ParticipationDeadlineSet(uint256 deadline, uint256 season);
    event CarryOverRulesUpdated(bool carryReputation, bool carryPenalties);
    event NewMemberProposed(address indexed newMember, uint256 indexed proposalId, address indexed proposer);
    event SeasonParametersUpdated(uint256 newDuration, uint256 newMonthlyPayment);
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
    event CollateralSeized(
       address indexed defaulter, 
       address indexed guarantor, 
       uint256 totalAmount, 
       PaymentToken token
   );
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
    function hasMemberPaidInCycle(address member) external view returns (bool);
    function batchCheckPaymentStatus(address[] calldata members) 
        external 
        view 
        returns (bool[] memory statuses);
        
    
    function getAllMembersPaymentStatus() 
        external 
        view 
        returns (address[] memory members, bool[] memory statuses);
    
    // ============ NEW FRONTEND VIEW FUNCTIONS ============
    
    // Payment History & Tracking
    function getMemberPaymentHistory(address member) external view returns (PaymentStatus[] memory);
    function getMembersInDefault() external view returns (address[] memory defaulters);
    function getCyclePaymentStatus(uint256 cycle) external view returns (
        address[] memory paidMembers,
        address[] memory unpaidMembers,
        uint256 totalCollected
    );
    function isDeadlinePassed() external view returns (bool isPastDeadline, uint256 secondsOverdue);
    
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

// ============ AJO FACTORY INTERFACE (UPDATED WITH SCHEDULE CONTRACT) ============
// ============ AJO FACTORY INTERFACE (UPDATED WITH SCHEDULE CONTRACT + HTS USER MANAGEMENT) ============

interface IAjoFactory {
    struct AjoInfo {
        address ajoCore;
        address ajoMembers;
        address ajoCollateral;
        address ajoPayments;
        address ajoGovernance;
        address ajoSchedule;
        address creator;
        uint256 createdAt;
        string name;
        bool isActive;
        bool usesHtsTokens;
        address usdcToken;
        address hbarToken;
        bytes32 hcsTopicId;
        bool usesScheduledPayments;
        uint256 scheduledPaymentsCount;
        uint256   ajoCycleDuration;
        uint256    ajoMonthlyPaymentUSDC;
        uint256   ajoMonthlyPaymentHBAR;
    }

    // HTS Token Functions
    function setHtsTokensForFactory(address _usdcHts, address _hbarHts) external;
    function getHtsTokenAddresses() external view returns (address usdc, address hbar);
    function isHtsEnabled() external view returns (bool);
    //function getHtsTokenInfo(address token) external view returns (HtsTokenInfo memory);
    
    // HTS User Management Functions
    function checkUserHtsAssociation(address user) external view returns (bool usdcAssociated, bool hbarAssociated, uint256 lastAssociationTime);
    //function getUserHtsBalance(address user) external view returns (uint256 usdcBalance, uint256 hbarBalance);
    //function isUserReadyForHts(address user, uint256 minUsdcBalance, uint256 minHbarBalance) external view returns (bool isReady, bool usdcReady, bool hbarReady);
    
    // Ajo Creation Functions
    function createAjo(
        string memory _name,
        bool _useHtsTokens,
        bool _useScheduledPayments,
        uint256 _cycleDuration,
        uint256 _monthlyPaymentUSDC,
        uint256 _monthlyPaymentHBAR
    ) external returns (uint256 ajoId);    function initializeAjoPhase2(uint256 ajoId, bytes32 hcsTopicId) external returns (bytes32);    
    function initializeAjoPhase3(uint256 ajoId) external;
    function initializeAjoPhase4(uint256 ajoId) external;
    function initializeAjoPhase5(uint256 ajoId) external; // New phase for Schedule contract
    
    // HSS Integration - Factory Level Scheduling
    function enableScheduledPaymentsForAjo(uint256 ajoId) external;
    function disableScheduledPaymentsForAjo(uint256 ajoId) external;
    //function getScheduleServiceAddress() external view returns (address);
    function getAjoSchedulingStatus(uint256 ajoId) external view returns (bool isEnabled, uint256 scheduledPaymentsCount, uint256 executedCount);
    function setScheduleServiceAddress(address _scheduleService) external;
    function getAjoScheduleContract(uint256 ajoId) external view returns (address);
    function useOfficialTokens() external;
    function getAjoConfiguration(uint256 ajoId) 
        external 
        view 
        returns (
            uint256 cycleDuration,
            uint256 monthlyPaymentUSDC,
            uint256 monthlyPaymentHBAR
        );
    
    // Ajo Management Functions
    function deactivateAjo(uint256 ajoId) external;
    function getAjo(uint256 ajoId) external view returns (AjoInfo memory info);
    function getAllAjos(uint256 offset, uint256 limit) external view returns (AjoInfo[] memory ajoInfos, bool hasMore);
    // HTS Approval Functions
    function approveHtsToken(
        address token,
        address spender,
        uint256 amount
    ) external returns (bool success);

    function getHtsAllowance(
        address token,
        address owner,
        address spender
    ) external returns (uint256 currentAllowance);

    // Add these events after the existing events
    event HtsTokenApproved(address indexed owner, address indexed token, address indexed spender, uint256 amount);
    event HtsApprovalFailed(address indexed owner, address indexed token, address indexed spender, uint256 amount, int64 responseCode, string reason);
    function getAjosByCreator(address creator) external view returns (uint256[] memory ajoIds);
    // function getAjoCore(uint256 ajoId) external view returns (address ajoCore);
    // function getAjo(uint256 ajoId) external view returns (AjoInfo memory info);
    function ajoStatus(uint256 ajoId) external view returns (bool exists, bool isActive);
    // function getFactoryStats() external view returns (uint256 totalCreated, uint256 activeCount);
    // function getImplementations() external view returns (address ajoCore, address ajoMembers, address ajoCollateral, address ajoPayments, address ajoGovernance, address ajoSchedule);
    
    //Statistics & Reporting Functions
    // function getActiveAjoSummaries(uint256 offset, uint256 limit) external view returns (AjoSummary[] memory);
    // function getAjosUsingScheduledPayments() external view returns (uint256[] memory ajoIds);
    
    // Health & Status Functions
    //function getAjoHealthReport(uint256 ajoId) external view returns (uint256 initializationPhase, bool isReady, bool coreResponsive, bool membersResponsive, bool collateralResponsive, bool paymentsResponsive, bool governanceResponsive, bool scheduleResponsive);
    //function getAjoOperationalStatus(uint256 ajoId) external view returns (uint256 totalMembers, uint256 currentCycle, bool canAcceptMembers, bool hasActiveGovernance, bool hasActiveScheduling);
    
    // Events
    event AjoCreated(uint256 indexed ajoId, address indexed creator, address ajoCore, string name, bool usesHtsTokens, bool usesScheduledPayments);
    event AjoInitializedPhase2(uint256 indexed ajoId, bytes32 hcsTopicId);
    event AjoInitializedPhase3(uint256 indexed ajoId);
    event AjoInitializedPhase4(uint256 indexed ajoId);
    event AjoInitializedPhase5(uint256 indexed ajoId, address ajoSchedule);
    event ScheduledPaymentsEnabled(uint256 indexed ajoId);
    event ScheduledPaymentsDisabled(uint256 indexed ajoId);
    event MasterImplementationsSet(address ajoCore, address ajoMembers, address ajoCollateral, address ajoPayments, address ajoGovernance, address ajoSchedule);
    event ScheduleServiceSet(address indexed scheduleService);
    event UserHtsAssociated(address indexed user, address indexed usdcToken, address indexed hbarToken, int64 usdcResponse, int64 hbarResponse);
    event UserHtsTokenAssociated(address indexed user, address indexed token, bool success);
    event UserHtsFunded(address indexed user, uint256 usdcAmount, uint256 hbarAmount, int64 usdcResponse, int64 hbarResponse);
    event UserHtsTokenFunded(address indexed user, address indexed token, int64 amount, bool success);
    event BatchAssociationCompleted(uint256 successCount, uint256 failCount);
    event BatchFundingCompleted(uint256 successCount, uint256 failCount);
    event FactoryBalanceCheck(uint256 usdcBalance, uint256 hbarBalance);
    event HtsTransferFailed(address indexed user, address indexed token, uint256 amount, int64 responseCode, string reason);
    event HtsAssociationFailed(address indexed user, address indexed token, int64 responseCode, string reason);

}

// ============ HTS RESPONSE CODES ============

library HtsResponseCodes {
    int64 public constant SUCCESS = 22;
    int64 public constant INVALID_SIGNATURE = 7;
    int64 public constant INVALID_ACCOUNT_ID = 15;
    int64 public constant ACCOUNT_DELETED = 35;
    int64 public constant INVALID_TOKEN_ID = 111;
    int64 public constant TOKEN_WAS_DELETED = 138;
    int64 public constant TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT = 147;
    int64 public constant TOKEN_NOT_ASSOCIATED_TO_ACCOUNT = 167;
    int64 public constant TOKENS_PER_ACCOUNT_LIMIT_EXCEEDED = 184;
    int64 public constant ACCOUNT_FROZEN_FOR_TOKEN = 162;
    int64 public constant INSUFFICIENT_TOKEN_BALANCE = 164;
    int64 public constant TOKEN_IS_PAUSED = 177;
    int64 public constant INVALID_FREEZE_KEY = 202;
    int64 public constant INVALID_WIPE_KEY = 203;
}

// ============ HSS RESPONSE CODES ============

library HssResponseCodes {
    int64 public constant SUCCESS = 22;
    int64 public constant INVALID_SCHEDULE_ID = 201;
    int64 public constant SCHEDULE_ALREADY_DELETED = 202;
    int64 public constant SCHEDULE_ALREADY_EXECUTED = 203;
    int64 public constant INVALID_SCHEDULE_ACCOUNT_ID = 204;
    int64 public constant SCHEDULE_IS_IMMUTABLE = 223;
    int64 public constant INVALID_SIGNATURE = 7;
    int64 public constant SCHEDULED_TRANSACTION_NOT_IN_WHITELIST = 225;
    int64 public constant SOME_SIGNATURES_WERE_INVALID = 226;
    int64 public constant TRANSACTION_ID_FIELD_NOT_ALLOWED = 227;
    int64 public constant IDENTICAL_SCHEDULE_ALREADY_CREATED = 228;
    int64 public constant INVALID_ZERO_BYTE_IN_STRING = 229;
    int64 public constant SCHEDULE_EXPIRED = 230;
    int64 public constant NO_NEW_VALID_SIGNATURES = 231;
    int64 public constant UNRESOLVABLE_REQUIRED_SIGNERS = 232;
    int64 public constant SCHEDULED_MESSAGE_SIZE_EXCEEDED = 233;
    int64 public constant UNPARSEABLE_SCHEDULED_TRANSACTION = 234;
}

// ============ HSS HELPER LIBRARY ============

library HssHelper {
    // Validate schedule response
    function isSuccess(int64 responseCode) internal pure returns (bool) {
        return responseCode == HssResponseCodes.SUCCESS;
    }
    
    // Check if schedule is still valid
    function isScheduleValid(int64 responseCode) internal pure returns (bool) {
        return responseCode != HssResponseCodes.SCHEDULE_ALREADY_DELETED &&
               responseCode != HssResponseCodes.SCHEDULE_ALREADY_EXECUTED &&
               responseCode != HssResponseCodes.SCHEDULE_EXPIRED;
    }
    
    // Get error message for response code
    function getErrorMessage(int64 responseCode) internal pure returns (string memory) {
        if (responseCode == HssResponseCodes.SUCCESS) return "Success";
        if (responseCode == HssResponseCodes.INVALID_SCHEDULE_ID) return "Invalid schedule ID";
        if (responseCode == HssResponseCodes.SCHEDULE_ALREADY_DELETED) return "Schedule already deleted";
        if (responseCode == HssResponseCodes.SCHEDULE_ALREADY_EXECUTED) return "Schedule already executed";
        if (responseCode == HssResponseCodes.INVALID_SCHEDULE_ACCOUNT_ID) return "Invalid schedule account ID";
        if (responseCode == HssResponseCodes.SCHEDULE_IS_IMMUTABLE) return "Schedule is immutable";
        if (responseCode == HssResponseCodes.INVALID_SIGNATURE) return "Invalid signature";
        if (responseCode == HssResponseCodes.SCHEDULE_EXPIRED) return "Schedule expired";
        if (responseCode == HssResponseCodes.NO_NEW_VALID_SIGNATURES) return "No new valid signatures";
        return "Unknown error";
    }
}

// ============ SCHEDULE TRANSACTION BUILDER ============

library ScheduleTransactionBuilder {
    // Build contract execute transaction data for scheduling
    function buildPaymentExecutionData(
        address contractAddress,
        bytes4 functionSelector,
        bytes memory params
    ) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(functionSelector, params);
    }
    
    // Calculate execution time for future cycle
    function calculateExecutionTime(
        uint256 currentTime,
        uint256 cycleDuration,
        uint256 cyclesAhead
    ) internal pure returns (uint256) {
        return currentTime + (cycleDuration * cyclesAhead);
    }
    
    // Validate execution time (max 62 days as per HSS limit)
    function isValidExecutionTime(uint256 executionTime, uint256 currentTime) internal pure returns (bool) {
        uint256 maxFutureTime = currentTime + 62 days;
        return executionTime > currentTime && executionTime <= maxFutureTime;
    }
    
    // Build multiple execution times for rolling schedule
    function buildRollingSchedule(
        uint256 startTime,
        uint256 numberOfCycles,
        uint256 intervalDays
    ) internal pure returns (uint256[] memory executionTimes) {
        executionTimes = new uint256[](numberOfCycles);
        for (uint256 i = 0; i < numberOfCycles; i++) {
            executionTimes[i] = startTime + (intervalDays * 1 days * (i + 1));
        }
        return executionTimes;
    }
    
    // Validate schedule parameters
    function validateScheduleParams(
        uint256 executionTime,
        uint256 amount,
        address recipient
    ) internal view returns (bool isValid, string memory reason) {
        if (recipient == address(0)) {
            return (false, "Invalid recipient address");
        }
        if (amount == 0) {
            return (false, "Amount must be greater than zero");
        }
        if (!isValidExecutionTime(executionTime, block.timestamp)) {
            return (false, "Invalid execution time");
        }
        return (true, "");
    }
    
    // Calculate optimal batch size for multiple schedules
    function calculateOptimalBatchSize(uint256 totalSchedules, uint256 gasLimit) internal pure returns (uint256) {
        uint256 gasPerSchedule = 150000; // Approximate gas per schedule creation
        uint256 maxBatchSize = gasLimit / gasPerSchedule;
        return maxBatchSize > totalSchedules ? totalSchedules : maxBatchSize;
    }
}

// ============================================================================
// END OF UNIFIED INTERFACE
// ============================================================================