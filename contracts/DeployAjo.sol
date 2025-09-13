// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// import "./AjoMembers.sol";
// import "./AjoCollateral.sol";
// import "./AjoPayments.sol";
// import "./AjoGovernance.sol";
// import "./AjoCore.sol";

// contract DeployAjo {
    
//     struct DeployedContracts {
//         address ajoCore;
//         address ajoMembers;
//         address ajoCollateral;
//         address ajoPayments;
//         address ajoGovernance;
//     }
    
//     event AjoDeployed(DeployedContracts contracts);
    
//     function deployAjoSystem(
//         address _usdc,
//         address _hbar
//     ) external returns (DeployedContracts memory deployed) {
        
//         // Deploy core contract first (with placeholder addresses)
//         AjoCore ajoCore = new AjoCore(_usdc, _hbar, address(0), address(0), address(0), address(0));
        
//         // Deploy member management contract
//         AjoMembers ajoMembers = new AjoMembers(address(ajoCore));
        
//         // Deploy collateral management contract
//         AjoCollateral ajoCollateral = new AjoCollateral(_usdc, _hbar, address(ajoCore), address(ajoMembers));
        
//         // Deploy payments contract
//         AjoPayments ajoPayments = new AjoPayments(_usdc, _hbar, address(ajoCore), address(ajoMembers));
        
//         // Deploy governance contract
//         AjoGovernance ajoGovernance = new AjoGovernance(address(ajoCore), address(ajoMembers));
        
//         deployed = DeployedContracts({
//             ajoCore: address(ajoCore),
//             ajoMembers: address(ajoMembers),
//             ajoCollateral: address(ajoCollateral),
//             ajoPayments: address(ajoPayments),
//             ajoGovernance: address(ajoGovernance)
//         });
        
//         emit AjoDeployed(deployed);
        
//         return deployed;
//     }
    
//     function getDeploymentSize() external pure returns (uint256[] memory sizes) {
//         sizes = new uint256[](5);
        
//         // These are approximate sizes - actual sizes will depend on compiler optimizations
//         sizes[0] = type(AjoCore).creationCode.length;      // AjoCore
//         sizes[1] = type(AjoMembers).creationCode.length;   // AjoMembers  
//         sizes[2] = type(AjoCollateral).creationCode.length; // AjoCollateral
//         sizes[3] = type(AjoPayments).creationCode.length;  // AjoPayments
//         sizes[4] = type(AjoGovernance).creationCode.length; // AjoGovernance
        
//         return sizes;
//     }
// }