// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

// /**
//  * @title PatientAjo - V2 Infinite Queue-Based Rotating Savings Contract
//  * @dev Time-based FIFO system with V2 collateral efficiency and governance
//  */
// contract PatientAjo is ReentrancyGuard, Ownable, ERC20Votes {
    
//     // ============ STATE VARIABLES ============
    
//     // Multi-token support
//     IERC20 public immutable USDC;
//     IERC20 public immutable HBAR; // Wrapped HBAR token on Hedera
    
//     enum PaymentToken { USDC, HBAR }
//     PaymentToken public activePaymentToken;
    
//     // V2 Collateral System Constants
//     uint256 public constant COLLATERAL_FACTOR = 55; // 55% collateral factor (V2 with seized payments)
//     uint256 public constant GUARANTOR_OFFSET_DIVISOR = 2; // Guarantor is participants/2 positions away
//     uint256 public constant CYCLE_DURATION = 30 days;
//     uint256 public constant DEFAULT_PENALTY_RATE = 500; // 5% monthly penalty (governance can change)
    
//     // Governance constants
//     uint256 public constant PROPOSAL_THRESHOLD = 1000e18; // Need 1000 voting power to propose
//     uint256 public constant VOTING_PERIOD = 3 days;
    
//     // Dynamic variables
//     uint256 public penaltyRate = DEFAULT_PENALTY_RATE; // Current penalty rate (changeable via governance)
//     uint256 public currentCycle = 1;
//     uint256 public nextQueueNumber = 1;
//     uint256 public nextPayoutPosition = 1;
//     uint256 public lastCycleTimestamp;
//     uint256 public proposalCount;
    
//     // Token-specific configurations
//     struct TokenConfig {
//         uint256 monthlyPayment;
//         bool isActive;
//     }
    
//     mapping(PaymentToken => TokenConfig) public tokenConfigs;
    
//     // ============ STRUCTS ============
    
//     struct Member {
//         uint256 queueNumber;
//         uint256 joinedCycle;
//         uint256 totalPaid;
//         uint256 requiredCollateral; // Calculated based on V2 formula
//         uint256 lockedCollateral; // Actually locked by user
//         uint256 lastPaymentCycle;
//         uint256 defaultCount;
//         bool hasReceivedPayout;
//         bool isActive;
//         address guarantor; // Assigned guarantor based on position
//         PaymentToken preferredToken; // USDC or HBAR
//         uint256 reputationScore; // 0-1000, affects voting weight
//         uint256[] pastPayments; // Track past payments for seizure calculations
//         uint256 guaranteePosition; // Position this member guarantees for
//     }
    
//     struct PayoutRecord {
//         address recipient;
//         uint256 amount;
//         uint256 cycle;
//         uint256 timestamp;
//     }
    
//     struct GovernanceProposal {
//         string description;
//         uint256 forVotes;
//         uint256 againstVotes;
//         uint256 abstainVotes;
//         mapping(address => bool) hasVoted;
//         mapping(address => uint8) votes; // 0=Against, 1=For, 2=Abstain
//         uint256 proposalEndTime;
//         bool executed;
//         bytes proposalData;
//     }
    
//     // ============ MAPPINGS ============
    
//     mapping(address => Member) public members;
//     mapping(uint256 => address) public queuePositions; // queueNumber => address
//     mapping(uint256 => PayoutRecord) public payouts; // cycle => payout info
//     mapping(address => uint256) public pendingPenalties;
//     mapping(PaymentToken => mapping(address => uint256)) public tokenBalances; // Track balances per token
//     mapping(address => uint256) public lockedCollateralBalances; // V2: Actual locked collateral
//     mapping(uint256 => address) public guarantorAssignments; // position => guarantor address
//     mapping(uint256 => GovernanceProposal) public proposals; // Governance proposals
    
//     // ============ ARRAYS ============
    
//     address[] public activeMembersList;
    
//     // ============ EVENTS ============
    
//     event MemberJoined(address indexed member, uint256 queueNumber, uint256 collateral, PaymentToken token);
//     event PaymentMade(address indexed member, uint256 amount, uint256 cycle, PaymentToken token);
//     event PayoutDistributed(address indexed recipient, uint256 amount, uint256 cycle, PaymentToken token);
//     event MemberDefaulted(address indexed member, uint256 cycle, uint256 penalty);
//     event CollateralLiquidated(address indexed member, uint256 amount, PaymentToken token);
//     event PaymentSeized(address indexed member, uint256 amount, string reason);
//     event CycleAdvanced(uint256 newCycle, uint256 timestamp);
//     event TokenSwitched(PaymentToken oldToken, PaymentToken newToken);
//     event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
//     event CollateralCalculated(address indexed member, uint256 requiredAmount, uint256 actualAmount);
    
//     // Governance events
//     event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
//     event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 weight);
//     event ProposalExecuted(uint256 indexed proposalId);
//     event VotingPowerUpdated(address indexed member, uint256 newVotingPower);
//     event ReputationUpdated(address indexed member, uint256 newReputation);
    
//     // ============ ERRORS ============
    
//     error InsufficientCollateral();
//     error MemberAlreadyExists();
//     error MemberNotFound();
//     error PaymentAlreadyMade();
//     error InsufficientBalance();
//     error InvalidCycle();
//     error PayoutNotReady();
//     error TokenNotSupported();
//     error ProposalNotActive();
//     error AlreadyVoted();
//     error InsufficientVotingPower();
//     error ProposalExecutionFailed();
//     error Unauthorized();
    
//     // ============ CONSTRUCTOR ============
    
//     constructor(address _usdc, address _hbar) 
//         ERC20("AjoGovernanceToken", "AGT")
//         ERC20Permit("AjoGovernanceToken")
//     {
//         USDC = IERC20(_usdc);
//         HBAR = IERC20(_hbar);
//         lastCycleTimestamp = block.timestamp;
//         activePaymentToken = PaymentToken.USDC; // Default to USDC
        
//         // Initialize token configurations
//         tokenConfigs[PaymentToken.USDC] = TokenConfig({
//             monthlyPayment: 50e18, // $50 USDC
//             isActive: true
//         });
        
//         tokenConfigs[PaymentToken.HBAR] = TokenConfig({
//             monthlyPayment: 1000e8, // 1000 HBAR (adjust based on HBAR price)
//             isActive: true
//         });
//     }
    
//     // ============ MODIFIERS ============
    
//     modifier onlyActiveMember() {
//         if (!members[msg.sender].isActive) revert MemberNotFound();
//         _;
//     }
    
//     modifier validCycle(uint256 cycle) {
//         if (cycle == 0 || cycle > currentCycle) revert InvalidCycle();
//         _;
//     }
    
//     // ============ V2 COLLATERAL CALCULATION FUNCTIONS ============
    
//     /**
//      * @dev Calculate required collateral using V2 formula with seized payments
//      * @param position Member's position in the queue (1-based)
//      * @param monthlyPayment The monthly payment amount
//      * @param totalParticipants Total number of participants in current cycle
//      */
//     function calculateRequiredCollateral(
//         uint256 position,
//         uint256 monthlyPayment,
//         uint256 totalParticipants
//     ) public pure returns (uint256) {
//         // Last person has no debt after payout, no collateral needed
//         if (position >= totalParticipants) {
//             return 0;
//         }
        
//         // Calculate potential debt: Payout - (position * monthlyPayment)
//         uint256 payout = totalParticipants * monthlyPayment;
//         uint256 potentialDebt = payout - (position * monthlyPayment);
        
//         // Apply V2 collateral factor (55% due to seizure of past payments)
//         uint256 requiredCollateral = (potentialDebt * COLLATERAL_FACTOR) / 100;
        
//         return requiredCollateral;
//     }
    
//     /**
//      * @dev Assign guarantor based on V2 system (participant/2 positions away)
//      * @param memberPosition Position of the member
//      * @param totalParticipants Total participants in the cycle
//      */
//     function calculateGuarantorPosition(
//         uint256 memberPosition,
//         uint256 totalParticipants
//     ) public pure returns (uint256) {
//         uint256 guarantorOffset = totalParticipants / GUARANTOR_OFFSET_DIVISOR;
//         uint256 guarantorPosition = ((memberPosition - 1 + guarantorOffset) % totalParticipants) + 1;
//         return guarantorPosition;
//     }
    
//     // ============ MAIN FUNCTIONS ============
    
//     /**
//      * @dev Join the Ajo with V2 collateral system
//      * @param tokenChoice Preferred payment token (USDC or HBAR)
//      */
//     function joinAjo(PaymentToken tokenChoice) external nonReentrant {
//         if (members[msg.sender].isActive) revert MemberAlreadyExists();
        
//         TokenConfig memory config = tokenConfigs[tokenChoice];
//         if (!config.isActive) revert TokenNotSupported();
        
//         // Calculate required collateral based on V2 formula
//         uint256 currentParticipants = activeMembersList.length + 1; // Including this new member
//         uint256 requiredCollateral = calculateRequiredCollateral(
//             nextQueueNumber,
//             config.monthlyPayment,
//             currentParticipants
//         );
        
//         // Calculate guarantor position
//         uint256 guarantorPos = calculateGuarantorPosition(nextQueueNumber, currentParticipants);
//         address guarantorAddr = address(0);
        
//         // Find guarantor if they exist
//         if (guarantorPos < nextQueueNumber) {
//             guarantorAddr = queuePositions[guarantorPos];
//         }
        
//         IERC20 token = tokenChoice == PaymentToken.USDC ? USDC : HBAR;
        
//         // Transfer required collateral (much lower than V1!)
//         if (requiredCollateral > 0) {
//             token.transferFrom(msg.sender, address(this), requiredCollateral);
//         }
        
//         // Calculate initial reputation and voting power
//         uint256 initialReputation = _calculateInitialReputation(requiredCollateral, config.monthlyPayment);
//         uint256 initialVotingPower = requiredCollateral > 0 ? (requiredCollateral * initialReputation) / 1000 : 1000; // Min voting power for last position
        
//         // Create member record with V2 fields
//         members[msg.sender] = Member({
//             queueNumber: nextQueueNumber,
//             joinedCycle: currentCycle,
//             totalPaid: 0,
//             requiredCollateral: requiredCollateral,
//             lockedCollateral: requiredCollateral,
//             lastPaymentCycle: 0,
//             defaultCount: 0,
//             hasReceivedPayout: false,
//             isActive: true,
//             guarantor: guarantorAddr,
//             preferredToken: tokenChoice,
//             reputationScore: initialReputation,
//             pastPayments: new uint256[](0),
//             guaranteePosition: 0 // Will be set when someone chooses this member as guarantor
//         });
        
//         // Update mappings
//         queuePositions[nextQueueNumber] = msg.sender;
//         lockedCollateralBalances[msg.sender] = requiredCollateral;
//         tokenBalances[tokenChoice][msg.sender] = requiredCollateral;
//         activeMembersList.push(msg.sender);
        
//         // Assign guarantor relationship
//         if (guarantorAddr != address(0)) {
//             members[guarantorAddr].guaranteePosition = nextQueueNumber;
//             guarantorAssignments[nextQueueNumber] = guarantorAddr;
//             emit GuarantorAssigned(msg.sender, guarantorAddr, nextQueueNumber, guarantorPos);
//         }
        
//         // Mint voting tokens
//         if (initialVotingPower > 0) {
//             _mint(msg.sender, initialVotingPower);
//         }
        
//         nextQueueNumber++;
        
//         emit MemberJoined(msg.sender, nextQueueNumber - 1, requiredCollateral, tokenChoice);
//         emit CollateralCalculated(msg.sender, requiredCollateral, requiredCollateral);
//         emit VotingPowerUpdated(msg.sender, initialVotingPower);
//     }
    
//     /**
//      * @dev Make monthly payment with V2 tracking
//      */
//     function makePayment() external onlyActiveMember nonReentrant {
//         Member storage member = members[msg.sender];
        
//         if (member.lastPaymentCycle >= currentCycle) revert PaymentAlreadyMade();
        
//         TokenConfig memory config = tokenConfigs[member.preferredToken];
//         IERC20 token = member.preferredToken == PaymentToken.USDC ? USDC : HBAR;
        
//         // Calculate total payment (including any penalties)
//         uint256 totalPayment = config.monthlyPayment + pendingPenalties[msg.sender];
        
//         // Transfer payment
//         token.transferFrom(msg.sender, address(this), totalPayment);
        
//         // V2: Track past payment for potential seizure
//         member.pastPayments.push(config.monthlyPayment);
        
//         // Update member record
//         member.totalPaid += totalPayment;
//         member.lastPaymentCycle = currentCycle;
        
//         // Update reputation and voting power for consistent payments
//         _updateReputationScore(msg.sender, true);
        
//         // Clear penalties
//         pendingPenalties[msg.sender] = 0;
        
//         emit PaymentMade(msg.sender, totalPayment, currentCycle, member.preferredToken);
//     }
    
//     /**
//      * @dev Distribute payout to next person in queue
//      */
//     function distributePayout() external nonReentrant {
//         // Check if cycle should advance
//         if (block.timestamp >= lastCycleTimestamp + CYCLE_DURATION) {
//             _advanceCycle();
//         }
        
//         // Find next recipient
//         address recipient = _getNextPayoutRecipient();
//         if (recipient == address(0)) revert PayoutNotReady();
        
//         uint256 payoutAmount = _calculatePayoutAmount();
        
//         Member memory recipientMember = members[recipient];
//         IERC20 token = recipientMember.preferredToken == PaymentToken.USDC ? USDC : HBAR;
//         token.transfer(recipient, payoutAmount);
        
//         // Update records
//         Member storage recipientStorage = members[recipient];
//         recipientStorage.hasReceivedPayout = true;
        
//         payouts[currentCycle] = PayoutRecord({
//             recipient: recipient,
//             amount: payoutAmount,
//             cycle: currentCycle,
//             timestamp: block.timestamp
//         });
        
//         nextPayoutPosition++;
        
//         emit PayoutDistributed(recipient, payoutAmount, currentCycle, recipientMember.preferredToken);
//     }
    
//     /**
//      * @dev Handle member default with V2 seizure mechanism
//      */
//     function handleDefault(address defaulter) external onlyOwner {
//         Member storage member = members[defaulter];
        
//         if (!member.isActive) revert MemberNotFound();
//         if (member.lastPaymentCycle >= currentCycle) return; // Not in default
        
//         uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
//         TokenConfig memory config = tokenConfigs[member.preferredToken];
//         uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
        
//         // Add penalty
//         pendingPenalties[defaulter] += penalty;
//         member.defaultCount++;
        
//         // Update reputation negatively for defaults
//         _updateReputationScore(defaulter, false);
        
//         // V2: If severe default, implement seizure mechanism
//         if (cyclesMissed >= 3) {
//             _executeSeizure(defaulter);
//         }
        
//         emit MemberDefaulted(defaulter, currentCycle, penalty);
//     }
    
//     /**
//      * @dev Exit Ajo (only if haven't received payout yet)
//      */
//     function exitAjo() external onlyActiveMember nonReentrant {
//         Member storage member = members[msg.sender];
        
//         if (member.hasReceivedPayout) {
//             // Must complete remaining cycles after receiving payout
//             revert Unauthorized();
//         }
        
//         // Return collateral minus exit penalty
//         uint256 exitPenalty = lockedCollateralBalances[msg.sender] / 10; // 10% penalty
//         uint256 returnAmount = lockedCollateralBalances[msg.sender] - exitPenalty;
        
//         // Clean up member data
//         member.isActive = false;
//         lockedCollateralBalances[msg.sender] = 0;
        
//         // Burn voting tokens
//         uint256 votingPower = balanceOf(msg.sender);
//         if (votingPower > 0) {
//             _burn(msg.sender, votingPower);
//         }
        
//         // Transfer remaining collateral
//         if (returnAmount > 0) {
//             IERC20 token = member.preferredToken == PaymentToken.USDC ? USDC : HBAR;
//             token.transfer(msg.sender, returnAmount);
//         }
        
//         _removeFromActiveList(msg.sender);
//     }
    
//     // ============ GOVERNANCE FUNCTIONS ============
    
//     /**
//      * @dev Create a governance proposal
//      * @param description Description of the proposal
//      * @param proposalData Encoded function call data
//      */
//     function createProposal(
//         string memory description,
//         bytes memory proposalData
//     ) external returns (uint256) {
//         if (balanceOf(msg.sender) < PROPOSAL_THRESHOLD) revert InsufficientVotingPower();
        
//         uint256 proposalId = proposalCount++;
//         GovernanceProposal storage proposal = proposals[proposalId];
        
//         proposal.description = description;
//         proposal.proposalEndTime = block.timestamp + VOTING_PERIOD;
//         proposal.executed = false;
//         proposal.proposalData = proposalData;
        
//         emit ProposalCreated(proposalId, msg.sender, description);
//         return proposalId;
//     }
    
//     /**
//      * @dev Vote on a proposal
//      * @param proposalId ID of the proposal
//      * @param support Vote direction (0=Against, 1=For, 2=Abstain)
//      */
//     function vote(uint256 proposalId, uint8 support) external {
//         GovernanceProposal storage proposal = proposals[proposalId];
        
//         if (block.timestamp > proposal.proposalEndTime) revert ProposalNotActive();
//         if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
//         if (support > 2) revert();
        
//         uint256 votingWeight = balanceOf(msg.sender);
//         if (votingWeight == 0) revert InsufficientVotingPower();
        
//         proposal.hasVoted[msg.sender] = true;
//         proposal.votes[msg.sender] = support;
        
//         if (support == 0) {
//             proposal.againstVotes += votingWeight;
//         } else if (support == 1) {
//             proposal.forVotes += votingWeight;
//         } else {
//             proposal.abstainVotes += votingWeight;
//         }
        
//         emit VoteCast(proposalId, msg.sender, support, votingWeight);
//     }
    
//     /**
//      * @dev Execute a passed proposal
//      * @param proposalId ID of the proposal to execute
//      */
//     function executeProposal(uint256 proposalId) external {
//         GovernanceProposal storage proposal = proposals[proposalId];
        
//         if (block.timestamp <= proposal.proposalEndTime) revert ProposalNotActive();
//         if (proposal.executed) revert ProposalExecutionFailed();
//         if (proposal.forVotes <= proposal.againstVotes) revert ProposalExecutionFailed();
        
//         proposal.executed = true;
        
//         // Execute the proposal (simplified - would need more complex execution logic)
//         if (proposal.proposalData.length > 0) {
//             (bool success,) = address(this).call(proposal.proposalData);
//             if (!success) revert ProposalExecutionFailed();
//         }
        
//         emit ProposalExecuted(proposalId);
//     }
    
//     /**
//      * @dev Governance function to change penalty rate
//      * @param newPenaltyRate New penalty rate (in basis points)
//      */
//     function updatePenaltyRate(uint256 newPenaltyRate) external {
//         // This function can only be called through governance
//         require(msg.sender == address(this), "Only governance");
//         penaltyRate = newPenaltyRate;
//     }
    
//     /**
//      * @dev Governance function to switch active payment token
//      * @param newToken New active payment token
//      */
//     function switchPaymentToken(PaymentToken newToken) external {
//         // This function can only be called through governance
//         require(msg.sender == address(this), "Only governance");
//         PaymentToken oldToken = activePaymentToken;
//         activePaymentToken = newToken;
//         emit TokenSwitched(oldToken, newToken);
//     }
    
//     // ============ INTERNAL FUNCTIONS ============
    
//     function _executeSeizure(address defaulter) internal {
//         Member storage defaulterMember = members[defaulter];
//         address guarantorAddr = defaulterMember.guarantor;
        
//         if (guarantorAddr == address(0)) return; // No guarantor assigned yet
        
//         Member storage guarantorMember = members[guarantorAddr];
        
//         // 1. Seize defaulter's collateral
//         uint256 defaulterCollateral = lockedCollateralBalances[defaulter];
//         lockedCollateralBalances[defaulter] = 0;
        
//         // 2. Seize guarantor's collateral  
//         uint256 guarantorCollateral = lockedCollateralBalances[guarantorAddr];
//         lockedCollateralBalances[guarantorAddr] = 0;
        
//         // 3. Calculate seized payments
//         uint256 defaulterPayments = 0;
//         uint256 guarantorPayments = 0;
        
//         // Sum defaulter's past payments
//         for (uint256 i = 0; i < defaulterMember.pastPayments.length; i++) {
//             defaulterPayments += defaulterMember.pastPayments[i];
//         }
        
//         // Sum guarantor's past payments  
//         for (uint256 i = 0; i < guarantorMember.pastPayments.length; i++) {
//             guarantorPayments += guarantorMember.pastPayments[i];
//         }
        
//         // Mark both as inactive (they lose their positions)
//         defaulterMember.isActive = false;
//         guarantorMember.isActive = false;
        
//         // Platform keeps seized assets as compensation
//         emit CollateralLiquidated(defaulter, defaulterCollateral, defaulterMember.preferredToken);
//         emit CollateralLiquidated(guarantorAddr, guarantorCollateral, guarantorMember.preferredToken);
//         emit PaymentSeized(defaulter, defaulterPayments, "Defaulter past payments seized");
//         emit PaymentSeized(guarantorAddr, guarantorPayments, "Guarantor past payments seized");
        
//         _removeFromActiveList(defaulter);
//         _removeFromActiveList(guarantorAddr);
//     }
    
//     function _calculateInitialReputation(uint256 collateral, uint256 monthlyPayment) 
//         internal 
//         pure 
//         returns (uint256) 
//     {
//         if (collateral == 0) return 800; // High reputation for last position (no collateral needed)
        
//         // Base reputation of 600, up to 1000 based on collateral vs monthly payment ratio
//         uint256 ratio = (collateral * 100) / monthlyPayment; // How many months of payments is collateral worth
//         uint256 bonus = ratio > 400 ? 400 : ratio; // Cap bonus at 400 points
//         return 600 + bonus;
//     }
    
//     function _updateReputationScore(address member, bool positive) internal {
//         Member storage memberInfo = members[member];
        
//         if (positive && memberInfo.reputationScore < 1000) {
//             memberInfo.reputationScore += 10;
//         } else if (!positive && memberInfo.reputationScore > 100) {
//             memberInfo.reputationScore -= 50;
//         }
        
//         // Update voting power based on new reputation
//         uint256 newVotingPower = memberInfo.lockedCollateral > 0 ? 
//             (memberInfo.lockedCollateral * memberInfo.reputationScore) / 1000 : 
//             memberInfo.reputationScore; // Base voting power for zero collateral users
        
//         uint256 currentBalance = balanceOf(member);
        
//         // Update voting tokens
//         if (newVotingPower > currentBalance) {
//             _mint(member, newVotingPower - currentBalance);
//         } else if (newVotingPower < currentBalance) {
//             _burn(member, currentBalance - newVotingPower);
//         }
        
//         emit ReputationUpdated(member, memberInfo.reputationScore);
//         emit VotingPowerUpdated(member, newVotingPower);
//     }
    
//     function _advanceCycle() internal {
//         currentCycle++;
//         lastCycleTimestamp = block.timestamp;
//         emit CycleAdvanced(currentCycle, block.timestamp);
//     }
    
//     function _getNextPayoutRecipient() internal view returns (address) {
//         if (nextPayoutPosition >= nextQueueNumber) return address(0);
        
//         address candidate = queuePositions[nextPayoutPosition];
//         Member memory candidateMember = members[candidate];
        
//         // Check if candidate is eligible (paid this cycle and is active)
//         if (!candidateMember.isActive || candidateMember.lastPaymentCycle < currentCycle) {
//             return address(0);
//         }
        
//         return candidate;
//     }
    
//     function _calculatePayoutAmount() internal view returns (uint256) {
//         TokenConfig memory config = tokenConfigs[activePaymentToken];
//         IERC20 token = activePaymentToken == PaymentToken.USDC ? USDC : HBAR;
        
//         uint256 totalBalance = token.balanceOf(address(this));
//         uint256 totalCollateral = _getTotalCollateral();
//         uint256 availableForPayout = totalBalance - totalCollateral;
        
//         // Ensure minimum payout of monthly payment amount
//         uint256 basePayout = config.monthlyPayment * activeMembersList.length;
//         return availableForPayout >= basePayout ? basePayout : availableForPayout;
//     }
    
//     function _getTotalCollateral() internal view returns (uint256) {
//         uint256 totalUSDC = 0;
//         uint256 totalHBAR = 0;
        
//         for (uint256 i = 0; i < activeMembersList.length; i++) {
//             address member = activeMembersList[i];
//             Member memory memberInfo = members[member];
            
//             if (memberInfo.preferredToken == PaymentToken.USDC) {
//                 totalUSDC += lockedCollateralBalances[member];
//             } else {
//                 totalHBAR += lockedCollateralBalances[member];
//             }
//         }
        
//         // Convert HBAR to USDC equivalent for unified calculation
//         // This would require a price oracle in production
//         return totalUSDC + (totalHBAR * _getHBARToUSDCRate() / 1e8);
//     }
    
//     function _getHBARToUSDCRate() internal pure returns (uint256) {
//         // Placeholder - in production, use Chainlink or similar oracle
//         return 5e16; // Assuming 1 HBAR = 0.05 USDC (5 cents)
//     }
    
//     function _removeFromActiveList(address member) internal {
//         for (uint256 i = 0; i < activeMembersList.length; i++) {
//             if (activeMembersList[i] == member) {
//                 activeMembersList[i] = activeMembersList[activeMembersList.length - 1];
//                 activeMembersList.pop();
//                 break;
//             }
//         }
//     }
    
//     // ============ VIEW FUNCTIONS ============
    
//     /**
//      * @dev Get member's queue position and estimated wait time
//      */
//     function getQueueInfo(address member) 
//         external 
//         view 
//         returns (uint256 position, uint256 estimatedCyclesWait) 
//     {
//         Member memory memberInfo = members[member];
//         position = memberInfo.queueNumber;
        
//         if (position < nextPayoutPosition) {
//             estimatedCyclesWait = 0; // Already received or currently eligible
//         } else {
//             estimatedCyclesWait = position - nextPayoutPosition;
//         }
//     }
    
//     /**
//      * @dev Get contract statistics
//      */
//     function getContractStats() 
//         external 
//         view 
//         returns (
//             uint256 totalMembers,
//             uint256 activeMembers,
//             uint256 totalCollateralUSDC,
//             uint256 totalCollateralHBAR,
//             uint256 contractBalanceUSDC,
//             uint256 contractBalanceHBAR,
//             uint256 currentQueuePosition,
//             PaymentToken activeToken
//         ) 
//     {
//         totalMembers = nextQueueNumber - 1;
//         activeMembers = activeMembersList.length;
        
//         // Calculate collateral by token type
//         for (uint256 i = 0; i < activeMembersList.length; i++) {
//             address member = activeMembersList[i];
//             Member memory memberInfo = members[member];
            
//             if (memberInfo.preferredToken == PaymentToken.USDC) {
//                 totalCollateralUSDC += lockedCollateralBalances[member];
//             } else {
//                 totalCollateralHBAR += lockedCollateralBalances[member];
//             }
//         }
        
//         contractBalanceUSDC = USDC.balanceOf(address(this));
//         contractBalanceHBAR = HBAR.balanceOf(address(this));
//         currentQueuePosition = nextPayoutPosition;
//         activeToken = activePaymentToken;
//     }
    
//     /**
//      * @dev Get member's complete information
//      */
//     function getMemberInfo(address member) 
//         external 
//         view 
//         returns (
//             Member memory memberInfo, 
//             uint256 pendingPenalty,
//             uint256 effectiveVotingPower
//         ) 
//     {
//         memberInfo = members[member];
//         pendingPenalty = pendingPenalties[member];
//         effectiveVotingPower = balanceOf(member);
//     }
    
//     /**
//      * @dev Check if member needs to make payment
//      */
//     function needsToPayThisCycle(address member) external view returns (bool) {
//         Member memory memberInfo = members[member];
//         return memberInfo.isActive && memberInfo.lastPaymentCycle < currentCycle;
//     }
    
//     /**
//      * @dev Get governance proposal details
//      */
//     function getProposal(uint256 proposalId)
//         external
//         view
//         returns (
//             string memory description,
//             uint256 forVotes,
//             uint256 againstVotes,
//             uint256 abstainVotes,
//             uint256 proposalEndTime,
//             bool executed,
//             bytes memory proposalData
//         )
//     {
//         GovernanceProposal storage proposal = proposals[proposalId];
//         return (
//             proposal.description,
//             proposal.forVotes,
//             proposal.againstVotes,
//             proposal.abstainVotes,
//             proposal.proposalEndTime,
//             proposal.executed,
//             proposal.proposalData
//         );
//     }
    
//     /**
//      * @dev Check if an address has voted on a proposal
//      */
//     function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
//         return proposals[proposalId].hasVoted[voter];
//     }
    
//     /**
//      * @dev Get token configuration
//      */
//     function getTokenConfig(PaymentToken token) 
//         external 
//         view 
//         returns (TokenConfig memory) 
//     {
//         return tokenConfigs[token];
//     }
    
//     /**
//      * @dev Get current governance settings
//      */
//     function getGovernanceSettings()
//         external
//         view
//         returns (
//             uint256 proposalThreshold,
//             uint256 votingPeriod,
//             uint256 currentPenaltyRate,
//             uint256 totalProposals
//         )
//     {
//         return (
//             PROPOSAL_THRESHOLD,
//             VOTING_PERIOD,
//             penaltyRate,
//             proposalCount
//         );
//     }
    
//     /**
//      * @dev Calculate total seizable assets in case of default (V2 security model)
//      * @param defaulterAddress The defaulting member
//      */
//     function calculateSeizableAssets(address defaulterAddress) 
//         external 
//         view 
//         returns (
//             uint256 totalSeizable, 
//             uint256 collateralSeized, 
//             uint256 paymentsSeized
//         ) 
//     {
//         Member memory defaulter = members[defaulterAddress];
//         address guarantorAddr = defaulter.guarantor;
        
//         if (guarantorAddr == address(0)) {
//             return (0, 0, 0);
//         }
        
//         Member memory guarantor = members[guarantorAddr];
        
//         // 1. Calculate collateral seizure
//         collateralSeized = lockedCollateralBalances[defaulterAddress] + 
//                           lockedCollateralBalances[guarantorAddr];
        
//         // 2. Calculate past payments seizure
//         paymentsSeized = 0;
        
//         // Defaulter's past payments
//         for (uint256 i = 0; i < defaulter.pastPayments.length; i++) {
//             paymentsSeized += defaulter.pastPayments[i];
//         }
        
//         // Guarantor's past payments
//         for (uint256 i = 0; i < guarantor.pastPayments.length; i++) {
//             paymentsSeized += guarantor.pastPayments[i];
//         }
        
//         totalSeizable = collateralSeized + paymentsSeized;
//     }
    
//     /**
//      * @dev Get V2 collateral requirements for demonstration
//      */
//     function getCollateralDemo(uint256 participants, uint256 monthlyPayment) 
//         external 
//         pure 
//         returns (uint256[] memory positions, uint256[] memory collaterals) 
//     {
//         positions = new uint256[](participants);
//         collaterals = new uint256[](participants);
        
//         for (uint256 i = 1; i <= participants; i++) {
//             positions[i-1] = i;
//             collaterals[i-1] = calculateRequiredCollateral(i, monthlyPayment, participants);
//         }
//     }
    
//     // ============ ADMIN FUNCTIONS ============
    
//     /**
//      * @dev Emergency withdrawal (only owner) - Multi-token support
//      */
//     function emergencyWithdraw(PaymentToken token) external onlyOwner {
//         IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
//         uint256 balance = tokenContract.balanceOf(address(this));
//         tokenContract.transfer(owner(), balance);
//     }
    
//     /**
//      * @dev Update cycle duration (only owner or governance)
//      */
//     function updateCycleDuration(uint256 newDuration) external {
//         require(msg.sender == owner() || msg.sender == address(this), "Unauthorized");
//         // Implementation for changing cycle duration
//         // This would require careful migration of existing cycles
//     }
    
//     /**
//      * @dev Emergency pause (only owner)
//      */
//     function emergencyPause() external onlyOwner {
//         // Implement pause functionality for emergency situations
//         // This would prevent new joins and payments during emergencies
//     }
    
//     /**
//      * @dev Batch process defaults (only owner) - Gas optimization
//      */
//     function batchHandleDefaults(address[] calldata defaulters) external onlyOwner {
//         for (uint256 i = 0; i < defaulters.length; i++) {
//             address defaulter = defaulters[i];
//             Member storage member = members[defaulter];
            
//             if (member.isActive && member.lastPaymentCycle < currentCycle) {
//                 uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
//                 TokenConfig memory config = tokenConfigs[member.preferredToken];
//                 uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
                
//                 pendingPenalties[defaulter] += penalty;
//                 member.defaultCount++;
//                 _updateReputationScore(defaulter, false);
                
//                 // V2: Execute seizure for severe defaults
//                 if (cyclesMissed >= 3) {
//                     _executeSeizure(defaulter);
//                 }
                
//                 emit MemberDefaulted(defaulter, currentCycle, penalty);
//             }
//         }
//     }
    
//     /**
//      * @dev Update token configuration (governance only)
//      */
//     function updateTokenConfig(
//         PaymentToken token,
//         uint256 monthlyPayment,
//         bool isActive
//     ) external {
//         require(msg.sender == address(this), "Only governance");
//         tokenConfigs[token].monthlyPayment = monthlyPayment;
//         tokenConfigs[token].isActive = isActive;
//     }
// }