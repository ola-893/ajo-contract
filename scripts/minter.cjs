const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Mock token minting script");

  // Contract addresses from your deployment
  const MOCK_USDC_ADDRESS = "0x508617Bb186943E112487606FFFf7DBD8a3D6271";
  const MOCK_WHBAR_ADDRESS = "0x7288b21eb87b8D3d82a8aF842D25aaC1dc7Bd9Ae";

  // Get deployer (must be contract owner)
  const [deployer] = await ethers.getSigners();
  console.log("🔐 Minting with deployer:", deployer.address);

  // Check deployer balance
  const balance = await deployer.getBalance();
  console.log("💰 Deployer balance:", ethers.utils.formatEther(balance), "HBAR");

  // Mock ERC20 ABI with mint function
  const MOCK_ERC20_ABI = [
    {
      inputs: [
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" }
      ],
      name: "mint",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [{ name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "owner",
      outputs: [{ name: "", type: "address" }],
      stateMutability: "view",
      type: "function"
    }
  ];

  // Connect to mock token contracts
  const mockUSDC = new ethers.Contract(MOCK_USDC_ADDRESS, MOCK_ERC20_ABI, deployer);
  const mockWHBAR = new ethers.Contract(MOCK_WHBAR_ADDRESS, MOCK_ERC20_ABI, deployer);

  // Verify ownership
  try {
    const usdcOwner = await mockUSDC.owner();
    const whbarOwner = await mockWHBAR.owner();
    console.log("✅ USDC owner:", usdcOwner);
    console.log("✅ WHBAR owner:", whbarOwner);

    if (usdcOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("Not USDC contract owner");
    }
    if (whbarOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      throw new Error("Not WHBAR contract owner");
    }
  } catch (error) {
    console.error("❌ Ownership check failed:", error.message);
    return;
  }

  // Test addresses to mint tokens to
  const testAddresses = [
    deployer.address,  
    "0x506e724d7FDdbF91B6607d5Af0700d385D952f8a"
  ];

  console.log("\n📝 Minting tokens to test addresses...");

  for (const address of testAddresses) {
    try {
      console.log(`\n👤 Minting tokens for: ${address}`);

      // Check current balances
      const currentUSDC = await mockUSDC.balanceOf(address);
      const currentWHBAR = await mockWHBAR.balanceOf(address);
      console.log(`   Current USDC: ${ethers.utils.formatEther(currentUSDC)}`);
      console.log(`   Current WHBAR: ${ethers.utils.formatUnits(currentWHBAR, 8)}`);

      // Mint USDC (18 decimals)
      console.log("   🪙 Minting 10,000 USDC...");
      const usdcTx = await mockUSDC.mint(address, ethers.utils.parseEther("10000"));
      await usdcTx.wait();
      console.log(`   ✅ USDC minted - TX: ${usdcTx.hash}`);

      // Mint WHBAR (8 decimals)
      console.log("   🪙 Minting 100,000 WHBAR...");
      const whbarTx = await mockWHBAR.mint(address, ethers.utils.parseUnits("100000", 8));
      await whbarTx.wait();
      console.log(`   ✅ WHBAR minted - TX: ${whbarTx.hash}`);

      // Check new balances
      const newUSDC = await mockUSDC.balanceOf(address);
      const newWHBAR = await mockWHBAR.balanceOf(address);
      console.log(`   💰 New USDC balance: ${ethers.utils.formatEther(newUSDC)}`);
      console.log(`   💰 New WHBAR balance: ${ethers.utils.formatUnits(newWHBAR, 8)}`);

    } catch (error) {
      console.error(`   ❌ Failed to mint for ${address}:`, error.message);
    }
  }

  console.log("\n🎉 Token minting completed!");
  console.log("\n📊 Summary:");
  console.log("- Each address received 10,000 USDC");
  console.log("- Each address received 100,000 WHBAR");
  console.log("- Users can now test joining the Ajo with these tokens");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("🚨 Script failed:", error);
    process.exit(1);
  });