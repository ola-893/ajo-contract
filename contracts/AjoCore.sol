// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./AjoInterfaces.sol";

contract AjoCore is IAjoCore, ReentrancyGuard, Ownable, Initializable {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
    
    IAjoMembers public membersContract;
    IAjoCollateral public collateralContract;
    IAjoPayments public paymentsContract;
    IAjoGovernance public governanceContract;
    
    uint256 public constant CYCLE_DURATION = 30 days;
    uint256 public constant FIXED_TOTAL_PARTICIPANTS = 10;
    
    uint256 public nextQueueNumber = 1;
    uint256 public lastCycleTimestamp;
    
    // New mappings needed for joinAjo functionality
    mapping(uint256 => address) public queuePositions;
    mapping(uint256 => address) public guarantorAssignments;
    address[] public activeMembersList;
    
    // ============ EVENTS ============
    
    event CycleAdvanced(uint256 newCycle, uint256 timestamp);
    event ContractsInitialized(address members, address collateral, address payments, address governance);
    event MemberJoined(address indexed member, uint256 queueNumber, uint256 collateral, PaymentToken token);
    event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
    event AjoFull(address indexed ajoContract, uint256 timestamp);
    event CollateralTransferRequired(address indexed member, uint256 amount, PaymentToken token, address collateralContract);
    
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
        // Disable initializers on the master copy
        _disableInitializers();
        
        // Transfer ownership to address(1) to prevent master copy usage
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
        
        // Initialize ownership for the proxy instance
        _transferOwnership(msg.sender);
        
        // Set token contracts
        USDC = IERC20(_usdc);
        HBAR = IERC20(_whbar);
        
        // Set sub-contracts
        membersContract = IAjoMembers(_ajoMembers);
        collateralContract = IAjoCollateral(_ajoCollateral);
        paymentsContract = IAjoPayments(_ajoPayments);
        governanceContract = IAjoGovernance(_ajoGovernance);
        
        // Initialize state variables
        nextQueueNumber = 1;
        lastCycleTimestamp = block.timestamp;
        
        emit ContractsInitialized(_ajoMembers, _ajoCollateral, _ajoPayments, _ajoGovernance);
    }
    
    // ============ CORE AJO FUNCTIONS ============
    
    function joinAjo(PaymentToken tokenChoice) external override nonReentrant {
        // Check if member already exists
        Member memory existingMember = membersContract.getMember(msg.sender);
        if (existingMember.isActive) revert MemberAlreadyExists();
        
        // Check Ajo capacity (max 10 members)
        if (nextQueueNumber > FIXED_TOTAL_PARTICIPANTS) revert AjoCapacityReached();
        
        // Step 1: Check token configuration exists (monthly payment amount set)
        TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
        if (!config.isActive) revert TokenNotSupported();
        if (config.monthlyPayment == 0) revert InvalidTokenConfiguration();
        
        // Step 2: Calculate collateral for current position (based on join order with fixed 10 participants)
        uint256 requiredCollateral = collateralContract.calculateRequiredCollateral(
            nextQueueNumber,
            config.monthlyPayment,
            FIXED_TOTAL_PARTICIPANTS
        );
        
        // Calculate guarantor position (Position N pairs with Position N+5)
        uint256 guarantorPos = collateralContract.calculateGuarantorPosition(
            nextQueueNumber, 
            FIXED_TOTAL_PARTICIPANTS
        );
        
        // Find guarantor address if they exist (for positions 1-5, guarantor is positions 6-10)
        address guarantorAddr = address(0);
        if (guarantorPos <= FIXED_TOTAL_PARTICIPANTS && guarantorPos != nextQueueNumber) {
            // Check if guarantor position is already filled using AjoMembers contract
            address potentialGuarantor = membersContract.getQueuePosition(guarantorPos);
            if (potentialGuarantor != address(0)) {
                guarantorAddr = potentialGuarantor;
            }
        }
        
        // Step 3 & 4: Handle collateral transfer
        if (requiredCollateral > 0) {
            // Get the appropriate token contract
            IERC20 paymentToken = (tokenChoice == PaymentToken.USDC) ? USDC : HBAR;
            
            // Check user has sufficient balance
            if (paymentToken.balanceOf(msg.sender) < requiredCollateral) {
                revert InsufficientCollateralBalance();
            }
            
            // Check if user has approved CollateralContract and we pull from them
            if (paymentToken.allowance(msg.sender, address(collateralContract)) >= requiredCollateral) {
                // User approved CollateralContract directly, let CollateralContract pull the funds
                collateralContract.lockCollateral(msg.sender, requiredCollateral, tokenChoice);
            } else {
                // Fallback: User must transfer manually first
                emit CollateralTransferRequired(msg.sender, requiredCollateral, tokenChoice, address(collateralContract));
                revert CollateralNotTransferred();
            }
        }
        
        // Calculate initial reputation based on collateral contribution
        uint256 initialReputation = _calculateInitialReputation(requiredCollateral, config.monthlyPayment);
        
        // Calculate guaranteePosition for the NEW member only
        uint256 newMemberGuaranteePosition = 0;
        if (nextQueueNumber <= 5) {
            // Positions 1-5 will guarantee positions 6-10 when they join
            newMemberGuaranteePosition = nextQueueNumber + 5;
        }
        // Positions 6-10 don't guarantee anyone (stays 0)
        
        // Step 5: Create member record with all required data
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
        
        // Add member to members contract using the existing addMember function
        membersContract.addMember(msg.sender, newMember);
        
        // Update local mappings in AjoCore for quick access
        queuePositions[nextQueueNumber] = msg.sender;
        activeMembersList.push(msg.sender);
        
        // Set up guarantor relationship
        if (guarantorAddr != address(0)) {
            // Set up the guarantor assignment
            guarantorAssignments[nextQueueNumber] = guarantorAddr;
            
            // Emit guarantor assignment event
            emit GuarantorAssigned(msg.sender, guarantorAddr, nextQueueNumber, guarantorPos);
        }
        
        // Increment queue number for next member
        nextQueueNumber++;
        
        // Emit member joined event
        emit MemberJoined(msg.sender, newMember.queueNumber, requiredCollateral, tokenChoice);
        
        // If this is the 10th member, mark Ajo as full and ready to start
        if (nextQueueNumber > FIXED_TOTAL_PARTICIPANTS) {
            emit AjoFull(address(this), block.timestamp);
            
            // Initialize first cycle if needed
            if (paymentsContract.getCurrentCycle() == 0) {
                paymentsContract.advanceCycle(); // Start cycle 1
            }
        }
    }
    
    function processPayment() external override nonReentrant {
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        // Process payment through payments contract
        paymentsContract.processPayment(msg.sender, 100e6, PaymentToken.USDC);
        
        // Update member's last payment cycle
        membersContract.updateLastPaymentCycle(msg.sender, currentCycle);
    }
    
    function distributePayout() external override nonReentrant {
        // Distribute payout through payments contract
        paymentsContract.distributePayout();
    }
    
    function handleDefault(address defaulter) external override onlyOwner {
        Member memory member = membersContract.getMember(defaulter);
        
        if (!member.isActive) revert MemberNotFound();
        
        // Handle default through payments contract
        paymentsContract.handleDefault(defaulter);
        
        // Update reputation negatively for defaults
        governanceContract.updateReputationAndVotingPower(defaulter, false);
        
        // Check for severe default (3+ cycles missed)
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
        if (cyclesMissed >= 3) {
            // Execute seizure mechanism
            collateralContract.executeSeizure(defaulter);
            
            // Remove defaulter and their guarantor from active members
            membersContract.exitAjo(); // This should be called by the defaulter's address context
        }
    }
    
    function exitAjo() external override nonReentrant {
        Member memory member = membersContract.getMember(msg.sender);
        
        if (member.hasReceivedPayout) {
            // Must complete remaining cycles after receiving payout
            revert Unauthorized();
        }
        
        // Calculate exit penalty (10%)
        uint256 exitPenalty = member.lockedCollateral / 10;
        uint256 returnAmount = member.lockedCollateral > exitPenalty ? member.lockedCollateral - exitPenalty : 0;
        
        // Remove member through members contract
        membersContract.exitAjo();
        
        // Burn voting tokens
        governanceContract.updateVotingPower(msg.sender, 0);
        
        // Unlock and return remaining collateral
        if (returnAmount > 0) {
            collateralContract.unlockCollateral(msg.sender, returnAmount, member.preferredToken);
        }
    }
    
    // ============ VIEW FUNCTIONS - MEMBER INFORMATION ============
    
     // ============ VIEW FUNCTIONS - MEMBER INFORMATION (IAjoCore) ============
    
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
        //balanceOf(member);
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
    
    // ============ VIEW FUNCTIONS - CONTRACT STATISTICS ============
    
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
    
    // ============ VIEW FUNCTIONS - TOKEN CONFIGURATION ============
    
    function getTokenConfig(PaymentToken token) external view override returns (TokenConfig memory) {
        return paymentsContract.getTokenConfig(token);
    }
    
    // ============ VIEW FUNCTIONS - V2 COLLATERAL DEMO ============
    
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
    
    // ============ VIEW FUNCTIONS - SECURITY MODEL ============
    
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
        // Withdraw from collateral contract
        collateralContract.emergencyWithdraw(token, owner(), type(uint256).max);
        
        // Withdraw from payments contract  
        paymentsContract.emergencyWithdraw(token);
    }
    
    function updateCycleDuration(uint256 newDuration) external override onlyOwner {
        // This would need to be implemented to update cycle duration
        // For now, CYCLE_DURATION is a constant
    }
    
    function emergencyPause() external override onlyOwner {
        // Implementation for emergency pause functionality
        // This would prevent new joins and payments during emergencies
    }
    
    function batchHandleDefaults(address[] calldata defaulters) external override onlyOwner {
        // Handle defaults through payments contract
        paymentsContract.batchHandleDefaults(defaulters);
        
        // Update member records and check for seizures
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            Member memory member = membersContract.getMember(defaulter);
            
            if (member.isActive && member.lastPaymentCycle < currentCycle) {
                governanceContract.updateReputationAndVotingPower(defaulter, false);
                
                // Check for severe default
                uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
                if (cyclesMissed >= 3) {
                    collateralContract.executeSeizure(defaulter);
                }
            }
        }
    }
    
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external override onlyOwner {
        paymentsContract.updateTokenConfig(token, monthlyPayment, isActive);
    }
    
    // ============ HELPER FUNCTIONS ============
    
    function getRequiredCollateralForJoin(PaymentToken tokenChoice) external view returns (uint256) {
        TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
        return collateralContract.calculateRequiredCollateral(
            nextQueueNumber,
            config.monthlyPayment,
            FIXED_TOTAL_PARTICIPANTS
        );
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _calculateInitialReputation(uint256 collateral, uint256 monthlyPayment) 
        internal 
        pure 
        returns (uint256) 
    {
        if (monthlyPayment == 0) return 100; // Default reputation
        
        // Higher collateral = higher initial reputation (they're taking more risk)
        // Scale: 100 + (collateral/monthlyPayment * 50)
        // Position 1 with $247.5 collateral and $50 monthly gets: 100 + (247.5/50 * 50) = ~347
        // Position 10 with $0 collateral gets: 100 + 0 = 100
        return 100 + ((collateral * 50) / monthlyPayment);
    }
}