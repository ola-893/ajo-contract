const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Starting comprehensive view function testing for Ajo contracts + Factory\n");

  // Contract addresses - UPDATED WITH NEW DEPLOYMENTS
  const contracts = {
    AJO_CORE: "0x197aD3A009b07f82527b239a4D23de6F9c795597",
    AJO_MEMBERS: "0x14e4C48CC97b90550d22C9b6A405597C2f61FD66",
    AJO_COLLATERAL: "0x616061F1e2A3151926b336Dcc4ecE74E37692786", 
    AJO_PAYMENTS: "0x4B5B564e7E5f89F95A6799d09f1B16747299Fbc1",
    AJO_GOVERNANCE: "0x890C02F3C6EbE4030aaF86DD6EbA97E932Cb020E",
    AJO_FACTORY: "0xb0ae5152c1b5FB8e1A44f6b3f97A43A12114edc8",
    // Token contracts for reference
    MOCK_USDC: "0xffe0289a80CFb1cDbd3f63cd9fdb19D609653623",
    MOCK_WHBAR: "0xf34f43E8110220dbA7dc74f1fE8eDEa2bcEC1e06"
  };

  const [deployer] = await ethers.getSigners();
  console.log("🔐 Testing with account:", deployer.address);
  console.log("💰 Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "HBAR\n");

  // Test addresses for member-specific functions
  const testAddresses = [
    deployer.address,
    "0x4Cb10B9Fea7AE756a626E6513fD648BcD946C470"
  ];

  // Helper function to test view functions
  async function testViewFunction(contract, functionName, params = [], description = "") {
    try {
      const result = await contract[functionName](...params);
      console.log(`✅ ${functionName}${description}: SUCCESS`);
      
      // Format result based on type
      if (typeof result === 'object' && result._isBigNumber) {
        console.log(`   📊 Result: ${result.toString()}`);
      } else if (Array.isArray(result)) {
        console.log(`   📊 Result: [${result.length} items]`);
        if (result.length > 0 && result.length <= 5) {
          console.log(`   🔍 Items: ${result.join(', ')}`);
        }
      } else if (typeof result === 'object' && result !== null) {
        console.log(`   📊 Result: Object with ${Object.keys(result).length} properties`);
        // For structs, show some key fields
        if (result.ajoId !== undefined) {
          console.log(`   🏷️  AjoId: ${result.ajoId}, Creator: ${result.creator?.slice(0,8)}...`);
        }
      } else {
        console.log(`   📊 Result: ${result}`);
      }
      return true;
    } catch (error) {
      console.log(`❌ ${functionName}${description}: FAILED`);
      console.log(`   🚨 Error: ${error.message.split('(')[0]}`);
      return false;
    }
  }

  // ============ GENERATED ABIs FROM INTERFACES ============

  // IPatientAjo Interface ABI
  const PATIENT_AJO_ABI = [
    // View Functions - Member Information
    "function getMemberInfo(address member) external view returns (tuple(uint256 queueNumber, uint256 joinedCycle, uint256 totalPaid, uint256 requiredCollateral, uint256 lockedCollateral, uint256 lastPaymentCycle, uint256 defaultCount, bool hasReceivedPayout, bool isActive, address guarantor, uint8 preferredToken, uint256 reputationScore, uint256[] pastPayments, uint256 guaranteePosition) memberInfo, uint256 pendingPenalty, uint256 effectiveVotingPower)",
    "function getQueueInfo(address member) external view returns (uint256 position, uint256 estimatedCyclesWait)",
    "function needsToPayThisCycle(address member) external view returns (bool)",
    
    // View Functions - Contract Statistics
    "function getContractStats() external view returns (uint256 totalMembers, uint256 activeMembers, uint256 totalCollateralUSDC, uint256 totalCollateralHBAR, uint256 contractBalanceUSDC, uint256 contractBalanceHBAR, uint256 currentQueuePosition, uint8 activeToken)",
    
    // View Functions - Token Configuration
    "function getTokenConfig(uint8 token) external view returns (tuple(uint256 monthlyPayment, bool isActive))",
    
    // View Functions - V2 Collateral Demo
    "function getCollateralDemo(uint256 participants, uint256 monthlyPayment) external view returns (uint256[] positions, uint256[] collaterals)",
    
    // View Functions - Security Model
    "function calculateSeizableAssets(address defaulterAddress) external view returns (uint256 totalSeizable, uint256 collateralSeized, uint256 paymentsSeized)",
    
    // Core Ajo Functions (non-view)
    "function joinAjo(uint8 tokenChoice) external",
    "function makePayment() external",
    "function distributePayout() external",
    "function handleDefault(address defaulter) external",
    "function exitAjo() external",
    
    // Admin Functions (non-view)
    "function emergencyWithdraw(uint8 token) external",
    "function updateCycleDuration(uint256 newDuration) external",
    "function emergencyPause() external",
    "function batchHandleDefaults(address[] calldata defaulters) external",
    "function updateTokenConfig(uint8 token, uint256 monthlyPayment, bool isActive) external"
  ];

  // IAjoGovernance Interface ABI
  const AJO_GOVERNANCE_ABI = [
    // Core Governance Functions (non-view)
    "function createProposal(string memory description, bytes memory proposalData) external returns (uint256)",
    "function vote(uint256 proposalId, uint8 support) external",
    "function executeProposal(uint256 proposalId) external",
    
    // Governance-Only Functions (non-view)
    "function updatePenaltyRate(uint256 newPenaltyRate) external",
    "function switchPaymentToken(uint8 newToken) external",
    "function updateReputationAndVotingPower(address member, bool positive) external",
    "function updateVotingPower(address member, uint256 newPower) external",
    
    // View Functions
    "function getProposal(uint256 proposalId) external view returns (string description, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, uint256 proposalEndTime, bool executed, bytes proposalData)",
    "function hasVoted(uint256 proposalId, address voter) external view returns (bool)",
    "function getGovernanceSettings() external view returns (uint256 proposalThreshold, uint256 votingPeriod, uint256 currentPenaltyRate, uint256 totalProposals)"
  ];

  // IAjoCollateral Interface ABI
  const AJO_COLLATERAL_ABI = [
    // Pure Calculation Functions
    "function calculateRequiredCollateral(uint256 position, uint256 monthlyPayment, uint256 totalParticipants) external view returns (uint256)",
    "function calculateGuarantorPosition(uint256 memberPosition, uint256 totalParticipants) external pure returns (uint256)",
    
    // View Functions
    "function getTotalCollateral() external view returns (uint256 totalUSDC, uint256 totalHBAR)",
    "function calculateSeizableAssets(address defaulterAddress) external view returns (uint256 totalSeizable, uint256 collateralSeized, uint256 paymentsSeized)",
    
    // Non-view Functions
    "function lockCollateral(address member, uint256 amount, uint8 token) external",
    "function unlockCollateral(address member, uint256 amount, uint8 token) external",
    "function executeSeizure(address defaulter) external",
    "function emergencyWithdraw(uint8 token, address to, uint256 amount) external"
  ];

  // IAjoPayments Interface ABI
  const AJO_PAYMENTS_ABI = [
    // Core Payment Functions (non-view)
    "function makePayment() external",
    "function distributePayout() external",
    "function handleDefault(address defaulter) external",
    "function batchHandleDefaults(address[] calldata defaulters) external",
    "function updateTokenConfig(uint8 token, uint256 monthlyPayment, bool isActive) external",
    "function advanceCycle() external",
    "function switchPaymentToken(uint8 newToken) external",
    "function emergencyWithdraw(uint8 token) external",
    "function updatePenaltyRate(uint256 newPenaltyRate) external",
    
    // View Functions
    "function needsToPayThisCycle(address member) external view returns (bool)",
    "function getTokenConfig(uint8 token) external view returns (tuple(uint256 monthlyPayment, bool isActive))",
    "function getCurrentCycle() external view returns (uint256)",
    "function getPendingPenalty(address member) external view returns (uint256)"
  ];

  // IAjoMembers Interface ABI
  const AJO_MEMBERS_ABI = [
    // Core Member Functions (non-view)
    "function joinAjo(uint8 tokenChoice) external",
    "function exitAjo() external",
    "function updateReputation(address member, uint256 newReputation) external",
    
    // View Functions
    "function getMember(address member) external view returns (tuple(uint256 queueNumber, uint256 joinedCycle, uint256 totalPaid, uint256 requiredCollateral, uint256 lockedCollateral, uint256 lastPaymentCycle, uint256 defaultCount, bool hasReceivedPayout, bool isActive, address guarantor, uint8 preferredToken, uint256 reputationScore, uint256[] pastPayments, uint256 guaranteePosition))",
    "function getTotalActiveMembers() external view returns (uint256)",
    "function getMemberInfo(address member) external view returns (tuple(uint256 queueNumber, uint256 joinedCycle, uint256 totalPaid, uint256 requiredCollateral, uint256 lockedCollateral, uint256 lastPaymentCycle, uint256 defaultCount, bool hasReceivedPayout, bool isActive, address guarantor, uint8 preferredToken, uint256 reputationScore, uint256[] pastPayments, uint256 guaranteePosition) memberInfo, uint256 pendingPenalty, uint256 effectiveVotingPower)",
    "function getQueueInfo(address member) external view returns (uint256 position, uint256 estimatedCyclesWait)",
    "function getContractStats() external view returns (uint256 totalMembers, uint256 activeMembers, uint256 totalCollateralUSDC, uint256 totalCollateralHBAR, uint256 contractBalanceUSDC, uint256 contractBalanceHBAR, uint256 currentQueuePosition, uint8 activeToken)",
    "function queuePositions(uint256 position) external view returns (address)",
    "function activeMembersList(uint256 index) external view returns (address)"
  ];

  // PatientAjoFactory ABI - NEW!
  const AJO_FACTORY_ABI = [
    // View Functions
    "function nextAjoId() external view returns (uint256)",
    "function creationFee() external view returns (uint256)",
    "function totalAjosCreated() external view returns (uint256)",
    "function USDC_TOKEN() external view returns (address)",
    "function WHBAR_TOKEN() external view returns (address)",
    "function ajoInstances(uint256 ajoId) external view returns (tuple(uint256 ajoId, address creator, address ajoCore, string name, uint256 createdAt, bool isActive))",
    "function creatorAjos(address creator, uint256 index) external view returns (uint256)",
    "function allAjoIds(uint256 index) external view returns (uint256)",
    "function getAjoInfo(uint256 ajoId) external view returns (tuple(uint256 ajoId, address creator, address ajoCore, string name, uint256 createdAt, bool isActive))",
    "function getCreatorAjos(address creator) external view returns (uint256[] memory)",
    "function getAllAjos() external view returns (uint256[] memory)",
    "function getFactoryStats() external view returns (uint256 totalCreated, uint256 totalActive, uint256 currentCreationFee, address usdcToken, address whbarToken)",
    
    // Non-view Functions
    "function registerAjo(address ajoCoreAddress, string memory name) external payable returns (uint256)",
    "function updateCreationFee(uint256 newFee) external",
    "function deactivateAjo(uint256 ajoId) external",
    "function withdrawFees() external"
  ];

  // IERC20Votes Interface ABI (Inherited)
  const ERC20_VOTES_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    
    // Voting specific functions
    "function delegates(address account) external view returns (address)",
    "function delegate(address delegatee) external",
    "function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external",
    "function getCurrentVotes(address account) external view returns (uint256)",
    "function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256)"
  ];

  // IOwnable Interface ABI (Inherited)
  const OWNABLE_ABI = [
    "function owner() external view returns (address)",
    "function renounceOwnership() external",
    "function transferOwnership(address newOwner) external"
  ];

  let totalTests = 0;
  let passedTests = 0;

  // ============ TEST FACTORY CONTRACT ============
  console.log("🏭 TESTING AJO FACTORY CONTRACT");
  console.log("=" * 50);
  
  const factoryContract = new ethers.Contract(contracts.AJO_FACTORY, [...AJO_FACTORY_ABI, ...OWNABLE_ABI], deployer);
  
  // Test basic factory state variables
  totalTests += 5;
  if (await testViewFunction(factoryContract, "nextAjoId", [], " (next available ID)")) passedTests++;
  if (await testViewFunction(factoryContract, "creationFee", [], " (current creation fee)")) passedTests++;
  if (await testViewFunction(factoryContract, "totalAjosCreated", [], " (total Ajos created)")) passedTests++;
  if (await testViewFunction(factoryContract, "USDC_TOKEN", [], " (USDC token address)")) passedTests++;
  if (await testViewFunction(factoryContract, "WHBAR_TOKEN", [], " (WHBAR token address)")) passedTests++;
  
  // Test factory statistics
  totalTests++;
  if (await testViewFunction(factoryContract, "getFactoryStats", [], " (comprehensive stats)")) passedTests++;
  
  // Test get all Ajos
  totalTests++;
  if (await testViewFunction(factoryContract, "getAllAjos", [], " (all Ajo IDs)")) passedTests++;
  
  // Test Ajo instances (try first few IDs, even if they don't exist)
  for (let ajoId = 0; ajoId < 5; ajoId++) {
    totalTests += 2;
    if (await testViewFunction(factoryContract, "ajoInstances", [ajoId], ` (Ajo instance ${ajoId})`)) passedTests++;
    if (await testViewFunction(factoryContract, "getAjoInfo", [ajoId], ` (Ajo info ${ajoId})`)) passedTests++;
  }
  
  // Test array access functions (try first few indices)
  for (let idx = 0; idx < 3; idx++) {
    totalTests++;
    if (await testViewFunction(factoryContract, "allAjoIds", [idx], ` (allAjoIds[${idx}])`)) passedTests++;
  }
  
  // Test creator-specific functions
  for (const address of testAddresses) {
    totalTests++;
    if (await testViewFunction(factoryContract, "getCreatorAjos", [address], ` (${address.slice(0,8)}... Ajos)`)) passedTests++;
    
    // Test creatorAjos mapping access (try first few indices)
    for (let idx = 0; idx < 2; idx++) {
      totalTests++;
      if (await testViewFunction(factoryContract, "creatorAjos", [address, idx], ` (${address.slice(0,8)}...[${idx}])`)) passedTests++;
    }
  }
  
  // Test inherited Ownable functions
  totalTests++;
  if (await testViewFunction(factoryContract, "owner", [], " (factory owner)")) passedTests++;

  // ============ TEST CORE AJO CONTRACT ============
  console.log("\n🎯 TESTING CORE AJO CONTRACT");
  console.log("=" * 50);
  
  const coreContract = new ethers.Contract(contracts.AJO_CORE, [...PATIENT_AJO_ABI, ...ERC20_VOTES_ABI, ...OWNABLE_ABI], deployer);
  
  // Test contract stats (no params needed)
  totalTests++;
  if (await testViewFunction(coreContract, "getContractStats", [], " (contract statistics)")) passedTests++;
  
  // Test token configs (USDC = 0, HBAR = 1)
  for (let tokenType = 0; tokenType <= 1; tokenType++) {
    totalTests++;
    if (await testViewFunction(coreContract, "getTokenConfig", [tokenType], ` (token ${tokenType})`)) passedTests++;
  }
  
  // Test collateral demo with sample data
  totalTests++;
  if (await testViewFunction(coreContract, "getCollateralDemo", [10, ethers.utils.parseEther("1000")], " (demo: 10 participants, 1000 payment)")) passedTests++;
  
  // Test member-specific functions
  for (const address of testAddresses) {
    totalTests += 4;
    if (await testViewFunction(coreContract, "getMemberInfo", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(coreContract, "getQueueInfo", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(coreContract, "needsToPayThisCycle", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(coreContract, "calculateSeizableAssets", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
  }

  // Test inherited functions
  totalTests += 2;
  if (await testViewFunction(coreContract, "totalSupply", [], " (ERC20)")) passedTests++;
  if (await testViewFunction(coreContract, "owner", [], " (Ownable)")) passedTests++;
  
  for (const address of testAddresses) {
    totalTests += 4;
    if (await testViewFunction(coreContract, "balanceOf", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(coreContract, "delegates", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(coreContract, "getCurrentVotes", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(coreContract, "allowance", [address, deployer.address], ` (${address.slice(0,8)}... -> deployer)`)) passedTests++;
  }

  // ============ TEST MEMBERS CONTRACT ============
  console.log("\n🎯 TESTING MEMBERS CONTRACT");
  console.log("=" * 50);
  
  const membersContract = new ethers.Contract(contracts.AJO_MEMBERS, AJO_MEMBERS_ABI, deployer);
  
  totalTests++;
  if (await testViewFunction(membersContract, "getTotalActiveMembers", [], " (total active)")) passedTests++;
  
  totalTests++;
  if (await testViewFunction(membersContract, "getContractStats", [], " (contract stats)")) passedTests++;
  
  // Test queue positions (try first few positions)
  for (let pos = 0; pos < 3; pos++) {
    totalTests++;
    if (await testViewFunction(membersContract, "queuePositions", [pos], ` (position ${pos})`)) passedTests++;
  }
  
  // Test active members list (try first few indices)
  for (let idx = 0; idx < 3; idx++) {
    totalTests++;
    if (await testViewFunction(membersContract, "activeMembersList", [idx], ` (index ${idx})`)) passedTests++;
  }
  
  for (const address of testAddresses) {
    totalTests += 3;
    if (await testViewFunction(membersContract, "getMember", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(membersContract, "getMemberInfo", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(membersContract, "getQueueInfo", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
  }

  // ============ TEST COLLATERAL CONTRACT ============
  console.log("\n🎯 TESTING COLLATERAL CONTRACT");
  console.log("=" * 50);
  
  const collateralContract = new ethers.Contract(contracts.AJO_COLLATERAL, AJO_COLLATERAL_ABI, deployer);
  
  totalTests++;
  if (await testViewFunction(collateralContract, "getTotalCollateral", [], " (total collateral)")) passedTests++;
  
  // Test calculation functions with sample data
  totalTests += 2;
  if (await testViewFunction(collateralContract, "calculateRequiredCollateral", [5, ethers.utils.parseEther("1000"), 20], " (pos 5, 1000 payment, 20 total)")) passedTests++;
  if (await testViewFunction(collateralContract, "calculateGuarantorPosition", [10, 20], " (member pos 10, 20 total)")) passedTests++;
  
  for (const address of testAddresses) {
    totalTests++;
    if (await testViewFunction(collateralContract, "calculateSeizableAssets", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
  }

  // ============ TEST PAYMENTS CONTRACT ============
  console.log("\n🎯 TESTING PAYMENTS CONTRACT");
  console.log("=" * 50);
  
  const paymentsContract = new ethers.Contract(contracts.AJO_PAYMENTS, AJO_PAYMENTS_ABI, deployer);
  
  totalTests++;
  if (await testViewFunction(paymentsContract, "getCurrentCycle", [], " (current cycle)")) passedTests++;
  
  // Test token configs
  for (let tokenType = 0; tokenType <= 1; tokenType++) {
    totalTests++;
    if (await testViewFunction(paymentsContract, "getTokenConfig", [tokenType], ` (token ${tokenType})`)) passedTests++;
  }
  
  for (const address of testAddresses) {
    totalTests += 2;
    if (await testViewFunction(paymentsContract, "needsToPayThisCycle", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
    if (await testViewFunction(paymentsContract, "getPendingPenalty", [address], ` (${address.slice(0,8)}...)`)) passedTests++;
  }

  // ============ TEST GOVERNANCE CONTRACT ============
  console.log("\n🎯 TESTING GOVERNANCE CONTRACT");
  console.log("=" * 50);
  
  const governanceContract = new ethers.Contract(contracts.AJO_GOVERNANCE, AJO_GOVERNANCE_ABI, deployer);
  
  totalTests++;
  if (await testViewFunction(governanceContract, "getGovernanceSettings", [], " (governance settings)")) passedTests++;
  
  // Test proposal functions (try first few proposal IDs)
  for (let proposalId = 0; proposalId < 3; proposalId++) {
    totalTests++;
    if (await testViewFunction(governanceContract, "getProposal", [proposalId], ` (proposal ${proposalId})`)) passedTests++;
  }
  
  // Test voting status
  for (const address of testAddresses) {
    for (let proposalId = 0; proposalId < 2; proposalId++) {
      totalTests++;
      if (await testViewFunction(governanceContract, "hasVoted", [proposalId, address], ` (proposal ${proposalId}, ${address.slice(0,8)}...)`)) passedTests++;
    }
  }

  // ============ FINAL RESULTS ============
  console.log("\n" + "=" * 60);
  console.log("🎉 TESTING COMPLETE!");
  console.log("=" * 60);
  console.log(`📊 Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log("🎊 ALL TESTS PASSED! Your contracts are working perfectly!");
  } else if (passedTests / totalTests > 0.8) {
    console.log("😊 Great job! Most functions are working. Check the failed ones above.");
  } else if (passedTests / totalTests > 0.5) {
    console.log("🤔 Some functions need attention. Review the failed tests above.");
  } else {
    console.log("⚠️  Many functions failed. Please check your contract deployments and ABIs.");
  }

  console.log("\n💡 TIP: Failed tests might indicate:");
  console.log("   - Contract not deployed at expected address");
  console.log("   - Function doesn't exist (ABI mismatch)");  
  console.log("   - Function reverts due to missing data");
  console.log("   - Network connection issues");
  
  console.log("\n🔍 DETAILED ABI REFERENCE:");
  console.log("   - PaymentToken enum: USDC = 0, HBAR = 1");
  console.log("   - Member struct has 14 fields including pastPayments array");
  console.log("   - TokenConfig struct has monthlyPayment and isActive");
  console.log("   - AjoInstance struct has 6 fields: ajoId, creator, ajoCore, name, createdAt, isActive");
  console.log("   - All view functions should work even with empty state");
  
  console.log("\n🏭 FACTORY-SPECIFIC NOTES:");
  console.log("   - Make sure to update AJO_FACTORY address in the script");
  console.log("   - Factory view functions work even without any registered Ajos");
  console.log("   - Array access functions may fail if index is out of bounds (expected)");
  console.log("   - Creator-specific functions return empty arrays for addresses with no Ajos");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("🚨 Script failed:", error);
    process.exit(1);
  });