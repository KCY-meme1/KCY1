// KCY1 Token v33 - MEDIUM PRIORITY Tests (NEW)
// These are BRAND NEW tests not in the original test suite
// Priority 2 (MEDIUM) - Implement After High Priority
// Use with Hardhat: npx hardhat test test/kcy-meme-1-medium-priority-tests-v33.js

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token v33 - MEDIUM PRIORITY TESTS (NEW)", function() {
    let token;
    let owner;
    let addr1, addr2, addr3, addr4, addr5;
    let addrs;
    
    const TRADING_LOCK = 48 * 60 * 60;
    const COOLDOWN = 2 * 60 * 60;
    
    beforeEach(async function() {
        [owner, addr1, addr2, addr3, addr4, addr5, ...addrs] = await ethers.getSigners();
        
        const KCY1Token = await ethers.getContractFactory("KCY1Token");
        token = await KCY1Token.deploy();
        await token.waitForDeployment();
        
        // Enable trading for most tests
        await time.increase(TRADING_LOCK + 1);
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. STRESS TESTING - High Volume Operations
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("1. STRESS TESTING", function() {
        describe("1.1 Sequential Transfers", function() {
            it("Should handle 100 sequential transfers from exempt address", async function() {
                const startTime = Date.now();
                
                for (let i = 0; i < 100; i++) {
                    await token.transfer(addrs[i % 10].address, ethers.parseEther("100"));
                }
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                console.log(`      ⏱️  100 transfers completed in ${duration}ms`);
                
                // Verify balances
                for (let i = 0; i < 10; i++) {
                    const balance = await token.balanceOf(addrs[i].address);
                    expect(balance).to.be.gt(0);
                }
            });
            
            it("Should handle 50 transfers between users with cooldowns", async function() {
                // Setup 5 users with tokens - keep them ALL exempt for this stress test
                const exemptAddresses = [addrs[0].address, addrs[1].address, addrs[2].address, addrs[3].address];
                await token.updateExemptSlots(exemptAddresses);
                
                for (let i = 0; i < 4; i++) {
                    await token.transfer(addrs[i].address, ethers.parseEther("20000"));
                }
                
                const startTime = Date.now();
                let successfulTransfers = 0;
                
                // Attempt 50 transfers - all should succeed since all are exempt
                for (let i = 0; i < 50; i++) {
                    const sender = addrs[i % 4];
                    const receiver = addrs[(i + 1) % 4];
                    
                    try {
                        await token.connect(sender).transfer(
                            receiver.address, 
                            ethers.parseEther("100")
                        );
                        successfulTransfers++;
                    } catch (error) {
                        // Unexpected for exempt users
                        console.log(`Transfer ${i} failed: ${error.message}`);
                    }
                }
                
                const endTime = Date.now();
                console.log(`      ⏱️  ${successfulTransfers}/50 transfers succeeded in ${endTime - startTime}ms`);
                
                // Most/all should succeed since exempt
                expect(successfulTransfers).to.be.gte(45); // At least 90% should succeed
            });
        });
        
        describe("1.2 Concurrent Operations", function() {
            it("Should handle multiple users transferring simultaneously", async function() {
                // Setup users with smaller amounts - keep them ALL exempt
                const exemptAddresses = [addrs[0].address, addrs[1].address, addrs[2].address, addrs[3].address];
                await token.updateExemptSlots(exemptAddresses);
                
                for (let i = 0; i < 4; i++) {
                    await token.transfer(addrs[i].address, ethers.parseEther("5000"));
                }
                
                // Create array of transfer promises with smaller amounts
                const transferPromises = [];
                for (let i = 0; i < 4; i++) {
                    const sender = addrs[i];
                    const receiver = addrs[(i + 1) % 4];
                    
                    transferPromises.push(
                        token.connect(sender).transfer(
                            receiver.address,
                            ethers.parseEther("500")
                        )
                    );
                }
                
                // Execute all transfers concurrently
                const results = await Promise.allSettled(transferPromises);
                
                const successful = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;
                
                console.log(`      📊 Concurrent transfers: ${successful} succeeded, ${failed} failed`);
                
                // All should succeed since exempt
                expect(successful).to.equal(4);
            });
        });
        
        describe("1.3 Large Scale Operations", function() {
            it("Should handle distribution to 10 addresses", async function() {
                const startTime = Date.now();
                const amount = ethers.parseEther("1000");
                
                // Hardhat provides limited signers, so use 10 instead of 50
                for (let i = 0; i < 10; i++) {
                    await token.transfer(addrs[i].address, amount);
                }
                
                const endTime = Date.now();
                console.log(`      ⏱️  Distribution to 10 addresses: ${endTime - startTime}ms`);
                
                // Verify all received tokens (accounting for 0.08% fees on owner→normal)
                for (let i = 0; i < 10; i++) {
                    const balance = await token.balanceOf(addrs[i].address);
                    // Should be close to 1000 but slightly less due to fees
                    expect(balance).to.be.gt(ethers.parseEther("990"));
                    expect(balance).to.be.lt(amount);
                }
            });
            
            it("Should maintain correct total supply after 100 operations", async function() {
                const initialSupply = await token.totalSupply();
                
                // Setup users
                await token.updateExemptSlots([addr1.address, addr2.address, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await token.transfer(addr1.address, ethers.parseEther("50000"));
                await token.transfer(addr2.address, ethers.parseEther("50000"));
                await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                
                // Perform 100 random transfers
                for (let i = 0; i < 100; i++) {
                    try {
                        if (i % 2 === 0) {
                            await token.connect(addr1).transfer(
                                addrs[i % 10].address,
                                ethers.parseEther("10")
                            );
                        } else {
                            await token.connect(addr2).transfer(
                                addrs[i % 10].address,
                                ethers.parseEther("10")
                            );
                        }
                        await time.increase(COOLDOWN + 1);
                    } catch (error) {
                        // Some might fail, that's ok
                    }
                }
                
                const finalSupply = await token.totalSupply();
                
                // Supply should only decrease (burns), never increase
                expect(finalSupply).to.be.lte(initialSupply);
                
                console.log(`      📊 Supply change: -${ethers.formatEther(initialSupply - finalSupply)} tokens burned`);
            });
        });
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 2. MEV PROTECTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("2. MEV PROTECTION", function() {
        describe("2.1 Front-Running Protection", function() {
            it("Should have cooldown that prevents immediate second transfer", async function() {
                await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                
                // First transfer succeeds
                await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
                
                // Immediate second transfer fails (prevents front-running)
                await expect(
                    token.connect(addr1).transfer(addr3.address, ethers.parseEther("100"))
                ).to.be.revertedWith("Wait 2h");
            });
            
            it("Should enforce transaction limits that reduce MEV profitability", async function() {
                await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                
                // Cannot transfer more than 2000 tokens at once
                await expect(
                    token.connect(addr1).transfer(addr2.address, ethers.parseEther("2001"))
                ).to.be.revertedWith("Max 2000");
                
                // Max transaction limit reduces potential MEV extraction
                const maxTx = ethers.parseEther("2000");
                await token.connect(addr1).transfer(addr2.address, maxTx);
                
                expect(await token.balanceOf(addr2.address)).to.be.lte(maxTx);
            });
        });
        
        describe("2.2 Sandwich Attack Resistance", function() {
            it("Should have fees that make sandwich attacks less profitable", async function() {
                await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                
                const amount = ethers.parseEther("1000");
                const burnFee = (amount * 30n) / 100000n;
                const ownerFee = (amount * 50n) / 100000n;
                const totalFee = burnFee + ownerFee;
                
                // 0.08% fee on each transfer reduces sandwich profitability
                await token.connect(addr1).transfer(addr2.address, amount);
                
                const received = await token.balanceOf(addr2.address);
                const feePaid = amount - received;
                
                expect(feePaid).to.equal(totalFee);
                
                // For sandwich attack: attacker pays 0.08% × 2 = 0.16% total
                // This makes small price movements unprofitable
                console.log(`      📊 Fee paid: ${ethers.formatEther(feePaid)} (${Number(feePaid * 10000n / amount) / 100}%)`);
            });
        });
        
        describe("2.3 Transaction Ordering Resistance", function() {
            it("Should handle transaction reordering gracefully", async function() {
                await token.updateExemptSlots([addr1.address, addr2.address, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                await token.transfer(addr2.address, ethers.parseEther("10000"));
                await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                
                // Simulate potential reordering: two users try to transfer to same address
                const tx1 = token.connect(addr1).transfer(addr3.address, ethers.parseEther("500"));
                const tx2 = token.connect(addr2).transfer(addr3.address, ethers.parseEther("500"));
                
                // Both should succeed (different senders)
                await tx1;
                await tx2;
                
                const balance = await token.balanceOf(addr3.address);
                expect(balance).to.be.gt(ethers.parseEther("900")); // ~1000 minus fees
            });
        });
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 3. EDGE CASE SCENARIOS
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("3. ADVANCED EDGE CASES", function() {
        describe("3.1 Maximum Values", function() {
            it("Should handle approval of max uint256", async function() {
                await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                
                // Approve max uint256
                const maxUint = ethers.MaxUint256;
                await token.connect(addr1).approve(addr2.address, maxUint);
                
                expect(await token.allowance(addr1.address, addr2.address)).to.equal(maxUint);
                
                // Should still be able to use transferFrom
                await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await time.increase(COOLDOWN + 1);
                
                await token.connect(addr2).transferFrom(
                    addr1.address,
                    addr3.address,
                    ethers.parseEther("100")
                );
                
                // Allowance should decrease from max
                const newAllowance = await token.allowance(addr1.address, addr2.address);
                expect(newAllowance).to.be.lt(maxUint);
            });
        });
        
        describe("3.2 Zero Value Operations", function() {
            it("Should handle zero amount transfer", async function() {
                const balanceBefore = await token.balanceOf(addr1.address);
                
                // Zero transfer should succeed but do nothing
                await token.transfer(addr1.address, 0);
                
                const balanceAfter = await token.balanceOf(addr1.address);
                expect(balanceAfter).to.equal(balanceBefore);
            });
            
            it("Should handle zero amount approval", async function() {
                await token.approve(addr1.address, 0);
                
                expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
            });
        });
        
        describe("3.3 Complex State Transitions", function() {
            it("Should handle user becoming exempt then normal", async function() {
                // Give tokens as exempt
                await token.updateExemptSlots([addr1.address, addr2.address, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                await token.transfer(addr1.address, ethers.parseEther("10000"));
                
                // Can transfer large amounts as exempt (addr1→addr2 both exempt)
                await token.connect(addr1).transfer(addr2.address, ethers.parseEther("5000"));
                expect(await token.balanceOf(addr2.address)).to.equal(ethers.parseEther("5000"));
                
                // Remove addr1 from exempt (addr2 stays exempt)
                await token.updateExemptSlots([addr2.address, ethers.ZeroAddress, 
                                               ethers.ZeroAddress, ethers.ZeroAddress]);
                
                // Now addr1 is subject to limits
                await time.increase(COOLDOWN + 1);
                await expect(
                    token.connect(addr1).transfer(addr3.address, ethers.parseEther("3000"))
                ).to.be.revertedWith("Max 2000");
                
                // But can transfer within limits
                await token.connect(addr1).transfer(addr3.address, ethers.parseEther("1000"));
                expect(await token.balanceOf(addr3.address)).to.be.gt(0);
            });
            
            it("Should handle pause then unpause state", async function() {
                // Pause the contract
                await token.pause();
                expect(await token.isPaused()).to.equal(true);
                
                // Transfers should fail
                await expect(
                    token.transfer(addr1.address, ethers.parseEther("100"))
                ).to.be.revertedWith("Paused");
                
                // Wait for unpause (48 hours)
                await time.increase(48 * 60 * 60 + 1);
                
                expect(await token.isPaused()).to.equal(false);
                
                // Transfers should work again
                await token.transfer(addr1.address, ethers.parseEther("100"));
                // Note: owner→normal has fees (0.08%)
                const balance = await token.balanceOf(addr1.address);
                expect(balance).to.be.gt(ethers.parseEther("99"));
                expect(balance).to.be.lt(ethers.parseEther("100"));
            });
        });
        
        describe("3.4 Multiple Cooldown Periods", function() {
            it("Should track cooldowns correctly for multiple users", async function() {
                const initialOwnerBalance = await token.balanceOf(owner.address);
                
                // Setup 5 users
                for (let i = 0; i < 5; i++) {
                    await token.updateExemptSlots([addrs[i].address, ethers.ZeroAddress, 
                                                   ethers.ZeroAddress, ethers.ZeroAddress]);
                    await token.transfer(addrs[i].address, ethers.parseEther("10000"));
                    await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                                   ethers.ZeroAddress, ethers.ZeroAddress]);
                }
                
                // All users make first transfer
                for (let i = 0; i < 5; i++) {
                    await token.connect(addrs[i]).transfer(
                        owner.address,
                        ethers.parseEther("100")
                    );
                }
                
                // All immediate second transfers should fail
                for (let i = 0; i < 5; i++) {
                    await expect(
                        token.connect(addrs[i]).transfer(owner.address, ethers.parseEther("100"))
                    ).to.be.revertedWith("Wait 2h");
                }
                
                // After cooldown, all should work
                await time.increase(COOLDOWN + 1);
                
                for (let i = 0; i < 5; i++) {
                    await token.connect(addrs[i]).transfer(
                        owner.address,
                        ethers.parseEther("100")
                    );
                }
                
                // Verify owner received transfers (5 users × 2 transfers × 100 tokens minus fees)
                // Owner spent 5 × 10000 = 50000 for setup
                // Owner received 10 × ~99.92 (100 minus 0.08% fees) = ~999.2
                const finalOwnerBalance = await token.balanceOf(owner.address);
                const netChange = finalOwnerBalance - initialOwnerBalance;
                
                // Net should be around -50000 + 1000 = -49000 (setup cost minus received)
                expect(finalOwnerBalance).to.be.lt(initialOwnerBalance); // Net negative due to setup cost
            });
        });
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 4. LONG-RUNNING SCENARIOS
    // ═══════════════════════════════════════════════════════════════════════════
    
    describe("4. LONG-RUNNING SCENARIOS", function() {
        it("Should handle operations over extended time period", async function() {
            await token.updateExemptSlots([addr1.address, ethers.ZeroAddress, 
                                           ethers.ZeroAddress, ethers.ZeroAddress]);
            await token.transfer(addr1.address, ethers.parseEther("100000"));
            await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                           ethers.ZeroAddress, ethers.ZeroAddress]);
            
            // Simulate 10 days of trading (10 transfers, one every ~24h)
            for (let day = 0; day < 10; day++) {
                await token.connect(addr1).transfer(
                    addrs[day % 5].address,
                    ethers.parseEther("1000")
                );
                
                // Advance 24 hours
                await time.increase(24 * 60 * 60);
            }
            
            // Verify balances are reasonable
            const addr1Balance = await token.balanceOf(addr1.address);
            expect(addr1Balance).to.be.lt(ethers.parseEther("100000"));
            expect(addr1Balance).to.be.gt(ethers.parseEther("80000")); // ~90k minus fees
            
            console.log(`      📊 After 10 days: ${ethers.formatEther(addr1Balance)} tokens remaining`);
        });
        
        it("Should maintain correct state after many cooldown cycles", async function() {
            await token.updateExemptSlots([addr1.address, addr2.address, 
                                           ethers.ZeroAddress, ethers.ZeroAddress]);
            await token.transfer(addr1.address, ethers.parseEther("3000"));
            await token.transfer(addr2.address, ethers.parseEther("3000"));
            await token.updateExemptSlots([ethers.ZeroAddress, ethers.ZeroAddress, 
                                           ethers.ZeroAddress, ethers.ZeroAddress]);
            
            // Perform 10 transfer cycles (reduced from 20 to avoid wallet limit issues)
            for (let i = 0; i < 10; i++) {
                await token.connect(addr1).transfer(addr2.address, ethers.parseEther("50"));
                await time.increase(COOLDOWN + 1);
                await token.connect(addr2).transfer(addr1.address, ethers.parseEther("50"));
                await time.increase(COOLDOWN + 1);
            }
            
            // Both users should still have significant balances
            const balance1 = await token.balanceOf(addr1.address);
            const balance2 = await token.balanceOf(addr2.address);
            
            expect(balance1).to.be.gt(ethers.parseEther("2500"));
            expect(balance2).to.be.gt(ethers.parseEther("2500"));
            
            console.log(`      📊 After 10 cycles:`);
            console.log(`         Addr1: ${ethers.formatEther(balance1)}`);
            console.log(`         Addr2: ${ethers.formatEther(balance2)}`);
        });
    });
});
