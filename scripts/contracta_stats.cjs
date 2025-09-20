const { ethers } = require("hardhat");

async function main() {
  console.log("📊 Testing getContractStats function across all Ajo contracts\n");

  // Contract addresses
  const contracts = {
    AJO_CORE: "0x74C7f57793e48A2a707311fa4BfA04F36E81e8a3",
    AJO_MEMBERS: "0x6974232c0a1cE60853Fe62B81D2E8b30c729A8e9",
    AJO_COLLATERAL: "0xaE550556d1f5B43331f09576e7e14394aD53d7C4", 
    AJO_PAYMENTS: "0x95CeA4AF22F89EF699F71054514F950109f39FC6",
    AJO_GOVERNANCE: "0x92b95F1fD6b3E628B99ba1084de1CA06cBe4Da4E"
  };

  const [deployer] = await ethers.getSigners();
  console.log("🔐 Testing with account:", deployer.address);
  console.log("💰 Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "HBAR\n");

  // ABI for getContractStats function
  const CONTRACT_STATS_ABI = [
    "function getContractStats() external view returns (uint256 totalMembers, uint256 activeMembers, uint256 totalCollateralUSDC, uint256 totalCollateralHBAR, uint256 contractBalanceUSDC, uint256 contractBalanceHBAR, uint256 currentQueuePosition, uint8 activeToken)"
  ];

  // Helper function to format stats results
  function formatContractStats(stats) {
    const tokenNames = ["USDC", "HBAR"];
    return {
      totalMembers: stats[0].toString(),
      activeMembers: stats[1].toString(), 
      totalCollateralUSDC: ethers.utils.formatEther(stats[2]),
      totalCollateralHBAR: ethers.utils.formatUnits(stats[3], 8),
      contractBalanceUSDC: ethers.utils.formatEther(stats[4]),
      contractBalanceHBAR: ethers.utils.formatUnits(stats[5], 8),
      currentQueuePosition: stats[6].toString(),
      activeToken: `${tokenNames[stats[7]]} (${stats[7]})`
    };
  }

  let totalTests = 0;
  let passedTests = 0;

  console.log("🎯 TESTING getContractStats() FUNCTION");
  console.log("=" * 60);

  // Test each contract
  for (const [contractName, contractAddress] of Object.entries(contracts)) {
    console.log(`\n📋 Testing ${contractName} (${contractAddress})`);
    
    try {
      const contract = new ethers.Contract(contractAddress, CONTRACT_STATS_ABI, deployer);
      const stats = await contract.getContractStats();
      
      console.log("✅ getContractStats(): SUCCESS");
      
      const formattedStats = formatContractStats(stats);
      console.log("📊 Contract Statistics:");
      console.log(`   👥 Total Members: ${formattedStats.totalMembers}`);
      console.log(`   ✨ Active Members: ${formattedStats.activeMembers}`);
      console.log(`   💰 Total Collateral USDC: ${formattedStats.totalCollateralUSDC}`);
      console.log(`   💰 Total Collateral HBAR: ${formattedStats.totalCollateralHBAR}`);
      console.log(`   🏦 Contract Balance USDC: ${formattedStats.contractBalanceUSDC}`);
      console.log(`   🏦 Contract Balance HBAR: ${formattedStats.contractBalanceHBAR}`);
      console.log(`   🎯 Current Queue Position: ${formattedStats.currentQueuePosition}`);
      console.log(`   🪙 Active Payment Token: ${formattedStats.activeToken}`);
      
      passedTests++;
      
    } catch (error) {
      console.log("❌ getContractStats(): FAILED");
      console.log(`   🚨 Error: ${error.message.split('(')[0]}`);
    }
    
    totalTests++;
  }

  // Final Results
  console.log("\n" + "=" * 60);
  console.log("🎉 TESTING COMPLETE!");
  console.log("=" * 60);
  console.log(`📊 Total Contracts Tested: ${totalTests}`);
  console.log(`✅ Successful: ${passedTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("🎊 ALL CONTRACTS WORKING! getContractStats() is implemented everywhere!");
  } else if (passedTests > 0) {
    console.log(`😊 ${passedTests} out of ${totalTests} contracts have working getContractStats()`);
  } else {
    console.log("⚠️  No contracts have working getContractStats() function");
  }

  console.log("\n💡 Notes:");
  console.log("   - Total Members: All members who ever joined");
  console.log("   - Active Members: Currently participating members");
  console.log("   - Collateral: Total locked collateral amounts");
  console.log("   - Contract Balance: Available funds for payouts");
  console.log("   - Queue Position: Next position for new members");
  console.log("   - Active Token: Currently used payment token (0=USDC, 1=HBAR)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("🚨 Script failed:", error);
    process.exit(1);
  });