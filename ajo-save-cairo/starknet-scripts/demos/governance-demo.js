import { initializeStarknet } from '../utils/starknet.js';
import { loadTestAccounts } from '../utils/accounts.js';
import { colors, printBanner } from '../utils/formatting.js';
import { CONTRACTS } from '../config/contracts.js';
import { getAjoInfo } from '../core/factory.js';
import { runGovernanceDemo, displayVotingResults } from '../core/governance.js';

/**
 * Main governance demo
 */
async function main() {
  try {
    printBanner("STARKNET AJO - GOVERNANCE DEMO");
    
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
    const { Contract } = await import('starknet');
    const { FACTORY_ABI } = await import('../abis/index.js');
    const factory = new Contract(FACTORY_ABI, factoryAddress, account);
    const ajoInfo = await getAjoInfo(factory, ajoId);
    
    console.log(colors.green("  ✅ Ajo loaded\n"));
    console.log(colors.dim(`  Governance: ${ajoInfo.ajo_governance}\n`));
    
    // Create participant objects
    const participants = testAccounts.slice(0, 5).map((acc, i) => ({
      account: acc,
      name: ["Adunni", "Babatunde", "Chinwe", "Damilola", "Emeka"][i],
      address: acc.address
    }));
    
    // Run governance demo
    const { proposalId, voteResults } = await runGovernanceDemo(
      participants,
      ajoInfo.ajo_governance,
      "Increase Monthly Payment",
      "Proposal to increase monthly payment from $50 to $75 USDC"
    );
    
    // Display results
    displayVotingResults(voteResults);
    
    // Final summary
    printBanner("DEMO COMPLETE");
    console.log(colors.green("  ✅ Governance demo completed successfully!\n"));
    console.log(colors.dim(`  Proposal ID: ${proposalId}`));
    console.log(colors.dim(`  Votes Cast: ${voteResults.filter(r => r.success).length}\n`));
    
  } catch (error) {
    console.error(colors.red("\n  ❌ Demo failed:"), error.message);
    console.error(colors.dim(error.stack));
    process.exit(1);
  }
}

// Run the demo
main();
