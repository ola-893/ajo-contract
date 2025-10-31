// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../core/LockableContract.sol";
import  "../interfaces/AjoInterfaces.sol";

contract AjoPayments is IAjoPayments, ReentrancyGuard, Ownable, Initializable, LockableContract {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
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
    
    // ============ CYCLE COMPLETION TRACKING ============
    
    mapping(uint256 => bool) private cycleCompleted;
    bool private _cycleAdvancing;
    
    // ============ OPTIMIZED STORAGE FOR FRONTEND TRACKING ============
    
    // Track only CURRENT cycle data (much cheaper than full history)
    mapping(uint256 => address[]) private cyclePaidMembers;
    mapping(uint256 => mapping(address => bool)) private hasPaidInCycle;
    mapping(uint256 => uint256) private cycleTotalCollected;
    
    // Track current cycle payment details per member (for quick lookup)
    mapping(address => PaymentStatus) public currentCyclePayment;
    
    // Track cycle start times for deadline calculations
    uint256 public cycleStartTime;
    uint256 public cycleDuration = 30 days; // Default 30 days per cycle
    
    // ============ ENHANCED EVENTS (FOR HISTORICAL DATA) ============
    
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    event CycleForceAdvanced(uint256 indexed newCycle, uint256 timestamp, address indexed advancer);

    
    // DETAILED EVENT - Frontend indexes this for payment history
    event PaymentMadeDetailed(
        address indexed member,
        uint256 amountPaid,
        uint256 penaltyApplied,
        uint256 totalPayment,
        uint256 indexed cycle,
        PaymentToken token,
        uint256 timestamp
    );
    
    // CYCLE SUMMARY EVENT - Emitted when cycle advances
    event CycleSummary(
        uint256 indexed cycle,
        uint256 totalCollected,
        uint256 membersPaidCount,
        uint256 timestamp
    );
    
    // DEBUG EVENTS
    event CycleAdvancementAttempt(
        uint256 fromCycle,
        uint256 toCycle,
        address caller,
        string reason
    );
    
    event PayoutDistributionComplete(
        uint256 cycle,
        address recipient,
        uint256 amount,
        uint256 nextCycle
    );
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    // ============ CONSTRUCTOR (for master copy) ============
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER (for proxy instances) ============
    function initialize(
        address _usdc, 
        address _hbar, 
        address _ajoCore, 
        address _membersContract,
        address _collateralContract
    ) external override initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_hbar != address(0), "Invalid HBAR address");
        require(_ajoCore != address(0), "Invalid AjoCore address");
        require(_membersContract != address(0), "Invalid members contract");
        require(_collateralContract != address(0), "Invalid collateral contract");
        
        _transferOwnership(msg.sender);
        
        USDC = IERC20(_usdc);
        HBAR = IERC20(_hbar);
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
            isActive: true
        });
        
        tokenConfigs[PaymentToken.HBAR] = TokenConfig({
            monthlyPayment: 1000e8,
            isActive: true
        });
    }
    
     /**
     * @dev Set AjoCore address - only works during setup phase
     * @param _ajoCore Address of the AjoCore contract
     */
    function setAjoCore(address _ajoCore) external onlyOwner onlyDuringSetup {
        require(_ajoCore != address(0), "Cannot set zero address");
        require(_ajoCore != ajoCore, "Already set to this address");
        
        address oldCore = ajoCore;
        ajoCore = _ajoCore;
        
        emit AjoCoreUpdated(oldCore, _ajoCore);
    }
    
    /**
     * @dev Verify setup for AjoMembers
     */
    function verifySetup() external view override returns (bool isValid, string memory reason) {
        if (ajoCore == address(0)) {
            return (false, "AjoCore not set");
        }
        return (true, "Setup is valid");
    }
    
    // ============ CORE PAYMENT FUNCTIONS (IAjoPayments) ============
    
    /**
     * @dev Distribute payout to next recipient and advance cycle
     * CRITICAL: This function MUST be the ONLY place that advances cycles
     */
    function distributePayout() external override nonReentrant {
        require(msg.sender == ajoCore, "Only AjoCore");
        
        // CRITICAL: Prevent double advancement
        require(!cycleCompleted[currentCycle], "Cycle already completed");
        
        uint256 startingCycle = currentCycle;
        address recipient = getNextRecipient();
        
        // If current position has no valid recipient (removed/banned member)
        // Skip to next position
        while (recipient == address(0) && nextPayoutPosition <= membersContract.getTotalActiveMembers()) {
            nextPayoutPosition++; // Skip this position
            recipient = getNextRecipient();
        }
        
        require(recipient != address(0), "No eligible recipient");
        
        Member memory recipientMember = membersContract.getMember(recipient);
        
        // FIXED: Use hasPaidInCycle instead of lastPaymentCycle comparison
        require(hasPaidInCycle[currentCycle][recipient], "Recipient must pay first");
        
        // Verify all OTHER members have paid
        address[] memory allMembers = membersContract.getActiveMembersList();
        for (uint256 i = 0; i < allMembers.length; i++) {
            address member = allMembers[i];
            if (member == recipient) continue;
            
            // FIXED: Use hasPaidInCycle for accurate check
            require(hasPaidInCycle[currentCycle][member], "Not all members paid");
        }
        
        // Calculate and distribute payout
        uint256 payoutAmount = calculatePayout();
        _distributePayout(recipient, payoutAmount, recipientMember.preferredToken);
        
        // Update member status
        membersContract.markPayoutReceived(recipient);
        
        // CRITICAL: Mark cycle as completed BEFORE advancing
        cycleCompleted[currentCycle] = true;
        
        // Emit debug event
        emit CycleAdvancementAttempt(
            currentCycle,
            currentCycle + 1,
            msg.sender,
            "After payout distribution"
        );
        
        // FIXED: Advance cycle (can be called externally too, but protected by reentrancy)
        nextPayoutPosition++;
        advanceCycle(); // Public function with reentrancy protection
        
        // Emit completion
        emit PayoutDistributionComplete(
            startingCycle,
            recipient,
            payoutAmount,
            currentCycle
        );
    }
    
    function handleDefault(address defaulter) external override onlyAjoCore {
        Member memory member = membersContract.getMember(defaulter);
        
        require(member.isActive, "Member not found");
        
        // FIXED: Use hasPaidInCycle for accurate default check
        if (hasPaidInCycle[currentCycle][defaulter]) return; // Not in default
        
        uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
        TokenConfig memory config = tokenConfigs[member.preferredToken];
        uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
        
        // Add penalty
        pendingPenalties[defaulter] += penalty;
        
        // Increment default count
        membersContract.incrementDefaultCount(defaulter);
        
        emit MemberDefaulted(defaulter, currentCycle, penalty);
    }
    
    // ============ VIEW FUNCTIONS (IAjoPayments) ============
    
    /**
     * @dev Check if member needs to pay this cycle
     * FIXED: Directly check hasPaidInCycle mapping for accuracy
     */
    function needsToPayThisCycle(address member) external view override returns (bool) {
        Member memory memberInfo = membersContract.getMember(member);
        
        if (!memberInfo.isActive) {
            return false;
        }
        
        // FIXED: Direct check of hasPaidInCycle - most reliable
        return !hasPaidInCycle[currentCycle][member];
    }
    
    function getTokenConfig(PaymentToken token) external view override returns (TokenConfig memory) {
        return tokenConfigs[token];
    }
    
    // ============ PAYMENT PROCESSING FUNCTIONS (GAS OPTIMIZED) ============
    
    /**
     * @dev Process payment from member
     * CRITICAL FIX: State updates happen AFTER successful token transfer
     * This ensures failed transactions don't mark members as paid
     */
    function processPayment(address member, uint256 amount, PaymentToken token) external onlyAjoCore nonReentrant {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        Member memory memberData = membersContract.getMember(member);
        
        require(memberData.isActive, "Member not active");
        
        // CRITICAL: Check cycle not completed
        require(!cycleCompleted[currentCycle], "Cycle already completed");
        
        // FIXED: Use hasPaidInCycle to prevent double payment
        require(!hasPaidInCycle[currentCycle][member], "Payment already made");
        
        // Calculate total payment (including any penalties)
        uint256 penalty = pendingPenalties[member];
        uint256 totalPayment = amount + penalty;

        // ============ CRITICAL FIX: TRANSFER FIRST, THEN UPDATE STATE ============
        // This ensures that if the transfer fails, no state is changed
        bool transferSuccess = tokenContract.transferFrom(member, address(this), totalPayment);
        require(transferSuccess, "Token transfer failed");
        
        // ============ ONLY AFTER SUCCESSFUL TRANSFER: UPDATE STATE ============
        
        // Mark payment in current cycle tracking
        hasPaidInCycle[currentCycle][member] = true;
        cyclePaidMembers[currentCycle].push(member);
        cycleTotalCollected[currentCycle] += totalPayment;
        
        // Store current cycle payment details (overwrites each cycle)
        currentCyclePayment[member] = PaymentStatus({
            cycle: currentCycle,
            hasPaid: true,
            amountPaid: amount,
            penaltyApplied: penalty,
            timestamp: block.timestamp
        });
        
        // Update member contract - this updates lastPaymentCycle
        membersContract.updateLastPaymentCycle(member, currentCycle);
        membersContract.addPastPayment(member, totalPayment);
        
        // Clear penalties
        pendingPenalties[member] = 0;
        
        // EMIT DETAILED EVENT - Frontend indexes this for full history
        emit PaymentMadeDetailed(
            member,
            amount,
            penalty,
            totalPayment,
            currentCycle,
            token,
            block.timestamp
        );
        
        // Also emit standard event for backwards compatibility
        emit PaymentMade(member, totalPayment, currentCycle, token);
    }
    
    function _distributePayout(address recipient, uint256 amount, PaymentToken token) internal {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        
        tokenContract.transfer(recipient, amount);
        
        // Update payout record
        payouts[currentCycle] = PayoutRecord({
            recipient: recipient,
            amount: amount,
            cycle: currentCycle,
            timestamp: block.timestamp
        });
        
        emit PayoutDistributed(recipient, amount, currentCycle, token);
    }
    
    // ============ CALCULATION FUNCTIONS ============

    function calculatePayout() public view returns (uint256) {
        // Get the active token configuration
        TokenConfig memory config = tokenConfigs[activePaymentToken];
        
        // Get total number of active members
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        // Payout = total members × monthly contribution
        // This is the core ROSCA principle - fixed payout regardless of available funds
        uint256 payout = config.monthlyPayment * totalMembers;
        
        return payout;
    }
    
   /**
    * @dev Get the next recipient for payout
    * @return address The address of the next eligible recipient
    * 
    * UPDATED: Skips members who have been removed/banned due to defaults
    */
    function getNextRecipient() public view returns (address) {
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        // Check if we've completed all payouts
        if (nextPayoutPosition > totalMembers) return address(0);
        
        // Find member at current payout position who is still active
        address candidate = address(0);
        
        for (uint256 i = 0; i < totalMembers; i++) {
            address memberAddr = membersContract.activeMembersList(i);
            Member memory memberInfo = membersContract.getMember(memberAddr);
            
            if (memberInfo.queueNumber == nextPayoutPosition) {
                candidate = memberAddr;
                break;
            }
        }
        
        // If no member found at this position, they may have been removed
        if (candidate == address(0)) {
            // Skip this position and move to next
            // This is a view function, so we can't modify state
            // The actual position increment happens in distributePayout
            return address(0);
        }
        
        // Verify candidate is still active and hasn't received payout yet
        Member memory candidateMember = membersContract.getMember(candidate);
        
        if (!candidateMember.isActive) {
            return address(0); // Member was removed (defaulted/banned)
        }
        
        if (candidateMember.hasReceivedPayout) {
            return address(0); // Member already received their payout
        }
        
        return candidate;
    }
    
    
    /**
     * @dev Get payment history for a member
     * @notice For complete history, index PaymentMadeDetailed events off-chain
     * This function only returns current cycle on-chain data
     * @param member Address of the member
     * @return Array with current cycle payment status (single element)
     */
    function getMemberPaymentHistory(address member) external view override returns (PaymentStatus[] memory) {
        PaymentStatus[] memory history = new PaymentStatus[](1);
        history[0] = currentCyclePayment[member];
        return history;
    }
    
    /**
     * @dev Get payment status for a specific cycle
     * FIXED: Directly uses hasPaidInCycle mapping for accurate results
     * @param cycle Cycle number to query
     * @return paidMembers Array of members who paid
     * @return unpaidMembers Array of members who didn't pay
     * @return totalCollected Total amount collected this cycle
     */
    function getCyclePaymentStatus(uint256 cycle) external view override returns (
        address[] memory paidMembers,
        address[] memory unpaidMembers,
        uint256 totalCollected
    ) {
        // Return paid members from storage
        paidMembers = cyclePaidMembers[cycle];
        
        // Get all active members
        address[] memory allMembers = membersContract.getActiveMembersList();
        
        // Count unpaid members using hasPaidInCycle
        uint256 unpaidCount = 0;
        for (uint256 i = 0; i < allMembers.length; i++) {
            if (!hasPaidInCycle[cycle][allMembers[i]]) {
                unpaidCount++;
            }
        }
        
        // Build unpaid members array
        unpaidMembers = new address[](unpaidCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allMembers.length; i++) {
            if (!hasPaidInCycle[cycle][allMembers[i]]) {
                unpaidMembers[index] = allMembers[i];
                index++;
            }
        }
        
        totalCollected = cycleTotalCollected[cycle];
    }
    
    /**
     * @dev Get comprehensive dashboard data for current cycle (SINGLE CALL OPTIMIZATION)
     * FIXED: Uses accurate payment status checks
     * @return dashboard Complete cycle dashboard information
     */
    function getCurrentCycleDashboard() external view override returns (CycleDashboard memory dashboard) {
        dashboard.currentCycle = currentCycle;
        dashboard.nextPayoutPosition = nextPayoutPosition;
        dashboard.nextRecipient = getNextRecipient();
        dashboard.expectedPayout = calculatePayout();
        dashboard.totalPaidThisCycle = cycleTotalCollected[currentCycle];
        
        // CRITICAL FIX: Use proper payout ready check
        dashboard.isPayoutReady = _isPayoutReadyInternal();
        
        // Use cyclePaidMembers directly - it's accurate
        dashboard.membersPaid = cyclePaidMembers[currentCycle];
        
        // Calculate remaining to pay
        TokenConfig memory config = tokenConfigs[activePaymentToken];
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        uint256 expectedTotal = config.monthlyPayment * totalMembers;
        dashboard.remainingToPay = expectedTotal > dashboard.totalPaidThisCycle 
            ? expectedTotal - dashboard.totalPaidThisCycle 
            : 0;
        
        // Get unpaid members using hasPaidInCycle
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
    
    /**
     * @dev Get upcoming events for a member (payments due, payouts, etc.)
     * FIXED: Uses hasPaidInCycle for accurate payment status
     * @param member Address of the member
     * @return events Array of upcoming events
     */
    function getUpcomingEvents(address member) external view override returns (UpcomingEvent[] memory events) {
        Member memory memberInfo = membersContract.getMember(member);
        if (!memberInfo.isActive) {
            return new UpcomingEvent[](0);
        }
        
        uint256 duration = getCycleDuration(); // Get from AjoCore
        uint256 eventCount = 0;
        UpcomingEvent[] memory tempEvents = new UpcomingEvent[](3);
        
        // Event 1 - Payment due (if not paid yet)
        if (!hasPaidInCycle[currentCycle][member]) {
            TokenConfig memory config = tokenConfigs[activePaymentToken];
            tempEvents[eventCount] = UpcomingEvent({
                eventType: 0,
                timestamp: cycleStartTime + duration,
                affectedMember: member,
                amount: config.monthlyPayment + pendingPenalties[member]
            });
            eventCount++;
        }
        
        // Event 2: Payout if member is next in queue
        if (memberInfo.queueNumber == nextPayoutPosition && !memberInfo.hasReceivedPayout) {
            tempEvents[eventCount] = UpcomingEvent({
                eventType: 1,
                timestamp: block.timestamp,
                affectedMember: member,
                amount: calculatePayout()
            });
            eventCount++;
        }
        
        // Event 3: Cycle end
        tempEvents[eventCount] = UpcomingEvent({
            eventType: 2,
            timestamp: cycleStartTime + duration,
            affectedMember: address(0),
            amount: 0
        });
        eventCount++;
        
        // Copy to correctly sized array
        events = new UpcomingEvent[](eventCount);
        for (uint256 i = 0; i < eventCount; i++) {
            events[i] = tempEvents[i];
        }
    }
    
    /**
     * @dev Get the deadline for next payment
     * @return timestamp Unix timestamp of payment deadline
     */
    function getNextPaymentDeadline() external view override returns (uint256 timestamp) {
        uint256 duration = getCycleDuration(); // Get from AjoCore
        return cycleStartTime + duration;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function updatePenaltyRate(uint256 newPenaltyRate) external onlyAjoCore {
        require(newPenaltyRate <= 2000, "Penalty rate too high"); // Max 20%
        penaltyRate = newPenaltyRate;
    }
    
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external onlyAjoCore {
        tokenConfigs[token].monthlyPayment = monthlyPayment;
        tokenConfigs[token].isActive = isActive;
    }
    
    /**
     * @dev Advance to next cycle
     * CRITICAL: Can be called externally by AjoCore OR internally by distributePayout()
     * Protected against double advancement in same transaction
     */
    function advanceCycle() public onlyAjoCore {
        require(!_cycleAdvancing, "Cycle already advancing");
        _cycleAdvancing = true;
        
        // Emit cycle summary before advancing
        emit CycleSummary(
            currentCycle,
            cycleTotalCollected[currentCycle],
            cyclePaidMembers[currentCycle].length,
            block.timestamp
        );
        
        // CRITICAL: Increment cycle - this automatically resets payment tracking
        // because hasPaidInCycle[newCycle][member] will all be false
        currentCycle++;
        cycleStartTime = block.timestamp;
        
        // Reset cycle completion flag for new cycle
        // Note: cycleCompleted[oldCycle] remains true (historical record)
        
        emit CycleAdvanced(currentCycle, block.timestamp);
        
        _cycleAdvancing = false;
    }
    
    function updateNextPayoutPosition(uint256 position) external onlyAjoCore {
        nextPayoutPosition = position;
    }
    
    // ============ BATCH PROCESSING ============
    
    function batchHandleDefaults(address[] calldata defaulters) external onlyAjoCore {
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            Member memory member = membersContract.getMember(defaulter);
            
            // FIXED: Use hasPaidInCycle for accurate default check
            if (member.isActive && !hasPaidInCycle[currentCycle][defaulter]) {
                uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
                TokenConfig memory config = tokenConfigs[member.preferredToken];
                uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
                
                pendingPenalties[defaulter] += penalty;
                membersContract.incrementDefaultCount(defaulter);
                
                emit MemberDefaulted(defaulter, currentCycle, penalty);
            }
        }
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getCurrentCycle() external view returns (uint256) {
        return currentCycle;
    }
    
    function getNextPayoutPosition() external view returns (uint256) {
        return nextPayoutPosition;
    }
    
    function getActivePaymentToken() external view returns (PaymentToken) {
        return activePaymentToken;
    }
    
    function getPayout(uint256 cycle) external view returns (PayoutRecord memory) {
        return payouts[cycle];
    }
    
    function getPendingPenalty(address member) external view returns (uint256) {
        return pendingPenalties[member];
    }
    
    function getPenaltyRate() external view returns (uint256) {
        return penaltyRate;
    }
    
    function getContractBalance(PaymentToken token) external view returns (uint256) {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        return tokenContract.balanceOf(address(this));
    }
    
    function getTotalPayouts() external view returns (uint256) {
        return currentCycle > 1 ? currentCycle - 1 : 0;
    }

    function getCycleDuration() public view returns (uint256) {
        return IAjoCore(ajoCore).getCycleDuration();
    }
    
    /**
     * @dev NEW GETTER: Check if a member has paid in the current cycle
     * This exposes the same hasPaidInCycle mapping used by getCurrentCycleDashboard
     * @param member Address of the member to check
     * @return bool True if member has paid in current cycle
     */
    function hasMemberPaidInCycle(address member) external override view returns (bool) {
        return hasPaidInCycle[currentCycle][member];
    }
    
    /**
     * @dev Internal helper for payout ready check
     * FIXED: Simplified logic, removed member count check
     */
    function _isPayoutReadyInternal() internal view returns (bool) {
        // Check if cycle already completed
        if (cycleCompleted[currentCycle]) return false;
        
        address nextRecipient = getNextRecipient();
        
        // No eligible recipient
        if (nextRecipient == address(0)) return false;
        
        // Check payout amount is calculable
        uint256 payout = calculatePayout();
        if (payout == 0) return false;
        
        // FIXED: Verify ALL members have paid this cycle using hasPaidInCycle
        address[] memory allMembers = membersContract.getActiveMembersList();
        
        for (uint256 i = 0; i < allMembers.length; i++) {
            address member = allMembers[i];
            
            // Check if this member has paid using hasPaidInCycle mapping
            if (!hasPaidInCycle[currentCycle][member]) {
                return false; // Not all members have paid
            }
        }
        
        return true;
    }
    
  /**
    * @dev Check if payout is ready to be distributed
    * @return bool Whether payout can be distributed
    * 
    * FIXED: Uses hasPaidInCycle for accurate payment verification
    */
    function isPayoutReady() external view returns (bool) {
        return _isPayoutReadyInternal();
    }

    /**
    * @dev Get payment status for multiple members in current cycle (BATCH OPTIMIZATION)
    * @param members Array of member addresses to check
    * @return statuses Array of booleans indicating payment status
    */
    function batchCheckPaymentStatus(address[] calldata members) 
        external 
        view 
        returns (bool[] memory statuses) 
    {
        statuses = new bool[](members.length);
        
        for (uint256 i = 0; i < members.length; i++) {
            statuses[i] = hasPaidInCycle[currentCycle][members[i]];
        }
    }

    /**
    * @dev Get payment status for ALL active members (SINGLE CALL)
    * @return members Array of member addresses
    * @return statuses Array of payment statuses
    */
    function getAllMembersPaymentStatus() 
        external 
        view 
        returns (address[] memory members, bool[] memory statuses) 
    {
        members = membersContract.getActiveMembersList();
        statuses = new bool[](members.length);
        
        for (uint256 i = 0; i < members.length; i++) {
            statuses[i] = hasPaidInCycle[currentCycle][members[i]];
        }
    }

    // ============ EMERGENCY FUNCTIONS ============
    
    function emergencyWithdraw(PaymentToken token) external onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        uint256 balance = tokenContract.balanceOf(address(this));
        tokenContract.transfer(ajoCore, balance);
    }


    /**
 * @dev Get all members who are currently in default (after deadline)
 * @notice This function is called by the Defender Autotask
 * @return defaulters Array of addresses that missed payment deadline
 */
function getMembersInDefault() external override view returns (address[] memory defaulters) {
    // Check if we're past the payment deadline
    uint256 deadline = this.getNextPaymentDeadline();
    
    // If deadline hasn't passed, no one is in default yet
    if (block.timestamp <= deadline) {
        return new address[](0);
    }
    
    // Get all active members
    address[] memory allMembers = membersContract.getActiveMembersList();
    uint256 defaultCount = 0;
    
    // First pass: count how many members are in default
    for (uint256 i = 0; i < allMembers.length; i++) {
        Member memory member = membersContract.getMember(allMembers[i]);
        
        // Check if member hasn't paid this cycle
        if (member.isActive && member.lastPaymentCycle < currentCycle) {
            defaultCount++;
        }
    }
    
    // If no defaults, return empty array
    if (defaultCount == 0) {
        return new address[](0);
    }
    
    // Second pass: build array of defaulters
    defaulters = new address[](defaultCount);
    uint256 index = 0;
    
    for (uint256 i = 0; i < allMembers.length; i++) {
        Member memory member = membersContract.getMember(allMembers[i]);
        
        if (member.isActive && member.lastPaymentCycle < currentCycle) {
            defaulters[index] = allMembers[i];
            index++;
        }
    }
    
    return defaulters;
}

/**
 * @dev Check if deadline has passed for current cycle
 * @return isPastDeadline Whether the payment deadline has been exceeded
 * @return secondsOverdue How many seconds past deadline (0 if not past)
 */
function isDeadlinePassed() external override view returns (bool isPastDeadline, uint256 secondsOverdue) {
    uint256 deadline = this.getNextPaymentDeadline();
    
    if (block.timestamp > deadline) {
        isPastDeadline = true;
        secondsOverdue = block.timestamp - deadline;
    } else {
        isPastDeadline = false;
        secondsOverdue = 0;
    }
    
    return (isPastDeadline, secondsOverdue);
}

/**
 * @dev Get comprehensive default status for automation
 * @return isPastDeadline Whether deadline has passed
 * @return defaultersCount Number of members in default
 * @return defaulters Array of defaulter addresses
 * @return currentCycleNum Current cycle number
 * @return deadlineTimestamp Payment deadline timestamp
 */
function getDefaultStatus() external view returns (
    bool isPastDeadline,
    uint256 defaultersCount,
    address[] memory defaulters,
    uint256 currentCycleNum,
    uint256 deadlineTimestamp
) {
    deadlineTimestamp = this.getNextPaymentDeadline();
    isPastDeadline = block.timestamp > deadlineTimestamp;
    currentCycleNum = currentCycle;
    
    if (isPastDeadline) {
        defaulters = this.getMembersInDefault();
        defaultersCount = defaulters.length;
    } else {
        defaulters = new address[](0);
        defaultersCount = 0;
    }
    
    return (isPastDeadline, defaultersCount, defaulters, currentCycleNum, deadlineTimestamp);
}

/**
 * @dev Emergency function to manually advance stuck cycle (admin only)
 * @notice Only callable by AjoCore after thorough checks
 */
function forceAdvanceCycle() external onlyAjoCore {
    require(block.timestamp > cycleStartTime + cycleDuration + 7 days, "Cycle not stuck yet");
    advanceCycle();
    emit CycleForceAdvanced(currentCycle, block.timestamp, msg.sender);
}


}