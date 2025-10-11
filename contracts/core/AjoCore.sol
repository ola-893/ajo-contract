// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/AjoInterfaces.sol";
import "../hedera/hedera-token-service/HederaTokenService.sol";
import "../hedera/HederaResponseCodes.sol";

/**
 * @title AjoCore
 * @notice Core coordinator for Ajo savings circles with HTS integration
 * @dev Manages member lifecycle, payments, and coordinates with sub-contracts
 * 
 * Architecture:
 * - AjoCore: Orchestrates all operations (INHERITS HederaTokenService)
 * - AjoMembers: Member data storage
 * - AjoCollateral: Collateral management with HTS
 * - AjoPayments: Payment processing with HTS
 * - AjoGovernance: HCS-based governance
 * - AjoSchedule: HSS scheduling (dedicated contract)
 * 
 * Key Changes from Original:
 * ✅ Inherits from HederaTokenService instead of calling it externally
 * ✅ Removed HTSHelper library - using direct HTS calls
 * ✅ Removed hederaTokenService state variable
 * ✅ Direct access to HTS precompile functions via inheritance
 * 
 * Key Features:
 * - HTS-native token operations via inheritance
 * - Comprehensive member lifecycle management
 * - Default handling with freeze/transfer
 * - Emergency controls and pause functionality
 */
contract AjoCore is 
    IAjoCore, 
    ReentrancyGuard, 
    Ownable, 
    Initializable,
    HederaTokenService  // ✅ KEY CHANGE: Inherit from HederaTokenService
{
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
    
    IAjoMembers public membersContract;
    IAjoCollateral public collateralContract;
    IAjoPayments public paymentsContract;
    IAjoGovernance public governanceContract;
    IAjoSchedule public scheduleContract;
    
    // ✅ REMOVED: address public hederaTokenService; 
    // No longer needed - inherited from HederaTokenService base contract
    
    bytes32 public hcsTopicId;
    
    uint256 public constant CYCLE_DURATION = 30 days;
    uint256 public constant FIXED_TOTAL_PARTICIPANTS = 10;
    
    uint256 public nextQueueNumber = 1;
    uint256 public lastCycleTimestamp;
    bool public paused;
    bool private isFirstCycleComplete;
    
    // HTS token addresses
    bool public usesHtsTokens;
    address public usdcHtsToken;
    address public hbarHtsToken;
    
    // Local mappings for quick lookups
    mapping(uint256 => address) public queuePositions;
    mapping(uint256 => address) public guarantorAssignments;
    address[] public activeMembersList;
    
    // ============ EVENTS ============
    
    event CycleAdvanced(uint256 newCycle, uint256 timestamp);
    event ContractsInitialized(address members, address collateral, address payments, address governance, address schedule);
    event MemberJoined(address indexed member, uint256 queueNumber, uint256 collateral, PaymentToken token);
    event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
    event AjoFull(address indexed ajoContract, uint256 timestamp);
    event Paused(address account);
    event Unpaused(address account);
    event HtsAssociationAttempt(address indexed member, address indexed token, int64 responseCode);
    event HtsTransferAttempt(address indexed token, address indexed from, address indexed to, int64 amount, int64 responseCode);
    event HtsFreezeAttempt(address indexed token, address indexed account, int64 responseCode);
    
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
    error HtsAssociationRequired();
    error HtsAssociationFailed(int64 responseCode);
    // error HtsTransferFailed(int64 responseCode);
    error HtsOperationFailed(string operation, int64 responseCode);
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZATION ============
    
    /**
     * @notice Initialize the core contract (called by factory)
     * @param _usdc USDC token address (ERC20 or HTS)
     * @param _whbar WHBAR token address (ERC20 or HTS)
     * @param _ajoMembers Members contract address
     * @param _ajoCollateral Collateral contract address
     * @param _ajoPayments Payments contract address
     * @param _ajoGovernance Governance contract address
     * @param _ajoSchedule Schedule contract address
     * @param _hederaTokenService DEPRECATED - kept for interface compatibility only
     * @param _hcsTopicId HCS topic for governance
     */
    function initialize(
        address _usdc,
        address _whbar,
        address _ajoMembers,
        address _ajoCollateral,
        address _ajoPayments,
        address _ajoGovernance,
        address _ajoSchedule,
        address _hederaTokenService, // ✅ Ignored - kept for interface compatibility
        bytes32 _hcsTopicId
    ) external override initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_whbar != address(0), "Invalid HBAR address");
        require(_ajoMembers != address(0), "Invalid members contract");
        require(_ajoCollateral != address(0), "Invalid collateral contract");
        require(_ajoPayments != address(0), "Invalid payments contract");
        require(_ajoGovernance != address(0), "Invalid governance contract");
        require(_ajoSchedule != address(0), "Invalid schedule contract");
        // ✅ No longer validating _hederaTokenService - we inherit the functionality
        
        _transferOwnership(msg.sender);
        
        // Set token contracts
        USDC = IERC20(_usdc);
        HBAR = IERC20(_whbar);
        
        // Configure HTS
        usesHtsTokens = true;
        usdcHtsToken = _usdc;
        hbarHtsToken = _whbar;
        hcsTopicId = _hcsTopicId;
        
        // Set sub-contracts
        membersContract = IAjoMembers(_ajoMembers);
        collateralContract = IAjoCollateral(_ajoCollateral);
        paymentsContract = IAjoPayments(_ajoPayments);
        governanceContract = IAjoGovernance(_ajoGovernance);
        scheduleContract = IAjoSchedule(_ajoSchedule);
        
        // Initialize state variables
        nextQueueNumber = 1;
        lastCycleTimestamp = block.timestamp;
        
        emit ContractsInitialized(_ajoMembers, _ajoCollateral, _ajoPayments, _ajoGovernance, _ajoSchedule);
    }
    
    // ============ HTS VERIFICATION ============
    
    /**
     * @notice Verify HTS setup is valid
     * @return isValid Whether setup is valid
     * @return reason Reason if invalid
     */
    function verifyHtsSetup() external view override returns (bool isValid, string memory reason) {
        if (!usesHtsTokens) {
            return (true, "Using standard ERC20 tokens");
        }
        
        if (usdcHtsToken == address(0)) {
            return (false, "USDC HTS token not set");
        }
        
        if (hbarHtsToken == address(0)) {
            return (false, "HBAR HTS token not set");
        }
        
        return (true, "HTS configured correctly");
    }
    
    /**
     * @notice Get HTS token information
     * @param token Token type (USDC or HBAR)
     * @return HTS token information struct
     */
    function getHtsTokenInfo(PaymentToken token) external view override returns (HtsTokenInfo memory) {
        require(usesHtsTokens, "Not using HTS");
        
        address tokenAddress = (token == PaymentToken.USDC) ? usdcHtsToken : hbarHtsToken;
        string memory name = (token == PaymentToken.USDC) ? "USDC" : "WHBAR";
        string memory symbol = (token == PaymentToken.USDC) ? "USDC" : "WHBAR";
        
        return HtsTokenInfo({
            tokenAddress: tokenAddress,
            tokenId: bytes32(uint256(uint160(tokenAddress))),
            name: name,
            symbol: symbol,
            decimals: 6,
            totalSupply: 0,
            hasFreezeKey: true,
            hasWipeKey: false,
            hasSupplyKey: false,
            hasPauseKey: true,
            treasury: address(this)
        });
    }
    
    /**
     * @notice Check if member is associated with HTS tokens
     * @param member Member address
     * @return usdcAssociated Whether USDC is associated
     * @return hbarAssociated Whether HBAR is associated
     */
    function isHtsAssociated(address member) external view override returns (bool usdcAssociated, bool hbarAssociated) {
        if (!usesHtsTokens) {
            return (false, false);
        }
        
        // For view functions, we check the member's HTS status from our records
        Member memory memberData = membersContract.getMember(member);
        return (memberData.isHtsAssociated, memberData.isHtsAssociated);
    }
    
    /**
     * @notice Get HTS transfer status for member
     * @param member Member address
     * @param token Token type
     * @return isAssociated Whether token is associated
     * @return isFrozen Whether account is frozen
     * @return canReceive Whether can receive tokens
     * @return canSend Whether can send tokens
     */
    function getHtsTransferStatus(address member, PaymentToken token) 
        external 
        view 
        override 
        returns (bool isAssociated, bool isFrozen, bool canReceive, bool canSend) 
    {
        if (!usesHtsTokens) {
            return (false, false, false, false);
        }
        
        Member memory memberData = membersContract.getMember(member);
        isAssociated = memberData.isHtsAssociated;
        isFrozen = memberData.isFrozen;
        canReceive = isAssociated && !isFrozen;
        canSend = isAssociated && !isFrozen;
    }
    
    // ============ HTS HELPER FUNCTIONS (Using Inherited HederaTokenService) ============
    
    /**
     * @notice Associate member with HTS token
     * @dev Uses inherited associateToken function from HederaTokenService
     * @param member Member address to associate
     * @param token Token address to associate
     * @return responseCode HTS response code
     */
    function _associateTokenInternal(address member, address token) internal returns (int64 responseCode) {
        // ✅ Direct call to inherited HederaTokenService function
        int256 responseCode = associateToken(member, token);
        
        emit HtsAssociationAttempt(member, token, int64(responseCode));
        
        // Handle TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT as success
        if (responseCode == HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT) {
            return HederaResponseCodes.SUCCESS;
        }
        
        return int64(responseCode);
    }
    
    /**
     * @notice Transfer HTS tokens
     * @dev Uses inherited transferToken function from HederaTokenService
     * @param token Token address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer (as int64)
     * @return responseCode HTS response code
     */
    function _transferTokenInternal(
        address token,
        address from,
        address to,
        int64 amount
    ) internal returns (int64 responseCode) {
        // ✅ Direct call to inherited HederaTokenService function
        int256 responseCode = transferToken(token, from, to, amount);
        
        emit HtsTransferAttempt(token, from, to, amount, int64(responseCode));
        
        return int64(responseCode);
    }
    
    /**
     * @notice Check if account is frozen for token
     * @dev Uses inherited isFrozen function from HederaTokenService
     * @param token Token address
     * @param account Account to check
     * @return responseCode HTS response code
     * @return frozen Whether account is frozen
     */
    function _checkFrozenStatus(address token, address account) 
        internal 
        returns (int64 responseCode, bool frozen) 
    {
        // ✅ Direct call to inherited HederaTokenService function
        return isFrozen(token, account);
    }
    
    /**
     * @notice Freeze token account
     * @dev Uses inherited freezeToken function from HederaTokenService
     * @param token Token address
     * @param account Account to freeze
     * @return responseCode HTS response code
     */
    function _freezeTokenInternal(address token, address account) internal returns (int64 responseCode) {
        // ✅ Direct call to inherited HederaTokenService function
        responseCode = freezeToken(token, account);
        
        emit HtsFreezeAttempt(token, account, responseCode);
        
        return responseCode;
    }
    
    /**
     * @notice Unfreeze token account
     * @dev Uses inherited unfreezeToken function from HederaTokenService
     * @param token Token address
     * @param account Account to unfreeze
     * @return responseCode HTS response code
     */
    function _unfreezeTokenInternal(address token, address account) internal returns (int64 responseCode) {
        // ✅ Direct call to inherited HederaTokenService function
        responseCode = unfreezeToken(token, account);
        
        emit HtsFreezeAttempt(token, account, responseCode);
        
        return responseCode;
    }
    
    // ============ MEMBER LIFECYCLE ============
    
    /**
     * @notice Join the Ajo circle
     * @param tokenChoice Preferred payment token (USDC or HBAR)
     * @return collateralResult HTS transfer result for collateral
     */
    function joinAjo(PaymentToken tokenChoice) 
        external 
        override 
        nonReentrant 
        returns (HtsTransferResult memory collateralResult) 
    {
        Member memory existingMember = membersContract.getMember(msg.sender);
        if (existingMember.isActive) revert MemberAlreadyExists();
        
        if (nextQueueNumber > FIXED_TOTAL_PARTICIPANTS) revert AjoCapacityReached();
        
        TokenConfig memory config = paymentsContract.getTokenConfig(tokenChoice);
        if (!config.isActive) revert TokenNotSupported();
        if (config.monthlyPayment == 0) revert InvalidTokenConfiguration();
        
        // ✅ HTS Association - Using inherited HederaTokenService function
        if (usesHtsTokens) {
            address tokenAddress = (tokenChoice == PaymentToken.USDC) ? usdcHtsToken : hbarHtsToken;
            
            // Associate the token with the member
            int64 associateResponse = _associateTokenInternal(msg.sender, tokenAddress);
            
            if (associateResponse != HederaResponseCodes.SUCCESS) {
                revert HtsAssociationFailed(associateResponse);
            }
            
            // Update member's HTS association status
            membersContract.updateHtsAssociationStatus(msg.sender, true);
        }
        
        // Calculate collateral
        uint256 requiredCollateral = collateralContract.calculateRequiredCollateral(
            nextQueueNumber,
            config.monthlyPayment,
            FIXED_TOTAL_PARTICIPANTS
        );
        
        // Calculate guarantor
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
        
        // Lock collateral
        if (requiredCollateral > 0) {
            collateralResult = collateralContract.lockCollateralHts(
                msg.sender, 
                requiredCollateral, 
                tokenChoice
            );
            
            if (!collateralResult.success) {
                revert CollateralTransferFailed();
            }
        } else {
            // No collateral required - return success result
            collateralResult = HtsTransferResult({
                responseCode: HederaResponseCodes.SUCCESS,
                success: true,
                errorMessage: ""
            });
        }
        
        // Calculate initial reputation
        uint256 initialReputation = _calculateInitialReputation(requiredCollateral, config.monthlyPayment);
        
        // Calculate guarantee position
        uint256 newMemberGuaranteePosition = 0;
        for (uint256 i = 1; i <= FIXED_TOTAL_PARTICIPANTS; i++) {
            uint256 theirGuarantor = collateralContract.calculateGuarantorPosition(i, FIXED_TOTAL_PARTICIPANTS);
            if (theirGuarantor == nextQueueNumber) {
                newMemberGuaranteePosition = i;
                break;
            }
        }
        
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
            guaranteePosition: newMemberGuaranteePosition,
            isHtsAssociated: usesHtsTokens,
            isFrozen: false
        });
        
        membersContract.addMember(msg.sender, newMember);
        
        queuePositions[nextQueueNumber] = msg.sender;
        activeMembersList.push(msg.sender);
        
        if (guarantorAddr != address(0)) {
            guarantorAssignments[nextQueueNumber] = guarantorAddr;
            emit GuarantorAssigned(msg.sender, guarantorAddr, nextQueueNumber, guarantorPos);
        }
        
        nextQueueNumber++;
        
        emit MemberJoined(msg.sender, newMember.queueNumber, requiredCollateral, tokenChoice);
        
        if (nextQueueNumber > FIXED_TOTAL_PARTICIPANTS) {
            emit AjoFull(address(this), block.timestamp);
            
            if (paymentsContract.getCurrentCycle() == 0) {
                paymentsContract.advanceCycle();
            }
        }
        
        return collateralResult;
    }
    
    /**
     * @notice Process monthly payment
     * @return HTS transfer result
     */
    function processPayment() 
        external 
        override 
        nonReentrant 
        returns (HtsTransferResult memory) 
    {
        Member memory member = membersContract.getMember(msg.sender);
        if (!member.isActive) revert MemberNotFound();
        
        TokenConfig memory config = paymentsContract.getTokenConfig(member.preferredToken);
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        HtsTransferResult memory result = paymentsContract.processPaymentHts(
            msg.sender, 
            config.monthlyPayment, 
            member.preferredToken
        );
        
        if (result.success) {
            membersContract.updateLastPaymentCycle(msg.sender, currentCycle);
        }
        
        return result;
    }
    
    /**
     * @notice Distribute payout to next recipient
     * @return HTS transfer result
     */
    function distributePayout() 
        external 
        override 
        nonReentrant 
        returns (HtsTransferResult memory) 
    {
        HtsTransferResult memory result;
        
        if (!isFirstCycleComplete) {
            (,, result) = paymentsContract.distributePayoutHts();
            _advanceCycle();
            isFirstCycleComplete = true;
        } else {
            if (block.timestamp >= lastCycleTimestamp + CYCLE_DURATION) {
                (,, result) = paymentsContract.distributePayoutHts();
                _advanceCycle();
            } else {
                revert InvalidCycle();
            }
        }
        
        return result;
    }
    
    /**
     * @notice Handle member default
     * @param defaulter Address of defaulting member
     * @return totalRecovered Total amount recovered from default
     */
    function handleDefault(address defaulter) 
        external 
        override 
        onlyOwner 
        returns (uint256 totalRecovered) 
    {
        Member memory member = membersContract.getMember(defaulter);
        if (!member.isActive) revert MemberNotFound();
        
        (totalRecovered,) = paymentsContract.handleDefaultHts(defaulter);
        
        governanceContract.updateReputationAndVotingPower(defaulter, false);
        
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
        
        if (cyclesMissed >= 3) {
            collateralContract.seizeCollateralHts(defaulter);
            membersContract.removeMember(defaulter);
            
            if (member.guarantor != address(0)) {
                membersContract.removeMember(member.guarantor);
            }
        }
        
        return totalRecovered;
    }
    
    /**
     * @notice Exit Ajo before receiving payout
     */
    function exitAjo() external override nonReentrant {
        Member memory member = membersContract.getMember(msg.sender);
        
        if (member.hasReceivedPayout) {
            revert Unauthorized();
        }
        
        uint256 exitPenalty = member.lockedCollateral / 10;
        uint256 returnAmount = member.lockedCollateral > exitPenalty ? member.lockedCollateral - exitPenalty : 0;
        
        membersContract.removeMember(msg.sender);
        governanceContract.updateReputationAndVotingPower(msg.sender, false);
        
        if (returnAmount > 0) {
            if (usesHtsTokens) {
                collateralContract.unlockCollateralHts(msg.sender, returnAmount, member.preferredToken);
            }
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
        effectiveVotingPower = governanceContract.getVotingPower(member);
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
            PaymentToken activeToken,
            bool _usesHtsTokens
        ) 
    {
        (
            totalMembers,
            activeMembers,
            totalCollateralUSDC,
            totalCollateralHBAR,
            contractBalanceUSDC,
            contractBalanceHBAR,
            currentQueuePosition,
            activeToken
        ) = membersContract.getContractStats();
        
        _usesHtsTokens = usesHtsTokens;
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
    
    function updateCycleDuration(uint256 /* newDuration */) external override onlyOwner {
        // CYCLE_DURATION is constant
    }
    
    function emergencyPause() external override onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    function batchHandleDefaults(address[] calldata defaulters) external override onlyOwner {
        paymentsContract.batchHandleDefaults(defaulters);
        
        uint256 currentCycle = paymentsContract.getCurrentCycle();
        
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            Member memory member = membersContract.getMember(defaulter);
            
            if (member.isActive) {
                governanceContract.updateReputationAndVotingPower(defaulter, false);
                
                uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
                if (cyclesMissed >= 3) {
                    collateralContract.seizeCollateralHts(defaulter);
                    membersContract.removeMember(defaulter);
                    
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
        if (monthlyPayment == 0) return 100;
        return 100 + ((collateral * 50) / monthlyPayment);
    }
}