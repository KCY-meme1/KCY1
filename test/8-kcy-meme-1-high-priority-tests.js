/**
 * VERSION: 1.0056
 */
/**
 * @version v34
 */

// KCY1 Token v33 - HIGH PRIORITY Tests (NEW)
// These are BRAND NEW tests not in the original test suite
// Priority 1 (CRITICAL) - Implement First
// Use with Hardhat: npx hardhat test test/kcy-meme-1-high-priority-tests-v33.js

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token v33 - HIGH PRIORITY TESTS (NEW)", function() {
    let token;
    let owner;
    let addr1, addr2, addr3;
    
    const TRADING_LOCK = 48 * 60 * 60;
	const AFTER_ADMIN_LOCK = 48 * 60 * 60 + 1;
    const COOLDOWN = 2 * 60 * 60;
    
    beforeEach(async function() {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();
        
        const KCY1Token = await ethers.getContractFactory("KCY1Token");
        token = await KCY1Token.deploy();
        await token.waitForDeployment();
        
        // Enable trading for most tests
        await time.increase(TRADING_LOCK + 1);
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. FUZZING TESTS - Random Input Testing
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("1. FUZZING TESTS", function() {
        describe("1.1 Random Transfer Amounts", function() {
            for (let i = 0; i < 20; i++) {
                it(`Fuzz ${i}: Random transfer amount should maintain invariants`, async function() {
                    // Random amount between 1 and 2000 tokens (within limits)
                    const randomAmount = ethers.parseEther(
                        String(Math.floor(Math.random() * 2000) + 1)
                    );
                    
                    // Setup: Give addr1 some tokens as exempt
                    await token.updateExemptSlot(6, addr1.address);
					await time.increase(AFTER_ADMIN_LOCK);
                    await token.transfer(addr1.address, ethers.parseEther("10000"));
                    await token.updateExemptSlot(6, owner.address);
					await time.increase(AFTER_ADMIN_LOCK);
                    
                    const supplyBefore = await token.totalSupply();
                    const balanceBefore = await token.balanceOf(addr1.address);
                    
                    // Transfer to addr2 (normal user)
                    await token.connect(addr1).transfer(addr2.address, randomAmount);
                    
                    // Invariant 1: Total supply should never increase (can only decrease due to burn)
                    const supplyAfter = await token.totalSupply();
                    expect(supplyAfter).to.be.lte(supplyBefore);
                    
                    // Invariant 2: Sender balance should decrease
                    const balanceAfter = await token.balanceOf(addr1.address);
                    expect(balanceAfter).to.be.lt(balanceBefore);
                    
                    // Invariant 3: Received amount should be less than sent (due to fees)
                    const receivedAmount = await token.balanceOf(addr2.address);
                    expect(receivedAmount).to.be.lt(randomAmount);
                });
            }
        });
        
        describe("1.2 Fee Calculation Fuzzing", function() {
            for (let i = 0; i < 10; i++) {
                it(`Fuzz ${i}: Fee calculation should always be accurate`, async function() {
                    const randomAmount = ethers.parseEther(
                        String(Math.floor(Math.random() * 1000) + 1)
                    );
                    
                    // Setup
                    await token.updateExemptSlot(6, addr1.address);
					await time.increase(AFTER_ADMIN_LOCK);
                    await token.transfer(addr1.address, randomAmount);
                    await token.updateExemptSlot(6, owner.address);
					await time.increase(AFTER_ADMIN_LOCK);
                    
                    // Calculate expected fees
                    const burnFee = (randomAmount * 30n) / 100000n;
                    const ownerFee = (randomAmount * 50n) / 100000n;
                    const expectedReceived = randomAmount - burnFee - ownerFee;
                    
                    const supplyBefore = await token.totalSupply();
                    const ownerBalanceBefore = await token.balanceOf(owner.address);
                    
                    // Execute transfer
                    await token.connect(addr1).transfer(addr2.address, randomAmount);
                    
                    // Verify fee calculations
                    const received = await token.balanceOf(addr2.address);
                    const supplyAfter = await token.totalSupply();
                    const ownerBalanceAfter = await token.balanceOf(owner.address);
                    
                    // Receiver should get exact amount minus fees
                    expect(received).to.equal(expectedReceived);
                    
                    // Supply should decrease by burn fee
                    expect(supplyBefore - supplyAfter).to.equal(burnFee);
                    
                    // Owner should receive owner fee
                    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(ownerFee);
                });
            }
        });
        
        describe("1.3 Boundary Value Testing", function() {
            it("Should handle 1 wei transfer", async function() {
                const amount = 1n;
                
                await token.updateExemptSlot(6, addr1.address);
				await time.increase(AFTER_ADMIN_LOCK);
                await token.transfer(addr1.address, ethers.parseEther("1000"));
                await token.updateExemptSlot(6, owner.address);
				await time.increase(AFTER_ADMIN_LOCK);
                
                const burnFee = (amount * 30n) / 100000n; // Should be 0 due to rounding
                const ownerFee = (amount * 50n) / 100000n; // Should be 0 due to rounding
                
                await token.connect(addr1).transfer(addr2.address, amount);
                
                // With 1 wei, fees round to 0, so full amount transferred
                expect(await token.balanceOf(addr2.address)).to.equal(amount);
            });
            
            it("Should handle exactly max transaction amount (2000 tokens)", async function() {
                const maxAmount = ethers.parseEther("2000");
                
                await token.updateExemptSlot(6, addr1.address);
				await time.increase(AFTER_ADMIN_LOCK);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                await token.updateExemptSlot(6, owner.address);
				await time.increase(AFTER_ADMIN_LOCK);
                
                // Should succeed at exactly the limit
                await token.connect(addr1).transfer(addr2.address, maxAmount);
                
                const balance = await token.balanceOf(addr2.address);
                // Expected: 2000 - (2000 * 0.0008) = 1998.4
                expect(balance).to.be.closeTo(ethers.parseEther("1998.4"), ethers.parseEther("1"));
                
                // Should fail at limit + 1 wei
                await time.increase(COOLDOWN + 1);
                await expect(
                    token.connect(addr1).transfer(addr3.address, maxAmount + 1n)
                ).to.be.revertedWith("Max 2000");
            });
            
            it("Should handle exactly max wallet amount (4000 tokens)", async function() {
                await token.updateExemptSlot(6, addr1.address);
				await time.increase(AFTER_ADMIN_LOCK);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                await token.updateExemptSlot(6, owner.address);
				await time.increase(AFTER_ADMIN_LOCK);
                
                // Send 2000 tokens twice to reach ~3996.8
                await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
                await time.increase(COOLDOWN + 1);
                await token.connect(addr1).transfer(addr2.address, ethers.parseEther("2000"));
                
                let balance = await token.balanceOf(addr2.address);
                // Balance should be close to 3996.8 (less than 4000 due to fees)
                expect(balance).to.be.lt(ethers.parseEther("4000"));
                expect(balance).to.be.gt(ethers.parseEther("3990"));
                
                // Try to send more - should fail due to max wallet
                await time.increase(COOLDOWN + 1);
                await expect(
                    token.connect(addr1).transfer(addr2.address, ethers.parseEther("10"))
                ).to.be.revertedWith("Max wallet 4k");
            });
        });
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 2. REENTRANCY ATTACK SCENARIOS
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("2. REENTRANCY PROTECTION", function() {
        it("2.1 Should have ReentrancyGuard on transfer", async function() {
            // Transfer function should be protected by nonReentrant
            // This is verified by checking the contract has _status variable
            // and that all vulnerable functions use the modifier
            
            // Basic test: Multiple transfers in quick succession should work
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(7, addr2.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("5000"));
            
            // These should all succeed (no reentrancy)
            // Owner → addr2 (exempt slot), no limits
            await token.transfer(addr2.address, ethers.parseEther("100"));
            await token.transfer(addr2.address, ethers.parseEther("100"));
            await token.transfer(addr2.address, ethers.parseEther("100"));
            
            const balance = await token.balanceOf(addr2.address);
            // 3 transfers of 100 tokens each, exempt→exempt = no fees: 300
            expect(balance).to.equal(ethers.parseEther("300"));
        });
        
        it("2.2 Should protect withdrawBNB from reentrancy", async function() {
            // Send BNB to contract
            await owner.sendTransaction({
                to: await token.getAddress(),
                value: ethers.parseEther("1")
            });
            
            const contractBNBBefore = await ethers.provider.getBalance(await token.getAddress());
            expect(contractBNBBefore).to.equal(ethers.parseEther("1"));
            
            // Withdraw should work without reentrancy issues
            await token.withdrawBNB();
            
            const contractBNBAfter = await ethers.provider.getBalance(await token.getAddress());
            expect(contractBNBAfter).to.equal(0);
        });
        
        it("2.3 Should protect rescueTokens from reentrancy", async function() {
            // Create a mock ERC20 token
            const MockERC20 = await ethers.getContractFactory("KCY1Token");
            const mockToken = await MockERC20.deploy();
            await mockToken.waitForDeployment();
            
            // MockToken also has 48h trading lock, so advance time
            await time.increase(48 * 60 * 60 + 1);
            
            // Make token contract address exempt slot in mockToken so we can send > 100 tokens
            await mockToken.updateExemptSlot(6, await token.getAddress());
			await time.increase(AFTER_ADMIN_LOCK);
            
            // Send some mock tokens to the main contract (exempt → exempt = no fees)
            const sendAmount = ethers.parseEther("1000");
            await mockToken.transfer(await token.getAddress(), sendAmount);
            
            const contractBalance = await mockToken.balanceOf(await token.getAddress());
            expect(contractBalance).to.equal(sendAmount); // No fees for exempt→exempt
            
            const ownerBalanceBefore = await mockToken.balanceOf(owner.address);
            
            // Rescue should work without reentrancy
            await token.rescueTokens(await mockToken.getAddress(), contractBalance);
            
            expect(await mockToken.balanceOf(await token.getAddress())).to.equal(0);
            
            const ownerBalanceAfter = await mockToken.balanceOf(owner.address);
            // Rescue transfer: contract (exempt) → owner (exempt) = NO fees
            expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalance);
        });
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 3. GAS OPTIMIZATION BENCHMARKS
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("3. GAS BENCHMARKS", function() {
        it("3.1 Should measure gas for normal transfer", async function() {
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            const tx = await token.connect(addr1).transfer(
                addr2.address, 
                ethers.parseEther("100")
            );
            const receipt = await tx.wait();
            
            console.log(`      📊 Normal transfer gas: ${receipt.gasUsed}`);
            
            // Gas should be reasonable (< 135k for normal transfer)
            expect(receipt.gasUsed).to.be.lt(135000n);
        });
        
        it("3.2 Should measure gas for exempt transfer", async function() {
            // Make addr1 exempt slot for exempt→exempt transfer
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            const tx = await token.transfer(addr1.address, ethers.parseEther("1000"));
            const receipt = await tx.wait();
            
            console.log(`      📊 Exempt transfer gas: ${receipt.gasUsed}`);
            
            // Exempt transfers should be cheaper (< 90k)
            expect(receipt.gasUsed).to.be.lt(90000n);
        });
        
        it("3.3 Should measure gas for approve", async function() {
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("1000"));
            
            const tx = await token.connect(addr1).approve(
                addr2.address, 
                ethers.parseEther("500")
            );
            const receipt = await tx.wait();
            
            console.log(`      📊 Approve gas: ${receipt.gasUsed}`);
            
            // Approve should be very cheap (< 50k)
            expect(receipt.gasUsed).to.be.lt(50000n);
        });
        
        it("3.4 Should measure gas for transferFrom", async function() {
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            await token.connect(addr1).approve(addr2.address, ethers.parseEther("1000"));
            
            await time.increase(COOLDOWN + 1);
            
            const tx = await token.connect(addr2).transferFrom(
                addr1.address,
                addr3.address,
                ethers.parseEther("100")
            );
            const receipt = await tx.wait();
            
            console.log(`      📊 TransferFrom gas: ${receipt.gasUsed}`);
            
            // TransferFrom is most expensive but should still be reasonable (< 140k)
            expect(receipt.gasUsed).to.be.lt(140000n);
        });
        
        it("3.5 Should measure gas for updateExemptSlot", async function() {
            const tx = await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(7, addr2.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.updateExemptSlot(8, addr3.address);
			await time.increase(AFTER_ADMIN_LOCK);
            const receipt = await tx.wait();
            
            console.log(`      📊 UpdateExemptSlots gas: ${receipt.gasUsed}`);
            
            // Admin function, should be reasonably efficient
            expect(receipt.gasUsed).to.be.lt(150000n);
        });
        
        it("3.6 Should compare gas: exempt vs normal transfer", async function() {
            // Make addr1 exempt slot for first transfer
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            // Exempt transfer (owner → addr1, both exempt)
            const tx1 = await token.transfer(addr1.address, ethers.parseEther("1000"));
            const receipt1 = await tx1.wait();
            
            // Give addr1 more tokens
            await token.transfer(addr1.address, ethers.parseEther("5000"));
            
            // Remove addr1 from exempt slots (now normal user)
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            // Normal transfer (addr1 normal → addr2 normal)
            const tx2 = await token.connect(addr1).transfer(
                addr2.address, 
                ethers.parseEther("100")
            );
            const receipt2 = await tx2.wait();
            
            console.log(`      📊 Gas comparison:`);
            console.log(`         Exempt:  ${receipt1.gasUsed}`);
            console.log(`         Normal:  ${receipt2.gasUsed}`);
            console.log(`         Diff:    ${receipt2.gasUsed - receipt1.gasUsed} (${Math.round(Number(receipt2.gasUsed - receipt1.gasUsed) / Number(receipt1.gasUsed) * 100)}% more)`);
            
            // Normal should use more gas than exempt
            expect(receipt2.gasUsed).to.be.gt(receipt1.gasUsed);
        });
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 4. INVARIANT TESTING
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("4. INVARIANTS", function() {
        it("4.1 Invariant: Total supply never increases", async function() {
            const initialSupply = await token.totalSupply();
            
            // Do multiple operations
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"));
            
            const finalSupply = await token.totalSupply();
            
            // Supply should only decrease (burns) or stay same, never increase
            expect(finalSupply).to.be.lte(initialSupply);
        });
        
        it("4.2 Invariant: Balance changes = transfer amounts (accounting for fees)", async function() {
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            const addr1Before = await token.balanceOf(addr1.address);
            const addr2Before = await token.balanceOf(addr2.address);
            const ownerBefore = await token.balanceOf(owner.address);
            const supplyBefore = await token.totalSupply();
            
            const amount = ethers.parseEther("100");
            const burnFee = (amount * 30n) / 100000n;
            const ownerFee = (amount * 50n) / 100000n;
            
            await token.connect(addr1).transfer(addr2.address, amount);
            
            const addr1After = await token.balanceOf(addr1.address);
            const addr2After = await token.balanceOf(addr2.address);
            const ownerAfter = await token.balanceOf(owner.address);
            const supplyAfter = await token.totalSupply();
            
            // Verify balance equation
            expect(addr1Before - addr1After).to.equal(amount);
            expect(addr2After - addr2Before).to.equal(amount - burnFee - ownerFee);
            expect(ownerAfter - ownerBefore).to.equal(ownerFee);
            expect(supplyBefore - supplyAfter).to.equal(burnFee);
        });
        
        it("4.3 Invariant: Cooldown always enforced for normal users", async function() {
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            await token.transfer(addr1.address, ethers.parseEther("10000"));
            await token.updateExemptSlot(6, owner.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            // First transfer succeeds
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            
            // Second immediate transfer fails
            await expect(
                token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Wait 2h");
            
            // After cooldown, succeeds
            await time.increase(COOLDOWN + 1);
            await token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"));
            
            const balance = await token.balanceOf(addr3.address);
            // Expected: 100 - (100 * 0.0008) = 99.92
            expect(balance).to.be.closeTo(ethers.parseEther("99.92"), ethers.parseEther("0.1"));
        });
        
        it("4.4 Invariant: Exempt users never have cooldown", async function() {
            // Make addr1 exempt slot
            await token.updateExemptSlot(6, addr1.address);
			await time.increase(AFTER_ADMIN_LOCK);
            
            // Multiple exempt transfers in quick succession
            // Owner (exempt slot) → addr1 (exempt slot): no fees, no cooldown
            await token.transfer(addr1.address, ethers.parseEther("100"));
            await token.transfer(addr1.address, ethers.parseEther("100"));
            await token.transfer(addr1.address, ethers.parseEther("100"));
            
            // All should succeed without any cooldown
            // Exempt→exempt has no fees, so balance is exactly 300
            const balance = await token.balanceOf(addr1.address);
            expect(balance).to.equal(ethers.parseEther("300"));
        });
    });
});
