import { Contract } from 'starknet';
import { colors, printBanner } from '../utils/formatting.js';
import { waitForTransaction, sleep } from '../utils/starknet.js';
import { retryWithBackoff } from '../utils/retry.js';
import { CORE_ABI, PAYMENTS_ABI, SCHEDULE_ABI } from '../abis/index.js';

/**
 * Process payment cycle
 * @param {Array} participants - Array of participant objects
 * @param {string} coreAddress - Core contract address
 * @param {string} paymentsAddress - Payments contract address
 * @returns {Array} Payment results
 */
export async function processPaymentCycle(participants, coreAddress, paymentsAddress) {
  printBanner("PAYMENT CYCLE");
  
  // Phase 1: Monthly payments
  console.log(colors.cyan("  📋 Phase 1: Monthly Payments\n"));
  
  const paymentResults = [];
  
  for (const participant of participants) {
    try {
      console.log(colors.dim(`    ${participant.name} making payment...`));
      
      await retryWithBackoff(
        async () => {
          const core = new Contract(CORE_ABI, coreAddress, participant.account);
          const call = core.populate('process_payment', []);
          const tx = await participant.account.execute(call);
          return await waitForTransaction(participant.account.provider, tx.transaction_hash);
        },
        `Process payment for ${participant.name}`
      );
      
      paymentResults.push({ name: participant.name, success: true });
      console.log(colors.green(`    ✅ Payment processed\n`));
      
    } catch (error) {
      paymentResults.push({ name: participant.name, success: false, error: error.message });
      console.log(colors.red(`    ❌ Payment failed: ${error.message}\n`));
    }
    
    await sleep(1500);
  }
  
  // Phase 2: Payout distribution
  console.log(colors.cyan("  📋 Phase 2: Payout Distribution\n"));
  
  try {
    await retryWithBackoff(
      async () => {
        const payments = new Contract(PAYMENTS_ABI, paymentsAddress, participants[0].account);
        const call = payments.populate('distribute_payout', []);
        const tx = await participants[0].account.execute(call);
        return await waitForTransaction(participants[0].account.provider, tx.transaction_hash);
      },
      'Distribute payout'
    );
    
    console.log(colors.green(`    ✅ Payout distributed\n`));
    
  } catch (error) {
    console.log(colors.red(`    ❌ Payout failed: ${error.message}\n`));
  }
  
  const successful = paymentResults.filter(r => r.success).length;
  console.log(colors.green(`  ✅ Cycle complete: ${successful}/${participants.length} payments\n`));
  
  return paymentResults;
}

/**
 * Process payment for single participant
 * @param {Account} account - Participant account
 * @param {string} coreAddress - Core contract address
 * @returns {Object} Transaction receipt
 */
export async function processPayment(account, coreAddress) {
  const core = new Contract(CORE_ABI, coreAddress, account);
  const call = core.populate('process_payment', []);
  const tx = await account.execute(call);
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Distribute payout
 * @param {Account} account - Account to execute transaction
 * @param {string} paymentsAddress - Payments contract address
 * @returns {Object} Transaction receipt
 */
export async function distributePayout(account, paymentsAddress) {
  const payments = new Contract(PAYMENTS_ABI, paymentsAddress, account);
  const call = payments.populate('distribute_payout', []);
  const tx = await account.execute(call);
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Get current cycle
 * @param {string} scheduleAddress - Schedule contract address
 * @param {Account} account - Account to use for query
 * @returns {number} Current cycle number
 */
export async function getCurrentCycle(scheduleAddress, account) {
  const schedule = new Contract(SCHEDULE_ABI, scheduleAddress, account);
  const currentCycle = await schedule.get_current_cycle();
  return Number(currentCycle);
}

/**
 * Advance to next cycle
 * @param {Account} account - Account to execute transaction
 * @param {string} scheduleAddress - Schedule contract address
 * @returns {Object} Transaction receipt
 */
export async function advanceCycle(account, scheduleAddress) {
  const schedule = new Contract(SCHEDULE_ABI, scheduleAddress, account);
  const call = schedule.populate('advance_cycle', []);
  const tx = await account.execute(call);
  return await waitForTransaction(account.provider, tx.transaction_hash);
}

/**
 * Get cycle information
 * @param {string} scheduleAddress - Schedule contract address
 * @param {number} cycleNumber - Cycle number
 * @param {Account} account - Account to use for query
 * @returns {Object} Cycle information
 */
export async function getCycleInfo(scheduleAddress, cycleNumber, account) {
  const schedule = new Contract(SCHEDULE_ABI, scheduleAddress, account);
  const cycleInfo = await schedule.get_cycle_info(cycleNumber);
  return {
    cycleNumber: Number(cycleInfo.cycle_number),
    startTime: Number(cycleInfo.start_time),
    endTime: Number(cycleInfo.end_time),
    payoutRecipient: cycleInfo.payout_recipient,
    isComplete: cycleInfo.is_complete
  };
}

/**
 * Display cycle information
 * @param {Object} cycleInfo - Cycle information object
 */
export function displayCycleInfo(cycleInfo) {
  console.log(colors.cyan("\n  📊 Cycle Information\n"));
  console.log(colors.dim(`  Cycle Number:     ${cycleInfo.cycleNumber}`));
  console.log(colors.dim(`  Start Time:       ${new Date(cycleInfo.startTime * 1000).toLocaleString()}`));
  console.log(colors.dim(`  End Time:         ${new Date(cycleInfo.endTime * 1000).toLocaleString()}`));
  console.log(colors.dim(`  Payout Recipient: ${cycleInfo.payoutRecipient}`));
  console.log(colors.dim(`  Status:           ${cycleInfo.isComplete ? colors.green('Complete') : colors.yellow('In Progress')}\n`));
}

/**
 * Get payment history
 * @param {string} paymentsAddress - Payments contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {Object} Payment history
 */
export async function getPaymentHistory(paymentsAddress, memberAddress, account) {
  const payments = new Contract(PAYMENTS_ABI, paymentsAddress, account);
  const history = await payments.get_payment_history(memberAddress);
  return {
    totalPaid: history.total_paid,
    paymentCount: Number(history.payment_count),
    lastPaymentTime: Number(history.last_payment_time)
  };
}

/**
 * Get payout recipient for cycle
 * @param {string} scheduleAddress - Schedule contract address
 * @param {number} cycleNumber - Cycle number
 * @param {Account} account - Account to use for query
 * @returns {string} Payout recipient address
 */
export async function getPayoutRecipient(scheduleAddress, cycleNumber, account) {
  const schedule = new Contract(SCHEDULE_ABI, scheduleAddress, account);
  return await schedule.get_payout_recipient(cycleNumber);
}

/**
 * Get total paid by member
 * @param {string} paymentsAddress - Payments contract address
 * @param {string} memberAddress - Member address
 * @param {Account} account - Account to use for query
 * @returns {bigint} Total amount paid
 */
export async function getTotalPaid(paymentsAddress, memberAddress, account) {
  const history = await getPaymentHistory(paymentsAddress, memberAddress, account);
  return history.totalPaid;
}

/**
 * Display payment analytics
 * @param {Array} participants - Array of participant objects
 * @param {string} paymentsAddress - Payments contract address
 * @param {Account} account - Account to use for queries
 */
export async function displayPaymentAnalytics(participants, paymentsAddress, account) {
  console.log(colors.cyan("\n  📊 Payment Analytics\n"));
  console.log(colors.dim("  ┌────┬─────────────┬──────────────┬─────────────────┬──────────────┐"));
  console.log(colors.dim("  │ #  │ Name        │ Total Paid   │ Payment Count   │ Last Payment │"));
  console.log(colors.dim("  ├────┼─────────────┼──────────────┼─────────────────┼──────────────┤"));
  
  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];
    
    try {
      const history = await getPaymentHistory(paymentsAddress, participant.address, account);
      const totalPaidFormatted = (Number(history.totalPaid) / 1e6).toFixed(2);
      const lastPaymentDate = history.lastPaymentTime > 0 
        ? new Date(history.lastPaymentTime * 1000).toLocaleDateString()
        : 'N/A';
      
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `$${totalPaidFormatted.padEnd(11)} │ ${history.paymentCount.toString().padEnd(15)} │ ${lastPaymentDate.padEnd(12)} │`
      ));
    } catch (error) {
      console.log(colors.dim(
        `  │ ${(i+1).toString().padStart(2)} │ ${participant.name.padEnd(11)} │ ` +
        `${'N/A'.padEnd(11)} │ ${'N/A'.padEnd(15)} │ ${'N/A'.padEnd(12)} │`
      ));
    }
  }
  
  console.log(colors.dim("  └────┴─────────────┴──────────────┴─────────────────┴──────────────┘\n"));
}

/**
 * Run multiple payment cycles
 * @param {Array} participants - Array of participant objects
 * @param {Object} ajoInfo - Ajo contract addresses
 * @param {number} cycleCount - Number of cycles to run
 * @param {number} cycleDuration - Duration between cycles in seconds
 */
export async function runMultipleCycles(participants, ajoInfo, cycleCount, cycleDuration) {
  for (let cycle = 1; cycle <= cycleCount; cycle++) {
    console.log(colors.magenta(`\n${"═".repeat(88)}`));
    console.log(colors.bright(`  CYCLE ${cycle} of ${cycleCount}`));
    console.log(colors.magenta(`${"═".repeat(88)}\n`));
    
    await processPaymentCycle(participants, ajoInfo.ajo_core, ajoInfo.ajo_payments);
    
    if (cycle < cycleCount) {
      console.log(colors.yellow(`  ⏳ Waiting ${cycleDuration}s for next cycle...\n`));
      await sleep(cycleDuration * 1000);
      
      // Advance cycle
      try {
        await advanceCycle(participants[0].account, ajoInfo.ajo_schedule);
        console.log(colors.green(`  ✅ Advanced to cycle ${cycle + 1}\n`));
      } catch (error) {
        console.log(colors.red(`  ❌ Failed to advance cycle: ${error.message}\n`));
      }
    }
  }
}
