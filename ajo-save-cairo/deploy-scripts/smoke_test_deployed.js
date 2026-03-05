import { RpcProvider, Account, Contract, CairoCustomEnum } from "starknet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ABIS_DIR = path.resolve(PROJECT_ROOT, "starknet-scripts/abis");

const FACTORY_ABI_PATH = path.resolve(ABIS_DIR, "factory.json");
const CORE_ABI_PATH = path.resolve(ABIS_DIR, "core.json");
const ERC20_ABI_PATH = path.resolve(ABIS_DIR, "erc20.json");

const DEPLOYMENT_INFO_PATH = path.resolve(PROJECT_ROOT, "deployment_info.json");
const SMOKE_REPORT_PATH = path.resolve(PROJECT_ROOT, "smoke_test_report.json");
const DEFAULT_MAX_FEE = BigInt(process.env.STARKNET_MAX_FEE ?? "300000000000000");

function parseError(error) {
  return String(error?.message ?? error?.stack ?? error);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name, fallback = null) {
  const value = process.env[name];
  return value ? value : fallback;
}

function loadJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isHexZero(value) {
  if (!value) return true;
  try {
    return BigInt(value) === 0n;
  } catch {
    return false;
  }
}

function assertNonZeroAddress(label, value) {
  if (isHexZero(value)) {
    throw new Error(`${label} is zero`);
  }
}

function toU256BigInt(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  if (value && typeof value === "object" && "low" in value && "high" in value) {
    return (BigInt(value.high) << 128n) + BigInt(value.low);
  }
  return BigInt(value);
}

function shortString(name) {
  const normalized = String(name).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  return normalized.length > 0 ? normalized : "BTCSmoke";
}

function normalizePaymentToken(token) {
  const value = String(token ?? "USDC").toUpperCase();
  return value === "BTC"
    ? new CairoCustomEnum({ BTC: {} })
    : new CairoCustomEnum({ USDC: {} });
}

function explorerTx(network, txHash) {
  if (network === "mainnet") {
    return `https://voyager.online/tx/${txHash}`;
  }
  return `https://sepolia.voyager.online/tx/${txHash}`;
}

async function invokeAndWait(provider, account, contract, method, args, network) {
  let tx;
  try {
    const call = contract.populate(method, args);
    tx = await account.execute(call, {
      maxFee: DEFAULT_MAX_FEE,
    });
  } catch (error) {
    throw new Error(`Failed to submit ${method}: ${parseError(error)}`);
  }

  try {
    await provider.waitForTransaction(tx.transaction_hash);
  } catch (error) {
    throw new Error(`Transaction failed for ${method} (${tx.transaction_hash}): ${parseError(error)}`);
  }

  console.log(`✅ ${method}: ${tx.transaction_hash}`);
  console.log(`   ↳ ${explorerTx(network, tx.transaction_hash)}`);
  return tx.transaction_hash;
}

function loadSmokeMembers(provider) {
  const members = [];
  for (let i = 1; i <= 10; i++) {
    const address = process.env[`TEST_ACCOUNT_${i}_ADDRESS`] ?? process.env[`SMOKE_MEMBER_${i}_ADDRESS`];
    const privateKey = process.env[`TEST_ACCOUNT_${i}_PRIVATE_KEY`] ?? process.env[`SMOKE_MEMBER_${i}_PRIVATE_KEY`];

    if (address && privateKey) {
      members.push(new Account(provider, address, privateKey));
    }
  }

  return members;
}

async function ensureTokenBalance(token, accountAddress, requiredAmount, label) {
  const balance = toU256BigInt(await token.balance_of(accountAddress));
  if (balance < requiredAmount) {
    throw new Error(
      `${label} has insufficient token balance. required=${requiredAmount.toString()} actual=${balance.toString()}`
    );
  }
}

async function main() {
  const network = optionalEnv("STARKNET_NETWORK", "sepolia");
  const rpcUrl = requiredEnv("STARKNET_RPC");
  const ownerAddress = requiredEnv("STARKNET_ACCOUNT_ADDRESS");
  const ownerPrivateKey = requiredEnv("STARKNET_PRIVATE_KEY");

  const participantCount = Number(optionalEnv("SMOKE_TOTAL_PARTICIPANTS", "3"));
  const monthlyContribution = BigInt(optionalEnv("SMOKE_MONTHLY_CONTRIBUTION", "1000"));
  const cycleDuration = Number(optionalEnv("SMOKE_CYCLE_DURATION", "86400"));
  const btcTokenOverride = optionalEnv("SMOKE_BTC_TOKEN_ADDRESS", null);

  if (participantCount < 3) {
    throw new Error(`SMOKE_TOTAL_PARTICIPANTS must be >= 3. received=${participantCount}`);
  }
  if (cycleDuration < 86400) {
    throw new Error(`SMOKE_CYCLE_DURATION must be >= 86400. received=${cycleDuration}`);
  }

  const factoryAbi = loadJson(FACTORY_ABI_PATH, "factory ABI");
  const coreAbi = loadJson(CORE_ABI_PATH, "core ABI");
  const erc20Abi = loadJson(ERC20_ABI_PATH, "erc20 ABI");
  const deploymentInfo = loadJson(DEPLOYMENT_INFO_PATH, "deployment_info.json");

  const factoryAddress = deploymentInfo?.contracts?.factory;
  assertNonZeroAddress("Factory address", factoryAddress);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const owner = new Account(provider, ownerAddress, ownerPrivateKey);
  const factory = new Contract(factoryAbi, factoryAddress, owner);

  console.log("\n🧪 Running deployed smoke test (BTC-mode)");
  console.log(`🌐 Network: ${network}`);
  console.log(`🏭 Factory: ${factoryAddress}`);

  const txs = {};

  if (btcTokenOverride) {
    assertNonZeroAddress("SMOKE_BTC_TOKEN_ADDRESS", btcTokenOverride);
    txs.set_btc_token_address = await invokeAndWait(
      provider,
      owner,
      factory,
      "set_btc_token_address",
      [btcTokenOverride],
      network
    );
  }

  const beforeTotal = Number(await factory.get_total_ajos());
  const smokeName = shortString(`BTCSmoke_${Date.now()}`);

  txs.create_ajo = await invokeAndWait(
    provider,
    owner,
    factory,
    "create_ajo",
    [smokeName, monthlyContribution, BigInt(participantCount), cycleDuration, normalizePaymentToken("BTC")],
    network
  );

  const afterTotal = Number(await factory.get_total_ajos());
  if (afterTotal !== beforeTotal + 1) {
    throw new Error(`Factory total Ajos did not increment correctly. before=${beforeTotal}, after=${afterTotal}`);
  }

  const ajoId = BigInt(afterTotal);
  console.log(`✅ Created BTC Ajo ID: ${ajoId.toString()}`);

  txs.deploy_members = await invokeAndWait(provider, owner, factory, "deploy_members", [ajoId], network);
  txs.deploy_collateral_and_payments = await invokeAndWait(
    provider,
    owner,
    factory,
    "deploy_collateral_and_payments",
    [ajoId],
    network
  );
  txs.deploy_governance_and_schedule = await invokeAndWait(
    provider,
    owner,
    factory,
    "deploy_governance_and_schedule",
    [ajoId],
    network
  );
  txs.deploy_core = await invokeAndWait(provider, owner, factory, "deploy_core", [ajoId], network);

  const ajoInfo = await factory.get_ajo_info(ajoId);
  const coreAddress = ajoInfo.core_address;
  const collateralAddress = ajoInfo.collateral_address;
  const paymentsAddress = ajoInfo.payments_address;

  assertNonZeroAddress("Ajo core", coreAddress);
  assertNonZeroAddress("Ajo collateral", collateralAddress);
  assertNonZeroAddress("Ajo payments", paymentsAddress);

  if (!ajoInfo.is_initialized) {
    throw new Error("Ajo not initialized after phased deployment");
  }

  const core = new Contract(coreAbi, coreAddress, owner);

  const configuredTokenAddress = await factory.get_btc_token_address();
  assertNonZeroAddress("Factory BTC token", configuredTokenAddress);
  const token = new Contract(erc20Abi, configuredTokenAddress, owner);

  const members = loadSmokeMembers(provider);
  if (members.length < participantCount) {
    throw new Error(
      `Not enough smoke member accounts. Need ${participantCount}, found ${members.length}. Set TEST_ACCOUNT_i or SMOKE_MEMBER_i env vars.`
    );
  }

  const selectedMembers = members.slice(0, participantCount);
  const memberTxs = [];

  // Conservative approval value: enough for collateral + one payment.
  const approvalAmount = monthlyContribution * BigInt(participantCount) * 3n;

  console.log("\n👥 Joining members...");
  for (let i = 0; i < selectedMembers.length; i++) {
    const member = selectedMembers[i];
    const label = `member_${i + 1}`;

    await ensureTokenBalance(token, member.address, approvalAmount, label);

    const tokenForMember = new Contract(erc20Abi, configuredTokenAddress, member);

    const approveCollateralTx = await invokeAndWait(
      provider,
      member,
      tokenForMember,
      "approve",
      [collateralAddress, approvalAmount],
      network
    );

    const approvePaymentsTx = await invokeAndWait(
      provider,
      member,
      tokenForMember,
      "approve",
      [paymentsAddress, approvalAmount],
      network
    );

    const coreForMember = new Contract(coreAbi, coreAddress, member);
    const joinTx = await invokeAndWait(
      provider,
      member,
      coreForMember,
      "join_ajo",
      [1],
      network
    );

    memberTxs.push({
      member: member.address,
      approveCollateralTx,
      approvePaymentsTx,
      joinTx,
    });
  }

  txs.start_ajo = await invokeAndWait(provider, owner, core, "start_ajo", [], network);

  console.log("\n💸 Processing first cycle payments...");
  const paymentTxs = [];
  for (let i = 0; i < selectedMembers.length; i++) {
    const member = selectedMembers[i];
    const coreForMember = new Contract(coreAbi, coreAddress, member);
    const paymentTx = await invokeAndWait(
      provider,
      member,
      coreForMember,
      "process_payment",
      [],
      network
    );
    paymentTxs.push({ member: member.address, paymentTx });
  }

  const currentCycle = toU256BigInt(await core.get_current_cycle());
  if (currentCycle < 2n) {
    throw new Error(`Cycle did not advance after full payment round. current_cycle=${currentCycle.toString()}`);
  }

  const firstMemberInfo = await core.get_member_info(selectedMembers[0].address);

  const report = {
    timestamp: new Date().toISOString(),
    status: "PASS",
    network,
    rpcUrl,
    factoryAddress,
    btcTokenAddress: configuredTokenAddress,
    ajoId: ajoId.toString(),
    ajoAddresses: {
      core: coreAddress,
      members: ajoInfo.members_address,
      collateral: collateralAddress,
      payments: paymentsAddress,
      governance: ajoInfo.governance_address,
      schedule: ajoInfo.schedule_address,
    },
    configuration: {
      participantCount,
      monthlyContribution: monthlyContribution.toString(),
      cycleDuration,
      paymentToken: "BTC",
      btcTokenOverrideApplied: Boolean(btcTokenOverride),
    },
    transactions: {
      ...txs,
      members: memberTxs,
      payments: paymentTxs,
    },
    assertions: {
      ajoInitialized: Boolean(ajoInfo.is_initialized),
      cycleAdvancedTo: currentCycle.toString(),
      firstMemberHasReceivedPayout: Boolean(firstMemberInfo?.has_received_payout ?? false),
    },
  };

  fs.writeFileSync(SMOKE_REPORT_PATH, JSON.stringify(report, null, 2));

  console.log("\n✅ Deployed smoke test passed");
  console.log(`📄 Report: ${SMOKE_REPORT_PATH}`);
}

main().catch((error) => {
  const report = {
    timestamp: new Date().toISOString(),
    status: "FAIL",
    error: parseError(error),
  };

  try {
    fs.writeFileSync(SMOKE_REPORT_PATH, JSON.stringify(report, null, 2));
  } catch {
    // best effort report write
  }

  console.error("\n❌ Deployed smoke test failed");
  console.error(parseError(error));
  console.error("\nActionable checks:");
  console.error("1) Ensure deployment_info.json exists and points to the target network.");
  console.error("2) Ensure deployer + TEST_ACCOUNT_i keys are configured and funded.");
  console.error("3) Ensure BTC token address is a usable ERC20 test token and members hold balances.");
  process.exit(1);
});
