import { initializeStarknet } from '../utils/starknet.js';
import { loadTestAccounts } from '../utils/accounts.js';
import { colors, printBanner } from '../utils/formatting.js';
import { CONTRACTS } from '../config/contracts.js';
import { getAjoInfo, getFactoryStats } from '../core/factory.js';
import { displayCollateralInfo, displayCollateralSummary, runCollateralDemo } from '../core/collateral.js';
import { displayPaymentAnalytics, getCurrentCycle, getCycleInfo, displayCycleInfo } from '../core/payments.js';
import { getAllMembers, displayMemberTable } from '../core/participants.js';
import { Contract } from 'starknet';
import { FACTORY_ABI, MEMBERS_ABI } from '../abis/index.js';

/**
 * Display factory statistics
 */
async function displayFactoryStatistics(factoryContract) {
  printBanner("FACTORY STATISTICS");
  
  try {
    const stats = await getFactoryStats(factoryContract);
    
    console.log(colors.cyan("  📊 Factory Overview\n"));
    console.log(colors.dim(`  Total Ajos Created:  ${stats.totalCreated}`));
    console.log(colors.dim(`  Active Ajos:         ${stats.activeCount}`));
    console.log(colors.dim(`  Inactive Ajos:       ${stats.totalCreated - stats.activeCount}\n`));
    
    console.log(colors.green("  ✅ Factory statistics displayed\n"));
    
  } catch (error) {
    console.log(colors.red(`  ❌ Failed to get factory stats: ${error.message}\n`));
  }
}

/**
 * Display member statistics
 */
async function displayMemberStatistics(ajoInfo, account) {
  printBanner("MEMBER STATISTICS");
  
  try {
    const memberAddresses = await getAllMembers(ajoInfo.ajo_members, account);
    
    console.log(colors.cyan("  📊 Member Overview\n"));
    console.log(colors.dim(`  Total Members:       ${memberAddresses.length}`));
    console.log(colors.dim(`  Member Addresses:\n`));
    
    memberAddresses.forEach((addr, i) => {
      console.log(colors.dim(`    ${i + 1}. ${addr}`));
    });
    
    console.log();
    console.log(colors.green("  ✅ Member statistics displayed\n"));
    
  } catch (error) {
    console.log(colors.red(`  ❌ Failed to get member stats: ${error.message}\n`));
  }
}

/**
 * Display payment statistics
 */
async function displayPaymentStatistics(ajoInfo, participants, account) {
  printBanner("PAYMENT STATISTICS");
  
  try {
    // Get current cycle
    const currentCycle = await getCurrentCycle(ajoInfo.ajo_schedule, account);
    console.log(colors.cyan(`  📊 Current Cycle: ${currentCycle}\n`));
    
    // Get cycle info
    if (currentCycle > 0) {
      const cycleInfo = await getCycleInfo(ajoInfo.ajo_schedule, currentCycle, account);
      displayCycleInfo(cycleInfo);
    }
    
    // Display payment analytics
    await displayPaymentAnalytics(participants, ajoInfo.ajo_payments, account);
    
    console.log(colors.green("  ✅ Payment statistics displayed\n"));
    
  } catch (error) {
    console.log(colors.red(`  ❌ Failed to get payment stats: ${error.message}\n`));
  }
}

/**
 * Display all view functions
 */
async function displayAllViewFunctions(factoryContract, ajoInfo, participants, account) {
  printBanner("COMPREHENSIVE VIEW FUNCTIONS");
  
  // Factory stats
  await displayFactoryStatistics(factoryContract);
  
  // Member stats
  await displayMemberStatistics(ajoInfo, account);
  
  // Payment stats
  await displayPaymentStatistics(ajoInfo, participants, account);
  
  // Collateral info
  await displayCollateralInfo(participants, ajoInfo.ajo_collateral, account);
  await displayCollateralSummary(participants, ajoInfo.ajo_collateral, account);
}

/**
 * Main advanced features demo
 */
async function main() {
  try {
    printBanner("STARKNET AJO - ADVANCED FEATURES DEMO");
    
    // Initialize Starknet
    console.log(colors.cyan("  🔧 Initializing Starknet connection...\n"));
    const { provider, account } = await initializeStarknet('sepolia');
    console.log(colors.green("  ✅ Connected to Starknet Sepolia\n"));
    
    // Load test accounts
    console.log(colors.cyan("  👥 Loading test accounts...\n"));
    const testAccounts = loadTestAccounts(provider, 10);
    console.log(colors.green(`  ✅ Loaded ${testAccounts.length} test accounts\n`));
    
    // Get Ajo ID from command line or use default
    const ajoId = process.argv[2] || 1;
    console.log(colors.cyan(`  📋 Loading Ajo #${ajoId}...\n`));
    
    // Get Ajo info
    const factoryAddress = CONTRACTS.sepolia.factory;
    const factory = new Contract(FACTORY_ABI, factoryAddress, account);
    const ajoInfo = await getAjoInfo(factory, ajoId);
    
    console.log(colors.green("  ✅ Ajo loaded\n"));
    
    // Create participant objects
    const names = ["Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka", 
                   "Funmilayo", "Gbenga", "Halima", "Ifeanyi", "Joke"];
    const participants = testAccounts.slice(0, Math.min(testAccounts.length, 10)).map((acc, i) => ({
      account: acc,
      name: names[i],
      address: acc.address,
      position: i + 1
    }));
    
    // Menu
    console.log(colors.cyan("  📋 Select Demo:\n"));
    console.log(colors.dim("    1. View Functions Demo"));
    console.log(colors.dim("    2. Collateral Simulation"));
    console.log(colors.dim("    3. All Features\n"));
    
    const demoType = process.argv[3] || '3';
    
    switch (demoType) {
      case '1':
        await displayAllViewFunctions(factory, ajoInfo, participants, account);
        break;
        
      case '2':
        await runCollateralDemo(participants, ajoInfo, account);
        break;
        
      case '3':
      default:
        await displayAllViewFunctions(factory, ajoInfo, participants, account);
        await runCollateralDemo(participants, ajoInfo, account);
        break;
    }
    
    // Final summary
    printBanner("DEMO COMPLETE");
    console.log(colors.green("  ✅ Advanced features demo completed successfully!\n"));
    
  } catch (error) {
    console.error(colors.red("\n  ❌ Demo failed:"), error.message);
    console.error(colors.dim(error.stack));
    process.exit(1);
  }
}

// Run the demo
main();
