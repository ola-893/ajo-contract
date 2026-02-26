/**
 * Starknet Network Configurations
 * 
 * This module exports network configurations for Starknet Sepolia testnet and Mainnet.
 * RPC URLs can be overridden via environment variables.
 */

export const NETWORKS = {
  sepolia: {
    name: "Starknet Sepolia",
    rpcUrl: process.env.STARKNET_RPC || "https://starknet-sepolia.public.blastapi.io",
    chainId: "SN_SEPOLIA",
    explorer: "https://sepolia.voyager.online",
    explorerTx: (hash) => `https://sepolia.voyager.online/tx/${hash}`,
    explorerContract: (address) => `https://sepolia.voyager.online/contract/${address}`,
    explorerAccount: (address) => `https://sepolia.voyager.online/contract/${address}`
  },
  mainnet: {
    name: "Starknet Mainnet",
    rpcUrl: process.env.STARKNET_MAINNET_RPC || "https://starknet-mainnet.public.blastapi.io",
    chainId: "SN_MAIN",
    explorer: "https://voyager.online",
    explorerTx: (hash) => `https://voyager.online/tx/${hash}`,
    explorerContract: (address) => `https://voyager.online/contract/${address}`,
    explorerAccount: (address) => `https://voyager.online/contract/${address}`
  }
};

/**
 * Get network configuration by name
 * @param {string} networkName - Network name ('sepolia' or 'mainnet')
 * @returns {object} Network configuration
 * @throws {Error} If network name is invalid
 */
export function getNetwork(networkName = 'sepolia') {
  const network = NETWORKS[networkName.toLowerCase()];
  
  if (!network) {
    throw new Error(
      `Invalid network: ${networkName}. Valid options: ${Object.keys(NETWORKS).join(', ')}`
    );
  }
  
  return network;
}

/**
 * Get the current network from environment or default to Sepolia
 * @returns {object} Network configuration
 */
export function getCurrentNetwork() {
  const networkName = process.env.STARKNET_NETWORK || 'sepolia';
  return getNetwork(networkName);
}

/**
 * Validate that required environment variables are set for the network
 * @param {string} networkName - Network name to validate
 * @returns {boolean} True if valid
 * @throws {Error} If required variables are missing
 */
export function validateNetworkConfig(networkName = 'sepolia') {
  const network = getNetwork(networkName);
  
  if (!network.rpcUrl) {
    throw new Error(`RPC URL not configured for ${networkName}`);
  }
  
  return true;
}
