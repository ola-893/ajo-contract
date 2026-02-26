import { STARKNET_NETWORKS, NETWORK_TYPE } from "./networks";
import type { AppConfig } from "./type";
import * as constants from "./constants";

export type { AppConfig, StarknetNetworkConfig, NetworkConfigs } from "./type";
export { STARKNET_NETWORKS, NETWORK_TYPE };
export type { NetworkType } from "./networks";

export const appConfig: AppConfig & {
  constants: typeof constants;
} = {
  networks: STARKNET_NETWORKS,
  constants,
};
