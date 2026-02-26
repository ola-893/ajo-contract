// Starknet network types
export type NetworkName = "sepolia" | "mainnet" | "devnet";

export interface StarknetNetworkConfig {
  name: string;
  chainId: string;
  rpcUrl: string;
  explorerUrl: string;
}

export type NetworkConfigs = {
  [key in NetworkName]: StarknetNetworkConfig;
};

export type AppConfig = {
  networks: NetworkConfigs;
};
