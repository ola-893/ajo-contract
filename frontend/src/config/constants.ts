// Starknet Configuration
export const STARKNET_CONFIG = {
  network: "sepolia" as const,
  walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "",
};

// Token Addresses
export const TOKEN_ADDRESSES = {
  sepolia: {
    STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    USDC: "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343",
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
  mainnet: {
    STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    USDC: "", // Update with mainnet address when available
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
};

// Contract Addresses - Read from environment variables
export const CONTRACT_ADDRESSES = {
  sepolia: {
    ajoFactory: import.meta.env.VITE_AJO_FACTORY_ADDRESS || "",
    // Individual Ajo contracts created via factory will be stored in state
  },
  mainnet: {
    ajoFactory: "", // Replace with actual deployed contract address
  },
  devnet: {
    ajoFactory: "", // For local testing
  },
};

// Starknet transaction configuration
export const TX_CONFIG = {
  maxFee: 1000000000000000, // 0.001 ETH in wei
  version: 1,
};
