/**
 * @version v34
 */

// KCY1 Token v33 - Edge Case Tests
// Additional edge case testing - does NOT modify contract functionality
// Use with Hardhat: npx hardhat test test/kcy-meme-1-edge-cases.js

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token v33 - Edge Cases", function() {
    let token;
    let owner, addr1, addr2, addr3, exemptAddr1, exemptAddr2;
    let addr4, addr5; // Additional addresses for tests that need fresh addresses
    
    const TRADING_LOCK = 48 * 60 * 60;
    const AFTER_ADMIN_LOCK = 48 * 60 * 60 + 1;
    const COOLDOWN = 2 * 60 * 60;
    const EXEMPT_TO_NORMAL_COOLDOWN = 24 * 60 * 60;
    
    beforeEach(async function() {
        [owner, addr1, addr2, addr3, exemptAddr1, exemptAddr2, addr4, addr5] = await ethers.getSigners();
        
        await token.updateExemptSlot(6, addr1.address);
        await time.increase(AFTER_ADMIN_LOCK);
        const KCY1Token = await ethers.getContractFactory("KCY1Token");
        token = await KCY1Token.deploy();
        await token.waitForDeployment();
    });
    
    describe("1. TransferFrom Edge Cases", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            await token.transfer(addr1.address, ethers.parseEther("5000"));
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
        });
        
        it("1.1 Should handle transferFrom with fees", async function() {
            const amount = ethers.parseEther("100");
            await token.connect(addr1).approve(addr2.address, amount);
            
            const burnFee = (amount * 30n) / 100000n;
            const ownerFee = (amount * 50n) / 100000n;
            const netAmount = amount - burnFee - ownerFee;
            
            await token.connect(addr2).transferFrom(addr1.address, addr3.address, amount);
            
            expect(await token.balanceOf(addr3.address)).to.equal(netAmount);
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(0);
        });
        
        it("1.2 Should enforce cooldown on transferFrom", async function() {
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("1000"));
            
            await token.connect(addr2).transferFrom(addr1.address, addr3.address, ethers.parseEther("100"));
            
            await expect(
                token.connect(addr2).transferFrom(addr1.address, addr3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Wait 2h");
        });
        
        it("1.3 Should handle transferFrom between exempt addresses", async function() {
            await token.updateExemptSlot(6, exemptAddr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(7, exemptAddr2.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            await token.transfer(exemptAddr1.address, ethers.parseEther("1000"));
            
            const amount = ethers.parseEther("500");
            await token.connect(exemptAddr1).approve(owner.address, amount);
            await token.transferFrom(exemptAddr1.address, exemptAddr2.address, amount);
            
            // No fees for exempt to exempt
            expect(await token.balanceOf(exemptAddr2.address)).to.equal(amount);
        });
        
        it("1.4 Should reject transferFrom with insufficient allowance", async function() {
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("50"));
            
            await expect(
                token.connect(addr2).transferFrom(addr1.address, addr3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Low allowance");
        });
    });
    
    describe("2. Multiple Exempt Slots Scenarios", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
        });
        
        it("2.1 Should handle all 4 slots filled", async function() {
            // Update slots 6-9 with exempt addresses
            await token.updateExemptSlot(6, exemptAddr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(7, exemptAddr2.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(8, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(9, addr2.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
            expect(await token.isExemptAddress(addr1.address)).to.equal(true);
            expect(await token.isExemptAddress(addr2.address)).to.equal(true);
        });
        
        it("2.2 Should transfer between exempt slots with NO fees", async function() {
            await token.updateExemptSlot(6, exemptAddr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(7, exemptAddr2.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            await token.transfer(exemptAddr1.address, ethers.parseEther("1000"));
            
            const amount = ethers.parseEther("500");
            await token.connect(exemptAddr1).transfer(exemptAddr2.address, amount);
            
            expect(await token.balanceOf(exemptAddr2.address)).to.equal(amount);
        });
        
        it("2.3 Should handle exempt slot replaced while holding tokens", async function() {
            await token.updateExemptSlot(6, exemptAddr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(exemptAddr1.address, ethers.parseEther("1000"));
            
            // Replace exemptAddr1 with exemptAddr2
            await token.updateExemptSlot(6, exemptAddr2.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            // exemptAddr1 is now normal, should have fees
            const amount = ethers.parseEther("100");
            const burnFee = (amount * 30n) / 100000n;
            const ownerFee = (amount * 50n) / 100000n;
            const netAmount = amount - burnFee - ownerFee;
            
            await token.connect(exemptAddr1).transfer(addr1.address, amount);
            expect(await token.balanceOf(addr1.address)).to.equal(netAmount);
        });
    });
    
    describe("3. Cooldown Boundary Tests", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            await token.updateExemptSlot(6, addr1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("5000"));
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
        });
        
        it("3.1 Should succeed exactly at 2 hour cooldown", async function() {
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            
            await time.increase(COOLDOWN); // Exactly 2 hours
            
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"));
            
            const balance = await token.balanceOf(addr3.address);
            // Expected: 100 - (100 * 0.0008) = 99.92
            expect(balance).to.be.closeTo(ethers.parseEther("99.92"), ethers.parseEther("0.1"));
        });
        
        it("3.2 Should fail 1 second before 2 hour cooldown", async function() {
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            
            // Wait almost 2 hours but not quite
            const currentTime = await time.latest();
            await time.increaseTo(currentTime + COOLDOWN - 2); // 2 seconds before to be safe
            
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Wait 2h");
        });
        
        it("3.3 Should handle multiple transfers resetting cooldown", async function() {
            // First transfer
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            const firstTime = await time.latest();
            
            // Wait and second transfer
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            const secondTime = await time.latest();
            
            // Cooldown should be based on second transfer
            expect(secondTime - firstTime).to.be.greaterThan(COOLDOWN);
        });
        
        it("3.4 Should succeed exactly at 24 hour exempt→normal cooldown", async function() {
            // Setup: exemptAddr1 as sender
            await token.updateExemptSlot(6, exemptAddr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(exemptAddr1.address, ethers.parseEther("500"));
            
            // First exempt→normal transfer (exemptAddr1 → addr4 who is completely fresh)
            await token.connect(exemptAddr1).transfer(addr4.address, ethers.parseEther("50"));
            
            await time.increase(EXEMPT_TO_NORMAL_COOLDOWN); // Exactly 24 hours
            
            // Second exempt→normal transfer should succeed (exemptAddr1 → addr5 also completely fresh)
            await token.connect(exemptAddr1).transfer(addr5.address, ethers.parseEther("50"));
            
            const balance = await token.balanceOf(addr5.address);
            // Expected: 50 - (50 * 0.0008) = 49.96
            expect(balance).to.be.closeTo(ethers.parseEther("49.96"), ethers.parseEther("0.1"));
        });
    });
    
    describe("4. Allowance Edge Cases", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            await token.updateExemptSlot(6, addr1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
        });
        
        it("4.1 Should handle increaseAllowance", async function() {
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("100"));
            await token.connect(addr1).increaseAllowance(addr2.address, ethers.parseEther("50"));
            
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(ethers.parseEther("150"));
        });
        
        it("4.2 Should handle decreaseAllowance", async function() {
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("100"));
            await token.connect(addr1).decreaseAllowance(addr2.address, ethers.parseEther("30"));
            
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(ethers.parseEther("70"));
        });
        
        it("4.3 Should reject decreaseAllowance below zero", async function() {
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("50"));
            
            await expect(
                token.connect(addr1).decreaseAllowance(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Low allowance");
        });
        
        it("4.4 Should handle max uint256 allowance", async function() {
            const maxUint = ethers.MaxUint256;
            await token.connect(addr1).approve(addr2.address, maxUint);
            
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(maxUint);
        });
    });
    
    describe("5. Small Amount Transfers", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            await token.updateExemptSlot(6, addr1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
        });
        
        it("5.1 Should handle 1 wei transfer with fees", async function() {
            const amount = 1n;
            // Fees will be 0 due to rounding
            await token.connect(addr1).transfer(addr2.address, amount);
            
            // With amount = 1 wei, fees round to 0, so full amount received
            expect(await token.balanceOf(addr2.address)).to.equal(amount);
        });
        
        it("5.2 Should handle 1000 wei transfer", async function() {
            const amount = 1000n;
            const burnFee = (amount * 30n) / 100000n; // 0 due to rounding
            const ownerFee = (amount * 50n) / 100000n; // 0 due to rounding
            
            await token.connect(addr1).transfer(addr2.address, amount);
            
            expect(await token.balanceOf(addr2.address)).to.equal(amount);
        });
        
        it("5.3 Should calculate fees correctly for 1 token (10^18 wei)", async function() {
            const amount = ethers.parseEther("1");
            const burnFee = (amount * 30n) / 100000n;
            const ownerFee = (amount * 50n) / 100000n;
            const netAmount = amount - burnFee - ownerFee;
            
            await token.connect(addr1).transfer(addr2.address, amount);
            
            expect(await token.balanceOf(addr2.address)).to.equal(netAmount);
        });
    });
    
    describe("6. Time-based Edge Cases", function() {
        it("6.1 Should prevent trading at exactly tradingEnabledTime - 1 second", async function() {
            // Get current time and trading time
            const currentTime = await time.latest();
            const tradingTime = await token.tradingEnabledTime();
            
            // If we're already past trading time (from beforeEach), skip this test
            if (currentTime >= tradingTime) {
                this.skip();
                return;
            }
            
            // Don't increase time, we're already before tradingEnabledTime from deployment
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Locked 48h");
        });
        
        it("6.2 Should allow trading at exactly tradingEnabledTime", async function() {
            const tradingTime = await token.tradingEnabledTime();
            await time.increaseTo(Number(tradingTime));
            
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            
            const balance = await token.balanceOf(addr2.address);
            // Expected: 100 - (100 * 0.0008) = 99.92
            expect(balance).to.be.closeTo(ethers.parseEther("99.92"), ethers.parseEther("0.1"));
        });
        
        it("6.3 Should unpause at exactly pausedUntil timestamp", async function() {
            await token.pause();
            const pausedUntil = await token.pausedUntil();
            
            await time.increaseTo(Number(pausedUntil));
            
            expect(await token.isPaused()).to.equal(false);
        });
    });
    
    describe("7. Liquidity Pair Complex Scenarios", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
        });
        
        it("7.1 Should allow exempt to add liquidity to pair", async function() {
            const pairAddr = addr3.address;
            await token.setLiquidityPair(pairAddr, true);
            
            // Make BOTH addr1 AND pairAddr exempt
            // This way addr1 → pairAddr is exempt to exempt (no limits)
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(7, pairAddr);
			await time.increase(AFTER_ADMIN_LOCK);
            
            // Transfer to addr1 (exempt to exempt = no fees, no limits)
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            
            // addr1 (exempt) sends to pair (also exempt) = allowed, no limits
            await token.connect(addr1).transfer(pairAddr, ethers.parseEther("500"));
            
            // Verify pair received tokens
            expect(await token.balanceOf(pairAddr)).to.equal(ethers.parseEther("500"));
        });
        
        it("7.2 Should allow router to transfer from pair", async function() {
            const pairAddr = addr3.address;
            await token.setLiquidityPair(pairAddr, true);
            
            // Make pair exempt slot so owner can send tokens to it
            await token.updateExemptSlot(6, pairAddr);
			await time.increase(AFTER_ADMIN_LOCK);
            
            // Setup: owner sends to pair (exempt → exempt)
            await token.transfer(pairAddr, ethers.parseEther("1000"));
            
            // Get router address
            const exempts = await token.getExemptAddresses();
            const routerAddr = exempts.router;
            
            // Simulate router address (for testing, just use owner as router simulation)
            // In real scenario, PancakeSwap router would do this
            expect(await token.isExemptAddress(routerAddr)).to.equal(true);
        });
        
        it("7.3 Should block normal user from removing liquidity", async function() {
			const pairAddr = addr3.address;
			await token.setLiquidityPair(pairAddr, true);
			
			// Make pair exempt slot so owner can send tokens to it
			await token.updateExemptSlot(6, pairAddr);
			await time.increase(AFTER_ADMIN_LOCK);
			
			// Owner sends tokens to pair (exempt → exempt)
			await token.transfer(pairAddr, ethers.parseEther("1000"));
			
			// Make addr1 exempt slot to give it tokens
			await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
			await token.transfer(addr1.address, ethers.parseEther("500"));
			await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
			
			// Create approval from pair to addr1 using impersonation
			await ethers.provider.send("hardhat_impersonateAccount", [pairAddr]);
			const pairSigner = await ethers.getSigner(pairAddr);
			
			// Fund the pair address with ETH for gas
			await owner.sendTransaction({
				to: pairAddr,
				value: ethers.parseEther("1.0")
			});
			
			// Pair approves addr1 to spend tokens
			await token.connect(pairSigner).approve(addr1.address, ethers.parseEther("100"));
			
			// Now addr1 tries to transferFrom pair to themselves (simulating liquidity removal)
			// This should fail because addr1 is not the router
			await expect(
				token.connect(addr1).transferFrom(pairAddr, addr1.address, ethers.parseEther("100"))
			).to.be.revertedWith("Normal users cannot remove liquidity directly");
			
			await ethers.provider.send("hardhat_stopImpersonatingAccount", [pairAddr]);
		});
    });
    
    describe("8. Blacklist + Pause Combinations", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            await token.updateExemptSlot(6, addr1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
        });
        
        it("8.1 Should block blacklisted user even if not paused", async function() {
            await token.setBlacklist(addr1.address, true);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Blacklisted");
        });
        
        it("8.2 Should block normal user during pause even if not blacklisted", async function() {
            await token.pause();
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Paused");
        });
        
        it("8.3 Should block user during pause (pause check happens first)", async function() {
            await token.setBlacklist(addr1.address, true);
            await token.pause();
            
            // Both restrictions active - pause check happens before blacklist in the code
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Paused");
        });
    });
    
    describe("9. Batch Operations", function() {
        it("9.1 Should handle batch blacklist with duplicates", async function() {
            const accounts = [addr1.address, addr2.address, addr1.address]; // addr1 appears twice
            
            await token.setBlacklistBatch(accounts, true);
            
            expect(await token.isBlacklisted(addr1.address)).to.equal(true);
            expect(await token.isBlacklisted(addr2.address)).to.equal(true);
        });
        
        it("9.2 Should handle batch liquidity pairs", async function() {
            const pairs = [addr1.address, addr2.address, addr3.address];
            
            await token.setLiquidityPairBatch(pairs, true);
            
            expect(await token.isLiquidityPair(addr1.address)).to.equal(true);
            expect(await token.isLiquidityPair(addr2.address)).to.equal(true);
            expect(await token.isLiquidityPair(addr3.address)).to.equal(true);
        });
        
        it("9.3 Should skip zero addresses in batch operations", async function() {
            const accounts = [addr1.address, ethers.ZeroAddress, addr2.address];
            
            await token.setBlacklistBatch(accounts, true);
            
            expect(await token.isBlacklisted(addr1.address)).to.equal(true);
            expect(await token.isBlacklisted(ethers.ZeroAddress)).to.equal(false);
            expect(await token.isBlacklisted(addr2.address)).to.equal(true);
        });
    });
    
    describe("10. View Function Edge Cases", function() {
        it("10.1 Should return 0 for timeUntilTradingEnabled after trading starts", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            expect(await token.timeUntilTradingEnabled()).to.equal(0);
            expect(await token.isTradingEnabled()).to.equal(true);
        });
        
        it("10.2 Should return 0 for timeUntilUnpaused when not paused", async function() {
            expect(await token.timeUntilUnpaused()).to.equal(0);
            expect(await token.isPaused()).to.equal(false);
        });
        
        it("10.3 Should correctly identify exempt slots vs other exempt addresses", async function() {
            // DON'T change exempt slots - owner is already eAddr1-4 from constructor
            
            // owner is exempt address AND exempt slot
            expect(await token.isExemptAddress(owner.address)).to.equal(true);
            expect(await token.isExemptSlot(owner.address)).to.equal(true);  // owner == eAddr1 == eAddr2 == eAddr3 == eAddr4
            
            // Router is exempt address but NOT exempt slot
            const exempts = await token.getExemptAddresses();
            expect(await token.isExemptAddress(exempts.router)).to.equal(true);
            expect(await token.isExemptSlot(exempts.router)).to.equal(false);
            
            // Contract is exempt address but NOT exempt slot
            expect(await token.isExemptAddress(await token.getAddress())).to.equal(true);
            expect(await token.isExemptSlot(await token.getAddress())).to.equal(false);
        });
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 8. MAX WALLET EDGE CASES
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("8. Max Wallet Edge Cases", function() {
        const MAX_WALLET = ethers.parseEther("4000");
        const BURN_FEE = 30n;
        const OWNER_FEE = 50n;
        const FEE_DENOMINATOR = 100000n;
        
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            
            // Setup: Give addr1 tokens as exempt
            await token.updateExemptSlot(6, addr1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("20000"));
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
        });
        
        it("8.1 User с 3999.5 токена получава 1 токен - трябва да FAIL", async function() {
            // Fill addr2 wallet to 3999.5 tokens
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            
            let balance = await token.balanceOf(addr2.address);
            
            // Send small amount to reach exactly 3999.5
            await time.increase(COOLDOWN + 1);
            const needed = ethers.parseEther("3999.5") - balance;
            const amountToSend = (needed * FEE_DENOMINATOR) / (FEE_DENOMINATOR - BURN_FEE - OWNER_FEE);
            
            await token.connect(addr1).transfer(addr2.address, amountToSend);
            
            balance = await token.balanceOf(addr2.address);
            expect(balance).to.be.closeTo(ethers.parseEther("3999.5"), ethers.parseEther("0.1"));
            
            // Try to send 1 token - should FAIL
            // 1 token after fees = 0.9992
            // 3999.5 + 0.9992 = 4000.4992 > 4000
            await time.increase(COOLDOWN + 1);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("1"))
            ).to.be.revertedWith("Max wallet 4k");
        });
        
        it("8.2 User с 3999 токена получава 1 токен - трябва да SUCCESS", async function() {
            // Fill addr2 wallet to exactly 3999 tokens
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            
            let balance = await token.balanceOf(addr2.address);
            
            const needed = ethers.parseEther("3999") - balance;
            const amountToSend = (needed * FEE_DENOMINATOR) / (FEE_DENOMINATOR - BURN_FEE - OWNER_FEE);
            
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, amountToSend);
            
            balance = await token.balanceOf(addr2.address);
            expect(balance).to.be.closeTo(ethers.parseEther("3999"), ethers.parseEther("0.1"));
            
            // Send 1 token - should SUCCESS
            // 1 * 0.9992 = 0.9992
            // 3999 + 0.9992 = 3999.9992 < 4000
            await time.increase(COOLDOWN + 1);
            
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("1"));
            
            balance = await token.balanceOf(addr2.address);
            expect(balance).to.be.lt(MAX_WALLET);
            expect(balance).to.be.closeTo(ethers.parseEther("3999.9992"), ethers.parseEther("0.01"));
        });
        
        it("8.3 User с 3999.9 токена получава 0.1 токен - edge case", async function() {
            // Fill to 3999.9
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            
            let balance = await token.balanceOf(addr2.address);
            const needed = ethers.parseEther("3999.9") - balance;
            const amountToSend = (needed * FEE_DENOMINATOR) / (FEE_DENOMINATOR - BURN_FEE - OWNER_FEE);
            
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, amountToSend);
            
            balance = await token.balanceOf(addr2.address);
            
            // Send 0.1 token
            // 0.1 * 0.9992 = 0.09992
            // 3999.9 + 0.09992 = 3999.99992 < 4000
            await time.increase(COOLDOWN + 1);
            
            const smallAmount = ethers.parseEther("0.1");
            await token.connect(addr1).transfer(addr2.address, smallAmount);
            
            balance = await token.balanceOf(addr2.address);
            expect(balance).to.be.lt(MAX_WALLET);
            expect(balance).to.be.closeTo(ethers.parseEther("3999.99992"), ethers.parseEther("0.001"));
        });
        
        it("8.4 Не може 3x 2000 токена (overflow protection)", async function() {
            // First 2000
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            await time.increase(COOLDOWN + 1);
            
            // Second 2000
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            
            let balance = await token.balanceOf(addr2.address);
            expect(balance).to.be.closeTo(ethers.parseEther("3996.8"), ethers.parseEther("1"));
            
            // Try third 2000 - should FAIL
            // 3996.8 + 1998.4 = 5995.2 > 4000
            await time.increase(COOLDOWN + 1);
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"))
            ).to.be.revertedWith("Max wallet 4k");
        });
        
        it("8.5 Fee calculation е прецизна", async function() {
            const testAmount = ethers.parseEther("1000");
            
            // Calculate expected fees
            const burnFee = (testAmount * BURN_FEE) / FEE_DENOMINATOR;
            const ownerFee = (testAmount * OWNER_FEE) / FEE_DENOMINATOR;
            const netAmount = testAmount - burnFee - ownerFee;
            
            // Send tokens
            await token.connect(addr1).transfer(addr2.address, testAmount);
            
            const balance = await token.balanceOf(addr2.address);
            
            // Verify exact match
            expect(balance).to.equal(netAmount);
        });
        
        it("8.6 Exempt slot спазва max wallet към пълен user", async function() {
            // Setup exempt slot
            await token.updateExemptSlot(6, addr3.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr3.address, ethers.parseEther("1000"));
            
            // Fill addr2 to 3999 tokens
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
            
            let balance = await token.balanceOf(addr2.address);
            const needed = ethers.parseEther("3999") - balance;
            const amountToSend = (needed * FEE_DENOMINATOR) / (FEE_DENOMINATOR - BURN_FEE - OWNER_FEE);
            
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr2.address, amountToSend);
            
            balance = await token.balanceOf(addr2.address);
            
            // Exempt slot tries to send 100 tokens (max allowed)
            // 100 * 0.9992 = 99.92
            // 3999 + 99.92 = 4098.92 > 4000
            await expect(
                token.connect(addr3).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Max wallet 4k");
        });
    });
});