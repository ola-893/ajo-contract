#!/usr/bin/env node

/**
 * Quick Test Demo Script
 * 
 * This script performs a quick smoke test of the Ajo factory:
 * 1. Connects to Starknet Sepolia
 * 2. Creates a new Ajo group
 * 3. Verifies contract deployment
 * 4. Displays Ajo information
 * 
 * Usage:
 *   node demos/quick-test.js
 * 
 * Requirements:
 *   - STARKNET_ACCOUNT_ADDRESS in .env
 *   - STARKNET_PRIVATE_KEY in .env
 *   - Sufficient STRK for gas fees
 */

import dotenv from 'dotenv';
import { Contract } from 'starknet';
import { initializeStarknet } from '../utils/starknet.js';
import { setupAjo } from '../core/ajo-lifecycle.js';
import { displayFactoryStats } from '../core/factory.js';
import { getContracts } from '../config/contracts.js';
import { ABIS } from '../abis/index.js';
import { colors, printBanner } from '../utils/formatting.js';

// Load environment variables
dotenv.config();

/**
 * Main test function
 */
async function runQuickTest() {
  try {
    printBanner("STARKNET AJO QUICK TEST");
    
    console.log(colors.cyan("  🚀 Initializing Starknet connection...\n"));
    
    // Initialize Starknet
    const { provider, account, config } = await initializeStarknet('sepolia');
    
    console.log(colors.green(`  ✅ Connected to ${config.name}`));
    console.log(colors.dim(`     RPC: ${config.rpcUrl}`));
    console.log(colors.dim(`     Account: ${account.address}\n`));
    
    // Get contract addresses
    const contracts = getContracts('sepolia');
    console.log(colors.cyan("  📋 Contract Configuration:"));
    console.log(colors.dim(`     Factory: ${contracts.factory}`));
    console.log(colors.dim(`     USDC:    ${contracts.usdc}\n`));
    
    // Display factory stats
    const factory = new Contract(ABIS.factory, contracts.factory, account);
    await displayFactoryStats(factory);
    
    // Create test Ajo
    const ajoConfig = {
      name: `QuickTest_${Date.now()}`,
      owner: account.address,
      core_class_hash: contracts.classHashes.core,
      members_class_hash: contracts.classHashes.members,
      collateral_class_hash: contracts.classHashes.collateral,
      payments_class_hash: contracts.classHashes.payments,
      governance_class_hash: contracts.classHashes.governance,
      schedule_class_hash: contracts.classHashes.schedule
    };
    
    // Setup Ajo (create, verify, display)
    const { ajoId, ajoInfo } = await setupAjo(account, contracts.factory, ajoConfig);
    
    // Final summary
    printBanner("TEST COMPLETE");
    
    console.log(colors.green("  ✅ Quick test completed successfully!\n"));
    console.log(colors.cyan("  📊 Summary:"));
    console.log(colors.dim(`     Ajo ID:     ${ajoId}`));
    console.log(colors.dim(`     Ajo Name:   ${ajoInfo.name}`));
    console.log(colors.dim(`     Status:     ${ajoInfo.is_active ? 'Active' : 'Inactive'}`));
    console.log(colors.dim(`     Core:       ${ajoInfo.ajo_core}\n`));
    
    console.log(colors.cyan("  🔗 Explorer Links:"));
    console.log(colors.dim(`     Factory:    ${config.explorerContract(contracts.factory)}`));
    console.log(colors.dim(`     Ajo Core:   ${config.explorerContract(ajoInfo.ajo_core)}\n`));
    
    console.log(colors.yellow("  💡 Next Steps:"));
    console.log(colors.dim("     - Run participant demo to test joining"));
    console.log(colors.dim("     - Run payment cycle demo to test payments"));
    console.log(colors.dim("     - Run full-cycle demo for complete workflow\n"));
    
  } catch (error) {
    console.error(colors.red("\n  ❌ Test failed:"));
    console.error(colors.red(`     ${error.message}\n`));
    
    if (error.stack && process.env.DEBUG === 'true') {
      console.error(colors.dim(error.stack));
    }
    
    process.exit(1);
  }
}

/**
 * Validate environment before running
 */
function validateEnvironment() {
  const required = [
    'STARKNET_ACCOUNT_ADDRESS',
    'STARKNET_PRIVATE_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(colors.red("\n  ❌ Missing required environment variables:"));
    missing.forEach(key => {
      console.error(colors.red(`     - ${key}`));
    });
    console.error(colors.yellow("\n  💡 Copy .env.example to .env and fill in your values\n"));
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  validateEnvironment();
  runQuickTest();
}

export { runQuickTest };
