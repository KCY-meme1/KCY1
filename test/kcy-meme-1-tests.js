// KCY1 Token (KCY-meme-1) v33 - Complete Test Suite (100M Supply)
// MINIMAL CHANGES VERSION - Only updated limits (2000/4000)
// Tests all critical fixes and functionality
// Use with Hardhat: npx hardhat test

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token v33 - Complete Test Suite (100M Supply) - MINIMAL", function() {
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
            expect(exempts.slots[0]).to.equal(ethers.ZeroAddress);
            expect(exempts.slots[1]).to.equal(ethers.ZeroAddress);
            expect(exempts.slots[2]).to.equal(ethers.ZeroAddress);
            expect(exempts.slots[3]).to.equal(ethers.ZeroAddress);
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
            
            for (let i = 0; i < 4; i++) {
                await token.connect(addr1).transfer(addr2.address, amountPerTransfer);
                await time.increase(COOLDOWN + 1);
            }
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Max wallet 4k");
        });
        
        it("8.3 Should enforce 2-hour cooldown between transfers", async function() {
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("500"));
            
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Wait 2h");
            
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"));
            expect(Number(await token.balanceOf(addr3.address))).to.be.greaterThan(0);
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
            expect(Number(await token.balanceOf(addr2.address))).to.be.greaterThan(0);
        });
    });
});