// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AjoInterfaces.sol";

/**
 * @title AjoFactory
 * @dev Factory contract for creating Ajo instances using EIP-1167 minimal proxies
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
    uint256 public totalAjos;
    uint256 private nextAjoId = 1;
    
    // Admin
    address public owner;
    
    // ============ EVENTS ============
    // Events are defined in the interface
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
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
     * @dev Creates a new Ajo instance using minimal proxies
     * @param _name Name for the Ajo instance
     * @return ajoId The ID of the created Ajo instance
     */
    function createAjo(string memory _name) external override returns (uint256 ajoId) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        ajoId = nextAjoId++;
        
        // Deploy proxy contracts
        address ajoMembersProxy = _deployProxy(ajoMembersImplementation, ajoId);
        address ajoGovernanceProxy = _deployProxy(ajoGovernanceImplementation, ajoId);
        address ajoCollateralProxy = _deployProxy(ajoCollateralImplementation, ajoId);
        address ajoPaymentsProxy = _deployProxy(ajoPaymentsImplementation, ajoId);
        address ajoCoreProxy = _deployProxy(ajoCoreImplementation, ajoId);

        // Initialize contracts in proper order
        _initializeContracts(
            ajoCoreProxy,
            ajoMembersProxy,
            ajoCollateralProxy,
            ajoPaymentsProxy,
            ajoGovernanceProxy
        );

        // Store Ajo info
        ajos[ajoId] = AjoInfo({
            ajoCore: ajoCoreProxy,
            ajoMembers: ajoMembersProxy,
            ajoCollateral: ajoCollateralProxy,
            ajoPayments: ajoPaymentsProxy,
            ajoGovernance: ajoGovernanceProxy,
            creator: msg.sender,
            createdAt: block.timestamp,
            name: _name,
            isActive: true
        });

        creatorAjos[msg.sender].push(ajoId);
        totalAjos++;

        emit AjoCreated(ajoId, msg.sender, ajoCoreProxy, _name);

        return ajoId;
    }
    
    // ============ VIEW FUNCTIONS ============

    /**
     * @dev Get detailed information about a specific Ajo
     * @param ajoId The ID of the Ajo to query
     * @return info Complete AjoInfo struct
     */
    function getAjo(uint256 ajoId) external view override returns (AjoInfo memory info) {
        require(ajoId > 0 && ajoId < nextAjoId, "Invalid Ajo ID");
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
    function getAjoCore(uint256 ajoId) external view override returns (address ajoCore) {
        require(ajoId > 0 && ajoId < nextAjoId, "Invalid Ajo ID");
        return ajos[ajoId].ajoCore;
    }

    /**
     * @dev Check if an Ajo exists and is active
     * @param ajoId The Ajo ID to check
     * @return exists Whether the Ajo exists
     * @return isActive Whether the Ajo is active
     */
    function ajoStatus(uint256 ajoId) external view override returns (bool exists, bool isActive) {
        if (ajoId == 0 || ajoId >= nextAjoId) {
            return (false, false);
        }
        
        AjoInfo memory info = ajos[ajoId];
        return (true, info.isActive);
    }

    /**
     * @dev Get basic stats about the factory
     * @return totalCreated Total number of Ajos created
     * @return activeCount Number of currently active Ajos
     */
    function getFactoryStats() external view override returns (uint256 totalCreated, uint256 activeCount) {
        totalCreated = totalAjos;
        
        for (uint256 i = 1; i < nextAjoId; i++) {
            if (ajos[i].isActive) {
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
    function deactivateAjo(uint256 ajoId) external override {
        require(ajoId > 0 && ajoId < nextAjoId, "Invalid Ajo ID");
        
        AjoInfo storage info = ajos[ajoId];
        require(
            info.creator == msg.sender || msg.sender == owner, 
            "Only creator or owner can deactivate"
        );
        
        info.isActive = false;
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
     * @dev Initialize all contracts and link them together
     */
    function _initializeContracts(
        address ajoCoreProxy,
        address ajoMembersProxy,
        address ajoCollateralProxy,
        address ajoPaymentsProxy,
        address ajoGovernanceProxy
    ) internal {
        // Initialize AjoMembers
        IAjoMembers(ajoMembersProxy).initialize(
            ajoCoreProxy,
            USDC,
            WHBAR
        );

        // Initialize AjoGovernance  
        IAjoGovernance(ajoGovernanceProxy).initialize(
            ajoCoreProxy,
            address(0) // The governance contract itself is the token
        );

        // Initialize AjoCollateral
        IAjoCollateral(ajoCollateralProxy).initialize(
            USDC,
            WHBAR,
            ajoCoreProxy,
            ajoMembersProxy
        );

        // Initialize AjoPayments
        IAjoPayments(ajoPaymentsProxy).initialize(
            USDC,
            WHBAR,
            ajoCoreProxy,
            ajoMembersProxy,
            ajoCollateralProxy
        );

        // Initialize AjoCore (main contract)
        IAjoCore(ajoCoreProxy).initialize(
            USDC,
            WHBAR,
            ajoMembersProxy,
            ajoCollateralProxy,
            ajoPaymentsProxy,
            ajoGovernanceProxy
        );

        // Link contracts to each other
        IAjoMembers(ajoMembersProxy).setContractAddresses(
            ajoCollateralProxy,
            ajoPaymentsProxy
        );

        // // Set up governance contract with members contract reference
        // // This assumes AjoGovernance has a setMembersContract function
        // try IAjoGovernance(ajoGovernanceProxy).setMembersContract(ajoMembersProxy) {
        //     // Success
        // } catch {
        //     // Handle case where setMembersContract doesn't exist
        // }

        // Configure default token settings (USDC with $50 monthly payment)
        IAjoCore(ajoCoreProxy).updateTokenConfig(
            PaymentToken.USDC,
            50 * 10**6,  // $50 in USDC (6 decimals)
            true
        );
        
        // Also configure HBAR with equivalent value (adjust based on price)
        IAjoCore(ajoCoreProxy).updateTokenConfig(
            PaymentToken.HBAR,
            1000 * 10**8,  // 1000 HBAR (8 decimals for wrapped HBAR)
            true
        );
    }
}