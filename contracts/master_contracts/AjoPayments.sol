// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../core/LockableContract.sol";
import "../interfaces/AjoInterfaces.sol";
import "../hedera/hedera-token-service/HederaTokenService.sol";
import "../hedera/HederaResponseCodes.sol";

/**
 * @title AjoPayments (Direct HTS Integration)
 * @notice Manages payment processing and payout distribution using Hedera Token Service
 * @dev Inherits from HederaTokenService for proper HTS interaction
 */
contract AjoPayments is 
    IAjoPayments, 
    HederaTokenService,
    ReentrancyGuard, 
    Ownable, 
    Initializable, 
    LockableContract 
{
    // ============ STATE VARIABLES ============
    
    address public usdcToken; // HTS USDC token address
    address public hbarToken; // HTS WHBAR token address
    address public ajoCore;
    IAjoMembers public membersContract;
    IAjoCollateral public collateralContract;
    
    uint256 public constant DEFAULT_PENALTY_RATE = 500; // 5% monthly penalty
    uint256 public penaltyRate;
    
    uint256 public currentCycle;
    uint256 public nextPayoutPosition;
    PaymentToken public activePaymentToken;
    
    mapping(PaymentToken => TokenConfig) public tokenConfigs;
    mapping(uint256 => PayoutRecord) public payouts;
    mapping(address => uint256) public pendingPenalties;
    
    // ============ STORAGE FOR FRONTEND TRACKING ============
    
    mapping(uint256 => address[]) private cyclePaidMembers;
    mapping(uint256 => mapping(address => bool)) private hasPaidInCycle;
    mapping(uint256 => uint256) private cycleTotalCollected;
    mapping(address => PaymentStatus) public currentCyclePayment;
    
    uint256 public cycleStartTime;
    uint256 public cycleDuration = 30 days;
    
    // ============ EVENTS ============
    
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    
    event PaymentMadeDetailed(
        address indexed member,
        uint256 amountPaid,
        uint256 penaltyApplied,
        uint256 totalPayment,
        uint256 indexed cycle,
        PaymentToken token,
        uint256 timestamp
    );
    
    event CycleSummary(
        uint256 indexed cycle,
        uint256 totalCollected,
        uint256 membersPaidCount,
        uint256 timestamp
    );
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER ============
    
    function initialize(
        address _usdc,
        address _hbar,
        address _ajoCore,
        address _membersContract,
        address _collateralContract,
        address _hederaTokenService // This parameter can be ignored now since we use inheritance
    ) external override initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_hbar != address(0), "Invalid HBAR address");
        require(_ajoCore != address(0), "Invalid AjoCore address");
        require(_membersContract != address(0), "Invalid members contract");
        require(_collateralContract != address(0), "Invalid collateral contract");
        
        _transferOwnership(msg.sender);
        
        usdcToken = _usdc;
        hbarToken = _hbar;
        ajoCore = _ajoCore;
        membersContract = IAjoMembers(_membersContract);
        collateralContract = IAjoCollateral(_collateralContract);
        
        penaltyRate = DEFAULT_PENALTY_RATE;
        currentCycle = 1;
        nextPayoutPosition = 1;
        activePaymentToken = PaymentToken.USDC;
        cycleStartTime = block.timestamp;
        
        // Initialize token configurations
        tokenConfigs[PaymentToken.USDC] = TokenConfig({
            monthlyPayment: 50e6,
            isActive: true,
            htsTokenAddress: _usdc,
            isHtsToken: true
        });
        
        tokenConfigs[PaymentToken.HBAR] = TokenConfig({
            monthlyPayment: 1000e8,
            isActive: true,
            htsTokenAddress: _hbar,
            isHtsToken: true
        });
    }

    function verifySetup() external override view returns (bool isValid, string memory reason) {
        if (ajoCore == address(0)) {
            return (false, "AjoCore not set");
        }
        return (true, "Setup is valid");
    }
    
    // ============ INTERNAL HTS HELPER FUNCTIONS ============
    
    /**
     * @dev Internal function to safely transfer HTS tokens
     * @param tokenAddress The HTS token address
     * @param from The sender address
     * @param to The receiver address
     * @param amount The amount to transfer
     * @return result The transfer result with response code and success status
     */
    function _safeTransferHtsToken(
        address tokenAddress,
        address from,
        address to,
        int64 amount
    ) internal returns (HtsTransferResult memory result) {
        // Call the inherited transferToken function from HederaTokenService
        int responseCode = transferToken(tokenAddress, from, to, amount);
        
        // Convert int to int64 safely
        result.responseCode = int64(responseCode);
        result.success = (responseCode == HederaResponseCodes.SUCCESS);
        
        if (!result.success) {
            result.errorMessage = _getHtsErrorMessage(responseCode);
        } else {
            result.errorMessage = "";
        }
        
        return result;
    }
    
    /**
     * @dev Get human-readable error message for HTS response code
     */
    function _getHtsErrorMessage(int responseCode) internal pure returns (string memory) {
        if (responseCode == HederaResponseCodes.SUCCESS) return "Success";
        if (responseCode == HederaResponseCodes.INVALID_TOKEN_ID) return "Invalid token ID";
        if (responseCode == HederaResponseCodes.INVALID_ACCOUNT_ID) return "Invalid account ID";
        if (responseCode == HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE) return "Insufficient token balance";
        if (responseCode == HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT) return "Token not associated to account";
        if (responseCode == HederaResponseCodes.ACCOUNT_FROZEN_FOR_TOKEN) return "Account frozen for token";
        if (responseCode == HederaResponseCodes.TOKEN_WAS_DELETED) return "Token was deleted";
        if (responseCode == HederaResponseCodes.INVALID_SIGNATURE) return "Invalid signature";
        return "Unknown error";
    }
    
    /**
     * @dev Check if an account is associated with a token
     */
    function _ensureTokenAssociation(address account, address tokenAddress) internal {
        // Try to check if already associated (this would need to be implemented based on your needs)
        // For now, we'll attempt association and handle the error if already associated
        int responseCode = associateToken(account, tokenAddress);
        
        // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT (147) is acceptable
        require(
            responseCode == HederaResponseCodes.SUCCESS || 
            responseCode == 147, // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT
            string(abi.encodePacked("Association failed: ", _getHtsErrorMessage(responseCode)))
        );
    }
    
    // ============ HTS PAYMENT FUNCTIONS ============
    
    function processPaymentHts(
        address member,
        uint256 amount,
        PaymentToken token
    ) external override onlyAjoCore nonReentrant returns (HtsTransferResult memory result) {
        address tokenAddress = (token == PaymentToken.USDC) ? usdcToken : hbarToken;
        Member memory memberData = membersContract.getMember(member);
        
        require(memberData.isActive, "Member not active");
        require(memberData.lastPaymentCycle < currentCycle, "Payment already made");
        
        // Calculate total payment (including any penalties)
        uint256 penalty = pendingPenalties[member];
        uint256 totalPayment = amount + penalty;
        
        // Ensure amount fits in int64
        require(totalPayment <= uint256(uint64(type(int64).max)), "Amount too large");
        
        // Transfer payment using inherited HederaTokenService function
        result = _safeTransferHtsToken(
            tokenAddress,
            member,
            address(this),
            int64(uint64(totalPayment))
        );
        
        require(result.success, result.errorMessage);
        
        // Update cycle tracking
        if (!hasPaidInCycle[currentCycle][member]) {
            cyclePaidMembers[currentCycle].push(member);
            hasPaidInCycle[currentCycle][member] = true;
            cycleTotalCollected[currentCycle] += totalPayment;
        }
        
        // Store current cycle payment details
        currentCyclePayment[member] = PaymentStatus({
            cycle: currentCycle,
            hasPaid: true,
            amountPaid: amount,
            penaltyApplied: penalty,
            timestamp: block.timestamp
        });
        
        // Update member contract
        membersContract.updateLastPaymentCycle(member, currentCycle);
        membersContract.addPastPayment(member, totalPayment);
        
        // Clear penalties
        pendingPenalties[member] = 0;
        
        // Emit events
        emit PaymentMadeHts(member, totalPayment, currentCycle, tokenAddress, result.responseCode);
        emit PaymentMadeDetailed(member, amount, penalty, totalPayment, currentCycle, token, block.timestamp);
        
        return result;
    }
    
    function distributePayoutHts() 
        external 
        override 
        onlyAjoCore 
        nonReentrant 
        returns (
            address recipient,
            uint256 amount,
            HtsTransferResult memory result
        ) 
    {
        // Find next recipient
        recipient = getNextRecipient();
        require(recipient != address(0), "No eligible recipient");
        
        Member memory recipientMember = membersContract.getMember(recipient);
        amount = calculatePayout();
        
        require(amount <= uint256(uint64(type(int64).max)), "Amount too large");
        
        address tokenAddress = (recipientMember.preferredToken == PaymentToken.USDC) 
            ? usdcToken 
            : hbarToken;
        
        // Distribute payout using inherited HederaTokenService function
        result = _safeTransferHtsToken(
            tokenAddress,
            address(this),
            recipient,
            int64(uint64(amount))
        );
        
        require(result.success, result.errorMessage);
        
        // Update payout record
        payouts[currentCycle] = PayoutRecord({
            recipient: recipient,
            amount: amount,
            cycle: currentCycle,
            timestamp: block.timestamp
        });
        
        // Update member status
        membersContract.updateTotalPaid(recipient, amount);
        membersContract.markPayoutReceived(recipient);
        
        nextPayoutPosition++;
        
        // Emit events
        emit PayoutDistributedHts(recipient, amount, currentCycle, tokenAddress, result.responseCode);
        
        return (recipient, amount, result);
    }
    
    function handleDefaultHts(
        address defaulter
    ) external override onlyAjoCore nonReentrant returns (
        uint256 totalRecovered,
        uint256 redistributed
    ) {
        Member memory member = membersContract.getMember(defaulter);
        
        require(member.isActive, "Member not found");
        require(member.lastPaymentCycle < currentCycle, "Not in default");
        
        // Step 1: Seize collateral
        (uint256 collateralSeized, HtsTransferResult memory seizureResult) = 
            collateralContract.seizeCollateralHts(defaulter);
        
        require(seizureResult.success, seizureResult.errorMessage);
        
        // Step 2: Calculate past payments seized
        uint256 pastPaymentsSeized = 0;
        for (uint256 i = 0; i < member.pastPayments.length; i++) {
            pastPaymentsSeized += member.pastPayments[i];
        }
        
        // Get guarantor's past payments
        if (member.guarantor != address(0)) {
            Member memory guarantor = membersContract.getMember(member.guarantor);
            for (uint256 i = 0; i < guarantor.pastPayments.length; i++) {
                pastPaymentsSeized += guarantor.pastPayments[i];
            }
        }
        
        totalRecovered = collateralSeized + pastPaymentsSeized;
        
        // Step 3: Redistribute to affected members
        address[] memory allMembers = membersContract.getActiveMembersList();
        uint256 eligibleCount = 0;
        
        for (uint256 i = 0; i < allMembers.length; i++) {
            if (allMembers[i] != defaulter && allMembers[i] != member.guarantor) {
                eligibleCount++;
            }
        }
        
        if (eligibleCount > 0) {
            uint256 amountPerMember = totalRecovered / eligibleCount;
            
            address[] memory recipients = new address[](eligibleCount);
            uint256[] memory amounts = new uint256[](eligibleCount);
            uint256 index = 0;
            
            for (uint256 i = 0; i < allMembers.length; i++) {
                if (allMembers[i] != defaulter && allMembers[i] != member.guarantor) {
                    recipients[index] = allMembers[i];
                    amounts[index] = amountPerMember;
                    index++;
                }
            }
            
            HtsTransferResult[] memory redistributionResults = 
                collateralContract.redistributeSeizedCollateral(
                    recipients,
                    amounts,
                    member.preferredToken
                );
            
            for (uint256 i = 0; i < redistributionResults.length; i++) {
                require(redistributionResults[i].success, redistributionResults[i].errorMessage);
            }
            
            redistributed = amountPerMember * eligibleCount;
        }
        
        // Update member status
        membersContract.incrementDefaultCount(defaulter);
        if (member.guarantor != address(0)) {
            membersContract.incrementDefaultCount(member.guarantor);
        }
        
        // Update reputations
        membersContract.updateReputation(defaulter, 0);
        if (member.guarantor != address(0)) {
            Member memory guarantor = membersContract.getMember(member.guarantor);
            uint256 newReputation = guarantor.reputationScore > 100 
                ? guarantor.reputationScore - 100 
                : 0;
            membersContract.updateReputation(member.guarantor, newReputation);
        }
        
        emit DefaultHandledHts(defaulter, totalRecovered, redistributed, currentCycle);
        
        return (totalRecovered, redistributed);
    }
    
    function batchHandleDefaults(
        address[] calldata defaulters
    ) external override onlyAjoCore returns (uint256[] memory recoveredAmounts) {
        recoveredAmounts = new uint256[](defaulters.length);
        
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            Member memory member = membersContract.getMember(defaulter);
            
            if (member.isActive && member.lastPaymentCycle < currentCycle) {
                uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
                TokenConfig memory config = tokenConfigs[member.preferredToken];
                uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
                
                pendingPenalties[defaulter] += penalty;
                membersContract.incrementDefaultCount(defaulter);
                
                recoveredAmounts[i] = penalty;
            }
        }
        
        return recoveredAmounts;
    }
    
    // ============ CYCLE & CONFIG FUNCTIONS ============
    
    function advanceCycle() external override onlyAjoCore {
        emit CycleSummary(
            currentCycle,
            cycleTotalCollected[currentCycle],
            cyclePaidMembers[currentCycle].length,
            block.timestamp
        );
        
        currentCycle++;
        cycleStartTime = block.timestamp;
        emit CycleAdvanced(currentCycle, block.timestamp);
    }
    
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external override onlyAjoCore {
        tokenConfigs[token].monthlyPayment = monthlyPayment;
        tokenConfigs[token].isActive = isActive;
    }
    
    function updatePenaltyRate(uint256 newPenaltyRate) external override onlyAjoCore {
        require(newPenaltyRate <= 2000, "Penalty rate too high");
        penaltyRate = newPenaltyRate;
    }
    
    function updateNextPayoutPosition(uint256 position) external override onlyAjoCore {
        nextPayoutPosition = position;
    }
    
    function emergencyWithdraw(PaymentToken token) external override onlyAjoCore {
        address tokenAddress = (token == PaymentToken.USDC) ? usdcToken : hbarToken;
        
        // Get contract's token balance first (would need to implement balance check)
        // For now, we'll try to transfer a reasonable amount
        uint256 withdrawAmount = 1000000e6; // Adjust as needed
        
        require(withdrawAmount <= uint256(uint64(type(int64).max)), "Amount too large");
        
        HtsTransferResult memory result = _safeTransferHtsToken(
            tokenAddress,
            address(this),
            ajoCore,
            int64(uint64(withdrawAmount))
        );
        
        // Allow insufficient balance errors in emergency withdraw
        if (!result.success && result.responseCode != HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE) {
            revert(result.errorMessage);
        }
    }
    
    // ============ CALCULATION FUNCTIONS ============
    
    function calculatePayout() public view override returns (uint256) {
        TokenConfig memory config = tokenConfigs[activePaymentToken];
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        return config.monthlyPayment * totalMembers;
    }
    
    function getNextRecipient() public view override returns (address) {
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        if (nextPayoutPosition > totalMembers) return address(0);
        
        address candidate = address(0);
        
        for (uint256 i = 0; i < totalMembers; i++) {
            address memberAddr = membersContract.activeMembersList(i);
            Member memory memberInfo = membersContract.getMember(memberAddr);
            
            if (memberInfo.queueNumber == nextPayoutPosition) {
                candidate = memberAddr;
                break;
            }
        }
        
        if (candidate == address(0)) return address(0);
        
        Member memory candidateMember = membersContract.getMember(candidate);
        
        if (!candidateMember.isActive || candidateMember.lastPaymentCycle < currentCycle) {
            return address(0);
        }
        
        return candidate;
    }
    
    // ============ QUERY FUNCTIONS ============
    
    function needsToPayThisCycle(address member) external view override returns (bool) {
        Member memory memberInfo = membersContract.getMember(member);
        return memberInfo.isActive && memberInfo.lastPaymentCycle < currentCycle;
    }
    
    function getTokenConfig(PaymentToken token) external view override returns (TokenConfig memory) {
        return tokenConfigs[token];
    }
    
    function getCurrentCycle() external view override returns (uint256) {
        return currentCycle;
    }
    
    function getNextPayoutPosition() external view override returns (uint256) {
        return nextPayoutPosition;
    }
    
    function getActivePaymentToken() external view override returns (PaymentToken) {
        return activePaymentToken;
    }
    
    function getPendingPenalty(address member) external view override returns (uint256) {
        return pendingPenalties[member];
    }
    
    function getPenaltyRate() external view override returns (uint256) {
        return penaltyRate;
    }
    
    function getContractBalance(PaymentToken token) external view override returns (uint256) {
        // Note: You might want to implement actual balance checking here
        return 0;
    }
    
    function getTotalPayouts() external view override returns (uint256) {
        return currentCycle > 1 ? currentCycle - 1 : 0;
    }
    
    function isPayoutReady() external view override returns (bool) {
        address nextRecipient = getNextRecipient();
        return nextRecipient != address(0) && calculatePayout() > 0;
    }
    
    function getPayout(uint256 cycle) external view override returns (PayoutRecord memory) {
        return payouts[cycle];
    }
    
    function getMemberPaymentHistory(
        address member
    ) external view override returns (PaymentStatus[] memory) {
        PaymentStatus[] memory history = new PaymentStatus[](1);
        history[0] = currentCyclePayment[member];
        return history;
    }
    
    function getCyclePaymentStatus(
        uint256 cycle
    ) external view override returns (
        address[] memory paidMembers,
        address[] memory unpaidMembers,
        uint256 totalCollected
    ) {
        paidMembers = cyclePaidMembers[cycle];
        totalCollected = cycleTotalCollected[cycle];
        
        address[] memory allMembers = membersContract.getActiveMembersList();
        uint256 unpaidCount = 0;
        
        for (uint256 i = 0; i < allMembers.length; i++) {
            if (!hasPaidInCycle[cycle][allMembers[i]]) {
                unpaidCount++;
            }
        }
        
        unpaidMembers = new address[](unpaidCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allMembers.length; i++) {
            if (!hasPaidInCycle[cycle][allMembers[i]]) {
                unpaidMembers[index] = allMembers[i];
                index++;
            }
        }
    }
    
    function getCurrentCycleDashboard() 
        external 
        view 
        override 
        returns (CycleDashboard memory dashboard) 
    {
        dashboard.currentCycle = currentCycle;
        dashboard.nextPayoutPosition = nextPayoutPosition;
        dashboard.nextRecipient = getNextRecipient();
        dashboard.expectedPayout = calculatePayout();
        dashboard.totalPaidThisCycle = cycleTotalCollected[currentCycle];
        dashboard.isPayoutReady = dashboard.nextRecipient != address(0) && dashboard.expectedPayout > 0;
        dashboard.membersPaid = cyclePaidMembers[currentCycle];
        
        // Set scheduling flags to false (HSS removed)
        dashboard.hasScheduledPayment = false;
        dashboard.scheduledPaymentAddress = address(0);
        
        TokenConfig memory config = tokenConfigs[activePaymentToken];
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        uint256 expectedTotal = config.monthlyPayment * totalMembers;
        dashboard.remainingToPay = expectedTotal > dashboard.totalPaidThisCycle 
            ? expectedTotal - dashboard.totalPaidThisCycle 
            : 0;
        
        address[] memory allMembers = membersContract.getActiveMembersList();
        uint256 unpaidCount = 0;
        for (uint256 i = 0; i < allMembers.length; i++) {
            if (!hasPaidInCycle[currentCycle][allMembers[i]]) {
                unpaidCount++;
            }
        }
        
        dashboard.membersUnpaid = new address[](unpaidCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allMembers.length; i++) {
            if (!hasPaidInCycle[currentCycle][allMembers[i]]) {
                dashboard.membersUnpaid[index] = allMembers[i];
                index++;
            }
        }
    }
    
    function getUpcomingEvents(
        address member
    ) external view override returns (UpcomingEvent[] memory) {
        Member memory memberInfo = membersContract.getMember(member);
        if (!memberInfo.isActive) {
            return new UpcomingEvent[](0);
        }
        
        UpcomingEvent[] memory events = new UpcomingEvent[](2);
        uint256 count = 0;
        
        // Event 1: Payment due
        if (memberInfo.lastPaymentCycle < currentCycle) {
            TokenConfig memory config = tokenConfigs[activePaymentToken];
            events[count] = UpcomingEvent({
                eventType: 0,
                timestamp: cycleStartTime + cycleDuration,
                affectedMember: member,
                amount: config.monthlyPayment + pendingPenalties[member]
            });
            count++;
        }
        
        // Event 2: Payout ready
        if (memberInfo.queueNumber == nextPayoutPosition && !memberInfo.hasReceivedPayout) {
            events[count] = UpcomingEvent({
                eventType: 1,
                timestamp: block.timestamp,
                affectedMember: member,
                amount: calculatePayout()
            });
            count++;
        }
        
        // Resize array
        UpcomingEvent[] memory result = new UpcomingEvent[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = events[i];
        }
        return result;
    }
    
    function getNextPaymentDeadline() external view override returns (uint256) {
        return cycleStartTime + cycleDuration;
    }
}