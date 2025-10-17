// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/AjoInterfaces.sol";
import "hardhat/console.sol";

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
    bool public paused;
    bool private isFirstCycleComplete;
    
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
    event Paused(address account);
    event Unpaused(address account);

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
    
    function joinAjo(PaymentToken tokenChoice) external override nonReentrant {
            console.log("joinAjo: caller=%s, token=%s", msg.sender, uint256(tokenChoice));
            
            // Check if member already exists
            Member memory existingMember = membersContract.getMember(msg.sender);
            if (existingMember.isActive) revert MemberAlreadyExists();
            
            // Check Ajo capacity (max 10 members)
            if (nextQueueNumber > FIXED_TOTAL_PARTICIPANTS) revert AjoCapacityReached();
            
            // Step 1: Check token configuration exists (monthly payment amount set)
            console.log("Getting token config...");
            TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
            if (!config.isActive) revert TokenNotSupported();
            if (config.monthlyPayment == 0) revert InvalidTokenConfiguration();
            
            // Step 2: Calculate collateral for current position
            console.log("Calculating collateral for position %s", nextQueueNumber);
            uint256 requiredCollateral = collateralContract.calculateRequiredCollateral(
                nextQueueNumber,
                config.monthlyPayment,
                FIXED_TOTAL_PARTICIPANTS
            );
            console.log("Required collateral: %s", requiredCollateral);
            
            // Calculate guarantor position (returns 0 if no guarantor for odd-numbered last position)
            uint256 guarantorPos = collateralContract.calculateGuarantorPosition(
                nextQueueNumber, 
                FIXED_TOTAL_PARTICIPANTS
            );
            
            // Find guarantor address if they exist (guarantorPos == 0 means no guarantor)
            address guarantorAddr = address(0);
            if (guarantorPos > 0 && guarantorPos != nextQueueNumber) {
                address potentialGuarantor = membersContract.getQueuePosition(guarantorPos);
                if (potentialGuarantor != address(0)) {
                    guarantorAddr = potentialGuarantor;
                }
            }
            
            // Step 3 & 4: Handle collateral transfer
            if (requiredCollateral > 0) {
                console.log("Processing collateral transfer...");
                
                // Get the appropriate token contract
                IERC20 paymentToken = (tokenChoice == PaymentToken.USDC) ? USDC : HBAR;
                
                // Check user has sufficient balance
                if (paymentToken.balanceOf(msg.sender) < requiredCollateral) {
                    console.log("ERROR: Insufficient balance");
                    revert InsufficientCollateralBalance();
                }
                
                // Check allowance and lock collateral
                if (paymentToken.allowance(msg.sender, address(collateralContract)) >= requiredCollateral) {
                    console.log("Locking collateral...");
                    collateralContract.lockCollateral(msg.sender, requiredCollateral, tokenChoice);
                } else {
                    console.log("ERROR: Insufficient allowance");
                    emit CollateralTransferRequired(msg.sender, requiredCollateral, tokenChoice, address(collateralContract));
                    revert CollateralNotTransferred();
                }
            }
            
            // Calculate initial reputation
            uint256 initialReputation = _calculateInitialReputation(requiredCollateral, config.monthlyPayment);
            
            // Calculate guarantee position (who this member guarantees) - bidirectional lookup
            uint256 newMemberGuaranteePosition = 0;
            for (uint256 i = 1; i <= FIXED_TOTAL_PARTICIPANTS; i++) {
                uint256 theirGuarantor = collateralContract.calculateGuarantorPosition(i, FIXED_TOTAL_PARTICIPANTS);
                if (theirGuarantor == nextQueueNumber) {
                    newMemberGuaranteePosition = i;
                    break;
                }
            }
            
            // Step 5: Create member record
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
            
            // Add member to members contract
            console.log("Adding member to contract...");
            membersContract.addMember(msg.sender, newMember);
            
            // Update local mappings
            queuePositions[nextQueueNumber] = msg.sender;
            activeMembersList.push(msg.sender);
            
            // Handle guarantor assignment
            if (guarantorAddr != address(0)) {
                guarantorAssignments[nextQueueNumber] = guarantorAddr;
                emit GuarantorAssigned(msg.sender, guarantorAddr, nextQueueNumber, guarantorPos);
            }
            
            // Increment queue number
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
            
            console.log("joinAjo: SUCCESS - member %s added at position %s", msg.sender, newMember.queueNumber);
        }
        
    // NEW HELPER FUNCTION: For users to check required collateral before joining
    function getRequiredCollateralForJoin(PaymentToken tokenChoice) external view returns (uint256) {
        TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
        return collateralContract.calculateRequiredCollateral(
            nextQueueNumber,
            config.monthlyPayment,
            FIXED_TOTAL_PARTICIPANTS
        );
    }
    
    function processPayment() external override nonReentrant {
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        // Process payment through payments contract
        paymentsContract.processPayment(msg.sender, 50e6, PaymentToken.USDC);
        
        // Update member's last payment cycle
        membersContract.updateLastPaymentCycle(msg.sender, currentCycle);
    }

    
    function distributePayout() external override nonReentrant {
        // For the first payout, advance the cycle immediately without a time check.
        if (!isFirstCycleComplete) {
            // Attempt to distribute the payout via the payments contract.
            // This contract will have its own checks to ensure a payout is ready for the current cycle.
            paymentsContract.distributePayout();
            _advanceCycle();
            isFirstCycleComplete = true; // Mark the first cycle as complete.
        } else {
            // For all subsequent payouts, check if the 30-day cycle duration has passed.
            if (block.timestamp >= lastCycleTimestamp + CYCLE_DURATION) {
                // Attempt to distribute the payout via the payments contract.
                // This contract will have its own checks to ensure a payout is ready for the current cycle.
                paymentsContract.distributePayout();
                _advanceCycle();
            }
        }
    }
    
    function handleDefault(address defaulter) external override onlyOwner {
        // Retrieve member data from the members contract
        Member memory member = membersContract.getMember(defaulter);
        
        // Ensure the member is currently active in the Ajo circle
        if (!member.isActive) revert MemberNotFound();
        
        // 1. Mark the member as defaulted in the payments contract.
        // This will typically apply penalties and update their default status.
        paymentsContract.handleDefault(defaulter);
        
        // 2. Update the defaulter's reputation negatively.
        // The 'false' boolean indicates a negative reputation event.
        governanceContract.updateReputationAndVotingPower(defaulter, false);
        
        // 3. Check for a severe default condition (e.g., missing 3 or more cycles).
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
        
        if (cyclesMissed >= 3) {
            // --- Severe Default Protocol ---
            
            // 3a. Execute the seizure of the defaulter's locked collateral.
            collateralContract.executeSeizure(defaulter);
            
            // 3b. Forcibly remove the defaulter from the Ajo circle.
            // We use `removeMember` as this is an administrative action.
            membersContract.removeMember(defaulter);
            
            // 3c. If the defaulter had a guarantor, remove the guarantor as well.
            // This is the core of the social guarantee mechanism.
            if (member.guarantor != address(0)) {
                membersContract.removeMember(member.guarantor);
            }
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
        membersContract.removeMember(msg.sender);
        
        // // Burn voting tokens
        // governanceContract.updateVotingPower(msg.sender, 0);
        
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
    
    // ============ ADMIN FUNCTIONS (Ajo) ============
    
    function emergencyWithdraw(PaymentToken token) external override onlyOwner {
        // Withdraw from collateral contract
        collateralContract.emergencyWithdraw(token, owner(), type(uint256).max);
        
        // Withdraw from payments contract  
        paymentsContract.emergencyWithdraw(token);
    }
    
    function updateCycleDuration(uint256 newDuration) external override onlyOwner {
        // For now, CYCLE_DURATION is a constant CYCLE_DURATION = 30 days;
        // There a lots of checks that will be needed to change this in a live Ajo
        // So we will leave this unimplemented for now.
        // In future, we could make CYCLE_DURATION a state variable and allow updates here.
    }
    
    /**
    * @dev Pauses the contract in case of an emergency.
    * Can only be called by the owner.
    * Emits a {Paused} event.
    */
    function emergencyPause() external override onlyOwner {
        // Ensure the contract is not already paused
        require(!paused, "Contract is already paused");
        
        // Set the paused state to true
        paused = true;
        
        // Emit an event to log the action on-chain
        emit Paused(msg.sender);
    }

    /**
    * @dev Unpauses the contract.
    * Can only be called by the owner.
    * Emits an {Unpaused} event.
    */
    function unpause() external onlyOwner {
        // Ensure the contract is currently paused
        require(paused, "Contract is not paused");
        
        // Set the paused state to false
        paused = false;
        
        // Emit an event to log the action on-chain
        emit Unpaused(msg.sender);
    }
    
    function batchHandleDefaults(address[] calldata defaulters) external override onlyOwner {
        // 1. Handle the financial aspects of the defaults in the payments contract.
        // This is done as a batch call for gas efficiency.
        paymentsContract.batchHandleDefaults(defaulters);
        
        // 2. Get the current cycle once to use throughout the loop.
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        // 3. Loop through each defaulter to handle governance and severe default actions.
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            
            // We must fetch the member's data in each loop iteration, as their state
            // might have been changed if they were removed as a guarantor earlier in this batch.
            Member memory member = membersContract.getMember(defaulter);
            
            // Proceed only if the member is still active.
            if (member.isActive) {
                // 3a. Update reputation negatively for the default.
                governanceContract.updateReputationAndVotingPower(defaulter, false);
                
                // 3b. Check for severe default (3+ cycles missed).
                uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
                if (cyclesMissed >= 3) {
                    // --- Severe Default Protocol ---
                    
                    // Seize the defaulter's collateral.
                    collateralContract.executeSeizure(defaulter);
                    
                    // Forcibly remove the defaulter from the Ajo circle.
                    membersContract.removeMember(defaulter);
                    
                    // If a guarantor exists, remove them as well.
                    if (member.guarantor != address(0)) {
                        membersContract.removeMember(member.guarantor);
                    }
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
    
    // function vote(uint256 proposalId, uint8 support) external {
    //     governanceContract.vote(proposalId, support);
    // }
    
    function executeProposal(uint256 proposalId) external {
        governanceContract.executeProposal(proposalId);
    }
    
    // Governance-controlled functions
    function updatePenaltyRate(uint256 newPenaltyRate) external {
        require(msg.sender == address(governanceContract), "Only governance");
        paymentsContract.updatePenaltyRate(newPenaltyRate);
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
        if (monthlyPayment == 0) return 100; // Default reputation
        
        // Higher collateral = higher initial reputation (they're taking more risk)
        // Scale: 100 + (collateral/monthlyPayment * 50)
        // Position 1 with $247.5 collateral and $50 monthly gets: 100 + (247.5/50 * 50) = ~347
        // Position 10 with $0 collateral gets: 100 + 0 = 100
        return 100 + ((collateral * 50) / monthlyPayment);
    }
}