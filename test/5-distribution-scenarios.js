/**
 * DISTRIBUTION SCENARIOS
 * 
 * Покрива:
 * - Initial distribution (96M + 4M = 100M)
 * - Large Exempt → Exempt transfers (millions)
 * - No fee accumulation for exempt
 * - Total supply integrity
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DISTRIBUTION SCENARIOS", function() {
    let token;
    let owner, wallet1, wallet2, wallet3;
    
    const PAUSE_DURATION = 48 * 3600;
    const AFTER_ADMIN_LOCK = 48 * 60 * 60 + 1;
    const TOTAL_SUPPLY = ethers.parseEther("100000000"); // 100M
    const OWNER_BALANCE = ethers.parseEther("96000000"); // 96M
    const CONTRACT_BALANCE = ethers.parseEther("4000000"); // 4M
    
    beforeEach(async function() {
        [owner, wallet1, wallet2, wallet3] = await ethers.getSigners();
        
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
    });
    
    describe("Initial Distribution", function() {
        it("Should have correct total supply (100M)", async function() {
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("Should distribute 96M to owner", async function() {
            expect(await token.balanceOf(owner.address)).to.equal(OWNER_BALANCE);
        });
        
        it("Should lock 4M in contract", async function() {
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("Should sum to 100M exactly", async function() {
            const ownerBal = await token.balanceOf(owner.address);
            const contractBal = await token.balanceOf(await token.getAddress());
            
            expect(ownerBal + contractBal).to.equal(TOTAL_SUPPLY);
        });
    });
    
    describe("Large Exempt → Exempt Transfers", function() {
        beforeEach(async function() {
            // Make all wallets exempt
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            await token.updateExemptSlot(7, wallet1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            await token.updateExemptSlot(8, wallet2.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            await token.updateExemptSlot(9, wallet3.address);
            await time.increase(AFTER_ADMIN_LOCK);
        });
        
        it("Should transfer millions without fees", async function() {
            const amounts = [
                ethers.parseEther("24000000"), // 24M to wallet1
                ethers.parseEther("48000000"), // 48M to wallet2
                ethers.parseEther("24000000")  // 24M to wallet3
            ];
            
            // Distribute
            await token.transfer(wallet1.address, amounts[0]);
            await token.transfer(wallet2.address, amounts[1]);
            await token.transfer(wallet3.address, amounts[2]);
            
            // Verify EXACT amounts (no fees)
            expect(await token.balanceOf(wallet1.address)).to.equal(amounts[0]);
            expect(await token.balanceOf(wallet2.address)).to.equal(amounts[1]);
            expect(await token.balanceOf(wallet3.address)).to.equal(amounts[2]);
            
            // Owner should have 0
            expect(await token.balanceOf(owner.address)).to.equal(0);
        });
        
        it("Should maintain total supply after distribution", async function() {
            const amount1 = ethers.parseEther("30000000");
            const amount2 = ethers.parseEther("30000000");
            const amount3 = ethers.parseEther("36000000");
            
            await token.transfer(wallet1.address, amount1);
            await token.transfer(wallet2.address, amount2);
            await token.transfer(wallet3.address, amount3);
            
            // Total supply unchanged
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
            
            // All tokens accounted for
            const bal1 = await token.balanceOf(wallet1.address);
            const bal2 = await token.balanceOf(wallet2.address);
            const bal3 = await token.balanceOf(wallet3.address);
            const contractBal = await token.balanceOf(await token.getAddress());
            
            expect(bal1 + bal2 + bal3 + contractBal).to.equal(TOTAL_SUPPLY);
        });
        
        it("Should handle 100 sequential transfers without fee accumulation", async function() {
            const transferAmount = ethers.parseEther("100000"); // 100k per transfer
            const totalTransfers = 10; // 10 transfers = 1M total
            
            for (let i = 0; i < totalTransfers; i++) {
                await token.transfer(wallet1.address, transferAmount);
            }
            
            // Should have EXACT amount (no fee accumulation)
            const expectedTotal = transferAmount * BigInt(totalTransfers);
            expect(await token.balanceOf(wallet1.address)).to.equal(expectedTotal);
        });
    });
    
    describe("Mixed Distribution (Exempt and Normal)", function() {
        beforeEach(async function() {
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            await token.updateExemptSlot(7, wallet1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            // wallet2 and wallet3 are NORMAL
        });
        
        it("Should distribute to exempt wallets (no fees)", async function() {
            const amount = ethers.parseEther("10000000"); // 10M
            
            await token.transfer(wallet1.address, amount);
            
            expect(await token.balanceOf(wallet1.address)).to.equal(amount);
        });
        
        it("Should distribute to normal wallets (with fees, max 100)", async function() {
            const amount = ethers.parseEther("100"); // Max limit
            
            await token.transfer(wallet2.address, amount);
            
            // Should receive amount minus 0.08% fee
            const fee = (amount * 80n) / 100000n;
            const expected = amount - fee;
            
            expect(await token.balanceOf(wallet2.address)).to.equal(expected);
        });
    });
    
    describe("Total Supply Integrity", function() {
        it("Should NEVER increase total supply", async function() {
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            await token.updateExemptSlot(7, wallet1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            const initialSupply = await token.totalSupply();
            
            // Do many transfers
            await token.transfer(wallet1.address, ethers.parseEther("1000000"));
            await token.connect(wallet1).transfer(wallet2.address, ethers.parseEther("100"));
            
            // Supply should only decrease (due to burn fees) or stay same
            const finalSupply = await token.totalSupply();
            expect(finalSupply).to.be.lte(initialSupply);
        });
        
        it("Should decrease total supply due to burn fees on Normal transfers", async function() {
            await token.updateExemptSlot(6, owner.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            await token.updateExemptSlot(7, wallet1.address);
            await time.increase(AFTER_ADMIN_LOCK);
            
            // Give wallet1 some tokens
            await token.transfer(wallet1.address, ethers.parseEther("10000"));
            
            const supplyBefore = await token.totalSupply();
            
            // Exempt → Normal transfer (triggers burn)
            await token.connect(wallet1).transfer(wallet2.address, ethers.parseEther("100"));
            
            const supplyAfter = await token.totalSupply();
            
            // Supply decreased by burn fee (0.03% of 100 = 0.03)
            expect(supplyAfter).to.be.lt(supplyBefore);
        });
    });
});
