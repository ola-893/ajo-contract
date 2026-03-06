/**
 * Deployed contract addresses and class hashes for Starknet networks
 */

export const CONTRACTS = {
  sepolia: {
    // Factory contract address
    factory: "0x0295f1221b20905844cb4977866f097e2af880b8b08c59b2f27e32b6a4011601",
    
    // USDC token address (Circle USDC on Sepolia)
    usdc: "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343",
    
    // Class hashes for Ajo contracts (used when creating new Ajo groups)
    classHashes: {
      core: "0x055e8968f0be4e2e89a454ab61c469ac82cb3f5ecfecaf2135437e842ecb8905",
      members: "0x07f58b65262907ade7ed422eb138ce221b9791f0d991f7a468560fb309ced133",
      collateral: "0x07d2ffdc1b58f4d17b70d5288e02a4bc93481ac9835f2087bc1a971ddbf8182d",
      payments: "0x066a426deb875e97adc09090d1e2f5d5fb96a1f9b9dbe62fd785dd631b095648",
      governance: "0x07c4543c733cefaa7c0fa3ca1152952185af730e1f091553737f5e99653d204e",
      schedule: "0x03ed10be83a83737c2e9ba5cdf4248e0dd7ee96fa5953ca1af3a6312f158b813"
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
