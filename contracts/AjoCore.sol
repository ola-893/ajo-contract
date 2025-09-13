// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "./AjoInterfaces.sol";

contract AjoCore is IPatientAjo, ReentrancyGuard, Ownable {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public immutable USDC;
    IERC20 public immutable HBAR;
    
    IAjoMembers public immutable membersContract;
    IAjoCollateral public immutable collateralContract;
    IAjoPayments public immutable paymentsContract;
    IAjoGovernance public immutable governanceContract;
    
    uint256 public constant CYCLE_DURATION = 30 days;
    
    uint256 public nextQueueNumber = 1;
    uint256 public lastCycleTimestamp;
    
    // ============ EVENTS ============
    
    event CycleAdvanced(uint256 newCycle, uint256 timestamp);
    event ContractsInitialized(address members, address collateral, address payments, address governance);
    
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
    
    // ============ MODIFIERS ============
    
    modifier onlyActiveMember() {
        Member memory member = membersContract.getMember(msg.sender);
        if (!member.isActive) revert MemberNotFound();
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        address _usdc, 
        address _hbar,
        address _membersContract,
        address _collateralContract,
        address _paymentsContract,
        address _governanceContract
    ) {
        USDC = IERC20(_usdc);
        HBAR = IERC20(_hbar);
        
        membersContract = IAjoMembers(_membersContract);
        collateralContract = IAjoCollateral(_collateralContract);
        paymentsContract = IAjoPayments(_paymentsContract);
        governanceContract = IAjoGovernance(_governanceContract);
        
        lastCycleTimestamp = block.timestamp;
        
        emit ContractsInitialized(_membersContract, _collateralContract, _paymentsContract, _governanceContract);
    }
    
    // ============ CORE AJO FUNCTIONS (IPatientAjo) ============
    
    function joinAjo(PaymentToken tokenChoice) external override nonReentrant {
        Member memory existingMember = membersContract.getMember(msg.sender);
        if (existingMember.isActive) revert MemberAlreadyExists();
        
        TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
        if (!config.isActive) revert TokenNotSupported();
        
        // Calculate required collateral based on V2 formula
        uint256 currentParticipants = membersContract.getTotalActiveMembers() + 1; // Including this new member
        uint256 requiredCollateral = collateralContract.calculateRequiredCollateral(
            nextQueueNumber,
            config.monthlyPayment,
            currentParticipants
        );
        
        // Calculate guarantor position
        uint256 guarantorPos = collateralContract.calculateGuarantorPosition(nextQueueNumber, currentParticipants);
        address guarantorAddr = address(0);
        
        // Find guarantor if they exist
        if (guarantorPos < nextQueueNumber) {
            guarantorAddr = membersContract.queuePositions(guarantorPos);
        }
        
        // Lock collateral
        collateralContract.lockCollateral(msg.sender, requiredCollateral, tokenChoice);
        
        // Calculate initial reputation and voting power
        uint256 initialReputation = _calculateInitialReputation(requiredCollateral, config.monthlyPayment);
        
        // Create member record
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
            guaranteePosition: 0 // Will be set when someone chooses this member as guarantor
        });
        
        // Add member to members contract
        membersContract.joinAjo(tokenChoice);
        
        nextQueueNumber++;
    }
    
    function makePayment() external override onlyActiveMember nonReentrant {
        Member memory member = membersContract.getMember(msg.sender);
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        if (member.lastPaymentCycle >= currentCycle) revert PaymentAlreadyMade();
        
        // Process payment through payments contract
        paymentsContract.makePayment();
        
        // Update reputation and voting power for consistent payments
        governanceContract.updateReputationAndVotingPower(msg.sender, true);
    }
    
    function distributePayout() external override nonReentrant {
        // Check if cycle should advance
        if (block.timestamp >= lastCycleTimestamp + CYCLE_DURATION) {
            _advanceCycle();
        }
        
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
            if (member.guarantor != address(0)) {
                // Remove guarantor as well - this might need special handling
            }
        }
    }
    
    function exitAjo() external override onlyActiveMember nonReentrant {
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
    
    // ============ VIEW FUNCTIONS - MEMBER INFORMATION (IPatientAjo) ============
    
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
    
    // ============ VIEW FUNCTIONS - CONTRACT STATISTICS (IPatientAjo) ============
    
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
    
    // ============ VIEW FUNCTIONS - TOKEN CONFIGURATION (IPatientAjo) ============
    
    function getTokenConfig(PaymentToken token) external view override returns (TokenConfig memory) {
        return paymentsContract.getTokenConfig(token);
    }
    
    // ============ VIEW FUNCTIONS - V2 COLLATERAL DEMO (IPatientAjo) ============
    
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
    
    // ============ VIEW FUNCTIONS - SECURITY MODEL (IPatientAjo) ============
    
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
    
    // ============ ADMIN FUNCTIONS (IPatientAjo) ============
    
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
                    // Remove member logic would go here
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
    
    // ============ GOVERNANCE INTEGRATION ============
    
    function createProposal(string memory description, bytes memory proposalData) external returns (uint256) {
        return governanceContract.createProposal(description, proposalData);
    }
    
    function vote(uint256 proposalId, uint8 support) external {
        governanceContract.vote(proposalId, support);
    }
    
    function executeProposal(uint256 proposalId) external {
        governanceContract.executeProposal(proposalId);
    }
    
    // Governance-controlled functions
    function updatePenaltyRate(uint256 newPenaltyRate) external {
        require(msg.sender == address(governanceContract), "Only governance");
        paymentsContract.updatePenaltyRate(newPenaltyRate);
    }
    
    function switchPaymentToken(PaymentToken newToken) external {
        require(msg.sender == address(governanceContract), "Only governance");
        paymentsContract.switchPaymentToken(newToken);
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _advanceCycle() internal {
        paymentsContract.advanceCycle();
        lastCycleTimestamp = block.timestamp;
        emit CycleAdvanced(paymentsContract.getCurrentCycle(), block.timestamp);
    }
    
    function _calculateInitialReputation(uint256 collateral, uint256 monthlyPayment) 
        internal 
        pure 
        returns (uint256) 
    {
        if (collateral == 0) return 800; // High reputation for last position (no collateral needed)
        
        // Base reputation of 600, up to 1000 based on collateral vs monthly payment ratio
        uint256 ratio = (collateral * 100) / monthlyPayment; // How many months of payments is collateral worth
        uint256 bonus = ratio > 400 ? 400 : ratio; // Cap bonus at 400 points
        return 600 + bonus;
    }
}