/**
 * @version v37
 */
// KCY1 Token (KCY-meme-1) - Complete Test Suite (100M Supply)
// MINIMAL CHANGES VERSION - Only updated limits (2000/4000)
// Tests all critical fixes and functionality
// Use with Hardhat: npx hardhat test

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token v37 - Complete Test Suite (100M Supply)", function() {
    let token;
    let owner;
    let addr1, addr2, addr3, addr4, addr5;
    let exemptAddr1, exemptAddr2;
    let addrs;
    
    const TOTAL_SUPPLY = ethers.parseEther("100000000");
    const DEV_WALLET_BALANCE = ethers.parseEther("96000000");
    const CONTRACT_BALANCE = ethers.parseEther("4000000");
    const MAX_TX = ethers.parseEther("2000");
    const MAX_WALLET = ethers.parseEther("4000");
    const MAX_EXEMPT_TO_NORMAL = ethers.parseEther("100");
    const COOLDOWN = 2 * 60 * 60;
    const EXEMPT_TO_NORMAL_COOLDOWN = 24 * 60 * 60;
    const TRADING_LOCK = 48 * 60 * 60;
    const PAUSE_DURATION = 48 * 60 * 60;
    
    const MARKETING_ALLOCATION = ethers.parseEther("1500000");
    const TEAM_ALLOCATION = ethers.parseEther("1000000");
    const ADVISOR_ALLOCATION = ethers.parseEther("1500000");
    const TOTAL_DISTRIBUTION = ethers.parseEther("4000000");
    const DEV_REMAINING = ethers.parseEther("96000000");
    
    beforeEach(async function() {
        [owner, addr1, addr2, addr3, addr4, addr5, exemptAddr1, exemptAddr2, ...addrs] = await ethers.getSigners();
        
        const KCY1Token = await ethers.getContractFactory("KCY1Token");
        token = await KCY1Token.deploy();
        await token.waitForDeployment();
    });
    
    describe("1. Deployment & Initialization", function() {
        it("1.1 Should set correct token metadata", async function() {
            expect(await token.name()).to.equal("KCY-meme-1");
            expect(await token.symbol()).to.equal("KCY1");
            expect(Number(await token.decimals())).to.equal(18);
        });
        
        it("1.2 Should mint correct total supply", async function() {
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("1.3 Should distribute tokens correctly on Hardhat (owner gets all)", async function() {
            const distAddrs = await token.getDistributionAddresses();
            expect(distAddrs.devWallet).to.equal(owner.address);
            expect(await token.balanceOf(owner.address)).to.equal(DEV_WALLET_BALANCE);
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("1.4 Should set immutable owner correctly", async function() {
            expect(await token.owner()).to.equal(owner.address);
        });
        
        it("1.5 Should initialize 48-hour trading lock", async function() {
            expect(await token.isTradingEnabled()).to.equal(false);
            const timeLeft = Number(await token.timeUntilTradingEnabled());
            expect(timeLeft).to.be.closeTo(TRADING_LOCK, 5);
        });
        
        it("1.6 Should detect testnet deployment (Hardhat = true)", async function() {
            const isTestnet = await token.isTestnet();
            expect(isTestnet).to.equal(true);
        });
        
        it("1.7 Should start with empty exempt slots (4 slots)", async function() {
            const exempts = await token.getExemptAddresses();
            const [owner] = await ethers.getSigners();
            
            // In Hardhat, all exempt slots are set to owner for simplified testing
            expect(exempts.slots[0]).to.equal(owner.address);
            expect(exempts.slots[1]).to.equal(owner.address);
            expect(exempts.slots[2]).to.equal(owner.address);
            expect(exempts.slots[3]).to.equal(owner.address);
            expect(exempts.slotsLocked).to.equal(false);
        });
    });
    
    describe("2. Initial Distribution", function() {
        it("2.1 Should not distribute on Hardhat (all same address)", async function() {
            await token.distributeInitialAllocations();
            
            expect(await token.balanceOf(owner.address)).to.equal(DEV_WALLET_BALANCE);
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("2.2 Should only allow distribution once", async function() {
            await token.distributeInitialAllocations();
            
            await expect(
                token.distributeInitialAllocations()
            ).to.be.revertedWith("Dist completed");
        });
        
        it("2.3 Should only allow owner to call distribution", async function() {
            await expect(
                token.connect(addr1).distributeInitialAllocations()
            ).to.be.revertedWith("Not owner");
        });
    });
    
    describe("3. Exempt Slot Management", function() {
        it("3.1 Should allow owner to set exempt slots (4 slots)", async function() {
            await token.updateExemptSlots(
                [exemptAddr1.address, exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
            expect(await token.isExemptAddress(addr1.address)).to.equal(false);
        });
        
        it("3.2 Should allow multiple changes before lock", async function() {
            await token.updateExemptSlots(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            
            await token.updateExemptSlots(
                [exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(false);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
        });
        
        it("3.3 Should permanently lock exempt slots", async function() {
            await token.updateExemptSlots(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            await token.lockExemptSlotsForever();
            expect(await token.exemptSlotsLocked()).to.equal(true);
            
            await expect(
                token.updateExemptSlots(
                    [exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
                )
            ).to.be.revertedWith("Slots locked");
        });
        
        it("3.4 Should recognize owner and contract as always exempt", async function() {
            expect(await token.isExemptAddress(owner.address)).to.equal(true);
            expect(await token.isExemptAddress(await token.getAddress())).to.equal(true);
        });
    });
    
    describe("4. DEX Address Management", function() {
        it("4.1 Should allow owner to update DEX addresses anytime", async function() {
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            await token.updateDEXAddresses(newRouter, newFactory);
            
            const exempts = await token.getExemptAddresses();
            expect(exempts.router).to.equal(newRouter);
            expect(exempts.factory).to.equal(newFactory);
        });
        
        it("4.2 DEX addresses should remain updatable even after slots are locked", async function() {
            await token.updateExemptSlots(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            await token.lockExemptSlotsForever();
            expect(await token.exemptSlotsLocked()).to.equal(true);
            
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            await token.updateDEXAddresses(newRouter, newFactory);
            
            const exempts = await token.getExemptAddresses();
            expect(exempts.router).to.equal(newRouter);
            expect(exempts.factory).to.equal(newFactory);
        });
        
        it("4.3 Should reject zero addresses for DEX", async function() {
            const exempts = await token.getExemptAddresses();
            
            await expect(
                token.updateDEXAddresses(ethers.ZeroAddress, exempts.factory)
            ).to.be.revertedWith("Router zero");
            
            await expect(
                token.updateDEXAddresses(exempts.router, ethers.ZeroAddress)
            ).to.be.revertedWith("Factory zero");
        });
    });
    
    describe("5. Fee Mechanism (Unified 0.08%)", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await token.updateExemptSlots(
                [addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            
            await token.updateExemptSlots(
                [ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
        });
        
        it("5.1 Should apply 0.08% fee on normal transfers", async function() {
            const amount = ethers.parseEther("1000");
            const burnFee = (amount * 30n) / 100000n;
            const ownerFee = (amount * 50n) / 100000n;
            const netAmount = amount - burnFee - ownerFee;
            
            const initialSupply = await token.totalSupply();
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            await token.connect(addr1).transfer(addr2.address, amount);
            
            expect(await token.balanceOf(addr2.address)).to.equal(netAmount);
            expect(await token.totalSupply()).to.equal(initialSupply - burnFee);
            expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance + ownerFee);
        });
        
        it("5.2 Exempt to Exempt should have NO fees", async function() {
            await token.updateExemptSlots(
                [addr3.address, addr4.address, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            await token.transfer(addr3.address, ethers.parseEther("1000"));
            
            const amount = ethers.parseEther("500");
            await token.connect(addr3).transfer(addr4.address, amount);
            
            expect(await token.balanceOf(addr4.address)).to.equal(amount);
        });
    });
    
    describe("6. Exempt Slot to Normal Transfer Restrictions", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await token.updateExemptSlots(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            await token.transfer(exemptAddr1.address, ethers.parseEther("1000"));
        });
        
        it("6.1 Should enforce 100 token limit for exempt→normal transfers", async function() {
            await token.connect(exemptAddr1).transfer(addr1.address, MAX_EXEMPT_TO_NORMAL);
            
            const burnFee = (MAX_EXEMPT_TO_NORMAL * 30n) / 100000n;
            const ownerFee = (MAX_EXEMPT_TO_NORMAL * 50n) / 100000n;
            const netAmount = MAX_EXEMPT_TO_NORMAL - burnFee - ownerFee;
            expect(await token.balanceOf(addr1.address)).to.equal(netAmount);
            
            await time.increase(EXEMPT_TO_NORMAL_COOLDOWN + 1);
            await expect(
                token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("101"))
            ).to.be.revertedWith("Max 100");
        });
        
        it("6.2 Should enforce 24-hour cooldown for exempt→normal transfers", async function() {
            await token.connect(exemptAddr1).transfer(addr1.address, ethers.parseEther("50"));
            
            await expect(
                token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Wait 24h");
            
            await time.increase(EXEMPT_TO_NORMAL_COOLDOWN + 1);
            await token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"));
            
            const burnFee = (ethers.parseEther("50") * 30n) / 100000n;
            const ownerFee = (ethers.parseEther("50") * 50n) / 100000n;
            const netAmount = ethers.parseEther("50") - burnFee - ownerFee;
            expect(await token.balanceOf(addr2.address)).to.equal(netAmount);
        });
        
        it("6.3 Should apply 0.08% fee for exempt→normal (SAME as normal!)", async function() {
            const amount = ethers.parseEther("100");
            const burnFee = (amount * 30n) / 100000n;
            const ownerFee = (amount * 50n) / 100000n;
            const netAmount = amount - burnFee - ownerFee;
            
            const initialSupply = await token.totalSupply();
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            await token.connect(exemptAddr1).transfer(addr1.address, amount);
            
            expect(await token.balanceOf(addr1.address)).to.equal(netAmount);
            expect(await token.totalSupply()).to.equal(initialSupply - burnFee);
            expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance + ownerFee);
        });
    });
    
    describe("7. Pause and Blacklist Exemption", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await token.updateExemptSlots(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            await token.transfer(exemptAddr1.address, ethers.parseEther("1000"));
            
            await token.updateExemptSlots(
                [exemptAddr1.address, addr1.address, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlots(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
        });
        
        it("7.1 Exempt addresses can transfer during pause", async function() {
            await token.pause();
            expect(await token.isPaused()).to.equal(true);
            
            await token.updateExemptSlots(
                [exemptAddr1.address, addr2.address, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            await token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"));
            
            expect(await token.balanceOf(addr2.address)).to.equal(ethers.parseEther("50"));
            
            await token.updateExemptSlots(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Paused");
            
            await expect(
                token.connect(exemptAddr1).transfer(addr3.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Paused");
        });
        
        it("7.2 Blacklisted exempt addresses can still transfer", async function() {
            await token.setBlacklist(exemptAddr1.address, true);
            expect(await token.isBlacklisted(exemptAddr1.address)).to.equal(true);
            
            await token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"));
            
            const burnFee = (ethers.parseEther("50") * 30n) / 100000n;
            const ownerFee = (ethers.parseEther("50") * 50n) / 100000n;
            const netAmount = ethers.parseEther("50") - burnFee - ownerFee;
            expect(await token.balanceOf(addr2.address)).to.equal(netAmount);
        });
        
        it("7.3 Blacklisted normal addresses cannot transfer", async function() {
            await token.setBlacklist(addr1.address, true);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Blacklisted");
        });
    });
    
    describe("8. Transaction Limits for Normal Users", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await token.updateExemptSlots(
                [addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            await token.transfer(addr1.address, ethers.parseEther("25000"));
            await token.updateExemptSlots(
                [ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
            );
        });
        
        it("8.1 Should enforce max transaction limit (2,000 tokens)", async function() {
            await token.connect(addr1).transfer(addr2.address, MAX_TX);
            
            await time.increase(COOLDOWN + 1);
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("2001"))
            ).to.be.revertedWith("Max 2000");
        });
        
        it("8.2 Should enforce max wallet limit (4,000 tokens)", async function() {
            const amountPerTransfer = ethers.parseEther("1000");
            
            // Fill wallet with 4x 1000 tokens (= ~3996.8 after fees)
            for (let i = 0; i < 4; i++) {
                await token.connect(addr1).transfer(addr2.address, amountPerTransfer);
                await time.increase(COOLDOWN + 1);
            }
            
            const balance = await token.balanceOf(addr2.address);
            // Balance should be close to 3996.8 (less than 4000 due to fees)
            expect(balance).to.be.lt(ethers.parseEther("4000"));
            expect(balance).to.be.gt(ethers.parseEther("3990"));
            
            // Try to send more - should fail due to max wallet
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("10"))
            ).to.be.revertedWith("Max wallet 4k");
        });
        
        it("8.3 Should enforce 2-hour cooldown between transfers", async function() {
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("500"));
            
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Wait 2h");
            
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"));
            
            const balance = await token.balanceOf(addr3.address);
            // Expected: 500 - (500 * 0.0008) = 499.6
            expect(balance).to.be.closeTo(ethers.parseEther("499.6"), ethers.parseEther("0.5"));
        });
    });
    
    describe("9. Owner Functions", function() {
        it("9.1 Should allow owner to pause/unpause", async function() {
            await token.pause();
            expect(await token.isPaused()).to.equal(true);
            
            await time.increase(PAUSE_DURATION + 1);
            expect(await token.isPaused()).to.equal(false);
        });
        
        it("9.2 Should allow owner to blacklist addresses", async function() {
            await token.setBlacklist(addr1.address, true);
            expect(await token.isBlacklisted(addr1.address)).to.equal(true);
            
            await token.setBlacklist(addr1.address, false);
            expect(await token.isBlacklisted(addr1.address)).to.equal(false);
        });
        
        it("9.3 Should not allow blacklisting owner or contract", async function() {
            await expect(
                token.setBlacklist(owner.address, true)
            ).to.be.revertedWith("No owner");
            
            await expect(
                token.setBlacklist(await token.getAddress(), true)
            ).to.be.revertedWith("No contract");
        });
        
        it("9.4 Should allow owner to withdraw contract tokens", async function() {
            const initialOwnerBalance = await token.balanceOf(owner.address);
            const contractBalance = await token.balanceOf(await token.getAddress());
            
            await token.withdrawCirculationTokens(ethers.parseEther("10000"));
            
            expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance + ethers.parseEther("10000"));
            expect(await token.balanceOf(await token.getAddress())).to.equal(contractBalance - ethers.parseEther("10000"));
        });
        
        it("9.5 Should allow owner to burn tokens", async function() {
            const initialSupply = await token.totalSupply();
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            await token.burn(ethers.parseEther("1000"));
            
            expect(await token.totalSupply()).to.equal(initialSupply - ethers.parseEther("1000"));
            expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance - ethers.parseEther("1000"));
        });
        
        it("9.6 Should allow batch blacklisting", async function() {
            const accounts = [addr1.address, addr2.address, addr3.address];
            
            await token.setBlacklistBatch(accounts, true);
            
            expect(await token.isBlacklisted(addr1.address)).to.equal(true);
            expect(await token.isBlacklisted(addr2.address)).to.equal(true);
            expect(await token.isBlacklisted(addr3.address)).to.equal(true);
        });
    });
    
    describe("10. Liquidity Pair Management", function() {
        it("10.1 Should allow owner to add liquidity pair", async function() {
            const pairAddr = addr3.address;
            
            await token.setLiquidityPair(pairAddr, true);
            expect(await token.isLiquidityPair(pairAddr)).to.equal(true);
        });
        
        it("10.2 Should allow batch addition of liquidity pairs", async function() {
            const pairs = [addr3.address, addr4.address];
            
            await token.setLiquidityPairBatch(pairs, true);
            
            expect(await token.isLiquidityPair(pairs[0])).to.equal(true);
            expect(await token.isLiquidityPair(pairs[1])).to.equal(true);
        });
        
        it("10.3 Should block normal users from sending to liquidity pair", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            const pairAddr = addr3.address;
            await token.setLiquidityPair(pairAddr, true);
            
            await expect(
                token.connect(addr1).transfer(pairAddr, ethers.parseEther("100"))
            ).to.be.revertedWith("Normal users cannot add liquidity directly");
        });
        
        it("10.4 Should lock liquidity pairs forever", async function() {
            const pairAddr = addr3.address;
            await token.setLiquidityPair(pairAddr, true);
            
            await token.lockLiquidityPairsForever();
            expect(await token.liquidityPairsLocked()).to.equal(true);
            
            await expect(
                token.setLiquidityPair(addr4.address, true)
            ).to.be.revertedWith("Pairs locked");
        });
		
		it("10.5 Should block normal users from removing liquidity (alternative)", async function() {
			await time.increase(TRADING_LOCK + 1);
			
			const pairAddr = addr3.address;
			await token.setLiquidityPair(pairAddr, true);
			
			// Make pair an exempt slot temporarily to send it tokens
			await token.updateExemptSlots([pairAddr, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
			await token.transfer(pairAddr, ethers.parseEther("1000"));
			
			// Remove pair from exempt slots (now it's just a liquidity pair, not exempt)
			await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
			
			// Give addr1 some tokens
			await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
			await token.transfer(addr1.address, ethers.parseEther("500"));
			await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
			
			// Now test: pair tries to send to normal user (simulating liquidity removal)
			// We need to impersonate pair to test this
			await ethers.provider.send("hardhat_impersonateAccount", [pairAddr]);
			const pairSigner = await ethers.getSigner(pairAddr);
			
			// Fund pair with ETH
			await owner.sendTransaction({
				to: pairAddr,
				value: ethers.parseEther("1.0")
			});
			
			// Pair tries to send to addr1 - should fail because msg.sender (pair) is not router
			await expect(
				token.connect(pairSigner).transfer(addr1.address, ethers.parseEther("100"))
			).to.be.revertedWith("Normal users cannot remove liquidity directly");
			
			await ethers.provider.send("hardhat_stopImpersonatingAccount", [pairAddr]);
		});
    });
    
    describe("11. Security & Edge Cases", function() {
        it("11.1 Should prevent non-owner from calling owner functions", async function() {
            await expect(token.connect(addr1).pause()).to.be.revertedWith("Not owner");
            await expect(token.connect(addr1).setBlacklist(addr2.address, true)).to.be.revertedWith("Not owner");
            await expect(token.connect(addr1).burn(ethers.parseEther("100"))).to.be.revertedWith("Not owner");
        });
        
        it("11.2 Should handle zero address transfers correctly", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await expect(
                token.transfer(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.revertedWith("To zero");
        });
        
        it("11.3 Should handle insufficient balance correctly", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Low balance");
        });
        
        it("11.4 Should handle allowance correctly", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("500"));
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(ethers.parseEther("500"));
            
            await token.connect(addr2).transferFrom(addr1.address, addr3.address, ethers.parseEther("200"));
            expect(await token.allowance(addr1.address, addr2.address)).to.equal(ethers.parseEther("300"));
        });
    });
    
    describe("12. Trading Lock", function() {
        it("12.1 Should prevent normal users from trading before 48h", async function() {
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Locked 48h");
        });
        
        it("12.2 Should allow trading after 48h", async function() {
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            await time.increase(TRADING_LOCK + 1);
            
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            
            const balance = await token.balanceOf(addr2.address);
            // Expected: 100 - (100 * 0.0008) = 99.92
            expect(balance).to.be.closeTo(ethers.parseEther("99.92"), ethers.parseEther("0.1"));
        });
    });
    
    describe("13. CRITICAL Missing Test Coverage", function() {
        it("13.1 Should allow Router to send tokens to normal user (2000 max per tx)", async function() {
            // Skip trading lock
            await time.increase(TRADING_LOCK + 1);
            
            // Set addr1 as Router (exempt but NOT exempt slot)
            await token.updateDEXAddresses(addr1.address, addr2.address);
            
            // Verify Router is exempt but not in slot
            expect(await token.isExemptAddress(addr1.address)).to.equal(true);
            expect(await token.isExemptSlot(addr1.address)).to.equal(false);
            
            // Owner → Router (both exempt, NO limits, NO fees)
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            
            // Verify Router received full amount (no fees for exempt → exempt)
            expect(await token.balanceOf(addr1.address)).to.equal(ethers.parseEther("10000"));
            
            // SCENARIO 1: Router → Normal has 2000 token limit per transaction
            // AND 2h cooldown when sending to SAME user
            // First transfer: 2000 tokens
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("2000"));
            
            let balance = await token.balanceOf(addr3.address);
            expect(balance).to.be.gt(ethers.parseEther("1990")); // After 0.08% fees
            expect(balance).to.be.lt(ethers.parseEther("2000"));
            
            // Wait 2h cooldown before sending to SAME user again
            await time.increase(COOLDOWN + 1);
            
            // Second transfer: another 2000 tokens to SAME user
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("2000"));
            
            balance = await token.balanceOf(addr3.address);
            expect(balance).to.be.gt(ethers.parseEther("3990")); // ~3996 after fees
            expect(balance).to.be.lt(ethers.parseEther("4000")); // Max wallet reached!
            
            // SCENARIO 2: Router can send to multiple users without cooldown
            await token.connect(addr1).transfer(addr4.address, ethers.parseEther("2000"));
            await token.connect(addr1).transfer(addr5.address, ethers.parseEther("2000"));
            
            // Both users should have ~1998 tokens each
            expect(await token.balanceOf(addr4.address)).to.be.closeTo(ethers.parseEther("1998"), ethers.parseEther("5"));
            expect(await token.balanceOf(addr5.address)).to.be.closeTo(ethers.parseEther("1998"), ethers.parseEther("5"));
        });
        
        it("13.2 Should apply 2h cooldown to Router → Same Normal user (but not different users)", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            // Set addr1 as Router
            await token.updateDEXAddresses(addr1.address, addr2.address);
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            
            // First transfer to addr3
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"));
            
            // Immediate second transfer to SAME user should fail
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Wait 2h");
            
            // But immediate transfer to DIFFERENT user should work
            await token.connect(addr1).transfer(addr4.address, ethers.parseEther("100"));
            
            expect(await token.balanceOf(addr4.address)).to.be.gt(ethers.parseEther("99"));
        });
        
        it("13.3 Should enforce 100 token limit on transferFrom from Exempt Slot to Normal", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            // Set addr1 as exempt slot
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            // Give exempt slot 1000 tokens
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            
            // Exempt slot approves addr2 (normal user) for 1000 tokens
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("1000"));
            
            // addr2 tries to transferFrom > 100 tokens from exempt slot to addr3 (NORMAL user)
            // This should fail because: Exempt Slot → Normal has 100 token limit
            await expect(
                token.connect(addr2).transferFrom(addr1.address, addr3.address, ethers.parseEther("200"))
            ).to.be.revertedWith("Max 100");
            
            // But 100 tokens should work
            await token.connect(addr2).transferFrom(addr1.address, addr3.address, ethers.parseEther("100"));
            
            const balance = await token.balanceOf(addr3.address);
            expect(balance).to.be.gt(ethers.parseEther("99"));
            expect(balance).to.be.lt(ethers.parseEther("100"));
        });
        
        it("13.4 Should allow multiple Normal users to fill Exempt Slot beyond 4k total", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            // Setup Router
            await token.updateDEXAddresses(exemptAddr2.address, addr2.address);
            
            // Owner → Router (exempt to exempt, no fees, no limits)
            await token.transfer(exemptAddr2.address, ethers.parseEther("10000"));
            
            // Router → Normal users (2000 max per transaction!)
            // User 1 gets 4000 tokens (2x 2000 with 2h cooldown)
            await token.connect(exemptAddr2).transfer(addr5.address, ethers.parseEther("2000"));
            
            // Wait 2h cooldown before sending to SAME user again
            await time.increase(COOLDOWN + 1);
            
            await token.connect(exemptAddr2).transfer(addr5.address, ethers.parseEther("2000"));
            
            // User 2 gets 2000 tokens (1x 2000)
            await token.connect(exemptAddr2).transfer(addr4.address, ethers.parseEther("2000"));
            
            // Normal users now have tokens:
            // addr5: ~3996 tokens (2x 2000 after fees)
            // addr4: ~1998 tokens (1x 2000 after fees)
            
            // Wait 2h cooldown for addr5 to be able to send (received from Router)
            await time.increase(COOLDOWN + 1);
            
            // Set addr1 as exempt slot that will receive from normal users
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            // TRANSFER 1: Normal user 1 sends 2000 tokens to exempt slot
            await token.connect(addr5).transfer(addr1.address, ethers.parseEther("2000"));
            let balance1 = await token.balanceOf(addr1.address);
            expect(balance1).to.be.closeTo(ethers.parseEther("1998"), ethers.parseEther("5"));
            
            // Wait 2h cooldown (only for same user)
            await time.increase(COOLDOWN + 1);
            
            // TRANSFER 2: Normal user 1 sends remaining tokens to exempt slot
            // Need to account for fees (0.08%) so subtract a bit
            const addr5Balance = await token.balanceOf(addr5.address);
            await token.connect(addr5).transfer(addr1.address, addr5Balance - ethers.parseEther("2"));
            balance1 = await token.balanceOf(addr1.address);
            expect(balance1).to.be.closeTo(ethers.parseEther("3994"), ethers.parseEther("10"));
            
            // TRANSFER 3: Normal user 2 sends tokens to exempt slot
            // Need to wait 2h cooldown for addr4 (received from Router)
            await time.increase(COOLDOWN + 1);
            
            // addr4 has ~1998 tokens, send all of them (accounting for fees)
            const addr4Balance = await token.balanceOf(addr4.address);
            await token.connect(addr4).transfer(addr1.address, addr4Balance - ethers.parseEther("2"));
            
            // VERIFY: Exempt slot has ~6000 tokens total
            // (2000 + 2000 from user1) + (2000 from user2) ≈ 6000
            // Each normal user has MAX 4k, but exempt slot can receive from MULTIPLE users
            balance1 = await token.balanceOf(addr1.address);
            expect(balance1).to.be.gt(ethers.parseEther("5000")); 
            expect(balance1).to.be.closeTo(ethers.parseEther("5994"), ethers.parseEther("20"));
        });
    });
});