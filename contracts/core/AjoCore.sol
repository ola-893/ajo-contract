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
    
    uint256 public cycleDuration;
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
    event CycleDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event MemberDefaulted(address indexed member, uint256 cycle, uint256 cyclesMissed);
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
        
        _transferOwnership(msg.sender);
        
        USDC = IERC20(_usdc);
        HBAR = IERC20(_whbar);
        
        membersContract = IAjoMembers(_ajoMembers);
        collateralContract = IAjoCollateral(_ajoCollateral);
        paymentsContract = IAjoPayments(_ajoPayments);
        governanceContract = IAjoGovernance(_ajoGovernance);
        
        nextQueueNumber = 1;
        lastCycleTimestamp = block.timestamp;
        cycleDuration = 30 days; // Default value
        
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
        
        // ============ NEW SECTION: UPDATE BIDIRECTIONAL GUARANTOR RELATIONSHIPS ============
        // Check if this new member should be the guarantor for an existing member
        // This handles the case where members 1-5 join before 6-10 exist
        if (newMemberGuaranteePosition > 0) {
            address memberToUpdate = membersContract.getQueuePosition(newMemberGuaranteePosition);
            
            // If that member exists and doesn't have a guarantor yet
            if (memberToUpdate != address(0)) {
                Member memory existingMemberData = membersContract.getMember(memberToUpdate);
                
                // Update their guarantor if it's currently zero address
                if (existingMemberData.guarantor == address(0)) {
                    console.log("Updating guarantor for existing member at position %s", newMemberGuaranteePosition);
                    
                    // Update the existing member's guarantor to the new member
                    existingMemberData.guarantor = msg.sender;
                    
                    // Update using the AjoMembers contract
                    membersContract.updateMember(memberToUpdate, existingMemberData);
                    
                    // Update local guarantor assignments mapping
                    guarantorAssignments[newMemberGuaranteePosition] = msg.sender;
                    
                    // Emit event for the updated relationship
                    emit GuarantorAssigned(
                        memberToUpdate, 
                        msg.sender, 
                        newMemberGuaranteePosition, 
                        nextQueueNumber
                    );
                    
                    console.log("Successfully updated guarantor for member %s to %s", memberToUpdate, msg.sender);
                }
            }
        }
        // ============ END NEW SECTION ============
        
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
        // Get member info
        Member memory member = membersContract.getMember(msg.sender);
        require(member.isActive, "Member not active");
        
        // Get current cycle
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        // Check if already paid this cycle
        require(member.lastPaymentCycle < currentCycle, "Already paid this cycle");
        
        // Get configured payment amount for member's token
        TokenConfig memory config = paymentsContract.getTokenConfig(member.preferredToken);
        require(config.isActive, "Token not supported");
        require(config.monthlyPayment > 0, "Invalid payment config");
        
        // Process payment through payments contract with FIXED amount
        paymentsContract.processPayment(
            msg.sender,
            config.monthlyPayment,  // ✅ Uses configured amount from factory
            member.preferredToken
        );
        
        // Update member's last payment cycle
        membersContract.updateLastPaymentCycle(msg.sender, currentCycle);
    }
    
    /**
     * @dev Distribute payout to next recipient
     * CRITICAL FIX: Removed duplicate advanceCycle() call
     * The cycle advancement now happens ONLY in AjoPayments.distributePayout()
     */
    function distributePayout() external override nonReentrant {
        // REMOVED: All cycle timing logic and _advanceCycle() calls
        // The AjoPayments contract handles cycle advancement automatically after payout
        
        // Simply delegate to payments contract
        // It will:
        // 1. Verify all members paid
        // 2. Distribute payout to recipient
        // 3. Advance cycle (increment currentCycle)
        // 4. Update nextPayoutPosition
        paymentsContract.distributePayout();
        
        // Update local timestamp for tracking
        lastCycleTimestamp = block.timestamp;
        
        // Emit event for frontend tracking
        emit CycleAdvanced(paymentsContract.getCurrentCycle(), block.timestamp);
    }
    
    function handleDefault(address defaulter) external override {
        // Retrieve member data from the members contract
        Member memory member = membersContract.getMember(defaulter);
        
        // Ensure the member is currently active in the Ajo circle
        if (!member.isActive) revert MemberNotFound();
        
        // 1. Mark the member as defaulted in the payments contract.
        // This applies penalties and updates default status
        paymentsContract.handleDefault(defaulter);
        
        // 2. Update the defaulter's reputation negatively.
        governanceContract.updateReputationAndVotingPower(defaulter, false);
        
        // 3. Get current cycle to determine severity
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        uint256 cyclesMissed = member.lastPaymentCycle > 0 
            ? currentCycle - member.lastPaymentCycle 
            : 1;
        
        // 4. IMMEDIATE SEIZURE PROTOCOL
        // For testing: Use >= 1 (immediate)
        // For production: Use >= 3 (grace period)
        if (cyclesMissed >= 1) {
            // --- Execute Full Seizure Protocol ---
            
            // Step 1: Seize locked collateral from defaulter AND guarantor
            // This executes the collateral seizure which includes:
            // - Defaulter's locked collateral
            // - Guarantor's locked collateral
            collateralContract.executeSeizure(defaulter);
            
            // Step 2: BAN DEFAULTER FROM FUTURE PAYOUTS
            // By removing them, they forfeit their right to receive future payouts
            // This is the "past payment seizure" - their contributions stay in the pool
            // but they lose the right to recoup them via payout
            membersContract.removeMember(defaulter);
            
            // Step 3: BAN GUARANTOR FROM FUTURE PAYOUTS
            // The guarantor also loses their future payout rights
            // Their past contributions are also seized (forfeited payout eligibility)
            if (member.guarantor != address(0)) {
                // Remove guarantor - they forfeit future payout rights
                membersContract.removeMember(member.guarantor);
                
                // Note: Their collateral was already seized in Step 1 via executeSeizure
                // Now they also lose the right to reclaim their past contributions
            }
            
            emit MemberDefaulted(defaulter, currentCycle, cyclesMissed);
            
            // Step 4: Adjust payout queue
            // Since we removed members, the next payout position needs adjustment
            // This ensures the queue continues properly
            _adjustPayoutQueue();
        } else {
            // Light penalty - just apply fees, don't remove members yet
            emit MemberDefaulted(defaulter, currentCycle, cyclesMissed);
        }
    }

    /**
    * @dev Adjust payout queue after member removal
    * Called internally after removing defaulted members
    */
    function _adjustPayoutQueue() internal {
        uint256 totalActiveMembers = membersContract.getTotalActiveMembers();
        uint256 currentPayoutPos = paymentsContract.getNextPayoutPosition();
        
        // If payout position exceeds active members, cycle is complete
        if (currentPayoutPos > totalActiveMembers) {
            // Advance to next cycle
            paymentsContract.advanceCycle();
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
    
    // Update the updateCycleDuration function to actually work:
    function updateCycleDuration(uint256 newDuration) external override onlyOwner {
        //require(newDuration >= 1 days, "Duration too short");
        require(newDuration <= 365 days, "Duration too long");
        
        uint256 oldDuration = cycleDuration;
        cycleDuration = newDuration;
        
        emit CycleDurationUpdated(oldDuration, newDuration);
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

    function getCycleDuration() external override view returns (uint256) {
        return cycleDuration;
    }
        
    function executeProposal(uint256 proposalId) external {
        governanceContract.executeProposal(proposalId);
    }
    
    // Governance-controlled functions
    function updatePenaltyRate(uint256 newPenaltyRate) external {
        require(msg.sender == address(governanceContract), "Only governance");
        paymentsContract.updatePenaltyRate(newPenaltyRate);
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @dev Internal helper to advance cycle
     * DEPRECATED: This function is no longer used
     * Cycle advancement now happens automatically in AjoPayments.distributePayout()
     */
    function _advanceCycle() internal {
        // This function is kept for backwards compatibility but does nothing
        // The actual cycle advancement happens in AjoPayments.advanceCycle()
        // which is called automatically after payout distribution
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

    function paymentsContractAddress() external override view returns (IAjoPayments) {
        return paymentsContract;
    }
}