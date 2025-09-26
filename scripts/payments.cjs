// scripts/run_demo.js
const { ethers } = require("hardhat");

/**
 * A helper function to add a delay.
 * @param {number} ms - Milliseconds to wait
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // =================================================================
  //                        SETUP & DEPLOYMENT
  // =================================================================
  console.log("🚀 Starting full demo script...");

  // 1. Get Signers
  // We'll assign roles to the first few accounts provided by Hardhat.
  const [deployer, member1_Alice, member2_Bob] = await ethers.getSigners();
  const ajoCore = deployer; // For simplicity, the deployer is also the admin.

  console.log("🔑 AjoCore Admin:", ajoCore.address);
  console.log("👤 Member 1 (Alice):", member1_Alice.address);
  console.log("👤 Member 2 (Bob):", member2_Bob.address);

  // 2. Deploy Mock ERC20 Tokens
  console.log("\n...Deploying mock tokens...");
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  
  const usdc = await MockERC20Factory.deploy("Mock USDC", "USDC", 6);
  await usdc.deployed();
  console.log(`✅ MockUSDC deployed to: ${usdc.address}`);

  const hbar = await MockERC20Factory.deploy("Wrapped HBAR", "HBAR", 8);
  await hbar.deployed();
  console.log(`✅ MockHBAR deployed to: ${hbar.address}`);

  // 3. Deploy AjoPayments Contract
  console.log("\n...Deploying AjoPayments contract...");
  // Note: Using deployer address for member/collateral contracts for this demo.
  // Replace these with your actual contract deployments if needed.
  const AjoPaymentsFactory = await ethers.getContractFactory("AjoPayments");
  const ajoPayments = await AjoPaymentsFactory.deploy(
    usdc.address,
    hbar.address,
    ajoCore.address,
    deployer.address, // Mock AjoMembers contract address
    deployer.address  // Mock AjoCollateral contract address
  );
  await ajoPayments.deployed();
  console.log(`✅ AjoPayments deployed to: ${ajoPayments.address}`);

  // 4. Mint Tokens for Members
  // The members need funds to make payments.
  console.log("\n...Minting USDC for Alice and Bob...");
  const mintAmount = ethers.utils.parseUnits("1000", 6); // Mint 1,000 USDC each
  await usdc.mint(member1_Alice.address, mintAmount);
  await usdc.mint(member2_Bob.address, mintAmount);
  console.log("✅ Minted 1,000 USDC to Alice and Bob each.");


  // =================================================================
  //                       INTERACTION PHASE
  // =================================================================
  console.log("\n\n--- ▶️  STARTING INTERACTION DEMO ---");
  await sleep(1000); // Pause for readability

  const USDC_MONTHLY_PAYMENT = ethers.BigNumber.from("50000000"); // 50e6 = $50 with 6 decimals

  // --- SCENARIO 1: Alice pays on time for Cycle 1 ---
  console.log("\n--- SCENARIO 1: ALICE PAYS ON TIME (CYCLE 1) ---");
  console.log(`1. Alice is approving the contract to spend ${ethers.utils.formatUnits(USDC_MONTHLY_PAYMENT, 6)} USDC...`);
  await usdc.connect(member1_Alice).approve(ajoPayments.address, USDC_MONTHLY_PAYMENT);
  console.log("   ✅ Approval successful!");

  console.log("2. Alice is calling makePayment()...");
  await ajoPayments.connect(member1_Alice).makePayment();
  console.log("   ✅ Payment successful!");
  
  let currentCycle = await ajoPayments.getCurrentCycle();
  let contractUSDCBalance = await usdc.balanceOf(ajoPayments.address);
  console.log(`   📊 Contract State: Cycle ${currentCycle}, Balance: ${ethers.utils.formatUnits(contractUSDCBalance, 6)} USDC`);
  await sleep(1000);

  // --- SCENARIO 2: Bob defaults and pays late ---
  console.log("\n--- SCENARIO 2: BOB DEFAULTS AND PAYS LATE ---");
  console.log("1. AjoCore is advancing the cycle to 2...");
  await ajoPayments.connect(ajoCore).advanceCycle();
  currentCycle = await ajoPayments.getCurrentCycle();
  console.log(`   ✅ Cycle advanced to ${currentCycle}!`);

  console.log("2. AjoCore is calling handleDefault() for Bob...");
  await ajoPayments.connect(ajoCore).handleDefault(member2_Bob.address);
  let bobPenalty = await ajoPayments.getPendingPenalty(member2_Bob.address);
  console.log(`   ✅ Bob is now in default. Pending penalty: ${ethers.utils.formatUnits(bobPenalty, 6)} USDC`);

  const totalAmountDue = USDC_MONTHLY_PAYMENT.add(bobPenalty);
  console.log(`3. Bob now owes ${ethers.utils.formatUnits(totalAmountDue, 6)} USDC (payment + penalty).`);
  
  console.log("4. Bob is approving the contract for the total amount due...");
  await usdc.connect(member2_Bob).approve(ajoPayments.address, totalAmountDue);
  console.log("   ✅ Approval successful!");
  
  console.log("5. Bob is calling makePayment()...");
  await ajoPayments.connect(member2_Bob).makePayment();
  console.log("   ✅ Bob's payment successful!");
  
  bobPenalty = await ajoPayments.getPendingPenalty(member2_Bob.address);
  contractUSDCBalance = await usdc.balanceOf(ajoPayments.address);
  console.log(`   📊 Bob's pending penalty is now cleared: ${ethers.utils.formatUnits(bobPenalty, 6)} USDC`);
  console.log(`   💰 New Contract Balance: ${ethers.utils.formatUnits(contractUSDCBalance, 6)} USDC`);
  await sleep(1000);

  // --- SCENARIO 3: Distribute Payout ---
  console.log("\n--- SCENARIO 3: DISTRIBUTE PAYOUT ---");
  const aliceBalanceBefore = await usdc.balanceOf(member1_Alice.address);
  console.log(`1. Alice's USDC balance before payout: ${ethers.utils.formatUnits(aliceBalanceBefore, 6)}`);

  console.log("2. AjoCore is calling distributePayout()...");
  // Note: This will fail if your AjoMembers logic doesn't return a valid recipient.
  // For this demo, we assume the mock returns a valid member.
  try {
    await ajoPayments.connect(ajoCore).distributePayout();
    console.log("   ✅ Payout distributed successfully!");

    const aliceBalanceAfter = await usdc.balanceOf(member1_Alice.address);
    contractUSDCBalance = await usdc.balanceOf(ajoPayments.address);
    console.log(`3. Alice's USDC balance after payout: ${ethers.utils.formatUnits(aliceBalanceAfter, 6)}`);
    console.log(`   💰 Final Contract Balance: ${ethers.utils.formatUnits(contractUSDCBalance, 6)} USDC`);
  } catch (error) {
    console.error("   ❌ Payout failed. This is likely because the mock member/collateral contracts are simple addresses and don't have the required functions (like `getNextRecipient`). For a full test, these would need to be fleshed-out mock contracts.");
  }
  
  console.log("\n\n🎉 Demo script finished!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("🚨 Script failed:", error);
    process.exit(1);
  });