import { Contract } from 'starknet';
import { colors, printBanner } from '../utils/formatting.js';
import { waitForTransaction, sleep } from '../utils/starknet.js';
import { retryWithBackoff } from '../utils/retry.js';
import { COLLATERAL_ABI, CORE_ABI } from '../abis/index.js';

/**
 * Calculate collateral requirement
 * @param {string} collateralAddress - Collateral contract address
 * @param {number} position - Member position
 * @param {bigint} monthlyPayment - Monthly payment amount
 * @param {number} totalMembers - Total number of members
 * @param {Account} account - Account to use for query
 * @returns {bigint} Required collateral amount
 */
export async function calculateCollateral(collateralAddress, position, monthlyPayment, totalMembers, account) {
  const collateral = new Contract(COLLATERAL_ABI, collateralAddress, account);
  return await collateral.calculate_collateral_requirement(position, monthlyPayment, totalMembers);
}

/**
 * Get collateral requirement for member
 * @param {string} collateralAddress - Collateral contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {bigint} Required collateral amount
 */
export async function getCollateralRequirement(collateralAddress, memberAddress, account) {
  const collateral = new Contract(COLLATERAL_ABI, collateralAddress, account);
  return await collateral.get_collateral_requirement(memberAddress);
}

/**
 * Get locked collateral for member
 * @param {string} collateralAddress - Collateral contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {bigint} Locked collateral amount
 */
export async function getLockedCollateral(collateralAddress, memberAddress, account) {
  const collateral = new Contract(COLLATERAL_ABI, collateralAddress, account);
  return await collateral.get_locked_collateral(memberAddress);
}

/**
 * Simulate member default
 * @param {Account} ownerAccount - Owner account to trigger default
 * @param {string} coreAddress - Core contract address
 * @param {string} defaulterAddress - Address of defaulting member
 * @returns {Object} Transaction receipt
 */
export async function simulateDefault(ownerAccount, coreAddress, defaulterAddress) {
  console.log(colors.yellow(`  ⚠️ Simulating default for ${defaulterAddress}\n`));
  
  const receipt = await retryWithBackoff(
    async () => {
      const core = new Contract(CORE_ABI, coreAddress, ownerAccount);
      const call = core.populate('handle_default', [defaulterAddress]);
      const tx = await ownerAccount.execute(call);
      return await waitForTransaction(ownerAccount.provider, tx.transaction_hash);
    },
    'Handle default'
  );
  
  console.log(colors.green(`  ✅ Default handled\n`));
  
  return receipt;
}

/**
 * Seize collateral from defaulter
 * @param {Account} ownerAccount - Owner account to seize collateral
 * @param {string} collateralAddress - Collateral contract address
 * @param {string} defaulterAddress - Address of defaulting member
 * @returns {Object} Transaction receipt
 */
export async function seizeCollateral(ownerAccount, collateralAddress, defaulterAddress) {
  console.log(colors.yellow(`  ⚠️ Seizing collateral from ${defaulterAddress}\n`));
  
  const receipt = await retryWithBackoff(
    async () => {
      const collateral = new Contract(COLLATERAL_ABI, collateralAddress, ownerAccount);
      const call = collateral.populate('seize_collateral', [defaulterAddress]);
      const tx = await ownerAccount.execute(call);
      return await waitForTransaction(ownerAccount.provider, tx.transaction_hash);
    },
    'Seize collateral'
  );
  
  console.log(colors.green(`  ✅ Collateral seized\n`));
  
  return receipt;
}

/**
 * Get guarantor information
 * @param {string} collateralAddress - Collateral contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {Object} Guarantor information
 */
export async function getGuarantorInfo(collateralAddress, memberAddress, account) {
  const collateral = new Contract(COLLATERAL_ABI, collateralAddress, account);
  const guarantors = await collateral.get_guarantors(memberAddress);
  
  return {
    guarantorAddresses: guarantors.addresses || [],
    liabilityAmounts: guarantors.amounts || []
  };
}

/**
 * Display collateral information
 * @param {Array} participants - Array of participant objects
 * @param {string} collateralAddress - Collateral contract address
 * @param {Account} account - Account to use for queries
 */
export async function displayCollateralInfo(participants, collateralAddress, account) {
  console.log(colors.cyan("\n  📊 Collateral Information\n"));
  console.log(colors.dim("  ┌────┬─────────────┬──────────────┬─────────────────┬──────────────┐"));
  console.log(colors.dim("  │ #  │ Name        │ Position     │ Locked          │ Required     │"));
  console.log(colors.dim("  ├────┼─────────────┼──────────────┼─────────────────┼──────────────┤"));
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      const locked = await getLockedCollateral(collateralAddress, participant.address, account);
      const required = await getCollateralRequirement(collateralAddress, participant.address, account);
      
      const lockedFormatted = (Number(locked) / 1e6).toFixed(2);
      const requiredFormatted = (Number(required) / 1e6).toFixed(2);
      
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `${participant.position.toString().padEnd(12)} │ $${lockedFormatted.padEnd(14)} │ $${requiredFormatted.padEnd(11)} │`
      ));
    } catch (error) {
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `${participant.position.toString().padEnd(12)} │ ${'N/A'.padEnd(14)} │ ${'N/A'.padEnd(11)} │`
      ));
    }
  }
  
  console.log(colors.dim("  └────┴─────────────┴──────────────┴─────────────────┴──────────────┘\n"));
}

/**
 * Display guarantor liability
 * @param {string} memberAddress - Member address
 * @param {string} collateralAddress - Collateral contract address
 * @param {Account} account - Account to use for query
 */
export async function displayGuarantorLiability(memberAddress, collateralAddress, account) {
  console.log(colors.cyan(`\n  📊 Guarantor Liability for ${memberAddress}\n`));
  
  try {
    const guarantorInfo = await getGuarantorInfo(collateralAddress, memberAddress, account);
    
    if (guarantorInfo.guarantorAddresses.length === 0) {
      console.log(colors.dim("  No guarantors found\n"));
      return;
    }
    
    console.log(colors.dim("  ┌────┬──────────────────────────────────────────────────┬─────────────────┐"));
    console.log(colors.dim("  │ #  │ Guarantor Address                                │ Liability       │"));
    console.log(colors.dim("  ├────┼──────────────────────────────────────────────────┼─────────────────┤"));
    
    for (let i = 0; i < guarantorInfo.guarantorAddresses.length; i++) {
      const address = guarantorInfo.guarantorAddresses[i];
      const liability = guarantorInfo.liabilityAmounts[i];
      const liabilityFormatted = (Number(liability) / 1e6).toFixed(2);
      
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${address.padEnd(48)} │ $${liabilityFormatted.padEnd(14)} │`
      ));
    }
    
    console.log(colors.dim("  └────┴──────────────────────────────────────────────────┴─────────────────┘\n"));
    
  } catch (error) {
    console.log(colors.red(`  ❌ Failed to get guarantor info: ${error.message}\n`));
  }
}

/**
 * Run collateral simulation demo
 * @param {Array} participants - Array of participant objects
 * @param {Object} ajoInfo - Ajo contract addresses
 * @param {Account} ownerAccount - Owner account
 */
export async function runCollateralDemo(participants, ajoInfo, ownerAccount) {
  printBanner("COLLATERAL & DEFAULT SIMULATION");
  
  // Step 1: Display initial collateral
  console.log(colors.cyan("  📋 Step 1: Initial Collateral Status\n"));
  await displayCollateralInfo(participants, ajoInfo.ajo_collateral, ownerAccount);
  
  await sleep(2000);
  
  // Step 2: Select a member to simulate default
  if (participants.length < 3) {
    console.log(colors.yellow("  ⚠️ Need at least 3 participants for default simulation\n"));
    return;
  }
  
  const defaulter = participants[participants.length - 1]; // Last member defaults
  console.log(colors.cyan(`  📋 Step 2: Simulating Default for ${defaulter.name}\n`));
  
  try {
    await simulateDefault(ownerAccount, ajoInfo.ajo_core, defaulter.address);
    
    await sleep(2000);
    
    // Step 3: Display guarantor liability
    console.log(colors.cyan("  📋 Step 3: Guarantor Liability Distribution\n"));
    await displayGuarantorLiability(defaulter.address, ajoInfo.ajo_collateral, ownerAccount);
    
    await sleep(2000);
    
    // Step 4: Seize collateral
    console.log(colors.cyan("  📋 Step 4: Seizing Collateral\n"));
    await seizeCollateral(ownerAccount, ajoInfo.ajo_collateral, defaulter.address);
    
    await sleep(2000);
    
    // Step 5: Display updated collateral
    console.log(colors.cyan("  📋 Step 5: Updated Collateral Status\n"));
    await displayCollateralInfo(participants, ajoInfo.ajo_collateral, ownerAccount);
    
    console.log(colors.green("  ✅ Collateral simulation complete\n"));
    
  } catch (error) {
    console.log(colors.red(`  ❌ Collateral simulation failed: ${error.message}\n`));
  }
}

/**
 * Calculate total collateral locked
 * @param {Array} participants - Array of participant objects
 * @param {string} collateralAddress - Collateral contract address
 * @param {Account} account - Account to use for queries
 * @returns {bigint} Total locked collateral
 */
export async function calculateTotalCollateral(participants, collateralAddress, account) {
  let total = 0n;
  
  for (const participant of participants) {
    try {
      const locked = await getLockedCollateral(collateralAddress, participant.address, account);
      total += locked;
    } catch (error) {
      // Skip if error
    }
  }
  
  return total;
}

/**
 * Display collateral summary
 * @param {Array} participants - Array of participant objects
 * @param {string} collateralAddress - Collateral contract address
 * @param {Account} account - Account to use for queries
 */
export async function displayCollateralSummary(participants, collateralAddress, account) {
  console.log(colors.cyan("\n  📊 Collateral Summary\n"));
  
  try {
    const totalLocked = await calculateTotalCollateral(participants, collateralAddress, account);
    const totalLockedFormatted = (Number(totalLocked) / 1e6).toFixed(2);
    const averageLocked = totalLocked / BigInt(participants.length);
    const averageLockedFormatted = (Number(averageLocked) / 1e6).toFixed(2);
    
    console.log(colors.dim(`  Total Participants:  ${participants.length}`));
    console.log(colors.dim(`  Total Locked:        $${totalLockedFormatted} USDC`));
    console.log(colors.dim(`  Average per Member:  $${averageLockedFormatted} USDC\n`));
    
  } catch (error) {
    console.log(colors.red(`  ❌ Failed to calculate summary: ${error.message}\n`));
  }
}
