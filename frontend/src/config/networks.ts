import type { StarknetNetworkConfig, NetworkConfigs } from "./type";

export const NETWORK_TYPE = {
  SEPOLIA: "sepolia",
  MAINNET: "mainnet",
  DEVNET: "devnet",
} as const;

export const STARKNET_NETWORKS: NetworkConfigs = {
  sepolia: {
    name: "Starknet Sepolia Testnet",
    chainId: "0x534e5f5345504f4c4941", // SN_SEPOLIA
    rpcUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
    explorerUrl: "https://sepolia.starkscan.co",
  },
  mainnet: {
    name: "Starknet Mainnet",
    chainId: "0x534e5f4d41494e", // SN_MAIN
    rpcUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
    explorerUrl: "https://starkscan.co",
  },
  devnet: {
    name: "Starknet Devnet",
    chainId: "0x534e5f474f45524c49", // SN_GOERLI (for local devnet)
    rpcUrl: "http://127.0.0.1:5050/rpc",
    explorerUrl: "http://127.0.0.1:5050",
  },
};

export type NetworkType = (typeof NETWORK_TYPE)[keyof typeof NETWORK_TYPE];
