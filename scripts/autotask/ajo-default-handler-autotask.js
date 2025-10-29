/**
 * Ajo.save Default Handler Autotask
 *
 * This Autotask monitors all Ajo groups and automatically processes
 * defaults when members miss payment deadlines.
 *
 * Execution Flow:
 * 1. Fetch all Ajos with automation enabled from Factory
 * 2. For each Ajo, check if automation should run
 * 3. If yes, fetch defaulters and process them in batches
 * 4. Log results and emit events for monitoring
 */

const {
  DefenderRelayProvider,
  DefenderRelaySigner,
} = require("defender-relay-client/lib/ethers");
const { ethers } = require("ethers");

// ============ CONTRACT ABIs ============

const AJO_FACTORY_ABI = [
  "function getAjosWithAutomation() external view returns (uint256[])",
  "function checkAutomationStatus(uint256[] calldata ajoIds) external view returns (tuple(uint256 ajoId, bool enabled, bool shouldRun, uint256 defaultersCount, string reason)[])",
  "function ajoCore(uint256 ajoId) external view returns (address)",
  "function ajoPayments(uint256 ajoId) external view returns (address)",
];

const AJO_CORE_ABI = [
  "function batchHandleDefaultsAutomated(address[] calldata defaulters) external returns (uint256 successCount, uint256 failureCount)",
  "function shouldAutomationRun() external view returns (bool shouldRun, string memory reason, uint256 defaultersCount)",
  "function getAutomationConfig() external view returns (bool enabled, uint256 gracePeriod, address[] memory authorizedAddresses)",
  "function shouldAdvanceCycle() external view returns (bool shouldAdvance, string memory reason, bool readyForPayout)",
  "function advanceCycleAutomated() external returns (bool success, bool payoutDistributed)",
  "function getCycleAdvancementStatus() external view returns (tuple(uint256 currentCycle, bool isFirstCycle, uint256 cycleStartTime, uint256 cycleDuration, uint256 timeElapsed, uint256 timeUntilAdvancement, bool autoAdvanceEnabled, bool allMembersPaid, uint256 lastPaymentTime, bool payoutReady, address nextPayoutRecipient, bool shouldAdvance, string advanceReason, bool needsPayout))",
  "event DefaultsHandledByAutomation(uint256 indexed cycle, address[] defaulters, uint256 timestamp, address indexed executor, uint256 successCount, uint256 failureCount)",
  "event CycleAdvancedAutomatically(uint256 indexed oldCycle, uint256 indexed newCycle, address indexed advancer, uint256 timestamp, bool hadPayout)",
];

const AJO_PAYMENTS_ABI = [
  "function getCurrentCycle() external view returns (uint256)",
  "function getMembersInDefault() external view returns (address[])",
  "function getDefaultStatus() external view returns (bool isPastDeadline, uint256 defaultersCount, address[] memory defaulters, uint256 currentCycleNum, uint256 deadlineTimestamp)",
];

// ============ CONFIGURATION ============

const CONFIG = {
  // Your deployed contract addresses
  FACTORY_ADDRESS: "0xYOUR_FACTORY_ADDRESS_HERE",

  // Batch processing limits
  MAX_BATCH_SIZE: 10,
  MAX_AJOS_PER_RUN: 5,

  // Gas configuration
  MAX_GAS_PRICE_GWEI: 200,
  GAS_LIMIT_PER_DEFAULT: 400000,

  // Safety checks
  MIN_DELAY_AFTER_DEADLINE: 3600, // 1 hour

  // Execution mode
  DRY_RUN: false, // Set to true for testing without executing transactions
};

// ============ HELPER FUNCTIONS ============

/**
 * Format wei to ether with specified decimals
 */
function formatEther(wei, decimals = 4) {
  return parseFloat(ethers.utils.formatEther(wei)).toFixed(decimals);
}

/**
 * Format timestamp to readable date
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Check if gas price is acceptable
 */
async function isGasPriceAcceptable(provider) {
  const gasPrice = await provider.getGasPrice();
  const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, "gwei"));

  console.log(`⛽ Current gas price: ${gasPriceGwei.toFixed(2)} gwei`);

  if (gasPriceGwei > CONFIG.MAX_GAS_PRICE_GWEI) {
    console.log(
      `⚠️  Gas price too high (max: ${CONFIG.MAX_GAS_PRICE_GWEI} gwei)`
    );
    return false;
  }

  return true;
}

/**
 * Process defaults for a single Ajo
 */
async function processAjoDefaults(ajoCore, ajoPayments, ajoId, signer) {
  console.log(`\n📋 Processing Ajo #${ajoId}...`);

  try {
    // Get default status
    const status = await ajoPayments.getDefaultStatus();
    const [
      isPastDeadline,
      defaultersCount,
      defaulters,
      currentCycle,
      deadline,
    ] = status;

    console.log(`   Cycle: ${currentCycle.toString()}`);
    console.log(`   Deadline: ${formatTimestamp(deadline)}`);
    console.log(`   Past deadline: ${isPastDeadline}`);
    console.log(`   Defaulters: ${defaultersCount.toString()}`);

    if (!isPastDeadline) {
      console.log(`   ✅ No action needed - deadline not reached`);
      return {
        ajoId,
        success: true,
        message: "Deadline not reached",
        processed: 0,
      };
    }

    if (defaultersCount.toNumber() === 0) {
      console.log(`   ✅ No action needed - all members paid`);
      return {
        ajoId,
        success: true,
        message: "All members paid",
        processed: 0,
      };
    }

    // Check if we should run automation
    const [shouldRun, reason, count] = await ajoCore.shouldAutomationRun();

    if (!shouldRun) {
      console.log(`   ⏸️  Automation check failed: ${reason}`);
      return { ajoId, success: false, message: reason, processed: 0 };
    }

    // Prepare batch
    const batchSize = Math.min(defaulters.length, CONFIG.MAX_BATCH_SIZE);
    const batch = defaulters.slice(0, batchSize);

    console.log(`\n   🚨 Processing ${batch.length} defaulter(s):`);
    batch.forEach((addr, i) => {
      console.log(`      ${i + 1}. ${addr}`);
    });

    // DRY RUN mode - don't execute
    if (CONFIG.DRY_RUN) {
      console.log(`   🔍 DRY RUN - Would process ${batch.length} defaults`);
      return {
        ajoId,
        success: true,
        message: "Dry run completed",
        processed: batch.length,
        dryRun: true,
      };
    }

    // Execute transaction
    console.log(`\n   📤 Executing batchHandleDefaultsAutomated...`);

    const gasEstimate = CONFIG.GAS_LIMIT_PER_DEFAULT * batch.length;

    const ajoCoreWithSigner = ajoCore.connect(signer);
    const tx = await ajoCoreWithSigner.batchHandleDefaultsAutomated(batch, {
      gasLimit: gasEstimate,
    });

    console.log(`   ⏳ Transaction submitted: ${tx.hash}`);
    console.log(`   💰 Gas limit: ${gasEstimate.toLocaleString()}`);

    const receipt = await tx.wait();

    console.log(`   ✅ Transaction confirmed!`);
    console.log(`   📦 Block: ${receipt.blockNumber}`);
    console.log(`   ⛽ Gas used: ${receipt.gasUsed.toString()}`);

    // Parse event to get success/failure counts
    const event = receipt.events?.find(
      (e) => e.event === "DefaultsHandledByAutomation"
    );

    if (event) {
      const successCount = event.args.successCount.toNumber();
      const failureCount = event.args.failureCount.toNumber();

      console.log(`   ✔️  Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${failureCount}`);

      return {
        ajoId,
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        processed: successCount,
        failed: failureCount,
        cycle: currentCycle.toString(),
      };
    } else {
      return {
        ajoId,
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        processed: batch.length,
        cycle: currentCycle.toString(),
      };
    }
  } catch (error) {
    console.error(`   ❌ Error processing Ajo #${ajoId}:`, error.message);
    return {
      ajoId,
      success: false,
      error: error.message,
      processed: 0,
    };
  }
}

// ============ MAIN HANDLER ============

exports.handler = async function (event) {
  const startTime = Date.now();
  console.log("🚀 Ajo.save Default Handler - Starting...");
  console.log(`⏰ Execution time: ${new Date().toISOString()}`);
  console.log(`🔧 Mode: ${CONFIG.DRY_RUN ? "DRY RUN" : "LIVE"}`);

  try {
    // Initialize provider and signer
    const provider = new DefenderRelayProvider(event);
    const signer = new DefenderRelaySigner(event, provider, { speed: "fast" });

    const relayerAddress = await signer.getAddress();
    console.log(`🔑 Relayer address: ${relayerAddress}`);

    // Check gas price
    if (!(await isGasPriceAcceptable(provider))) {
      return {
        success: false,
        message: "Gas price too high",
        timestamp: new Date().toISOString(),
      };
    }

    // Connect to Factory
    const factory = new ethers.Contract(
      CONFIG.FACTORY_ADDRESS,
      AJO_FACTORY_ABI,
      provider
    );

    console.log(`\n🏭 Connected to Factory: ${CONFIG.FACTORY_ADDRESS}`);

    // Get all Ajos with automation enabled
    const ajoIds = await factory.getAjosWithAutomation();
    console.log(`\n📊 Found ${ajoIds.length} Ajo(s) with automation enabled`);

    if (ajoIds.length === 0) {
      return {
        success: true,
        message: "No Ajos with automation enabled",
        timestamp: new Date().toISOString(),
      };
    }

    // Check automation status for all Ajos
    console.log(`\n🔍 Checking automation status...`);
    const statuses = await factory.checkAutomationStatus(ajoIds);

    // Filter Ajos that need processing
    const ajosToProcess = [];

    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      console.log(`\n   Ajo #${status.ajoId}:`);
      console.log(`   - Enabled: ${status.enabled}`);
      console.log(`   - Should run: ${status.shouldRun}`);
      console.log(`   - Defaulters: ${status.defaultersCount.toString()}`);
      console.log(`   - Reason: ${status.reason}`);

      if (
        status.enabled &&
        status.shouldRun &&
        status.defaultersCount.toNumber() > 0
      ) {
        ajosToProcess.push(status.ajoId);
      }
    }

    console.log(`\n✅ ${ajosToProcess.length} Ajo(s) need processing`);

    if (ajosToProcess.length === 0) {
      return {
        success: true,
        message: "No Ajos need processing at this time",
        ajosCnhecked: ajoIds.length,
        timestamp: new Date().toISOString(),
      };
    }

    // Limit number of Ajos to process per run
    const ajosThisRun = ajosToProcess.slice(0, CONFIG.MAX_AJOS_PER_RUN);

    if (ajosThisRun.length < ajosToProcess.length) {
      console.log(
        `⚠️  Limiting to ${ajosThisRun.length} Ajos this run (${ajosToProcess.length - ajosThisRun.length} remaining)`
      );
    }

    // Process each Ajo
    console.log(`\n🔄 Processing ${ajosThisRun.length} Ajo(s)...`);
    const results = [];

    for (const ajoId of ajosThisRun) {
      try {
        // Get contract addresses
        const ajoCoreAddress = await factory.ajoCore(ajoId);
        const ajoPaymentsAddress = await factory.ajoPayments(ajoId);

        // Connect to contracts
        const ajoCore = new ethers.Contract(
          ajoCoreAddress,
          AJO_CORE_ABI,
          provider
        );
        const ajoPayments = new ethers.Contract(
          ajoPaymentsAddress,
          AJO_PAYMENTS_ABI,
          provider
        );

        // Process defaults
        const result = await processAjoDefaults(
          ajoCore,
          ajoPayments,
          ajoId.toNumber(),
          signer
        );
        results.push(result);
      } catch (error) {
        console.error(`❌ Failed to process Ajo #${ajoId}:`, error.message);
        results.push({
          ajoId: ajoId.toNumber(),
          success: false,
          error: error.message,
          processed: 0,
        });
      }
    }

    // Calculate summary
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      ajosChecked: ajoIds.length,
      ajosProcessed: results.length,
      totalDefaultsProcessed: results.reduce(
        (sum, r) => sum + (r.processed || 0),
        0
      ),
      totalFailed: results.reduce((sum, r) => sum + (r.failed || 0), 0),
      results: results,
      relayerAddress: relayerAddress,
      dryRun: CONFIG.DRY_RUN,
    };

    console.log(`\n\n📈 EXECUTION SUMMARY`);
    console.log(`===================`);
    console.log(`✅ Ajos checked: ${summary.ajosChecked}`);
    console.log(`🔄 Ajos processed: ${summary.ajosProcessed}`);
    console.log(`✔️  Defaults handled: ${summary.totalDefaultsProcessed}`);
    console.log(`❌ Failed: ${summary.totalFailed}`);
    console.log(`⏱️  Execution time: ${summary.executionTimeMs}ms`);

    return summary;
  } catch (error) {
    console.error("❌ Fatal error in Autotask:", error);

    return {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
  }
};
