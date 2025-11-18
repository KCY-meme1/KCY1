// KCY1 Token (KCY-meme-1) v24 - Comprehensive Test Suite
// Tests all critical fixes and functionality
// Use with Hardhat: npx hardhat test

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token v24 - Complete Test Suite", function() {
    let token;
    let owner;
    let addr1, addr2, addr3, addr4, addr5;
    let exemptAddr1, exemptAddr2;
    let addrs;
    
    const TOTAL_SUPPLY = ethers.parseEther("1000000");
    const DEV_WALLET_BALANCE = ethers.parseEther("600000");
    const CONTRACT_BALANCE = ethers.parseEther("400000");
    const MAX_TX = ethers.parseEther("1000");
    const MAX_WALLET = ethers.parseEther("20000");
    const MAX_EXEMPT_TO_NORMAL = ethers.parseEther("100");
    const COOLDOWN = 2 * 60 * 60;
    const EXEMPT_TO_NORMAL_COOLDOWN = 24 * 60 * 60;
    const TRADING_LOCK = 48 * 60 * 60;
    const PAUSE_DURATION = 48 * 60 * 60;
    
    const MARKETING_ALLOCATION = ethers.parseEther("150000");
    const TEAM_ALLOCATION = ethers.parseEther("200000");
    const ADVISOR_ALLOCATION = ethers.parseEther("150000");
    const TOTAL_DISTRIBUTION = ethers.parseEther("500000");
    const DEV_REMAINING = ethers.parseEther("100000");
    
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
            expect(await token.decimals()).to.equal(18);
        });
        
        it("1.2 Should mint correct total supply", async function() {
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("1.3 Should set immutable owner correctly", async function() {
            expect(await token.owner()).to.equal(owner.address);
        });
        
        it("1.4 Should initialize 48-hour trading lock", async function() {
            expect(await token.isTradingEnabled()).to.equal(false);
            const timeLeft = await token.timeUntilTradingEnabled();
            expect(timeLeft).to.be.closeTo(TRADING_LOCK, 5);
        });
        
        it("1.5 Should detect testnet deployment", async function() {
            expect(await token.isTestnet()).to.equal(true);
        });
        
        it("1.6 Should start with empty exempt slots (4 slots)", async function() {
            const exempts = await token.getExemptAddresses();
            expect(exempts.slots[0]).to.equal(ethers.ZeroAddress);
            expect(exempts.slots[1]).to.equal(ethers.ZeroAddress);
            expect(exempts.slots[2]).to.equal(ethers.ZeroAddress);
            expect(exempts.slots[3]).to.equal(ethers.ZeroAddress);
            expect(exempts.slotsLocked).to.equal(false);
        });
    });
    
    describe("2. Exempt Slot Management", function() {
        it("2.1 Should allow owner to set exempt slots (4 slots)", async function() {
            await token.updateExemptSlots(
                [exemptAddr1.address, exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress]
            );
            
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
            expect(await token.isExemptAddress(addr1.address)).to.equal(false);
        });
        
        it("2.2 Should permanently lock exempt slots", async function() {
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
    });
    
    describe("3. Fee Mechanism (Unified 0.08%)", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            const distAddrs = await token.getDistributionAddresses();
            await ethers.provider.send("hardhat_impersonateAccount", [distAddrs.devWallet]);
            const devSigner = await ethers.getSigner(distAddrs.devWallet);
            await owner.sendTransaction({ to: distAddrs.devWallet, value: ethers.parseEther("1.0") });
            await token.connect(devSigner).transfer(addr1.address, ethers.parseEther("10000"));
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [distAddrs.devWallet]);
        });
        
        it("3.1 Should apply 0.08% fee on normal transfers", async function() {
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
    });
    
    describe("4. Transaction Limits", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            const distAddrs = await token.getDistributionAddresses();
            await ethers.provider.send("hardhat_impersonateAccount", [distAddrs.devWallet]);
            const devSigner = await ethers.getSigner(distAddrs.devWallet);
            await owner.sendTransaction({ to: distAddrs.devWallet, value: ethers.parseEther("1.0") });
            await token.connect(devSigner).transfer(addr1.address, ethers.parseEther("15000"));
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [distAddrs.devWallet]);
        });
        
        it("4.1 Should enforce max transaction limit (1,000 tokens)", async function() {
            await token.connect(addr1).transfer(addr2.address, MAX_TX);
            await time.increase(COOLDOWN + 1);
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("1001"))
            ).to.be.revertedWith("Max 1000");
        });
        
        it("4.2 Should enforce 2-hour cooldown", async function() {
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("500"));
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Wait 2h");
            
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"));
            expect(await token.balanceOf(addr3.address)).to.be.gt(0);
        });
    });
});