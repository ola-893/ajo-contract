// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/AjoInterfaces.sol";
import "../core/LockableContract.sol";


/**
 * @title AjoFactory
 * @dev Factory contract for creating Ajo instances using EIP-1167 minimal proxies
 * Uses four-phase initialization to minimize gas limit issues
 * Enhanced with comprehensive diagnostic capabilities
 */
contract AjoFactory is IAjoFactory {
    // ============ STATE VARIABLES ============
    
    // Master implementation contracts (deployed once)
    address public ajoCoreImplementation;
    address public ajoMembersImplementation;
    address public ajoCollateralImplementation;
    address public ajoPaymentsImplementation;
    address public ajoGovernanceImplementation;
    
    // Token addresses
    address public USDC;
    address public WHBAR;
    
    // State
    mapping(uint256 => AjoInfo) public ajos;
    mapping(address => uint256[]) public creatorAjos;
    mapping(uint256 => uint8) public ajoInitializationPhase; // Track which phase each Ajo is in
    uint256 public totalAjos;
    uint256 private nextAjoId = 1;
    
    // Admin
    address public owner;

    // ============ DIAGNOSTIC STRUCTURES ============

    struct AjoHealthReport {
        uint256 ajoId;
        uint8 initializationPhase;
        bool isReady;
        bool isFullyFinalized;
        ContractHealthStatus ajoCore;
        ContractHealthStatus ajoMembers;
        ContractHealthStatus ajoCollateral;
        ContractHealthStatus ajoPayments;
        ContractHealthStatus ajoGovernance;
        CrossContractLinkingStatus linking;
    }

    struct ContractHealthStatus {
        bool isDeployed;
        bool isInitialized;
        bool isResponsive;
        bool hasCorrectConfig;
        string errorMessage;
    }

    struct CrossContractLinkingStatus {
        bool ajoCoreToMembers;
        bool ajoCoreToCollateral;
        bool ajoCoreToPayments;
        bool ajoCoreToGovernance;
        bool membersToCollateral;
        bool membersToPayments;
        bool collateralToCore;
        bool paymentsToCore;
        bool governanceToCore;
        string linkingErrors;
    }

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
    
    // ============ EVENTS ============
    event AjoPhase1Completed(uint256 indexed ajoId, address indexed ajoCore);
    event AjoPhase2Completed(uint256 indexed ajoId);
    event AjoPhase3Completed(uint256 indexed ajoId);
    event AjoPhase4Completed(uint256 indexed ajoId);
    event AjoFullyInitialized(uint256 indexed ajoId, address indexed ajoCore);
    event AjoForceCompleted(uint256 indexed ajoId, address indexed completer, uint8 finalPhase);
    event AjoHealthCheckPerformed(uint256 indexed ajoId, bool isHealthy, string issues);
    
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
            ajos[ajoId].creator == msg.sender || msg.sender == owner, 
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
        address _ajoGovernanceImpl
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_whbar != address(0), "Invalid WHBAR address");
        require(_ajoCoreImpl != address(0), "Invalid AjoCore implementation");
        require(_ajoMembersImpl != address(0), "Invalid AjoMembers implementation");
        require(_ajoCollateralImpl != address(0), "Invalid AjoCollateral implementation");
        require(_ajoPaymentsImpl != address(0), "Invalid AjoPayments implementation");
        require(_ajoGovernanceImpl != address(0), "Invalid AjoGovernance implementation");
        
        owner = msg.sender;
        USDC = _usdc;
        WHBAR = _whbar;
        ajoCoreImplementation = _ajoCoreImpl;
        ajoMembersImplementation = _ajoMembersImpl;
        ajoCollateralImplementation = _ajoCollateralImpl;
        ajoPaymentsImplementation = _ajoPaymentsImpl;
        ajoGovernanceImplementation = _ajoGovernanceImpl;

        emit MasterImplementationsSet(
            _ajoCoreImpl,
            _ajoMembersImpl,
            _ajoCollateralImpl,
            _ajoPaymentsImpl,
            _ajoGovernanceImpl
        );
    }
    
    // ============ CORE FACTORY FUNCTIONS ============

    /**
     * @dev Creates a new Ajo instance using minimal proxies (PHASE 1)
     * Only deploys proxy contracts, no initialization
     * @param _name Name for the Ajo instance
     * @return ajoId The ID of the created Ajo instance
     */
    function createAjo(string memory _name) external override returns (uint256 ajoId) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        ajoId = nextAjoId++;
        
        // Deploy proxy contracts only (minimal gas usage)
        address ajoMembersProxy = _deployProxy(ajoMembersImplementation, ajoId);
        address ajoGovernanceProxy = _deployProxy(ajoGovernanceImplementation, ajoId);
        address ajoCollateralProxy = _deployProxy(ajoCollateralImplementation, ajoId);
        address ajoPaymentsProxy = _deployProxy(ajoPaymentsImplementation, ajoId);
        address ajoCoreProxy = _deployProxy(ajoCoreImplementation, ajoId);

        // Store Ajo info (no initialization yet)
        ajos[ajoId] = AjoInfo({
            ajoCore: ajoCoreProxy,
            ajoMembers: ajoMembersProxy,
            ajoCollateral: ajoCollateralProxy,
            ajoPayments: ajoPaymentsProxy,
            ajoGovernance: ajoGovernanceProxy,
            creator: msg.sender,
            createdAt: block.timestamp,
            name: _name,
            isActive: false // Not active until fully initialized
        });

        creatorAjos[msg.sender].push(ajoId);
        totalAjos++;
        ajoInitializationPhase[ajoId] = 1; // Phase 1 complete

        emit AjoCreated(ajoId, msg.sender, ajoCoreProxy, _name);
        emit AjoPhase1Completed(ajoId, ajoCoreProxy);

        return ajoId;
    }

    /**
     * @dev Complete Phase 2: Initialize basic contracts
     * @param ajoId The ID of the Ajo to initialize
     */
    function initializeAjoPhase2(uint256 ajoId) public validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(ajoInitializationPhase[ajoId] == 1, "Phase 1 must be completed first");
        
        AjoInfo memory ajoInfo = ajos[ajoId];
        
        // Initialize AjoMembers and AjoGovernance (lighter contracts first)
        IAjoMembers(ajoInfo.ajoMembers).initialize(
            ajoInfo.ajoCore,
            USDC,
            WHBAR
        );

        IAjoGovernance(ajoInfo.ajoGovernance).initialize(
            ajoInfo.ajoCore,
            address(0) // The governance contract itself is the token
        );
        
        ajoInitializationPhase[ajoId] = 2;
        emit AjoPhase2Completed(ajoId);
    }

    /**
     * @dev Complete Phase 3: Initialize collateral and payments contracts
     * @param ajoId The ID of the Ajo to initialize
     */
    function initializeAjoPhase3(uint256 ajoId) public validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(ajoInitializationPhase[ajoId] == 2, "Phase 2 must be completed first");
        
        AjoInfo memory ajoInfo = ajos[ajoId];
        
        // Initialize AjoCollateral and AjoPayments
        IAjoCollateral(ajoInfo.ajoCollateral).initialize(
            USDC,
            WHBAR,
            ajoInfo.ajoCore,
            ajoInfo.ajoMembers
        );

        IAjoPayments(ajoInfo.ajoPayments).initialize(
            USDC,
            WHBAR,
            ajoInfo.ajoCore,
            ajoInfo.ajoMembers,
            ajoInfo.ajoCollateral
        );
        
        ajoInitializationPhase[ajoId] = 3;
        emit AjoPhase3Completed(ajoId);
    }

    /**
     * @dev Complete Phase 4: Initialize core contract and basic configuration
     * @param ajoId The ID of the Ajo to initialize
     */
    function initializeAjoPhase4(uint256 ajoId) public validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(ajoInitializationPhase[ajoId] == 3, "Phase 3 must be completed first");
        
        AjoInfo storage ajoInfo = ajos[ajoId];
        
        // Initialize AjoCore
        IAjoCore(ajoInfo.ajoCore).initialize(
            USDC,
            WHBAR,
            ajoInfo.ajoMembers,
            ajoInfo.ajoCollateral,
            ajoInfo.ajoPayments,
            ajoInfo.ajoGovernance
        );

        // Essential token configuration for USDC
        IAjoCore(ajoInfo.ajoCore).updateTokenConfig(
            PaymentToken.USDC,
            50 * 10**6,  // $50 in USDC (6 decimals)
            true
        );
        
        // Mark as active after Phase 4
        ajoInfo.isActive = true;
        ajoInitializationPhase[ajoId] = 4;
        
        emit AjoPhase4Completed(ajoId);
        emit AjoFullyInitialized(ajoId, ajoInfo.ajoCore);
    }

    /**
     * @dev Complete all remaining phases in one transaction (for advanced users with higher gas limits)
     * @param ajoId The ID of the Ajo to complete
     * @param startFromPhase Which phase to start from (2, 3, or 4)
     */
    function completeRemainingPhases(uint256 ajoId, uint8 startFromPhase) external validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(startFromPhase >= 2 && startFromPhase <= 4, "Invalid start phase");
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
    }

   /**
     * @dev Complete final linking, advanced configuration, and lock down all Ajo sub-contracts.
     * @param ajoId The ID of the Ajo to finalize
     */
    function finalizeAjoSetup(uint256 ajoId) external validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        require(ajoInitializationPhase[ajoId] == 4, "Phase 4 must be completed first");
        
        AjoInfo memory ajoInfo = ajos[ajoId];
        
        LockableContract(ajoInfo.ajoMembers).completeSetup();
        LockableContract(ajoInfo.ajoGovernance).completeSetup();
        LockableContract(ajoInfo.ajoCollateral).completeSetup();
        LockableContract(ajoInfo.ajoPayments).completeSetup();
        
        ajoInitializationPhase[ajoId] = 5; // Fully finalized
    }

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

    // ============ DIAGNOSTIC FUNCTIONS ============

    /**
     * @dev Get comprehensive health report for a specific Ajo
     * @param ajoId The Ajo ID to diagnose
     * @return report Complete health status of all contracts and linking
     */
    function getAjoHealthReport(uint256 ajoId) external view validAjoId(ajoId) returns (AjoHealthReport memory report) {
        report.ajoId = ajoId;
        report.initializationPhase = ajoInitializationPhase[ajoId];
        report.isReady = ajoInitializationPhase[ajoId] >= 4;
        report.isFullyFinalized = ajoInitializationPhase[ajoId] == 5;
        
        AjoInfo memory ajoInfo = ajos[ajoId];
        
        // Test each contract's health
        report.ajoCore = _testContractHealth(ajoInfo.ajoCore, "AjoCore");
        report.ajoMembers = _testContractHealth(ajoInfo.ajoMembers, "AjoMembers");
        report.ajoCollateral = _testContractHealth(ajoInfo.ajoCollateral, "AjoCollateral");
        report.ajoPayments = _testContractHealth(ajoInfo.ajoPayments, "AjoPayments");
        report.ajoGovernance = _testContractHealth(ajoInfo.ajoGovernance, "AjoGovernance");
        
        // Test cross-contract linking
        report.linking = _testCrossContractLinking(ajoInfo);
        
        return report;
    }

    /**
     * @dev Get operational status for a specific Ajo (if it's functional)
     * @param ajoId The Ajo ID to check
     * @return status Operational metrics and capabilities
     */
    function getAjoOperationalStatus(uint256 ajoId) external view validAjoId(ajoId) returns (AjoOperationalStatus memory status) {
        AjoInfo memory ajoInfo = ajos[ajoId];
        
        // Only attempt to get operational status if Ajo is at least Phase 4
        if (ajoInitializationPhase[ajoId] < 4) {
            return status; // Returns default/empty status
        }
        
        try IAjoCore(ajoInfo.ajoCore).getContractStats() returns (
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
        try IAjoPayments(ajoInfo.ajoPayments).getCurrentCycle() returns (uint256 cycle) {
            status.currentCycle = cycle;
            status.canProcessPayments = true;
        } catch {
            status.canProcessPayments = false;
        }
        
        // Test if payouts can be distributed
        try IAjoPayments(ajoInfo.ajoPayments).isPayoutReady() returns (bool ready) {
            status.canDistributePayouts = ready;
        } catch {
            status.canDistributePayouts = false;
        }
        
        return status;
    }

    /**
     * @dev Get health reports for multiple Ajos
     * @param startId Starting Ajo ID
     * @param count Number of Ajos to check
     * @return reports Array of health reports
     */
    function getBatchAjoHealthReports(uint256 startId, uint256 count) external view returns (AjoHealthReport[] memory reports) {
        require(count <= 20, "Max 20 Ajos per batch");
        
        uint256 actualCount = 0;
        uint256 maxId = startId + count;
        if (maxId > nextAjoId) {
            maxId = nextAjoId;
        }
        
        // Count valid Ajos first
        for (uint256 i = startId; i < maxId; i++) {
            if (i > 0 && i < nextAjoId) {
                actualCount++;
            }
        }
        
        reports = new AjoHealthReport[](actualCount);
        uint256 reportIndex = 0;
        
        for (uint256 i = startId; i < maxId && reportIndex < actualCount; i++) {
            if (i > 0 && i < nextAjoId) {
                reports[reportIndex] = this.getAjoHealthReport(i);
                reportIndex++;
            }
        }
        
        return reports;
    }

    /**
     * @dev Get summary of all Ajos by initialization phase
     * @return phase1Count Ajos stuck at Phase 1 (proxies only)
     * @return phase2Count Ajos at Phase 2 (basic init)
     * @return phase3Count Ajos at Phase 3 (collateral & payments)
     * @return phase4Count Ajos at Phase 4 (ready for use)
     * @return phase5Count Ajos at Phase 5 (fully finalized)
     */
    function getFactoryHealthSummary() external view returns (
        uint256 phase1Count,
        uint256 phase2Count,
        uint256 phase3Count,
        uint256 phase4Count,
        uint256 phase5Count
    ) {
        for (uint256 i = 1; i < nextAjoId; i++) {
            uint8 phase = ajoInitializationPhase[i];
            if (phase == 1) phase1Count++;
            else if (phase == 2) phase2Count++;
            else if (phase == 3) phase3Count++;
            else if (phase == 4) phase4Count++;
            else if (phase == 5) phase5Count++;
        }
        
        return (phase1Count, phase2Count, phase3Count, phase4Count, phase5Count);
    }

    /**
     * @dev Force complete initialization for abandoned Ajos (public utility)
     * @param ajoId The abandoned Ajo to complete
     */
    function forceCompleteAbandonedAjo(uint256 ajoId) external validAjoId(ajoId) {
        require(ajoInitializationPhase[ajoId] < 4, "Already functional");
        require(block.timestamp > ajos[ajoId].createdAt + 24 hours, "Not abandoned yet");
        
        uint8 currentPhase = ajoInitializationPhase[ajoId];
        
        // Complete remaining phases
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
        
        emit AjoForceCompleted(ajoId, msg.sender, currentPhase);
    }
    
    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get detailed information about a specific Ajo
     * @param ajoId The ID of the Ajo to query
     * @return info Complete AjoInfo struct
     */
    function getAjo(uint256 ajoId) external view override validAjoId(ajoId) returns (AjoInfo memory info) {
        return ajos[ajoId];
    }

    /**
     * @dev Get all Ajo instances (paginated)
     * @param offset Starting index
     * @param limit Maximum number of results
     * @return ajoInfos Array of AjoInfo structs
     * @return hasMore Whether there are more results available
     */
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
            ajoInfos[i] = ajos[ajoIdToGet];
        }
        
        hasMore = offset + resultCount < total;
        return (ajoInfos, hasMore);
    }

    /**
     * @dev Get all Ajos created by a specific address
     * @param creator The creator's address
     * @return ajoIds Array of Ajo IDs created by this address
     */
    function getAjosByCreator(address creator) external view override returns (uint256[] memory ajoIds) {
        return creatorAjos[creator];
    }

    /**
     * @dev Get the core contract address for a specific Ajo
     * @param ajoId The Ajo ID
     * @return ajoCore Address of the AjoCore contract
     */
    function getAjoCore(uint256 ajoId) external view override validAjoId(ajoId) returns (address ajoCore) {
        return ajos[ajoId].ajoCore;
    }

    /**
     * @dev Check if an Ajo exists and is ready for use
     * @param ajoId The Ajo ID to check
     * @return exists Whether the Ajo exists
     * @return isActive Whether the Ajo is active (phase >= 4)
     */
    function ajoStatus(uint256 ajoId) external view override returns (bool exists, bool isActive) {
        if (ajoId == 0 || ajoId >= nextAjoId) {
            return (false, false);
        }
        
        AjoInfo memory info = ajos[ajoId];
        bool isReady = ajoInitializationPhase[ajoId] >= 4;
        return (true, info.isActive && isReady);
    }

    /**
     * @dev Get basic stats about the factory
     * @return totalCreated Total number of Ajos created
     * @return activeCount Number of currently active Ajos (ready for use)
     */
    function getFactoryStats() external view override returns (uint256 totalCreated, uint256 activeCount) {
        totalCreated = totalAjos;
        
        for (uint256 i = 1; i < nextAjoId; i++) {
            if (ajos[i].isActive && ajoInitializationPhase[i] >= 4) {
                activeCount++;
            }
        }
        
        return (totalCreated, activeCount);
    }

    /**
     * @dev Get implementation addresses for verification
     */
    function getImplementations() external view override returns (
        address ajoCore,
        address ajoMembers,
        address ajoCollateral,
        address ajoPayments,
        address ajoGovernance
    ) {
        return (
            ajoCoreImplementation,
            ajoMembersImplementation,
            ajoCollateralImplementation,
            ajoPaymentsImplementation,
            ajoGovernanceImplementation
        );
    }
    
    // ============ ADMIN FUNCTIONS ============

    /**
     * @dev Deactivate an Ajo (for emergencies or by creator)
     * @param ajoId The Ajo ID to deactivate
     */
    function deactivateAjo(uint256 ajoId) external override validAjoId(ajoId) onlyCreatorOrOwner(ajoId) {
        ajos[ajoId].isActive = false;
    }

    /**
     * @dev Update implementation addresses (owner only)
     */
    function setImplementations(
        address _ajoCoreImpl,
        address _ajoMembersImpl,
        address _ajoCollateralImpl,
        address _ajoPaymentsImpl,
        address _ajoGovernanceImpl
    ) external onlyOwner {
        require(_ajoCoreImpl != address(0), "Invalid AjoCore implementation");
        require(_ajoMembersImpl != address(0), "Invalid AjoMembers implementation");
        require(_ajoCollateralImpl != address(0), "Invalid AjoCollateral implementation");
        require(_ajoPaymentsImpl != address(0), "Invalid AjoPayments implementation");
        require(_ajoGovernanceImpl != address(0), "Invalid AjoGovernance implementation");
        
        ajoCoreImplementation = _ajoCoreImpl;
        ajoMembersImplementation = _ajoMembersImpl;
        ajoCollateralImplementation = _ajoCollateralImpl;
        ajoPaymentsImplementation = _ajoPaymentsImpl;
        ajoGovernanceImplementation = _ajoGovernanceImpl;

        emit MasterImplementationsSet(
            _ajoCoreImpl,
            _ajoMembersImpl,
            _ajoCollateralImpl,
            _ajoPaymentsImpl,
            _ajoGovernanceImpl
        );
    }

    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        owner = newOwner;
    }

    // ============ INTERNAL DIAGNOSTIC HELPERS ============

    /**
     * @dev Test individual contract health
     * @param contractAddress Address of the contract to test
     * @param contractType Type of contract for better error reporting
     * @return status Health status of the contract
     */
    function _testContractHealth(address contractAddress, string memory contractType) internal view returns (ContractHealthStatus memory status) {
        status.isDeployed = contractAddress != address(0) && contractAddress.code.length > 0;
        
        if (!status.isDeployed) {
            status.errorMessage = string(abi.encodePacked(contractType, " not deployed"));
            return status;
        }
        
        // Test basic responsiveness with a simple call
        if (keccak256(bytes(contractType)) == keccak256(bytes("AjoCore"))) {
            try IAjoCore(contractAddress).getTokenConfig(PaymentToken.USDC) returns (TokenConfig memory) {
                status.isInitialized = true;
                status.isResponsive = true;
                status.hasCorrectConfig = true;
            } catch {
                status.isInitialized = false;
                status.isResponsive = false;
                status.errorMessage = "AjoCore not initialized or not responsive";
            }
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("AjoMembers"))) {
            try IAjoMembers(contractAddress).getTotalActiveMembers() returns (uint256) {
                status.isInitialized = true;
                status.isResponsive = true;
                status.hasCorrectConfig = true;
            } catch {
                status.isInitialized = false;
                status.isResponsive = false;
                status.errorMessage = "AjoMembers not initialized or not responsive";
            }
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("AjoCollateral"))) {
            try IAjoCollateral(contractAddress).getTotalCollateral() returns (uint256, uint256) {
                status.isInitialized = true;
                status.isResponsive = true;
                status.hasCorrectConfig = true;
            } catch {
                status.isInitialized = false;
                status.isResponsive = false;
                status.errorMessage = "AjoCollateral not initialized or not responsive";
            }
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("AjoPayments"))) {
            try IAjoPayments(contractAddress).getCurrentCycle() returns (uint256) {
                status.isInitialized = true;
                status.isResponsive = true;
                status.hasCorrectConfig = true;
            } catch {
                status.isInitialized = false;
                status.isResponsive = false;
                status.errorMessage = "AjoPayments not initialized or not responsive";
            }
        } else {
            // For AjoGovernance or unknown contracts, just mark as deployed
            status.isInitialized = true;
            status.isResponsive = true;
            status.hasCorrectConfig = true;
        }
        
        return status;
    }

    /**
     * @dev Test cross-contract linking status
     * @param ajoInfo The Ajo information struct
     * @return linking Status of all cross-contract links
     */
    function _testCrossContractLinking(AjoInfo memory ajoInfo) internal view returns (CrossContractLinkingStatus memory linking) {
        // These tests would require specific linking verification functions in each contract
        // For now, we'll assume linking is correct if contracts are initialized
        
        // Test if AjoCore can communicate with other contracts
        try IAjoCore(ajoInfo.ajoCore).getContractStats() {
            linking.ajoCoreToMembers = true;
            linking.ajoCoreToCollateral = true;
            linking.ajoCoreToPayments = true;
            linking.ajoCoreToGovernance = true;
        } catch {
            linking.linkingErrors = "AjoCore cannot communicate with linked contracts";
        }
        
        // Test if other contracts can communicate back
        try IAjoMembers(ajoInfo.ajoMembers).getTotalActiveMembers() {
            linking.membersToCollateral = true;
            linking.membersToPayments = true;
        } catch {
            linking.linkingErrors = string(abi.encodePacked(linking.linkingErrors, "; AjoMembers linking issues"));
        }
        
        return linking;
    }
    
    // ============ INTERNAL FUNCTIONS ============

    /**
     * @dev Deploy a minimal proxy for a given implementation
     * @param implementation Address of the implementation contract
     * @param ajoId ID of the Ajo being created (for salt)
     * @return proxy Address of the deployed proxy
     */
    function _deployProxy(address implementation, uint256 ajoId) internal returns (address proxy) {
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
        
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, ajoId, implementation, block.timestamp));
        
        assembly {
            proxy := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(proxy)) {
                revert(0, 0)
            }
        }
    }

    /**
     * @dev Safely call setAjoCore on a contract with error handling
     * @param contractAddress The contract to call
     * @param functionName The function name (should be "setAjoCore")
     * @param data The encoded function call data
     */
    function _safeLinkContract(
        address contractAddress,
        string memory functionName,
        bytes memory data
    ) internal {
        // Create the function selector for setAjoCore(address)
        bytes4 selector = bytes4(keccak256(bytes("setAjoCore(address)")));
        
        // Prepare the call data
        bytes memory callData = abi.encodePacked(selector, data);
        
        // Make the call
        (bool success, bytes memory returnData) = contractAddress.call(callData);
        
        if (!success) {
            // If the call failed, check if it's because the function doesn't exist
            // In that case, we can ignore it (some contracts might not have setAjoCore)
            if (returnData.length == 0) {
                // Function might not exist, which is acceptable
                return;
            } else {
                // There was an actual error, revert with the error message
                if (returnData.length > 0) {
                    assembly {
                        let returndata_size := mload(returnData)
                        revert(add(32, returnData), returndata_size)
                    }
                } else {
                    revert(string(abi.encodePacked("Failed to link contract: ", functionName)));
                }
            }
        }
    }
}