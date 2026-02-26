import { Contract } from 'starknet';
import { ABIS } from '../abis/index.js';
import { waitForTransaction } from '../utils/starknet.js';
import { colors } from '../utils/formatting.js';
import { retryWithBackoff } from '../utils/retry.js';

/**
 * Get factory statistics
 * @param {Contract} factoryContract - Factory contract instance
 * @returns {Promise<Object>} Factory statistics
 */
export async function getFactoryStats(factoryContract) {
  return await retryWithBackoff(
    async () => {
      const stats = await factoryContract.get_factory_stats();
      return {
        totalCreated: Number(stats.total_created || stats[0] || 0),
        activeCount: Number(stats.active_count || stats[1] || 0)
      };
    },
    'Get factory stats'
  );
}

/**
 * Create new Ajo group
 * @param {Account} account - Starknet account
 * @param {string} factoryAddress - Factory contract address
 * @param {Object} config - Ajo configuration
 * @returns {Promise<Object>} Created Ajo info
 */
export async function createAjo(account, factoryAddress, config) {
  return await retryWithBackoff(
    async () => {
      const factory = new Contract(ABIS.factory, factoryAddress, account);
      
      console.log(colors.dim(`  📝 Creating Ajo with config:`));
      console.log(colors.dim(`     Name: ${config.name}`));
      console.log(colors.dim(`     Owner: ${config.owner}`));
      
      const call = factory.populate('create_ajo', [
        config.name,
        config.owner,
        config.core_class_hash,
        config.members_class_hash,
        config.collateral_class_hash,
        config.payments_class_hash,
        config.governance_class_hash,
        config.schedule_class_hash
      ]);
      
      const tx = await account.execute(call);
      console.log(colors.dim(`  ⏳ Transaction hash: ${tx.transaction_hash}`));
      
      const receipt = await waitForTransaction(account.provider, tx.transaction_hash);
      
      // Parse events to get Ajo ID
      const ajoId = parseAjoCreatedEvent(receipt);
      
      return { ajoId, receipt, transactionHash: tx.transaction_hash };
    },
    'Create Ajo'
  );
}

/**
 * Get Ajo information by ID
 * @param {Contract} factoryContract - Factory contract instance
 * @param {number} ajoId - Ajo ID
 * @returns {Promise<Object>} Ajo information
 */
export async function getAjoInfo(factoryContract, ajoId) {
  return await retryWithBackoff(
    async () => {
      const info = await factoryContract.get_ajo(ajoId);
      return {
        id: Number(info.id || info[0] || ajoId),
        name: info.name || info[1] || '',
        owner: info.owner || info[2] || '',
        ajo_core: info.ajo_core || info[3] || '',
        ajo_members: info.ajo_members || info[4] || '',
        ajo_collateral: info.ajo_collateral || info[5] || '',
        ajo_payments: info.ajo_payments || info[6] || '',
        ajo_governance: info.ajo_governance || info[7] || '',
        ajo_schedule: info.ajo_schedule || info[8] || '',
        is_active: info.is_active || info[9] || false
      };
    },
    `Get Ajo info for ID ${ajoId}`
  );
}

/**
 * Get all Ajos from factory
 * @param {Contract} factoryContract - Factory contract instance
 * @returns {Promise<Array>} Array of all Ajos
 */
export async function getAllAjos(factoryContract) {
  return await retryWithBackoff(
    async () => {
      const stats = await getFactoryStats(factoryContract);
      const ajos = [];
      
      for (let i = 1; i <= stats.totalCreated; i++) {
        try {
          const ajoInfo = await getAjoInfo(factoryContract, i);
          ajos.push(ajoInfo);
        } catch (error) {
          console.log(colors.yellow(`  ⚠️ Could not fetch Ajo ${i}: ${error.message}`));
        }
      }
      
      return ajos;
    },
    'Get all Ajos'
  );
}

/**
 * Parse AjoCreated event from transaction receipt
 * @param {Object} receipt - Transaction receipt
 * @returns {number} Ajo ID
 */
function parseAjoCreatedEvent(receipt) {
  try {
    // Look for AjoCreated event in the receipt
    const events = receipt.events || [];
    
    for (const event of events) {
      // Check if this is an AjoCreated event
      // The event structure may vary, so we check multiple possible formats
      if (event.keys && event.keys.length > 0) {
        // The first key is typically the event selector
        // For AjoCreated, we expect the ajo_id in the data
        if (event.data && event.data.length > 0) {
          // Try to extract ajo_id from event data
          // Typically it's the first data element
          const ajoId = Number(event.data[0]);
          if (ajoId > 0) {
            console.log(colors.dim(`  🎯 Parsed Ajo ID from event: ${ajoId}`));
            return ajoId;
          }
        }
      }
    }
    
    // If we couldn't parse the event, log a warning and return 0
    console.log(colors.yellow(`  ⚠️ Could not parse AjoCreated event, returning ID 0`));
    console.log(colors.dim(`  📋 Receipt events: ${JSON.stringify(events, null, 2)}`));
    return 0;
    
  } catch (error) {
    console.log(colors.yellow(`  ⚠️ Error parsing event: ${error.message}`));
    return 0;
  }
}

/**
 * Display factory statistics
 * @param {Contract} factoryContract - Factory contract instance
 */
export async function displayFactoryStats(factoryContract) {
  const stats = await getFactoryStats(factoryContract);
  
  console.log(colors.cyan('\n  📊 Factory Statistics:'));
  console.log(colors.dim(`     Total Created: ${stats.totalCreated}`));
  console.log(colors.dim(`     Active Count:  ${stats.activeCount}`));
  console.log();
}
