/**
 * ТАБЛИЦА 4: LIQUIDITY SCENARIOS (DEX Operations)
 * 
 * Покрива ВСИЧКИ liquidity случаи:
 * - Add Liquidity: Exempt ✅ / Normal ❌
 * - Remove Liquidity: Exempt ✅ / Normal ❌
 * - Buy (Pool → User): Exempt ✅ / Normal ✅ (max 2000)
 * - Sell (User → Pool): Exempt ✅ / Normal ❌
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ТАБЛИЦА 4: Liquidity Scenarios (DEX Operations)", function() {
    let token;
    let owner, exempt1, exempt2, normal1, normal2;
    let router, factory, liquidityPair;
    
    const PAUSE_DURATION = 48 * 3600;
    const AFTER_ADMIN_LOCK = 48 * 60 * 60 + 1;
    const COOLDOWN_2H = 2 * 3600;
    
    async function buyFromDEX(buyer, amount) {
        await token.connect(liquidityPair).approve(router.address, amount);
        await token.connect(router).transferFrom(liquidityPair.address, buyer.address, amount);
    }
    
    beforeEach(async function() {
        [owner, exempt1, exempt2, normal1, normal2, router, factory, liquidityPair] = await ethers.getSigners();
        
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Setup DEX addresses
        await token.updateDEXAddresses(router.address, factory.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Setup exempt slots (including liquidityPair)
        await token.updateExemptSlot(7, exempt1.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        await token.updateExemptSlot(8, exempt2.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        await token.updateExemptSlot(9, liquidityPair.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Setup liquidity pair
        await token.setLiquidityPair(liquidityPair.address, true);
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Enable trading
        const tradingTime = await token.tradingEnabledTime();
        if (await time.latest() < tradingTime) {
            await time.increaseTo(tradingTime);
        }
        
        // Distribute tokens
        await token.transfer(exempt1.address, ethers.parseEther("1000000"));
        await token.transfer(exempt2.address, ethers.parseEther("1000000"));
        await token.transfer(liquidityPair.address, ethers.parseEther("1000000"));
        
        // Give normal users tokens
        await buyFromDEX(normal1, ethers.parseEther("2000"));
        await time.increase(COOLDOWN_2H + 1);
        
        await buyFromDEX(normal2, ethers.parseEther("2000"));
        await time.increase(COOLDOWN_2H + 1);
    });
    
    describe("OPERATION 1: Add Liquidity (User → Pool)", function() {
        it("Exempt ✅ CAN add liquidity", async function() {
            await expect(
                token.connect(exempt1).transfer(liquidityPair.address, ethers.parseEther("100000"))
            ).to.not.be.reverted;
        });
        
        it("Normal ❌ CANNOT add liquidity", async function() {
            await expect(
                token.connect(normal1).transfer(liquidityPair.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Normal users cannot add liquidity directly");
        });
    });
    
    describe("OPERATION 2: Remove Liquidity (Pool → User)", function() {
        it("Exempt ✅ CAN remove liquidity", async function() {
            // Simulate router removing liquidity (Pool → Exempt)
            await expect(
                token.connect(liquidityPair).transfer(exempt1.address, ethers.parseEther("50000"))
            ).to.not.be.reverted;
        });
        
        it("Normal ❌ CANNOT remove liquidity", async function() {
            // Simulate router trying to send to Normal user (Pool → Normal)
            await expect(
                token.connect(liquidityPair).transfer(normal1.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Normal users cannot remove liquidity directly");
        });
    });
    
    describe("OPERATION 3: Buy (Pool → User via Router)", function() {
        it("Router can send to Exempt (no limit)", async function() {
            // Give router approval
            await token.connect(liquidityPair).approve(router.address, ethers.parseEther("1000000"));
            
            // Router executes buy: Pool → Exempt
            await expect(
                token.connect(router).transferFrom(
                    liquidityPair.address,
                    exempt1.address,
                    ethers.parseEther("50000")
                )
            ).to.not.be.reverted;
        });
        
        it("Router can send to Normal (max 2000)", async function() {
            await token.connect(liquidityPair).approve(router.address, ethers.parseEther("1000000"));
            
            // Router executes buy: Pool → Normal (max 2000)
            await expect(
                token.connect(router).transferFrom(
                    liquidityPair.address,
                    normal1.address,
                    ethers.parseEther("2000")
                )
            ).to.not.be.reverted;
        });
        
        it("Router CANNOT send > 2000 to Normal", async function() {
            await token.connect(liquidityPair).approve(router.address, ethers.parseEther("1000000"));
            
            await expect(
                token.connect(router).transferFrom(
                    liquidityPair.address,
                    normal1.address,
                    ethers.parseEther("2001")
                )
            ).to.be.revertedWith("Max 2000");
        });
    });
    
    describe("OPERATION 4: Sell (User → Pool via Router)", function() {
        it("Exempt ✅ CAN sell to pool", async function() {
            // Exempt approves router
            await token.connect(exempt1).approve(router.address, ethers.parseEther("100000"));
            
            // Router executes sell: Exempt → Pool
            await expect(
                token.connect(router).transferFrom(
                    exempt1.address,
                    liquidityPair.address,
                    ethers.parseEther("50000")
                )
            ).to.not.be.reverted;
        });
        
        it("Normal ❌ CANNOT sell to pool directly", async function() {
            await expect(
                token.connect(normal1).transfer(liquidityPair.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Normal users cannot add liquidity directly");
        });
        
        it("Normal ❌ CANNOT sell via Router", async function() {
            // Normal approves router
            await token.connect(normal1).approve(router.address, ethers.parseEther("5000"));
            
            await time.increase(PAUSE_DURATION + 1);
            
            // Router tries to sell: Normal → Pool
            await expect(
                token.connect(router).transferFrom(
                    normal1.address,
                    liquidityPair.address,
                    ethers.parseEther("1000")
                )
            ).to.be.revertedWith("Normal users cannot add liquidity directly");
        });
    });
    
    describe("DEX Configuration", function() {
        it("Should recognize router as exempt", async function() {
            expect(await token.isExemptAddress(router.address)).to.equal(true);
        });
        
        it("Should recognize factory as exempt", async function() {
            expect(await token.isExemptAddress(factory.address)).to.equal(true);
        });
        
        it("Should allow locking DEX forever", async function() {
            await token.lockDEXAddresses();
            
            expect(await token.dexAddressesLocked()).to.equal(true);
            
            // Cannot update anymore
            await expect(
                token.updateDEXAddresses(exempt1.address, exempt2.address)
            ).to.be.revertedWith("DEX locked");
        });
        
        it("Should allow locking liquidity pair forever", async function() {
            await token.lockLiquidityPairsForever();
            
            expect(await token.liquidityPairsLocked()).to.equal(true);
            
            // Cannot update anymore
            await expect(
                token.setLiquidityPair(exempt1.address, true)
            ).to.be.revertedWith("Pairs locked");
        });
    });
});
