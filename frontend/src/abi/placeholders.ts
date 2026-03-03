// ABIs for Cairo contracts
import factoryAbiJson from './factory.json';
import coreAbiJson from './core.json';
import membersAbiJson from './members.json';
import paymentsAbiJson from './payments.json';
import governanceAbiJson from './governance.json';
import collateralAbiJson from './collateral.json';
import scheduleAbiJson from './schedule.json';
import bridgeAdapterAbiJson from './bridgeAdapter.json';
import swapRouterAbiJson from './swapRouter.json';
import btcCollateralAdapterAbiJson from './btcCollateralAdapter.json';
import erc20AbiJson from './erc20.json';

export const ajoFactoryAbi = factoryAbiJson;
export const ajoCoreAbi = coreAbiJson;
export const ajoMembersAbi = membersAbiJson;
export const ajoPaymentsAbi = paymentsAbiJson;
export const ajoGovernanceAbi = governanceAbiJson;
export const ajoCollateralAbi = collateralAbiJson;
export const ajoScheduleAbi = scheduleAbiJson;
export const bridgeAdapterAbi = bridgeAdapterAbiJson;
export const swapRouterAbi = swapRouterAbiJson;
export const btcCollateralAdapterAbi = btcCollateralAdapterAbiJson;
export const erc20Abi = erc20AbiJson;

// Export individual ABIs for easy access
export {
  factoryAbiJson,
  coreAbiJson,
  membersAbiJson,
  paymentsAbiJson,
  governanceAbiJson,
  collateralAbiJson,
  scheduleAbiJson,
  bridgeAdapterAbiJson,
  swapRouterAbiJson,
  btcCollateralAdapterAbiJson,
  erc20AbiJson,
};
