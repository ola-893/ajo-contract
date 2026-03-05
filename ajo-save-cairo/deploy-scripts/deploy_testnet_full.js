import { RpcProvider, Account, Contract, CallData, hash, json } from "starknet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.resolve(PROJECT_ROOT, "target/dev");
const ABIS_DIR = path.resolve(PROJECT_ROOT, "starknet-scripts/abis");
const ARTIFACTS_DIR = path.resolve(PROJECT_ROOT, "deployment_artifacts");
const ABI_OUTPUT_DIR = path.resolve(ARTIFACTS_DIR, "abis");

const CLASS_FILES = {
  AjoCore: "ajo_save_AjoCore.contract_class.json",
  AjoMembers: "ajo_save_AjoMembers.contract_class.json",
  AjoCollateral: "ajo_save_AjoCollateral.contract_class.json",
  AjoPayments: "ajo_save_AjoPayments.contract_class.json",
  AjoGovernance: "ajo_save_AjoGovernance.contract_class.json",
  AjoSchedule: "ajo_save_AjoSchedule.contract_class.json",
  BridgeAdapter: "ajo_save_BridgeAdapter.contract_class.json",
  SwapRouter: "ajo_save_SwapRouter.contract_class.json",
  BTCCollateralAdapter: "ajo_save_BTCCollateralAdapter.contract_class.json",
  AjoFactory: "ajo_save_AjoFactory.contract_class.json",
};

const FACTORY_CLASS_KEYS = [
  "AjoCore",
  "AjoMembers",
  "AjoCollateral",
  "AjoPayments",
  "AjoGovernance",
  "AjoSchedule",
];

const FACTORY_ABI_PATH = path.resolve(ABIS_DIR, "factory.json");
const DEFAULT_MAX_FEE = BigInt(process.env.STARKNET_MAX_FEE ?? "300000000000000");

function nowIso() {
  return new Date().toISOString();
}

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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isHexZero(value) {
  if (!value) return true;
  try {
    return BigInt(value) === 0n;
  } catch {
    return false;
  }
}

function assertNonZeroHex(label, value) {
  if (isHexZero(value)) {
    throw new Error(`${label} resolved to zero. Check artifact or constructor data.`);
  }
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadContractClass(className) {
  const file = CLASS_FILES[className];
  if (!file) {
    throw new Error(`Unknown class file mapping for ${className}`);
  }

  const sierraPath = path.join(TARGET_DIR, file);
  if (!fs.existsSync(sierraPath)) {
    throw new Error(`Missing contract class artifact for ${className}: ${sierraPath}`);
  }

  const casmFile = file.replace(".contract_class.json", ".compiled_contract_class.json");
  const casmPath = path.join(TARGET_DIR, casmFile);
  if (!fs.existsSync(casmPath)) {
    throw new Error(`Missing compiled contract artifact for ${className}: ${casmPath}`);
  }

  const contractClass = json.parse(fs.readFileSync(sierraPath, "utf8"));
  const compiledClass = json.parse(fs.readFileSync(casmPath, "utf8"));
  return { sierraPath, casmPath, contractClass, compiledClass };
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

async function ensureDeclared(
  provider,
  account,
  className,
  contractClass,
  compiledClass,
  classHash,
  network
) {
  let alreadyDeclared = false;
  let declarationTx = null;

  try {
    await provider.getClassByHash(classHash);
    alreadyDeclared = true;
  } catch (error) {
    const message = parseError(error);
    if (!message.includes("Class hash not found")) {
      throw new Error(`Failed to check declaration status for ${className}: ${message}`);
    }
  }

  if (!alreadyDeclared) {
    let declared;
    try {
      declared = await account.declare({
        contract: contractClass,
        casm: compiledClass,
      }, {
        maxFee: DEFAULT_MAX_FEE,
      });
    } catch (error) {
      throw new Error(`Failed to declare ${className}: ${parseError(error)}`);
    }

    if (declared.transaction_hash) {
      declarationTx = declared.transaction_hash;
      try {
        await provider.waitForTransaction(declarationTx);
      } catch (error) {
        throw new Error(
          `Declaration tx failed for ${className} (${declarationTx}): ${parseError(error)}`
        );
      }

      console.log(`   ↳ ${className} declaration tx: ${declarationTx}`);
      console.log(`   ↳ Explorer: ${explorerTx(network, declarationTx)}`);
    }
  }

  return { classHash, alreadyDeclared, declarationTx };
}

async function deployContract(provider, account, className, classHash, constructorCalldata, network) {
  let deployResponse;
  try {
    deployResponse = await account.deployContract({
      classHash,
      constructorCalldata,
    }, {
      maxFee: DEFAULT_MAX_FEE,
    });
  } catch (error) {
    throw new Error(`Failed to submit deployment for ${className}: ${parseError(error)}`);
  }

  try {
    await provider.waitForTransaction(deployResponse.transaction_hash);
  } catch (error) {
    throw new Error(
      `Deployment tx failed for ${className} (${deployResponse.transaction_hash}): ${parseError(error)}`
    );
  }

  const deployedAddress = deployResponse.contract_address;
  assertNonZeroHex(`${className} deployed address`, deployedAddress);

  console.log(`✅ Deployed ${className}: ${deployedAddress}`);
  console.log(`   ↳ tx: ${deployResponse.transaction_hash}`);
  console.log(`   ↳ tx explorer: ${explorerTx(network, deployResponse.transaction_hash)}`);
  console.log(`   ↳ contract explorer: ${explorerContract(network, deployedAddress)}`);

  return {
    contractAddress: deployedAddress,
    transactionHash: deployResponse.transaction_hash,
  };
}

async function executeFactoryCall(provider, account, factory, method, args, network) {
  let tx;
  try {
    const call = factory.populate(method, args);
    tx = await account.execute(call, {
      maxFee: DEFAULT_MAX_FEE,
    });
  } catch (error) {
    throw new Error(`Failed to submit factory.${method}: ${parseError(error)}`);
  }

  try {
    await provider.waitForTransaction(tx.transaction_hash);
  } catch (error) {
    throw new Error(
      `Factory call failed ${method} (${tx.transaction_hash}): ${parseError(error)}`
    );
  }

  console.log(`✅ factory.${method} tx: ${tx.transaction_hash}`);
  console.log(`   ↳ Explorer: ${explorerTx(network, tx.transaction_hash)}`);
  return tx.transaction_hash;
}

function writeAbiArtifacts(classArtifacts) {
  ensureDir(ABI_OUTPUT_DIR);

  const abiPaths = {};
  for (const [name, artifact] of Object.entries(classArtifacts)) {
    const abi = artifact.contractClass?.abi;
    if (!abi) continue;

    const outPath = path.resolve(ABI_OUTPUT_DIR, `${name}.abi.json`);
    fs.writeFileSync(outPath, JSON.stringify(abi, null, 2));
    abiPaths[name] = outPath;
  }

  return abiPaths;
}

function validateComputedClassHashes(classHashes) {
  for (const [name, classHashValue] of Object.entries(classHashes)) {
    assertNonZeroHex(`${name} class hash`, classHashValue);
  }

  for (const classKey of FACTORY_CLASS_KEYS) {
    if (!classHashes[classKey]) {
      throw new Error(`Missing required class hash entry for Factory constructor: ${classKey}`);
    }
    assertNonZeroHex(`Factory required class hash ${classKey}`, classHashes[classKey]);
  }
}

async function main() {
  const network = optionalEnv("STARKNET_NETWORK", "sepolia");
  const rpcUrl = requiredEnv("STARKNET_RPC");
  const accountAddress = requiredEnv("STARKNET_ACCOUNT_ADDRESS");
  const privateKey = requiredEnv("STARKNET_PRIVATE_KEY");
  const ownerAddress = optionalEnv("OWNER_ADDRESS", accountAddress);
  const bridgeRelayer = optionalEnv("BRIDGE_RELAYER_ADDRESS", ownerAddress);
  const opCatVerifier = optionalEnv("OP_CAT_VERIFIER_ADDRESS", ownerAddress);
  const usdcTokenAddress = optionalEnv("USDC_TOKEN_ADDRESS", null);
  const btcTokenAddress = optionalEnv("BTC_TOKEN_ADDRESS", null);

  console.log("\n🚀 AJO Starknet deployment (Sepolia/Mainnet-compatible)");
  console.log(`📅 Started: ${nowIso()}`);
  console.log(`🌐 Network: ${network}`);
  console.log(`📡 RPC: ${rpcUrl}`);
  console.log(`👤 Deployer: ${accountAddress}`);
  console.log(`👑 Owner: ${ownerAddress}\n`);

  if (!fs.existsSync(FACTORY_ABI_PATH)) {
    throw new Error(`Missing Factory ABI file: ${FACTORY_ABI_PATH}`);
  }

  ensureDir(ARTIFACTS_DIR);

  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const account = new Account(provider, accountAddress, privateKey);

  const classArtifacts = {};
  const classHashes = {};
  const compiledClassHashes = {};
  const declarationDetails = {};

  console.log("📦 Loading class artifacts and computing hashes...");
  for (const className of Object.keys(CLASS_FILES)) {
    const artifact = loadContractClass(className);
    const classHash = hash.computeContractClassHash(artifact.contractClass);
    const compiledClassHash = hash.computeCompiledClassHash(artifact.compiledClass);
    classArtifacts[className] = artifact;
    classHashes[className] = classHash;
    compiledClassHashes[className] = compiledClassHash;
    assertNonZeroHex(`${className} class hash`, classHash);
    assertNonZeroHex(`${className} compiled class hash`, compiledClassHash);
    console.log(`   • ${className}: ${classHash}`);
  }

  console.log("\n🔐 Validating required class hashes...");
  validateComputedClassHashes(classHashes);

  console.log("\n📝 Declaring classes (if needed)...");
  for (const [className, artifact] of Object.entries(classArtifacts)) {
    const declaration = await ensureDeclared(
      provider,
      account,
      className,
      artifact.contractClass,
      artifact.compiledClass,
      classHashes[className],
      network
    );
    declarationDetails[className] = declaration;

    if (declaration.alreadyDeclared) {
      console.log(`✅ ${className} already declared (${classHashes[className]})`);
    } else {
      console.log(`✅ ${className} declared (${classHashes[className]})`);
    }
  }

  const declaredHashesPath = path.resolve(PROJECT_ROOT, "declared_class_hashes.json");
  fs.writeFileSync(declaredHashesPath, JSON.stringify(classHashes, null, 2));
  console.log(`\n💾 Wrote class hashes: ${declaredHashesPath}`);

  const abiPaths = writeAbiArtifacts(classArtifacts);
  console.log(`💾 Wrote ABI artifacts: ${ABI_OUTPUT_DIR}`);

  const factoryAbi = loadJson(FACTORY_ABI_PATH);

  console.log("\n🏗️ Deploying Factory...");
  const factoryConstructor = CallData.compile([
    ownerAddress,
    classHashes.AjoCore,
    classHashes.AjoMembers,
    classHashes.AjoCollateral,
    classHashes.AjoPayments,
    classHashes.AjoGovernance,
    classHashes.AjoSchedule,
  ]);

  const factoryDeployment = await deployContract(
    provider,
    account,
    "AjoFactory",
    classHashes.AjoFactory,
    factoryConstructor,
    network
  );

  const factory = new Contract(factoryAbi, factoryDeployment.contractAddress, account);

  console.log("\n⚙️ Setting Factory class hashes...");
  const classHashSetterTxs = {};
  const setterMap = [
    ["set_core_class_hash", classHashes.AjoCore],
    ["set_members_class_hash", classHashes.AjoMembers],
    ["set_collateral_class_hash", classHashes.AjoCollateral],
    ["set_payments_class_hash", classHashes.AjoPayments],
    ["set_governance_class_hash", classHashes.AjoGovernance],
    ["set_schedule_class_hash", classHashes.AjoSchedule],
  ];

  for (const [method, value] of setterMap) {
    classHashSetterTxs[method] = await executeFactoryCall(
      provider,
      account,
      factory,
      method,
      [value],
      network
    );
  }

  const tokenConfigTxs = {};
  if (usdcTokenAddress) {
    assertNonZeroHex("USDC token address", usdcTokenAddress);
    tokenConfigTxs.set_usdc_token_address = await executeFactoryCall(
      provider,
      account,
      factory,
      "set_usdc_token_address",
      [usdcTokenAddress],
      network
    );
  }

  if (btcTokenAddress) {
    assertNonZeroHex("BTC token address", btcTokenAddress);
    tokenConfigTxs.set_btc_token_address = await executeFactoryCall(
      provider,
      account,
      factory,
      "set_btc_token_address",
      [btcTokenAddress],
      network
    );
  }

  console.log("\n🔌 Deploying adapters...");
  const bridgeAdapterDeployment = await deployContract(
    provider,
    account,
    "BridgeAdapter",
    classHashes.BridgeAdapter,
    CallData.compile([ownerAddress, bridgeRelayer]),
    network
  );

  const swapRouterDeployment = await deployContract(
    provider,
    account,
    "SwapRouter",
    classHashes.SwapRouter,
    CallData.compile([ownerAddress]),
    network
  );

  const btcCollateralAdapterDeployment = await deployContract(
    provider,
    account,
    "BTCCollateralAdapter",
    classHashes.BTCCollateralAdapter,
    CallData.compile([ownerAddress, opCatVerifier]),
    network
  );

  const deploymentInfo = {
    network,
    rpcUrl,
    timestamp: nowIso(),
    deployer: accountAddress,
    owner: ownerAddress,
    bridgeRelayer,
    opCatVerifier,
    classHashes,
    compiledClassHashes,
    declarationDetails,
    contracts: {
      factory: factoryDeployment.contractAddress,
      bridgeAdapter: bridgeAdapterDeployment.contractAddress,
      swapRouter: swapRouterDeployment.contractAddress,
      btcCollateralAdapter: btcCollateralAdapterDeployment.contractAddress,
    },
    transactions: {
      factoryDeploy: factoryDeployment.transactionHash,
      classHashSetters: classHashSetterTxs,
      tokenConfiguration: tokenConfigTxs,
      bridgeAdapterDeploy: bridgeAdapterDeployment.transactionHash,
      swapRouterDeploy: swapRouterDeployment.transactionHash,
      btcCollateralAdapterDeploy: btcCollateralAdapterDeployment.transactionHash,
    },
    explorer: {
      factory: explorerContract(network, factoryDeployment.contractAddress),
      bridgeAdapter: explorerContract(network, bridgeAdapterDeployment.contractAddress),
      swapRouter: explorerContract(network, swapRouterDeployment.contractAddress),
      btcCollateralAdapter: explorerContract(network, btcCollateralAdapterDeployment.contractAddress),
      factoryDeployTx: explorerTx(network, factoryDeployment.transactionHash),
      bridgeAdapterDeployTx: explorerTx(network, bridgeAdapterDeployment.transactionHash),
      swapRouterDeployTx: explorerTx(network, swapRouterDeployment.transactionHash),
      btcCollateralAdapterDeployTx: explorerTx(network, btcCollateralAdapterDeployment.transactionHash),
    },
    artifacts: {
      declaredClassHashesPath: declaredHashesPath,
      factoryAbiPath: FACTORY_ABI_PATH,
      extractedAbiPaths: abiPaths,
    },
    notes: [
      "Factory does not persist adapter addresses globally; adapters are configured per Ajo via AjoCore setters.",
      "Run verify_deployment.js after deployment to validate factory and module deployment flow.",
    ],
  };

  const deploymentInfoPath = path.resolve(PROJECT_ROOT, "deployment_info.json");
  fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment artifacts:");
  console.log(`   • ${declaredHashesPath}`);
  console.log(`   • ${deploymentInfoPath}`);
  console.log(`   • ABI directory: ${ABI_OUTPUT_DIR}`);

  console.log("\n🎉 Deployment complete");
  console.log(`   Factory: ${deploymentInfo.contracts.factory}`);
  console.log(`   Explorer: ${deploymentInfo.explorer.factory}`);
}

main().catch((error) => {
  console.error("\n❌ Deployment failed");
  console.error(parseError(error));
  console.error("\nActionable checks:");
  console.error("1) Ensure STARKNET_RPC, STARKNET_ACCOUNT_ADDRESS, STARKNET_PRIVATE_KEY are set.");
  console.error("2) Run `scarb build` to refresh contract artifacts in target/dev.");
  console.error("3) Confirm deployer account has enough ETH/STRK for declare + deploy txs.");
  console.error("4) Re-run with DEBUG logs by exporting DEBUG=true if needed.");
  process.exit(1);
});
