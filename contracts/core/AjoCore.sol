// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/AjoInterfaces.sol";

contract AjoCore is IAjoCore, ReentrancyGuard, Ownable, Initializable {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
    
    IAjoMembers public membersContract;
    IAjoCollateral public collateralContract;
    IAjoPayments public paymentsContract;
    IAjoGovernance public governanceContract;
    
    uint256 public cycleDuration;
    uint256 public constant FIXED_TOTAL_PARTICIPANTS = 10;
    
    uint256 public nextQueueNumber = 1;
    uint256 public lastCycleTimestamp;
    bool public paused;
    bool private isFirstCycleComplete;
    
    mapping(uint256 => address) public queuePositions;
    mapping(uint256 => address) public guarantorAssignments;
    address[] public activeMembersList;

    mapping(address => bool) public authorizedAutomation;
    uint256 public automationGracePeriod = 3600;
    bool public automationEnabled = true;
    bool public autoAdvanceCycleEnabled = true;
    uint256 public minCycleAdvanceDelay = 1 hours;

    // ============ EVENTS ============
    
    event CycleAdvanced(uint256 newCycle, uint256 timestamp);
    event ContractsInitialized(address members, address collateral, address payments, address governance);
    event MemberJoined(address indexed member, uint256 queueNumber, uint256 collateral, PaymentToken token);
    event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
    event AjoFull(address indexed ajoContract, uint256 timestamp);
    event CollateralTransferRequired(address indexed member, uint256 amount, PaymentToken token, address collateralContract);
    event CycleDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event MemberDefaulted(address indexed member, uint256 cycle, uint256 cyclesMissed);
    event Paused(address account);
    event Unpaused(address account);
    event AutomationAuthorized(address indexed automationAddress, bool authorized);
    event DefaultsHandledByAutomation(uint256 indexed cycle, address[] defaulters, uint256 timestamp, address indexed executor, uint256 successCount, uint256 failureCount);
    event DefaultHandlingFailed(address indexed member, uint256 indexed cycle, string reason);
    event AutomationGracePeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event AutomationToggled(bool enabled);
    event CycleAdvancedAutomatically(uint256 indexed oldCycle, uint256 indexed newCycle, address indexed advancer, uint256 timestamp, bool hadPayout);
    event CycleAdvancementFailed(uint256 indexed cycle, string reason, uint256 timestamp);
    event AutoAdvanceCycleToggled(bool enabled);
    event MinCycleAdvanceDelayUpdated(uint256 oldDelay, uint256 newDelay);

    // ============ MODIFIERS ============

    modifier onlyAuthorizedAutomation() {
        require(authorizedAutomation[msg.sender] || msg.sender == owner(), "Not authorized for automation");
        _;
    }

    modifier whenAutomationEnabled() {
        require(automationEnabled, "Automation is disabled");
        _;
    }

    // ============ ERRORS ============
    
    error InsufficientCollateral();
    error MemberAlreadyExists();
    error MemberNotFound();
    error PaymentAlreadyMade();
    error InsufficientBalance();
    error InvalidCycle();
    error PayoutNotReady();
    error TokenNotSupported();
    error Unauthorized();
    error AjoCapacityReached();
    error InvalidTokenConfiguration();
    error InsufficientCollateralBalance();
    error InsufficientAllowance();
    error CollateralTransferFailed();
    error CollateralNotTransferred();
    
    // ============ CONSTRUCTOR (for master copy) ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER (for proxy instances) ============
    
    function initialize(
        address _usdc,
        address _whbar,
        address _ajoMembers,
        address _ajoCollateral,
        address _ajoPayments,
        address _ajoGovernance
    ) external override initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_whbar != address(0), "Invalid HBAR address");
        require(_ajoMembers != address(0), "Invalid members contract");
        require(_ajoCollateral != address(0), "Invalid collateral contract");
        require(_ajoPayments != address(0), "Invalid payments contract");
        require(_ajoGovernance != address(0), "Invalid governance contract");
        
        _transferOwnership(msg.sender);
        
        USDC = IERC20(_usdc);
        HBAR = IERC20(_whbar);
        
        membersContract = IAjoMembers(_ajoMembers);
        collateralContract = IAjoCollateral(_ajoCollateral);
        paymentsContract = IAjoPayments(_ajoPayments);
        governanceContract = IAjoGovernance(_ajoGovernance);
        
        nextQueueNumber = 1;
        lastCycleTimestamp = block.timestamp;
        cycleDuration = 30 days;
        
        emit ContractsInitialized(_ajoMembers, _ajoCollateral, _ajoPayments, _ajoGovernance);
    }
    
    function joinAjo(PaymentToken tokenChoice) external override nonReentrant {        
        Member memory existingMember = membersContract.getMember(msg.sender);
        if (existingMember.isActive) revert MemberAlreadyExists();
        
        if (nextQueueNumber > FIXED_TOTAL_PARTICIPANTS) revert AjoCapacityReached();
        
        TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
        if (!config.isActive) revert TokenNotSupported();
        if (config.monthlyPayment == 0) revert InvalidTokenConfiguration();
        
        uint256 requiredCollateral = collateralContract.calculateRequiredCollateral(
            nextQueueNumber,
            config.monthlyPayment,
            FIXED_TOTAL_PARTICIPANTS
        );
        
        uint256 guarantorPos = collateralContract.calculateGuarantorPosition(
            nextQueueNumber, 
            FIXED_TOTAL_PARTICIPANTS
        );
        
        address guarantorAddr = address(0);
        if (guarantorPos > 0 && guarantorPos != nextQueueNumber) {
            address potentialGuarantor = membersContract.getQueuePosition(guarantorPos);
            if (potentialGuarantor != address(0)) {
                guarantorAddr = potentialGuarantor;
            }
        }
        
        if (requiredCollateral > 0) {
            IERC20 paymentToken = (tokenChoice == PaymentToken.USDC) ? USDC : HBAR;
            
            if (paymentToken.balanceOf(msg.sender) < requiredCollateral) {
                revert InsufficientCollateralBalance();
            }
            
            if (paymentToken.allowance(msg.sender, address(collateralContract)) >= requiredCollateral) {
                collateralContract.lockCollateral(msg.sender, requiredCollateral, tokenChoice);
            } else {
                emit CollateralTransferRequired(msg.sender, requiredCollateral, tokenChoice, address(collateralContract));
                revert CollateralNotTransferred();
            }
        }
        
        uint256 initialReputation = _calculateInitialReputation(requiredCollateral, config.monthlyPayment);
        
        uint256 newMemberGuaranteePosition = 0;
        for (uint256 i = 1; i <= FIXED_TOTAL_PARTICIPANTS; i++) {
            uint256 theirGuarantor = collateralContract.calculateGuarantorPosition(i, FIXED_TOTAL_PARTICIPANTS);
            if (theirGuarantor == nextQueueNumber) {
                newMemberGuaranteePosition = i;
                break;
            }
        }
        
        Member memory newMember = Member({
            queueNumber: nextQueueNumber,
            joinedCycle: paymentsContract.getCurrentCycle(),
            totalPaid: 0,
            requiredCollateral: requiredCollateral,
            lockedCollateral: requiredCollateral,
            lastPaymentCycle: 0,
            defaultCount: 0,
            hasReceivedPayout: false,
            isActive: true,
            guarantor: guarantorAddr,
            preferredToken: tokenChoice,
            reputationScore: initialReputation,
            pastPayments: new uint256[](0),
            guaranteePosition: newMemberGuaranteePosition
        });
        
        membersContract.addMember(msg.sender, newMember);
        
        queuePositions[nextQueueNumber] = msg.sender;
        activeMembersList.push(msg.sender);
        
        if (guarantorAddr != address(0)) {
            guarantorAssignments[nextQueueNumber] = guarantorAddr;
            emit GuarantorAssigned(msg.sender, guarantorAddr, nextQueueNumber, guarantorPos);
        }
        
        // Update bidirectional guarantor relationships
        if (newMemberGuaranteePosition > 0) {
            address memberToUpdate = membersContract.getQueuePosition(newMemberGuaranteePosition);
            
            if (memberToUpdate != address(0)) {
                Member memory existingMemberData = membersContract.getMember(memberToUpdate);
                
                if (existingMemberData.guarantor == address(0)) {
                    existingMemberData.guarantor = msg.sender;
                    membersContract.updateMember(memberToUpdate, existingMemberData);
                    guarantorAssignments[newMemberGuaranteePosition] = msg.sender;
                    emit GuarantorAssigned(memberToUpdate, msg.sender, newMemberGuaranteePosition, nextQueueNumber);
                }
            }
        }
        
        nextQueueNumber++;
        
        emit MemberJoined(msg.sender, newMember.queueNumber, requiredCollateral, tokenChoice);
        
        if (nextQueueNumber > FIXED_TOTAL_PARTICIPANTS) {
            emit AjoFull(address(this), block.timestamp);
            
            if (paymentsContract.getCurrentCycle() == 0) {
                paymentsContract.advanceCycle();
            }
        }
    }
    
    function getRequiredCollateralForJoin(PaymentToken tokenChoice) external view returns (uint256) {
        TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
        return collateralContract.calculateRequiredCollateral(
            nextQueueNumber,
            config.monthlyPayment,
            FIXED_TOTAL_PARTICIPANTS
        );
    }
    
    function processPayment() external override nonReentrant {
        Member memory member = membersContract.getMember(msg.sender);
        require(member.isActive, "Member not active");
        
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        require(member.lastPaymentCycle < currentCycle, "Already paid this cycle");
        
        TokenConfig memory config = paymentsContract.getTokenConfig(member.preferredToken);
        require(config.isActive, "Token not supported");
        require(config.monthlyPayment > 0, "Invalid payment config");
        
        paymentsContract.processPayment(msg.sender, config.monthlyPayment, member.preferredToken);
        membersContract.updateLastPaymentCycle(msg.sender, currentCycle);
    }
    
    function distributePayout() external override nonReentrant {
        paymentsContract.distributePayout();
        lastCycleTimestamp = block.timestamp;
        emit CycleAdvanced(paymentsContract.getCurrentCycle(), block.timestamp);
    }
    
    // function handleDefault(address defaulter) external override {
    //     Member memory member = membersContract.getMember(defaulter);
        
    //     if (!member.isActive) revert MemberNotFound();
        
    //     uint256 currentCycle = paymentsContract.getCurrentCycle();
    //     uint256 cyclesMissed = member.lastPaymentCycle > 0 
    //         ? currentCycle - member.lastPaymentCycle 
    //         : 1;
        
    //     if (cyclesMissed >= 1) {
    //         collateralContract.executeSeizure(defaulter);
    //         emit MemberDefaulted(defaulter, currentCycle, cyclesMissed);
    //     } else {
    //         emit MemberDefaulted(defaulter, currentCycle, cyclesMissed);
    //     }
    // }

    // function _adjustPayoutQueue() internal {
    //     uint256 totalActiveMembers = membersContract.getTotalActiveMembers();
    //     uint256 currentPayoutPos = paymentsContract.getNextPayoutPosition();
        
    //     if (currentPayoutPos > totalActiveMembers) {
    //         paymentsContract.advanceCycle();
    //     }
    // }
    
    function exitAjo() external override nonReentrant {
        Member memory member = membersContract.getMember(msg.sender);
        
        if (member.hasReceivedPayout) {
            revert Unauthorized();
        }
        
        uint256 exitPenalty = member.lockedCollateral / 10;
        uint256 returnAmount = member.lockedCollateral > exitPenalty ? member.lockedCollateral - exitPenalty : 0;
        
        membersContract.removeMember(msg.sender);
        
        if (returnAmount > 0) {
            collateralContract.unlockCollateral(msg.sender, returnAmount, member.preferredToken);
        }
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getMemberInfo(address member) 
        external 
        view 
        override
        returns (
            Member memory memberInfo, 
            uint256 pendingPenalty,
            uint256 effectiveVotingPower
        ) 
    {
        memberInfo = membersContract.getMember(member);
        pendingPenalty = paymentsContract.getPendingPenalty(member);
        effectiveVotingPower = 2;
    }
    
    function getQueueInfo(address member) 
        external 
        view 
        override
        returns (uint256 position, uint256 estimatedCyclesWait) 
    {
        return membersContract.getQueueInfo(member);
    }
    
    function needsToPayThisCycle(address member) external view override returns (bool) {
        return paymentsContract.needsToPayThisCycle(member);
    }
    
    function getContractStats() 
        external 
        view 
        override
        returns (
            uint256 totalMembers,
            uint256 activeMembers,
            uint256 totalCollateralUSDC,
            uint256 totalCollateralHBAR,
            uint256 contractBalanceUSDC,
            uint256 contractBalanceHBAR,
            uint256 currentQueuePosition,
            PaymentToken activeToken
        ) 
    {
        return membersContract.getContractStats();
    }
    
    function getTokenConfig(PaymentToken token) external view override returns (TokenConfig memory) {
        return paymentsContract.getTokenConfig(token);
    }
    
    function getCollateralDemo(uint256 participants, uint256 monthlyPayment) 
        external 
        view 
        override
        returns (
            uint256[] memory positions, 
            uint256[] memory collaterals
        ) 
    {
        positions = new uint256[](participants);
        collaterals = new uint256[](participants);
        
        for (uint256 i = 1; i <= participants; i++) {
            positions[i-1] = i;
            collaterals[i-1] = collateralContract.calculateRequiredCollateral(i, monthlyPayment, participants);
        }
    }
    
    function calculateSeizableAssets(address defaulterAddress) 
        external 
        view 
        override
        returns (
            uint256 totalSeizable, 
            uint256 collateralSeized, 
            uint256 paymentsSeized
        ) 
    {
        return collateralContract.calculateSeizableAssets(defaulterAddress);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function emergencyWithdraw(PaymentToken token) external override onlyOwner {
        collateralContract.emergencyWithdraw(token, owner(), type(uint256).max);
        paymentsContract.emergencyWithdraw(token);
    }
    
    function updateCycleDuration(uint256 newDuration) external override onlyOwner {
        require(newDuration <= 365 days, "Duration too long");
        
        uint256 oldDuration = cycleDuration;
        cycleDuration = newDuration;
        
        emit CycleDurationUpdated(oldDuration, newDuration);
    }

    function emergencyPause() external override onlyOwner {
        require(!paused, "Contract is already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    // function unpause() external onlyOwner {
    //     require(paused, "Contract is not paused");
    //     paused = false;
    //     emit Unpaused(msg.sender);
    // }
    
    // function batchHandleDefaults(address[] calldata defaulters) external override onlyOwner {
    //     paymentsContract.batchHandleDefaults(defaulters);
        
    //     uint256 currentCycle = paymentsContract.getCurrentCycle();
        
    //     for (uint256 i = 0; i < defaulters.length; i++) {
    //         address defaulter = defaulters[i];
    //         Member memory member = membersContract.getMember(defaulter);
            
    //         if (member.isActive) {
    //             governanceContract.updateReputationAndVotingPower(defaulter, false);
                
    //             uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
    //             if (cyclesMissed >= 3) {
    //                 collateralContract.executeSeizure(defaulter);
    //                 membersContract.removeMember(defaulter);
                    
    //                 if (member.guarantor != address(0)) {
    //                     membersContract.removeMember(member.guarantor);
    //                 }
    //             }
    //         }
    //     }
    // }
    
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external override onlyOwner {
        paymentsContract.updateTokenConfig(token, monthlyPayment, isActive);
    }
    
    // ============ GOVERNANCE INTEGRATION ============
    
    // function createProposal(string memory description, bytes memory proposalData) external returns (uint256) {
    //     return governanceContract.createProposal(description, proposalData);
    // }

    function getCycleDuration() external override view returns (uint256) {
        return cycleDuration;
    }
        
    // function executeProposal(uint256 proposalId) external {
    //     governanceContract.executeProposal(proposalId);
    // }
    
    // function updatePenaltyRate(uint256 newPenaltyRate) external {
    //     require(msg.sender == address(governanceContract), "Only governance");
    //     paymentsContract.updatePenaltyRate(newPenaltyRate);
    // }
    
    function _advanceCycle() internal {
        // Deprecated - cycle advancement happens in AjoPayments
    }
    
    function _calculateInitialReputation(uint256 collateral, uint256 monthlyPayment) 
        internal 
        pure 
        returns (uint256) 
    {
        if (monthlyPayment == 0) return 100;
        return 100 + ((collateral * 50) / monthlyPayment);
    }

    function paymentsContractAddress() external override view returns (IAjoPayments) {
        return paymentsContract;
    }

    // ============ AUTOMATION FUNCTIONS ============

    function setAutomationAuthorization(address automationAddress, bool authorized) 
        external 
        override
        onlyOwner 
    {
        require(automationAddress != address(0), "Invalid automation address");
        authorizedAutomation[automationAddress] = authorized;
        emit AutomationAuthorized(automationAddress, authorized);
    }

    function setAutomationEnabled(bool enabled) external override onlyOwner {
        automationEnabled = enabled;
        emit AutomationToggled(enabled);
    }

    function setAutomationGracePeriod(uint256 newGracePeriod) external onlyOwner {
        require(newGracePeriod <= 24 hours, "Grace period too long");
        uint256 oldPeriod = automationGracePeriod;
        automationGracePeriod = newGracePeriod;
        emit AutomationGracePeriodUpdated(oldPeriod, newGracePeriod);
    }

    function batchHandleDefaultsAutomated(address[] calldata defaulters) 
        external 
        onlyAuthorizedAutomation 
        whenAutomationEnabled
        nonReentrant 
        returns (uint256 successCount, uint256 failureCount)
    {
        require(defaulters.length > 0, "No defaulters provided");
        require(defaulters.length <= 20, "Batch size too large");
        
        (bool isPastDeadline, uint256 secondsOverdue) = paymentsContract.isDeadlinePassed();
        require(isPastDeadline, "Deadline not reached");
        require(secondsOverdue >= automationGracePeriod, "Grace period not elapsed");
        
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            
            try this.handleDefaultInternal(defaulter) {
                successCount++;
            } catch Error(string memory reason) {
                failureCount++;
                emit DefaultHandlingFailed(defaulter, currentCycle, reason);
            } catch {
                failureCount++;
                emit DefaultHandlingFailed(defaulter, currentCycle, "Unknown error");
            }
        }
        
        emit DefaultsHandledByAutomation(
            currentCycle,
            defaulters,
            block.timestamp,
            msg.sender,
            successCount,
            failureCount
        );
        
        return (successCount, failureCount);
    }

    function handleDefaultInternal(address defaulter) external {
        require(msg.sender == address(this), "Internal only");
        
        Member memory member = membersContract.getMember(defaulter);
        require(member.isActive, "Member not active");
        
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        require(member.lastPaymentCycle < currentCycle, "Member already paid");
        
        paymentsContract.handleDefault(defaulter);
        governanceContract.updateReputationAndVotingPower(defaulter, false);
        
        uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
        
        if (cyclesMissed >= 3) {
            collateralContract.executeSeizure(defaulter);
            membersContract.removeMember(defaulter);
            
            if (member.guarantor != address(0)) {
                membersContract.removeMember(member.guarantor);
            }
        }
    }

    function shouldAutomationRun() external view override returns (
        bool shouldRun,
        string memory reason,
        uint256 defaultersCount
    ) {
        if (!automationEnabled) {
            return (false, "Automation disabled", 0);
        }
        
        (bool isPastDeadline, uint256 secondsOverdue) = paymentsContract.isDeadlinePassed();
        
        if (!isPastDeadline) {
            return (false, "Deadline not reached", 0);
        }
        
        if (secondsOverdue < automationGracePeriod) {
            return (false, "Grace period not elapsed", 0);
        }
        
        address[] memory defaulters = paymentsContract.getMembersInDefault();
        defaultersCount = defaulters.length;
        
        if (defaultersCount == 0) {
            return (false, "No defaulters found", 0);
        }
        
        if (paused) {
            return (false, "Contract is paused", defaultersCount);
        }
        
        return (true, "Ready to process defaults", defaultersCount);
    }

    function getAutomationConfig() external view returns (
        bool enabled,
        uint256 gracePeriod,
        address[] memory authorizedAddresses
    ) {
        enabled = automationEnabled;
        gracePeriod = automationGracePeriod;
        authorizedAddresses = new address[](0);
        
        return (enabled, gracePeriod, authorizedAddresses);
    }

    // ============ CYCLE ADVANCEMENT AUTOMATION ============

    function shouldAdvanceCycle() external view returns (
        bool shouldAdvance,
        string memory reason,
        bool readyForPayout
    ) {
        if (!autoAdvanceCycleEnabled) {
            return (false, "Auto-advance disabled", false);
        }
        
        if (paused) {
            return (false, "Contract paused", false);
        }
        
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        if (!isFirstCycleComplete) {
            bool payoutReady = paymentsContract.isPayoutReady();
            
            if (payoutReady) {
                return (true, "First cycle payout ready", true);
            } else {
                return (false, "Waiting for all payments in first cycle", false);
            }
        }
        
        uint256 timeSinceLastCycle = block.timestamp - lastCycleTimestamp;
        
        if (timeSinceLastCycle < cycleDuration) {
            return (false, "Cycle duration not elapsed", false);
        }
        
        bool payoutReady = paymentsContract.isPayoutReady();
        
        if (payoutReady) {
            return (true, "Cycle complete, payout ready", true);
        }
        
        (bool allPaid, uint256 lastPaymentTime) = _checkAllMembersPaid();
        
        if (!allPaid) {
            return (false, "Not all members have paid yet", false);
        }
        
        uint256 timeSinceLastPayment = block.timestamp - lastPaymentTime;
        
        if (timeSinceLastPayment < minCycleAdvanceDelay) {
            return (false, "Waiting for minimum delay after last payment", false);
        }
        
        return (true, "Ready to advance (all paid or defaults handled)", false);
    }

    function advanceCycleAutomated() 
        external 
        onlyAuthorizedAutomation 
        whenAutomationEnabled
        nonReentrant 
        returns (bool success, bool payoutDistributed)
    {
        (bool shouldAdvance, string memory reason, bool payoutReady) = this.shouldAdvanceCycle();
        
        require(shouldAdvance, reason);
        
        uint256 oldCycle = paymentsContract.getCurrentCycle();
        
        if (payoutReady) {
            try paymentsContract.distributePayout() {
                payoutDistributed = true;
            } catch Error(string memory errorReason) {
                emit CycleAdvancementFailed(oldCycle, errorReason, block.timestamp);
                revert(string(abi.encodePacked("Payout distribution failed: ", errorReason)));
            }
        }
        
        _advanceCycle();
        
        if (!isFirstCycleComplete) {
            isFirstCycleComplete = true;
        }
        
        uint256 newCycle = paymentsContract.getCurrentCycle();
        
        emit CycleAdvancedAutomatically(oldCycle, newCycle, msg.sender, block.timestamp, payoutDistributed);
        
        return (true, payoutDistributed);
    }

    function _checkAllMembersPaid() internal view returns (bool allPaid, uint256 lastPaymentTime) {
        address[] memory members = membersContract.getActiveMembersList();
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        allPaid = true;
        lastPaymentTime = 0;
        
        for (uint256 i = 0; i < members.length; i++) {
            Member memory member = membersContract.getMember(members[i]);
            
            if (member.lastPaymentCycle < currentCycle) {
                allPaid = false;
            }
            
            if (member.lastPaymentCycle == currentCycle && lastCycleTimestamp > lastPaymentTime) {
                lastPaymentTime = lastCycleTimestamp;
            }
        }
        
        if (lastPaymentTime == 0) {
            lastPaymentTime = lastCycleTimestamp;
        }
        
        return (allPaid, lastPaymentTime);
    }

    function getCycleAdvancementStatus() external view returns (CycleAdvancementStatus memory status) {
        status.currentCycle = paymentsContract.getCurrentCycle();
        status.isFirstCycle = !isFirstCycleComplete;
        status.cycleStartTime = lastCycleTimestamp;
        status.cycleDuration = cycleDuration;
        status.timeElapsed = block.timestamp - lastCycleTimestamp;
        status.autoAdvanceEnabled = autoAdvanceCycleEnabled;
        
        (status.allMembersPaid, status.lastPaymentTime) = _checkAllMembersPaid();
        status.payoutReady = paymentsContract.isPayoutReady();
        status.nextPayoutRecipient = paymentsContract.getNextRecipient();
        
        (status.shouldAdvance, status.advanceReason, status.needsPayout) = this.shouldAdvanceCycle();
        
        if (status.timeElapsed < cycleDuration) {
            status.timeUntilAdvancement = cycleDuration - status.timeElapsed;
        } else {
            status.timeUntilAdvancement = 0;
        }
        
        return status;
    }

    function setAutoAdvanceCycleEnabled(bool enabled) external onlyOwner {
        autoAdvanceCycleEnabled = enabled;
        emit AutoAdvanceCycleToggled(enabled);
    }

    function setMinCycleAdvanceDelay(uint256 newDelay) external onlyOwner {
        require(newDelay <= 24 hours, "Delay too long");
        uint256 oldDelay = minCycleAdvanceDelay;
        minCycleAdvanceDelay = newDelay;
        emit MinCycleAdvanceDelayUpdated(oldDelay, newDelay);
    }

    struct CycleAdvancementStatus {
        uint256 currentCycle;
        bool isFirstCycle;
        uint256 cycleStartTime;
        uint256 cycleDuration;
        uint256 timeElapsed;
        uint256 timeUntilAdvancement;
        bool autoAdvanceEnabled;
        bool allMembersPaid;
        uint256 lastPaymentTime;
        bool payoutReady;
        address nextPayoutRecipient;
        bool shouldAdvance;
        string advanceReason;
        bool needsPayout;
    }
}