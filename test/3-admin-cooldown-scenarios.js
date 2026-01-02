/**
 * ТАБЛИЦА 2: ADMIN COOLDOWN SCENARIOS (48h Admin Cooldown)
 * 
 * Покрива ВСИЧКИ admin cooldown случаи:
 * - updateExemptSlot → 48h cooldown → ВСИЧКО блокирано
 * - updateDEX → 48h cooldown → ВСИЧКО блокирано
 * - setLiquidityPair → 48h cooldown → ВСИЧКО блокирано
 * - pause/setBlacklist/lock → РАБОТЯТ през cooldown
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ТАБЛИЦА 2: Admin Cooldown Scenarios (48h Admin Cooldown)", function() {
    let token;
    let owner, exempt1, exempt2, normal1, addr1, addr2, liquidityPair;
    
    const PAUSE_DURATION = 48 * 3600;
    const COOLDOWN_2H = 2 * 3600;
    
    async function buyFromDEX(buyer, amount) {
        await token.connect(liquidityPair).transfer(buyer.address, amount);
    }
    
    beforeEach(async function() {
        [owner, exempt1, exempt2, normal1, addr1, addr2, liquidityPair] = await ethers.getSigners();
        
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Setup exempt slots
        await token.updateExemptSlot(7, exempt1.address);
        await token.updateExemptSlot(8, exempt2.address);
        await time.increase(PAUSE_DURATION + 1);
        
        // Enable trading
        const tradingTime = await token.tradingEnabledTime();
        if (await time.latest() < tradingTime) {
            await time.increaseTo(tradingTime);
        }
        
        // Setup liquidity pair
        await token.setLiquidityPair(liquidityPair.address, true);
        await time.increase(PAUSE_DURATION + 1);
        
        // Distribute tokens
        await token.transfer(exempt1.address, ethers.parseEther("1000000"));
        await token.transfer(exempt2.address, ethers.parseEther("1000000"));
        await token.transfer(liquidityPair.address, ethers.parseEther("10000000"));
        
        // Give normal users tokens
        await buyFromDEX(normal1.address, ethers.parseEther("2000"));
        await time.increase(COOLDOWN_2H + 1);
    });
    
    describe("Trigger 1: updateExemptSlot", function() {
        it("Should block ALL transfers for 48h (even Exempt → Exempt)", async function() {
            // Trigger cooldown
            await token.updateExemptSlot(9, addr1.address);
            
            // Exempt → Exempt - BLOCKED!
            await expect(
                token.connect(exempt1).transfer(exempt2.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Admin cooldown");
            
            // Exempt → Normal - BLOCKED!
            await expect(
                token.connect(exempt1).transfer(normal1.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Admin cooldown");
            
            // Normal → Exempt - BLOCKED!
            await expect(
                token.connect(normal1).transfer(exempt1.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Admin cooldown");
        });
        
        it("Should block approve() during cooldown", async function() {
            await token.updateExemptSlot(9, addr1.address);
            
            await expect(
                token.connect(exempt1).approve(addr2.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Admin cooldown");
        });
        
        it("Should allow transfers after 48h", async function() {
            await token.updateExemptSlot(9, addr1.address);
            
            // Wait 48h
            await time.increase(PAUSE_DURATION + 1);
            
            // Now transfers work (but auto-pause expired too!)
            await expect(
                token.connect(exempt1).transfer(exempt2.address, ethers.parseEther("1000"))
            ).to.not.be.reverted;
        });
    });
    
    describe("Trigger 2: updateDEXAddresses", function() {
        it("Should block ALL transfers for 48h", async function() {
            await token.updateDEXAddresses(addr1.address, addr2.address);
            
            // All transfers blocked
            await expect(
                token.connect(exempt1).transfer(exempt2.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Admin cooldown");
        });
    });
    
    describe("Trigger 3: setLiquidityPair", function() {
        it("Should block ALL transfers for 48h", async function() {
            await token.setLiquidityPair(addr1.address, true);
            
            await expect(
                token.connect(exempt1).transfer(exempt2.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Admin cooldown");
        });
    });
    
    describe("Functions that WORK during cooldown", function() {
        beforeEach(async function() {
            // Trigger cooldown
            await token.updateExemptSlot(9, addr1.address);
        });
        
        it("pause() should work during cooldown", async function() {
            await expect(
                token.pause()
            ).to.not.be.reverted;
        });
        
        it("setBlacklist() should work during cooldown", async function() {
            await expect(
                token.setBlacklist(addr1.address, true)
            ).to.not.be.reverted;
        });
        
        it("lockExemptSlotsForever() should work during cooldown", async function() {
            await expect(
                token.lockExemptSlotsForever()
            ).to.not.be.reverted;
        });
        
        it("lockDEXAddresses() should work during cooldown", async function() {
            await expect(
                token.lockDEXAddresses()
            ).to.not.be.reverted;
        });
        
        it("lockLiquidityPairsForever() should work during cooldown", async function() {
            await expect(
                token.lockLiquidityPairsForever()
            ).to.not.be.reverted;
        });
    });
    
    describe("Auto-pause behavior", function() {
        it("Both admin cooldown and auto-pause expire together (48h)", async function() {
            await token.updateExemptSlot(9, addr1.address);
            
            // Wait for both to expire
            await time.increase(PAUSE_DURATION + 1);
            
            // Both cooldown AND pause expired
            // Normal transfers work now
            await expect(
                token.connect(normal1).transfer(addr1.address, ethers.parseEther("500"))
            ).to.not.be.reverted;
        });
    });
});
