#!/usr/bin/env node
const { ethers } = require("hardhat");
const fs = require("fs");

// Import integrated utilities
const {
  showPreJoiningState,
  verifyJoiningResults,
  showPrePaymentState,
  verifyPaymentResults,
  showFactoryState,
  showGovernanceState,
  demonstrateJoiningWithVerification,
  demonstratePaymentCycleWithVerification,
} = require("./enhanced_demo_integrated.cjs");

// Import advanced view tests
const {
  runAdvancedDemo,
  demoFactoryViewFunctions,
  demoCoreViewFunctions,
  demoMemberViewFunctions,
  demoCollateralViewFunctions,
  demoPaymentViewFunctions,
  demoGovernanceViewFunctions,
  verifyAdvancedCollateralFeatures,
  verifyMemberIndexing,
  verifyPayoutHistory,
  verifyTokenConfiguration,
  verifyFactoryPagination,
  verifySeizableAssetsForAll,
} = require("./advanced_demo_features.cjs");

// Import governance HCS demo
const {
  runGovernanceDemo,
  testProposalCreation,
  testHcsVoteSubmission,
  testVoteTallying,
  testProposalStatus,
  testProposalExecution,
} = require("./governance_hcs_demo.cjs");

// Enhanced color utilities
const c = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  dim: (text) => `\x1b[2m${text}\x1b[0m`,
  bright: (text) => `\x1b[1m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`,
  underline: (text) => `\x1b[4m${text}\x1b[0m`,
  bgGreen: (text) => `\x1b[42m\x1b[30m${text}\x1b[0m`,
  bgBlue: (text) => `\x1b[44m\x1b[37m${text}\x1b[0m`,
  bgYellow: (text) => `\x1b[43m\x1b[30m${text}\x1b[0m`,
  bgRed: (text) => `\x1b[41m\x1b[37m${text}\x1b[0m`,
};

const DEMO_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  MONTHLY_PAYMENT_USDC: ethers.utils.parseUnits("5", 6), // $50 USDC
  MONTHLY_PAYMENT_HBAR: ethers.utils.parseUnits("10", 8), // 1000 HBAR
  CYCLE_DURATION: 30, // 30 seconds for testing (pass 0 to use default 30 days)
  TOTAL_PARTICIPANTS: 15,
  MIN_HBAR_FOR_HTS: ethers.utils.parseEther("50"),
  GAS_LIMIT: {
    DEPLOY_MASTER: 6000000,
    DEPLOY_GOVERNANCE: 6000000,
    DEPLOY_FACTORY: 15000000,
    CREATE_HTS: 5000000,
    CREATE_AJO: 1500000,
    INIT_PHASE_2: 1200000,
    INIT_PHASE_3: 1500000,
    INIT_PHASE_4: 1800000,
    INIT_PHASE_5: 1500000,
    JOIN_AJO: 1000000,
    HTS_ASSOCIATE: 300000,
    HTS_FUND: 800000,
    HTS_APPROVE: 400000,
    PROCESS_PAYMENT: 15000000,
    DISTRIBUTE_PAYOUT: 1200000,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const formatHBAR = (amount) => ethers.utils.formatUnits(amount, 8);

// ================================================================
// ENHANCED BANNER
// ================================================================
/**
 * Enhanced sleep with progress indicator
 */
async function sleepWithProgress(seconds, label = "Waiting") {
  const steps = 5;
  const interval = (seconds * 1000) / steps;

  for (let i = 1; i <= steps; i++) {
    await sleep(interval);
    const progress = "█".repeat(i) + "░".repeat(steps - i);
    process.stdout.write(
      `\r     ${label}: [${progress}] ${Math.round((i / steps) * 100)}%`
    );
  }
  console.log(); // New line after completion
}

/**
 * Enhanced retry with exponential backoff and network reset
 */
async function retryWithBackoff(operation, operationName, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        c.dim(`    ⏳ Attempt ${attempt}/${maxRetries}: ${operationName}`)
      );
      const result = await operation();
      console.log(c.green(`    ✅ ${operationName} succeeded`));
      return result;
    } catch (error) {
      const isNetworkError =
        error.message.includes("could not detect network") ||
        error.message.includes("other-side closed") ||
        error.message.includes("SocketError") ||
        error.message.includes("network") ||
        error.message.includes("timeout") ||
        error.message.includes("502") ||
        error.message.includes("NETWORK_ERROR");

      if (isNetworkError && attempt < maxRetries) {
        const backoffTime = DEMO_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(
          c.yellow(
            `    ⚠️ Network error on attempt ${attempt}: ${error.message.slice(
              0,
              100
            )}`
          )
        );
        console.log(
          c.dim(
            `    🔄 Retrying in ${
              backoffTime / 1000
            } seconds with exponential backoff...`
          )
        );

        // Try to recover provider connection
        try {
          await ethers.provider.getNetwork();
        } catch (e) {
          console.log(
            c.yellow(`    ⚠️ Provider reconnection failed, continuing...`)
          );
        }

        await sleep(backoffTime);
        continue;
      }

      console.log(
        c.red(`    ❌ ${operationName} failed: ${error.message.slice(0, 150)}`)
      );

      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}

function printEnhancedBanner() {
  console.log(c.magenta("\n" + "═".repeat(88)));
  console.log(
    c.bold(
      c.cyan(
        "╔══════════════════════════════════════════════════════════════════════════════════════╗"
      )
    )
  );
  console.log(
    c.bold(
      c.cyan(
        "║                                                                                      ║"
      )
    )
  );
  console.log(
    c.bold(
      c.cyan("║") +
        c.bgBlue(
          "              🏦 AJO.SAVE - FULL HEDERA INTEGRATION DEMO 🏦                          "
        ) +
        c.cyan("║")
    )
  );
  console.log(
    c.bold(
      c.cyan(
        "║                                                                                      ║"
      )
    )
  );
  console.log(
    c.bold(
      c.cyan(
        "╚══════════════════════════════════════════════════════════════════════════════════════╝"
      )
    )
  );
  console.log(c.magenta("═".repeat(88)));

  console.log(
    c.bright("\n" + " ".repeat(15) + "HTS + HCS + HSS - Complete 10-Cycle Demo")
  );
  console.log(
    c.dim(
      " ".repeat(12) +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )
  );

  console.log(c.yellow("\n  🌟 HEDERA SERVICES INTEGRATION:"));
  console.log(
    c.green("     ✓ HTS Auto-Association") +
      c.dim(" - Seamless token distribution")
  );
  console.log(
    c.green("     ✓ HCS Governance") +
      c.dim(" - Off-chain voting, on-chain tally")
  );
  console.log(
    c.green("     ✓ HSS Scheduling") + c.dim(" - Automated payment execution")
  );
  console.log(
    c.green("     ✓ Factory Treasury") +
      c.dim(" - Centralized token management")
  );
  console.log(
    c.green("     ✓ Full ROSCA Cycle") +
      c.dim(" - Payment → Payout → Next Cycle")
  );
  console.log(
    c.green("     ✓ Native Hedera") + c.dim(" - 90%+ cost reduction\n")
  );

  console.log(
    c.bgYellow(" ⚡ DEMO CONFIG: 30 SECOND CYCLES - FULL 10 CYCLES ")
  );
  console.log(c.yellow("  This demo will run through all 10 payment cycles\n"));
}

// ================================================================
// RETRY OPERATION
// ================================================================

async function retryOperation(
  operation,
  operationName,
  maxRetries = DEMO_CONFIG.MAX_RETRIES
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        c.dim(`    ⏳ Attempt ${attempt}/${maxRetries}: ${operationName}`)
      );
      const result = await operation();
      console.log(c.green(`    ✅ ${operationName} succeeded`));
      return result;
    } catch (error) {
      const isNetworkError =
        error.message.includes("other-side closed") ||
        error.message.includes("SocketError") ||
        error.message.includes("network") ||
        error.message.includes("timeout");

      if (isNetworkError && attempt < maxRetries) {
        console.log(
          c.yellow(
            `    ⚠️ Network error on attempt ${attempt}: ${error.message.slice(
              0,
              100
            )}`
          )
        );
        console.log(
          c.dim(
            `    🔄 Retrying in ${DEMO_CONFIG.RETRY_DELAY / 1000} seconds...`
          )
        );
        await sleep(DEMO_CONFIG.RETRY_DELAY * attempt);
        continue;
      }

      console.log(
        c.red(`    ❌ ${operationName} failed: ${error.message.slice(0, 150)}`)
      );
      throw error;
    }
  }
}

// ================================================================
// PHASE 1: HTS-ONLY DEPLOYMENT
// ================================================================

async function deployHtsSystem() {
  console.log(
    c.bgBlue(
      "\n" + " ".repeat(30) + "PHASE 1: HTS SYSTEM DEPLOYMENT" + " ".repeat(28)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  const [deployer] = await ethers.getSigners();
  console.log(c.bright(`  👤 Deployer: ${deployer.address}`));
  const balance = await deployer.getBalance();
  console.log(
    c.dim(`     Balance: ${ethers.utils.formatEther(balance)} HBAR\n`)
  );

  if (balance.lt(DEMO_CONFIG.MIN_HBAR_FOR_HTS)) {
    throw new Error(
      `Insufficient HBAR! Need ${ethers.utils.formatEther(
        DEMO_CONFIG.MIN_HBAR_FOR_HTS
      )} HBAR, ` + `have ${ethers.utils.formatEther(balance)} HBAR`
    );
  }

  console.log(c.green(`  ✅ Sufficient HBAR for HTS token creation\n`));

  console.log(
    c.cyan("  📝 Step 1.1: Deploying Master Implementation Contracts...\n")
  );

  const masterContracts = {};
  const contracts = [
    {
      name: "AjoCore",
      key: "ajoCore",
      desc: "Main orchestration & coordination",
      icon: "🎯",
    },
    {
      name: "AjoMembers",
      key: "ajoMembers",
      desc: "Member management & queue system",
      icon: "👥",
    },
    {
      name: "AjoCollateral",
      key: "ajoCollateral",
      desc: "Dynamic collateral calculations",
      icon: "🔒",
    },
    {
      name: "AjoPayments",
      key: "ajoPayments",
      desc: "Payment processing & distribution",
      icon: "💳",
    },
    {
      name: "AjoGovernance",
      key: "ajoGovernance",
      desc: "On-chain governance with HCS",
      icon: "🗳️",
    },
    {
      name: "AjoSchedule",
      key: "ajoSchedule",
      desc: "HSS automated scheduling",
      icon: "📅",
    },
  ];

  for (const contract of contracts) {
    await retryOperation(async () => {
      console.log(
        c.cyan(`      ${contract.icon} Deploying ${contract.name}...`)
      );
      console.log(c.dim(`         ${contract.desc}`));

      const ContractFactory = await ethers.getContractFactory(contract.name);
      const gasLimit =
        contract.name === "AjoGovernance"
          ? DEMO_CONFIG.GAS_LIMIT.DEPLOY_GOVERNANCE
          : DEMO_CONFIG.GAS_LIMIT.DEPLOY_MASTER;

      masterContracts[contract.key] = await ContractFactory.deploy({
        gasLimit,
      });
      await masterContracts[contract.key].deployed();

      console.log(
        c.green(
          `      ✅ ${contract.name}: ${
            masterContracts[contract.key].address
          }\n`
        )
      );
      return masterContracts[contract.key];
    }, `Deploy ${contract.name} Master`);

    await sleep(1500);
  }

  console.log(c.cyan("  📝 Step 1.2: Deploying AjoFactory...\n"));

  const HEDERA_TOKEN_SERVICE = "0x0000000000000000000000000000000000000167";
  const HEDERA_SCHEDULE_SERVICE = "0x000000000000000000000000000000000000016b";
  const DUMMY_TOKEN = "0x0000000000000000000000000000000000000001";

  console.log(c.dim(`      🔗 HTS Address: ${HEDERA_TOKEN_SERVICE}`));
  console.log(c.dim(`      🔗 HSS Address: ${HEDERA_SCHEDULE_SERVICE}\n`));

  let ajoFactory;
  await retryOperation(async () => {
    const AjoFactory = await ethers.getContractFactory("AjoFactory");
    ajoFactory = await AjoFactory.deploy(
      DUMMY_TOKEN,
      DUMMY_TOKEN,
      masterContracts.ajoCore.address,
      masterContracts.ajoMembers.address,
      masterContracts.ajoCollateral.address,
      masterContracts.ajoPayments.address,
      masterContracts.ajoGovernance.address,
      masterContracts.ajoSchedule.address,
      HEDERA_TOKEN_SERVICE,
      HEDERA_SCHEDULE_SERVICE,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.DEPLOY_FACTORY }
    );
    await ajoFactory.deployed();
    console.log(c.green(`      ✅ AjoFactory: ${ajoFactory.address}\n`));
    return ajoFactory;
  }, "Deploy AjoFactory");

  await sleep(2000);

  console.log(
    c.cyan("  📝 Step 1.3: Creating HTS Tokens with Auto-Association...\n")
  );
  console.log(
    c.yellow("     ⚠️  This will cost 40 HBAR (20 HBAR per token)\n")
  );

  let usdcHtsToken, hbarHtsToken;

  await retryOperation(async () => {
    const tx = await ajoFactory.createHtsTokens({
      value: ethers.utils.parseEther("40"),
      gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_HTS,
    });
    const receipt = await tx.wait();

    console.log(c.dim(`     Transaction hash: ${receipt.transactionHash}`));
    console.log(c.dim(`     Gas used: ${receipt.gasUsed.toString()}\n`));

    const autoAssocEvent = receipt.events?.find(
      (e) => e.event === "HtsTokensCreatedWithAutoAssociation"
    );

    if (autoAssocEvent) {
      usdcHtsToken = autoAssocEvent.args[0];
      hbarHtsToken = autoAssocEvent.args[1];

      console.log(c.green(`     ✅ HTS Tokens Created with Auto-Association!`));
      console.log(c.bright(`     📍 USDC Token: ${usdcHtsToken}`));
      console.log(c.bright(`     📍 WHBAR Token: ${hbarHtsToken}\n`));
    } else {
      throw new Error("HtsTokensCreatedWithAutoAssociation event not found");
    }

    return { usdcHtsToken, hbarHtsToken };
  }, "Create HTS Tokens");

  await sleep(2000);

  console.log(c.cyan("  📝 Step 1.4: Verifying Factory Token Balances...\n"));

  const usdcContract = new ethers.Contract(
    usdcHtsToken,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider
  );

  const hbarContract = new ethers.Contract(
    hbarHtsToken,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider
  );

  const factoryUsdcBalance = await usdcContract.balanceOf(ajoFactory.address);
  const factoryHbarBalance = await hbarContract.balanceOf(ajoFactory.address);

  console.log(
    c.green(`     ✅ Factory USDC Balance: ${formatUSDC(factoryUsdcBalance)}`)
  );
  console.log(
    c.green(
      `     ✅ Factory WHBAR Balance: ${formatHBAR(factoryHbarBalance)}\n`
    )
  );

  if (factoryUsdcBalance.eq(0) || factoryHbarBalance.eq(0)) {
    throw new Error(
      "Factory has zero token balance! HTS token creation failed."
    );
  }

  console.log(c.green("  ✅ HTS System Deployment Complete!\n"));
  console.log(c.blue("═".repeat(88) + "\n"));

  return {
    ajoFactory,
    deployer,
    masterContracts,
    usdcHtsToken,
    hbarHtsToken,
  };
}

// ================================================================
// PHASE 2: 5-PHASE AJO CREATION WITH CONFIGURABLE PARAMETERS
// ================================================================

async function createHtsAjo(ajoFactory, deployer, hederaClient, options = {}) {
  console.log(
    c.bgBlue(
      "\n" + " ".repeat(28) + "PHASE 2: HTS AJO CREATION" + " ".repeat(33)
    )
  );
  console.log(c.blue("═".repeat(88)));

  const {
    name = `HTS Ajo ${Date.now()}`,
    useScheduledPayments = true,
    cycleDuration = DEMO_CONFIG.CYCLE_DURATION, // 30 seconds for testing
    monthlyPaymentUSDC = DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
    monthlyPaymentHBAR = DEMO_CONFIG.MONTHLY_PAYMENT_HBAR,
  } = options;

  console.log(c.bright("\n  📋 Configuration:"));
  console.log(
    c.dim("     ┌──────────────────────────────────────────────────────────┐")
  );
  console.log(c.dim(`     │ Name: ${name.padEnd(51)} │`));
  console.log(
    c.dim(
      `     │ Cycle Duration: ${cycleDuration.toString().padEnd(42)} seconds │`
    )
  );
  console.log(
    c.dim(`     │ Monthly USDC: ${formatUSDC(monthlyPaymentUSDC).padEnd(44)} │`)
  );
  console.log(
    c.dim(`     │ Monthly HBAR: ${formatHBAR(monthlyPaymentHBAR).padEnd(44)} │`)
  );
  console.log(
    c.dim(
      `     │ HTS Tokens: ${c
        .green("✅ Required (No ERC20 Fallback)")
        .padEnd(60)} │`
    )
  );
  console.log(
    c.dim(`     │ Auto-Association: ${c.green("✅ Active").padEnd(56)} │`)
  );
  console.log(
    c.dim(
      `     │ HSS Scheduling: ${(useScheduledPayments
        ? c.green("✅ Enabled")
        : c.yellow("❌ Manual")
      ).padEnd(56)} │`
    )
  );
  console.log(
    c.dim(`     │ HCS Governance: ${c.green("✅ Always Enabled").padEnd(56)} │`)
  );
  console.log(
    c.dim("     └──────────────────────────────────────────────────────────┘\n")
  );

  let ajoId, hcsTopicInfo;

  console.log(c.cyan("  📋 PHASE 1/5: Creating Ajo Core..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).createAjo(
      name,
      true, // useHtsTokens
      useScheduledPayments,
      cycleDuration, // NEW: cycle duration in seconds
      monthlyPaymentUSDC, // NEW: USDC payment amount
      monthlyPaymentHBAR, // NEW: HBAR payment amount
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO }
    );
    const receipt = await tx.wait();

    const event = receipt.events?.find((e) => e.event === "AjoCreated");
    ajoId = event?.args?.ajoId?.toNumber();

    console.log(c.green(`     ✅ Ajo Core Created`));
    console.log(c.dim(`        ID: ${ajoId}`));
    console.log(c.dim(`        Cycle Duration: ${cycleDuration}s`));
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");

  await sleep(2000);

  // Create real HCS topic BEFORE Phase 2
  console.log(
    c.bgYellow(
      "\n" +
        " ".repeat(20) +
        "🌐 FRONTEND SIMULATION: CREATE HCS TOPIC" +
        " ".repeat(26)
    )
  );
  hcsTopicInfo = await createRealHcsTopic(hederaClient, name);

  await sleep(2000);

  console.log(
    c.cyan("  📋 PHASE 2/5: Initialize Members + Governance + HCS...")
  );
  console.log(
    c.yellow(`     → Passing HCS Topic ID: ${hcsTopicInfo.topicId}\n`)
  );

  await retryOperation(async () => {
    const tx = await ajoFactory
      .connect(deployer)
      .initializeAjoPhase2(ajoId, hcsTopicInfo.bytes32TopicId, {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2,
      });
    const receipt = await tx.wait();

    const hcsEvent = receipt.events?.find(
      (e) => e.event === "AjoInitializedPhase2"
    );
    const returnedTopicId = hcsEvent?.args?.hcsTopicId;

    console.log(c.green(`     ✅ Phase 2 Complete`));
    console.log(c.dim(`        HCS Topic (stored): ${returnedTopicId}`));
    console.log(c.dim(`        HCS Topic (Hedera): ${hcsTopicInfo.topicId}\n`));

    return tx;
  }, "Initialize Ajo Phase 2");

  await sleep(2000);

  console.log(c.cyan("  📋 PHASE 3/5: Initialize Collateral + Payments..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase3(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_3,
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 3 Complete\n`));
    return tx;
  }, "Initialize Ajo Phase 3");

  await sleep(2000);

  console.log(
    c.cyan("  📋 PHASE 4/5: Initialize Core + Cross-link + Token Config...")
  );
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4,
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 4 Complete`));
    console.log(c.dim(`        Cycle duration set to: ${cycleDuration}s\n`));
    return tx;
  }, "Initialize Ajo Phase 4");

  await sleep(2000);

  if (useScheduledPayments) {
    console.log(
      c.cyan("  📋 PHASE 5/5: Initialize Schedule Contract (HSS)...")
    );
    await retryOperation(async () => {
      const tx = await ajoFactory.connect(deployer).initializeAjoPhase5(ajoId, {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_5,
      });
      await tx.wait();
      console.log(c.green(`     ✅ Phase 5 Complete\n`));
      return tx;
    }, "Initialize Ajo Phase 5");
  }

  const ajoInfo = await ajoFactory.getAjo(ajoId);

  // Verify cycle duration was set correctly
  const ajoCoreContract = await ethers.getContractAt(
    "AjoCore",
    ajoInfo.ajoCore
  );
  const actualCycleDuration = await ajoCoreContract.getCycleDuration();

  console.log(c.blue("═".repeat(88)));
  console.log(c.green(`\n  ✅ HTS Ajo "${name}" Successfully Created!\n`));
  console.log(c.dim("  📍 Deployed Contracts:"));
  console.log(
    c.dim(
      "     ┌──────────────────────────────────────────────────────────────────┐"
    )
  );
  console.log(c.dim(`     │ Core:        ${ajoInfo.ajoCore.padEnd(42)} │`));
  console.log(c.dim(`     │ Members:     ${ajoInfo.ajoMembers.padEnd(42)} │`));
  console.log(
    c.dim(`     │ Collateral:  ${ajoInfo.ajoCollateral.padEnd(42)} │`)
  );
  console.log(c.dim(`     │ Payments:    ${ajoInfo.ajoPayments.padEnd(42)} │`));
  console.log(
    c.dim(`     │ Governance:  ${ajoInfo.ajoGovernance.padEnd(42)} │`)
  );
  if (useScheduledPayments) {
    console.log(
      c.dim(`     │ Schedule:    ${ajoInfo.ajoSchedule.padEnd(42)} │`)
    );
  }
  console.log(
    c.dim(
      "     └──────────────────────────────────────────────────────────────────┘"
    )
  );

  console.log(c.dim("\n  ⚙️  Configuration:"));
  console.log(
    c.dim(
      "     ┌──────────────────────────────────────────────────────────────────┐"
    )
  );
  console.log(
    c.dim(
      `     │ Cycle Duration: ${actualCycleDuration
        .toString()
        .padEnd(48)} seconds │`
    )
  );
  console.log(
    c.dim(
      `     │ Monthly USDC:   ${formatUSDC(monthlyPaymentUSDC).padEnd(48)} │`
    )
  );
  console.log(
    c.dim(
      `     │ Monthly HBAR:   ${formatHBAR(monthlyPaymentHBAR).padEnd(48)} │`
    )
  );
  console.log(
    c.dim(
      "     └──────────────────────────────────────────────────────────────────┘"
    )
  );

  console.log(c.dim("\n  🌐 HCS Integration:"));
  console.log(
    c.dim(
      "     ┌──────────────────────────────────────────────────────────────────┐"
    )
  );
  console.log(
    c.dim(`     │ Topic ID (Hedera): ${hcsTopicInfo.topicId.padEnd(41)} │`)
  );
  console.log(
    c.dim(
      `     │ Topic ID (bytes32): ${hcsTopicInfo.bytes32TopicId
        .slice(0, 40)
        .padEnd(40)} │`
    )
  );
  console.log(
    c.dim(
      `     │ Simulated:         ${(hcsTopicInfo.simulated
        ? "Yes"
        : "No"
      ).padEnd(41)} │`
    )
  );
  console.log(
    c.dim(
      "     └──────────────────────────────────────────────────────────────────┘\n"
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  return {
    ajoId,
    ajoInfo,
    hcsTopicId: hcsTopicInfo.topicId,
    hcsTopicIdBytes32: hcsTopicInfo.bytes32TopicId,
    hcsTopicSimulated: hcsTopicInfo.simulated,
    cycleDuration: actualCycleDuration.toNumber(),
  };
}

// ================================================================
// PHASE 3: HTS PARTICIPANT SETUP
// ================================================================

async function setupHtsParticipants(ajoFactory, ajoId) {
  console.log(
    c.bgBlue(
      "\n" +
        " ".repeat(24) +
        "PHASE 3: HTS PARTICIPANT ONBOARDING" +
        " ".repeat(25)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  const [deployer, ...signers] = await ethers.getSigners();

  const ajoInfo = await ajoFactory.getAjo(ajoId);
  const ajo = await ethers.getContractAt("AjoCore", ajoInfo.ajoCore);
  const ajoMembers = await ethers.getContractAt(
    "AjoMembers",
    ajoInfo.ajoMembers
  );
  const ajoCollateral = await ethers.getContractAt(
    "AjoCollateral",
    ajoInfo.ajoCollateral
  );
  const ajoPayments = await ethers.getContractAt(
    "AjoPayments",
    ajoInfo.ajoPayments
  );

  const participantNames = [
    "Adunni",
    "Babatunde",
    "Chinwe",
    "Damilola",
    "Emeka",
    "Funmilayo",
    "Gbenga",
    "Halima",
    "Ifeanyi",
    "Joke",
  ];

  const participants = [];
  const actualCount = Math.min(DEMO_CONFIG.TOTAL_PARTICIPANTS, signers.length);

  console.log(c.cyan(`  👥 Setting up ${actualCount} HTS participants...\n`));
  console.log(
    c.yellow(
      "     ℹ️  Auto-association ENABLED - tokens transfer automatically\n"
    )
  );

  const usdcContract = new ethers.Contract(
    ajoInfo.usdcToken,
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
    ],
    ethers.provider
  );

  const factoryBalance = await usdcContract.balanceOf(ajoFactory.address);
  console.log(
    c.bright(`     💰 Factory USDC Balance: ${formatUSDC(factoryBalance)}\n`)
  );

  if (factoryBalance.eq(0)) {
    throw new Error("Factory has no tokens to distribute!");
  }

  console.log(c.cyan("  🔗 Processing Users Individually...\n"));
  console.log(
    c.dim("  ┌────┬─────────────┬──────────────┬─────────────┬─────────────┐")
  );
  console.log(
    c.dim("  │ #  │ Name        │ Address      │ USDC Bal    │ Status      │")
  );
  console.log(
    c.dim("  ├────┼─────────────┼──────────────┼─────────────┼─────────────┤")
  );

  for (let i = 0; i < actualCount; i++) {
    const participant = {
      signer: signers[i],
      name: participantNames[i],
      address: signers[i].address,
      position: i + 1,
    };

    try {
      console.log(
        c.dim(
          `     → ${participant.name}: Funding with tokens via auto-association...`
        )
      );

      const usdcAmount = 1000 * 10 ** 6;
      const hbarAmount = 1000 * 10 ** 8;

      await retryOperation(async () => {
        const tx = await ajoFactory
          .connect(deployer)
          .fundUserWithHtsTokens(participant.address, usdcAmount, hbarAmount, {
            gasLimit: 1500000,
          });

        const receipt = await tx.wait();

        const fundEvent = receipt.events?.find(
          (e) => e.event === "UserHtsFunded"
        );
        if (!fundEvent) {
          throw new Error("Funding event not found");
        }

        const usdcResponse = fundEvent.args.usdcResponse.toNumber();
        const hbarResponse = fundEvent.args.hbarResponse.toNumber();

        const usdcSuccess = usdcResponse === 22;
        const hbarSuccess = hbarResponse === 22;

        if (!usdcSuccess && !hbarSuccess) {
          throw new Error(
            `Both token transfers failed (USDC: ${usdcResponse}, HBAR: ${hbarResponse})`
          );
        }

        console.log(
          c.dim(
            `        ✓ Funded: ${formatUSDC(
              ethers.BigNumber.from(usdcAmount)
            )} USDC, ${formatHBAR(ethers.BigNumber.from(hbarAmount))} WHBAR`
          )
        );

        return tx;
      }, `${participant.name} - Fund HTS`);

      await sleep(500);

      const balance = await usdcContract.balanceOf(participant.address);

      if (balance.eq(0)) {
        throw new Error("Zero balance after funding");
      }

      console.log(
        c.dim(
          `     → ${participant.name}: Balance verified: ${formatUSDC(
            balance
          )} USDC`
        )
      );

      const approvalAmount = balance.div(2);

      console.log(
        c.dim(
          `     → ${participant.name}: Approving ${formatUSDC(
            approvalAmount
          )} for contracts...`
        )
      );

      const htsToken = new ethers.Contract(
        ajoInfo.usdcToken,
        [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)",
        ],
        participant.signer
      );

      await retryOperation(async () => {
        const tx = await htsToken.approve(
          ajoCollateral.address,
          approvalAmount,
          { gasLimit: 800000 }
        );
        await tx.wait();

        console.log(c.dim(`        ✓ Collateral approved`));
        return tx;
      }, `${participant.name} - Approve Collateral`);

      await sleep(500);

      await retryOperation(async () => {
        const tx = await htsToken.approve(ajoPayments.address, approvalAmount, {
          gasLimit: 800000,
        });
        await tx.wait();

        console.log(c.dim(`        ✓ Payments approved`));
        return tx;
      }, `${participant.name} - Approve Payments`);

      const status = c.green("✅ Ready");
      console.log(
        c.dim(
          `  │ ${(i + 1).toString().padStart(2)} │ ${participant.name.padEnd(
            11
          )} │ ${participant.address.slice(0, 10)}... │ ${formatUSDC(
            balance
          ).padEnd(11)} │ ${status.padEnd(19)} │`
        )
      );

      participants.push(participant);
    } catch (error) {
      const status = c.red("❌ Failed");
      console.log(
        c.dim(
          `  │ ${(i + 1).toString().padStart(2)} │ ${participant.name.padEnd(
            11
          )} │ ${participant.address.slice(0, 10)}... │ ${"N/A".padEnd(
            11
          )} │ ${status.padEnd(19)} │`
        )
      );
      console.log(c.red(`     Error: ${error.message.slice(0, 100)}`));
    }

    await sleep(1000);
  }

  console.log(
    c.dim("  └────┴─────────────┴──────────────┴─────────────┴─────────────┘\n")
  );
  console.log(
    c.green(
      `  ✅ ${participants.length}/${actualCount} HTS participants ready!\n`
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  return { ajo, ajoMembers, ajoCollateral, ajoPayments, participants, ajoInfo };
}

// ================================================================
// PHASE 4: MEMBER JOINING
// ================================================================

async function demonstrateMemberJoining(
  ajo,
  ajoCollateral,
  ajoMembers,
  participants,
  ajoInfo
) {
  console.log(
    c.bgBlue(
      "\n" +
        " ".repeat(22) +
        "PHASE 4: MEMBER JOINING & COLLATERAL SYSTEM" +
        " ".repeat(22)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  const joinResults = [];

  console.log(
    c.dim(
      "     ┌────┬─────────────┬──────────────┬─────────────────┬──────────────┐"
    )
  );
  console.log(
    c.dim(
      "     │ #  │ Name        │ Position     │ Collateral Req. │ Status       │"
    )
  );
  console.log(
    c.dim(
      "     ├────┼─────────────┼──────────────┼─────────────────┼──────────────┤"
    )
  );

  for (let i = 0; i < participants.length; i++) {
    const participant = participants[i];

    try {
      const joinTx = await ajo.connect(participant.signer).joinAjo(0, {
        gasLimit: DEMO_CONFIG.GAS_LIMIT.JOIN_AJO,
      });
      const receipt = await joinTx.wait();

      const memberInfo = await ajo.getMemberInfo(participant.address);
      const actualCollateral = memberInfo.memberInfo.lockedCollateral;

      joinResults.push({
        name: participant.name,
        position: participant.position,
        actualCollateral,
        gasUsed: receipt.gasUsed,
        success: true,
      });

      const status = c.green("✅ Joined");
      console.log(
        c.dim(
          `     │ ${(i + 1).toString().padStart(2)} │ ${participant.name.padEnd(
            11
          )} │ ${participant.position.toString().padEnd(12)} │ ${formatUSDC(
            actualCollateral
          ).padEnd(15)} │ ${status.padEnd(20)} │`
        )
      );
    } catch (error) {
      let errorMsg = error.reason || error.message;
      if (error.error && error.error.message) {
        errorMsg = error.error.message;
      }

      joinResults.push({
        name: participant.name,
        position: participant.position,
        error: errorMsg,
        success: false,
      });

      const status = c.red("❌ Failed");
      console.log(
        c.dim(
          `     │ ${(i + 1).toString().padStart(2)} │ ${participant.name.padEnd(
            11
          )} │ ${participant.position.toString().padEnd(12)} │ ${"N/A".padEnd(
            15
          )} │ ${status.padEnd(20)} │`
        )
      );
      console.log(c.red(`     ⚠️ ${errorMsg.slice(0, 100)}`));
    }

    await sleep(1500);
  }

  console.log(
    c.dim(
      "     └────┴─────────────┴──────────────┴─────────────────┴──────────────┘\n"
    )
  );

  const successCount = joinResults.filter((r) => r.success).length;
  console.log(
    c.green(
      `  ✅ ${successCount}/${participants.length} members successfully joined!\n`
    )
  );

  console.log(c.blue("═".repeat(88) + "\n"));

  return joinResults;
}

// ================================================================
// PHASE 5: FULL 10-CYCLE DEMONSTRATION WITH PAYMENT STATUS
// ================================================================

async function demonstrateFullCycles(
  ajo,
  ajoPayments,
  participants,
  cycleDuration
) {
  console.log(
    c.bgBlue(
      "\n" +
        " ".repeat(20) +
        "PHASE 5: FULL 10-CYCLE PAYMENT & PAYOUT DEMONSTRATION" +
        " ".repeat(18)
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  console.log(c.bright(`  ⏱️  Cycle Duration: ${cycleDuration} seconds\n`));
  console.log(c.yellow("  📊 Running through all 10 cycles...\n"));

  const cycleResults = [];
  const TOTAL_CYCLES = 10;

  for (let cycle = 1; cycle <= TOTAL_CYCLES; cycle++) {
    console.log(
      c.bgYellow(`\n${"═".repeat(35)} CYCLE ${cycle}/10 ${"═".repeat(35)}`)
    );
    console.log(c.bright(`\n  📅 Cycle ${cycle} Started\n`));

    const cycleData = {
      cycle,
      payments: [],
      payout: null,
      startTime: Date.now(),
    };

    // Get current cycle from contract with retry
    let currentCycle, nextRecipient;
    try {
      currentCycle = await retryWithBackoff(
        async () => await ajoPayments.getCurrentCycle(),
        "Get Current Cycle"
      );
      console.log(c.dim(`     Contract Cycle: ${currentCycle.toString()}`));

      nextRecipient = await retryWithBackoff(
        async () => await ajoPayments.getNextRecipient(),
        "Get Next Recipient"
      );
      console.log(c.bright(`     💰 Next Recipient: ${nextRecipient}\n`));
    } catch (error) {
      console.log(c.red(`\n  ❌ Failed to get cycle info: ${error.message}`));
      console.log(c.yellow(`  ⏩ Skipping to next cycle...\n`));
      continue;
    }

    // Find recipient name
    const recipientParticipant = participants.find(
      (p) => p.address.toLowerCase() === nextRecipient.toLowerCase()
    );
    const recipientName = recipientParticipant
      ? recipientParticipant.name
      : "Unknown";

    if (nextRecipient === "0x0000000000000000000000000000000000000000") {
      console.log(
        c.red(
          `\n  ⚠️ WARNING: Next recipient is address(0) - getNextRecipient() issue!`
        )
      );
      console.log(
        c.yellow(
          `  This indicates a contract logic problem that needs fixing.\n`
        )
      );
    }

    console.log(c.cyan(`  💳 Step 1: Process Payments for Cycle ${cycle}\n`));
    console.log(
      c.dim("     ┌────┬─────────────┬──────────────┬──────────────┐")
    );
    console.log(
      c.dim("     │ #  │ Member      │ Amount       │ Status       │")
    );
    console.log(
      c.dim("     ├────┼─────────────┼──────────────┼──────────────┤")
    );

    // All members make payments with retry
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i];

      try {
        // Call AjoCore.processPayment() with NO parameters
        await retryWithBackoff(async () => {
          const tx = await ajo.connect(participant.signer).processPayment({
            gasLimit: DEMO_CONFIG.GAS_LIMIT.PROCESS_PAYMENT,
          });

          return await tx.wait();
        }, `${participant.name} - Payment`);

        cycleData.payments.push({
          member: participant.name,
          amount: DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
          success: true,
        });

        const status = c.green("✅ Paid");
        console.log(
          c.dim(
            `     │ ${(i + 1)
              .toString()
              .padStart(2)} │ ${participant.name.padEnd(11)} │ ${formatUSDC(
              DEMO_CONFIG.MONTHLY_PAYMENT_USDC
            ).padEnd(12)} │ ${status.padEnd(20)} │`
          )
        );
      } catch (error) {
        cycleData.payments.push({
          member: participant.name,
          error: error.message,
          success: false,
        });

        const status = c.red("❌ Failed");
        console.log(
          c.dim(
            `     │ ${(i + 1)
              .toString()
              .padStart(2)} │ ${participant.name.padEnd(11)} │ ${"N/A".padEnd(
              12
            )} │ ${status.padEnd(20)} │`
          )
        );
        console.log(c.red(`        Error: ${error.message.slice(0, 150)}`));
      }

      await sleep(2000);
    }

    console.log(
      c.dim("     └────┴─────────────┴──────────────┴──────────────┘\n")
    );

    const successfulPayments = cycleData.payments.filter(
      (p) => p.success
    ).length;
    console.log(
      c.green(
        `     ✅ ${successfulPayments}/${participants.length} payments processed\n`
      )
    );

    await sleep(2000);

    // ============ NEW: GET CYCLE PAYMENT STATUS ============
    console.log(c.cyan(`  📊 Step 1.5: Verify Cycle Payment Status\n`));

    try {
      const paymentStatus = await retryWithBackoff(
        async () => await ajoPayments.getCyclePaymentStatus(currentCycle),
        "Get Cycle Payment Status"
      );

      const [paidMembers, unpaidMembers, totalCollected] = paymentStatus;

      console.log(c.bright(`     Payment Status for Cycle ${currentCycle}:\n`));
      console.log(c.dim(`     Total Collected: ${formatUSDC(totalCollected)}`));
      console.log(
        c.dim(
          `     Members Paid: ${paidMembers.length}/${participants.length}\n`
        )
      );

      // Display paid members
      if (paidMembers.length > 0) {
        console.log(c.green(`     ✅ Paid Members (${paidMembers.length}):`));
        for (const memberAddr of paidMembers) {
          const memberName =
            participants.find(
              (p) => p.address.toLowerCase() === memberAddr.toLowerCase()
            )?.name || "Unknown";
          console.log(
            c.dim(`        • ${memberName} (${memberAddr.slice(0, 8)}...)`)
          );
        }
        console.log();
      }

      // Display unpaid members (if any)
      if (unpaidMembers.length > 0) {
        console.log(c.red(`     ❌ Unpaid Members (${unpaidMembers.length}):`));
        for (const memberAddr of unpaidMembers) {
          const memberName =
            participants.find(
              (p) => p.address.toLowerCase() === memberAddr.toLowerCase()
            )?.name || "Unknown";
          console.log(
            c.dim(`        • ${memberName} (${memberAddr.slice(0, 8)}...)`)
          );
        }
        console.log();
      } else {
        console.log(c.green(`     🎉 All members have paid!\n`));
      }

      // Store payment status in cycle data
      cycleData.paymentStatus = {
        paidCount: paidMembers.length,
        unpaidCount: unpaidMembers.length,
        totalCollected: totalCollected.toString(),
        allPaid: unpaidMembers.length === 0,
      };
    } catch (error) {
      console.log(
        c.red(`     ❌ Failed to get payment status: ${error.message}\n`)
      );
      cycleData.paymentStatus = {
        error: error.message,
      };
    }

    await sleep(2000);

    // ============ DISTRIBUTE PAYOUT ============
    console.log(c.cyan(`  💰 Step 2: Distribute Payout to ${recipientName}\n`));

    try {
      const isReady = await retryWithBackoff(
        async () => await ajoPayments.isPayoutReady(),
        "Check Payout Ready"
      );
      console.log(
        c.dim(
          `     Payout Ready: ${isReady ? c.green("✅ Yes") : c.red("❌ No")}`
        )
      );

      if (!isReady) {
        throw new Error(
          "Payout not ready - check member payments or contract logic"
        );
      }

      const expectedPayout = await retryWithBackoff(
        async () => await ajoPayments.calculatePayout(),
        "Calculate Payout"
      );
      console.log(
        c.bright(`     Expected Payout: ${formatUSDC(expectedPayout)}\n`)
      );

      const payoutReceipt = await retryWithBackoff(async () => {
        const payoutTx = await ajo
          .connect(participants[0].signer)
          .distributePayout({
            gasLimit: DEMO_CONFIG.GAS_LIMIT.DISTRIBUTE_PAYOUT,
          });
        return await payoutTx.wait();
      }, "Distribute Payout");

      cycleData.payout = {
        recipient: recipientName,
        recipientAddress: nextRecipient,
        amount: expectedPayout,
        success: true,
        gasUsed: payoutReceipt.gasUsed,
      };

      console.log(c.green(`     ✅ Payout Distributed!`));
      console.log(c.dim(`        Recipient: ${recipientName}`));
      console.log(c.dim(`        Amount: ${formatUSDC(expectedPayout)}`));
      console.log(
        c.dim(`        Gas Used: ${payoutReceipt.gasUsed.toString()}\n`)
      );
    } catch (error) {
      cycleData.payout = {
        recipient: recipientName,
        error: error.message,
        success: false,
      };

      console.log(
        c.red(`     ❌ Payout Failed: ${error.message.slice(0, 100)}\n`)
      );
    }

    cycleData.endTime = Date.now();
    cycleData.duration = (cycleData.endTime - cycleData.startTime) / 1000;

    cycleResults.push(cycleData);

    console.log(c.bright(`  ✅ Cycle ${cycle} Complete`));
    console.log(
      c.dim(`     Duration: ${cycleData.duration.toFixed(2)} seconds\n`)
    );

    // Wait for next cycle with progress indicator
    if (cycle < TOTAL_CYCLES) {
      await sleepWithProgress(cycleDuration, `Waiting for Cycle ${cycle + 1}`);
      console.log();
    }

    console.log(c.blue("═".repeat(88) + "\n"));
  }

  // ============ ENHANCED SUMMARY WITH PAYMENT STATUS ============
  console.log(
    c.bgGreen(
      "\n" + " ".repeat(28) + "📊 FULL CYCLE SUMMARY 📊" + " ".repeat(32)
    )
  );
  console.log(c.green("═".repeat(88) + "\n"));

  console.log(c.bright("  Overall Statistics:\n"));
  console.log(c.dim("     ┌─────────────────────────────┬──────────────┐"));
  console.log(
    c.dim(
      `     │ Total Cycles Completed      │ ${cycleResults.length
        .toString()
        .padStart(12)} │`
    )
  );

  const totalPayments = cycleResults.reduce(
    (sum, c) => sum + c.payments.filter((p) => p.success).length,
    0
  );
  const totalPayouts = cycleResults.filter(
    (c) => c.payout && c.payout.success
  ).length;

  console.log(
    c.dim(
      `     │ Total Payments Processed    │ ${totalPayments
        .toString()
        .padStart(12)} │`
    )
  );
  console.log(
    c.dim(
      `     │ Total Payouts Distributed   │ ${totalPayouts
        .toString()
        .padStart(12)} │`
    )
  );

  const avgCycleDuration =
    cycleResults.reduce((sum, c) => sum + c.duration, 0) / cycleResults.length;
  console.log(
    c.dim(
      `     │ Avg Cycle Duration          │ ${avgCycleDuration
        .toFixed(2)
        .padStart(10)}s │`
    )
  );

  // Add payment status summary
  const cyclesWithFullPayment = cycleResults.filter(
    (c) => c.paymentStatus?.allPaid
  ).length;
  console.log(
    c.dim(
      `     │ Cycles w/ Full Payment      │ ${cyclesWithFullPayment
        .toString()
        .padStart(12)} │`
    )
  );

  console.log(c.dim("     └─────────────────────────────┴──────────────┘\n"));

  console.log(c.bright("  Payout Recipients:\n"));
  console.log(
    c.dim("     ┌──────┬─────────────┬──────────────┬──────────────┐")
  );
  console.log(
    c.dim("     │ Cycle│ Recipient   │ Amount       │ Status       │")
  );
  console.log(
    c.dim("     ├──────┼─────────────┼──────────────┼──────────────┤")
  );

  for (const cycleData of cycleResults) {
    if (cycleData.payout) {
      const status = cycleData.payout.success
        ? c.green("✅ Success")
        : c.red("❌ Failed");
      const amount = cycleData.payout.amount
        ? formatUSDC(cycleData.payout.amount)
        : "N/A";
      console.log(
        c.dim(
          `     │ ${cycleData.cycle
            .toString()
            .padStart(4)} │ ${cycleData.payout.recipient.padEnd(
            11
          )} │ ${amount.padEnd(12)} │ ${status.padEnd(20)} │`
        )
      );
    }
  }

  console.log(
    c.dim("     └──────┴─────────────┴──────────────┴──────────────┘\n")
  );

  console.log(c.green("═".repeat(88) + "\n"));

  return cycleResults;
}

// ================================================================
// NEW: CREATE REAL HCS TOPIC
// ================================================================

async function createRealHcsTopic(hederaClient, ajoName) {
  console.log(c.cyan("  🌐 Creating Real HCS Topic for Ajo...\n"));

  if (!hederaClient) {
    console.log(
      c.yellow("     ⚠️  No Hedera client - using simulated topic ID\n")
    );
    const simulatedTopicNum = Math.floor(Math.random() * 1000000);
    const bytes32TopicId = ethers.utils.hexZeroPad(
      ethers.utils.hexlify(simulatedTopicNum),
      32
    );
    return {
      topicId: `0.0.${simulatedTopicNum}`,
      bytes32TopicId: bytes32TopicId,
      simulated: true,
    };
  }

  try {
    const { TopicCreateTransaction } = require("@hashgraph/sdk");

    console.log(c.yellow(`     → Creating HCS topic for "${ajoName}"...`));

    const transaction = new TopicCreateTransaction()
      .setTopicMemo(`AJO.SAVE Governance - ${ajoName}`)
      .setAdminKey(hederaClient.operatorPublicKey);

    const txResponse = await transaction.execute(hederaClient);
    const receipt = await txResponse.getReceipt(hederaClient);

    const topicId = receipt.topicId.toString();
    const topicNum = receipt.topicId.num.toString();
    const bytes32TopicId = ethers.utils.hexZeroPad(
      ethers.utils.hexlify(BigInt(topicNum)),
      32
    );

    console.log(c.green(`     ✅ HCS Topic Created!`));
    console.log(c.dim(`        Topic ID (Hedera): ${topicId}`));
    console.log(c.dim(`        Topic ID (bytes32): ${bytes32TopicId}\n`));

    return {
      topicId: topicId,
      bytes32TopicId: bytes32TopicId,
      transactionId: txResponse.transactionId.toString(),
      simulated: false,
    };
  } catch (error) {
    console.log(
      c.red(`     ❌ Failed to create HCS topic: ${error.message}\n`)
    );
    console.log(c.yellow("     Falling back to simulated topic ID...\n"));

    const simulatedTopicNum = Math.floor(Math.random() * 1000000);
    const bytes32TopicId = ethers.utils.hexZeroPad(
      ethers.utils.hexlify(simulatedTopicNum),
      32
    );

    return {
      topicId: `0.0.${simulatedTopicNum}`,
      bytes32TopicId: bytes32TopicId,
      simulated: true,
      error: error.message,
    };
  }
}

// ================================================================
// MAIN DEMONSTRATION
// ================================================================

async function main() {
  try {
    printEnhancedBanner();

    await sleep(2000);

    const {
      ajoFactory,
      deployer,
      masterContracts,
      usdcHtsToken,
      hbarHtsToken,
    } = await deployHtsSystem();

    await sleep(3000);

    let hederaClient = null;
    try {
      const { setupHederaClient } = require("./governance_hcs_demo.cjs");
      hederaClient = setupHederaClient();
    } catch (error) {
      console.log(
        c.yellow("⚠️  Hedera client setup failed - will use simulated topics")
      );
    }

    const {
      ajoId,
      ajoInfo,
      hcsTopicId,
      hcsTopicIdBytes32,
      hcsTopicSimulated,
      cycleDuration,
    } = await createHtsAjo(ajoFactory, deployer, hederaClient, {
      name: "Hedera Hackathon 2025 - 10 Cycle Demo",
      useScheduledPayments: true,
      cycleDuration: DEMO_CONFIG.CYCLE_DURATION,
      monthlyPaymentUSDC: DEMO_CONFIG.MONTHLY_PAYMENT_USDC,
      monthlyPaymentHBAR: DEMO_CONFIG.MONTHLY_PAYMENT_HBAR,
    });

    await sleep(3000);

    const { ajo, ajoMembers, ajoCollateral, ajoPayments, participants } =
      await setupHtsParticipants(ajoFactory, ajoId);

    await sleep(3000);

    const joinResults = await demonstrateMemberJoining(
      ajo,
      ajoCollateral,
      ajoMembers,
      participants,
      ajoInfo
    );

    await sleep(3000);

    // Run full 10 cycles
    const cycleResults = await demonstrateFullCycles(
      ajo,
      ajoPayments,
      participants,
      cycleDuration
    );

    await sleep(2000);

    const deploymentInfo = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployedAt: new Date().toISOString(),
      htsOnly: true,
      contracts: {
        AjoFactory: ajoFactory.address,
        USDC_HTS: usdcHtsToken,
        WHBAR_HTS: hbarHtsToken,
      },
      masterCopies: {
        AjoCore: masterContracts.ajoCore.address,
        AjoMembers: masterContracts.ajoMembers.address,
        AjoCollateral: masterContracts.ajoCollateral.address,
        AjoPayments: masterContracts.ajoPayments.address,
        AjoGovernance: masterContracts.ajoGovernance.address,
        AjoSchedule: masterContracts.ajoSchedule.address,
      },
      testAjo: {
        id: ajoId,
        name: ajoInfo.name,
        core: ajoInfo.ajoCore,
        cycleDuration: cycleDuration,
        monthlyPaymentUSDC: formatUSDC(DEMO_CONFIG.MONTHLY_PAYMENT_USDC),
        monthlyPaymentHBAR: formatHBAR(DEMO_CONFIG.MONTHLY_PAYMENT_HBAR),
        hcsTopicId: hcsTopicId,
        hcsTopicIdBytes32: hcsTopicIdBytes32,
        hcsTopicSimulated: hcsTopicSimulated,
      },
      participants: participants.map((p) => ({
        name: p.name,
        address: p.address,
        position: p.position,
      })),
      statistics: {
        totalParticipants: participants.length,
        successfulJoins: joinResults.filter((r) => r.success).length,
        totalCycles: cycleResults.length,
        totalPayments: cycleResults.reduce(
          (sum, c) => sum + c.payments.filter((p) => p.success).length,
          0
        ),
        totalPayouts: cycleResults.filter((c) => c.payout && c.payout.success)
          .length,
      },
      cycleResults: cycleResults,
    };

    const filename = `deployment-full-cycles-${Date.now()}.json`;
    try {
      fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
      console.log(c.green(`\n  ✅ Deployment info saved to: ${filename}\n`));
    } catch (error) {
      console.log(c.yellow(`\n  ⚠️ Could not save deployment info\n`));
    }

    console.log(
      c.bgGreen(
        "\n" + " ".repeat(28) + "🎉 DEMONSTRATION COMPLETE! 🎉" + " ".repeat(28)
      )
    );
    console.log(c.green("═".repeat(88) + "\n"));
    console.log(c.bright("  🚀 AJO.SAVE - Full 10-Cycle Demo Complete!\n"));

    console.log(c.yellow("  ✨ Features Demonstrated:"));
    console.log(c.dim("     • HTS tokens with auto-association"));
    console.log(c.dim("     • Configurable cycle duration (30 seconds)"));
    console.log(c.dim("     • Configurable monthly payments"));
    console.log(c.dim("     • Dynamic collateral system"));
    console.log(c.dim("     • Member joining workflow"));
    console.log(c.dim("     • 10 complete payment cycles"));
    console.log(c.dim("     • Payout distribution per cycle"));
    console.log(c.dim("     • Real-time cycle progression\n"));

    console.log(c.yellow("  📊 Demo Statistics:"));
    console.log(c.dim(`     • Participants: ${participants.length}`));
    console.log(c.dim(`     • Cycles Completed: ${cycleResults.length}`));
    console.log(
      c.dim(`     • Total Payments: ${deploymentInfo.statistics.totalPayments}`)
    );
    console.log(
      c.dim(`     • Total Payouts: ${deploymentInfo.statistics.totalPayouts}`)
    );
    console.log(c.dim(`     • Cycle Duration: ${cycleDuration}s\n`));

    console.log(c.green("═".repeat(88) + "\n"));

    if (hederaClient) {
      hederaClient.close();
    }

    return deploymentInfo;
  } catch (error) {
    console.error(c.red("\n💥 Demonstration failed:"));
    console.error(c.red(`   ${error.message}`));
    console.error(error);
    throw error;
  }
}

// ================================================================
// ENTRY POINT
// ================================================================

if (require.main === module) {
  main()
    .then(() => {
      console.log(
        c.green("\n🎉 Full 10-cycle demonstration completed successfully!\n")
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ Demonstration failed\n"));
      process.exit(1);
    });
}

module.exports = {
  main,
  deployHtsSystem,
  createHtsAjo,
  setupHtsParticipants,
  demonstrateMemberJoining,
  demonstrateFullCycles,
};
