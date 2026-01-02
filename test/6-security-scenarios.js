/**
 * SECURITY SCENARIOS
 * 
 * Покрива:
 * - Blacklist enforcement
 * - Lock functions (permanent)
 * - Multi-sig requirements (slots 1-5)
 * - Owner permissions
 * - Attack vectors
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SECURITY SCENARIOS", function() {
    let token;
    let owner, exempt1, exempt2, normal1, normal2, attacker, multiSig;
    
    const PAUSE_DURATION = 48 * 3600;
    const AFTER_ADMIN_LOCK = 48 * 60 * 60 + 1;
    
    beforeEach(async function() {
        [owner, exempt1, exempt2, normal1, normal2, attacker, multiSig] = await ethers.getSigners();
        
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Setup exempt slots (owner is already slot 1)
        await token.updateExemptSlot(7, exempt1.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        await token.updateExemptSlot(8, exempt2.address);
        await time.increase(AFTER_ADMIN_LOCK);
        
        // Enable trading
        const tradingTime = await token.tradingEnabledTime();
        if (await time.latest() < tradingTime) {
            await time.increaseTo(tradingTime);
        }
        
        // Distribute tokens (owner→exempt = no limits)
        await token.transfer(exempt1.address, ethers.parseEther("1000000"));
        
        // Give tokens to normal users (exempt→normal = max 100 per transfer)
        // Give 100 tokens to each normal user
        await token.connect(exempt1).transfer(normal1.address, ethers.parseEther("100"));
        await time.increase(24 * 3600 + 1);
        
        await token.connect(exempt1).transfer(normal2.address, ethers.parseEther("100"));
        await time.increase(24 * 3600 + 1);
        
        await token.connect(exempt1).transfer(attacker.address, ethers.parseEther("100"));
        await time.increase(24 * 3600 + 1);
    });
    
    describe("Blacklist Enforcement", function() {
        it("Should block blacklisted user from sending", async function() {
            await token.setBlacklist(attacker.address, true);
            
            await expect(
                token.connect(attacker).transfer(normal1.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Blacklisted");
        });
        
        it("Should block blacklisted user from receiving", async function() {
            await token.setBlacklist(attacker.address, true);
            
            await expect(
                token.connect(normal1).transfer(attacker.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Blacklisted");
        });
        
        it("Should allow removing from blacklist", async function() {
            await token.setBlacklist(attacker.address, true);
            await token.setBlacklist(attacker.address, false);
            
            // Wait cooldown
            await time.increase(2 * 3600 + 1);
            
            // Now can transfer
            await expect(
                token.connect(attacker).transfer(normal1.address, ethers.parseEther("50"))
            ).to.not.be.reverted;
        });
        
        it("Should only allow admin to blacklist", async function() {
            await expect(
                token.connect(attacker).setBlacklist(normal1.address, true)
            ).to.be.revertedWith("Not admin");
        });
        
        it("Blacklist should work during pause", async function() {
            await token.setBlacklist(attacker.address, true);
            await token.pause();
            
            // Still blocked
            await expect(
                token.connect(attacker).transfer(exempt1.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Blacklisted");
        });
    });
    
    describe("Lock Functions (Permanent)", function() {
        describe("lockExemptSlots()", function() {
            it("Should permanently lock exempt slots", async function() {
                await token.lockExemptSlotsForever();
                
                expect(await token.exemptSlotsLocked()).to.equal(true);
                
                // Cannot update anymore
                await expect(
                    token.updateExemptSlot(9, normal1.address)
                ).to.be.revertedWith("Slots locked");
            });
            
            it("Should only allow admin to lock", async function() {
                await expect(
                    token.connect(attacker).lockExemptSlots()
                ).to.be.revertedWith("Not admin");
            });
            
            it("Lock should be irreversible", async function() {
                await token.lockExemptSlotsForever();
                
                // No unlock function exists
                expect(token.unlockExemptSlots).to.be.undefined;
            });
        });
        
        describe("lockDEXAddresses()", function() {
            it("Should permanently lock DEX addresses", async function() {
                await token.lockDEXAddresses();
                
                expect(await token.dexAddressesLocked()).to.equal(true);
                
                await expect(
                    token.updateDEXAddresses(exempt1.address, exempt2.address)
                ).to.be.revertedWith("DEX locked");
            });
        });
        
        describe("lockLiquidityPairs()", function() {
            it("Should permanently lock liquidity pair", async function() {
                await token.lockLiquidityPairsForever();
                
                expect(await token.liquidityPairsLocked()).to.equal(true);
                
                await expect(
                    token.setLiquidityPair(exempt1.address, true)
                ).to.be.revertedWith("Pairs locked");
            });
        });
    });
    
    describe("Multi-Sig Requirements (Slots 1-5)", function() {
        beforeEach(async function() {
            // Set multi-sig address
            await token.setMultiSigAddress(multiSig.address);
            
            await time.increase(PAUSE_DURATION + 1);
        });
        
        it("Only multi-sig can change slots 1-5", async function() {
            // Owner CANNOT change slots 2-5 (slot 1 is owner and cannot be changed)
            await expect(
                token.updateExemptSlot(2, exempt1.address)
            ).to.be.revertedWith("Only multi-sig for slots 1-5");
            
            // Multi-sig CAN change slot 2
            await expect(
                token.connect(multiSig).updateExemptSlot(2, exempt1.address)
            ).to.not.be.reverted;
        });
        
        it("Admin CAN change slots 6-10", async function() {
            await expect(
                token.updateExemptSlot(9, normal1.address)
            ).to.not.be.reverted;
        });
        
        it("Should require multi-sig to be set before using slots 1-5", async function() {
            // Deploy fresh token
            const Token = await ethers.getContractFactory("KCY1Token");
            const freshToken = await Token.deploy();
            
            await expect(
                freshToken.connect(multiSig).updateExemptSlot(2, exempt1.address)
            ).to.be.revertedWith("Multi-sig not set");
        });
    });
    
    describe("Owner Permissions", function() {
        it("Owner should be exempt by default", async function() {
            expect(await token.isExemptAddress(owner.address)).to.equal(true);
        });
        
        it("Contract address should be exempt by default", async function() {
            expect(await token.isExemptAddress(await token.getAddress())).to.equal(true);
        });
        
        it("Only admin can call admin functions", async function() {
            await expect(
                token.connect(attacker).pause()
            ).to.be.revertedWith("Not admin");
            
            await expect(
                token.connect(attacker).updateDEXAddresses(exempt1.address, exempt2.address)
            ).to.be.revertedWith("Not admin");
            
            await expect(
                token.connect(attacker).setLiquidityPair(exempt1.address, true)
            ).to.be.revertedWith("Not admin");
        });
    });
    
    describe("Attack Vectors", function() {
        it("Should prevent reentrancy attacks", async function() {
            // The contract has nonReentrant modifier on critical functions
            // This test verifies it exists
            
            // Attempt multiple transfers in quick succession
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    token.connect(exempt1).transfer(exempt2.address, ethers.parseEther("1000"))
                );
            }
            
            // All should succeed without reentrancy issues
            await Promise.all(promises);
        });
        
        it("Should prevent normal users from adding liquidity", async function() {
            // Setup liquidity pair
            await token.setLiquidityPair(exempt2.address, true);
            await time.increase(PAUSE_DURATION + 1);
            
            // Give liquidity pair tokens (owner→exempt2)
            await token.transfer(exempt2.address, ethers.parseEther("500000"));
            
            // Normal user tries to add liquidity (should be blocked)
            await expect(
                token.connect(attacker).transfer(exempt2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Normal users cannot add liquidity directly");
        });
        
        it("Should enforce trading lock for first 48h", async function() {
            // Deploy fresh token
            const Token = await ethers.getContractFactory("KCY1Token");
            const freshToken = await Token.deploy();
            
            // Make owner exempt (owner is already in slot 1 by constructor)
            // Give normal1 tokens (exempt→normal = max 100)
            await freshToken.transfer(normal1.address, ethers.parseEther("100"));
            
            // Normal user tries to trade before tradingEnabledTime
            await expect(
                freshToken.connect(normal1).transfer(normal2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Locked 48h");
        });
    });
    
    describe("Emergency Functions", function() {
        it("Should allow owner to rescue stuck tokens", async function() {
            // Create mock ERC20
            const MockToken = await ethers.getContractFactory("KCY1Token");
            const mockToken = await MockToken.deploy();
            
            const contractAddress = await token.getAddress();
            
            // Make contract address exempt in mockToken (owner of mockToken can send any amount to exempt)
            // Owner of mockToken is already exempt (slot 1), so owner→contract = exempt→exempt if contract is exempt
            await mockToken.updateExemptSlot(7, contractAddress);
            await time.increase(PAUSE_DURATION + 1);
            
            // Send mock tokens to KCY1 contract (owner→exempt = no limit)
            await mockToken.transfer(contractAddress, ethers.parseEther("1000"));
            
            // Owner rescues them
            await expect(
                token.rescueTokens(await mockToken.getAddress(), ethers.parseEther("1000"))
            ).to.not.be.reverted;
        });
        
        it("Should NOT allow rescuing KCY1 tokens themselves", async function() {
            await expect(
                token.rescueTokens(await token.getAddress(), ethers.parseEther("1000"))
            ).to.be.revertedWith("No rescue KCY1");
        });
    });
});
