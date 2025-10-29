/**
 * Comprehensive Testing Strategy for Defender Automation
 *
 * Run with: npx hardhat run test-defender-automation.js --network hedera-testnet
 */

const hre = require("hardhat");
const { ethers } = hre;

// Test configuration
const TEST_CONFIG = {
  FACTORY_ADDRESS: "0xYOUR_FACTORY_ADDRESS",
  DEFENDER_RELAYER_ADDRESS: "0xYOUR_RELAYER_ADDRESS",
  TEST_AJO_ID: 1,

  // Test scenarios
  SCENARIOS: {
    NORMAL_DEFAULT: true, // Test single member default
    BATCH_DEFAULT: true, // Test multiple members default
    GRACE_PERIOD: true, // Test grace period enforcement
    ALREADY_PAID: true, // Test member who already paid
    SEVERE_DEFAULT: true, // Test 3+ cycles missed
    GAS_OPTIMIZATION: true, // Test batch size limits
  },
};

async function main() {
  console.log("\n🧪 DEFENDER AUTOMATION TEST SUITE");
  console.log("===================================\n");

  const [deployer, member1, member2, member3, member4, member5] =
    await ethers.getSigners();

  // ============ PHASE 1: SETUP ============
  console.log("📋 PHASE 1: Setup & Verification");
  console.log("---------------------------------");

  const factory = await ethers.getContractAt(
    "AjoFactory",
    TEST_CONFIG.FACTORY_ADDRESS
  );
  const ajoId = TEST_CONFIG.TEST_AJO_ID;

  // Get Ajo contracts
  const ajoCoreAddress = await factory.ajoCore(ajoId);
  const ajoPaymentsAddress = await factory.ajoPayments(ajoId);

  const ajoCore = await ethers.getContractAt("AjoCore", ajoCoreAddress);
  const ajoPayments = await ethers.getContractAt(
    "AjoPayments",
    ajoPaymentsAddress
  );

  console.log(`✅ Factory: ${factory.address}`);
  console.log(`✅ AjoCore: ${ajoCore.address}`);
  console.log(`✅ AjoPayments: ${ajoPayments.address}`);
  console.log(`✅ Test Ajo ID: ${ajoId}`);

  // ============ PHASE 2: AUTOMATION CONFIGURATION ============
  console.log("\n📋 PHASE 2: Configure Automation");
  console.log("---------------------------------");

  // Set Defender Relayer in Factory
  console.log("\n1️⃣ Setting Defender Relayer address...");
  const tx1 = await factory.setDefenderRelayer(
    TEST_CONFIG.DEFENDER_RELAYER_ADDRESS
  );
  await tx1.wait();
  console.log(`   ✅ Relayer set: ${TEST_CONFIG.DEFENDER_RELAYER_ADDRESS}`);

  // Enable automation for test Ajo
  console.log("\n2️⃣ Enabling automation for Ajo #${ajoId}...");
  const tx2 = await factory.enableAjoAutomation(ajoId);
  await tx2.wait();
  console.log(`   ✅ Automation enabled`);

  // Verify automation config
  console.log("\n3️⃣ Verifying automation configuration...");
  const [enabled, gracePeriod, authorized] =
    await ajoCore.getAutomationConfig();
  console.log(`   - Enabled: ${enabled}`);
  console.log(
    `   - Grace Period: ${gracePeriod} seconds (${gracePeriod / 3600} hours)`
  );

  // ============ PHASE 3: SCENARIO TESTING ============
  console.log("\n📋 PHASE 3: Scenario Testing");
  console.log("---------------------------------");

  let testsPassed = 0;
  let testsFailed = 0;

  // TEST 1: Normal Single Default
  if (TEST_CONFIG.SCENARIOS.NORMAL_DEFAULT) {
    console.log("\n🧪 TEST 1: Single Member Default");
    try {
      // Setup: Create a member who hasn't paid
      console.log("   Setting up test member...");

      // Join Ajo with member1
      await ajoCore.connect(member1).joinAjo(0); // PaymentToken.USDC

      // Advance time past deadline
      const currentCycle = await ajoPayments.getCurrentCycle();
      const deadline = await ajoPayments.getNextPaymentDeadline();

      console.log(`   Current cycle: ${currentCycle}`);
      console.log(`   Deadline: ${new Date(deadline * 1000).toISOString()}`);

      // Fast forward past deadline + grace period
      await ethers.provider.send("evm_increaseTime", [
        Number(gracePeriod) + 7200,
      ]);
      await ethers.provider.send("evm_mine", []);

      // Check if automation should run
      const [shouldRun, reason, count] = await ajoCore.shouldAutomationRun();
      console.log(
        `   Should run: ${shouldRun}, Reason: ${reason}, Count: ${count}`
      );

      if (!shouldRun) {
        throw new Error(`Automation check failed: ${reason}`);
      }

      // Get defaulters
      const defaulters = await ajoPayments.getMembersInDefault();
      console.log(`   Defaulters found: ${defaulters.length}`);
      console.log(`   Addresses: ${defaulters}`);

      // Process defaults (simulate Defender)
      console.log("   Processing defaults...");
      const tx = await ajoCore.batchHandleDefaultsAutomated([defaulters[0]]);
      const receipt = await tx.wait();

      console.log(`   ✅ Transaction confirmed: ${receipt.transactionHash}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

      testsPassed++;
      console.log("   ✅ TEST 1 PASSED");
    } catch (error) {
      console.error(`   ❌ TEST 1 FAILED: ${error.message}`);
      testsFailed++;
    }
  }

  // TEST 2: Batch Multiple Defaults
  if (TEST_CONFIG.SCENARIOS.BATCH_DEFAULT) {
    console.log("\n🧪 TEST 2: Batch Multiple Defaults");
    try {
      // Setup: Create multiple members who haven't paid
      console.log("   Setting up test members...");

      const members = [member2, member3, member4];
      for (const member of members) {
        await ajoCore.connect(member).joinAjo(0);
      }

      // Advance to next cycle
      await ethers.provider.send("evm_increaseTime", [
        30 * 24 * 3600 + Number(gracePeriod),
      ]);
      await ethers.provider.send("evm_mine", []);

      // Get all defaulters
      const defaulters = await ajoPayments.getMembersInDefault();
      console.log(`   Defaulters found: ${defaulters.length}`);

      // Process batch
      const tx = await ajoCore.batchHandleDefaultsAutomated(defaulters);
      const receipt = await tx.wait();

      // Check event
      const event = receipt.events?.find(
        (e) => e.event === "DefaultsHandledByAutomation"
      );
      const successCount = event.args.successCount.toNumber();
      const failureCount = event.args.failureCount.toNumber();

      console.log(
        `   Processed: ${successCount} success, ${failureCount} failed`
      );
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

      if (successCount === defaulters.length && failureCount === 0) {
        testsPassed++;
        console.log("   ✅ TEST 2 PASSED");
      } else {
        throw new Error(
          `Expected ${defaulters.length} successes, got ${successCount}`
        );
      }
    } catch (error) {
      console.error(`   ❌ TEST 2 FAILED: ${error.message}`);
      testsFailed++;
    }
  }

  // TEST 3: Grace Period Enforcement
  if (TEST_CONFIG.SCENARIOS.GRACE_PERIOD) {
    console.log("\n🧪 TEST 3: Grace Period Enforcement");
    try {
      // Setup: Create member who just missed deadline
      console.log("   Setting up test scenario...");

      await ajoCore.connect(member5).joinAjo(0);

      // Advance time past deadline but BEFORE grace period ends
      const deadline = await ajoPayments.getNextPaymentDeadline();
      await ethers.provider.send("evm_setNextBlockTimestamp", [
        Number(deadline) + 1800,
      ]); // 30 min after
      await ethers.provider.send("evm_mine", []);

      // Check if automation should run (should be false)
      const [shouldRun, reason] = await ajoCore.shouldAutomationRun();
      console.log(`   Should run: ${shouldRun}, Reason: ${reason}`);

      if (shouldRun) {
        throw new Error(
          "Automation ran during grace period - should not happen!"
        );
      }

      // Try to execute (should revert)
      const defaulters = await ajoPayments.getMembersInDefault();

      try {
        await ajoCore.batchHandleDefaultsAutomated(defaulters);
        throw new Error("Transaction should have reverted!");
      } catch (revertError) {
        if (revertError.message.includes("Grace period not elapsed")) {
          console.log(
            "   ✅ Correctly prevented execution during grace period"
          );
          testsPassed++;
          console.log("   ✅ TEST 3 PASSED");
        } else {
          throw revertError;
        }
      }
    } catch (error) {
      console.error(`   ❌ TEST 3 FAILED: ${error.message}`);
      testsFailed++;
    }
  }

  // TEST 4: Gas Limit Protection
  if (TEST_CONFIG.SCENARIOS.GAS_OPTIMIZATION) {
    console.log("\n🧪 TEST 4: Batch Size Limit Protection");
    try {
      // Try to process more than max batch size
      const largeBatch = Array(25).fill(member1.address);

      try {
        await ajoCore.batchHandleDefaultsAutomated(largeBatch);
        throw new Error("Should have rejected large batch");
      } catch (revertError) {
        if (revertError.message.includes("Batch size too large")) {
          console.log("   ✅ Correctly rejected batch size > 20");
          testsPassed++;
          console.log("   ✅ TEST 4 PASSED");
        } else {
          throw revertError;
        }
      }
    } catch (error) {
      console.error(`   ❌ TEST 4 FAILED: ${error.message}`);
      testsFailed++;
    }
  }

  // ============ PHASE 4: INTEGRATION TEST ============
  console.log("\n📋 PHASE 4: Full Integration Test");
  console.log("---------------------------------");

  console.log("\n🔄 Simulating full Defender execution...");

  // This simulates what the Autotask would do
  const ajosWithAutomation = await factory.getAjosWithAutomation();
  console.log(`   Ajos with automation: ${ajosWithAutomation.length}`);

  const statuses = await factory.checkAutomationStatus(ajosWithAutomation);

  for (const status of statuses) {
    console.log(`\n   Ajo #${status.ajoId}:`);
    console.log(`   - Enabled: ${status.enabled}`);
    console.log(`   - Should run: ${status.shouldRun}`);
    console.log(`   - Defaulters: ${status.defaultersCount}`);
    console.log(`   - Reason: ${status.reason}`);
  }

  // ============ FINAL SUMMARY ============
  console.log("\n\n📊 TEST SUMMARY");
  console.log("================");
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(
    `📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`
  );

  if (testsFailed === 0) {
    console.log("\n🎉 ALL TESTS PASSED! Ready for mainnet deployment.");
  } else {
    console.log("\n⚠️  Some tests failed. Review before mainnet deployment.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
