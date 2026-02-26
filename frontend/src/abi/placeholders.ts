// Placeholder ABIs for Cairo contracts
// Replace these with actual ABIs once Cairo contracts are compiled

export const ajoFactoryAbi = [] as const;
export const ajoCoreAbi = [] as const;
export const ajoMembersAbi = [] as const;
export const ajoPaymentsAbi = [] as const;
export const ajoGovernanceAbi = [] as const;
export const ajoCollateralAbi = [] as const;
export const erc20Abi = [] as const;

// Contract addresses will be updated once deployed to Starknet
export const CONTRACT_ADDRESSES = {
  // Starknet Sepolia Testnet
  sepolia: {
    ajoFactory: '',
    // Individual Ajo contracts will be created dynamically via factory
  },
  // Starknet Mainnet
  mainnet: {
    ajoFactory: '',
  },
} as const;
