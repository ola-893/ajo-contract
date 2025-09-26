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

// ============ MAIN AJO INTERFACE ============

interface IPatientAjo {
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
interface IAjoGovernance {
    // Core Governance Functions
    function createProposal(
        string memory description,
        bytes memory proposalData
    ) external returns (uint256);
    
    function vote(uint256 proposalId, uint8 support) external;
    function executeProposal(uint256 proposalId) external;
    
    // Governance-Only Functions
    function updatePenaltyRate(uint256 newPenaltyRate) external;
    function switchPaymentToken(PaymentToken newToken) external;
    function updateReputationAndVotingPower(address member, bool positive) external;
    function updateVotingPower(address member, uint256 newPower) external;
    
    // View Functions
    function getProposal(uint256 proposalId) external view returns (
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        uint256 proposalEndTime,
        bool executed,
        bytes memory proposalData
    );
    
    function hasVoted(uint256 proposalId, address voter) external view returns (bool);
    
    function getGovernanceSettings() external view returns (
        uint256 proposalThreshold,
        uint256 votingPeriod,
        uint256 currentPenaltyRate,
        uint256 totalProposals
    );
    
    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event VotingPowerUpdated(address indexed member, uint256 newVotingPower);
    event ReputationUpdated(address indexed member, uint256 newReputation);
}

// ============ COLLATERAL INTERFACE ============

interface IAjoCollateral {
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
    // Core Payment Functions
    function makePayment() external;
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
    function switchPaymentToken(PaymentToken newToken) external;
    function emergencyWithdraw(PaymentToken token) external;
    function updatePenaltyRate(uint256 newPenaltyRate) external;
    function updateNextPayoutPosition(uint256 position) external;
    
    // View Functions
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
    // Core Member Functions
    function joinAjo(PaymentToken tokenChoice) external;
    function exitAjo() external;
    function updateReputation(address member, uint256 newReputation) external;
    
    // NEW: Member Management Functions (added based on AjoMembers contract)
    function addMember(address member, Member memory memberData) external;
    function removeMember(address member) external;
    function updateMember(address member, Member memory memberData) external;
    
    // NEW: Additional Member Management Functions
    function updateCollateral(address member, uint256 newAmount) external;
    function addPastPayment(address member, uint256 payment) external;
    function updateLastPaymentCycle(address member, uint256 cycle) external;
    function incrementDefaultCount(address member) external;
    function updateTotalPaid(address member, uint256 amount) external;
    function markPayoutReceived(address member) external;
    
    // View Functions
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
    
    // NEW: Additional View Functions (based on AjoMembers contract)
    function isMember(address member) external view returns (bool);
    function getActiveMembersList() external view returns (address[] memory);
    function getQueuePosition(uint256 queueNumber) external view returns (address);
    function getGuarantorForPosition(uint256 position) external view returns (address);
    function getLockedCollateral(address member) external view returns (uint256);
    function getMemberAtIndex(uint256 index) external view returns (address);
    
    // Events
    event MemberJoined(address indexed member, uint256 queueNumber, uint256 collateral, PaymentToken token);
    event MemberRemoved(address indexed member);
    event MemberUpdated(address indexed member);
    event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
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