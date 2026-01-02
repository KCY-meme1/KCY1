/**
 * ТАБЛИЦА 3: TRANSFER SCENARIOS (Fees, Limits, Cooldowns)
 * 
 * Покрива ВСИЧКИ transfer случаи:
 * - Exempt → Exempt (no fees, no limits, no cooldown)
 * - Exempt → Normal (0.08% fees, max 100, 24h sender cooldown)
 * - Normal → Exempt (0.08% fees, max 2000, 2h sender cooldown)
 * - Normal → Normal (0.08% fees, max 2000 tx / 4000 wallet, 2h sender cooldown)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ТАБЛИЦА 3: Transfer Scenarios (Fees, Limits, Cooldowns)", function() {
    let token;
    let owner, exempt1, exempt2, normal1, normal2, router, liquidityPair;
    
    const PAUSE_DURATION = 48 * 3600;
    const AFTER_ADMIN_LOCK = 48 * 60 * 60 + 1;
    const COOLDOWN_2H = 2 * 3600;
    const COOLDOWN_24H = 24 * 3600;
    
    // Helper: Simulate realistic DEX purchase (router executes: pool → buyer)
    async function buyFromDEX(buyer, amount) {
        if (amount > ethers.parseEther("2000")) {
            throw new Error("DEX limit: max 2000 tokens per buy");
        }
        // Approve router to spend liquidityPair's tokens
        await token.connect(liquidityPair).approve(router.address, amount);
        // Router executes transferFrom: liquidityPair → buyer
        await token.connect(router).transferFrom(liquidityPair.address, buyer.address, amount);
    }
    
    beforeEach(async function() {
        [owner, exempt1, exempt2, normal1, normal2, router, liquidityPair] = await ethers.getSigners();
        
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Setup router as DEX
        await token.updateDEXAddresses(router.address, owner.address); // router + dummy factory
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Owner is already in slot 1 (from constructor)
        // Setup test exempt slots (7-9)
        await token.updateExemptSlot(7, exempt1.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        await token.updateExemptSlot(8, exempt2.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        await token.updateExemptSlot(9, liquidityPair.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Enable trading
        const tradingTime = await token.tradingEnabledTime();
        if (await time.latest() < tradingTime) {
            await time.increaseTo(tradingTime);
        }
        
        // Setup liquidity pair
        await token.setLiquidityPair(liquidityPair.address, true);
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Initial distribution (owner→exempt = exempt→exempt, no limit)
        await token.transfer(exempt1.address, ethers.parseEther("1000000")); // 1M
        await token.transfer(exempt2.address, ethers.parseEther("1000000")); // 1M
        await token.transfer(liquidityPair.address, ethers.parseEther("10000000")); // 10M to pool
    });
    
    describe("CASE 1: Exempt → Exempt", function() {
        it("Should allow unlimited transfers with NO fees and NO cooldown", async function() {
            const amount = ethers.parseEther("500000"); // 500k
            
            const balanceBefore = await token.balanceOf(exempt2.address);
            
            // Transfer 1
            await token.connect(exempt1).transfer(exempt2.address, amount);
            
            // Should receive EXACT amount (no fees)
            let balanceAfter = await token.balanceOf(exempt2.address);
            expect(balanceAfter).to.equal(balanceBefore + amount);
            
            // Immediate second transfer (NO cooldown!)
            await token.connect(exempt1).transfer(exempt2.address, amount);
            
            balanceAfter = await token.balanceOf(exempt2.address);
            expect(balanceAfter).to.equal(balanceBefore + amount + amount);
        });
    });
    
    describe("CASE 2: Exempt → Normal", function() {
        it("Should enforce 100 token MAX limit", async function() {
            // Below limit - OK
            await expect(
                token.connect(exempt1).transfer(normal1.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
            
            // Above limit - FAIL
            await expect(
                token.connect(exempt1).transfer(normal2.address, ethers.parseEther("101"))
            ).to.be.revertedWith("Max 100");
        });
        
        it("Should apply 0.08% fees", async function() {
            const amount = ethers.parseEther("100");
            const balanceBefore = await token.balanceOf(normal1.address);
            
            await token.connect(exempt1).transfer(normal1.address, amount);
            
            // Calculate expected: amount - (amount * 80 / 100000)
            const fee = (amount * 80n) / 100000n;
            const expected = amount - fee;
            
            const balanceAfter = await token.balanceOf(normal1.address);
            expect(balanceAfter).to.equal(balanceBefore + expected);
        });
        
        it("Should enforce 24h SENDER cooldown", async function() {
            // First transfer - OK
            await token.connect(exempt1).transfer(normal1.address, ethers.parseEther("50"));
            
            // Second transfer from SAME SENDER immediately - FAIL (24h sender cooldown!)
            await expect(
                token.connect(exempt1).transfer(normal2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Wait 24h");
            
            // But DIFFERENT sender can transfer - OK
            await expect(
                token.connect(exempt2).transfer(normal1.address, ethers.parseEther("50"))
            ).to.not.be.reverted;
            
            // After 24h - SAME sender can transfer again
            await time.increase(COOLDOWN_24H + 1);
            await expect(
                token.connect(exempt1).transfer(normal2.address, ethers.parseEther("50"))
            ).to.not.be.reverted;
        });
    });
    
    describe("CASE 3: Normal → Exempt", function() {
        it("Should enforce 2000 token MAX limit", async function() {
            // Setup: normal1 buys from DEX (realistic!)
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal1, ethers.parseEther("2000")); // Total: ~3992 (after fees)
            await time.increase(COOLDOWN_2H + 1);
            
            // Below limit - OK
            await expect(
                token.connect(normal1).transfer(exempt1.address, ethers.parseEther("2000"))
            ).to.not.be.reverted;
            
            await time.increase(COOLDOWN_2H + 1);
            
            // Above limit - FAIL (normal1 has ~1992 left, try to send 2001)
            await expect(
                token.connect(normal1).transfer(exempt1.address, ethers.parseEther("2001"))
            ).to.be.revertedWith("Max 2000");
        });
        
        it("Should apply 0.08% fees", async function() {
            // Setup
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            const amount = ethers.parseEther("1000");
            const balanceBefore = await token.balanceOf(exempt1.address);
            
            await token.connect(normal1).transfer(exempt1.address, amount);
            
            // Calculate expected: amount - fees
            const fee = (amount * 80n) / 100000n;
            const expected = amount - fee;
            
            const balanceAfter = await token.balanceOf(exempt1.address);
            expect(balanceAfter).to.equal(balanceBefore + expected);
        });
        
        it("Should enforce 2h sender cooldown", async function() {
            // Setup
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            // First transfer - OK
            await token.connect(normal1).transfer(exempt1.address, ethers.parseEther("1000"));
            
            // Second transfer immediately - FAIL (sender cooldown)
            await expect(
                token.connect(normal1).transfer(exempt2.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Wait 2h");
            
            // Different sender - OK
            await buyFromDEX(normal2, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            await expect(
                token.connect(normal2).transfer(exempt1.address, ethers.parseEther("1000"))
            ).to.not.be.reverted;
            
            // After 2h - OK
            await time.increase(COOLDOWN_2H + 1);
            await expect(
                token.connect(normal1).transfer(exempt2.address, ethers.parseEther("1000"))
            ).to.not.be.reverted;
        });
    });
    
    describe("CASE 4: Normal → Normal", function() {
        it("Should enforce 2000 token MAX TX limit", async function() {
            // Setup
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal1, ethers.parseEther("2000")); // Total: ~3992
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal2, ethers.parseEther("1000"));
            await time.increase(COOLDOWN_2H + 1);
            
            // Below limit - OK (send 2000)
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("2000"))
            ).to.not.be.reverted; // normal2: ~2996, normal1: ~1992
            
            await time.increase(COOLDOWN_2H + 1);
            
            // Above limit - FAIL (try to send 2001, which also exceeds balance ~1992)
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("2001"))
            ).to.be.revertedWith("Max 2000");
        });
        
        it("Should enforce 4000 token MAX WALLET limit", async function() {
            // Setup: Get normal2 close to 4000 limit
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal1, ethers.parseEther("2000")); // normal1: ~3992
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal2, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal2, ethers.parseEther("2000")); // normal2: ~3992
            await time.increase(COOLDOWN_2H + 1);
            
            // Transfer small amount → normal2 will be at/near 4000 limit
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("8"))
            ).to.not.be.reverted; // normal2: ~4000
            
            await time.increase(COOLDOWN_2H + 1);
            
            // Try to send more → exceeds 4000 wallet limit
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("1"))
            ).to.be.revertedWith("Max wallet 4k");
        });
        
        it("Should apply 0.08% fees", async function() {
            // Setup
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            const amount = ethers.parseEther("1000");
            const balanceBefore = await token.balanceOf(normal2.address);
            
            await token.connect(normal1).transfer(normal2.address, amount);
            
            // Calculate expected
            const fee = (amount * 80n) / 100000n;
            const expected = amount - fee;
            
            const balanceAfter = await token.balanceOf(normal2.address);
            expect(balanceAfter).to.equal(balanceBefore + expected);
        });
        
        it("Should enforce 2h sender cooldown", async function() {
            // Setup
            await buyFromDEX(normal1, ethers.parseEther("2000"));
            await time.increase(COOLDOWN_2H + 1);
            
            await buyFromDEX(normal2, ethers.parseEther("1000"));
            await time.increase(COOLDOWN_2H + 1);
            
            // First transfer - OK
            await token.connect(normal1).transfer(normal2.address, ethers.parseEther("1000"));
            
            // Second transfer immediately - FAIL
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Wait 2h");
            
            // After 2h - OK
            await time.increase(COOLDOWN_2H + 1);
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("500"))
            ).to.not.be.reverted;
        });
    });
});
