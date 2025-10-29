// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/AjoInterfaces.sol";
import "../hedera/hedera-token-service/HederaTokenService.sol";
import "../hedera/HederaResponseCodes.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 

/**
 * @title AjoFactory
 * @notice Factory contract for creating Ajo instances with HTS + HSS support
 * @dev Uses EIP-1167 minimal proxies with five-phase initialization
 * 
 * KEY CHANGE: Now inherits from HederaTokenService instead of calling it externally
 * 
 * HTS Features:
 * - Can create HTS tokens (USDC/WHBAR) for all Ajos via inherited functions
 * - Each Ajo can use shared HTS tokens or standard ERC20
 * - Deploys AjoGovernance with HCS topic support
 * - User token association and funding management
 * 
 * HSS Features:
 * - Enable/disable scheduled payments per Ajo
 * - Track scheduling statistics across all Ajos
 * - Manage Hedera Schedule Service integration
 * 
 * Phases:
 * 1. Deploy proxies (minimal gas)
 * 2. Initialize Members + Governance + Create HCS topic
 * 3. Initialize Collateral + Payments
 * 4. Initialize Core + Token config + Activate
 * 5. Initialize AjoSchedule contract (if HSS enabled)
 */
contract AjoFactory is IAjoFactory, HederaTokenService {
    
    // ============ STATE VARIABLES ============
    struct AjoOperationalStatus {
        uint256 totalMembers;
        uint256 activeMembers;
        uint256 totalCollateralUSDC;
        uint256 totalCollateralHBAR;
        uint256 contractBalanceUSDC;
        uint256 contractBalanceHBAR;
        uint256 currentCycle;
        PaymentToken activeToken;
        bool canAcceptMembers;
        bool canProcessPayments;
        bool canDistributePayouts;
    }

    // Master implementation contracts
    address public ajoCoreImplementation;
    address public ajoMembersImplementation;
    address public ajoCollateralImplementation;
    address public ajoPaymentsImplementation;
    address public ajoGovernanceImplementation;
    address public ajoScheduleImplementation;
    
    // Token addresses (standard or HTS)
    address public USDC;
    address public WHBAR;
    
    bool public htsEnabled;
    bool public factoryTokensMinted;
    address public usdcHtsToken;
    address public hbarHtsToken;
    
    // HSS configuration
    address public hederaScheduleService; // 0x16b
    bool public hssEnabled;
    
    // HTS User Association Tracking
    mapping(address => bool) public userUsdcAssociated;
    mapping(address => bool) public userHbarAssociated;
    mapping(address => uint256) public userLastAssociationTime;
    
    // ============ AJO STORAGE (Split into mappings for gas efficiency) ============
    
    mapping(uint256 => address) private ajoCore;
    mapping(uint256 => address) private ajoMembers;
    mapping(uint256 => address) private ajoCollateral;
    mapping(uint256 => address) private ajoPayments;
    mapping(uint256 => address) private ajoGovernance;
    mapping(uint256 => address) private ajoSchedule;
    mapping(uint256 => address) private ajoCreator;
    mapping(uint256 => uint256) private ajoCreatedAt;
    mapping(uint256 => string) private ajoName;
    mapping(uint256 => bool) private ajoIsActive;
    mapping(uint256 => bool) private ajoUsesHtsTokens;
    mapping(uint256 => address) private ajoUsdcToken;
    mapping(uint256 => address) private ajoHbarToken;
    mapping(uint256 => bytes32) private ajoHcsTopicId;
    mapping(uint256 => bool) private ajoUsesScheduledPayments;
    mapping(uint256 => uint256) private ajoScheduledPaymentsCountMapping;
    
    // Additional state
    mapping(address => uint256[]) public creatorAjos;
    mapping(uint256 => uint8) public ajoInitializationPhase;
    mapping(uint256 => bool) public ajoSchedulingEnabled;
    mapping(uint256 => uint256) public ajoScheduledPaymentsCount;
    mapping(uint256 => uint256) public ajoExecutedScheduledPayments;
    mapping(uint256 => uint256) private ajoCycleDuration;
    mapping(uint256 => uint256) private ajoMonthlyPaymentUSDC;
    mapping(uint256 => uint256) private ajoMonthlyPaymentHBAR;
    address public defenderRelayerAddress; // Authorized Defender Relayer
    mapping(uint256 => bool) public ajoAutomationEnabled; // Per-Ajo automation status

    // ============ NEW EVENTS ============
    event DefenderRelayerSet(address indexed oldRelayer, address indexed newRelayer);
    event AjoAutomationEnabled(uint256 indexed ajoId, address indexed enabler);
    event AjoAutomationDisabled(uint256 indexed ajoId, address indexed disabler);
    event BatchAutomationSetup(uint256[] ajoIds, address relayerAddress);
    
    uint256 public totalAjos;
    uint256 private nextAjoId = 1;
    
    // Admin
    address public owner;
    
    // ============ EVENTS ============
    
    event AjoPhase1Completed(uint256 indexed ajoId, address indexed ajoCore);
    event AjoPhase2Completed(uint256 indexed ajoId);
    event AjoPhase3Completed(uint256 indexed ajoId);
    event AjoPhase4Completed(uint256 indexed ajoId);
    event AjoPhase5Completed(uint256 indexed ajoId);
    event AjoForceCompleted(uint256 indexed ajoId, address indexed completer, uint8 finalPhase);
     
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier validAjoId(uint256 ajoId) {
        require(ajoId > 0 && ajoId < nextAjoId, "Invalid Ajo ID");
        _;
    }
    
    modifier onlyCreatorOrOwner(uint256 ajoId) {
        require(
            ajoCreator[ajoId] == msg.sender || msg.sender == owner, 
            "Only creator or owner"
        );
        _;
    }
    
    modifier htsRequired() {
        require(htsEnabled, "HTS not enabled");
        require(usdcHtsToken != address(0) && hbarHtsToken != address(0), "HTS tokens not set");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        address _usdc,
        address _whbar,
        address _ajoCoreImpl,
        address _ajoMembersImpl,
        address _ajoCollateralImpl,
        address _ajoPaymentsImpl,
        address _ajoGovernanceImpl,
        address _ajoScheduleImpl,
        address _hederaTokenService, //  Kept for interface compatibility but not used
        address _hederaScheduleService
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_whbar != address(0), "Invalid WHBAR address");
        require(_ajoCoreImpl != address(0), "Invalid AjoCore implementation");
        require(_ajoMembersImpl != address(0), "Invalid AjoMembers implementation");
        require(_ajoCollateralImpl != address(0), "Invalid AjoCollateral implementation");
        require(_ajoPaymentsImpl != address(0), "Invalid AjoPayments implementation");
        require(_ajoGovernanceImpl != address(0), "Invalid AjoGovernance implementation");
        require(_ajoScheduleImpl != address(0), "Invalid AjoSchedule implementation");
        
        owner = msg.sender;
        USDC = _usdc;
        WHBAR = _whbar;
        ajoCoreImplementation = _ajoCoreImpl;
        ajoMembersImplementation = _ajoMembersImpl;
        ajoCollateralImplementation = _ajoCollateralImpl;
        ajoPaymentsImplementation = _ajoPaymentsImpl;
        ajoGovernanceImplementation = _ajoGovernanceImpl;
        ajoScheduleImplementation = _ajoScheduleImpl;
        
        htsEnabled = false; // Must explicitly enable after creating tokens
        
        // HSS configuration (optional)
        if (_hederaScheduleService != address(0)) {
            hederaScheduleService = _hederaScheduleService;
            hssEnabled = true;
        }
        
        emit MasterImplementationsSet(
            _ajoCoreImpl,
            _ajoMembersImpl,
            _ajoCollateralImpl,
            _ajoPaymentsImpl,
            _ajoGovernanceImpl,
            _ajoScheduleImpl
        );
        
        if (hssEnabled) {
            emit ScheduleServiceSet(_hederaScheduleService);
        }
    }
    
    // ============ INTERNAL HTS HELPER FUNCTIONS ============
    
    /**
     * @dev Get human-readable error message for HTS response code
     */
    function _getHtsErrorMessage(int responseCode) internal pure returns (string memory) {
        if (responseCode == 22) return "Success";
        if (responseCode == 111) return "Invalid token ID";
        if (responseCode == 15) return "Invalid account ID";
        if (responseCode == 164) return "Insufficient token balance";
        if (responseCode == 167) return "Token not associated to account";
        if (responseCode == 162) return "Account frozen for token";
        if (responseCode == 138) return "Token was deleted";
        if (responseCode == 7) return "Invalid signature";
        return "Unknown error";
    }
    
    /**
     * @dev Check if HTS operation was successful
     */
    function _isHtsSuccess(int responseCode) internal pure returns (bool) {
        return responseCode == HederaResponseCodes.SUCCESS;
    }
    
    // ============ HTS TOKEN CREATION (Using Inherited HederaTokenService) ============
    
   /**
     * @notice Create HTS tokens with auto-association enabled
     * @dev Factory becomes treasury and holds initial supply
     */
    function createHtsTokens() external payable override onlyOwner returns (
        address usdcToken,
        address hbarToken
    ) {
        require(!htsEnabled, "HTS tokens already created");
        require(msg.value >= 40 * 10**8, "Need 40 HBAR for token creation");
        
        //  Create USDC with auto-association
        IHederaTokenService.HederaToken memory usdcTokenConfig = _buildTokenConfigWithAutoAssociation(
            "USDC Stablecoin",
            "USDC",
            address(this),
            "USDC for Ajo.Save",
            6
        );
        
        (int usdcResponse, address usdcAddr) = _createFungibleTokenWithValue(
            usdcTokenConfig,
            1000000000 * 10**6, // 1B USDC initial supply
            6,
            20 * 10**8
        );
        
        require(_isHtsSuccess(usdcResponse), _getHtsErrorMessage(usdcResponse));
        usdcHtsToken = usdcAddr;
        emit HtsTokenCreated(usdcAddr, "USDC Stablecoin", "USDC", 6);
        
        //  Create WHBAR with auto-association
        IHederaTokenService.HederaToken memory hbarTokenConfig = _buildTokenConfigWithAutoAssociation(
            "Wrapped HBAR",
            "WHBAR",
            address(this),
            "WHBAR for Ajo.Save",
            8
        );
        
        (int hbarResponse, address hbarAddr) = _createFungibleTokenWithValue(
            hbarTokenConfig,
            1000000000 * 10**8, // 1B WHBAR initial supply
            8,
            20 * 10**8
        );
        
        require(_isHtsSuccess(hbarResponse), _getHtsErrorMessage(hbarResponse));
        hbarHtsToken = hbarAddr;
        emit HtsTokenCreated(hbarAddr, "Wrapped HBAR", "WHBAR", 8);
        
        // Enable HTS and mark tokens as minted
        htsEnabled = true;
        factoryTokensMinted = true;
        
        emit HtsTokensCreatedWithAutoAssociation(usdcAddr, hbarAddr);
        
        return (usdcAddr, hbarAddr);
    }
    
    /**
     * @notice Internal helper to create fungible token with HBAR value
     * @dev Uses low-level call to HTS precompile
     */
    function _createFungibleTokenWithValue(
        IHederaTokenService.HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals,
        uint256 hbarValue
    ) internal returns (int responseCode, address tokenAddress) {
        // Encode the function call
        bytes memory encodedCall = abi.encodeWithSelector(
            IHederaTokenService.createFungibleToken.selector,
            token,
            initialTotalSupply,
            decimals
        );
        
        // Make low-level call to HTS precompile with value
        address precompileAddress = address(0x167);
        (bool success, bytes memory result) = precompileAddress.call{value: hbarValue}(encodedCall);
        
        if (success && result.length > 0) {
            (responseCode, tokenAddress) = abi.decode(result, (int32, address));
        } else {
            responseCode = HederaResponseCodes.UNKNOWN;
            tokenAddress = address(0);
        }
        
        return (responseCode, tokenAddress);
    }
    
    /**
     * @notice Set pre-existing HTS tokens (alternative to creating new ones)
     * @dev Useful if tokens already exist on Hedera
     */
    function setHtsTokensForFactory(address _usdcHts, address _hbarHts) external override onlyOwner {
        require(_usdcHts != address(0), "Invalid USDC HTS");
        require(_hbarHts != address(0), "Invalid HBAR HTS");
        
        usdcHtsToken = _usdcHts;
        hbarHtsToken = _hbarHts;
        htsEnabled = true;
    }
    
    /**
     * @notice Get HTS token addresses
     */
    function getHtsTokenAddresses() external view override returns (address usdc, address hbar) {
        return (usdcHtsToken, hbarHtsToken);
    }
    
    /**
     * @notice Check if HTS is enabled
     */
    function isHtsEnabled() external view override returns (bool) {
        return htsEnabled;
    }
    
    // /**
    //  * @notice Get HTS token information
    //  */
    // function getHtsTokenInfo(address token) external view override returns (HtsTokenInfo memory) {
    //     require(htsEnabled, "HTS not enabled");
    //     require(token == usdcHtsToken || token == hbarHtsToken, "Invalid token");
        
    //     bool isUsdc = (token == usdcHtsToken);
        
    //     return HtsTokenInfo({
    //         tokenAddress: token,
    //         tokenId: bytes32(uint256(uint160(token))),
    //         name: isUsdc ? "USDC Stablecoin" : "Wrapped HBAR",
    //         symbol: isUsdc ? "USDC" : "WHBAR",
    //         decimals: isUsdc ? 6 : 8,
    //         totalSupply: 1000000000 * (isUsdc ? 10**6 : 10**8),
    //         hasFreezeKey: true,
    //         hasWipeKey: false,
    //         hasSupplyKey: false,
    //         hasPauseKey: true,
    //         treasury: address(this)
    //     });
    // }
    
    // ============ HTS USER MANAGEMENT FUNCTIONS ============
    
   /**
 * @notice Fund user with verified balance
 * @dev With auto-association, tokens transfer automatically
 * @dev Uses graceful error handling - does not revert on transfer failures
 */
function fundUserWithHtsTokens(
    address user,
    int64 usdcAmount,
    int64 hbarAmount
) 
    external 
    override 
    htsRequired 
    returns (bool usdcSuccess, bool hbarSuccess) 
{
    require(user != address(0), "Invalid user");
    require(usdcAmount > 0 || hbarAmount > 0, "No amount specified");
    require(factoryTokensMinted, "Factory tokens not minted");
    
    int64 usdcResponse = 0;
    int64 hbarResponse = 0;
    
    // Transfer USDC if requested
    if (usdcAmount > 0) {
        uint256 factoryUsdcBalance = IERC20(usdcHtsToken).balanceOf(address(this));
        
        // Check balance but don't revert - handle gracefully
        if (uint256(uint64(usdcAmount)) <= factoryUsdcBalance) {
            int usdcResp = transferToken(usdcHtsToken, address(this), user, usdcAmount);
            usdcResponse = int64(usdcResp);
            usdcSuccess = _isHtsSuccess(usdcResp);
            
            if (!usdcSuccess) {
                emit HtsTransferFailed(
                    user, 
                    usdcHtsToken, 
                    uint256(uint64(usdcAmount)), 
                    usdcResponse, 
                    _getHtsErrorMessage(usdcResp)
                );
            }
        } else {
            // Insufficient balance - set error code and fail gracefully
            usdcResponse = HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
            usdcSuccess = false;
            emit HtsTransferFailed(
                user, 
                usdcHtsToken, 
                uint256(uint64(usdcAmount)), 
                usdcResponse, 
                "Insufficient factory balance"
            );
        }
    } else {
        usdcSuccess = true; // No USDC requested = success
    }
    
    // Transfer WHBAR if requested
    if (hbarAmount > 0) {
        uint256 factoryHbarBalance = IERC20(hbarHtsToken).balanceOf(address(this));
        
        // Check balance but don't revert - handle gracefully
        if (uint256(uint64(hbarAmount)) <= factoryHbarBalance) {
            int hbarResp = transferToken(hbarHtsToken, address(this), user, hbarAmount);
            hbarResponse = int64(hbarResp);
            hbarSuccess = _isHtsSuccess(hbarResp);
            
            if (!hbarSuccess) {
                emit HtsTransferFailed(
                    user, 
                    hbarHtsToken, 
                    uint256(uint64(hbarAmount)), 
                    hbarResponse, 
                    _getHtsErrorMessage(hbarResp)
                );
            }
        } else {
            // Insufficient balance - set error code and fail gracefully
            hbarResponse = HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
            hbarSuccess = false;
            emit HtsTransferFailed(
                user, 
                hbarHtsToken, 
                uint256(uint64(hbarAmount)), 
                hbarResponse, 
                "Insufficient factory balance"
            );
        }
    } else {
        hbarSuccess = true; // No WHBAR requested = success
    }
    
    // Always emit funding event with results (success or failure)
    emit UserHtsFunded(
        user, 
        usdcAmount > 0 ? uint256(uint64(usdcAmount)) : 0, 
        hbarAmount > 0 ? uint256(uint64(hbarAmount)) : 0, 
        usdcResponse, 
        hbarResponse
    );
    
    return (usdcSuccess, hbarSuccess);
}
    
    
    /**
     * @notice Check if a user is associated with HTS tokens
     * @param user Address of the user to check
     * @return usdcAssociated Whether user is associated with USDC
     * @return hbarAssociated Whether user is associated with WHBAR
     * @return lastAssociationTime Timestamp of last association
     */
    function checkUserHtsAssociation(address user) 
        external 
        view 
        override 
        htsRequired 
        returns (
            bool usdcAssociated,
            bool hbarAssociated,
            uint256 lastAssociationTime
        ) 
    {
        return (
            userUsdcAssociated[user],
            userHbarAssociated[user],
            userLastAssociationTime[user]
        );
    }
    
//     /**
//      * @notice Get HTS token balances for a user
//      * @param user Address of the user
//      * @return usdcBalance User's USDC balance
//      * @return hbarBalance User's WHBAR balance
//      */
//    function getUserHtsBalance(address user) 
//     external 
//     view 
//     override 
//     htsRequired 
//     returns (uint256 usdcBalance, uint256 hbarBalance) 
// {
//     require(user != address(0), "Invalid user address");
    
//     // Query USDC balance using low-level call
//     usdcBalance = _getHtsTokenBalance(usdcHtsToken, user);
    
//     // Query WHBAR balance using low-level call
//     hbarBalance = _getHtsTokenBalance(hbarHtsToken, user);
    
//     return (usdcBalance, hbarBalance);
// }

/**
 * @dev Internal helper to get HTS token balance using low-level call
 * @param token The HTS token address
 * @param account The account to query
 * @return balance The token balance
 */
function _getHtsTokenBalance(address token, address account) internal view returns (uint256 balance) {
    // Use standard ERC20 balanceOf since HTS tokens are ERC20-compatible
    // This works because HTS tokens implement the ERC20 interface
    try IERC20(token).balanceOf(account) returns (uint256 bal) {
        return bal;
    } catch {
        return 0;
    }
}

    
    // /**
    //  * @notice Check if a user is ready to participate in HTS-based Ajos
    //  * @dev User must be associated with tokens and have minimum balances
    //  * @param user Address of the user to check
    //  * @param minUsdcBalance Minimum required USDC balance
    //  * @param minHbarBalance Minimum required WHBAR balance
    //  * @return isReady Whether user meets all requirements
    //  * @return usdcReady Whether USDC requirements are met
    //  * @return hbarReady Whether WHBAR requirements are met
    //  */
    // function isUserReadyForHts(
    //     address user,
    //     uint256 minUsdcBalance,
    //     uint256 minHbarBalance
    // ) 
    //     external 
    //     view 
    //     override 
    //     htsRequired 
    //     returns (
    //         bool isReady,
    //         bool usdcReady,
    //         bool hbarReady
    //     ) 
    // {
    //     require(user != address(0), "Invalid user address");
        
    //     // Check associations
    //     bool usdcAssoc = userUsdcAssociated[user];
    //     bool hbarAssoc = userHbarAssociated[user];
        
    //     // Check balances
    //     uint256 usdcBalance = 0;
    //     uint256 hbarBalance = 0;
        
    //     (int usdcResponse, uint256 usdcBal) = this.balanceOf(usdcHtsToken, user);
    //     if (_isHtsSuccess(usdcResponse)) {
    //         usdcBalance = usdcBal;
    //     }
        
    //     (int hbarResponse, uint256 hbarBal) = this.balanceOf(hbarHtsToken, user);
    //     if (_isHtsSuccess(hbarResponse)) {
    //         hbarBalance = hbarBal;
    //     }
        
    //     usdcReady = usdcAssoc && usdcBalance >= minUsdcBalance;
    //     hbarReady = hbarAssoc && hbarBalance >= minHbarBalance;
    //     isReady = usdcReady && hbarReady;
        
    //     return (isReady, usdcReady, hbarReady);
    // }

   // ============ HTS APPROVAL FUNCTIONS ============

/**
 * @notice Approve HTS token spending for a user
 * @dev Uses inherited HederaTokenService approve() function
 * @param token The HTS token address (USDC or WHBAR)
 * @param spender The address authorized to spend tokens
 * @param amount The amount to approve
 * @return success Whether the approval succeeded
 */
function approveHtsToken(
    address token,
    address spender,
    uint256 amount
) external htsRequired returns (bool success) {
    require(token == usdcHtsToken || token == hbarHtsToken, "Invalid HTS token");
    require(spender != address(0), "Invalid spender");
    require(amount > 0, "Amount must be greater than zero");
    
    // Use inherited approve() from HederaTokenService
    // msg.sender is automatically the token owner
    int responseCode = approve(token, spender, amount);
    success = _isHtsSuccess(responseCode);
    
    if (!success) {
        emit HtsApprovalFailed(msg.sender, token, spender, amount, int64(responseCode), _getHtsErrorMessage(responseCode));
        revert(_getHtsErrorMessage(responseCode));
    }
    
    // Emit success event
    emit HtsTokenApproved(msg.sender, token, spender, amount);
    
    return success;
}

/**
 * @notice Check HTS token allowance
 * @dev Uses inherited allowance() from HederaTokenService
 * @param token The HTS token address
 * @param owner The token owner
 * @param spender The spender address
 * @return currentAllowance The current allowance amount
 */
function getHtsAllowance(
    address token,
    address owner,
    address spender
) external htsRequired returns (uint256 currentAllowance) {
    require(token == usdcHtsToken || token == hbarHtsToken, "Invalid HTS token");
    
    (int responseCode, uint256 allowanceAmount) = allowance(token, owner, spender);
    
    if (_isHtsSuccess(responseCode)) {
        return allowanceAmount;
    }
    
    return 0;
}

    //============ HSS CONFIGURATION ============
    
    /**
     * @notice Set Hedera Schedule Service address
     */
    function setScheduleServiceAddress(address _scheduleService) external override onlyOwner {
        require(_scheduleService != address(0), "Invalid HSS address");
        hederaScheduleService = _scheduleService;
        hssEnabled = true;
        
        emit ScheduleServiceSet(_scheduleService);
    }
    
    // /**
    //  * @notice Get Hedera Schedule Service address
    //  */
    // function getScheduleServiceAddress() external view override returns (address) {
    //     return hederaScheduleService;
    // }
    
    /**
     * @notice Get AjoSchedule contract address for a specific Ajo
     */
    function getAjoScheduleContract(uint256 ajoId) external view override validAjoId(ajoId) returns (address) {
        return ajoSchedule[ajoId];
    }

    
    
    /**
     * @notice Enable scheduled payments for an Ajo
     */
    function enableScheduledPaymentsForAjo(uint256 ajoId) external override validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(hssEnabled, "HSS not enabled");
        require(ajoInitializationPhase[ajoId] >= 5, "Ajo not fully initialized");
        require(!ajoSchedulingEnabled[ajoId], "Already enabled");
        
        ajoSchedulingEnabled[ajoId] = true;
        ajoUsesScheduledPayments[ajoId] = true;
        
        emit ScheduledPaymentsEnabled(ajoId);
    }
    
    /**
     * @notice Disable scheduled payments for an Ajo
     */
    function disableScheduledPaymentsForAjo(uint256 ajoId) external override validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(ajoSchedulingEnabled[ajoId], "Not enabled");
        
        ajoSchedulingEnabled[ajoId] = false;
        ajoUsesScheduledPayments[ajoId] = false;
        
        emit ScheduledPaymentsDisabled(ajoId);
    }
    
    /**
     * @notice Get scheduling status for an Ajo
     */
    function getAjoSchedulingStatus(uint256 ajoId) 
        external 
        view 
        override 
        validAjoId(ajoId) 
        returns (
            bool isEnabled,
            uint256 scheduledPaymentsCountResult,
            uint256 executedCount
        ) 
    {
        isEnabled = ajoSchedulingEnabled[ajoId];
        scheduledPaymentsCountResult = ajoScheduledPaymentsCount[ajoId];
        executedCount = ajoExecutedScheduledPayments[ajoId];
        
        return (isEnabled, scheduledPaymentsCountResult, executedCount);
    }
    
    // /**
    //  * @notice Get all Ajos using scheduled payments
    //  */
    // function getAjosUsingScheduledPayments() external view override returns (uint256[] memory ajoIds) {
    //     uint256 count = 0;
        
    //     // Count enabled Ajos
    //     for (uint256 i = 1; i < nextAjoId; i++) {
    //         if (ajoSchedulingEnabled[i]) {
    //             count++;
    //         }
    //     }
        
    //     ajoIds = new uint256[](count);
    //     uint256 index = 0;
        
    //     for (uint256 i = 1; i < nextAjoId; i++) {
    //         if (ajoSchedulingEnabled[i]) {
    //             ajoIds[index] = i;
    //             index++;
    //         }
    //     }
        
    //     return ajoIds;
    // }
    
    //============ AJO CREATION (5-PHASE) ============
    
    /**
     * @notice Create a new Ajo instance (PHASE 1)
     * @dev Deploys minimal proxies only
     * @param _name Name for the Ajo instance
     * @param _useHtsTokens Whether to use HTS tokens (requires HTS setup)
     * @param _useScheduledPayments Whether to enable HSS scheduled payments
     * @return ajoId The ID of the created Ajo instance
     */
    function createAjo(
        string memory _name,
        bool _useHtsTokens,
        bool _useScheduledPayments,
        uint256 _cycleDuration,       
        uint256 _monthlyPaymentUSDC,   
        uint256 _monthlyPaymentHBAR    
    ) external override returns (uint256 ajoId) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(
            //_cycleDuration >= 1 days && 
            _cycleDuration <= 365 days, "Invalid cycle duration");
        require(_monthlyPaymentUSDC > 0 || _monthlyPaymentHBAR > 0, "At least one payment amount required");
        
        if (_useHtsTokens) {
            require(htsEnabled, "HTS not enabled");
        }
        
        if (_useScheduledPayments) {
            require(hssEnabled, "HSS not enabled");
            require(hederaScheduleService != address(0), "HSS not configured");
        }
        
        ajoId = nextAjoId++;
        
        // Deploy proxy contracts (minimal gas)
        address ajoMembersProxy = _deployProxy(ajoMembersImplementation, ajoId);
        address ajoGovernanceProxy = _deployProxy(ajoGovernanceImplementation, ajoId);
        address ajoCollateralProxy = _deployProxy(ajoCollateralImplementation, ajoId);
        address ajoPaymentsProxy = _deployProxy(ajoPaymentsImplementation, ajoId);
        address ajoCoreProxy = _deployProxy(ajoCoreImplementation, ajoId);
        address ajoScheduleProxy = _useScheduledPayments ? _deployProxy(ajoScheduleImplementation, ajoId) : address(0);
        
        // Determine token addresses
        address usdcAddr = _useHtsTokens ? usdcHtsToken : USDC;
        address hbarAddr = _useHtsTokens ? hbarHtsToken : WHBAR;
        
        // Store Ajo info in individual mappings
        ajoCore[ajoId] = ajoCoreProxy;
        ajoMembers[ajoId] = ajoMembersProxy;
        ajoCollateral[ajoId] = ajoCollateralProxy;
        ajoPayments[ajoId] = ajoPaymentsProxy;
        ajoGovernance[ajoId] = ajoGovernanceProxy;
        ajoSchedule[ajoId] = ajoScheduleProxy;
        ajoCreator[ajoId] = msg.sender;
        ajoCreatedAt[ajoId] = block.timestamp;
        ajoName[ajoId] = _name;
        ajoIsActive[ajoId] = false;
        ajoUsesHtsTokens[ajoId] = _useHtsTokens;
        ajoUsdcToken[ajoId] = usdcAddr;
        ajoHbarToken[ajoId] = hbarAddr;
        ajoHcsTopicId[ajoId] = bytes32(0);
        ajoUsesScheduledPayments[ajoId] = _useScheduledPayments;
        ajoScheduledPaymentsCountMapping[ajoId] = 0;
        
        // NEW: Store custom configuration
        ajoCycleDuration[ajoId] = _cycleDuration;
        ajoMonthlyPaymentUSDC[ajoId] = _monthlyPaymentUSDC;
        ajoMonthlyPaymentHBAR[ajoId] = _monthlyPaymentHBAR;
        
        creatorAjos[msg.sender].push(ajoId);
        totalAjos++;
        ajoInitializationPhase[ajoId] = 1;
        
        if (_useScheduledPayments) {
            ajoSchedulingEnabled[ajoId] = true;
        }
        
        emit AjoCreated(ajoId, msg.sender, ajoCoreProxy, _name, _useHtsTokens, _useScheduledPayments);
        emit AjoPhase1Completed(ajoId, ajoCoreProxy);
        
        return ajoId;
    }

    
    /**
     * @notice Complete Phase 2: Initialize Members + Governance, Create HCS topic
     * @dev HCS topic creation happens off-chain via SDK, then topic ID is passed here
     * @param ajoId The ID of the Ajo to initialize
     * @return hcsTopicId The HCS topic ID (passed from off-chain creation)
     */
        function initializeAjoPhase2(uint256 ajoId, bytes32 hcsTopicId) 
        public 
        override
        validAjoId(ajoId) 
        onlyCreatorOrOwner(ajoId) 
        returns (bytes32) 
        {
            require(ajoInitializationPhase[ajoId] == 1, "Phase 1 must be completed first");
            require(hcsTopicId != bytes32(0), "Invalid HCS topic ID"); // ✅ Validate it's real
            
            // Initialize AjoMembers
            IAjoMembers(ajoMembers[ajoId]).initialize(
                ajoCore[ajoId],
                ajoUsdcToken[ajoId],
                ajoHbarToken[ajoId]
            );
            
            // Store the REAL topic ID passed from frontend
            ajoHcsTopicId[ajoId] = hcsTopicId;
            
            // Initialize AjoGovernance with real topic ID
            IAjoGovernance(ajoGovernance[ajoId]).initialize(
                ajoCore[ajoId],
                ajoMembers[ajoId],
                ajoSchedule[ajoId],
                address(0),
                hcsTopicId
            );
            
            ajoInitializationPhase[ajoId] = 2;
            emit AjoPhase2Completed(ajoId);
            emit AjoInitializedPhase2(ajoId, hcsTopicId);
            
            return hcsTopicId;
        }
    
    /**
     * @notice Complete Phase 3: Initialize Collateral + Payments
     * @param ajoId The ID of the Ajo to initialize
     */
    function initializeAjoPhase3(uint256 ajoId) 
        public 
        override
        validAjoId(ajoId) 
        onlyCreatorOrOwner(ajoId) 
    {
        require(ajoInitializationPhase[ajoId] == 2, "Phase 2 must be completed first");
        
        //  Pass address(0) for HTS since contracts inherit it
        IAjoCollateral(ajoCollateral[ajoId]).initialize(
            ajoUsdcToken[ajoId],
            ajoHbarToken[ajoId],
            ajoCore[ajoId],
            ajoMembers[ajoId]
            // address(0) //  No longer needed
        );
        
        IAjoPayments(ajoPayments[ajoId]).initialize(
            ajoUsdcToken[ajoId],
            ajoHbarToken[ajoId],
            ajoCore[ajoId],
            ajoMembers[ajoId],
            ajoCollateral[ajoId]
            // address(0) //  No longer needed
        );
        
        ajoInitializationPhase[ajoId] = 3;
        emit AjoPhase3Completed(ajoId);
        emit AjoInitializedPhase3(ajoId);
    }
    
    /**
     * @notice Complete Phase 4: Initialize Core + Token config + Activate
     * @param ajoId The ID of the Ajo to initialize
     */
    function initializeAjoPhase4(uint256 ajoId) 
        public 
        override
        validAjoId(ajoId) 
        onlyCreatorOrOwner(ajoId) 
    {
        require(ajoInitializationPhase[ajoId] == 3, "Phase 3 must be completed first");
        
        // Initialize AjoCore with custom cycle duration
        IAjoCore(ajoCore[ajoId]).initialize(
            ajoUsdcToken[ajoId],
            ajoHbarToken[ajoId],
            ajoMembers[ajoId],
            ajoCollateral[ajoId],
            ajoPayments[ajoId],
            ajoGovernance[ajoId]
        );
        
        // Set cycle duration (NEW)
        IAjoCore(ajoCore[ajoId]).updateCycleDuration(ajoCycleDuration[ajoId]);
        
        // Set custom token configuration with stored values
        if (ajoMonthlyPaymentUSDC[ajoId] > 0) {
            IAjoCore(ajoCore[ajoId]).updateTokenConfig(
                PaymentToken.USDC,
                ajoMonthlyPaymentUSDC[ajoId],
                true
            );
        }
        
        if (ajoMonthlyPaymentHBAR[ajoId] > 0) {
            IAjoCore(ajoCore[ajoId]).updateTokenConfig(
                PaymentToken.HBAR,
                ajoMonthlyPaymentHBAR[ajoId],
                true
            );
        }
        
        // Mark as active
        ajoIsActive[ajoId] = true;
        ajoInitializationPhase[ajoId] = 4;
        
        emit AjoPhase4Completed(ajoId);
        emit AjoInitializedPhase4(ajoId);
    }
    
    /**
     * @notice Complete Phase 5: Initialize AjoSchedule contract (if HSS enabled)
     * @param ajoId The ID of the Ajo to initialize
     */
    function initializeAjoPhase5(uint256 ajoId) 
        public 
        override
        validAjoId(ajoId) 
        onlyCreatorOrOwner(ajoId) 
    {
        require(ajoInitializationPhase[ajoId] == 4, "Phase 4 must be completed first");
        
        // Only initialize if using scheduled payments
        if (ajoUsesScheduledPayments[ajoId] && ajoSchedule[ajoId] != address(0)) {
            IAjoSchedule(ajoSchedule[ajoId]).initialize(
                ajoCore[ajoId],
                ajoPayments[ajoId],
                ajoGovernance[ajoId],
                hederaScheduleService
            );
        }
        
        ajoInitializationPhase[ajoId] = 5;
        emit AjoPhase5Completed(ajoId);
        emit AjoInitializedPhase5(ajoId, ajoSchedule[ajoId]);
    }

    function getAjoConfiguration(uint256 ajoId) 
        external 
        view 
        validAjoId(ajoId) 
        returns (
            uint256 cycleDuration,
            uint256 monthlyPaymentUSDC,
            uint256 monthlyPaymentHBAR
        ) 
    {
        return (
            ajoCycleDuration[ajoId],
            ajoMonthlyPaymentUSDC[ajoId],
            ajoMonthlyPaymentHBAR[ajoId]
        );
    }
    
    // /**
    //  * @notice Complete all remaining phases in one transaction
    //  * @param ajoId The ID of the Ajo to complete
    //  * @param startFromPhase Which phase to start from
    //  */
    // function completeRemainingPhases(uint256 ajoId, uint8 startFromPhase) 
    //     external 
    //     validAjoId(ajoId) 
    //     onlyCreatorOrOwner(ajoId) 
    // {
    //     require(startFromPhase >= 2 && startFromPhase <= 5, "Invalid start phase");
    //     require(ajoInitializationPhase[ajoId] == startFromPhase - 1, "Previous phase not completed");
        
    //     if (startFromPhase <= 2 && ajoInitializationPhase[ajoId] < 2) {
    //         initializeAjoPhase2(ajoId);
    //     }
        
    //     if (startFromPhase <= 3 && ajoInitializationPhase[ajoId] < 3) {
    //         initializeAjoPhase3(ajoId);
    //     }
        
    //     if (startFromPhase <= 4 && ajoInitializationPhase[ajoId] < 4) {
    //         initializeAjoPhase4(ajoId);
    //     }
        
    //     if (startFromPhase <= 5 && ajoInitializationPhase[ajoId] < 5) {
    //         initializeAjoPhase5(ajoId);
    //     }
    // }
    
    // /**
    //  * @notice Force complete abandoned Ajo (public utility)
    //  * @param ajoId The abandoned Ajo to complete
    //  */
    // function forceCompleteAbandonedAjo(uint256 ajoId) external validAjoId(ajoId) {
    //     require(ajoInitializationPhase[ajoId] < 5, "Already fully initialized");
    //     require(block.timestamp > ajoCreatedAt[ajoId] + 24 hours, "Not abandoned yet");
        
    //     uint8 currentPhase = ajoInitializationPhase[ajoId];
        
    //     if (currentPhase == 1) {
    //         try this.initializeAjoPhase2(ajoId) {} catch {}
    //         currentPhase = 2;
    //     }
    //     if (currentPhase == 2) {
    //         try this.initializeAjoPhase3(ajoId) {} catch {}
    //         currentPhase = 3;
    //     }
    //     if (currentPhase == 3) {
    //         try this.initializeAjoPhase4(ajoId) {} catch {}
    //         currentPhase = 4;
    //     }
    //     if (currentPhase == 4) {
    //         try this.initializeAjoPhase5(ajoId) {} catch {}
    //         currentPhase = 5;
    //     }
        
    //     emit AjoForceCompleted(ajoId, msg.sender, currentPhase);
    // }
    
    //============ VIEW FUNCTIONS ============
    
    function getAjo(uint256 ajoId) 
        external 
        view 
        override 
        validAjoId(ajoId) 
        returns (AjoInfo memory info) 
    {
        return _buildAjoInfoFromMappings(ajoId);
    }
    
    function getAllAjos(uint256 offset, uint256 limit) 
        external 
        view 
        override
        returns (AjoInfo[] memory ajoInfos, bool hasMore) 
    {
        require(limit > 0 && limit <= 100, "Invalid limit");
        
        uint256 total = totalAjos;
        if (offset >= total) {
            return (new AjoInfo[](0), false);
        }
        
        uint256 remaining = total - offset;
        uint256 resultCount = remaining < limit ? remaining : limit;
        
        ajoInfos = new AjoInfo[](resultCount);
        
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 ajoIdToGet = offset + i + 1;
            ajoInfos[i] = _buildAjoInfoFromMappings(ajoIdToGet);
        }
        
        hasMore = offset + resultCount < total;
        return (ajoInfos, hasMore);
    }
    
    function getAjosByCreator(address creator) 
        external 
        view 
        override 
        returns (uint256[] memory ajoIds) 
    {
        return creatorAjos[creator];
    }
    


    // function getAjoCore(uint256 ajoId) 
    //     external 
    //     view 
    //     override 
    //     validAjoId(ajoId) 
    //     returns (address ajoCoreAddr) 
    // {
    //     return ajoCore[ajoId];
    // }
    
    function ajoStatus(uint256 ajoId) 
        external 
        view 
        override 
        returns (bool exists, bool isActive) 
    {
        if (ajoId == 0 || ajoId >= nextAjoId) {
            return (false, false);
        }
        
        bool isReady = ajoInitializationPhase[ajoId] >= 4;
        return (true, ajoIsActive[ajoId] && isReady);
    }
    
    // function getFactoryStats() 
    //     external 
    //     view 
    //     override 
    //     returns (uint256 totalCreated, uint256 activeCount) 
    // {
    //     totalCreated = totalAjos;
        
    //     for (uint256 i = 1; i < nextAjoId; i++) {
    //         if (ajoIsActive[i] && ajoInitializationPhase[i] >= 4) {
    //             activeCount++;
    //         }
    //     }
        
    //     return (totalCreated, activeCount);
    // }
    
    // function getImplementations() 
    //     external 
    //     view 
    //     override 
    //     returns (
    //         address ajoCoreImpl,
    //         address ajoMembersImpl,
    //         address ajoCollateralImpl,
    //         address ajoPaymentsImpl,
    //         address ajoGovernanceImpl,
    //         address ajoScheduleImpl
    //     ) 
    // {
    //     return (
    //         ajoCoreImplementation,
    //         ajoMembersImplementation,
    //         ajoCollateralImplementation,
    //         ajoPaymentsImplementation,
    //         ajoGovernanceImplementation,
    //         ajoScheduleImplementation
    //     );
    // }
    
    // function getActiveAjoSummaries(uint256 offset, uint256 limit) 
    //     external 
    //     view 
    //     override 
    //     returns (AjoSummary[] memory summaries) 
    // {
    //     require(limit > 0 && limit <= 100, "Invalid limit");
        
    //     // Count active Ajos
    //     uint256 activeCount = 0;
    //     for (uint256 i = 1; i < nextAjoId; i++) {
    //         if (ajoIsActive[i] && ajoInitializationPhase[i] >= 4) {
    //             activeCount++;
    //         }
    //     }
        
    //     if (offset >= activeCount) {
    //         return new AjoSummary[](0);
    //     }
        
    //     uint256 remaining = activeCount - offset;
    //     uint256 resultCount = remaining < limit ? remaining : limit;
    //     summaries = new AjoSummary[](resultCount);
        
    //     uint256 currentOffset = 0;
    //     uint256 resultIndex = 0;
        
    //     for (uint256 i = 1; i < nextAjoId && resultIndex < resultCount; i++) {
    //         if (ajoIsActive[i] && ajoInitializationPhase[i] >= 4) {
    //             if (currentOffset >= offset) {
    //                 summaries[resultIndex] = _buildAjoSummary(i);
    //                 resultIndex++;
    //             }
    //             currentOffset++;
    //         }
    //     }
        
    //     return summaries;
    // }
    
    // function getAjoHealthReport(uint256 ajoId) 
    //     external 
    //     view 
    //     override 
    //     validAjoId(ajoId) 
    //     returns (
    //         uint256 initializationPhase,
    //         bool isReady,
    //         bool coreResponsive,
    //         bool membersResponsive,
    //         bool collateralResponsive,
    //         bool paymentsResponsive,
    //         bool governanceResponsive,
    //         bool scheduleResponsive
    //     ) 
    // {
    //     initializationPhase = ajoInitializationPhase[ajoId];
    //     isReady = initializationPhase >= 4 && ajoIsActive[ajoId];
        
    //     // Test contract responsiveness
    //     coreResponsive = _isContractResponsive(ajoCore[ajoId]);
    //     membersResponsive = _isContractResponsive(ajoMembers[ajoId]);
    //     collateralResponsive = _isContractResponsive(ajoCollateral[ajoId]);
    //     paymentsResponsive = _isContractResponsive(ajoPayments[ajoId]);
    //     governanceResponsive = _isContractResponsive(ajoGovernance[ajoId]);
    //     scheduleResponsive = ajoSchedule[ajoId] == address(0) ? true : _isContractResponsive(ajoSchedule[ajoId]);
        
    //     return (
    //         initializationPhase,
    //         isReady,
    //         coreResponsive,
    //         membersResponsive,
    //         collateralResponsive,
    //         paymentsResponsive,
    //         governanceResponsive,
    //         scheduleResponsive
    //     );
    // }

    /**
     * @dev Check the initialization phase of an Ajo
     * @param ajoId The Ajo ID to check
     * @return phase Current initialization phase (1-5, where 5 is fully complete)
     * @return isReady Whether the Ajo is ready for basic use (phase >= 4)
     * @return isFullyFinalized Whether the Ajo is completely finalized (phase == 5)
     */
    function getAjoInitializationStatus(uint256 ajoId) external view validAjoId(ajoId) returns (
        uint8 phase,
        bool isReady,
        bool isFullyFinalized
    ) {
        phase = ajoInitializationPhase[ajoId];
        isReady = phase >= 4;
        isFullyFinalized = phase == 5;
        return (phase, isReady, isFullyFinalized);
    }
    
     /**
     * @dev Get operational status for a specific Ajo (if it's functional)
     * @param ajoId The Ajo ID to check
     * @return status Operational metrics and capabilities
     */
    function getAjoOperationalStatus(uint256 ajoId) external view validAjoId(ajoId) returns (AjoOperationalStatus memory status) {
        
        // Only attempt to get operational status if Ajo is at least Phase 4
        if (ajoInitializationPhase[ajoId] < 4) {
            return status; // Returns default/empty status
        }
        
        try IAjoCore(ajoCore[ajoId]).getContractStats() returns (
            uint256 totalMembers,
            uint256 activeMembers,
            uint256 totalCollateralUSDC,
            uint256 totalCollateralHBAR,
            uint256 contractBalanceUSDC,
            uint256 contractBalanceHBAR,
            uint256 currentQueuePosition,
            PaymentToken activeToken
        ) {
            status.totalMembers = totalMembers;
            status.activeMembers = activeMembers;
            status.totalCollateralUSDC = totalCollateralUSDC;
            status.totalCollateralHBAR = totalCollateralHBAR;
            status.contractBalanceUSDC = contractBalanceUSDC;
            status.contractBalanceHBAR = contractBalanceHBAR;
            status.activeToken = activeToken;
            status.canAcceptMembers = true; // If we got this far, basic functions work
        } catch {
            status.canAcceptMembers = false;
        }
        
        // Test if payments system is functional
        try IAjoPayments(ajoPayments[ajoId]).getCurrentCycle() returns (uint256 cycle) {
            status.currentCycle = cycle;
            status.canProcessPayments = true;
        } catch {
            status.canProcessPayments = false;
        }
        
        // Test if payouts can be distributed
        try IAjoPayments(ajoPayments[ajoId]).isPayoutReady() returns (bool ready) {
            status.canDistributePayouts = ready;
        } catch {
            status.canDistributePayouts = false;
        }
        
        return status;
    }

    
    function deactivateAjo(uint256 ajoId) external override validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(ajoIsActive[ajoId], "Ajo already inactive");
        ajoIsActive[ajoId] = false;
    }
    
    // ============ INTERNAL HELPER FUNCTIONS ============
    /**
     * @notice  NEW: Build token config with auto-association and supply key
     * @dev Enables users to receive tokens without manual association
     */
    function _buildTokenConfigWithAutoAssociation(
        string memory name,
        string memory symbol,
        address treasury,
        string memory memo,
        uint8 decimals
    ) internal view returns (IHederaTokenService.HederaToken memory token) {
        token.name = name;
        token.symbol = symbol;
        token.treasury = treasury;
        token.memo = memo;
        token.tokenSupplyType = false; // INFINITE supply
        token.maxSupply = 0;
        token.freezeDefault = false; //  Don't freeze by default
        
        //  CRITICAL: Set token keys for supply management
        token.tokenKeys = new IHederaTokenService.TokenKey[](1);
        
        // Supply key = factory contract (allows minting/burning)
        token.tokenKeys[0] = IHederaTokenService.TokenKey({
            keyType: 16, // SUPPLY_KEY = 16
            key: IHederaTokenService.KeyValue({
                inheritAccountKey: false,
                contractId: address(this),
                ed25519: bytes(""),
                ECDSA_secp256k1: bytes(""),
                delegatableContractId: address(0)
            })
        });
        
        //  Set expiry with auto-renew
        token.expiry = IHederaTokenService.Expiry({
            second: 0,
            autoRenewAccount: address(this),
            autoRenewPeriod: 7890000 // 90 days
        });
        
        return token;
    }



    function _buildAjoInfoFromMappings(uint256 ajoId) internal view returns (AjoInfo memory info) {
        info.ajoCore = ajoCore[ajoId];
        info.ajoMembers = ajoMembers[ajoId];
        info.ajoCollateral = ajoCollateral[ajoId];
        info.ajoPayments = ajoPayments[ajoId];
        info.ajoGovernance = ajoGovernance[ajoId];
        info.ajoSchedule = ajoSchedule[ajoId];
        info.creator = ajoCreator[ajoId];
        info.createdAt = ajoCreatedAt[ajoId];
        info.name = ajoName[ajoId];
        info.isActive = ajoIsActive[ajoId];
        info.usesHtsTokens = ajoUsesHtsTokens[ajoId];
        info.usdcToken = ajoUsdcToken[ajoId];
        info.hbarToken = ajoHbarToken[ajoId];
        info.hcsTopicId = ajoHcsTopicId[ajoId];
        info.usesScheduledPayments = ajoUsesScheduledPayments[ajoId];
        info.scheduledPaymentsCount = ajoScheduledPaymentsCountMapping[ajoId];
        
        return info;
    }
    
    // function _buildAjoSummary(uint256 ajoId) internal view returns (AjoSummary memory summary) {
    //     summary.ajoId = ajoId;
    //     summary.name = ajoName[ajoId];
    //     summary.creator = ajoCreator[ajoId];
    //     summary.createdAt = ajoCreatedAt[ajoId];
    //     summary.usesHtsTokens = ajoUsesHtsTokens[ajoId];
    //     summary.usesScheduledPayments = ajoUsesScheduledPayments[ajoId];
    //     summary.isAcceptingMembers = ajoIsActive[ajoId] && ajoInitializationPhase[ajoId] >= 4;
        
    //     // Get dynamic data safely
    //     try IAjoMembers(ajoMembers[ajoId]).getTotalActiveMembers() returns (uint256 members) {
    //         summary.totalMembers = members;
    //         summary.activeMembers = members;
    //     } catch {}
        
    //     try IAjoPayments(ajoPayments[ajoId]).getCurrentCycle() returns (uint256 cycle) {
    //         summary.currentCycle = cycle;
    //     } catch {}
        
    //     try IAjoCollateral(ajoCollateral[ajoId]).getTotalCollateral() returns (uint256 usdc, uint256 hbar) {
    //         summary.totalCollateral = usdc + hbar;
    //     } catch {}
        
    //     try IAjoPayments(ajoPayments[ajoId]).getTokenConfig(PaymentToken.USDC) returns (TokenConfig memory config) {
    //         summary.monthlyPayment = config.monthlyPayment;
    //     } catch {}
        
    //     return summary;
    // }
    
    // function _isContractResponsive(address contractAddress) internal view returns (bool) {
    //     if (contractAddress == address(0)) return false;
        
    //     uint256 size;
    //     assembly {
    //         size := extcodesize(contractAddress)
    //     }
    //     return size > 0;
    // }
    
    /**
     * @notice Build token configuration for HTS token creation
     * @dev Used internally when creating fungible tokens
     */
    function _buildTokenConfig(
        string memory name,
        string memory symbol,
        address treasury,
        string memory memo
    ) internal pure returns (IHederaTokenService.HederaToken memory token) {
        token.name = name;
        token.symbol = symbol;
        token.treasury = treasury;
        token.memo = memo;
        token.tokenSupplyType = false;
        token.maxSupply = 0;
        token.freezeDefault = false;
        token.tokenKeys = new IHederaTokenService.TokenKey[](0);
        token.expiry = IHederaTokenService.Expiry({
            second: 0,
            autoRenewAccount: address(0),
            autoRenewPeriod: 7890000
        });
        
        return token;
    }
    
    /**
     * @notice Deploy EIP-1167 minimal proxy
     * @dev Creates deterministic proxy using CREATE2
     * @param implementation Implementation contract address
     * @param ajoId Ajo ID for salt generation
     * @return proxy Address of deployed proxy
     */
    function _deployProxy(address implementation, uint256 ajoId) internal returns (address proxy) {
        bytes32 salt = keccak256(abi.encodePacked(ajoId, implementation));
        bytes memory bytecode = _getMinimalProxyBytecode(implementation);
        
        assembly ("memory-safe") {
            proxy := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        require(proxy != address(0), "Proxy deployment failed");
        return proxy;
    }
    
    /**
     * @notice Generate EIP-1167 minimal proxy bytecode
     * @dev Creates the bytecode for a minimal proxy pointing to implementation
     * @param implementation Implementation contract address
     * @return bytecode The minimal proxy bytecode
     */
    function _getMinimalProxyBytecode(address implementation) private pure returns (bytes memory) {
        // EIP-1167 Minimal Proxy bytecode
        bytes memory bytecode = new bytes(0x37);
        
        assembly ("memory-safe") {
            // Store the bytecode
            mstore(add(bytecode, 0x20), 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(bytecode, 0x34), shl(0x60, implementation))
            mstore(add(bytecode, 0x48), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
        }
        
        return bytecode;
    }
}

/**
 * @dev Set the Defender Relayer address for all Ajos
 * @param _relayerAddress Address of the Defender Relayer
 */
function setDefenderRelayer(address _relayerAddress) external onlyOwner {
    require(_relayerAddress != address(0), "Invalid relayer address");
    address oldRelayer = defenderRelayerAddress;
    defenderRelayerAddress = _relayerAddress;
    emit DefenderRelayerSet(oldRelayer, _relayerAddress);
}

/**
 * @dev Enable automation for a specific Ajo and authorize the Relayer
 * @param ajoId The Ajo ID to enable automation for
 */
function enableAjoAutomation(uint256 ajoId) external validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
    require(defenderRelayerAddress != address(0), "Defender Relayer not set");
    require(ajoInitializationPhase[ajoId] >= 4, "Ajo not initialized");
    
    // Authorize the Defender Relayer in the AjoCore contract
    IAjoCore(ajoCore[ajoId]).setAutomationAuthorization(defenderRelayerAddress, true);
    IAjoCore(ajoCore[ajoId]).setAutomationEnabled(true);
    
    ajoAutomationEnabled[ajoId] = true;
    
    emit AjoAutomationEnabled(ajoId, msg.sender);
}

/**
 * @dev Disable automation for a specific Ajo
 * @param ajoId The Ajo ID to disable automation for
 */
function disableAjoAutomation(uint256 ajoId) external validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
    IAjoCore(ajoCore[ajoId]).setAutomationEnabled(false);
    ajoAutomationEnabled[ajoId] = false;
    
    emit AjoAutomationDisabled(ajoId, msg.sender);
}

/**
 * @dev Batch enable automation for multiple Ajos
 * @param ajoIds Array of Ajo IDs to enable automation for
 */
function batchEnableAutomation(uint256[] calldata ajoIds) external onlyOwner {
    require(defenderRelayerAddress != address(0), "Defender Relayer not set");
    
    for (uint256 i = 0; i < ajoIds.length; i++) {
        uint256 ajoId = ajoIds[i];
        
        if (ajoId > 0 && ajoId < nextAjoId && ajoInitializationPhase[ajoId] >= 4) {
            IAjoCore(ajoCore[ajoId]).setAutomationAuthorization(defenderRelayerAddress, true);
            IAjoCore(ajoCore[ajoId]).setAutomationEnabled(true);
            ajoAutomationEnabled[ajoId] = true;
        }
    }
    
    emit BatchAutomationSetup(ajoIds, defenderRelayerAddress);
}

/**
 * @dev Get all Ajos with automation enabled
 * @return ajoIds Array of Ajo IDs with automation enabled
 */
function getAjosWithAutomation() external view returns (uint256[] memory ajoIds) {
    uint256 count = 0;
    
    // Count enabled Ajos
    for (uint256 i = 1; i < nextAjoId; i++) {
        if (ajoAutomationEnabled[i]) {
            count++;
        }
    }
    
    // Build array
    ajoIds = new uint256[](count);
    uint256 index = 0;
    
    for (uint256 i = 1; i < nextAjoId; i++) {
        if (ajoAutomationEnabled[i]) {
            ajoIds[index] = i;
            index++;
        }
    }
    
    return ajoIds;
}

/**
 * @dev Check automation status for multiple Ajos
 * @param ajoIds Array of Ajo IDs to check
 * @return statuses Array of automation statuses
 */
function checkAutomationStatus(uint256[] calldata ajoIds) 
    external 
    view 
    returns (AutomationStatus[] memory statuses) 
{
    statuses = new AutomationStatus[](ajoIds.length);
    
    for (uint256 i = 0; i < ajoIds.length; i++) {
        uint256 ajoId = ajoIds[i];
        
        if (ajoId == 0 || ajoId >= nextAjoId) {
            statuses[i] = AutomationStatus({
                ajoId: ajoId,
                enabled: false,
                shouldRun: false,
                defaultersCount: 0,
                reason: "Invalid Ajo ID"
            });
            continue;
        }
        
        try IAjoCore(ajoCore[ajoId]).shouldAutomationRun() returns (
            bool shouldRun,
            string memory reason,
            uint256 defaultersCount
        ) {
            statuses[i] = AutomationStatus({
                ajoId: ajoId,
                enabled: ajoAutomationEnabled[ajoId],
                shouldRun: shouldRun,
                defaultersCount: defaultersCount,
                reason: reason
            });
        } catch {
            statuses[i] = AutomationStatus({
                ajoId: ajoId,
                enabled: false,
                shouldRun: false,
                defaultersCount: 0,
                reason: "Error checking status"
            });
        }
    }
    
    return statuses;
}

// ============ NEW STRUCT ============
struct AutomationStatus {
    uint256 ajoId;
    bool enabled;
    bool shouldRun;
    uint256 defaultersCount;
    string reason;
}