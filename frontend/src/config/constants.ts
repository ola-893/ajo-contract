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
    BTC: import.meta.env.VITE_BTC_TOKEN_ADDRESS || "",
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
  mainnet: {
    STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    USDC: "", // Update with mainnet address when available
    BTC: "",
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
};

// Contract Addresses - Read from environment variables
export const CONTRACT_ADDRESSES = {
  sepolia: {
    ajoFactory:
      import.meta.env.VITE_AJO_FACTORY_ADDRESS ||
      "0x058f0d1a69b43cbf678299c948fc36c5041170cd982ad7288efacdd3545042e6",
    bridgeAdapter:
      import.meta.env.VITE_BRIDGE_ADAPTER_ADDRESS ||
      "0x07b3140baa939d72d40b89a3647b2e7ac08f719dde54311490cf8bf0a8c44fac",
    swapRouter:
      import.meta.env.VITE_SWAP_ROUTER_ADDRESS ||
      "0x0613d8d56a9f7b9a1abeeb27119bb4bd3b9881c1720d367b7cd87029ffb1a157",
    btcCollateralAdapter:
      import.meta.env.VITE_BTC_COLLATERAL_ADAPTER_ADDRESS ||
      "0x01ecd36cf56d31533ea46c30e3c28983dd341a667549efadd9fbeff55fb7a2af",
    // Individual Ajo contracts created via factory will be stored in state
  },
  mainnet: {
    ajoFactory: "", // Replace with actual deployed contract address
    bridgeAdapter: "",
    swapRouter: "",
    btcCollateralAdapter: "",
  },
  devnet: {
    ajoFactory: "", // For local testing
    bridgeAdapter: "",
    swapRouter: "",
    btcCollateralAdapter: "",
  },
};

// Starknet transaction configuration
export const TX_CONFIG = {
  maxFee: 1000000000000000, // 0.001 ETH in wei
  version: 1,
};
