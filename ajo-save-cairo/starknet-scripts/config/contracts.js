/**
 * Deployed contract addresses and class hashes for Starknet networks
 */

export const CONTRACTS = {
  sepolia: {
    // Factory contract address
    factory: "0x058f0d1a69b43cbf678299c948fc36c5041170cd982ad7288efacdd3545042e6",
    
    // USDC token address (Circle USDC on Sepolia)
    usdc: "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343",
    
    // Class hashes for Ajo contracts (used when creating new Ajo groups)
    classHashes: {
      core: "0x072e49ee6f54172a00b67a61c25b3cd31e67cf0507d3f93179491390135c385e",
      members: "0x07f58b65262907ade7ed422eb138ce221b9791f0d991f7a468560fb309ced133",
      collateral: "0x007de0379791d5affce82c82a84fb639b0487b8f149a6ab26895128d260c79bf",
      payments: "0x031a0741d826c579bd66ae52605c42e78e86304b1928d1e8beffbc53dab0c0b6",
      governance: "0x067ce461390cabffdc105b38499d2bb0511d60cd59d46fd15563a0f9e979ba5d",
      schedule: "0x06dc39cf61ceae671925aac808897fa365495140d4359c5f32b584ef3310be4a"
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
