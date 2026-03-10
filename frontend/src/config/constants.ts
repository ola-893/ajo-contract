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
    WBTC: "0x0496bef3ed20371382fBe0CA6A5a64252c5c848F9f1F0ccCF8110Fc4def912d5",
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
  mainnet: {
    STRK: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    USDC: "", // Update with mainnet address when available
    WBTC: "",
    ETH: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  },
};

// Contract Addresses - Read from environment variables
export const CONTRACT_ADDRESSES = {
  sepolia: {
    ajoFactory:
      import.meta.env.VITE_AJO_FACTORY_ADDRESS ||
      "0x0295f1221b20905844cb4977866f097e2af880b8b08c59b2f27e32b6a4011601",
    bridgeAdapter:
      import.meta.env.VITE_BRIDGE_ADAPTER_ADDRESS ||
      "0x072a35eee202f9f711e92c9731c1c9d452e3463b93c44f20e9cb406a80c3406d",
    swapRouter:
      import.meta.env.VITE_SWAP_ROUTER_ADDRESS ||
      "0x00690ab409afb13a81ef10df3c6dc5880b0bb99a5141d24cc5db9b320111fc1d",
    btcCollateralAdapter:
      import.meta.env.VITE_BTC_COLLATERAL_ADAPTER_ADDRESS ||
      "0x03444836110556606b35ccda6e9c1a51094f444ae0e415102595097b53341ccc",
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
