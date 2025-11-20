// KCY1 Token v31 - Real Distribution Testing with Different Addresses (100M Supply)
// This test uses MockKCY1Distribution to test REAL distribution behavior

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KCY1 Token v31 - REAL Distribution Testing (100M Supply)", function() {
    let mockToken;
    let owner;
    let devWallet, marketingWallet, teamWallet, advisorWallet;
    let addr1, addr2;
    
    const TOTAL_SUPPLY = ethers.parseEther("100000000");
    const DEV_INITIAL_BALANCE = ethers.parseEther("96000000");
    const CONTRACT_BALANCE = ethers.parseEther("4000000");
    
    const MARKETING_ALLOCATION = ethers.parseEther("1500000");
    const TEAM_ALLOCATION = ethers.parseEther("1000000");
    const ADVISOR_ALLOCATION = ethers.parseEther("1500000");
    const TOTAL_DISTRIBUTION = ethers.parseEther("4000000");
    const DEV_REMAINING = ethers.parseEther("96000000"); // DEV не се променя
    const CONTRACT_REMAINING = ethers.parseEther("0"); // Contract става 0
    
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
        it("Should emit Transfer events from CONTRACT to EACH distribution wallet", async function() {
            const contractAddress = await mockToken.getAddress();
            const tx = await mockToken.distributeInitialAllocations();
            
            // Check Transfer from CONTRACT to Marketing wallet
            await expect(tx)
                .to.emit(mockToken, "Transfer")
                .withArgs(contractAddress, marketingWallet.address, MARKETING_ALLOCATION);
            
            // Check Transfer from CONTRACT to Team wallet
            await expect(tx)
                .to.emit(mockToken, "Transfer")
                .withArgs(contractAddress, teamWallet.address, TEAM_ALLOCATION);
            
            // Check Transfer from CONTRACT to Advisor wallet
            await expect(tx)
                .to.emit(mockToken, "Transfer")
                .withArgs(contractAddress, advisorWallet.address, ADVISOR_ALLOCATION);
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
        
        it("Should have exactly 7 events: 3 Transfers + 3 DistributionSent + 1 InitialDistributionCompleted", async function() {
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
        
        it("✅ Marketing wallet should have EXACTLY 1,500,000 tokens", async function() {
            const balance = await mockToken.balanceOf(marketingWallet.address);
            expect(balance).to.equal(MARKETING_ALLOCATION);
            expect(balance).to.equal(ethers.parseEther("1500000"));
        });
        
        it("✅ Team wallet should have EXACTLY 1,000,000 tokens", async function() {
            const balance = await mockToken.balanceOf(teamWallet.address);
            expect(balance).to.equal(TEAM_ALLOCATION);
            expect(balance).to.equal(ethers.parseEther("1000000"));
        });
        
        it("✅ Advisor wallet should have EXACTLY 1,500,000 tokens", async function() {
            const balance = await mockToken.balanceOf(advisorWallet.address);
            expect(balance).to.equal(ADVISOR_ALLOCATION);
            expect(balance).to.equal(ethers.parseEther("1500000"));
        });
        
        it("✅ Dev wallet should have EXACTLY 96,000,000 tokens remaining (unchanged)", async function() {
            const balance = await mockToken.balanceOf(devWallet.address);
            expect(balance).to.equal(DEV_REMAINING);
            expect(balance).to.equal(ethers.parseEther("96000000"));
        });
        
        it("✅ Contract should have 0 tokens after distribution", async function() {
            const balance = await mockToken.balanceOf(await mockToken.getAddress());
            expect(balance).to.equal(CONTRACT_REMAINING);
            expect(balance).to.equal(ethers.parseEther("0"));
        });
        
        it("✅ Total of all distributed tokens should equal 4,000,000", async function() {
            const marketingBalance = await mockToken.balanceOf(marketingWallet.address);
            const teamBalance = await mockToken.balanceOf(teamWallet.address);
            const advisorBalance = await mockToken.balanceOf(advisorWallet.address);
            
            const totalDistributed = marketingBalance + teamBalance + advisorBalance;
            expect(totalDistributed).to.equal(TOTAL_DISTRIBUTION);
            expect(totalDistributed).to.equal(ethers.parseEther("4000000"));
        });
        
        it("✅ Total supply should remain unchanged at 100,000,000", async function() {
            expect(await mockToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await mockToken.totalSupply()).to.equal(ethers.parseEther("100000000"));
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
            // Dev starts with 96,000,000 (96%)
            expect(DEV_INITIAL_BALANCE).to.equal(TOTAL_SUPPLY * 96n / 100n);
            
            // Contract starts with 4,000,000 (4%)
            expect(CONTRACT_BALANCE).to.equal(TOTAL_SUPPLY * 4n / 100n);
            
            // Marketing gets 1,500,000 (1.5% of total supply)
            expect(MARKETING_ALLOCATION).to.equal(TOTAL_SUPPLY * 15n / 1000n);
            
            // Team gets 1,000,000 (1% of total supply)
            expect(TEAM_ALLOCATION).to.equal(TOTAL_SUPPLY * 10n / 1000n);
            
            // Advisor gets 1,500,000 (1.5% of total supply)
            expect(ADVISOR_ALLOCATION).to.equal(TOTAL_SUPPLY * 15n / 1000n);
        });
        
        it("Should verify distribution adds up correctly", async function() {
            expect(MARKETING_ALLOCATION + TEAM_ALLOCATION + ADVISOR_ALLOCATION).to.equal(TOTAL_DISTRIBUTION);
            expect(CONTRACT_BALANCE - TOTAL_DISTRIBUTION).to.equal(CONTRACT_REMAINING);
            expect(CONTRACT_BALANCE).to.equal(TOTAL_DISTRIBUTION); // Contract має рівно стільки, скільки розподіляється
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
            // Dev wallet stays at 96M (unchanged)
            // Team gets 1M from contract
            // Advisor gets 1.5M from contract
            const devBalance = await testToken.balanceOf(devWallet.address);
            expect(devBalance).to.equal(ethers.parseEther("96000000"));
            
            const teamBalance = await testToken.balanceOf(teamWallet.address);
            expect(teamBalance).to.equal(ethers.parseEther("1000000"));
            
            const advisorBalance = await testToken.balanceOf(advisorWallet.address);
            expect(advisorBalance).to.equal(ethers.parseEther("1500000"));
            
            // Contract should have 1.5M left (4M - 1M - 1.5M)
            const contractBalance = await testToken.balanceOf(await testToken.getAddress());
            expect(contractBalance).to.equal(ethers.parseEther("1500000"));
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
            
            // No transfers should occur, Dev balance should remain 96M
            const devBalance = await testToken.balanceOf(devWallet.address);
            expect(devBalance).to.equal(DEV_INITIAL_BALANCE);
            
            // Contract should still have all 4M
            const contractBalance = await testToken.balanceOf(await testToken.getAddress());
            expect(contractBalance).to.equal(CONTRACT_BALANCE);
        });
    });
});
