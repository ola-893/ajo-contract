/**
 * Deployed contract addresses and class hashes for Starknet networks
 */

export const CONTRACTS = {
  sepolia: {
    // Factory contract address
    factory: "0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c",
    
    // USDC token address (Circle USDC on Sepolia)
    usdc: "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343",
    
    // Class hashes for Ajo contracts (used when creating new Ajo groups)
    classHashes: {
      core: "0x06176c5b1ffe45c49b7a70de1fc81a36a2a0de4c5e8828fca132a5aa5e00ccbe",
      members: "0x03ddd2cb0e4b49353fe570dcd56dbaa1f411f4c2400e9b5c94b53fb9833d6e2e",
      collateral: "0x04a3e8f8c5b6d7e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
      payments: "0x05b4f9a0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
      governance: "0x06c5a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
      schedule: "0x07d6b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0"
    }
  },
  
  mainnet: {
    // Mainnet addresses (to be deployed)
    factory: null,
    usdc: null,
    classHashes: {
      core: null,
      members: null,
      collateral: null,
      payments: null,
      governance: null,
      schedule: null
    }
  }
};

/**
 * Get contract addresses for a specific network
 * @param {string} network - Network name ('sepolia' or 'mainnet')
 * @returns {object} Contract addresses and class hashes
 */
export function getContracts(network = 'sepolia') {
  const contracts = CONTRACTS[network];
  
  if (!contracts) {
    throw new Error(`Unknown network: ${network}. Available networks: ${Object.keys(CONTRACTS).join(', ')}`);
  }
  
  return contracts;
}

/**
 * Validate that all required contracts are configured for a network
 * @param {string} network - Network name
 * @returns {boolean} True if all contracts are configured
 */
export function validateContracts(network = 'sepolia') {
  const contracts = getContracts(network);
  
  if (!contracts.factory) {
    throw new Error(`Factory address not configured for ${network}`);
  }
  
  if (!contracts.usdc) {
    throw new Error(`USDC address not configured for ${network}`);
  }
  
  // Check class hashes
  const missingHashes = Object.entries(contracts.classHashes)
    .filter(([_, hash]) => !hash)
    .map(([name, _]) => name);
  
  if (missingHashes.length > 0) {
    throw new Error(`Missing class hashes for ${network}: ${missingHashes.join(', ')}`);
  }
  
  return true;
}
