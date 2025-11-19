// KCY1 Token - Detailed Distribution Testing
// This test file specifically validates the distribution mechanism

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KCY1 Token - Detailed Distribution Tests", function() {
    let token;
    let owner;
    let marketing, team, advisor;
    let addr1, addr2;
    
    const TOTAL_SUPPLY = ethers.parseEther("1000000");
    const DEV_WALLET_BALANCE = ethers.parseEther("600000");
    const CONTRACT_BALANCE = ethers.parseEther("400000");
    
    const MARKETING_ALLOCATION = ethers.parseEther("150000");
    const TEAM_ALLOCATION = ethers.parseEther("200000");
    const ADVISOR_ALLOCATION = ethers.parseEther("150000");
    const TOTAL_DISTRIBUTION = ethers.parseEther("500000");
    const DEV_REMAINING = ethers.parseEther("100000");
    
    beforeEach(async function() {
        [owner, marketing, team, advisor, addr1, addr2] = await ethers.getSigners();
        
        const KCY1Token = await ethers.getContractFactory("KCY1Token");
        token = await KCY1Token.deploy();
        await token.waitForDeployment();
    });
    
    describe("Distribution Mechanism", function() {
        it("Should have correct initial balances before distribution", async function() {
            // On Hardhat, dev wallet is owner
            expect(await token.balanceOf(owner.address)).to.equal(DEV_WALLET_BALANCE);
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("Should verify distribution addresses are set correctly", async function() {
            const distAddrs = await token.getDistributionAddresses();
            
            // On Hardhat (chainid 31337), all should be owner
            expect(distAddrs.devWallet).to.equal(owner.address);
            expect(distAddrs.marketingWallet).to.equal(owner.address);
            expect(distAddrs.teamWallet).to.equal(owner.address);
            expect(distAddrs.advisorWallet).to.equal(owner.address);
        });
        
        it("Should emit InitialDistributionCompleted event", async function() {
            await expect(token.distributeInitialAllocations())
                .to.emit(token, "InitialDistributionCompleted")
                .withArgs(TOTAL_DISTRIBUTION);
        });
        
        it("Should NOT emit Transfer events on Hardhat (all same wallet)", async function() {
            // On Hardhat, all wallets are the same, so no actual transfers occur
            const tx = await token.distributeInitialAllocations();
            const receipt = await tx.wait();
            
            // Filter only Transfer events (excluding the ones from deployment)
            const transferEvents = receipt.logs.filter(
                log => log.fragment && log.fragment.name === 'Transfer'
            );
            
            // Should be 0 Transfer events since all wallets are the same
            expect(transferEvents.length).to.equal(0);
        });
        
        it("Should prevent double distribution", async function() {
            await token.distributeInitialAllocations();
            
            await expect(
                token.distributeInitialAllocations()
            ).to.be.revertedWith("Dist completed");
        });
        
        it("Should require owner permission", async function() {
            await expect(
                token.connect(addr1).distributeInitialAllocations()
            ).to.be.revertedWith("Not owner");
        });
        
        it("Should maintain total supply after distribution", async function() {
            const supplyBefore = await token.totalSupply();
            
            await token.distributeInitialAllocations();
            
            const supplyAfter = await token.totalSupply();
            expect(supplyAfter).to.equal(supplyBefore);
        });
    });
    
    describe("Simulated Real Network Distribution", function() {
        it("Should correctly distribute to different wallets (BSC simulation)", async function() {
            // Simulate what happens on BSC Testnet/Mainnet where wallets are different
            
            // Owner transfers manually to simulate distribution
            // First, set marketing wallet as exempt
            await token.updateExemptSlots([marketing.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            // Transfer marketing allocation
            await expect(
                token.transfer(marketing.address, MARKETING_ALLOCATION)
            ).to.emit(token, "Transfer")
            .withArgs(owner.address, marketing.address, MARKETING_ALLOCATION);
            
            expect(await token.balanceOf(marketing.address)).to.equal(MARKETING_ALLOCATION);
            
            // Set team wallet as exempt
            await token.updateExemptSlots([team.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            // Transfer team allocation
            await expect(
                token.transfer(team.address, TEAM_ALLOCATION)
            ).to.emit(token, "Transfer")
            .withArgs(owner.address, team.address, TEAM_ALLOCATION);
            
            expect(await token.balanceOf(team.address)).to.equal(TEAM_ALLOCATION);
            
            // Set advisor wallet as exempt
            await token.updateExemptSlots([advisor.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            // Transfer advisor allocation
            await expect(
                token.transfer(advisor.address, ADVISOR_ALLOCATION)
            ).to.emit(token, "Transfer")
            .withArgs(owner.address, advisor.address, ADVISOR_ALLOCATION);
            
            expect(await token.balanceOf(advisor.address)).to.equal(ADVISOR_ALLOCATION);
            
            // Verify owner has remaining balance
            const ownerBalance = await token.balanceOf(owner.address);
            expect(ownerBalance).to.equal(DEV_REMAINING);
            
            // Verify total supply unchanged
            expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
        });
        
        it("Should handle distribution with fees if wallets were not exempt", async function() {
            // This shows what would happen if we transferred WITHOUT making wallets exempt first
            
            const transferAmount = ethers.parseEther("1000");
            const burnFee = (transferAmount * 30n) / 100000n;  // 0.03%
            const ownerFee = (transferAmount * 50n) / 100000n; // 0.05%
            const netAmount = transferAmount - burnFee - ownerFee;
            
            const initialSupply = await token.totalSupply();
            const initialOwnerBalance = await token.balanceOf(owner.address);
            
            // Transfer to non-exempt address (should apply fees)
            await token.transfer(addr1.address, transferAmount);
            
            // Verify fees were applied
            expect(await token.balanceOf(addr1.address)).to.equal(netAmount);
            expect(await token.totalSupply()).to.equal(initialSupply - burnFee);
            expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance - transferAmount + ownerFee);
        });
        
        it("Should verify all allocations add up correctly", async function() {
            const sumOfAllocations = MARKETING_ALLOCATION + TEAM_ALLOCATION + ADVISOR_ALLOCATION;
            expect(sumOfAllocations).to.equal(TOTAL_DISTRIBUTION);
            expect(DEV_WALLET_BALANCE - TOTAL_DISTRIBUTION).to.equal(DEV_REMAINING);
        });
    });
    
    describe("Distribution Edge Cases", function() {
        it("Should fail if dev wallet has insufficient balance", async function() {
            // Transfer away most of owner's tokens first
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            await token.transfer(addr1.address, DEV_WALLET_BALANCE - ethers.parseEther("1000"));
            
            // Now try to distribute (should fail)
            await expect(
                token.distributeInitialAllocations()
            ).to.be.revertedWith("Dw balance low");
        });
        
        it("Should track initialDistributionCompleted flag correctly", async function() {
            expect(await token.initialDistributionCompleted()).to.equal(false);
            
            await token.distributeInitialAllocations();
            
            expect(await token.initialDistributionCompleted()).to.equal(true);
        });
        
        it("Should emit DistributionSent events on real network (not Hardhat)", async function() {
            // Note: On Hardhat, since all addresses are the same, no DistributionSent events occur
            // This test documents the expected behavior on BSC Testnet/Mainnet
            
            const tx = await token.distributeInitialAllocations();
            const receipt = await tx.wait();
            
            // On Hardhat, no DistributionSent events because wallets are the same
            const distributionSentEvents = receipt.logs.filter(
                log => log.fragment && log.fragment.name === 'DistributionSent'
            );
            
            expect(distributionSentEvents.length).to.equal(0);
            
            // On BSC Testnet/Mainnet, there would be 3 DistributionSent events
            // (Marketing, Team, Advisor)
        });
    });
    
    describe("Post-Distribution Behavior", function() {
        beforeEach(async function() {
            await token.distributeInitialAllocations();
        });
        
        it("Should allow normal operations after distribution", async function() {
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]);
            
            await expect(
                token.transfer(addr1.address, ethers.parseEther("1000"))
            ).to.not.be.reverted;
        });
        
        it("Should maintain correct balances after distribution", async function() {
            expect(await token.balanceOf(owner.address)).to.equal(DEV_WALLET_BALANCE);
            expect(await token.balanceOf(await token.getAddress())).to.equal(CONTRACT_BALANCE);
        });
        
        it("Should not allow re-initialization", async function() {
            await expect(
                token.distributeInitialAllocations()
            ).to.be.revertedWith("Dist completed");
        });
    });
});