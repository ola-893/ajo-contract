import { RpcProvider, Account, Contract, CairoCustomEnum } from "starknet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ABIS_DIR = path.resolve(PROJECT_ROOT, "starknet-scripts/abis");

const DEPLOYMENT_INFO_PATH = path.resolve(PROJECT_ROOT, "deployment_info.json");
const BTC_FLOW_REPORT_PATH = path.resolve(PROJECT_ROOT, "btc_track_report.json");
const DEFAULT_MAX_FEE = BigInt(process.env.STARKNET_MAX_FEE ?? "300000000000000");

const FACTORY_ABI_PATH = path.resolve(ABIS_DIR, "factory.json");
const CORE_ABI_PATH = path.resolve(ABIS_DIR, "core.json");
const MEMBERS_ABI_PATH = path.resolve(ABIS_DIR, "members.json");
const COLLATERAL_ABI_PATH = path.resolve(ABIS_DIR, "collateral.json");
const PAYMENTS_ABI_PATH = path.resolve(ABIS_DIR, "payments.json");
const BRIDGE_ABI_PATH = path.resolve(ABIS_DIR, "bridgeAdapter.json");
const SWAP_ABI_PATH = path.resolve(ABIS_DIR, "swapRouter.json");
const BTC_ADAPTER_ABI_PATH = path.resolve(ABIS_DIR, "btcCollateralAdapter.json");
const ERC20_ABI_PATH = path.resolve(ABIS_DIR, "erc20.json");

function parseError(error) {
  return String(error?.message ?? error?.stack ?? error);
}

function nowIso() {
  return new Date().toISOString();
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

function toBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value !== 0n;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value !== "0" && value !== "false";
  if (value && typeof value === "object" && "toString" in value) {
    return String(value) !== "0";
  }
  return Boolean(value);
}

function enumVariantName(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("activeVariant" in value) return String(value.activeVariant());
    const keys = Object.keys(value).filter((k) => !k.startsWith("_"));
    if (keys.length > 0) return keys[0];
  }
  return String(value);
}

function shortStringFelt(label) {
  const normalized = String(label).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 31);
  const candidate = normalized.length > 0 ? normalized : "BTCAjo";
  return `0x${Buffer.from(candidate, "ascii").toString("hex")}`;
}

function explorerTx(network, txHash) {
  if (network === "mainnet") {
    return `https://voyager.online/tx/${txHash}`;
  }
  return `https://sepolia.voyager.online/tx/${txHash}`;
}

function explorerContract(network, address) {
  if (network === "mainnet") {
    return `https://voyager.online/contract/${address}`;
  }
  return `https://sepolia.voyager.online/contract/${address}`;
}

async function invokeAndWait(provider, account, contract, method, args, network) {
  let tx;
  try {
    const call = contract.populate(method, args);
    tx = await account.execute(call, { maxFee: DEFAULT_MAX_FEE });
  } catch (error) {
    throw new Error(`Failed to submit ${method}: ${parseError(error)}`);
  }

  try {
    await provider.waitForTransaction(tx.transaction_hash);
  } catch (error) {
    throw new Error(`Transaction failed for ${method} (${tx.transaction_hash}): ${parseError(error)}`);
  }

  let receipt = null;
  try {
    receipt = await provider.getTransactionReceipt(tx.transaction_hash);
  } catch {
    receipt = null;
  }

  console.log(`✅ ${method}: ${tx.transaction_hash}`);
  console.log(`   ↳ ${explorerTx(network, tx.transaction_hash)}`);
  return { txHash: tx.transaction_hash, receipt };
}

function normalizeAddress(address) {
  try {
    return `0x${BigInt(address).toString(16)}`.toLowerCase();
  } catch {
    return String(address || "").toLowerCase();
  }
}

function extractRequestIdFromReceipt(receipt, contractAddress) {
  if (!receipt?.events || !Array.isArray(receipt.events)) return null;
  const target = normalizeAddress(contractAddress);
  const event = receipt.events.find((e) => normalizeAddress(e.from_address) === target && e.data?.length > 0);
  if (!event) return null;
  try {
    return BigInt(event.data[0]);
  } catch {
    return null;
  }
}

async function main() {
  const network = optionalEnv("STARKNET_NETWORK", "sepolia");
  const rpcUrl = requiredEnv("STARKNET_RPC");
  const accountAddress = requiredEnv("STARKNET_ACCOUNT_ADDRESS");
  const privateKey = requiredEnv("STARKNET_PRIVATE_KEY");

  const monthlyContribution = BigInt(optionalEnv("FLOW_MONTHLY_CONTRIBUTION", "1000"));
  const totalParticipants = Number(optionalEnv("FLOW_TOTAL_PARTICIPANTS", "3"));
  const cycleDuration = Number(optionalEnv("FLOW_CYCLE_DURATION", "86400"));
  const bridgeAmount = BigInt(optionalEnv("FLOW_BRIDGE_AMOUNT", "1"));
  const swapAmount = BigInt(optionalEnv("FLOW_SWAP_AMOUNT", "1"));
  const demoBtcAddress = optionalEnv("FLOW_DEMO_BTC_ADDRESS", "0x6274635f616464725f64656d6f");
  const demoBtcTxHash = optionalEnv("FLOW_DEMO_BTC_TX_HASH", "0x6274635f74785f64656d6f");

  if (totalParticipants < 3) {
    throw new Error(`FLOW_TOTAL_PARTICIPANTS must be >= 3. received=${totalParticipants}`);
  }
  if (cycleDuration < 86400) {
    throw new Error(`FLOW_CYCLE_DURATION must be >= 86400. received=${cycleDuration}`);
  }

  const deploymentInfo = loadJson(DEPLOYMENT_INFO_PATH, "deployment_info.json");
  const factoryAbi = loadJson(FACTORY_ABI_PATH, "factory ABI");
  const coreAbi = loadJson(CORE_ABI_PATH, "core ABI");
  const membersAbi = loadJson(MEMBERS_ABI_PATH, "members ABI");
  const collateralAbi = loadJson(COLLATERAL_ABI_PATH, "collateral ABI");
  const paymentsAbi = loadJson(PAYMENTS_ABI_PATH, "payments ABI");
  const bridgeAbi = loadJson(BRIDGE_ABI_PATH, "bridge adapter ABI");
  const swapAbi = loadJson(SWAP_ABI_PATH, "swap router ABI");
  const btcAdapterAbi = loadJson(BTC_ADAPTER_ABI_PATH, "btc collateral adapter ABI");
  const erc20Abi = loadJson(ERC20_ABI_PATH, "erc20 ABI");

  const factoryAddress = deploymentInfo?.contracts?.factory;
  const bridgeAdapterAddress = deploymentInfo?.contracts?.bridgeAdapter;
  const swapRouterAddress = deploymentInfo?.contracts?.swapRouter;
  const btcCollateralAdapterAddress = deploymentInfo?.contracts?.btcCollateralAdapter;

  assertNonZeroAddress("Factory", factoryAddress);
  assertNonZeroAddress("Bridge adapter", bridgeAdapterAddress);
  assertNonZeroAddress("Swap router", swapRouterAddress);
  assertNonZeroAddress("BTC collateral adapter", btcCollateralAdapterAddress);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const owner = new Account(provider, accountAddress, privateKey);
  const factory = new Contract(factoryAbi, factoryAddress, owner);

  const report = {
    timestamp: nowIso(),
    network,
    rpcUrl,
    owner: accountAddress,
    contracts: {
      factory: factoryAddress,
      bridgeAdapter: bridgeAdapterAddress,
      swapRouter: swapRouterAddress,
      btcCollateralAdapter: btcCollateralAdapterAddress,
    },
    txs: {},
    checks: {},
    notes: [],
  };

  console.log("\n🧪 Running BTC track full flow");
  console.log(`🌐 Network: ${network}`);
  console.log(`🏭 Factory: ${factoryAddress}`);

  const beforeTotal = Number(await factory.get_total_ajos());
  const flowName = shortStringFelt(`BTCAjo_${Date.now()}`);
  report.checks.beforeTotalAjos = beforeTotal;

  report.txs.createAjo = (
    await invokeAndWait(
      provider,
      owner,
      factory,
      "create_ajo",
      [
        flowName,
        monthlyContribution,
        BigInt(totalParticipants),
        cycleDuration,
        new CairoCustomEnum({ BTC: {} }),
      ],
      network,
    )
  ).txHash;

  const afterTotal = Number(await factory.get_total_ajos());
  if (afterTotal !== beforeTotal + 1) {
    throw new Error(`Factory total Ajos did not increment correctly. before=${beforeTotal}, after=${afterTotal}`);
  }
  const ajoId = BigInt(afterTotal);
  report.checks.ajoId = ajoId.toString();
  report.checks.afterTotalAjos = afterTotal;

  report.txs.deployMembers = (
    await invokeAndWait(provider, owner, factory, "deploy_members", [ajoId], network)
  ).txHash;
  report.txs.deployCollateralPayments = (
    await invokeAndWait(provider, owner, factory, "deploy_collateral_and_payments", [ajoId], network)
  ).txHash;
  report.txs.deployGovernanceSchedule = (
    await invokeAndWait(provider, owner, factory, "deploy_governance_and_schedule", [ajoId], network)
  ).txHash;
  report.txs.deployCore = (
    await invokeAndWait(provider, owner, factory, "deploy_core", [ajoId], network)
  ).txHash;

  const ajoInfo = await factory.get_ajo_info(ajoId);
  const coreAddress = ajoInfo.core_address;
  const membersAddress = ajoInfo.members_address;
  const collateralAddress = ajoInfo.collateral_address;
  const paymentsAddress = ajoInfo.payments_address;

  assertNonZeroAddress("Core", coreAddress);
  assertNonZeroAddress("Members", membersAddress);
  assertNonZeroAddress("Collateral", collateralAddress);
  assertNonZeroAddress("Payments", paymentsAddress);

  report.contracts.core = coreAddress;
  report.contracts.members = membersAddress;
  report.contracts.collateral = collateralAddress;
  report.contracts.payments = paymentsAddress;

  const core = new Contract(coreAbi, coreAddress, owner);
  const members = new Contract(membersAbi, membersAddress, owner);
  const collateral = new Contract(collateralAbi, collateralAddress, owner);
  const payments = new Contract(paymentsAbi, paymentsAddress, owner);
  const bridge = new Contract(bridgeAbi, bridgeAdapterAddress, owner);
  const swap = new Contract(swapAbi, swapRouterAddress, owner);
  const btcAdapter = new Contract(btcAdapterAbi, btcCollateralAdapterAddress, owner);

  report.txs.bridgeSetAuthorizedCore = (
    await invokeAndWait(provider, owner, bridge, "set_authorized_core", [coreAddress], network)
  ).txHash;
  report.txs.bridgeSetRelayer = (
    await invokeAndWait(provider, owner, bridge, "set_bridge_relayer", [accountAddress], network)
  ).txHash;
  report.txs.btcSetAuthorizedCore = (
    await invokeAndWait(provider, owner, btcAdapter, "set_authorized_core", [coreAddress], network)
  ).txHash;
  report.txs.swapSetAuthorizedExecutor = (
    await invokeAndWait(provider, owner, swap, "set_authorized_executor", [paymentsAddress], network)
  ).txHash;

  report.txs.coreSetBridgeAdapter = (
    await invokeAndWait(provider, owner, core, "set_bridge_adapter", [bridgeAdapterAddress], network)
  ).txHash;
  report.txs.coreEnableBridge = (
    await invokeAndWait(provider, owner, core, "enable_bridge", [], network)
  ).txHash;
  report.txs.coreSetSwapRouter = (
    await invokeAndWait(provider, owner, core, "set_swap_router", [swapRouterAddress], network)
  ).txHash;
  report.txs.coreEnableSwap = (
    await invokeAndWait(provider, owner, core, "enable_swap", [], network)
  ).txHash;
  report.txs.coreSetBtcAdapter = (
    await invokeAndWait(provider, owner, core, "set_btc_collateral_adapter", [btcCollateralAdapterAddress], network)
  ).txHash;
  report.txs.coreSetCollateralMode = (
    await invokeAndWait(
      provider,
      owner,
      core,
      "set_collateral_mode",
      [new CairoCustomEnum({ BTCCommitment: {} })],
      network,
    )
  ).txHash;
  report.txs.coreEnableBtcCommitment = (
    await invokeAndWait(provider, owner, core, "enable_btc_commitment", [], network)
  ).txHash;

  const bridgeEnabled = toBool(await core.is_bridge_enabled());
  const swapEnabled = toBool(await core.is_swap_enabled());
  const btcEnabled = toBool(await core.is_btc_commitment_enabled());
  const mode = enumVariantName(await core.get_collateral_mode());
  if (!bridgeEnabled || !swapEnabled || !btcEnabled || mode !== "BTCCommitment") {
    throw new Error(
      `Feature enablement mismatch: bridge=${bridgeEnabled} swap=${swapEnabled} btc=${btcEnabled} mode=${mode}`,
    );
  }
  report.checks.features = { bridgeEnabled, swapEnabled, btcEnabled, collateralMode: mode };

  const paymentTokenAddress = await core.get_payment_token_address();
  assertNonZeroAddress("Payment token", paymentTokenAddress);
  report.contracts.paymentToken = paymentTokenAddress;

  const token = new Contract(erc20Abi, paymentTokenAddress, owner);
  const ownerBalance = toU256BigInt(await token.balance_of(accountAddress));
  report.checks.ownerTokenBalance = ownerBalance.toString();

  if (ownerBalance >= bridgeAmount && bridgeAmount > 0n) {
    const withdrawal = await invokeAndWait(
      provider,
      owner,
      bridge,
      "request_withdrawal",
      [ajoId, bridgeAmount, demoBtcAddress],
      network,
    );
    report.txs.bridgeRequestWithdrawal = withdrawal.txHash;

    const requestId = extractRequestIdFromReceipt(withdrawal.receipt, bridgeAdapterAddress);
    if (requestId !== null) {
      report.checks.bridgeRequestId = requestId.toString();
      report.txs.bridgeFinalizeWithdrawal = (
        await invokeAndWait(
          provider,
          owner,
          bridge,
          "finalize_withdrawal",
          [requestId, demoBtcTxHash],
          network,
        )
      ).txHash;
      report.checks.bridgeRequestStatus = enumVariantName(await bridge.get_request_status(requestId));
    } else {
      report.notes.push("Bridge request_id could not be parsed from receipt; finalize step skipped.");
    }
  } else {
    report.notes.push("Bridge withdrawal demo skipped due insufficient token balance.");
  }

  if (ownerBalance >= swapAmount && swapAmount > 0n) {
    report.txs.swapSetAuthorizedExecutorOwner = (
      await invokeAndWait(provider, owner, swap, "set_authorized_executor", [accountAddress], network)
    ).txHash;

    report.txs.swapApprove = (
      await invokeAndWait(provider, owner, token, "approve", [swapRouterAddress, swapAmount], network)
    ).txHash;

    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const swapExecution = await invokeAndWait(
      provider,
      owner,
      swap,
      "execute_swap",
      [
        ajoId,
        accountAddress,
        paymentTokenAddress,
        paymentTokenAddress,
        swapAmount,
        swapAmount,
        deadline,
      ],
      network,
    );
    report.txs.swapExecute = swapExecution.txHash;

    const swapRequestId = extractRequestIdFromReceipt(swapExecution.receipt, swapRouterAddress);
    if (swapRequestId !== null) {
      report.checks.swapRequestId = swapRequestId.toString();
      report.checks.swapStatus = enumVariantName(await swap.get_swap_status(swapRequestId));
    } else {
      report.notes.push("Swap request_id could not be parsed from receipt.");
    }

    report.txs.swapRestoreExecutor = (
      await invokeAndWait(provider, owner, swap, "set_authorized_executor", [paymentsAddress], network)
    ).txHash;
  } else {
    report.notes.push("Atomic swap demo skipped due insufficient token balance.");
  }

  const requiredCollateral = toU256BigInt(
    await collateral.calculate_required_collateral(1n, monthlyContribution, BigInt(totalParticipants)),
  );
  report.checks.requiredCollateralForPosition1 = requiredCollateral.toString();

  if (ownerBalance >= requiredCollateral && requiredCollateral > 0n) {
    report.txs.approveCollateral = (
      await invokeAndWait(provider, owner, token, "approve", [collateralAddress, requiredCollateral], network)
    ).txHash;
    report.txs.approvePayments = (
      await invokeAndWait(provider, owner, token, "approve", [paymentsAddress, requiredCollateral], network)
    ).txHash;
    report.txs.joinAjo = (
      await invokeAndWait(provider, owner, core, "join_ajo", [1n], network)
    ).txHash;

    const totalMembers = toU256BigInt(await members.get_total_members());
    const commitmentId = toU256BigInt(await btcAdapter.get_member_commitment(accountAddress));
    report.checks.totalMembersAfterJoin = totalMembers.toString();
    report.checks.ownerCommitmentId = commitmentId.toString();

    if (commitmentId === 0n) {
      throw new Error("BTC commitment was not created during join in BTCCommitment mode.");
    }
    report.checks.ownerCommitmentStatus = enumVariantName(await btcAdapter.get_commitment_status(commitmentId));
  } else {
    report.notes.push(
      `Join + OP_CAT commitment demo skipped (required collateral=${requiredCollateral}, balance=${ownerBalance}).`,
    );
  }

  report.explorer = {
    factory: explorerContract(network, factoryAddress),
    core: explorerContract(network, coreAddress),
    members: explorerContract(network, membersAddress),
    collateral: explorerContract(network, collateralAddress),
    payments: explorerContract(network, paymentsAddress),
    bridgeAdapter: explorerContract(network, bridgeAdapterAddress),
    swapRouter: explorerContract(network, swapRouterAddress),
    btcCollateralAdapter: explorerContract(network, btcCollateralAdapterAddress),
  };

  fs.writeFileSync(BTC_FLOW_REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n📄 BTC flow report: ${BTC_FLOW_REPORT_PATH}`);
  console.log("\n🎉 BTC track flow completed");
}

main().catch((error) => {
  console.error("\n❌ BTC track full flow failed");
  console.error(parseError(error));
  console.error("\nChecks:");
  console.error("1) Verify STARKNET_RPC, STARKNET_ACCOUNT_ADDRESS, STARKNET_PRIVATE_KEY are set.");
  console.error("2) Ensure deployment_info.json exists from deploy:sepolia.");
  console.error("3) Ensure account has enough token balance for optional bridge/swap/join demos.");
  process.exit(1);
});
