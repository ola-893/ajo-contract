// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AjoCore.sol";
import "./AjoMembers.sol";
import "./AjoCollateral.sol";
import "./AjoPayments.sol";
import "./AjoGovernance.sol";
import "./AjoGovernance.sol";


/**
 * @title AjoFactory
 * @dev Factory contract for creating and managing Ajo instances
 */
contract AjoFactory {
    struct AjoInfo {
        address ajoCore;
        address ajoMembers;
        address ajoCollateral;
        address ajoPayments;
        address ajoGovernance;
        address creator;
        uint256 createdAt;
        string name;
        bool isActive;
    }

    // State variables
    address public immutable USDC;
    address public immutable WHBAR;
    
    mapping(uint256 => AjoInfo) public ajos;
    mapping(address => uint256[]) public creatorAjos; // Track ajos by creator
    uint256 public totalAjos;
    uint256 private nextAjoId = 1;

    // Events
    event AjoCreated(
        uint256 indexed ajoId,
        address indexed creator,
        address ajoCore,
        string name
    );

    constructor(address _usdc, address _whbar) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_whbar != address(0), "Invalid WHBAR address");
        
        USDC = _usdc;
        WHBAR = _whbar;
    }

    /**
     * @dev Creates a new Ajo instance with all related contracts
     * @param _name Name for the Ajo instance
     * @return ajoId The ID of the created Ajo instance
     */
    function createAjo(string memory _name) external returns (uint256 ajoId) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        ajoId = nextAjoId++;
        
        // Deploy all contracts
        address zeroAddress = address(0);
        
        // 1. Deploy AjoMembers
        AjoMembers ajoMembers = new AjoMembers(
            zeroAddress,    // ajoCore - will be set later
            USDC,
            WHBAR
        );

        // 2. Deploy AjoGovernance  
        AjoGovernance ajoGovernance = new AjoGovernance(
            zeroAddress,    // ajoCore - will be set later
            zeroAddress     // placeholder
        );

        // 3. Deploy AjoCollateral
        AjoCollateral ajoCollateral = new AjoCollateral(
            USDC,
            WHBAR,
            zeroAddress,            // ajoCore - will be set later
            address(ajoMembers)     // membersContract
        );

        // 4. Deploy AjoPayments
        AjoPayments ajoPayments = new AjoPayments(
            USDC,
            WHBAR,
            zeroAddress,            // ajoCore - will be set later
            address(ajoMembers),    // membersContract
            address(ajoCollateral)  // collateralContract
        );

        // 5. Deploy AjoCore (main contract)
        AjoCore ajoCore = new AjoCore(
            USDC,
            WHBAR,
            address(ajoMembers),
            address(ajoCollateral),
            address(ajoPayments),
            address(ajoGovernance)
        );

        // 6. Link all contracts to AjoCore
        ajoMembers.setAjoCore(address(ajoCore));
        ajoMembers.setContractAddresses(
            address(ajoCollateral),
            address(ajoPayments)
        );
        
        ajoGovernance.setAjoCore(address(ajoCore));
        ajoCollateral.setAjoCore(address(ajoCore));
        ajoPayments.setAjoCore(address(ajoCore));

        // 7. Configure default token settings (USDC with $50 monthly payment)
        ajoCore.updateTokenConfig(
            PaymentToken.USDC,  // PaymentToken.USDC
            50 * 10**6,  // $50 in USDC (6 decimals)
            true  // isActive
        );

        // 8. Store Ajo info
        ajos[ajoId] = AjoInfo({
            ajoCore: address(ajoCore),
            ajoMembers: address(ajoMembers),
            ajoCollateral: address(ajoCollateral),
            ajoPayments: address(ajoPayments),
            ajoGovernance: address(ajoGovernance),
            creator: msg.sender,
            createdAt: block.timestamp,
            name: _name,
            isActive: true
        });

        creatorAjos[msg.sender].push(ajoId);
        totalAjos++;

        emit AjoCreated(ajoId, msg.sender, address(ajoCore), _name);

        return ajoId;
    }

    /**
     * @dev Get detailed information about a specific Ajo
     * @param ajoId The ID of the Ajo to query
     * @return info Complete AjoInfo struct
     */
    function getAjo(uint256 ajoId) external view returns (AjoInfo memory info) {
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
        returns (AjoInfo[] memory ajoInfos, bool hasMore) 
    {
        require(limit > 0 && limit <= 100, "Invalid limit"); // Max 100 per call
        
        uint256 total = totalAjos;
        if (offset >= total) {
            return (new AjoInfo[](0), false);
        }

        uint256 remaining = total - offset;
        uint256 resultCount = remaining < limit ? remaining : limit;
        
        ajoInfos = new AjoInfo[](resultCount);
        
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 ajoId = offset + i + 1; // Ajo IDs start from 1
            ajoInfos[i] = ajos[ajoId];
        }
        
        hasMore = offset + resultCount < total;
        return (ajoInfos, hasMore);
    }

    /**
     * @dev Get all Ajos created by a specific address
     * @param creator The creator's address
     * @return ajoIds Array of Ajo IDs created by this address
     */
    function getAjosByCreator(address creator) external view returns (uint256[] memory ajoIds) {
        return creatorAjos[creator];
    }

    /**
     * @dev Get the core contract address for a specific Ajo
     * @param ajoId The Ajo ID
     * @return ajoCore Address of the AjoCore contract
     */
    function getAjoCore(uint256 ajoId) external view returns (address ajoCore) {
        require(ajoId > 0 && ajoId < nextAjoId, "Invalid Ajo ID");
        return ajos[ajoId].ajoCore;
    }

    /**
     * @dev Check if an Ajo exists and is active
     * @param ajoId The Ajo ID to check
     * @return exists Whether the Ajo exists
     * @return isActive Whether the Ajo is active
     */
    function ajoStatus(uint256 ajoId) external view returns (bool exists, bool isActive) {
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
    function getFactoryStats() external view returns (uint256 totalCreated, uint256 activeCount) {
        totalCreated = totalAjos;
        
        // Count active Ajos
        for (uint256 i = 1; i < nextAjoId; i++) {
            if (ajos[i].isActive) {
                activeCount++;
            }
        }
        
        return (totalCreated, activeCount);
    }

    // Admin functions (if needed later)
    
    /**
     * @dev Deactivate an Ajo (for emergencies)
     * @param ajoId The Ajo ID to deactivate
     */
    function deactivateAjo(uint256 ajoId) external {
        require(ajoId > 0 && ajoId < nextAjoId, "Invalid Ajo ID");
        
        AjoInfo storage info = ajos[ajoId];
        require(info.creator == msg.sender, "Only creator can deactivate");
        
        info.isActive = false;
    }
}