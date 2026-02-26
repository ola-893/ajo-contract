import { initializeStarknet, sleep } from '../utils/starknet.js';
import { loadTestAccounts } from '../utils/accounts.js';
import { colors, printBanner } from '../utils/formatting.js';
import { CONTRACTS } from '../config/contracts.js';
import { TEST_CONFIG } from '../config/constants.js';
import { setupAjo } from '../core/ajo-lifecycle.js';
import { setupParticipants, participantsJoinAjo } from '../core/participants.js';
import { runMultipleCycles } from '../core/payments.js';
import { displayCollateralSummary } from '../core/collateral.js';
import { runGovernanceDemo } from '../core/governance.js';
import { parseTokenAmount } from '../utils/tokens.js';

/**
 * Main full cycle demo
 */
async function main() {
  try {
    printBanner("STARKNET AJO - FULL LIFECYCLE DEMO");
    
    console.log(colors.cyan("  🎯 This demo will:\n"));
    console.log(colors.dim("    1. Create a new Ajo group"));
    console.log(colors.dim("    2. Setup and onboard participants"));
    console.log(colors.dim("    3. Run multiple payment cycles"));
    console.log(colors.dim("    4. Demonstrate governance features"));
    console.log(colors.dim("    5. Display comprehensive statistics\n"));
    
    // Initialize Starknet
    console.log(colors.cyan("  🔧 Initializing Starknet connection...\n"));
    const { provider, account } = await initializeStarknet('sepolia');
    console.log(colors.green("  ✅ Connected to Starknet Sepolia\n"));
    
    await sleep(1000);
    
    // Load test accounts
    console.log(colors.cyan("  👥 Loading test accounts...\n"));
    const testAccounts = loadTestAccounts(provider, 10);
    
    if (testAccounts.length === 0) {
      console.log(colors.red("  ❌ No test accounts found. Please configure TEST_ACCOUNT_X_ADDRESS and TEST_ACCOUNT_X_PRIVATE_KEY in .env\n"));
      process.exit(1);
    }
    
    console.log(colors.green(`  ✅ Loaded ${testAccounts.length} test accounts\n`));
    
    await sleep(1000);
    
    // Phase 1: Create Ajo
    const factoryAddress = CONTRACTS.sepolia.factory;
    const usdcAddress = CONTRACTS.sepolia.usdc;
    
    const { ajoId, ajoInfo } = await setupAjo(account, factoryAddress, {
      name: `Full Cycle Demo ${Date.now()}`,
      owner: account.address,
      core_class_hash: CONTRACTS.sepolia.classHashes.core,
      members_class_hash: CONTRACTS.sepolia.classHashes.members,
      collateral_class_hash: CONTRACTS.sepolia.classHashes.collateral,
      payments_class_hash: CONTRACTS.sepolia.classHashes.payments,
      governance_class_hash: CONTRACTS.sepolia.classHashes.governance,
      schedule_class_hash: CONTRACTS.sepolia.classHashes.schedule
    });
    
    await sleep(2000);
    
    // Phase 2: Setup participants
    const requiredBalance = parseTokenAmount("100", 6); // 100 USDC
    const participants = await setupParticipants(testAccounts, usdcAddress, ajoInfo, {
      requiredBalance
    });
    
    if (participants.length === 0) {
      console.log(colors.red("  ❌ No participants ready. Please ensure test accounts have sufficient USDC balance\n"));
      process.exit(1);
    }
    
    await sleep(2000);
    
    // Phase 3: Participants join
    const joinResults = await participantsJoinAjo(participants, ajoInfo.ajo_core);
    
    const successfulJoins = joinResults.filter(r => r.success).length;
    if (successfulJoins === 0) {
      console.log(colors.red("  ❌ No participants successfully joined\n"));
      process.exit(1);
    }
    
    await sleep(2000);
    
    // Display collateral summary
    await displayCollateralSummary(participants, ajoInfo.ajo_collateral, account);
    
    await sleep(2000);
    
    // Phase 4: Run payment cycles
    const cycleCount = parseInt(process.argv[2]) || 3;
    const cycleDuration = TEST_CONFIG.CYCLE_DURATION;
    
    console.log(colors.cyan(`  🔄 Running ${cycleCount} payment cycles...\n`));
    await runMultipleCycles(participants, ajoInfo, cycleCount, cycleDuration);
    
    await sleep(2000);
    
    // Phase 5: Governance demo (optional)
    if (successfulJoins >= 3) {
      console.log(colors.cyan("  🗳️ Running governance demo...\n"));
      
      await runGovernanceDemo(
        participants.slice(0, 5),
        ajoInfo.ajo_governance,
        "Adjust Cycle Duration",
        "Proposal to adjust cycle duration for better flexibility"
      );
    } else {
      console.log(colors.yellow("  ⚠️ Skipping governance demo (need at least 3 members)\n"));
    }
    
    await sleep(2000);
    
    // Final summary
    printBanner("FULL CYCLE COMPLETE");
    
    console.log(colors.green("  ✅ Full lifecycle demo completed successfully!\n"));
    console.log(colors.cyan("  📊 Summary:\n"));
    console.log(colors.dim(`    Ajo ID:              ${ajoId}`));
    console.log(colors.dim(`    Total Participants:  ${participants.length}`));
    console.log(colors.dim(`    Successful Joins:    ${successfulJoins}`));
    console.log(colors.dim(`    Cycles Completed:    ${cycleCount}`));
    console.log(colors.dim(`    Core Contract:       ${ajoInfo.ajo_core}`));
    console.log(colors.dim(`    Factory:             ${factoryAddress}\n`));
    
    console.log(colors.cyan("  🔗 View on Explorer:\n"));
    console.log(colors.dim(`    https://sepolia.voyager.online/contract/${ajoInfo.ajo_core}\n`));
    
  } catch (error) {
    console.error(colors.red("\n  ❌ Demo failed:"), error.message);
    console.error(colors.dim(error.stack));
    process.exit(1);
  }
}

// Run the demo
main();
