// KCY1 Token (KCY-MEME-1) - Comprehensive Test Suite
// Tests all critical fixes and functionality
// Use with Hardhat: npx hardhat test

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token - Complete Test Suite", function() {
    let token;
    let owner;
    let devWallet, marketingWallet, teamWallet, advisorWallet;
    let addr1, addr2, addr3, addr4, addr5;
    let exemptAddr1, exemptAddr2;
    let addrs;
    
    // Constants
    const TOTAL_SUPPLY = ethers.parseEther("1000000");
    const DEV_WALLET_BALANCE = ethers.parseEther("600000");
    const CONTRACT_BALANCE = ethers.parseEther("400000");
    const MAX_TX = ethers.parseEther("1000");
    const MAX_WALLET = ethers.parseEther("20000");
    const MAX_EXEMPT_TO_NORMAL = ethers.parseEther("100");
    const COOLDOWN = 2 * 60 * 60; // 2 hours in seconds
    const EXEMPT_TO_NORMAL_COOLDOWN = 24 * 60 * 60; // 24 hours in seconds
    const TRADING_LOCK = 48 * 60 * 60; // 48 hours in seconds
    const PAUSE_DURATION = 48 * 60 * 60; // 48 hours in seconds
    
    // Distribution amounts
    const MARKETING_ALLOCATION = ethers.parseEther("150000");
    const TEAM_ALLOCATION = ethers.parseEther("200000");
    const ADVISOR_ALLOCATION = ethers.parseEther("150000");
    const TOTAL_DISTRIBUTION = ethers.parseEther("500000");
    const DEV_REMAINING = ethers.parseEther("100000");
    
    // PancakeSwap addresses (BSC Mainnet)
    const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
    
    // Real wallet addresses from contract
    const DEV_WALLET_ADDR = "0x567c1c5e9026E04078F9b92DcF295A58355f60c7";
    const MARKETING_WALLET_ADDR = "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A";
    const TEAM_WALLET_ADDR = "0x6300811567bed7d69B5AC271060a7E298f99fddd";
    const ADVISOR_WALLET_ADDR = "0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87";
    
    beforeEach(async function() {
        // Get signers
        [owner, addr1, addr2, addr3, addr4, addr5, exemptAddr1, exemptAddr2, ...addrs] = await ethers.getSigners();
        
        // Deploy contract
        const KCY1Token = await ethers.getContractFactory("KCY1Token");
        token = await KCY1Token.deploy();
        await token.waitForDeployment();
    });
    
    // ============================================
    // SECTION 1: DEPLOYMENT & INITIALIZATION
    // ============================================
    describe("1. Deployment & Initialization", function() {
        it("1.1 Should set correct token metadata", async function() {
            expect(await token.name()).to.equal("KCY1");
            expect(await token.symbol()).to.equal("KCY1");
            expect(await token.decimals()).to.equal(18);
        });
        
        it("1.2 Should mint correct total supply", async function() {
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("1.3 Should distribute tokens correctly (600k DEV_WALLET_mm_vis, 400k contract)", async function() {
            // DEV_WALLET_mm_vis should have 600,000 tokens
            expect(await token.balanceOf(DEV_WALLET_ADDR)).to.equal(DEV_WALLET_BALANCE);
            // Contract should have 400,000 tokens
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("1.4 Should set immutable owner correctly", async function() {
            expect(await token.owner()).to.equal(owner.address);
        });
        
        it("1.5 Should initialize 48-hour trading lock", async function() {
            expect(await token.isTradingEnabled()).to.equal(false);
            const timeLeft = await token.timeUntilTradingEnabled();
            expect(timeLeft).to.be.closeTo(TRADING_LOCK, 5);
        });
        
        it("1.6 Should initialize PancakeSwap addresses", async function() {
            expect(await token.pancakeswapRouter()).to.equal(PANCAKE_ROUTER);
            expect(await token.pancakeswapFactory()).to.equal(PANCAKE_FACTORY);
        });
        
        it("1.7 Should start with empty exempt addresses (4 slots)", async function() {
            const exempts = await token.getExemptAddresses();
            expect(exempts.addresses[0]).to.equal(ethers.ZeroAddress);
            expect(exempts.addresses[1]).to.equal(ethers.ZeroAddress);
            expect(exempts.addresses[2]).to.equal(ethers.ZeroAddress);
            expect(exempts.addresses[3]).to.equal(ethers.ZeroAddress);
            expect(exempts.locked).to.equal(false);
        });
    });
    
    // ============================================
    // SECTION 2: INITIAL DISTRIBUTION
    // ============================================
    describe("2. Initial Distribution", function() {
        it("2.1 Should distribute tokens correctly from DEV_WALLET_mm_vis", async function() {
            await token.distributeInitialAllocations();
            
            // Check marketing wallet received 150,000
            expect(await token.balanceOf(MARKETING_WALLET_ADDR)).to.equal(MARKETING_ALLOCATION);
            
            // Check team wallet received 200,000
            expect(await token.balanceOf(TEAM_WALLET_ADDR)).to.equal(TEAM_ALLOCATION);
            
            // Check advisor wallet received 150,000
            expect(await token.balanceOf(ADVISOR_WALLET_ADDR)).to.equal(ADVISOR_ALLOCATION);
            
            // Check DEV_WALLET_mm_vis has 100,000 remaining
            expect(await token.balanceOf(DEV_WALLET_ADDR)).to.equal(DEV_REMAINING);
            
            // Check contract balance unchanged (400,000)
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("2.2 Should only allow distribution once", async function() {
            await token.distributeInitialAllocations();
            
            await expect(
                token.distributeInitialAllocations()
            ).to.be.revertedWith("Distribution already completed");
        });
        
        it("2.3 Should only allow owner to call distribution", async function() {
            await expect(
                token.connect(addr1).distributeInitialAllocations()
            ).to.be.revertedWith("Not owner");
        });
        
        it("2.4 Should emit correct events during distribution", async function() {
            await expect(token.distributeInitialAllocations())
                .to.emit(token, "Transfer")
                .to.emit(token, "DistributionSent")
                .to.emit(token, "InitialDistributionCompleted");
        });
    });
    
    // ============================================
    // SECTION 3: EXEMPT ADDRESS MANAGEMENT
    // ============================================
    describe("3. Exempt Address Management", function() {
        it("3.1 Should allow owner to set exempt addresses (4 slots)", async function() {
            await token.updateExemptAddresses(
                [exemptAddr1.address, exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
            expect(await token.isExemptAddress(addr1.address)).to.equal(false);
        });
        
        it("3.2 Should allow multiple changes before lock", async function() {
            // First setting
            await token.updateExemptAddresses(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(true);
            
            // Second setting (overwrite)
            await token.updateExemptAddresses(
                [exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            expect(await token.isExemptAddress(exemptAddr1.address)).to.equal(false);
            expect(await token.isExemptAddress(exemptAddr2.address)).to.equal(true);
        });
        
        it("3.3 Should permanently lock exempt addresses", async function() {
            await token.updateExemptAddresses(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            
            // Lock the addresses
            await token.lockExemptAddressesForever();
            expect(await token.exemptAddressesLocked()).to.equal(true);
            
            // Try to change after lock - should fail
            await expect(
                token.updateExemptAddresses(
                    [exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                    PANCAKE_ROUTER,
                    PANCAKE_FACTORY
                )
            ).to.be.revertedWith("Exempt addresses are locked forever");
        });
        
        it("3.4 Should reject invalid router/factory addresses", async function() {
            await expect(
                token.updateExemptAddresses(
                    [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                    ethers.ZeroAddress,
                    PANCAKE_FACTORY
                )
            ).to.be.revertedWith("Router cannot be zero address");
            
            await expect(
                token.updateExemptAddresses(
                    [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                    PANCAKE_ROUTER,
                    ethers.ZeroAddress
                )
            ).to.be.revertedWith("Factory cannot be zero address");
        });
        
        it("3.5 Should recognize owner and contract as always exempt", async function() {
            expect(await token.isExemptAddress(owner.address)).to.equal(true);
            expect(await token.isExemptAddress(await token.getAddress())).to.equal(true);
        });
    });
    
    // ============================================
    // SECTION 4: FEE MECHANISM (3% BURN + 5% OWNER)
    // ============================================
    describe("4. Fee Mechanism", function() {
        beforeEach(async function() {
            // Skip 48-hour trading lock
            await time.increase(TRADING_LOCK + 1);
            
            // Transfer from DEV_WALLET to addr1 for testing
            // Note: We need to impersonate DEV_WALLET
            await ethers.provider.send("hardhat_impersonateAccount", [DEV_WALLET_ADDR]);
            const devWalletSigner = await ethers.getSigner(DEV_WALLET_ADDR);
            
            // Fund the impersonated account with ETH for gas
            await owner.sendTransaction({
                to: DEV_WALLET_ADDR,
                value: ethers.parseEther("1.0")
            });
            
            // Transfer tokens to addr1
            await token.connect(devWalletSigner).transfer(addr1.address, ethers.parseEther("10000"));
            
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [DEV_WALLET_ADDR]);
        });
        
        it("4.1 Should apply 3% burn and 5% owner fee on regular transfers", async function() {
            const amount = ethers.parseEther("1000");
            const burnFee = (amount * 300n) / 10000n; // 3%
            const ownerFee = (amount * 500n) / 10000n; // 5%
            const netAmount = amount - burnFee - ownerFee; // 92%
            
            const initialSupply = await token.totalSupply();
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            await token.connect(addr1).transfer(addr2.address, amount);
            
            // Check recipient received 92%
            expect(await token.balanceOf(addr2.address)).to.equal(netAmount);
            
            // Check 3% was burned
            expect(await token.totalSupply()).to.equal(initialSupply - burnFee);
            
            // Check owner received 5%
            const expectedOwnerBalance = initialOwnerBalance + ownerFee;
            expect(await token.balanceOf(owner.address)).to.equal(expectedOwnerBalance);
        });
        
        it("4.2 Exempt addresses should pay NO fees", async function() {
            // Set addr3 as exempt
            await token.updateExemptAddresses(
                [addr3.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            
            const amount = ethers.parseEther("1000");
            
            // Transfer from addr1 (normal) to addr3 (exempt)
            await token.connect(addr1).transfer(addr3.address, amount);
            
            // addr3 should receive 100% (no fees)
            expect(await token.balanceOf(addr3.address)).to.equal(amount);
        });
    });
    
    // ============================================
    // SECTION 5: EXEMPT TO NORMAL RESTRICTIONS
    // ============================================
    describe("5. Exempt to Normal Transfer Restrictions", function() {
        beforeEach(async function() {
            // Skip trading lock
            await time.increase(TRADING_LOCK + 1);
            
            // Set exemptAddr1 as exempt
            await token.updateExemptAddresses(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            
            // Give tokens to exemptAddr1
            await ethers.provider.send("hardhat_impersonateAccount", [DEV_WALLET_ADDR]);
            const devWalletSigner = await ethers.getSigner(DEV_WALLET_ADDR);
            await owner.sendTransaction({
                to: DEV_WALLET_ADDR,
                value: ethers.parseEther("1.0")
            });
            await token.connect(devWalletSigner).transfer(exemptAddr1.address, ethers.parseEther("1000"));
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [DEV_WALLET_ADDR]);
        });
        
        it("5.1 Should enforce 100 token limit for exempt→normal transfers", async function() {
            // Should succeed with 100 tokens
            await token.connect(exemptAddr1).transfer(addr1.address, MAX_EXEMPT_TO_NORMAL);
            expect(await token.balanceOf(addr1.address)).to.equal(MAX_EXEMPT_TO_NORMAL);
            
            // Should fail with 101 tokens
            await expect(
                token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("101"))
            ).to.be.revertedWith("Exempt to normal: exceeds 100 token limit");
        });
        
        it("5.2 Should enforce 24-hour cooldown for exempt→normal transfers", async function() {
            // First transfer should succeed
            await token.connect(exemptAddr1).transfer(addr1.address, ethers.parseEther("50"));
            
            // Second immediate transfer should fail
            await expect(
                token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Exempt to normal: must wait 24 hours between transfers");
            
            // After 24 hours, should succeed
            await time.increase(EXEMPT_TO_NORMAL_COOLDOWN + 1);
            await token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"));
            expect(await token.balanceOf(addr2.address)).to.equal(ethers.parseEther("50"));
        });
        
        it("5.3 Exempt→Exempt transfers should have NO limits", async function() {
            // Set exemptAddr2 as exempt
            await token.updateExemptAddresses(
                [exemptAddr1.address, exemptAddr2.address, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            
            // Should allow transfer over 100 tokens
            await token.connect(exemptAddr1).transfer(exemptAddr2.address, ethers.parseEther("500"));
            expect(await token.balanceOf(exemptAddr2.address)).to.equal(ethers.parseEther("500"));
        });
    });
    
    // ============================================
    // SECTION 6: PAUSE AND BLACKLIST EXEMPTION
    // ============================================
    describe("6. Pause and Blacklist Exemption for Exempt Addresses", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            
            // Set exemptAddr1 as exempt
            await token.updateExemptAddresses(
                [exemptAddr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress],
                PANCAKE_ROUTER,
                PANCAKE_FACTORY
            );
            
            // Give tokens to both exempt and normal addresses
            await ethers.provider.send("hardhat_impersonateAccount", [DEV_WALLET_ADDR]);
            const devWalletSigner = await ethers.getSigner(DEV_WALLET_ADDR);
            await owner.sendTransaction({
                to: DEV_WALLET_ADDR,
                value: ethers.parseEther("1.0")
            });
            await token.connect(devWalletSigner).transfer(exemptAddr1.address, ethers.parseEther("1000"));
            await token.connect(devWalletSigner).transfer(addr1.address, ethers.parseEther("1000"));
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [DEV_WALLET_ADDR]);
        });
        
        it("6.1 Exempt addresses can transfer during pause", async function() {
            // Pause the contract
            await token.pause();
            expect(await token.isPaused()).to.equal(true);
            
            // Exempt should be able to transfer
            await token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"));
            expect(await token.balanceOf(addr2.address)).to.equal(ethers.parseEther("50"));
            
            // Normal addresses should be blocked
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Contract is paused");
        });
        
        it("6.2 Blacklisted exempt addresses can still transfer", async function() {
            // Blacklist exemptAddr1
            await token.setBlacklist(exemptAddr1.address, true);
            expect(await token.isBlacklisted(exemptAddr1.address)).to.equal(true);
            
            // Exempt should still be able to transfer
            await token.connect(exemptAddr1).transfer(addr2.address, ethers.parseEther("50"));
            expect(await token.balanceOf(addr2.address)).to.equal(ethers.parseEther("50"));
        });
        
        it("6.3 Blacklisted normal addresses cannot transfer", async function() {
            // Blacklist addr1
            await token.setBlacklist(addr1.address, true);
            
            // Normal address should be blocked
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Sender is blacklisted");
        });
    });
    
    // ============================================
    // SECTION 7: TRANSACTION LIMITS (NORMAL USERS)
    // ============================================
    describe("7. Transaction Limits for Normal Users", function() {
        beforeEach(async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await ethers.provider.send("hardhat_impersonateAccount", [DEV_WALLET_ADDR]);
            const devWalletSigner = await ethers.getSigner(DEV_WALLET_ADDR);
            await owner.sendTransaction({
                to: DEV_WALLET_ADDR,
                value: ethers.parseEther("1.0")
            });
            await token.connect(devWalletSigner).transfer(addr1.address, ethers.parseEther("15000"));
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [DEV_WALLET_ADDR]);
        });
        
        it("7.1 Should enforce max transaction limit (1,000 tokens)", async function() {
            // Should succeed with 1,000 tokens
            await token.connect(addr1).transfer(addr2.address, MAX_TX);
            
            // Should fail with 1,001 tokens
            await time.increase(COOLDOWN + 1);
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("1001"))
            ).to.be.revertedWith("Exceeds max transaction (1000 tokens)");
        });
        
        it("7.2 Should enforce max wallet limit (20,000 tokens)", async function() {
            // Try to send more than MAX_WALLET to addr2
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("20001"))
            ).to.be.revertedWith("Recipient would exceed max wallet (20,000 tokens)");
        });
        
        it("7.3 Should enforce 2-hour cooldown between transfers", async function() {
            // First transfer
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("500"));
            
            // Immediate second transfer should fail
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"))
            ).to.be.revertedWith("Must wait 2 hours between transactions");
            
            // After 2 hours, should succeed
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"));
            expect(await token.balanceOf(addr3.address)).to.be.gt(0);
        });
    });
    
    // ============================================
    // SECTION 8: OWNER FUNCTIONS
    // ============================================
    describe("8. Owner Functions", function() {
        it("8.1 Should allow owner to pause/unpause", async function() {
            await token.pause();
            expect(await token.isPaused()).to.equal(true);
            
            // Auto-unpause after 48 hours
            await time.increase(PAUSE_DURATION + 1);
            expect(await token.isPaused()).to.equal(false);
        });
        
        it("8.2 Should allow owner to blacklist addresses", async function() {
            await token.setBlacklist(addr1.address, true);
            expect(await token.isBlacklisted(addr1.address)).to.equal(true);
            
            // Unblacklist
            await token.setBlacklist(addr1.address, false);
            expect(await token.isBlacklisted(addr1.address)).to.equal(false);
        });
        
        it("8.3 Should allow owner to blacklist multiple addresses", async function() {
            await token.setBlacklistBatch([addr1.address, addr2.address, addr3.address], true);
            
            expect(await token.isBlacklisted(addr1.address)).to.equal(true);
            expect(await token.isBlacklisted(addr2.address)).to.equal(true);
            expect(await token.isBlacklisted(addr3.address)).to.equal(true);
        });
        
        it("8.4 Should not allow blacklisting owner or contract", async function() {
            await expect(
                token.setBlacklist(owner.address, true)
            ).to.be.revertedWith("Cannot blacklist owner");
            
            await expect(
                token.setBlacklist(await token.getAddress(), true)
            ).to.be.revertedWith("Cannot blacklist contract");
        });
        
        it("8.5 Should allow owner to withdraw contract tokens", async function() {
            const initialOwnerBalance = await token.balanceOf(owner.address);
            const contractBalance = await token.balanceOf(await token.getAddress());
            
            await token.withdrawCirculationTokens(ethers.parseEther("10000"));
            
            expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance + ethers.parseEther("10000"));
            expect(await token.balanceOf(await token.getAddress())).to.equal(contractBalance - ethers.parseEther("10000"));
        });
        
        it("8.6 Should allow owner to burn tokens", async function() {
            const initialSupply = await token.totalSupply();
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            await token.burn(ethers.parseEther("1000"));
            
            expect(await token.totalSupply()).to.equal(initialSupply - ethers.parseEther("1000"));
            expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance - ethers.parseEther("1000"));
        });
    });
    
    // ============================================
    // SECTION 9: SECURITY & EDGE CASES
    // ============================================
    describe("9. Security & Edge Cases", function() {
        it("9.1 Should prevent non-owner from calling owner functions", async function() {
            await expect(token.connect(addr1).pause()).to.be.revertedWith("Not owner");
            await expect(token.connect(addr1).setBlacklist(addr2.address, true)).to.be.revertedWith("Not owner");
            await expect(token.connect(addr1).burn(ethers.parseEther("100"))).to.be.revertedWith("Not owner");
        });
        
        it("9.2 Should handle zero address transfers correctly", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await ethers.provider.send("hardhat_impersonateAccount", [DEV_WALLET_ADDR]);
            const devWalletSigner = await ethers.getSigner(DEV_WALLET_ADDR);
            await owner.sendTransaction({
                to: DEV_WALLET_ADDR,
                value: ethers.parseEther("1.0")
            });
            
            await expect(
                token.connect(devWalletSigner).transfer(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.revertedWith("Transfer to zero address");
            
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [DEV_WALLET_ADDR]);
        });
        
        it("9.3 Should handle insufficient balance correctly", async function() {
            await time.increase(TRADING_LOCK + 1);
            
            await expect(
                token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Insufficient balance");
        });
    });
});
