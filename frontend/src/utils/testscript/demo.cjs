#!/usr/bin/env node
const { ethers } = require("hardhat");
const fs = require("fs");

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
  MONTHLY_PAYMENT: ethers.utils.parseUnits("50", 6),
  TOTAL_PARTICIPANTS: 10,
  MIN_HBAR_FOR_HTS: ethers.utils.parseEther("50"), // 50 HBAR required
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
    HTS_BATCH_ASSOCIATE: 2500000,
    HTS_BATCH_FUND: 3500000,
    HTS_APPROVE: 400000,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatUSDC = (amount) => ethers.utils.formatUnits(amount, 6);
const formatHBAR = (amount) => ethers.utils.formatUnits(amount, 8);

// ================================================================
// ENHANCED BANNER
// ================================================================

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
          "                   🏦 AJO.SAVE - HTS AUTO-ASSOCIATION DEMO 🏦                        "
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
    c.bright("\n" + " ".repeat(20) + "HTS-ONLY Demo - No ERC20 Fallbacks")
  );
  console.log(
    c.dim(
      " ".repeat(12) +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    )
  );

  console.log(c.yellow("\n  🌟 HEDERA TOKEN SERVICE (HTS) FEATURES:"));
  console.log(
    c.green("     ✓ Auto-Association") +
      c.dim(" - Users receive tokens without manual association")
  );
  console.log(
    c.green("     ✓ Factory Treasury") +
      c.dim(" - Centralized token distribution")
  );
  console.log(
    c.green("     ✓ Batch Operations") +
      c.dim(" - Efficient multi-user funding")
  );
  console.log(
    c.green("     ✓ Native Hedera") + c.dim(" - Faster & cheaper than ERC20\n")
  );

  console.log(
    c.bgRed(" ⚠️  CRITICAL: THIS DEMO REQUIRES HTS - NO ERC20 FALLBACK ")
  );
  console.log(c.yellow("  Minimum 50 HBAR required in deployer account\n"));
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

  // ✅ Check minimum balance
  if (balance.lt(DEMO_CONFIG.MIN_HBAR_FOR_HTS)) {
    throw new Error(
      `Insufficient HBAR! Need ${ethers.utils.formatEther(
        DEMO_CONFIG.MIN_HBAR_FOR_HTS
      )} HBAR, ` + `have ${ethers.utils.formatEther(balance)} HBAR`
    );
  }

  console.log(c.green(`  ✅ Sufficient HBAR for HTS token creation\n`));

  // Step 1.1: Deploy Master Implementation Contracts
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

  // Step 1.2: Deploy Factory (with dummy addresses for tokens - will be set later)
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
      DUMMY_TOKEN, // Will be replaced with real HTS tokens
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

  // Step 1.3: Create HTS Tokens with Auto-Association
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

    // Look for HTS creation event
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

  // Step 1.4: Verify Factory Token Balances
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
// PHASE 2: 5-PHASE AJO CREATION (HTS-ONLY)
// ================================================================

async function createHtsAjo(ajoFactory, deployer, options = {}) {
  console.log(
    c.bgBlue(
      "\n" + " ".repeat(28) + "PHASE 2: HTS AJO CREATION" + " ".repeat(33)
    )
  );
  console.log(c.blue("═".repeat(88)));

  const { name = `HTS Ajo ${Date.now()}`, useScheduledPayments = true } =
    options;

  console.log(c.bright("\n  📋 Configuration:"));
  console.log(
    c.dim("     ┌──────────────────────────────────────────────────────────┐")
  );
  console.log(c.dim(`     │ Name: ${name.padEnd(51)} │`));
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

  let ajoId, hcsTopicId;

  // PHASE 1: Create Core
  console.log(c.cyan("  📋 PHASE 1/5: Creating Ajo Core..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).createAjo(
      name,
      true, // MUST use HTS
      useScheduledPayments,
      { gasLimit: DEMO_CONFIG.GAS_LIMIT.CREATE_AJO }
    );
    const receipt = await tx.wait();

    const event = receipt.events?.find((e) => e.event === "AjoCreated");
    ajoId = event?.args?.ajoId?.toNumber();

    console.log(c.green(`     ✅ Ajo Core Created`));
    console.log(c.dim(`        ID: ${ajoId}`));
    console.log(c.dim(`        Gas: ${receipt.gasUsed.toString()}\n`));
    return { ajoId, receipt };
  }, "Create Ajo Phase 1");

  await sleep(2000);

  // PHASE 2-5: Initialize remaining phases
  console.log(
    c.cyan("  📋 PHASE 2/5: Initialize Members + Governance + HCS...")
  );
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase2(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_2,
    });
    const receipt = await tx.wait();

    const hcsEvent = receipt.events?.find(
      (e) => e.event === "AjoInitializedPhase2"
    );
    hcsTopicId = hcsEvent?.args?.hcsTopicId;

    console.log(c.green(`     ✅ Phase 2 Complete`));
    console.log(c.dim(`        HCS Topic: ${hcsTopicId}\n`));
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

  console.log(c.cyan("  📋 PHASE 4/5: Initialize Core + Cross-link..."));
  await retryOperation(async () => {
    const tx = await ajoFactory.connect(deployer).initializeAjoPhase4(ajoId, {
      gasLimit: DEMO_CONFIG.GAS_LIMIT.INIT_PHASE_4,
    });
    await tx.wait();
    console.log(c.green(`     ✅ Phase 4 Complete\n`));
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
      "     └──────────────────────────────────────────────────────────────────┘\n"
    )
  );
  console.log(c.blue("═".repeat(88) + "\n"));

  return { ajoId, ajoInfo, hcsTopicId };
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
      "     ℹ️  Auto-association ENABLED - users receive tokens automatically\n"
    )
  );

  // Check factory balance
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

  const userAddresses = signers.slice(0, actualCount).map((s) => s.address);

  // Associate users (optional but recommended)
  console.log(c.cyan("  🔗 Associating Users with HTS Tokens...\n"));

  try {
    await retryOperation(async () => {
      const tx = await ajoFactory
        .connect(deployer)
        .batchAssociateUsersWithHtsTokens(userAddresses, {
          gasLimit: DEMO_CONFIG.GAS_LIMIT.HTS_BATCH_ASSOCIATE,
        });
      const receipt = await tx.wait();

      const assocEvents = receipt.events?.filter(
        (e) => e.event === "UserHtsAssociated"
      );
      console.log(
        c.green(
          `     ✅ ${assocEvents?.length || actualCount} users associated`
        )
      );
      console.log(c.dim(`        Gas used: ${receipt.gasUsed.toString()}\n`));
      return tx;
    }, "Batch Associate HTS Tokens");
  } catch (error) {
    console.log(
      c.yellow(`     ⚠️ Association skipped (auto-association may handle this)`)
    );
    console.log(c.dim(`        ${error.message.slice(0, 80)}\n`));
  }

  await sleep(2000);

  // Fund users
  console.log(c.cyan("  💰 Funding Participants with HTS Tokens...\n"));

  const usdcAmountsInt64 = new Array(actualCount).fill(1000 * 10 ** 6); // 1000 USDC
  const hbarAmountsInt64 = new Array(actualCount).fill(1000 * 10 ** 8); // 1000 WHBAR

  await retryOperation(async () => {
    const tx = await ajoFactory
      .connect(deployer)
      .batchFundUsersWithHtsTokens(
        userAddresses,
        usdcAmountsInt64,
        hbarAmountsInt64,
        { gasLimit: DEMO_CONFIG.GAS_LIMIT.HTS_BATCH_FUND }
      );
    const receipt = await tx.wait();

    const balanceEvent = receipt.events?.find(
      (e) => e.event === "FactoryBalanceCheck"
    );
    if (balanceEvent) {
      console.log(c.dim(`     Factory balances verified:`));
      console.log(
        c.dim(`       USDC: ${formatUSDC(balanceEvent.args.usdcBalance)}`)
      );
      console.log(
        c.dim(`       HBAR: ${formatHBAR(balanceEvent.args.hbarBalance)}\n`)
      );
    }

    const fundEvents = receipt.events?.filter(
      (e) => e.event === "UserHtsFunded"
    );
    const successCount =
      fundEvents?.filter((e) => {
        const usdcSuccess = e.args.usdcResponse.toNumber() === 22;
        const hbarSuccess = e.args.hbarResponse.toNumber() === 22;
        return usdcSuccess || hbarSuccess;
      }).length || 0;

    console.log(
      c.green(
        `     ✅ ${successCount}/${actualCount} users funded successfully\n`
      )
    );

    if (successCount === 0) {
      throw new Error("No users were successfully funded!");
    }

    return tx;
  }, "Batch Fund HTS Tokens");

  await sleep(2000);

  // Prepare participants with approvals
  console.log(
    c.cyan(
      "  👥 Preparing Participants (Balances + Direct ERC20 Approvals)...\n"
    )
  );
  console.log(
    c.yellow(
      "     ℹ️  Using direct ERC20 interface (HTS tokens are ERC20-compatible)\n"
    )
  );
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
      // Get balance
      const balance = await usdcContract.balanceOf(participant.address);

      if (balance.eq(0)) {
        throw new Error("Zero balance after funding");
      }

      const approvalAmount = balance.div(2);

      console.log(
        c.dim(
          `     → ${participant.name}: Using direct ERC20 approve on HTS token...`
        )
      );

      // Create ERC20 interface for HTS token
      const htsToken = new ethers.Contract(
        ajoInfo.usdcToken,
        [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)",
        ],
        participant.signer
      );

      // Approve Collateral contract - Direct ERC20 interface
      await retryOperation(async () => {
        const tx = await htsToken.approve(
          ajoCollateral.address,
          approvalAmount,
          { gasLimit: 800000 } // Higher gas for HTS ERC20 operations
        );
        const receipt = await tx.wait();

        // Verify approval worked
        const allowance = await htsToken.allowance(
          participant.address,
          ajoCollateral.address
        );
        if (allowance.lt(approvalAmount)) {
          throw new Error(
            `Approval failed: allowance ${formatUSDC(allowance)} < ${formatUSDC(
              approvalAmount
            )}`
          );
        }

        console.log(
          c.dim(
            `        ✓ Collateral: ${formatUSDC(
              approvalAmount
            )} (Gas: ${receipt.gasUsed.toString()})`
          )
        );
        return tx;
      }, `${participant.name} - Approve Collateral`);

      // Approve Payments contract - Direct ERC20 interface
      await retryOperation(async () => {
        const tx = await htsToken.approve(ajoPayments.address, approvalAmount, {
          gasLimit: 800000,
        });
        const receipt = await tx.wait();

        // Verify approval worked
        const allowance = await htsToken.allowance(
          participant.address,
          ajoPayments.address
        );
        if (allowance.lt(approvalAmount)) {
          throw new Error(
            `Approval failed: allowance ${formatUSDC(allowance)} < ${formatUSDC(
              approvalAmount
            )}`
          );
        }

        console.log(
          c.dim(
            `        ✓ Payments: ${formatUSDC(
              approvalAmount
            )} (Gas: ${receipt.gasUsed.toString()})`
          )
        );
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

    await sleep(800);
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
// PHASE 4: DEMONSTRATE HTS FEATURES
// ================================================================

async function demonstrateHtsFeatures(
  ajoFactory,
  ajoId,
  participants,
  ajoInfo
) {
  console.log(
    c.bgBlue(
      "\n" +
        " ".repeat(22) +
        "PHASE 4: HTS AUTO-ASSOCIATION DEMONSTRATION" +
        " ".repeat(23)
    )
  );
  console.log(c.blue("═".repeat(88)));
  console.log(c.bright("\n  💎 Native Hedera Tokens with Auto-Association\n"));

  // Token Information
  console.log(c.cyan("  📊 HTS Token Configuration\n"));
  console.log(c.dim("     USDC Token (HTS):"));
  console.log(
    c.dim("     ┌─────────────────────────────────────────────────┐")
  );
  console.log(
    c.dim(`     │ Address:      ${ajoInfo.usdcToken.slice(0, 42).padEnd(42)} │`)
  );
  console.log(
    c.dim(`     │ Symbol:       USDC (HTS)                          │`)
  );
  console.log(
    c.dim(`     │ Decimals:     6                                   │`)
  );
  console.log(
    c.dim(`     │ Auto-Assoc:   ${c.green("✅ ENABLED").padEnd(51)} │`)
  );
  console.log(
    c.dim(`     │ Treasury:     Factory                             │`)
  );
  console.log(
    c.dim("     └─────────────────────────────────────────────────┘\n")
  );

  // Member Balances
  console.log(c.cyan("  📊 Member Token Balances\n"));
  console.log(
    c.dim("     ┌─────────────┬──────────────┬──────────────┬──────────────┐")
  );
  console.log(
    c.dim("     │ Member      │ USDC Balance │ HBAR Balance │ Ready Status │")
  );
  console.log(
    c.dim("     ├─────────────┼──────────────┼──────────────┼──────────────┤")
  );

  for (let i = 0; i < Math.min(5, participants.length); i++) {
    const p = participants[i];
    try {
      const usdcContract = new ethers.Contract(
        ajoInfo.usdcToken,
        ["function balanceOf(address) view returns (uint256)"],
        ethers.provider
      );

      const hbarContract = new ethers.Contract(
        ajoInfo.hbarToken,
        ["function balanceOf(address) view returns (uint256)"],
        ethers.provider
      );

      const usdcBalance = await usdcContract.balanceOf(p.address);
      const hbarBalance = await hbarContract.balanceOf(p.address);

      const usdcBal = formatUSDC(usdcBalance);
      const hbarBal = formatHBAR(hbarBalance);
      const readyStatus = usdcBalance.gt(0)
        ? c.green("✅ Ready")
        : c.yellow("⚠️ No Balance");

      console.log(
        c.dim(
          `     │ ${p.name.padEnd(11)} │ ${usdcBal.padEnd(
            12
          )} │ ${hbarBal.padEnd(12)} │ ${readyStatus.padEnd(20)} │`
        )
      );
    } catch (error) {
      console.log(
        c.dim(
          `     │ ${p.name.padEnd(11)} │ ${"⚠️ Error".padEnd(
            12
          )} │ ${"⚠️ Error".padEnd(12)} │ ${"⚠️ Error".padEnd(12)} │`
        )
      );
    }
  }
  console.log(
    c.dim("     └─────────────┴──────────────┴──────────────┴──────────────┘\n")
  );

  // Key Benefits
  console.log(c.cyan("  💡 HTS Auto-Association Benefits:\n"));
  console.log(
    c.green("     ✓ No Manual Association") +
      c.dim(" - Users receive tokens automatically")
  );
  console.log(
    c.green("     ✓ Seamless Onboarding") + c.dim(" - One-step funding process")
  );
  console.log(
    c.green("     ✓ Reduced Gas Costs") +
      c.dim(" - No separate association transactions")
  );
  console.log(
    c.green("     ✓ Better UX") + c.dim(" - Simplified user experience")
  );
  console.log(
    c.green("     ✓ Factory Treasury") +
      c.dim(" - Centralized token distribution")
  );
  console.log(
    c.green("     ✓ Native Hedera") + c.dim(" - Faster & cheaper than ERC20\n")
  );

  console.log(c.blue("═".repeat(88) + "\n"));
}

// ================================================================
// PHASE 5: MEMBER JOINING
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
        "PHASE 5: MEMBER JOINING & COLLATERAL SYSTEM" +
        " ".repeat(22)
    )
  );
  console.log(c.blue("═".repeat(88)));
  console.log(
    c.bright("\n  🔒 Dynamic Collateral Model V2 - 55% Capital Efficiency\n")
  );

  // Show collateral model
  console.log(
    c.cyan("  📊 Collateral Requirements (10 participants, 50 USDC monthly):\n")
  );

  try {
    const demo = await ajo.getCollateralDemo(10, DEMO_CONFIG.MONTHLY_PAYMENT);

    console.log(
      c.dim(
        "     ┌──────────┬─────────────────┬─────────────┬─────────────────┐"
      )
    );
    console.log(
      c.dim(
        "     │ Position │ Collateral Req. │ Risk Level  │ % of Total Pool │"
      )
    );
    console.log(
      c.dim(
        "     ├──────────┼─────────────────┼─────────────┼─────────────────┤"
      )
    );

    for (let i = 0; i < demo.positions.length; i++) {
      const pos = demo.positions[i].toNumber();
      const coll = formatUSDC(demo.collaterals[i]);
      const pct = (
        demo.collaterals[i]
          .mul(100)
          .div(DEMO_CONFIG.MONTHLY_PAYMENT.mul(10))
          .toNumber() / 100
      ).toFixed(1);

      let riskLevel, riskColor;
      if (pos <= 3) {
        riskLevel = "HIGH   ";
        riskColor = c.red;
      } else if (pos <= 7) {
        riskLevel = "MEDIUM ";
        riskColor = c.yellow;
      } else {
        riskLevel = "LOW    ";
        riskColor = c.green;
      }

      console.log(
        c.dim(
          `     │ ${pos.toString().padStart(8)} │ ${coll.padEnd(
            15
          )} │ ${riskColor(riskLevel).padEnd(19)} │ ${pct.padEnd(15)}% │`
        )
      );
    }

    console.log(
      c.dim(
        "     └──────────┴─────────────────┴─────────────┴─────────────────┘\n"
      )
    );

    const totalCollateral = demo.collaterals.reduce(
      (sum, c) => sum.add(c),
      ethers.BigNumber.from(0)
    );
    const totalPool = DEMO_CONFIG.MONTHLY_PAYMENT.mul(10);
    const efficiency = totalCollateral.mul(100).div(totalPool).toNumber();

    console.log(
      c.bright(`     📈 Total Collateral: ${formatUSDC(totalCollateral)} USDC`)
    );
    console.log(c.bright(`     📊 Total Pool: ${formatUSDC(totalPool)} USDC`));
    console.log(
      c.green(
        `     🎯 Capital Efficiency: ${efficiency}% (vs 100% traditional ROSCAs)\n`
      )
    );
  } catch (error) {
    console.log(c.yellow(`     ⚠️ Could not generate collateral demo\n`));
  }

  // Pre-check Ajo status
  console.log(c.cyan("  👥 Members Joining Process:\n"));

  try {
    const ajoStatus = await ajo.getAjoInfo();
    console.log(c.dim(`     Ajo Status:`));
    console.log(
      c.dim(
        `       Active: ${ajoStatus.isActive ? c.green("✅") : c.red("❌")}`
      )
    );
    console.log(
      c.dim(
        `       Members: ${ajoStatus.totalMembers.toString()}/${ajoStatus.maxMembers.toString()}`
      )
    );
    console.log(c.dim(`       Cycle: ${ajoStatus.currentCycle.toString()}\n`));

    if (!ajoStatus.isActive) {
      console.log(c.red(`     ❌ ERROR: Ajo is not active!\n`));
      return [];
    }
  } catch (error) {
    console.log(c.yellow(`     ⚠️ Could not verify Ajo status\n`));
  }

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
      // Pre-flight checks
      const usdcContract = new ethers.Contract(
        ajoInfo.usdcToken,
        [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address,address) view returns (uint256)",
        ],
        ethers.provider
      );

      const balance = await usdcContract.balanceOf(participant.address);
      const collateralAllowance = await usdcContract.allowance(
        participant.address,
        ajoCollateral.address
      );
      const paymentsAllowance = await usdcContract.allowance(
        participant.address,
        ajoCollateral.address
      );

      console.log(
        c.dim(
          `     → ${participant.name}: Bal=${formatUSDC(
            balance
          )}, CollAllow=${formatUSDC(
            collateralAllowance
          )}, PayAllow=${formatUSDC(paymentsAllowance)}`
        )
      );

      if (collateralAllowance.eq(0)) {
        throw new Error("Collateral allowance is zero");
      }

      // Attempt to join
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
// MAIN DEMONSTRATION
// ================================================================

async function main() {
  try {
    printEnhancedBanner();

    await sleep(2000);

    // PHASE 1: Deploy HTS System
    const {
      ajoFactory,
      deployer,
      masterContracts,
      usdcHtsToken,
      hbarHtsToken,
    } = await deployHtsSystem();

    await sleep(3000);

    // PHASE 2: Create HTS Ajo
    const { ajoId, ajoInfo, hcsTopicId } = await createHtsAjo(
      ajoFactory,
      deployer,
      {
        name: "Hedera Hackathon 2025 - HTS Auto-Association Demo",
        useScheduledPayments: true,
      }
    );

    await sleep(3000);

    // PHASE 3: Setup HTS Participants
    const { ajo, ajoMembers, ajoCollateral, ajoPayments, participants } =
      await setupHtsParticipants(ajoFactory, ajoId);

    await sleep(3000);

    // PHASE 4: Demonstrate HTS Features
    await demonstrateHtsFeatures(ajoFactory, ajoId, participants, ajoInfo);

    await sleep(2000);

    // PHASE 5: Member Joining
    const joinResults = await demonstrateMemberJoining(
      ajo,
      ajoCollateral,
      ajoMembers,
      participants,
      ajoInfo
    );

    await sleep(3000);

    // Save deployment info
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
        members: ajoInfo.ajoMembers,
        collateral: ajoInfo.ajoCollateral,
        payments: ajoInfo.ajoPayments,
        governance: ajoInfo.ajoGovernance,
        schedule: ajoInfo.ajoSchedule,
        hcsTopicId: hcsTopicId,
        usesHtsTokens: true,
        usesScheduledPayments: ajoInfo.usesScheduledPayments,
      },
      hederaServices: {
        HTS: {
          enabled: true,
          autoAssociation: true,
          usdcToken: usdcHtsToken,
          hbarToken: hbarHtsToken,
        },
        HSS: {
          enabled: true,
          address: "0x000000000000000000000000000000000000016b",
        },
        HCS: {
          enabled: true,
          topicId: hcsTopicId,
        },
      },
      participants: participants.map((p) => ({
        name: p.name,
        address: p.address,
        position: p.position,
      })),
      statistics: {
        totalParticipants: participants.length,
        successfulJoins: joinResults.filter((r) => r.success).length,
        htsEnabled: true,
        autoAssociationEnabled: true,
      },
    };

    const filename = `deployment-hts-only-${Date.now()}.json`;
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
    console.log(c.bright("  🚀 AJO.SAVE - HTS Auto-Association Demo"));
    console.log(c.dim("     Pure HTS implementation - No ERC20 fallbacks\n"));

    console.log(c.yellow("  ✨ Features Demonstrated:"));
    console.log(c.dim("     • HTS tokens with auto-association"));
    console.log(c.dim("     • Factory treasury management"));
    console.log(c.dim("     • Batch user funding"));
    console.log(c.dim("     • Dynamic collateral system"));
    console.log(c.dim("     • Member joining workflow\n"));

    console.log(c.green("═".repeat(88) + "\n"));

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
      console.log(c.green("\n🎉 HTS demonstration completed successfully!\n"));
      process.exit(0);
    })
    .catch((error) => {
      console.error(c.red("\n❌ HTS demonstration failed\n"));
      process.exit(1);
    });
}

module.exports = {
  main,
  deployHtsSystem,
  createHtsAjo,
  setupHtsParticipants,
  demonstrateHtsFeatures,
  demonstrateMemberJoining,
};
