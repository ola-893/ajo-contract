import { Contract } from 'starknet';
import { createAjo, getAjoInfo } from './factory.js';
import { ABIS } from '../abis/index.js';
import { colors, printBanner } from '../utils/formatting.js';
import { sleep } from '../utils/starknet.js';

/**
 * Complete Ajo setup workflow
 * @param {Account} account - Starknet account
 * @param {string} factoryAddress - Factory contract address
 * @param {Object} config - Ajo configuration
 * @returns {Promise<Object>} Created Ajo info
 */
export async function setupAjo(account, factoryAddress, config) {
  printBanner("AJO CREATION & SETUP");
  
  // Step 1: Create Ajo
  console.log(colors.cyan("  📋 Step 1: Creating Ajo..."));
  const { ajoId, transactionHash } = await createAjo(account, factoryAddress, config);
  console.log(colors.green(`  ✅ Ajo created with ID: ${ajoId}`));
  console.log(colors.dim(`  🔗 Transaction: ${transactionHash}\n`));
  
  await sleep(2000);
  
  // Step 2: Verify deployment
  console.log(colors.cyan("  📋 Step 2: Verifying deployment..."));
  const factory = new Contract(ABIS.factory, factoryAddress, account);
  const ajoInfo = await verifyAjoDeployment(factory, ajoId);
  console.log(colors.green(`  ✅ Ajo contracts deployed\n`));
  
  // Step 3: Display info
  await displayAjoInfo(ajoInfo);
  
  return { ajoId, ajoInfo };
}

/**
 * Verify Ajo deployment
 * @param {Contract} factoryContract - Factory contract instance
 * @param {number} ajoId - Ajo ID
 * @returns {Promise<Object>} Ajo information
 */
export async function verifyAjoDeployment(factoryContract, ajoId) {
  try {
    const ajoInfo = await getAjoInfo(factoryContract, ajoId);
    
    // Verify all contract addresses are set
    const requiredContracts = [
      'ajo_core',
      'ajo_members',
      'ajo_collateral',
      'ajo_payments',
      'ajo_governance',
      'ajo_schedule'
    ];
    
    for (const contractKey of requiredContracts) {
      if (!ajoInfo[contractKey] || ajoInfo[contractKey] === '0x0') {
        throw new Error(`${contractKey} not deployed`);
      }
    }
    
    console.log(colors.green(`  ✅ All contracts verified`));
    return ajoInfo;
    
  } catch (error) {
    console.log(colors.red(`  ❌ Deployment verification failed: ${error.message}`));
    throw error;
  }
}

/**
 * Display Ajo information
 * @param {Object} ajoInfo - Ajo information
 */
export async function displayAjoInfo(ajoInfo) {
  console.log(colors.cyan("  📋 Ajo Information:"));
  console.log(colors.dim(`     ID:         ${ajoInfo.id}`));
  console.log(colors.dim(`     Name:       ${ajoInfo.name}`));
  console.log(colors.dim(`     Owner:      ${ajoInfo.owner}`));
  console.log(colors.dim(`     Active:     ${ajoInfo.is_active ? 'Yes' : 'No'}\n`));
  
  console.log(colors.cyan("  📋 Contract Addresses:"));
  console.log(colors.dim(`     Core:       ${ajoInfo.ajo_core}`));
  console.log(colors.dim(`     Members:    ${ajoInfo.ajo_members}`));
  console.log(colors.dim(`     Collateral: ${ajoInfo.ajo_collateral}`));
  console.log(colors.dim(`     Payments:   ${ajoInfo.ajo_payments}`));
  console.log(colors.dim(`     Governance: ${ajoInfo.ajo_governance}`));
  console.log(colors.dim(`     Schedule:   ${ajoInfo.ajo_schedule}\n`));
}

/**
 * Get Ajo core contract instance
 * @param {Account} account - Starknet account
 * @param {Object} ajoInfo - Ajo information
 * @returns {Contract} Core contract instance
 */
export function getAjoCoreContract(account, ajoInfo) {
  return new Contract(ABIS.core, ajoInfo.ajo_core, account);
}

/**
 * Get Ajo members contract instance
 * @param {Account} account - Starknet account
 * @param {Object} ajoInfo - Ajo information
 * @returns {Contract} Members contract instance
 */
export function getAjoMembersContract(account, ajoInfo) {
  return new Contract(ABIS.members, ajoInfo.ajo_members, account);
}

/**
 * Get Ajo payments contract instance
 * @param {Account} account - Starknet account
 * @param {Object} ajoInfo - Ajo information
 * @returns {Contract} Payments contract instance
 */
export function getAjoPaymentsContract(account, ajoInfo) {
  return new Contract(ABIS.payments, ajoInfo.ajo_payments, account);
}

/**
 * Get Ajo collateral contract instance
 * @param {Account} account - Starknet account
 * @param {Object} ajoInfo - Ajo information
 * @returns {Contract} Collateral contract instance
 */
export function getAjoCollateralContract(account, ajoInfo) {
  return new Contract(ABIS.collateral, ajoInfo.ajo_collateral, account);
}

/**
 * Get Ajo governance contract instance
 * @param {Account} account - Starknet account
 * @param {Object} ajoInfo - Ajo information
 * @returns {Contract} Governance contract instance
 */
export function getAjoGovernanceContract(account, ajoInfo) {
  return new Contract(ABIS.governance, ajoInfo.ajo_governance, account);
}
