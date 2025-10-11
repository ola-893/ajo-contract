// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;



import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LockableContract - Base contract for setup lockdown functionality
 * @dev Provides setup phase control - functions can be locked after initial setup
 */
abstract contract LockableContract is Ownable {
    
    // State variable to track if setup is complete
    bool public setupComplete = false;
    
    // Event for transparency
    event SetupCompleted(uint256 timestamp);
    
    // Modifier to restrict functions to setup phase only
    modifier onlyDuringSetup() {
        require(!setupComplete, "Setup phase is complete");
        _;
    }
    
    // Modifier to restrict functions to after setup only
    modifier onlyAfterSetup() {
        require(setupComplete, "Setup not complete yet");
        _;
    }
    
    /**
     * @dev Complete setup and lock setup functions forever
     * This is irreversible - once called, setup functions can never be called again
     */
    function completeSetup() external onlyOwner onlyDuringSetup {
        setupComplete = true;
        emit SetupCompleted(block.timestamp);
    }
    
    /**
     * @dev Check if contract is still in setup mode
     */
    function isSetupComplete() external view returns (bool) {
        return setupComplete;
    }
    
    /**
     * @dev Abstract function - each contract must implement its own validation
     * Returns true if all required addresses are set and non-zero
     */
    function verifySetup() external view virtual returns (bool isValid, string memory reason);
}