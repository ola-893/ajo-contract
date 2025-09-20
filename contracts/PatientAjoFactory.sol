// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PatientAjoFactory - Simplified Factory for Ajo Creation
 * @dev Minimal factory that tracks Ajo deployments without complex constructor
 */
contract PatientAjoFactory is Ownable, ReentrancyGuard {
    
    // ============ SIMPLE STATE VARIABLES ============
    
    struct AjoInstance {
        uint256 ajoId;
        address creator;
        address ajoCore;
        string name;
        uint256 createdAt;
        bool isActive;
    }
    
    // Factory settings
    uint256 public nextAjoId = 1;
    uint256 public creationFee = 1e18; // 1 HBAR
    uint256 public totalAjosCreated = 0;
    
    // Token addresses
    address public immutable USDC_TOKEN;
    address public immutable WHBAR_TOKEN;
    
    // Simple mappings
    mapping(uint256 => AjoInstance) public ajoInstances;
    mapping(address => uint256[]) public creatorAjos;
    uint256[] public allAjoIds;
    
    // ============ EVENTS ============
    
    event AjoRegistered(
        uint256 indexed ajoId,
        address indexed creator,
        address indexed ajoCore,
        string name
    );
    
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    
    // ============ SIMPLE CONSTRUCTOR ============
    
    constructor(address _usdcToken, address _whbarToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_whbarToken != address(0), "Invalid WHBAR address");
        
        USDC_TOKEN = _usdcToken;
        WHBAR_TOKEN = _whbarToken;
    }
    
    // ============ MAIN FUNCTIONS ============
    
    /**
     * @dev Register an externally deployed Ajo
     * This approach separates deployment from registration
     */
    function registerAjo(
        address ajoCoreAddress,
        string memory name
    ) external payable nonReentrant returns (uint256) {
        require(ajoCoreAddress != address(0), "Invalid AjoCore address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(msg.value >= creationFee, "Insufficient creation fee");
        
        uint256 ajoId = nextAjoId++;
        
        // Store Ajo instance
        ajoInstances[ajoId] = AjoInstance({
            ajoId: ajoId,
            creator: msg.sender,
            ajoCore: ajoCoreAddress,
            name: name,
            createdAt: block.timestamp,
            isActive: true
        });
        
        // Update mappings
        creatorAjos[msg.sender].push(ajoId);
        allAjoIds.push(ajoId);
        totalAjosCreated++;
        
        // Refund excess payment
        if (msg.value > creationFee) {
            payable(msg.sender).transfer(msg.value - creationFee);
        }
        
        emit AjoRegistered(ajoId, msg.sender, ajoCoreAddress, name);
        
        return ajoId;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get Ajo information by ID
     */
    function getAjoInfo(uint256 ajoId) external view returns (AjoInstance memory) {
        return ajoInstances[ajoId];
    }
    
    /**
     * @dev Get all Ajos created by an address
     */
    function getCreatorAjos(address creator) external view returns (uint256[] memory) {
        return creatorAjos[creator];
    }
    
    /**
     * @dev Get all Ajo IDs
     */
    function getAllAjos() external view returns (uint256[] memory) {
        return allAjoIds;
    }
    
    /**
     * @dev Get factory statistics
     */
    function getFactoryStats() external view returns (
        uint256 totalCreated,
        uint256 totalActive,
        uint256 currentCreationFee,
        address usdcToken,
        address whbarToken
    ) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allAjoIds.length; i++) {
            if (ajoInstances[allAjoIds[i]].isActive) {
                activeCount++;
            }
        }
        
        return (
            totalAjosCreated,
            activeCount,
            creationFee,
            USDC_TOKEN,
            WHBAR_TOKEN
        );
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Update creation fee (only owner)
     */
    function updateCreationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = newFee;
        emit CreationFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Deactivate an Ajo (emergency only)
     */
    function deactivateAjo(uint256 ajoId) external onlyOwner {
        require(ajoInstances[ajoId].isActive, "Ajo already inactive");
        ajoInstances[ajoId].isActive = false;
    }
    
    /**
     * @dev Withdraw accumulated creation fees
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(owner()).transfer(balance);
    }
}