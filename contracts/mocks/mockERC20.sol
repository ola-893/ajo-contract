// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;



// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";

// /**
//  * @title MockERC20
//  * @dev Simple ERC20 token for testing purposes with mint functionality
//  */
// contract MockERC20 is ERC20, Ownable {
//     uint8 private _customDecimals;
    
//     constructor(
//         string memory name,
//         string memory symbol,
//         uint8 customDecimals
//     ) ERC20(name, symbol) {
//         _customDecimals = customDecimals;
//     }
    
//     function decimals() public view virtual override returns (uint8) {
//         return _customDecimals;
//     }
    
//     /**
//      * @dev Mint tokens to specified address (only owner)
//      */
//     function mint(address to, uint256 amount) external onlyOwner {
//         _mint(to, amount);
//     }
    
//     /**
//      * @dev Mint tokens to caller (for testing)
//      */
//     function mintToSelf(uint256 amount) external {
//         _mint(msg.sender, amount);
//     }
    
//     /**
//      * @dev Burn tokens from caller
//      */
//     function burn(uint256 amount) external {
//         _burn(msg.sender, amount);
//     }
    
//     /**
//      * @dev Faucet function - anyone can get test tokens
//      */
//     function faucet() external {
//         uint256 faucetAmount;
        
//         if (_customDecimals == 6) {
//             // USDC-like token - give 1000 tokens
//             faucetAmount = 1000 * 10**6;
//         } else if (_customDecimals == 8) {
//             // HBAR-like token - give 10000 tokens  
//             faucetAmount = 10000 * 10**8;
//         } else {
//             // Default - give 1000 tokens
//             faucetAmount = 1000 * 10**_customDecimals;
//         }
        
//         _mint(msg.sender, faucetAmount);
//     }
// }