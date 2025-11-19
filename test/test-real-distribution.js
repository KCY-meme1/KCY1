// KCY1 Token - Real Distribution Testing with Different Addresses
// This test uses MockKCY1Distribution to test REAL distribution behavior

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KCY1 Token - REAL Distribution Testing (Different Wallets)", function() {
    let mockToken;
    let owner;
    let devWallet, marketingWallet, teamWallet, advisorWallet;
    let addr1, addr2;
    
    const TOTAL_SUPPLY = ethers.parseEther("1000000");
    const DEV_INITIAL_BALANCE = ethers.parseEther("600000");
    const CONTRACT_BALANCE = ethers.parseEther("400000");
    
    const MARKETING_ALLOCATION = ethers.parseEther("150000");
    const TEAM_ALLOCATION = ethers.parseEther("200000");
    const ADVISOR_ALLOCATION = ethers.parseEther("150000");
    const TOTAL_DISTRIBUTION = ethers.parseEther("500000");
    const DEV_REMAINING = ethers.parseEther("100000");
    
    beforeEach(async function() {
        [owner, devWallet, marketingWallet, teamWallet, advisorWallet, addr1, addr2] = await ethers.getSigners();
        
        // Deploy mock with DIFFERENT addresses for each wallet
        const MockKCY1Distribution = await ethers.getContractFactory("MockKCY1Distribution");
        mockToken = await MockKCY1Distribution.deploy(
            devWallet.address,
            marketingWallet.address,
            teamWallet.address,
            advisorWallet.address
        );
        await mockToken.waitForDeployment();
    });
    
    describe("Pre-Distribution State", function() {
        it("Should set correct distribution addresses (all DIFFERENT)", async function() {
            const distAddrs = await mockToken.getDistributionAddresses();
            
            expect(distAddrs.devWallet).to.equal(devWallet.address);
            expect(distAddrs.marketingWallet).to.equal(marketingWallet.address);
            expect(distAddrs.teamWallet).to.equal(teamWallet.address);
            expect(distAddrs.advisorWallet).to.equal(advisorWallet.address);
            
            // Verify all addresses are different
            expect(distAddrs.devWallet).to.not.equal(distAddrs.marketingWallet);
            expect(distAddrs.devWallet).to.not.equal(distAddrs.teamWallet);
            expect(distAddrs.devWallet).to.not.equal(distAddrs.advisorWallet);
            expect(distAddrs.marketingWallet).to.not.equal(distAddrs.teamWallet);
            expect(distAddrs.marketingWallet).to.not.equal(distAddrs.advisorWallet);
            expect(distAddrs.teamWallet).to.not.equal(distAddrs.advisorWallet);
        });
        
        it("Should have correct initial balances BEFORE distribution", async function() {
            expect(await mockToken.balanceOf(devWallet.address)).to.equal(DEV_INITIAL_BALANCE);
            expect(await mockToken.balanceOf(marketingWallet.address)).to.equal(0);
            expect(await mockToken.balanceOf(teamWallet.address)).to.equal(0);
            expect(await mockToken.balanceOf(advisorWallet.address)).to.equal(0);
            expect(await mockToken.balanceOf(await mockToken.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("Should have initialDistributionCompleted set to false", async function() {
            expect(await mockToken.initialDistributionCompleted()).to.equal(false);
        });
    });
    
    describe("Distribution Execution", function() {
        it("Should emit Transfer events for EACH distribution wallet", async function() {
            const tx = await mockToken.distributeInitialAllocations();
            
            // Check Transfer to Marketing wallet
            await expect(tx)
                .to.emit(mockToken, "Transfer")
                .withArgs(devWallet.address, marketingWallet.address, MARKETING_ALLOCATION);
            
            // Check Transfer to Team wallet
            await expect(tx)
                .to.emit(mockToken, "Transfer")
                .withArgs(devWallet.address, teamWallet.address, TEAM_ALLOCATION);
            
            // Check Transfer to Advisor wallet
            await expect(tx)
                .to.emit(mockToken, "Transfer")
                .withArgs(devWallet.address, advisorWallet.address, ADVISOR_ALLOCATION);
        });
        
        it("Should emit DistributionSent events for EACH distribution wallet", async function() {
            const tx = await mockToken.distributeInitialAllocations();
            
            // Check DistributionSent for Marketing
            await expect(tx)
                .to.emit(mockToken, "DistributionSent")
                .withArgs(marketingWallet.address, MARKETING_ALLOCATION);
            
            // Check DistributionSent for Team
            await expect(tx)
                .to.emit(mockToken, "DistributionSent")
                .withArgs(teamWallet.address, TEAM_ALLOCATION);
            
            // Check DistributionSent for Advisor
            await expect(tx)
                .to.emit(mockToken, "DistributionSent")
                .withArgs(advisorWallet.address, ADVISOR_ALLOCATION);
        });
        
        it("Should emit InitialDistributionCompleted event with correct total", async function() {
            await expect(mockToken.distributeInitialAllocations())
                .to.emit(mockToken, "InitialDistributionCompleted")
                .withArgs(TOTAL_DISTRIBUTION);
        });
        
        it("Should have exactly 4 events: 3 Transfers + 3 DistributionSent + 1 InitialDistributionCompleted", async function() {
            const tx = await mockToken.distributeInitialAllocations();
            const receipt = await tx.wait();
            
            const transferEvents = receipt.logs.filter(
                log => log.fragment && log.fragment.name === 'Transfer'
            );
            const distributionSentEvents = receipt.logs.filter(
                log => log.fragment && log.fragment.name === 'DistributionSent'
            );
            const completedEvents = receipt.logs.filter(
                log => log.fragment && log.fragment.name === 'InitialDistributionCompleted'
            );
            
            expect(transferEvents.length).to.equal(3); // Marketing, Team, Advisor
            expect(distributionSentEvents.length).to.equal(3); // Marketing, Team, Advisor
            expect(completedEvents.length).to.equal(1); // One completion event
        });
    });
    
    describe("Post-Distribution Balances - THE CRITICAL TEST", function() {
        beforeEach(async function() {
            await mockToken.distributeInitialAllocations();
        });
        
        it("✅ Marketing wallet should have EXACTLY 150,000 tokens", async function() {
            const balance = await mockToken.balanceOf(marketingWallet.address);
            expect(balance).to.equal(MARKETING_ALLOCATION);
            expect(balance).to.equal(ethers.parseEther("150000"));
        });
        
        it("✅ Team wallet should have EXACTLY 200,000 tokens", async function() {
            const balance = await mockToken.balanceOf(teamWallet.address);
            expect(balance).to.equal(TEAM_ALLOCATION);
            expect(balance).to.equal(ethers.parseEther("200000"));
        });
        
        it("✅ Advisor wallet should have EXACTLY 150,000 tokens", async function() {
            const balance = await mockToken.balanceOf(advisorWallet.address);
            expect(balance).to.equal(ADVISOR_ALLOCATION);
            expect(balance).to.equal(ethers.parseEther("150000"));
        });
        
        it("✅ Dev wallet should have EXACTLY 100,000 tokens remaining", async function() {
            const balance = await mockToken.balanceOf(devWallet.address);
            expect(balance).to.equal(DEV_REMAINING);
            expect(balance).to.equal(ethers.parseEther("100000"));
        });
        
        it("✅ Contract should still have 400,000 tokens", async function() {
            const balance = await mockToken.balanceOf(await mockToken.getAddress());
            expect(balance).to.equal(CONTRACT_BALANCE);
            expect(balance).to.equal(ethers.parseEther("400000"));
        });
        
        it("✅ Total of all distributed tokens should equal 500,000", async function() {
            const marketingBalance = await mockToken.balanceOf(marketingWallet.address);
            const teamBalance = await mockToken.balanceOf(teamWallet.address);
            const advisorBalance = await mockToken.balanceOf(advisorWallet.address);
            
            const totalDistributed = marketingBalance + teamBalance + advisorBalance;
            expect(totalDistributed).to.equal(TOTAL_DISTRIBUTION);
            expect(totalDistributed).to.equal(ethers.parseEther("500000"));
        });
        
        it("✅ Total supply should remain unchanged at 1,000,000", async function() {
            expect(await mockToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await mockToken.totalSupply()).to.equal(ethers.parseEther("1000000"));
        });
        
        it("✅ Sum of all balances should equal total supply", async function() {
            const devBalance = await mockToken.balanceOf(devWallet.address);
            const marketingBalance = await mockToken.balanceOf(marketingWallet.address);
            const teamBalance = await mockToken.balanceOf(teamWallet.address);
            const advisorBalance = await mockToken.balanceOf(advisorWallet.address);
            const contractBalance = await mockToken.balanceOf(await mockToken.getAddress());
            
            const totalBalances = devBalance + marketingBalance + teamBalance + advisorBalance + contractBalance;
            expect(totalBalances).to.equal(TOTAL_SUPPLY);
        });
    });
    
    describe("Distribution Math Verification", function() {
        it("Should verify allocation percentages", async function() {
            // Dev starts with 600,000 (60%)
            expect(DEV_INITIAL_BALANCE).to.equal(TOTAL_SUPPLY * 60n / 100n);
            
            // Marketing gets 150,000 (15% of total supply)
            expect(MARKETING_ALLOCATION).to.equal(TOTAL_SUPPLY * 15n / 100n);
            
            // Team gets 200,000 (20% of total supply)
            expect(TEAM_ALLOCATION).to.equal(TOTAL_SUPPLY * 20n / 100n);
            
            // Advisor gets 150,000 (15% of total supply)
            expect(ADVISOR_ALLOCATION).to.equal(TOTAL_SUPPLY * 15n / 100n);
            
            // Dev remaining is 100,000 (10% of total supply)
            expect(DEV_REMAINING).to.equal(TOTAL_SUPPLY * 10n / 100n);
        });
        
        it("Should verify distribution adds up correctly", async function() {
            expect(MARKETING_ALLOCATION + TEAM_ALLOCATION + ADVISOR_ALLOCATION).to.equal(TOTAL_DISTRIBUTION);
            expect(DEV_INITIAL_BALANCE - TOTAL_DISTRIBUTION).to.equal(DEV_REMAINING);
        });
    });
    
    describe("Distribution Security", function() {
        it("Should prevent double distribution", async function() {
            await mockToken.distributeInitialAllocations();
            
            await expect(
                mockToken.distributeInitialAllocations()
            ).to.be.revertedWith("Dist completed");
        });
        
        it("Should only allow owner to distribute", async function() {
            await expect(
                mockToken.connect(addr1).distributeInitialAllocations()
            ).to.be.revertedWith("Not owner");
        });
        
        it("Should set initialDistributionCompleted flag", async function() {
            expect(await mockToken.initialDistributionCompleted()).to.equal(false);
            
            await mockToken.distributeInitialAllocations();
            
            expect(await mockToken.initialDistributionCompleted()).to.equal(true);
        });
    });
    
    describe("Edge Cases", function() {
        it("Should handle case where one wallet is same as dev wallet", async function() {
            // Deploy with marketing wallet same as dev wallet
            const MockKCY1Distribution = await ethers.getContractFactory("MockKCY1Distribution");
            const testToken = await MockKCY1Distribution.deploy(
                devWallet.address,
                devWallet.address, // Same as dev
                teamWallet.address,
                advisorWallet.address
            );
            
            await testToken.distributeInitialAllocations();
            
            // Marketing allocation should NOT be transferred (same wallet)
            // So dev wallet should have: 600,000 - 200,000 - 150,000 = 250,000
            const devBalance = await testToken.balanceOf(devWallet.address);
            expect(devBalance).to.equal(ethers.parseEther("250000"));
        });
        
        it("Should handle case where all wallets are same as dev wallet", async function() {
            // Deploy with all wallets same as dev
            const MockKCY1Distribution = await ethers.getContractFactory("MockKCY1Distribution");
            const testToken = await MockKCY1Distribution.deploy(
                devWallet.address,
                devWallet.address,
                devWallet.address,
                devWallet.address
            );
            
            await testToken.distributeInitialAllocations();
            
            // No transfers should occur, balance should remain 600,000
            const devBalance = await testToken.balanceOf(devWallet.address);
            expect(devBalance).to.equal(DEV_INITIAL_BALANCE);
        });
    });
});