import { RpcProvider, Account, Contract, CairoCustomEnum } from "starknet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ABIS_DIR = path.resolve(PROJECT_ROOT, "starknet-scripts/abis");

const FACTORY_ABI_PATH = path.resolve(ABIS_DIR, "factory.json");
const DECLARED_HASHES_PATH = path.resolve(PROJECT_ROOT, "declared_class_hashes.json");
const DEPLOYMENT_INFO_PATH = path.resolve(PROJECT_ROOT, "deployment_info.json");
const VERIFICATION_REPORT_PATH = path.resolve(PROJECT_ROOT, "verification_report.json");
const DEFAULT_MAX_FEE = BigInt(process.env.STARKNET_MAX_FEE ?? "300000000000000");

const REQUIRED_CLASS_KEYS = [
  "AjoCore",
  "AjoMembers",
  "AjoCollateral",
  "AjoPayments",
  "AjoGovernance",
  "AjoSchedule",
  "BridgeAdapter",
  "SwapRouter",
  "BTCCollateralAdapter",
  "AjoFactory",
];

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

function shortString(name) {
  const normalized = String(name).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  return normalized.length > 0 ? normalized : "Verify";
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

function normalizePaymentToken(token) {
  const value = String(token ?? "USDC").toUpperCase();
  return value === "BTC"
    ? new CairoCustomEnum({ BTC: {} })
    : new CairoCustomEnum({ USDC: {} });
}

async function waitForInvoke(provider, account, contract, method, args, network) {
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

  console.log(`✅ ${method} tx: ${tx.transaction_hash}`);
  console.log(`   ↳ ${explorerTx(network, tx.transaction_hash)}`);
  return tx.transaction_hash;
}

async function assertClassExists(provider, className, classHash) {
  if (!classHash || isHexZero(classHash)) {
    throw new Error(`${className} has invalid class hash: ${classHash}`);
  }

  try {
    await provider.getClassByHash(classHash);
  } catch (error) {
    throw new Error(`Class not found on network for ${className} (${classHash}): ${parseError(error)}`);
  }
}

async function assertContractExists(provider, label, address) {
  assertNonZeroAddress(label, address);

  try {
    if (typeof provider.getClassHashAt === "function") {
      await provider.getClassHashAt(address);
      return;
    }

    await provider.getClassAt(address);
  } catch (error) {
    throw new Error(`Contract not accessible for ${label} (${address}): ${parseError(error)}`);
  }
}

async function main() {
  const network = optionalEnv("STARKNET_NETWORK", "sepolia");
  const rpcUrl = requiredEnv("STARKNET_RPC");
  const accountAddress = requiredEnv("STARKNET_ACCOUNT_ADDRESS");
  const privateKey = requiredEnv("STARKNET_PRIVATE_KEY");
  const smokeToken = normalizePaymentToken(optionalEnv("VERIFY_PAYMENT_TOKEN", "USDC"));

  console.log("\n🔎 Verifying AJO deployment");
  console.log(`🌐 Network: ${network}`);
  console.log(`📡 RPC: ${rpcUrl}`);

  const declaredHashes = loadJson(DECLARED_HASHES_PATH, "declared_class_hashes.json");
  const deploymentInfo = loadJson(DEPLOYMENT_INFO_PATH, "deployment_info.json");
  const factoryAbi = loadJson(FACTORY_ABI_PATH, "factory ABI");

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(provider, accountAddress, privateKey);

  const classVerification = {};
  console.log("\n1) Verifying declared class hashes are present on network...");
  for (const key of REQUIRED_CLASS_KEYS) {
    const hashFromDeployment = deploymentInfo?.classHashes?.[key];
    const hashFromFile = declaredHashes?.[key];

    if (!hashFromDeployment) {
      throw new Error(`Missing class hash in deployment_info for ${key}`);
    }

    if (hashFromFile && hashFromFile !== hashFromDeployment) {
      throw new Error(
        `Class hash mismatch for ${key}: deployment_info=${hashFromDeployment} declared_class_hashes=${hashFromFile}`
      );
    }

    await assertClassExists(provider, key, hashFromDeployment);
    classVerification[key] = {
      classHash: hashFromDeployment,
      verified: true,
    };
    console.log(`✅ ${key}: ${hashFromDeployment}`);
  }

  const contracts = deploymentInfo?.contracts ?? {};

  console.log("\n2) Verifying deployed contract addresses are accessible...");
  await assertContractExists(provider, "Factory", contracts.factory);
  await assertContractExists(provider, "BridgeAdapter", contracts.bridgeAdapter);
  await assertContractExists(provider, "SwapRouter", contracts.swapRouter);
  await assertContractExists(provider, "BTCCollateralAdapter", contracts.btcCollateralAdapter);

  console.log(`✅ Factory: ${contracts.factory}`);
  console.log(`✅ BridgeAdapter: ${contracts.bridgeAdapter}`);
  console.log(`✅ SwapRouter: ${contracts.swapRouter}`);
  console.log(`✅ BTCCollateralAdapter: ${contracts.btcCollateralAdapter}`);

  console.log("\n3) Verifying Factory can create and initialize an Ajo...");
  const factory = new Contract(factoryAbi, contracts.factory, account);

  const beforeTotal = Number(await factory.get_total_ajos());
  const smokeName = shortString(`Verify_${Date.now()}`);

  const txCreateAjo = await waitForInvoke(
    provider,
    account,
    factory,
    "create_ajo_and_initialize",
    [
      smokeName,
      BigInt(optionalEnv("VERIFY_MONTHLY_CONTRIBUTION", "1000")),
      BigInt(optionalEnv("VERIFY_TOTAL_PARTICIPANTS", "3")),
      Number(optionalEnv("VERIFY_CYCLE_DURATION", "86400")),
      smokeToken,
    ],
    network
  );

  const afterTotal = Number(await factory.get_total_ajos());
  if (afterTotal !== beforeTotal + 1) {
    throw new Error(
      `Factory total Ajos did not increment correctly. before=${beforeTotal}, after=${afterTotal}`
    );
  }

  const ajoId = BigInt(afterTotal);

  const ajoInfo = await factory.get_ajo_info(ajoId);
  const moduleAddresses = {
    core: ajoInfo.core_address,
    members: ajoInfo.members_address,
    collateral: ajoInfo.collateral_address,
    payments: ajoInfo.payments_address,
    governance: ajoInfo.governance_address,
    schedule: ajoInfo.schedule_address,
  };

  for (const [label, address] of Object.entries(moduleAddresses)) {
    assertNonZeroAddress(`Ajo ${label} address`, address);
  }

  if (!ajoInfo.is_initialized) {
    throw new Error("Ajo did not reach initialized state after atomic deployment");
  }

  console.log(`✅ Smoke Ajo created and initialized (ID: ${ajoId.toString()})`);

  const report = {
    timestamp: new Date().toISOString(),
    network,
    rpcUrl,
    deployer: accountAddress,
    status: "PASS",
    classVerification,
    contracts: {
      ...contracts,
      explorers: {
        factory: explorerContract(network, contracts.factory),
        bridgeAdapter: explorerContract(network, contracts.bridgeAdapter),
        swapRouter: explorerContract(network, contracts.swapRouter),
        btcCollateralAdapter: explorerContract(network, contracts.btcCollateralAdapter),
      },
    },
    smokeTest: {
      ajoId: ajoId.toString(),
      transactions: {
        createAjo: txCreateAjo,
      },
      moduleAddresses,
      initialized: Boolean(ajoInfo.is_initialized),
      paymentToken: Object.keys(smokeToken)[0],
    },
  };

  fs.writeFileSync(VERIFICATION_REPORT_PATH, JSON.stringify(report, null, 2));

  console.log("\n📄 Verification report written:");
  console.log(`   ${VERIFICATION_REPORT_PATH}`);
  console.log("\n🎉 Verification PASSED");
}

main().catch((error) => {
  console.error("\n❌ Verification failed");
  console.error(parseError(error));
  console.error("\nActionable checks:");
  console.error("1) Ensure deployment_info.json and declared_class_hashes.json exist.");
  console.error("2) Ensure the same network/RPC from deployment is configured.");
  console.error("3) Ensure deployer account still has funds for smoke invoke transactions.");
  process.exit(1);
});
