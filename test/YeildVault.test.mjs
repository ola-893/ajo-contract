import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;

describe("ProtegoYieldVault (ERC-4626)", function () {
  let vault, assetToken, custodian, aiAgent;
  let owner, investor1, investor2;
  
  beforeEach(async function () {
    [owner, investor1, investor2, custodian, aiAgent] = await ethers.getSigners();
    
    // Deploy mock ERC20 asset (e.g., USDC or DUCK)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    assetToken = await MockERC20.deploy("USD Coin", "USDC", 6); // Using 6 decimals for USDC
    
    // Deploy the ERC-4626 vault with AI agent role
    const ProtegoYieldVault = await ethers.getContractFactory("ProtegoYieldVault");
    vault = await ProtegoYieldVault.deploy(
      assetToken.address,
      custodian.address,
      aiAgent.address,
      "Protego Vault Shares",
      "pvs"
    );
    
    // Setup: mint tokens to investors
    await assetToken.mint(investor1.address, ethers.utils.parseUnits("1000", 6)); // 1000 USDC
    await assetToken.mint(investor2.address, ethers.utils.parseUnits("500", 6));  // 500 USDC
  });
  
  // ---

  describe("ERC-4626 Standard Compliance", function () {
    
    describe("Metadata & Core Functions", function () {
      it("Should return correct asset and decimals", async function () {
        expect(await vault.asset()).to.equal(assetToken.address);
        expect(await vault.decimals()).to.equal(6); // ERC-4626 follows asset decimals
      });
      
      it("Should return correct name and symbol", async function () {
        expect(await vault.name()).to.equal("Protego Vault Shares");
        expect(await vault.symbol()).to.equal("pvs");
      });

      it("Should convert assets to shares correctly", async function () {
        const assets = ethers.utils.parseUnits("100", 6); // 100 USDC
        const shares = await vault.convertToShares(assets);
        expect(shares).to.be.gt(0);
      });
      
      it("Should convert shares to assets correctly", async function () {
        // First deposit to establish share price
        const depositAmount = ethers.utils.parseUnits("100", 6);
        await assetToken.connect(investor1).approve(vault.address, depositAmount);
        await vault.connect(investor1).deposit(depositAmount, investor1.address);
        
        const investorShares = await vault.balanceOf(investor1.address);
        const assets = await vault.convertToAssets(investorShares);
        expect(assets).to.be.closeTo(depositAmount, 1);
      });
    });

    describe("Deposit & Mint", function () {
      it("Should allow deposit and mint shares", async function () {
        const depositAmount = ethers.utils.parseUnits("100", 6); // 100 USDC
        
        await assetToken.connect(investor1).approve(vault.address, depositAmount);
        
        await expect(vault.connect(investor1).deposit(depositAmount, investor1.address))
          .to.emit(vault, "Deposit")
          .withArgs(investor1.address, investor1.address, depositAmount, ethers.utils.parseUnits("100", 6));
        
        expect(await vault.balanceOf(investor1.address)).to.equal(ethers.utils.parseUnits("100", 6));
        expect(await assetToken.balanceOf(vault.address)).to.equal(depositAmount);
      });
      
      it("Should fail deposit with zero amount", async function () {
        await expect(vault.connect(investor1).deposit(0, investor1.address))
          .to.be.revertedWith("InvalidAmount");
      });

      it("Should mint exact shares for assets", async function () {
        const sharesToMint = ethers.utils.parseUnits("50", 6);
        const assetsNeeded = await vault.previewMint(sharesToMint);
        
        await assetToken.connect(investor1).approve(vault.address, assetsNeeded);
        
        await expect(vault.connect(investor1).mint(sharesToMint, investor1.address))
          .to.emit(vault, "Deposit")
          .withArgs(investor1.address, investor1.address, assetsNeeded, sharesToMint);
        
        expect(await vault.balanceOf(investor1.address)).to.equal(sharesToMint);
      });
    });
    
    describe("Withdraw & Redeem", function () {
      beforeEach(async function () {
        // Setup: investor1 deposits 200 USDC
        const depositAmount = ethers.utils.parseUnits("200", 6);
        await assetToken.connect(investor1).approve(vault.address, depositAmount);
        await vault.connect(investor1).deposit(depositAmount, investor1.address);
      });

      it("Should withdraw exact assets for shares", async function () {
        const withdrawAmount = ethers.utils.parseUnits("50", 6); // 50 USDC
        const initialBalance = await assetToken.balanceOf(investor1.address);
        
        await expect(vault.connect(investor1).withdraw(withdrawAmount, investor1.address, investor1.address))
          .to.emit(vault, "Withdraw");
        
        const finalBalance = await assetToken.balanceOf(investor1.address);
        expect(finalBalance.sub(initialBalance)).to.be.closeTo(withdrawAmount, 1);
      });
      
      it("Should redeem shares for exact assets", async function () {
        const investorShares = await vault.balanceOf(investor1.address);
        const halfShares = investorShares.div(2);
        
        const initialBalance = await assetToken.balanceOf(investor1.address);
        
        await expect(vault.connect(investor1).redeem(halfShares, investor1.address, investor1.address))
          .to.emit(vault, "Withdraw");
        
        const finalBalance = await assetToken.balanceOf(investor1.address);
        expect(finalBalance).to.be.gt(initialBalance);
        expect(await vault.balanceOf(investor1.address)).to.be.closeTo(investorShares.sub(halfShares), 1);
      });

      it("Should fail with insufficient balance", async function () {
        const tooMuch = ethers.utils.parseUnits("1000", 6);
        await expect(vault.connect(investor1).withdraw(tooMuch, investor1.address, investor1.address))
          .to.be.revertedWith("ExceededMaxWithdraw");
      });
    });
  });

  // ---

  describe("AI-Powered Features & Yield Management", function () {
    
    beforeEach(async function () {
      const depositAmount = ethers.utils.parseUnits("100", 6);
      await assetToken.connect(investor1).approve(vault.address, depositAmount);
      await vault.connect(investor1).deposit(depositAmount, investor1.address);
    });

    it("Should allow an AI agent to execute yield strategies", async function () {
      // Simulate an AI-driven deposit into the vault's underlying strategy
      const yieldAmount = ethers.utils.parseUnits("5", 6); // 5 USDC yield
      await assetToken.mint(vault.address, yieldAmount);
      
      // AI agent harvests the yield
      const tx = vault.connect(aiAgent).executeAIYieldStrategy();
      
      await expect(tx)
        .to.emit(vault, "YieldHarvested");
      
      // Total assets should have increased
      const totalAssets = await vault.totalAssets();
      expect(totalAssets).to.be.gt(ethers.utils.parseUnits("100", 6));
    });

    it("Should reject unauthorized AI agent calls", async function () {
      // User tries to call an AI-specific function
      await expect(vault.connect(investor1).executeAIYieldStrategy())
        .to.be.revertedWith("Only AI agent");
    });
    
    it("Should increase share price after yield harvest", async function () {
      const initialSharePrice = await vault.convertToAssets(ethers.utils.parseUnits("1", 6));
      
      // Simulate yield
      await assetToken.mint(vault.address, ethers.utils.parseUnits("10", 6));
      
      // AI Agent harvests yield
      await vault.connect(aiAgent).executeAIYieldStrategy();
      
      const finalSharePrice = await vault.convertToAssets(ethers.utils.parseUnits("1", 6));
      
      expect(finalSharePrice).to.be.gt(initialSharePrice);
    });
  });
  
  // ---

  describe("Admin & Control Functions", function () {
    
    it("Should allow the custodian to pause and unpause the vault", async function () {
      await vault.connect(custodian).pause();
      expect(await vault.paused()).to.be.true;
      
      // User deposit should fail when paused
      const depositAmount = ethers.utils.parseUnits("10", 6);
      await assetToken.connect(investor1).approve(vault.address, depositAmount);
      await expect(vault.connect(investor1).deposit(depositAmount, investor1.address))
        .to.be.revertedWith("Pausable: paused");
      
      await vault.connect(custodian).unpause();
      expect(await vault.paused()).to.be.false;
      
      // Deposit should work after unpausing
      await expect(vault.connect(investor1).deposit(depositAmount, investor1.address))
        .to.not.be.reverted;
    });
    
    it("Should allow the custodian to update the AI agent address", async function () {
      const newAI = investor2.address;
      
      const tx = vault.connect(custodian).updateAIagent(newAI);
      await expect(tx)
        .to.emit(vault, "AIagentUpdated")
        .withArgs(aiAgent.address, newAI);
      
      expect(await vault.aiAgent()).to.equal(newAI);
    });
    
    it("Should revert if an unauthorized account tries to pause", async function () {
      await expect(vault.connect(investor1).pause())
        .to.be.revertedWith("Only custodian");
    });
  });

  // ---

  describe("Integration Tests: Multiple Users & Yield Cycles", function () {
    
    it("Should maintain correct share pricing through multiple deposits and yield cycles", async function () {
      // Investor1 deposits 100 USDC
      const deposit1 = ethers.utils.parseUnits("100", 6);
      await assetToken.connect(investor1).approve(vault.address, deposit1);
      await vault.connect(investor1).deposit(deposit1, investor1.address);
      
      const shares1 = await vault.balanceOf(investor1.address);
      expect(shares1).to.equal(deposit1); // 1:1 ratio initially
      
      // Simulate AI-driven yield harvest of 10 USDC
      await assetToken.mint(vault.address, ethers.utils.parseUnits("10", 6));
      await vault.connect(aiAgent).executeAIYieldStrategy();
      
      // Investor2 deposits 100 USDC
      const deposit2 = ethers.utils.parseUnits("100", 6);
      await assetToken.connect(investor2).approve(vault.address, deposit2);
      await vault.connect(investor2).deposit(deposit2, investor2.address);
      
      const shares2 = await vault.balanceOf(investor2.address);
      
      // Investor2 should receive fewer shares for the same deposit amount due to yield
      expect(shares2).to.be.lt(deposit2);
      
      // Check share price consistency
      const sharePrice = await vault.convertToAssets(ethers.utils.parseUnits("1", 6));
      const expectedShares2 = deposit2.mul(ethers.utils.parseUnits("1", 6)).div(sharePrice);
      expect(shares2).to.equal(expectedShares2);
    });
  });
});