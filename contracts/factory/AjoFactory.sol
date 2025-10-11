// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/AjoInterfaces.sol";
import "../hedera/hedera-token-service/HederaTokenService.sol";
import "../hedera/HederaResponseCodes.sol";

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
contract AjoFactory is IAjoFactory, HederaTokenService {  // ✅ INHERIT from HederaTokenService
    
    // ============ STATE VARIABLES ============
    
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
    address public usdcHtsToken;
    address public hbarHtsToken;
    
    // HSS configuration
    address public hederaScheduleService; // 0x16b
    bool public hssEnabled;
    
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
    event HtsTokenCreationAttempt(string tokenName, int64 responseCode, address tokenAddress, bool success);
    
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
        address _hederaTokenService, // ✅ Kept for interface compatibility but not used
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
        
        // ✅ REMOVED: hederaTokenService = _hederaTokenService;
        // HTS functionality is inherited, not called externally
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
     * @notice Create HTS tokens for USDC and WHBAR (one-time setup)
     * @dev Uses low-level call to HTS precompile with value
     * @return usdcToken Address of created USDC HTS token
     * @return hbarToken Address of created WHBAR HTS token
     */
    function createHtsTokens() external payable override onlyOwner returns (
        address usdcToken,
        address hbarToken
    ) {
        require(!htsEnabled, "HTS tokens already created");
        require(msg.value >= 40 * 10**8, "Need 40 HBAR for token creation");
        
        // ✅ Create USDC HTS token
        IHederaTokenService.HederaToken memory usdcTokenConfig = _buildTokenConfig(
            "USDC Stablecoin",
            "USDC",
            address(this),
            "USDC for Ajo.Save"
        );
        
        // Use low-level call to pass value
        (int usdcResponse, address usdcAddr) = _createFungibleTokenWithValue(
            usdcTokenConfig,
            1000000000 * 10**6, // 1B USDC initial supply
            6, // decimals
            20 * 10**8 // 20 HBAR
        );
        
        // Convert int to int64
        int64 usdcResponseCode = int64(usdcResponse);
        bool usdcSuccess = _isHtsSuccess(usdcResponse);
        
        emit HtsTokenCreationAttempt("USDC", usdcResponseCode, usdcAddr, usdcSuccess);
        require(usdcSuccess, _getHtsErrorMessage(usdcResponse));
        
        usdcHtsToken = usdcAddr;
        emit HtsTokenCreated(usdcAddr, "USDC Stablecoin", "USDC", 6);
        
        // ✅ Create WHBAR HTS token
        IHederaTokenService.HederaToken memory hbarTokenConfig = _buildTokenConfig(
            "Wrapped HBAR",
            "WHBAR",
            address(this),
            "WHBAR for Ajo.Save"
        );
        
        // Use low-level call to pass value
        (int hbarResponse, address hbarAddr) = _createFungibleTokenWithValue(
            hbarTokenConfig,
            1000000000 * 10**8, // 1B WHBAR initial supply
            8, // decimals
            20 * 10**8 // 20 HBAR
        );
        
        // Convert int to int64
        int64 hbarResponseCode = int64(hbarResponse);
        bool hbarSuccess = _isHtsSuccess(hbarResponse);
        
        emit HtsTokenCreationAttempt("WHBAR", hbarResponseCode, hbarAddr, hbarSuccess);
        require(hbarSuccess, _getHtsErrorMessage(hbarResponse));
        
        hbarHtsToken = hbarAddr;
        emit HtsTokenCreated(hbarAddr, "Wrapped HBAR", "WHBAR", 8);
        
        // Enable HTS mode
        htsEnabled = true;
        
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
    
    /**
     * @notice Get HTS token information
     */
    function getHtsTokenInfo(address token) external view override returns (HtsTokenInfo memory) {
        require(htsEnabled, "HTS not enabled");
        require(token == usdcHtsToken || token == hbarHtsToken, "Invalid token");
        
        bool isUsdc = (token == usdcHtsToken);
        
        return HtsTokenInfo({
            tokenAddress: token,
            tokenId: bytes32(uint256(uint160(token))),
            name: isUsdc ? "USDC Stablecoin" : "Wrapped HBAR",
            symbol: isUsdc ? "USDC" : "WHBAR",
            decimals: isUsdc ? 6 : 8,
            totalSupply: 1000000000 * (isUsdc ? 10**6 : 10**8),
            hasFreezeKey: true,
            hasWipeKey: false,
            hasSupplyKey: false,
            hasPauseKey: true,
            treasury: address(this)
        });
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
    
    /**
     * @notice Get Hedera Schedule Service address
     */
    function getScheduleServiceAddress() external view override returns (address) {
        return hederaScheduleService;
    }
    
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
    
    /**
     * @notice Get all Ajos using scheduled payments
     */
    function getAjosUsingScheduledPayments() external view override returns (uint256[] memory ajoIds) {
        uint256 count = 0;
        
        // Count enabled Ajos
        for (uint256 i = 1; i < nextAjoId; i++) {
            if (ajoSchedulingEnabled[i]) {
                count++;
            }
        }
        
        ajoIds = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextAjoId; i++) {
            if (ajoSchedulingEnabled[i]) {
                ajoIds[index] = i;
                index++;
            }
        }
        
        return ajoIds;
    }
    
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
        bool _useScheduledPayments
    ) external override returns (uint256 ajoId) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        
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
        ajoHcsTopicId[ajoId] = bytes32(0); // Set in phase 2
        ajoUsesScheduledPayments[ajoId] = _useScheduledPayments;
        ajoScheduledPaymentsCountMapping[ajoId] = 0;
        
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
    function initializeAjoPhase2(uint256 ajoId) 
        public 
        override
        validAjoId(ajoId) 
        onlyCreatorOrOwner(ajoId) 
        returns (bytes32 hcsTopicId) 
    {
        require(ajoInitializationPhase[ajoId] == 1, "Phase 1 must be completed first");
        
        // Initialize AjoMembers
        IAjoMembers(ajoMembers[ajoId]).initialize(
            ajoCore[ajoId],
            ajoUsdcToken[ajoId],
            ajoHbarToken[ajoId]
        );
        
        // Generate a placeholder HCS topic ID (in production, this comes from SDK)
        hcsTopicId = keccak256(abi.encodePacked(
            ajoId,
            ajoCreator[ajoId],
            block.timestamp,
            "HCS_TOPIC"
        ));
        
        // Store HCS topic ID
        ajoHcsTopicId[ajoId] = hcsTopicId;
        
        // ✅ Initialize AjoGovernance - pass address(0) for HTS since contracts inherit it
        IAjoGovernance(ajoGovernance[ajoId]).initialize(
            ajoCore[ajoId],
            ajoSchedule[ajoId],
            address(0), // ✅ No longer needed - contracts inherit HederaTokenService
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
        
        // ✅ Pass address(0) for HTS since contracts inherit it
        IAjoCollateral(ajoCollateral[ajoId]).initialize(
            ajoUsdcToken[ajoId],
            ajoHbarToken[ajoId],
            ajoCore[ajoId],
            ajoMembers[ajoId],
            address(0) // ✅ No longer needed
        );
        
        IAjoPayments(ajoPayments[ajoId]).initialize(
            ajoUsdcToken[ajoId],
            ajoHbarToken[ajoId],
            ajoCore[ajoId],
            ajoMembers[ajoId],
            ajoCollateral[ajoId],
            address(0) // ✅ No longer needed
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
        
        // ✅ Initialize AjoCore - pass address(0) for HTS since it inherits it
        IAjoCore(ajoCore[ajoId]).initialize(
            ajoUsdcToken[ajoId],
            ajoHbarToken[ajoId],
            ajoMembers[ajoId],
            ajoCollateral[ajoId],
            ajoPayments[ajoId],
            ajoGovernance[ajoId],
            ajoSchedule[ajoId],
            address(0), // ✅ No longer needed - AjoCore inherits HederaTokenService
            ajoHcsTopicId[ajoId]
        );
        
        // Set default token configuration (USDC)
        IAjoCore(ajoCore[ajoId]).updateTokenConfig(
            PaymentToken.USDC,
            50 * 10**6, // $50 in USDC (6 decimals)
            true
        );
        
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
    
    /**
     * @notice Complete all remaining phases in one transaction
     * @param ajoId The ID of the Ajo to complete
     * @param startFromPhase Which phase to start from
     */
    function completeRemainingPhases(uint256 ajoId, uint8 startFromPhase) 
        external 
        validAjoId(ajoId) 
        onlyCreatorOrOwner(ajoId) 
    {
        require(startFromPhase >= 2 && startFromPhase <= 5, "Invalid start phase");
        require(ajoInitializationPhase[ajoId] == startFromPhase - 1, "Previous phase not completed");
        
        if (startFromPhase <= 2 && ajoInitializationPhase[ajoId] < 2) {
            initializeAjoPhase2(ajoId);
        }
        
        if (startFromPhase <= 3 && ajoInitializationPhase[ajoId] < 3) {
            initializeAjoPhase3(ajoId);
        }
        
        if (startFromPhase <= 4 && ajoInitializationPhase[ajoId] < 4) {
            initializeAjoPhase4(ajoId);
        }
        
        if (startFromPhase <= 5 && ajoInitializationPhase[ajoId] < 5) {
            initializeAjoPhase5(ajoId);
        }
    }
    
    /**
     * @notice Force complete abandoned Ajo (public utility)
     * @param ajoId The abandoned Ajo to complete
     */
    function forceCompleteAbandonedAjo(uint256 ajoId) external validAjoId(ajoId) {
        require(ajoInitializationPhase[ajoId] < 5, "Already fully initialized");
        require(block.timestamp > ajoCreatedAt[ajoId] + 24 hours, "Not abandoned yet");
        
        uint8 currentPhase = ajoInitializationPhase[ajoId];
        
        if (currentPhase == 1) {
            try this.initializeAjoPhase2(ajoId) {} catch {}
            currentPhase = 2;
        }
        if (currentPhase == 2) {
            try this.initializeAjoPhase3(ajoId) {} catch {}
            currentPhase = 3;
        }
        if (currentPhase == 3) {
            try this.initializeAjoPhase4(ajoId) {} catch {}
            currentPhase = 4;
        }
        if (currentPhase == 4) {
            try this.initializeAjoPhase5(ajoId) {} catch {}
            currentPhase = 5;
        }
        
        emit AjoForceCompleted(ajoId, msg.sender, currentPhase);
    }
    
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
    
    function getAjoCore(uint256 ajoId) 
        external 
        view 
        override 
        validAjoId(ajoId) 
        returns (address ajoCoreAddr) 
    {
        return ajoCore[ajoId];
    }
    
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
    
    function getFactoryStats() 
        external 
        view 
        override 
        returns (uint256 totalCreated, uint256 activeCount) 
    {
        totalCreated = totalAjos;
        
        for (uint256 i = 1; i < nextAjoId; i++) {
            if (ajoIsActive[i] && ajoInitializationPhase[i] >= 4) {
                activeCount++;
            }
        }
        
        return (totalCreated, activeCount);
    }
    
    function getImplementations() 
        external 
        view 
        override 
        returns (
            address ajoCoreImpl,
            address ajoMembersImpl,
            address ajoCollateralImpl,
            address ajoPaymentsImpl,
            address ajoGovernanceImpl,
            address ajoScheduleImpl
        ) 
    {
        return (
            ajoCoreImplementation,
            ajoMembersImplementation,
            ajoCollateralImplementation,
            ajoPaymentsImplementation,
            ajoGovernanceImplementation,
            ajoScheduleImplementation
        );
    }
    
    function getActiveAjoSummaries(uint256 offset, uint256 limit) 
        external 
        view 
        override 
        returns (AjoSummary[] memory summaries) 
    {
        require(limit > 0 && limit <= 100, "Invalid limit");
        
        // Count active Ajos
        uint256 activeCount = 0;
        for (uint256 i = 1; i < nextAjoId; i++) {
            if (ajoIsActive[i] && ajoInitializationPhase[i] >= 4) {
                activeCount++;
            }
        }
        
        if (offset >= activeCount) {
            return new AjoSummary[](0);
        }
        
        uint256 remaining = activeCount - offset;
        uint256 resultCount = remaining < limit ? remaining : limit;
        summaries = new AjoSummary[](resultCount);
        
        uint256 currentOffset = 0;
        uint256 resultIndex = 0;
        
        for (uint256 i = 1; i < nextAjoId && resultIndex < resultCount; i++) {
            if (ajoIsActive[i] && ajoInitializationPhase[i] >= 4) {
                if (currentOffset >= offset) {
                    summaries[resultIndex] = _buildAjoSummary(i);
                    resultIndex++;
                }
                currentOffset++;
            }
        }
        
        return summaries;
    }
    
    function getAjoHealthReport(uint256 ajoId) 
        external 
        view 
        override 
        validAjoId(ajoId) 
        returns (
            uint256 initializationPhase,
            bool isReady,
            bool coreResponsive,
            bool membersResponsive,
            bool collateralResponsive,
            bool paymentsResponsive,
            bool governanceResponsive,
            bool scheduleResponsive
        ) 
    {
        initializationPhase = ajoInitializationPhase[ajoId];
        isReady = initializationPhase >= 4 && ajoIsActive[ajoId];
        
        // Test contract responsiveness
        coreResponsive = _isContractResponsive(ajoCore[ajoId]);
        membersResponsive = _isContractResponsive(ajoMembers[ajoId]);
        collateralResponsive = _isContractResponsive(ajoCollateral[ajoId]);
        paymentsResponsive = _isContractResponsive(ajoPayments[ajoId]);
        governanceResponsive = _isContractResponsive(ajoGovernance[ajoId]);
        scheduleResponsive = ajoSchedule[ajoId] == address(0) ? true : _isContractResponsive(ajoSchedule[ajoId]);
        
        return (
            initializationPhase,
            isReady,
            coreResponsive,
            membersResponsive,
            collateralResponsive,
            paymentsResponsive,
            governanceResponsive,
            scheduleResponsive
        );
    }
    
    function getAjoOperationalStatus(uint256 ajoId) 
        external 
        view 
        override 
        validAjoId(ajoId) 
        returns (
            uint256 totalMembers,
            uint256 currentCycle,
            bool canAcceptMembers,
            bool hasActiveGovernance,
            bool hasActiveScheduling
        ) 
    {
        // Get total members
        try IAjoMembers(ajoMembers[ajoId]).getTotalActiveMembers() returns (uint256 members) {
            totalMembers = members;
        } catch {
            totalMembers = 0;
        }
        
        // Get current cycle
        try IAjoPayments(ajoPayments[ajoId]).getCurrentCycle() returns (uint256 cycle) {
            currentCycle = cycle;
        } catch {
            currentCycle = 0;
        }
        
        canAcceptMembers = ajoIsActive[ajoId] && ajoInitializationPhase[ajoId] >= 4;
        hasActiveGovernance = ajoInitializationPhase[ajoId] >= 2;
        hasActiveScheduling = ajoUsesScheduledPayments[ajoId] && ajoSchedulingEnabled[ajoId];
        
        return (totalMembers, currentCycle, canAcceptMembers, hasActiveGovernance, hasActiveScheduling);
    }
    
    function deactivateAjo(uint256 ajoId) external override validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(ajoIsActive[ajoId], "Ajo already inactive");
        ajoIsActive[ajoId] = false;
    }
    
    // ============ INTERNAL HELPER FUNCTIONS ============
    
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
    
    function _buildAjoSummary(uint256 ajoId) internal view returns (AjoSummary memory summary) {
        summary.ajoId = ajoId;
        summary.name = ajoName[ajoId];
        summary.creator = ajoCreator[ajoId];
        summary.createdAt = ajoCreatedAt[ajoId];
        summary.usesHtsTokens = ajoUsesHtsTokens[ajoId];
        summary.usesScheduledPayments = ajoUsesScheduledPayments[ajoId];
        summary.isAcceptingMembers = ajoIsActive[ajoId] && ajoInitializationPhase[ajoId] >= 4;
        
        // Get dynamic data safely
        try IAjoMembers(ajoMembers[ajoId]).getTotalActiveMembers() returns (uint256 members) {
            summary.totalMembers = members;
            summary.activeMembers = members;
        } catch {}
        
        try IAjoPayments(ajoPayments[ajoId]).getCurrentCycle() returns (uint256 cycle) {
            summary.currentCycle = cycle;
        } catch {}
        
        try IAjoCollateral(ajoCollateral[ajoId]).getTotalCollateral() returns (uint256 usdc, uint256 hbar) {
            summary.totalCollateral = usdc + hbar;
        } catch {}
        
        try IAjoPayments(ajoPayments[ajoId]).getTokenConfig(PaymentToken.USDC) returns (TokenConfig memory config) {
            summary.monthlyPayment = config.monthlyPayment;
        } catch {}
        
        return summary;
    }
    
    function _isContractResponsive(address contractAddress) internal view returns (bool) {
        if (contractAddress == address(0)) return false;
        
        uint256 size;
        assembly {
            size := extcodesize(contractAddress)
        }
        return size > 0;
    }
    
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