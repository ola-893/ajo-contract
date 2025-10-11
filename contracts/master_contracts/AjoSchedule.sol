// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;



import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/AjoInterfaces.sol";

/**
 * @title AjoSchedule
 * @notice Dedicated contract for Hedera Schedule Service (HSS) integration
 * @dev Manages automated payment scheduling and governance action scheduling
 * 
 * Features:
 * - Payment scheduling with HSS
 * - Batch and rolling payment schedules
 * - Governance proposal scheduling
 * - Schedule authorization and execution
 * - Comprehensive tracking and analytics
 */
contract AjoSchedule is IAjoSchedule, ReentrancyGuard, Ownable, Initializable {
    
    // ============ STATE VARIABLES ============
    
    address public ajoCore;
    address public ajoPayments;
    address public ajoGovernance;
    address public hederaScheduleService; // 0x16b
    
    bool public schedulingEnabled;
    uint256 public maxSchedulesPerCycle;
    uint256 public minExecutionDelay;
    uint256 public maxExecutionDelay;
    
    // Storage for scheduled payments
    mapping(address => ScheduledPayment) public scheduledPayments;
    mapping(uint256 => address[]) private cycleScheduledPayments;
    mapping(address => address[]) private memberScheduledPayments;
    address[] private allScheduledPaymentAddresses;
    
    // Storage for scheduled governance actions
    mapping(address => ScheduledGovernanceAction) public scheduledGovernanceActions;
    mapping(uint256 => address[]) private proposalScheduledActions;
    address[] private allScheduledGovernanceAddresses;
    
    // Storage for schedule signatures
    mapping(address => ScheduleSignature[]) private scheduleSignatures;
    
    // Statistics
    uint256 public totalScheduledPayments;
    uint256 public totalExecutedPayments;
    uint256 public totalCanceledPayments;
    uint256 public totalExpiredPayments;
    uint256 public totalScheduledProposals;
    uint256 public totalExecutedProposals;
    uint256 public totalCanceledProposals;
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    modifier onlyAjoPayments() {
        require(msg.sender == ajoPayments, "Only AjoPayments");
        _;
    }
    
    modifier onlyAjoGovernance() {
        require(msg.sender == ajoGovernance, "Only AjoGovernance");
        _;
    }
    
    modifier whenSchedulingEnabled() {
        require(schedulingEnabled, "Scheduling disabled");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER ============
    
    function initialize(
        address _ajoCore,
        address _ajoPayments,
        address _ajoGovernance,
        address _hederaScheduleService
    ) external override initializer {
        require(_ajoCore != address(0), "Invalid AjoCore");
        require(_ajoPayments != address(0), "Invalid AjoPayments");
        require(_ajoGovernance != address(0), "Invalid AjoGovernance");
        require(_hederaScheduleService != address(0), "Invalid HSS");
        
        _transferOwnership(msg.sender);
        
        ajoCore = _ajoCore;
        ajoPayments = _ajoPayments;
        ajoGovernance = _ajoGovernance;
        hederaScheduleService = _hederaScheduleService;
        
        schedulingEnabled = true;
        maxSchedulesPerCycle = 100;
        minExecutionDelay = 1 hours;
        maxExecutionDelay = 62 days; // HSS limit
    }
    
    // ============ PAYMENT SCHEDULING FUNCTIONS ============
    
    function schedulePayment(
        uint256 cycle,
        uint256 executionTime,
        address member,
        uint256 amount,
        PaymentToken token
    ) external override onlyAjoPayments whenSchedulingEnabled returns (address scheduleAddress) {
        require(executionTime > block.timestamp, "Execution time must be in future");
        require(executionTime >= block.timestamp + minExecutionDelay, "Below minimum delay");
        require(executionTime <= block.timestamp + maxExecutionDelay, "Exceeds maximum delay");
        require(cycleScheduledPayments[cycle].length < maxSchedulesPerCycle, "Max schedules per cycle reached");
        
        // Generate schedule address (mock - in production would interact with HSS)
        scheduleAddress = address(uint160(uint256(keccak256(abi.encodePacked(
            address(this),
            cycle,
            executionTime,
            member,
            amount,
            block.timestamp
        )))));
        
        // Create scheduled payment
        scheduledPayments[scheduleAddress] = ScheduledPayment({
            scheduleAddress: scheduleAddress,
            cycle: cycle,
            executionTime: executionTime,
            amount: amount,
            recipient: member,
            token: token,
            isExecuted: false,
            isCanceled: false,
            isExpired: false,
            signaturesCollected: 0,
            signaturesRequired: 1,
            createdAt: block.timestamp,
            creator: msg.sender
        });
        
        // Track schedule
        cycleScheduledPayments[cycle].push(scheduleAddress);
        memberScheduledPayments[member].push(scheduleAddress);
        allScheduledPaymentAddresses.push(scheduleAddress);
        totalScheduledPayments++;
        
        emit PaymentScheduled(scheduleAddress, cycle, executionTime, member, amount, token);
        
        return scheduleAddress;
    }
    
    function scheduleMultiplePayments(
        uint256[] calldata cycles,
        uint256[] calldata executionTimes,
        address[] calldata members,
        uint256[] calldata amounts,
        PaymentToken token
    ) external override onlyAjoPayments whenSchedulingEnabled returns (address[] memory scheduleAddresses) {
        require(cycles.length == executionTimes.length, "Length mismatch: cycles/executionTimes");
        require(cycles.length == members.length, "Length mismatch: cycles/members");
        require(cycles.length == amounts.length, "Length mismatch: cycles/amounts");
        
        scheduleAddresses = new address[](cycles.length);
        
        for (uint256 i = 0; i < cycles.length; i++) {
            scheduleAddresses[i] = this.schedulePayment(
                cycles[i],
                executionTimes[i],
                members[i],
                amounts[i],
                token
            );
        }
        
        return scheduleAddresses;
    }
    
    function scheduleRollingPayments(
        uint256 startCycle,
        uint256 numberOfCycles,
        uint256 intervalDays,
        address member,
        uint256 amount,
        PaymentToken token
    ) external override onlyAjoPayments whenSchedulingEnabled returns (address[] memory scheduleAddresses) {
        require(numberOfCycles > 0, "Must schedule at least one cycle");
        require(intervalDays > 0, "Interval must be positive");
        
        scheduleAddresses = new address[](numberOfCycles);
        
        for (uint256 i = 0; i < numberOfCycles; i++) {
            uint256 cycle = startCycle + i;
            uint256 executionTime = block.timestamp + (intervalDays * 1 days * (i + 1));
            
            scheduleAddresses[i] = this.schedulePayment(
                cycle,
                executionTime,
                member,
                amount,
                token
            );
        }
        
        return scheduleAddresses;
    }
    
    function schedulePayout(
        uint256 cycle,
        uint256 executionTime,
        address recipient,
        uint256 amount,
        PaymentToken token
    ) external override onlyAjoPayments whenSchedulingEnabled returns (address scheduleAddress) {
        require(executionTime > block.timestamp, "Execution time must be in future");
        require(executionTime >= block.timestamp + minExecutionDelay, "Below minimum delay");
        require(executionTime <= block.timestamp + maxExecutionDelay, "Exceeds maximum delay");
        
        // Generate schedule address
        scheduleAddress = address(uint160(uint256(keccak256(abi.encodePacked(
            address(this),
            "payout",
            cycle,
            executionTime,
            recipient,
            amount,
            block.timestamp
        )))));
        
        // Create scheduled payout
        scheduledPayments[scheduleAddress] = ScheduledPayment({
            scheduleAddress: scheduleAddress,
            cycle: cycle,
            executionTime: executionTime,
            amount: amount,
            recipient: recipient,
            token: token,
            isExecuted: false,
            isCanceled: false,
            isExpired: false,
            signaturesCollected: 0,
            signaturesRequired: 1,
            createdAt: block.timestamp,
            creator: msg.sender
        });
        
        // Track schedule
        cycleScheduledPayments[cycle].push(scheduleAddress);
        allScheduledPaymentAddresses.push(scheduleAddress);
        totalScheduledPayments++;
        
        emit PayoutScheduled(scheduleAddress, cycle, executionTime, recipient, amount, token);
        
        return scheduleAddress;
    }
    
    // ============ GOVERNANCE SCHEDULING FUNCTIONS ============
    
    function scheduleProposalExecution(
        uint256 proposalId,
        uint256 executionTime
    ) external override onlyAjoGovernance whenSchedulingEnabled returns (address scheduleAddress) {
        require(executionTime > block.timestamp, "Execution time must be in future");
        require(executionTime >= block.timestamp + minExecutionDelay, "Below minimum delay");
        require(executionTime <= block.timestamp + maxExecutionDelay, "Exceeds maximum delay");
        
        // Generate schedule address
        scheduleAddress = address(uint160(uint256(keccak256(abi.encodePacked(
            address(this),
            "proposal",
            proposalId,
            executionTime,
            block.timestamp
        )))));
        
        // Create scheduled governance action
        scheduledGovernanceActions[scheduleAddress] = ScheduledGovernanceAction({
            proposalId: proposalId,
            scheduleAddress: scheduleAddress,
            executionTime: executionTime,
            isExecuted: false,
            isCanceled: false
        });
        
        // Track schedule
        proposalScheduledActions[proposalId].push(scheduleAddress);
        allScheduledGovernanceAddresses.push(scheduleAddress);
        totalScheduledProposals++;
        
        emit ProposalScheduled(proposalId, scheduleAddress, executionTime);
        
        return scheduleAddress;
    }
    
    function scheduleGovernanceAction(
        uint256 proposalId,
        uint256 executionTime,
        bytes memory actionData
    ) external override onlyAjoGovernance whenSchedulingEnabled returns (address scheduleAddress) {
        require(executionTime > block.timestamp, "Execution time must be in future");
        require(executionTime >= block.timestamp + minExecutionDelay, "Below minimum delay");
        require(executionTime <= block.timestamp + maxExecutionDelay, "Exceeds maximum delay");
        
        // Generate schedule address
        scheduleAddress = address(uint160(uint256(keccak256(abi.encodePacked(
            address(this),
            "governance_action",
            proposalId,
            executionTime,
            actionData,
            block.timestamp
        )))));
        
        // Create scheduled governance action
        scheduledGovernanceActions[scheduleAddress] = ScheduledGovernanceAction({
            proposalId: proposalId,
            scheduleAddress: scheduleAddress,
            executionTime: executionTime,
            isExecuted: false,
            isCanceled: false
        });
        
        // Track schedule
        proposalScheduledActions[proposalId].push(scheduleAddress);
        allScheduledGovernanceAddresses.push(scheduleAddress);
        totalScheduledProposals++;
        
        emit GovernanceActionScheduled(proposalId, scheduleAddress, executionTime);
        
        return scheduleAddress;
    }
    
    // ============ AUTHORIZATION & EXECUTION FUNCTIONS ============
    
    function authorizeSchedule(
        address scheduleAddress
    ) external override returns (int64 responseCode) {
        ScheduledPayment storage scheduled = scheduledPayments[scheduleAddress];
        require(scheduled.scheduleAddress != address(0), "Schedule not found");
        require(!scheduled.isExecuted, "Already executed");
        require(!scheduled.isCanceled, "Already canceled");
        require(!scheduled.isExpired, "Schedule expired");
        
        // Record signature
        scheduleSignatures[scheduleAddress].push(ScheduleSignature({
            signer: msg.sender,
            timestamp: block.timestamp,
            isContractKey: msg.sender == ajoCore || msg.sender == ajoPayments
        }));
        
        scheduled.signaturesCollected++;
        
        // Mock HSS response (in production would call IHederaScheduleService)
        responseCode = 22; // SUCCESS
        
        emit ScheduleAuthorized(
            scheduleAddress,
            msg.sender,
            scheduled.signaturesCollected,
            scheduled.signaturesRequired
        );
        
        return responseCode;
    }
    
    function executeSchedule(
        address scheduleAddress
    ) external override nonReentrant returns (bool success, bytes memory returnData) {
        ScheduledPayment storage scheduled = scheduledPayments[scheduleAddress];
        require(scheduled.scheduleAddress != address(0), "Schedule not found");
        require(!scheduled.isExecuted, "Already executed");
        require(!scheduled.isCanceled, "Schedule canceled");
        require(block.timestamp >= scheduled.executionTime, "Not yet executable");
        require(scheduled.signaturesCollected >= scheduled.signaturesRequired, "Insufficient signatures");
        
        // Mark as executed
        scheduled.isExecuted = true;
        totalExecutedPayments++;
        
        // Mock execution (in production would execute actual payment)
        success = true;
        returnData = abi.encode(scheduled.amount);
        
        emit ScheduleExecuted(scheduleAddress, success, returnData);
        
        return (success, returnData);
    }
    
    function cancelSchedule(address scheduleAddress) external override {
        require(
            msg.sender == ajoCore || 
            msg.sender == ajoPayments || 
            msg.sender == owner(),
            "Unauthorized"
        );
        
        ScheduledPayment storage scheduled = scheduledPayments[scheduleAddress];
        
        if (scheduled.scheduleAddress != address(0)) {
            require(!scheduled.isExecuted, "Already executed");
            require(!scheduled.isCanceled, "Already canceled");
            
            scheduled.isCanceled = true;
            totalCanceledPayments++;
            
            emit ScheduleCanceled(scheduleAddress, msg.sender, "Canceled by admin");
            return;
        }
        
        ScheduledGovernanceAction storage governance = scheduledGovernanceActions[scheduleAddress];
        
        if (governance.scheduleAddress != address(0)) {
            require(!governance.isExecuted, "Already executed");
            require(!governance.isCanceled, "Already canceled");
            
            governance.isCanceled = true;
            totalCanceledProposals++;
            
            emit ScheduleCanceled(scheduleAddress, msg.sender, "Governance action canceled");
            return;
        }
        
        revert("Schedule not found");
    }
    
    function deleteSchedule(address scheduleAddress) external override onlyOwner {
        ScheduledPayment storage scheduled = scheduledPayments[scheduleAddress];
        
        if (scheduled.scheduleAddress != address(0)) {
            require(
                scheduled.isExecuted || 
                scheduled.isCanceled || 
                block.timestamp > scheduled.executionTime + 30 days,
                "Cannot delete active schedule"
            );
            
            delete scheduledPayments[scheduleAddress];
            delete scheduleSignatures[scheduleAddress];
            
            emit ScheduleDeleted(scheduleAddress, msg.sender);
            return;
        }
        
        ScheduledGovernanceAction storage governance = scheduledGovernanceActions[scheduleAddress];
        
        if (governance.scheduleAddress != address(0)) {
            require(
                governance.isExecuted || 
                governance.isCanceled || 
                block.timestamp > governance.executionTime + 30 days,
                "Cannot delete active schedule"
            );
            
            delete scheduledGovernanceActions[scheduleAddress];
            
            emit ScheduleDeleted(scheduleAddress, msg.sender);
            return;
        }
        
        revert("Schedule not found");
    }
    
    // ============ BATCH OPERATIONS ============
    
    function batchAuthorizeSchedules(
        address[] calldata scheduleAddresses
    ) external override returns (int64[] memory responseCodes) {
        responseCodes = new int64[](scheduleAddresses.length);
        
        for (uint256 i = 0; i < scheduleAddresses.length; i++) {
            responseCodes[i] = this.authorizeSchedule(scheduleAddresses[i]);
        }
        
        return responseCodes;
    }
    
    function batchCancelSchedules(address[] calldata scheduleAddresses) external override {
        require(
            msg.sender == ajoCore || 
            msg.sender == ajoPayments || 
            msg.sender == owner(),
            "Unauthorized"
        );
        
        for (uint256 i = 0; i < scheduleAddresses.length; i++) {
            this.cancelSchedule(scheduleAddresses[i]);
        }
    }
    
    // ============ QUERY FUNCTIONS - PAYMENT SCHEDULES ============
    
    function getScheduledPayment(
        address scheduleAddress
    ) external view override returns (ScheduledPayment memory) {
        return scheduledPayments[scheduleAddress];
    }
    
    function getAllScheduledPayments() 
        external 
        view 
        override 
        returns (ScheduledPayment[] memory) 
    {
        ScheduledPayment[] memory payments = new ScheduledPayment[](allScheduledPaymentAddresses.length);
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            payments[i] = scheduledPayments[allScheduledPaymentAddresses[i]];
        }
        
        return payments;
    }
    
    function getActiveScheduledPayments() 
        external 
        view 
        override 
        returns (ScheduledPayment[] memory) 
    {
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (!payment.isExecuted && !payment.isCanceled && !payment.isExpired) {
                activeCount++;
            }
        }
        
        ScheduledPayment[] memory activePayments = new ScheduledPayment[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (!payment.isExecuted && !payment.isCanceled && !payment.isExpired) {
                activePayments[index] = payment;
                index++;
            }
        }
        
        return activePayments;
    }
    
    function getScheduledPaymentsForCycle(
        uint256 cycle
    ) external view override returns (ScheduledPayment[] memory) {
        address[] memory addresses = cycleScheduledPayments[cycle];
        ScheduledPayment[] memory payments = new ScheduledPayment[](addresses.length);
        
        for (uint256 i = 0; i < addresses.length; i++) {
            payments[i] = scheduledPayments[addresses[i]];
        }
        
        return payments;
    }
    
    function getScheduledPaymentsForMember(
        address member
    ) external view override returns (ScheduledPayment[] memory) {
        address[] memory addresses = memberScheduledPayments[member];
        ScheduledPayment[] memory payments = new ScheduledPayment[](addresses.length);
        
        for (uint256 i = 0; i < addresses.length; i++) {
            payments[i] = scheduledPayments[addresses[i]];
        }
        
        return payments;
    }
    
    function getUpcomingSchedules(
        uint256 timeframe
    ) external view override returns (ScheduledPayment[] memory) {
        uint256 upcomingCount = 0;
        uint256 deadline = block.timestamp + timeframe;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (!payment.isExecuted && 
                !payment.isCanceled && 
                payment.executionTime <= deadline &&
                payment.executionTime > block.timestamp) {
                upcomingCount++;
            }
        }
        
        ScheduledPayment[] memory upcoming = new ScheduledPayment[](upcomingCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (!payment.isExecuted && 
                !payment.isCanceled && 
                payment.executionTime <= deadline &&
                payment.executionTime > block.timestamp) {
                upcoming[index] = payment;
                index++;
            }
        }
        
        return upcoming;
    }
    
    function getPendingSchedules() 
        external 
        view 
        override 
        returns (ScheduledPayment[] memory) 
    {
        uint256 pendingCount = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (!payment.isExecuted && 
                !payment.isCanceled && 
                payment.executionTime <= block.timestamp &&
                payment.signaturesCollected >= payment.signaturesRequired) {
                pendingCount++;
            }
        }
        
        ScheduledPayment[] memory pending = new ScheduledPayment[](pendingCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (!payment.isExecuted && 
                !payment.isCanceled && 
                payment.executionTime <= block.timestamp &&
                payment.signaturesCollected >= payment.signaturesRequired) {
                pending[index] = payment;
                index++;
            }
        }
        
        return pending;
    }
    
    function getExecutedSchedules(
        uint256 offset,
        uint256 limit
    ) external view override returns (ScheduledPayment[] memory) {
        uint256 executedCount = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            if (scheduledPayments[allScheduledPaymentAddresses[i]].isExecuted) {
                executedCount++;
            }
        }
        
        uint256 resultSize = executedCount > offset ? executedCount - offset : 0;
        resultSize = resultSize > limit ? limit : resultSize;
        
        ScheduledPayment[] memory executed = new ScheduledPayment[](resultSize);
        uint256 index = 0;
        uint256 skipped = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length && index < resultSize; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (payment.isExecuted) {
                if (skipped >= offset) {
                    executed[index] = payment;
                    index++;
                } else {
                    skipped++;
                }
            }
        }
        
        return executed;
    }
    
    // ============ QUERY FUNCTIONS - GOVERNANCE SCHEDULES ============
    
    function getScheduledProposal(
        address scheduleAddress
    ) external view override returns (ScheduledGovernanceAction memory) {
        return scheduledGovernanceActions[scheduleAddress];
    }
    
    function getAllScheduledProposals() 
        external 
        view 
        override 
        returns (ScheduledGovernanceAction[] memory) 
    {
        ScheduledGovernanceAction[] memory proposals = new ScheduledGovernanceAction[](allScheduledGovernanceAddresses.length);
        
        for (uint256 i = 0; i < allScheduledGovernanceAddresses.length; i++) {
            proposals[i] = scheduledGovernanceActions[allScheduledGovernanceAddresses[i]];
        }
        
        return proposals;
    }
    
    function getScheduledProposalsForProposalId(
        uint256 proposalId
    ) external view override returns (ScheduledGovernanceAction[] memory) {
        address[] memory addresses = proposalScheduledActions[proposalId];
        ScheduledGovernanceAction[] memory proposals = new ScheduledGovernanceAction[](addresses.length);
        
        for (uint256 i = 0; i < addresses.length; i++) {
            proposals[i] = scheduledGovernanceActions[addresses[i]];
        }
        
        return proposals;
    }
    
    // ============ QUERY FUNCTIONS - SCHEDULE DETAILS ============
    
    function getScheduleInfo(
        address scheduleAddress
    ) external view override returns (ScheduleInfo memory) {
        ScheduledPayment memory payment = scheduledPayments[scheduleAddress];
        
        if (payment.scheduleAddress != address(0)) {
            return ScheduleInfo({
                scheduleId: scheduleAddress,
                scheduledTransactionId: scheduleAddress,
                payerAccountId: payment.creator,
                creatorAccountId: payment.creator,
                scheduledTransactionBody: bytes32(uint256(uint160(scheduleAddress))),
                signatories: KeyList({keys: new address[](0)}),
                adminKey: ajoCore,
                memo: "Ajo Payment Schedule",
                expirationTime: int64(uint64(payment.executionTime + 30 days)),
                executedTime: payment.isExecuted ? int64(uint64(block.timestamp)) : int64(0),
                deletedTime: int64(0),
                waitForExpiry: false
            });
        }
        
        revert("Schedule not found");
    }
    
    function isScheduleReady(
        address scheduleAddress
    ) external view override returns (bool) {
        ScheduledPayment memory payment = scheduledPayments[scheduleAddress];
        
        if (payment.scheduleAddress != address(0)) {
            return !payment.isExecuted &&
                   !payment.isCanceled &&
                   !payment.isExpired &&
                   block.timestamp >= payment.executionTime &&
                   payment.signaturesCollected >= payment.signaturesRequired;
        }
        
        ScheduledGovernanceAction memory governance = scheduledGovernanceActions[scheduleAddress];
        
        if (governance.scheduleAddress != address(0)) {
            return !governance.isExecuted &&
                   !governance.isCanceled &&
                   block.timestamp >= governance.executionTime;
        }
        
        return false;
    }
    
    function isScheduleExpired(
        address scheduleAddress
    ) external view override returns (bool) {
        ScheduledPayment memory payment = scheduledPayments[scheduleAddress];
        
        if (payment.scheduleAddress != address(0)) {
            return payment.isExpired || 
                   (!payment.isExecuted && 
                    !payment.isCanceled && 
                    block.timestamp > payment.executionTime + 30 days);
        }
        
        ScheduledGovernanceAction memory governance = scheduledGovernanceActions[scheduleAddress];
        
        if (governance.scheduleAddress != address(0)) {
            return !governance.isExecuted && 
                   !governance.isCanceled && 
                   block.timestamp > governance.executionTime + 30 days;
        }
        
        return false;
    }
    
    function hasScheduleForCycle(uint256 cycle) external view override returns (bool) {
        return cycleScheduledPayments[cycle].length > 0;
    }
    
    function getScheduleSignatures(
        address scheduleAddress
    ) external view override returns (ScheduleSignature[] memory) {
        return scheduleSignatures[scheduleAddress];
    }
    
    function getScheduleProgress(
        address scheduleAddress
    ) external view override returns (
        uint256 collected,
        uint256 required,
        bool isReady
    ) {
        ScheduledPayment memory payment = scheduledPayments[scheduleAddress];
        
        if (payment.scheduleAddress != address(0)) {
            collected = payment.signaturesCollected;
            required = payment.signaturesRequired;
            isReady = collected >= required && 
                     block.timestamp >= payment.executionTime &&
                     !payment.isExecuted &&
                     !payment.isCanceled;
            return (collected, required, isReady);
        }
        
        return (0, 0, false);
    }
    
    // ============ STATISTICS & ANALYTICS ============
    
    function getScheduleStatistics() 
        external 
        view 
        override 
        returns (ScheduleStatistics memory) 
    {
        uint256 pendingSchedules = 0;
        uint256 upcomingIn24Hours = 0;
        uint256 upcomingInWeek = 0;
        
        uint256 deadline24h = block.timestamp + 24 hours;
        uint256 deadlineWeek = block.timestamp + 7 days;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            
            if (!payment.isExecuted && !payment.isCanceled && !payment.isExpired) {
                pendingSchedules++;
                
                if (payment.executionTime <= deadline24h && payment.executionTime > block.timestamp) {
                    upcomingIn24Hours++;
                }
                
                if (payment.executionTime <= deadlineWeek && payment.executionTime > block.timestamp) {
                    upcomingInWeek++;
                }
            }
        }
        
        return ScheduleStatistics({
            totalScheduled: totalScheduledPayments,
            totalExecuted: totalExecutedPayments,
            totalCanceled: totalCanceledPayments,
            totalExpired: totalExpiredPayments,
            pendingSchedules: pendingSchedules,
            upcomingIn24Hours: upcomingIn24Hours,
            upcomingInWeek: upcomingInWeek
        });
    }
    
    function getTotalScheduledAmount(
        PaymentToken token
    ) external view override returns (uint256) {
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            
            if (!payment.isExecuted && 
                !payment.isCanceled && 
                !payment.isExpired &&
                payment.token == token) {
                totalAmount += payment.amount;
            }
        }
        
        return totalAmount;
    }
    
    function getSchedulesByDateRange(
        uint256 startTime,
        uint256 endTime
    ) external view override returns (ScheduledPayment[] memory) {
        require(endTime > startTime, "Invalid date range");
        
        uint256 matchCount = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (payment.executionTime >= startTime && payment.executionTime <= endTime) {
                matchCount++;
            }
        }
        
        ScheduledPayment[] memory matches = new ScheduledPayment[](matchCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment memory payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            if (payment.executionTime >= startTime && payment.executionTime <= endTime) {
                matches[index] = payment;
                index++;
            }
        }
        
        return matches;
    }
    
    function getMemberScheduleHistory(
        address member
    ) external view override returns (ScheduledPayment[] memory) {
        address[] memory addresses = memberScheduledPayments[member];
        ScheduledPayment[] memory history = new ScheduledPayment[](addresses.length);
        
        for (uint256 i = 0; i < addresses.length; i++) {
            history[i] = scheduledPayments[addresses[i]];
        }
        
        return history;
    }
    
    // ============ CONFIGURATION FUNCTIONS ============
    
    function updateScheduleServiceAddress(
        address newAddress
    ) external override onlyOwner {
        require(newAddress != address(0), "Invalid address");
        
        address oldAddress = hederaScheduleService;
        hederaScheduleService = newAddress;
        
        emit ScheduleServiceUpdated(oldAddress, newAddress);
    }
    
    function setMaxSchedulesPerCycle(
        uint256 maxSchedules
    ) external override onlyOwner {
        require(maxSchedules > 0, "Must allow at least one schedule");
        maxSchedulesPerCycle = maxSchedules;
    }
    
    function setMinExecutionDelay(
        uint256 minDelay
    ) external override onlyOwner {
        require(minDelay < maxExecutionDelay, "Min must be less than max");
        minExecutionDelay = minDelay;
    }
    
    function setMaxExecutionDelay(
        uint256 maxDelay
    ) external override onlyOwner {
        require(maxDelay > minExecutionDelay, "Max must be greater than min");
        require(maxDelay <= 62 days, "Cannot exceed HSS 62-day limit");
        maxExecutionDelay = maxDelay;
    }
    
    function pauseScheduling() external override onlyOwner {
        require(schedulingEnabled, "Already paused");
        schedulingEnabled = false;
        emit SchedulingPaused(msg.sender);
    }
    
    function unpauseScheduling() external override onlyOwner {
        require(!schedulingEnabled, "Not paused");
        schedulingEnabled = true;
        emit SchedulingUnpaused(msg.sender);
    }
    
    // ============ HEALTH & STATUS FUNCTIONS ============
    
    function isSchedulingEnabled() external view override returns (bool) {
        return schedulingEnabled;
    }
    
    function getScheduleServiceStatus() 
        external 
        view 
        override 
        returns (
            bool isEnabled,
            address serviceAddress,
            uint256 totalScheduled,
            uint256 totalExecuted
        ) 
    {
        isEnabled = schedulingEnabled;
        serviceAddress = hederaScheduleService;
        totalScheduled = totalScheduledPayments;
        totalExecuted = totalExecutedPayments;
    }
    
    function validateScheduleAddress(
        address scheduleAddress
    ) external view override returns (bool isValid, string memory reason) {
        ScheduledPayment memory payment = scheduledPayments[scheduleAddress];
        
        if (payment.scheduleAddress != address(0)) {
            if (payment.isExecuted) {
                return (false, "Schedule already executed");
            }
            if (payment.isCanceled) {
                return (false, "Schedule canceled");
            }
            if (payment.isExpired) {
                return (false, "Schedule expired");
            }
            if (block.timestamp > payment.executionTime + 30 days) {
                return (false, "Schedule past expiration");
            }
            return (true, "Valid payment schedule");
        }
        
        ScheduledGovernanceAction memory governance = scheduledGovernanceActions[scheduleAddress];
        
        if (governance.scheduleAddress != address(0)) {
            if (governance.isExecuted) {
                return (false, "Governance action already executed");
            }
            if (governance.isCanceled) {
                return (false, "Governance action canceled");
            }
            if (block.timestamp > governance.executionTime + 30 days) {
                return (false, "Governance action past expiration");
            }
            return (true, "Valid governance schedule");
        }
        
        return (false, "Schedule not found");
    }
    
    // ============ INTERNAL HELPER FUNCTIONS ============
    
    function _markExpiredSchedules() internal {
        uint256 expirationThreshold = block.timestamp - 30 days;
        
        for (uint256 i = 0; i < allScheduledPaymentAddresses.length; i++) {
            ScheduledPayment storage payment = scheduledPayments[allScheduledPaymentAddresses[i]];
            
            if (!payment.isExecuted && 
                !payment.isCanceled && 
                !payment.isExpired &&
                payment.executionTime < expirationThreshold) {
                payment.isExpired = true;
                totalExpiredPayments++;
                emit ScheduleExpired(allScheduledPaymentAddresses[i], payment.executionTime);
            }
        }
    }
    
    // ============ MAINTENANCE FUNCTIONS ============
    
    function cleanupExpiredSchedules() external onlyOwner {
        _markExpiredSchedules();
    }
    
    function getContractStatus() 
        external 
        view 
        returns (
            bool _schedulingEnabled,
            uint256 _totalScheduled,
            uint256 _totalExecuted,
            uint256 _totalCanceled,
            uint256 _totalExpired,
            uint256 _maxPerCycle,
            uint256 _minDelay,
            uint256 _maxDelay
        ) 
    {
        return (
            schedulingEnabled,
            totalScheduledPayments,
            totalExecutedPayments,
            totalCanceledPayments,
            totalExpiredPayments,
            maxSchedulesPerCycle,
            minExecutionDelay,
            maxExecutionDelay
        );
    }
}