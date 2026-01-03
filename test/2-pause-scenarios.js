/**
 * VERSION: 1.0056
 */
/**
 * ТАБЛИЦА 1: PAUSE SCENARIOS (Pause Behavior)
 * 
 * Покрива ВСИЧКИ pause случаи:
 * - Exempt → Exempt = ✅ РАЗРЕШЕН (при pause)
 * - Exempt → Normal = ❌ БЛОКИРАН (при pause)
 * - Normal → Exempt = ❌ БЛОКИРАН (при pause)
 * - Normal → Normal = ❌ БЛОКИРАН (при pause)
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ТАБЛИЦА 1: Pause Scenarios (Pause Behavior)", function() {
    let token;
    let owner, exempt1, exempt2, normal1, normal2, router, liquidityPair;
    
    const PAUSE_DURATION = 48 * 3600;
    const AFTER_ADMIN_LOCK = 48 * 60 * 60 + 1;
    const COOLDOWN_2H = 2 * 3600;
    
    async function buyFromDEX(buyer, amount) {
        await token.connect(liquidityPair).approve(router.address, amount);
        await token.connect(router).transferFrom(liquidityPair.address, buyer.address, amount);
    }
    
    beforeEach(async function() {
        [owner, exempt1, exempt2, normal1, normal2, router, liquidityPair] = await ethers.getSigners();
        
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Setup router
        await token.updateDEXAddresses(router.address, owner.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Setup exempt slots (including liquidityPair)
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
        
        // Distribute tokens
        await token.transfer(exempt1.address, ethers.parseEther("1000000"));
        await token.transfer(exempt2.address, ethers.parseEther("1000000"));
        await token.transfer(liquidityPair.address, ethers.parseEther("10000000"));
        
        // Give normal users tokens via DEX
        await buyFromDEX(normal1, ethers.parseEther("2000"));
        await time.increase(COOLDOWN_2H + 1);
        
        await buyFromDEX(normal2, ethers.parseEther("2000"));
        await time.increase(COOLDOWN_2H + 1);
    });
    
    describe("During PAUSE (48h)", function() {
        beforeEach(async function() {
            // Activate pause
            await token.pause();
        });
        
        it("CASE 1: Exempt → Exempt = ✅ РАЗРЕШЕН", async function() {
            await expect(
                token.connect(exempt1).transfer(exempt2.address, ethers.parseEther("100000"))
            ).to.not.be.reverted;
        });
        
        it("CASE 2: Exempt → Normal = ❌ БЛОКИРАН", async function() {
            await expect(
                token.connect(exempt1).transfer(normal1.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Paused");
        });
        
        it("CASE 3: Normal → Exempt = ❌ БЛОКИРАН", async function() {
            await expect(
                token.connect(normal1).transfer(exempt1.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Paused");
        });
        
        it("CASE 4: Normal → Normal = ❌ БЛОКИРАН", async function() {
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Paused");
        });
        
        it("Should auto-unpause after 48h", async function() {
            // Wait for pause to expire
            await time.increase(PAUSE_DURATION + 1);
            
            // Now Normal → Normal should work
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("500"))
            ).to.not.be.reverted;
        });
    });
    
    describe("During NORMAL (no pause)", function() {
        it("All transfer types should work (respecting limits)", async function() {
            // Exempt → Exempt
            await expect(
                token.connect(exempt1).transfer(exempt2.address, ethers.parseEther("100000"))
            ).to.not.be.reverted;
            
            // Exempt → Normal (max 100)
            await expect(
                token.connect(exempt1).transfer(normal1.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
            
            // Normal → Exempt (max 2000)
            await expect(
                token.connect(normal1).transfer(exempt1.address, ethers.parseEther("1000"))
            ).to.not.be.reverted;
            
            // Wait cooldown
            await time.increase(COOLDOWN_2H + 1);
            
            // Normal → Normal (max 2000)
            await expect(
                token.connect(normal1).transfer(normal2.address, ethers.parseEther("500"))
            ).to.not.be.reverted;
        });
    });
    
    describe("Pause Mechanics", function() {
        it("Should only allow admin to pause", async function() {
            await expect(
                token.connect(normal1).pause()
            ).to.be.revertedWith("Not admin");
        });
        
        it("Should NOT have unpause() function", async function() {
            expect(token.unpause).to.be.undefined;
        });
        
        it("Should allow pause() to be called during admin cooldown", async function() {
            // Trigger admin cooldown
            await token.updateExemptSlot(9, normal1.address);
            
            // pause() should still work
            await expect(
                token.pause()
            ).to.not.be.reverted;
        });
        
        it("Should stack pause durations if called multiple times", async function() {
            await token.pause();
            
            const pausedUntil1 = await token.NotExemptTradeTransferPausedUntil();
            
            // Wait 10 hours
            await time.increase(10 * 3600);
            
            // Pause again (while still paused)
            await token.pause();
            
            const pausedUntil2 = await token.NotExemptTradeTransferPausedUntil();
            
            // New pause should extend from NOW + 48h
            expect(pausedUntil2).to.be.gt(pausedUntil1);
        });
    });
});
