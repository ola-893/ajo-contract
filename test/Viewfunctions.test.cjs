const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AjoCore - View Functions", function () {
    let ajoCore;
    let mockMembers, mockPayments, mockCollateral, mockGovernance;
    let mockUSDC, mockHBAR;
    let owner, addr1;

    // Enum from the contract for PaymentToken
    const PaymentToken = {
        USDC: 0,
        HBAR: 1
    };

    beforeEach(async function () {
        // Get signers
        [owner, addr1] = await ethers.getSigners();

        // Inside your beforeEach hook
        const initialSupply = ethers.parseEther("1000000"); // 1 million tokens

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC", initialSupply);
        mockHBAR = await MockERC20.deploy("Mock HBAR", "mHBAR", initialSupply);

        const MockAjoMembers = await ethers.getContractFactory("MockAjoMembers");
        mockMembers = await MockAjoMembers.deploy();

        const MockAjoPayments = await ethers.getContractFactory("MockAjoPayments");
        mockPayments = await MockAjoPayments.deploy();

        const MockAjoCollateral = await ethers.getContractFactory("MockAjoCollateral");
        mockCollateral = await MockAjoCollateral.deploy();

        const MockAjoGovernance = await ethers.getContractFactory("MockAjoGovernance");
        mockGovernance = await MockAjoGovernance.deploy();

        // --- Deploy the main AjoCore contract with mock addresses ---
        const AjoCore = await ethers.getContractFactory("AjoCore");
        ajoCore = await AjoCore.deploy(
            mockUSDC.address,
            mockHBAR.address,
            mockMembers.address,
            mockCollateral.address,
            mockPayments.address,
            mockGovernance.address
        );
    });

    describe("getMemberInfo(address member)", function () {
        it("should correctly retrieve member information from dependency contracts", async function () {
            // 1. Setup mock data
            const memberStruct = {
                queueNumber: 5,
                joinedCycle: 1,
                totalPaid: ethers.utils.parseEther("500"),
                requiredCollateral: ethers.utils.parseEther("1000"),
                lockedCollateral: ethers.utils.parseEther("1000"),
                lastPaymentCycle: 2,
                defaultCount: 0,
                hasReceivedPayout: false,
                isActive: true,
                guarantor: ethers.constants.AddressZero,
                preferredToken: PaymentToken.USDC,
                reputationScore: 750,
                pastPayments: [],
                guaranteePosition: 0
            };
            await mockMembers.setMember(addr1.address, memberStruct);
            await mockPayments.setPendingPenalty(addr1.address, ethers.utils.parseEther("50"));

            // 2. Call the function on AjoCore
            const [memberInfo, pendingPenalty, effectiveVotingPower] = await ajoCore.getMemberInfo(addr1.address);

            // 3. Assert the results
            expect(memberInfo.queueNumber).to.equal(5);
            expect(memberInfo.isActive).to.be.true;
            expect(memberInfo.reputationScore).to.equal(750);
            expect(pendingPenalty).to.equal(ethers.utils.parseEther("50"));
            expect(effectiveVotingPower).to.equal(2); // This is hardcoded in your contract
        });
    });

    describe("getQueueInfo(address member)", function () {
        it("should return the queue position and wait time from the members contract", async function () {
            // 1. Setup mock data
            await mockMembers.setQueueInfo(addr1.address, 10, 9); // Position 10, 9 cycles wait

            // 2. Call function
            const [position, estimatedCyclesWait] = await ajoCore.getQueueInfo(addr1.address);

            // 3. Assert
            expect(position).to.equal(10);
            expect(estimatedCyclesWait).to.equal(9);
        });
    });

    describe("needsToPayThisCycle(address member)", function () {
        it("should return true if the member needs to pay", async function () {
            await mockPayments.setNeedsToPay(addr1.address, true);
            expect(await ajoCore.needsToPayThisCycle(addr1.address)).to.be.true;
        });

        it("should return false if the member does not need to pay", async function () {
            await mockPayments.setNeedsToPay(addr1.address, false);
            expect(await ajoCore.needsToPayThisCycle(addr1.address)).to.be.false;
        });
    });

    describe("getContractStats()", function () {
        it("should return aggregated stats from the members contract", async function () {
             // Mock data is already set inside the MockAjoMembers contract's getContractStats function
            const [
                totalMembers,
                activeMembers,
                totalCollateralUSDC,
                totalCollateralHBAR,
                contractBalanceUSDC,
                contractBalanceHBAR,
                currentQueuePosition,
                activeToken
            ] = await ajoCore.getContractStats();

            expect(totalMembers).to.equal(100);
            expect(activeMembers).to.equal(95);
            expect(totalCollateralUSDC).to.equal(ethers.utils.parseEther("50000"));
            expect(currentQueuePosition).to.equal(15);
        });
    });

    describe("getTokenConfig(PaymentToken token)", function () {
        it("should return the token configuration from the payments contract", async function () {
            // Mock data is already set inside MockAjoPayments
            const tokenConfig = await ajoCore.getTokenConfig(PaymentToken.USDC);

            expect(tokenConfig.isActive).to.be.true;
            expect(tokenConfig.monthlyPayment).to.equal(ethers.utils.parseEther("100"));
        });
    });

    describe("getCollateralDemo(uint256 participants, uint256 monthlyPayment)", function () {
        it("should return arrays of positions and required collaterals", async function () {
            const participants = 5;
            const monthlyPayment = ethers.utils.parseEther("100");

            // The mock `calculateRequiredCollateral` returns `monthlyPayment * (participants - position)`
            // So for 5 participants, monthly 100:
            // Pos 1: 100 * (5-1) = 400
            // Pos 2: 100 * (5-2) = 300
            // ...
            // Pos 5: 100 * (5-5) = 0

            const [positions, collaterals] = await ajoCore.getCollateralDemo(participants, monthlyPayment);

            expect(positions.length).to.equal(participants);
            expect(collaterals.length).to.equal(participants);

            expect(positions[0]).to.equal(1);
            expect(collaterals[0]).to.equal(ethers.utils.parseEther("400")); // 100 * 4

            expect(positions[4]).to.equal(5);
            expect(collaterals[4]).to.equal(ethers.utils.parseEther("0"));   // 100 * 0
        });
    });

    describe("calculateSeizableAssets(address defaulterAddress)", function () {
        it("should return the seizable asset details from the collateral contract", async function () {
            // Mock data is already set inside MockAjoCollateral
            const [totalSeizable, collateralSeized, paymentsSeized] = await ajoCore.calculateSeizableAssets(addr1.address);

            expect(totalSeizable).to.equal(ethers.utils.parseEther("1200"));
            expect(collateralSeized).to.equal(ethers.utils.parseEther("1000"));
            expect(paymentsSeized).to.equal(ethers.utils.parseEther("200"));
        });
    });
});