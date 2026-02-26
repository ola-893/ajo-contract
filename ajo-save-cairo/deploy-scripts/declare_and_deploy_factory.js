import { RpcProvider, Account, Contract, json, CallData, hash } from "starknet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  rpcUrl: "https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU",
  accountAddress: "0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8",
  privateKey: "0x05515ec9d8034acb3b2d1a89813337ae433bee5afd663dc9397968ffebe15228",
  contractClassPath: "../ajo-save-cairo/target/dev/ajo_save_AjoFactory.contract_class.json",
  constructorArgs: {
    owner: "0x0281e16a3f71b9c0cede19cee4375c24cbc328c08f8cc4d4757d04ffeb956ce8",
    core_class_hash: "0x037dabadaa0bc2d76d9ee400e865dec1ffbd17676bc55ef0b2313ff11f6f5812",
    members_class_hash: "0x0796e084e7fab04b1df28d8317cea981d29b83fe2438c98e0994f2ddfb0ecc07",
    collateral_class_hash: "0x06976b6758d298d5f443a13b3626c055897977b144fec6e901d822d09da3a3cb",
    payments_class_hash: "0x042713c22f5bd87c1ed039b303fb8fa7cba3d1af7af9151588e465366b85958d",
    governance_class_hash: "0x01768d1ffd006afaf89fea7769ffe5617643166752b2bad1633b2e41832503a2",
    schedule_class_hash: "0x0140f5b37a1d01659062368b86eddf43b2ea06e46a55dba7bfc86e418be729ae"
  }
};

async function main() {
  console.log("🚀 Starting AjoFactory Declaration and Deployment\n");

  // Initialize provider and account
  console.log("📡 Connecting to Starknet Sepolia...");
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  const account = new Account(provider, config.accountAddress, config.privateKey);
  console.log("✅ Connected to account:", config.accountAddress, "\n");

  // Load contract class
  console.log("📄 Loading contract class...");
  const contractClassPath = path.resolve(__dirname, config.contractClassPath);
  const contractClass = json.parse(fs.readFileSync(contractClassPath, "utf8"));
  
  // Calculate class hash
  const classHash = hash.computeContractClassHash(contractClass);
  console.log("📝 Computed class hash:", classHash);

  // Check if class is already declared
  console.log("\n🔍 Checking if class is already declared...");
  try {
    await provider.getClassByHash(classHash);
    console.log("✅ Class is already declared!");
  } catch (error) {
    if (error.message.includes("Class hash not found")) {
      console.log("⚠️  Class not found on network. Declaring...\n");
      
      try {
        // Declare the contract
        console.log("📤 Declaring contract class...");
        const declareResponse = await account.declareIfNot({
          contract: contractClass,
          classHash: classHash
        });

        if (declareResponse.transaction_hash) {
          console.log("📋 Declaration transaction hash:", declareResponse.transaction_hash);
          console.log("⏳ Waiting for declaration to be accepted...");
          
          await provider.waitForTransaction(declareResponse.transaction_hash);
          console.log("✅ Contract class declared successfully!");
          console.log("📝 Class hash:", declareResponse.class_hash || classHash);
        } else {
          console.log("ℹ️  Class was already declared");
        }
      } catch (declareError) {
        console.error("❌ Declaration failed:", declareError.message);
        console.error("\nFull error:", declareError);
        console.log("\n💡 Suggestion: Try using Voyager UI to declare the contract:");
        console.log("   https://sepolia.voyager.online/declare-contract");
        process.exit(1);
      }
    } else {
      console.error("❌ Error checking class:", error.message);
      process.exit(1);
    }
  }

  // Deploy the contract
  console.log("\n🚀 Deploying AjoFactory contract...");
  try {
    const constructorCalldata = CallData.compile([
      config.constructorArgs.owner,
      config.constructorArgs.core_class_hash,
      config.constructorArgs.members_class_hash,
      config.constructorArgs.collateral_class_hash,
      config.constructorArgs.payments_class_hash,
      config.constructorArgs.governance_class_hash,
      config.constructorArgs.schedule_class_hash
    ]);

    console.log("📦 Constructor arguments:");
    console.log("   owner:", config.constructorArgs.owner);
    console.log("   core_class_hash:", config.constructorArgs.core_class_hash);
    console.log("   members_class_hash:", config.constructorArgs.members_class_hash);
    console.log("   collateral_class_hash:", config.constructorArgs.collateral_class_hash);
    console.log("   payments_class_hash:", config.constructorArgs.payments_class_hash);
    console.log("   governance_class_hash:", config.constructorArgs.governance_class_hash);
    console.log("   schedule_class_hash:", config.constructorArgs.schedule_class_hash);

    const deployResponse = await account.deployContract({
      classHash: classHash,
      constructorCalldata: constructorCalldata
    });

    console.log("\n📋 Deployment transaction hash:", deployResponse.transaction_hash);
    console.log("⏳ Waiting for deployment to be accepted...");

    await provider.waitForTransaction(deployResponse.transaction_hash);
    
    console.log("\n✅ AjoFactory deployed successfully!");
    console.log("📍 Contract address:", deployResponse.contract_address);
    console.log("🔗 View on Voyager:", `https://sepolia.voyager.online/contract/${deployResponse.contract_address}`);
    console.log("🔗 View on Starkscan:", `https://sepolia.starkscan.co/contract/${deployResponse.contract_address}`);

    // Save deployment info
    const deploymentInfo = {
      contractAddress: deployResponse.contract_address,
      classHash: classHash,
      transactionHash: deployResponse.transaction_hash,
      timestamp: new Date().toISOString(),
      network: "sepolia",
      constructorArgs: config.constructorArgs
    };

    const outputPath = path.resolve(__dirname, "../ajo-save-cairo/factory_deployment.json");
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to:", outputPath);

  } catch (deployError) {
    console.error("\n❌ Deployment failed:", deployError.message);
    console.error("\nFull error:", deployError);
    console.log("\n💡 Suggestion: Try using Voyager UI to deploy the contract:");
    console.log("   https://sepolia.voyager.online/deploy-contract");
    console.log("   Class hash:", classHash);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("\n🎉 Process completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Unexpected error:", error);
    process.exit(1);
  });
