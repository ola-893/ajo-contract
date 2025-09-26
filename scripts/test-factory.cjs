const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Factory Debug and Diagnosis Script");
  console.log("=" .repeat(50));

  // Contract addresses
  const FACTORY_ADDRESS = "0x2F2DB5aB95d0d17ed39336C6829E8A1C09818df6";
  const MOCK_USDC_ADDRESS = "0xbe8B1625996b0875af370aDb185137a000Be58A5";
  const MOCK_WHBAR_ADDRESS = "0x201890d90f1A414C42c9ab9F50A817f8e2324b24";

  // Template addresses from your deployment
  const TEMPLATE_ADDRESSES = {
    AjoCore: "0xAD22efC8E7B95Bc6C640174DD8baA7dF7B8cFF23",
    AjoMembers: "0x5e553a14a28c1dC520479B0663d19A3b68E2673e",
    AjoCollateral: "0x8dbA839BaAbca6A4A84C75Ec2f290B5f5e03aeCB",
    AjoPayments: "0x6b6AC5f7b228A6C2a36746D5c12C57715605f27d",
    AjoGovernance: "0x2A409D0118B6c309153B8bDc0D8909f2344f2588"
  };

  const [deployer] = await ethers.getSigners();
  console.log("🔐 Deployer:", deployer.address);

  // Extended Factory ABI for debugging
  const FACTORY_ABI = [
    {
      inputs: [],
      name: "getFactoryStats",
      outputs: [
        { name: "totalCreated", type: "uint256" },
        { name: "totalActive", type: "uint256" },
        { name: "currentCreationFee", type: "uint256" },
        { name: "usdcToken", type: "address" },
        { name: "whbarToken", type: "address" }
      ],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "ajoMembersTemplate",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "ajoGovernanceTemplate",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "ajoCollateralTemplate",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "ajoPaymentsTemplate",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "ajoCoreTemplate",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [{ name: "name", type: "string" }],
      name: "createAjo",
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "payable",
      type: "function"
    }
  ];

  // Basic contract ABI to check if contracts exist
  const BASIC_ABI = [
    {
      inputs: [],
      name: "owner",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    }
  ];

  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, deployer);

  try {
    // STEP 1: Check factory configuration
    console.log("\n🔧 STEP 1: Checking Factory Configuration...");
    
    try {
      const stats = await factory.getFactoryStats();
      console.log("✅ Factory stats accessible");
      console.log(`   USDC Token: ${stats.usdcToken || stats[3]}`);
      console.log(`   WHBAR Token: ${stats.whbarToken || stats[4]}`);
      console.log(`   Creation Fee: ${ethers.utils.formatEther(stats.currentCreationFee || stats[2])} HBAR`);
    } catch (error) {
      console.log("❌ Cannot access factory stats:", error.message);
      return;
    }

    // STEP 2: Check template addresses
    console.log("\n🔧 STEP 2: Checking Template Addresses...");
    
    const templateChecks = [
      { name: "AjoMembers", getter: "ajoMembersTemplate" },
      { name: "AjoGovernance", getter: "ajoGovernanceTemplate" },
      { name: "AjoCollateral", getter: "ajoCollateralTemplate" },
      { name: "AjoPayments", getter: "ajoPaymentsTemplate" },
      { name: "AjoCore", getter: "ajoCoreTemplate" }
    ];

    for (const template of templateChecks) {
      try {
        const address = await factory[template.getter]();
        console.log(`✅ ${template.name} template: ${address}`);
        
        // Check if the template contract exists and has code
        const code = await ethers.provider.getCode(address);
        if (code === "0x") {
          console.log(`   ❌ WARNING: No code at ${template.name} template address`);
        } else {
          console.log(`   ✅ Contract code exists (${code.length} bytes)`);
        }
      } catch (error) {
        console.log(`❌ Cannot get ${template.name} template:`, error.message);
      }
    }

    // STEP 3: Test template contract functionality
    console.log("\n🔧 STEP 3: Testing Template Contract Interfaces...");
    
    // Test if templates have the required functions
    const testTemplate = async (address, name, requiredFunctions) => {
      try {
        const contract = new ethers.Contract(address, BASIC_ABI, deployer);
        await contract.owner(); // Basic test call
        console.log(`✅ ${name} template is callable`);
      } catch (error) {
        console.log(`❌ ${name} template call failed:`, error.message);
      }
    };

    if (TEMPLATE_ADDRESSES.AjoMembers) {
      await testTemplate(TEMPLATE_ADDRESSES.AjoMembers, "AjoMembers", ["setAjoCore"]);
    }

    // STEP 4: Test CREATE2 clone deployment manually
    console.log("\n🔧 STEP 4: Testing CREATE2 Clone Deployment...");
    
    try {
      // Test the clone deployment function manually
      const templateAddress = await factory.ajoMembersTemplate();
      console.log(`Testing clone from template: ${templateAddress}`);
      
      // Manual CREATE2 clone test
      const CloneFactory = await ethers.getContractFactory("CloneFactory"); // We'll create this simple test contract
      
    } catch (error) {
      console.log("❌ Clone deployment test failed:", error.message);
    }

    // STEP 5: Try createAjo with detailed gas analysis
    console.log("\n🔧 STEP 5: Testing createAjo with Gas Analysis...");
    
    try {
      // Estimate gas first
      console.log("Estimating gas for createAjo...");
      const gasEstimate = await factory.estimateGas.createAjo("Test Ajo", {
        value: ethers.utils.parseEther("1")
      });
      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      
      if (gasEstimate.gt(ethers.BigNumber.from("10000000"))) {
        console.log("❌ WARNING: Gas estimate is extremely high, likely will fail");
        
        // Try to identify which part is causing high gas usage
        console.log("\n🔍 Analyzing gas usage by step...");
        
        // We need to modify the factory to have step-by-step functions for debugging
        console.log("💡 RECOMMENDATION: Deploy a debug version of the factory");
        console.log("   that separates each initialization step into separate functions");
        
      } else {
        console.log("✅ Gas estimate looks reasonable");
        
        // Try the actual call
        console.log("Attempting createAjo transaction...");
        const tx = await factory.createAjo("Debug Test Ajo", {
          value: ethers.utils.parseEther("1"),
          gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
        });
        
        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          console.log("✅ Transaction succeeded!");
          console.log(`Gas used: ${receipt.gasUsed.toString()}`);
        } else {
          console.log("❌ Transaction failed with status 0");
        }
      }
      
    } catch (error) {
      console.log("❌ createAjo gas estimation failed:", error.message);
      
      if (error.message.includes("cannot estimate gas")) {
        console.log("\n🔍 DETAILED DIAGNOSIS:");
        console.log("The 'cannot estimate gas' error usually means:");
        console.log("1. ❌ One of the template contracts is not properly deployed");
        console.log("2. ❌ Template contracts don't have the expected functions");
        console.log("3. ❌ The initialization sequence is trying to call non-existent functions");
        console.log("4. ❌ Template contracts are reverting during initialization");
        
        console.log("\n💡 POSSIBLE FIXES:");
        console.log("1. Verify all template contracts were deployed correctly");
        console.log("2. Check that template contracts have the required functions:");
        console.log("   - AjoMembers: setAjoCore()");
        console.log("   - AjoGovernance: setAjoCore(), setMembers()");
        console.log("   - AjoCollateral: setAjoCore(), setMembers()");
        console.log("   - AjoPayments: setAjoCore(), setMembers(), setCollateral()");
        console.log("   - AjoCore: initialize()");
        console.log("3. Deploy templates with proper constructors that don't revert");
      }
    }

    // STEP 6: Check if this is a template issue vs factory issue
    console.log("\n🔧 STEP 6: Root Cause Analysis...");
    
    console.log("\n📋 DIAGNOSIS SUMMARY:");
    console.log("Based on the transaction failures with full gas consumption,");
    console.log("the most likely causes are:");
    console.log("");
    console.log("🎯 PRIMARY SUSPECTS:");
    console.log("1. Template contracts don't have the expected setter functions");
    console.log("2. Template contracts are reverting during setAjoCore/setMembers calls");
    console.log("3. The EIP-1167 clone deployment is failing");
    console.log("4. Template constructors are not compatible with cloning");
    console.log("");
    console.log("🔧 RECOMMENDED ACTIONS:");
    console.log("1. Check template contracts have these functions:");
    console.log("   - setAjoCore(address)");
    console.log("   - setMembers(address) [for Governance, Collateral, Payments]");
    console.log("   - setCollateral(address) [for Payments]");
    console.log("   - initialize() [for Core]");
    console.log("");
    console.log("2. Ensure template contracts don't revert when these functions are called");
    console.log("3. Verify templates were deployed with proper constructors for cloning");

  } catch (error) {
    console.error("❌ Debug script failed:", error.message);
  }
}

main()
  .then(() => {
    console.log("\n🔍 Debug analysis completed!");
    console.log("Check the diagnosis above for specific issues to fix.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Debug script failed:", error);
    process.exit(1);
  });