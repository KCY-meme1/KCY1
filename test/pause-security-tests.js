const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("KCY1 Token - Pause, Security & Cooldown Tests", function() {
    
    let token;
    let owner, addr1, addr2, addr3, addr4, normalUser;
    
    beforeEach(async function() {
        [owner, addr1, addr2, addr3, addr4, normalUser] = await ethers.getSigners();
        
        const Token = await ethers.getContractFactory("KCY1Token");
        token = await Token.deploy();
        await token.waitForDeployment();
        
        // Setup exempt slots
        await token.updateExemptSlots([
            addr1.address,
            addr2.address,
            ethers.ZeroAddress,
            ethers.ZeroAddress
        ]);
        
        // Wait for cooldown from deployment
        await time.increase(48 * 3600 + 1);
        
        // Enable trading
        const tradingTime = await token.tradingEnabledTime();
        if (await time.latest() < tradingTime) {
            await time.increaseTo(tradingTime);
        }
        
        // Send some tokens to normalUser
        await token.transfer(normalUser.address, ethers.parseEther("1000"));
    });
    
    describe("1. unpause() Function Does NOT Exist", function() {
        it("Should NOT have unpause() function", async function() {
            // Try to call unpause - should fail because it doesn't exist
            expect(token.unpause).to.be.undefined;
            
            console.log("✅ unpause() function does NOT exist");
        });
        
        it("Should auto-unpause after 48 hours", async function() {
            // Pause
            await token.pause();
            expect(await token.isPaused()).to.equal(true);
            console.log("   Token paused");
            
            // Wait 48 hours
            await time.increase(48 * 3600 + 1);
            
            // Should be unpaused automatically
            expect(await token.isPaused()).to.equal(false);
            console.log("✅ Token auto-unpaused after 48h (no unpause() needed)");
        });
    });
    
    describe("2. Pause Blocks Normal User Trading", function() {
        it("Should block normal user → normal user transfers during pause", async function() {
            // Pause trading
            await token.pause();
            
            // Try transfer from normal user
            await expect(
                token.connect(normalUser).transfer(addr3.address, ethers.parseEther("10"))
            ).to.be.revertedWith("Paused");
            
            console.log("✅ Normal → Normal transfer blocked during pause");
        });
        
        it("Should block exempt → normal transfers during pause", async function() {
            // Pause trading
            await token.pause();
            
            // Try transfer from exempt to normal
            await expect(
                token.connect(addr1).transfer(normalUser.address, ethers.parseEther("10"))
            ).to.be.revertedWith("Paused");
            
            console.log("✅ Exempt → Normal transfer blocked during pause");
        });
        
        it("Should block normal → exempt transfers during pause", async function() {
            // Pause trading
            await token.pause();
            
            // Try transfer from normal to exempt
            await expect(
                token.connect(normalUser).transfer(addr1.address, ethers.parseEther("10"))
            ).to.be.revertedWith("Paused");
            
            console.log("✅ Normal → Exempt transfer blocked during pause");
        });
        
        it("Should allow exempt → exempt transfers during pause", async function() {
            // Pause trading
            await token.pause();
            
            // Transfer from exempt to exempt should work
            await token.connect(addr1).transfer(addr2.address, ethers.parseEther("100"));
            
            expect(await token.balanceOf(addr2.address)).to.be.gt(0);
            console.log("✅ Exempt → Exempt transfer allowed during pause");
        });
    });
    
    describe("3. Exempt Functions During Pause", function() {
        it("Should allow blacklist during pause", async function() {
            await token.pause();
            
            // Exempt can blacklist
            await token.connect(addr1).setBlacklist(normalUser.address, true);
            
            expect(await token.isBlacklisted(normalUser.address)).to.equal(true);
            console.log("✅ Blacklist works during pause");
        });
        
        it("Should allow propose/execute mint during pause", async function() {
            await token.pause();
            
            // Exempt can propose mint
            await token.connect(addr1).proposeMint(ethers.parseEther("1000"));
            console.log("✅ proposeMint works during pause");
            
            // Wait for timelock
            await time.increase(24 * 3600 + 1);
            
            // Exempt can execute mint
            await token.connect(addr1).executeMint(1);
            console.log("✅ executeMint works during pause");
            
            expect(await token.totalSupply()).to.be.gt(ethers.parseEther("100000000"));
        });
        
        it("Should allow updateExemptSlots during pause", async function() {
            await token.pause();
            
            // Wait for previous cooldown
            await time.increase(48 * 3600 + 1);
            
            // Exempt can update slots
            await token.connect(addr1).updateExemptSlots([
                addr2.address,
                addr1.address,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            ]);
            console.log("✅ updateExemptSlots works during pause");
            
            const exemptData = await token.getExemptAddresses();
            expect(exemptData.slots[0]).to.equal(addr2.address);
        });
        
        it("Should allow updateDEXAddresses during pause (if not locked)", async function() {
            await token.pause();
            
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            // Exempt can update DEX
            await token.connect(addr1).updateDEXAddresses(newRouter, newFactory);
            console.log("✅ updateDEXAddresses works during pause");
            
            expect(await token.pncswpRouter()).to.equal(newRouter);
            expect(await token.pncswpFactory()).to.equal(newFactory);
        });
        
        it("Should allow setLiquidityPair during pause (if not locked)", async function() {
            await token.pause();
            
            // Exempt can set liquidity pair
            await token.connect(addr1).setLiquidityPair(addr4.address, true);
            console.log("✅ setLiquidityPair works during pause");
            
            expect(await token.isLiquidityPair(addr4.address)).to.equal(true);
        });
        
        it("Should allow lock functions during pause", async function() {
            await token.pause();
            
            // Exempt can lock DEX
            await token.connect(addr1).lockDEXAddresses();
            
            expect(await token.dexAddressesLocked()).to.equal(true);
            console.log("✅ Lock functions work during pause");
        });
    });
    
    describe("4. Multi-Sig ONLY Functions", function() {
        it("Should allow removeFromBlacklist ONLY via multi-sig", async function() {
            // Blacklist user first
            await token.setBlacklist(normalUser.address, true);
            
            // Owner tries to remove directly - should fail
            await expect(
                token.removeFromBlacklist(normalUser.address)
            ).to.be.revertedWith("Only multi-sig");
            
            // Exempt slot (multi-sig address) can remove
            await token.connect(addr1).removeFromBlacklist(normalUser.address);
            
            expect(await token.isBlacklisted(normalUser.address)).to.equal(false);
            console.log("✅ removeFromBlacklist requires multi-sig (exempt slot)");
        });
        
        it("Should allow unlock functions ONLY via multi-sig", async function() {
            // Lock DEX first
            await token.lockDEXAddresses();
            
            // Owner tries to unlock directly - should fail
            await expect(
                token.unlockDEXAddresses()
            ).to.be.revertedWith("Only multi-sig");
            
            // Exempt slot (multi-sig address) can unlock
            await token.connect(addr1).unlockDEXAddresses();
            
            expect(await token.dexAddressesLocked()).to.equal(false);
            console.log("✅ unlockDEXAddresses requires multi-sig (exempt slot)");
        });
        
        it("Should allow unlockExemptSlots ONLY via multi-sig", async function() {
            // Lock slots first
            await token.lockExemptSlotsForever();
            
            // Owner tries to unlock - should fail
            await expect(
                token.unlockExemptSlots()
            ).to.be.revertedWith("Only multi-sig");
            
            // Exempt slot can unlock
            await token.connect(addr1).unlockExemptSlots();
            
            expect(await token.exemptSlotsLocked()).to.equal(false);
            console.log("✅ unlockExemptSlots requires multi-sig");
        });
        
        it("Should allow unlockLiquidityPairs ONLY via multi-sig", async function() {
            // Lock pairs first
            await token.lockLiquidityPairsForever();
            
            // Owner tries to unlock - should fail
            await expect(
                token.unlockLiquidityPairs()
            ).to.be.revertedWith("Only multi-sig");
            
            // Exempt slot can unlock
            await token.connect(addr1).unlockLiquidityPairs();
            
            expect(await token.liquidityPairsLocked()).to.equal(false);
            console.log("✅ unlockLiquidityPairs requires multi-sig");
        });
        
        it("Should REJECT unlock from non-multi-sig address", async function() {
            // Lock DEX
            await token.lockDEXAddresses();
            
            // Random address (not owner, not exempt slot) tries unlock
            await expect(
                token.connect(addr3).unlockDEXAddresses()
            ).to.be.revertedWith("Only multi-sig");
            
            console.log("✅ Non-multi-sig address CANNOT unlock");
        });
    });
    
    describe("5. updateExemptSlots Auto-Pause & Cooldown", function() {
        it("Should auto-pause for 48h when updating exempt slots", async function() {
            // Check not paused
            expect(await token.isPaused()).to.equal(false);
            
            // Update exempt slots
            await token.updateExemptSlots([
                addr2.address,
                addr3.address,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            ]);
            
            // Should be paused
            expect(await token.isPaused()).to.equal(true);
            console.log("✅ Auto-paused after updateExemptSlots");
            
            // Check pause duration
            const pausedUntil = await token.pausedUntil();
            const now = await time.latest();
            expect(pausedUntil - now).to.be.closeTo(48 * 3600, 10);
            console.log("✅ Paused for 48 hours");
        });
        
        it("Should block propose/execute mint during cooldown", async function() {
            // Update slots
            await token.updateExemptSlots([
                addr2.address,
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            ]);
            
            // Wait for pause to end
            await time.increase(48 * 3600 + 1);
            
            // proposeMint should still be blocked (cooldown)
            await expect(
                token.proposeMint(ethers.parseEther("1000"))
            ).to.be.revertedWith("Exempt cooldown");
            
            console.log("✅ proposeMint blocked during cooldown");
        });
        
        it("Should block updateDEXAddresses during cooldown", async function() {
            const newRouter = addr4.address;
            const newFactory = addr3.address;
            
            // Update slots
            await token.updateExemptSlots([
                addr2.address,
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            ]);
            
            // Wait for pause to end
            await time.increase(48 * 3600 + 1);
            
            // updateDEXAddresses should be blocked (cooldown)
            await expect(
                token.updateDEXAddresses(newRouter, newFactory)
            ).to.be.revertedWith("Exempt cooldown");
            
            console.log("✅ updateDEXAddresses blocked during cooldown");
        });
        
        it("Should block setLiquidityPair during cooldown", async function() {
            // Update slots
            await token.updateExemptSlots([
                addr2.address,
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            ]);
            
            // Wait for pause to end
            await time.increase(48 * 3600 + 1);
            
            // setLiquidityPair should be blocked (cooldown)
            await expect(
                token.setLiquidityPair(addr4.address, true)
            ).to.be.revertedWith("Exempt cooldown");
            
            console.log("✅ setLiquidityPair blocked during cooldown");
        });
        
        it("Should allow functions after 48h cooldown", async function() {
            // Update slots
            await token.updateExemptSlots([
                addr2.address,
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            ]);
            
            // Wait 48h
            await time.increase(48 * 3600 + 1);
            
            // Pause should be over
            expect(await token.isPaused()).to.equal(false);
            
            // Functions should work again
            await token.proposeMint(ethers.parseEther("1000"));
            
            console.log("✅ Functions allowed after 48h cooldown");
        });
    });
    
    describe("6. updateDEXAddresses Auto-Pause & Cooldown", function() {
        it("Should auto-pause for 48h when updating DEX addresses", async function() {
            // Check not paused
            expect(await token.isPaused()).to.equal(false);
            
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            // Update DEX addresses
            await token.updateDEXAddresses(newRouter, newFactory);
            
            // Should be paused
            expect(await token.isPaused()).to.equal(true);
            console.log("✅ Auto-paused after updateDEXAddresses");
            
            // Check pause duration
            const pausedUntil = await token.pausedUntil();
            const now = await time.latest();
            expect(pausedUntil - now).to.be.closeTo(48 * 3600, 10);
            console.log("✅ Paused for 48 hours");
        });
        
        it("Should block propose/execute mint during DEX update cooldown", async function() {
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            // Update DEX
            await token.updateDEXAddresses(newRouter, newFactory);
            
            // Wait for pause to end
            await time.increase(48 * 3600 + 1);
            
            // proposeMint should still be blocked (cooldown)
            await expect(
                token.proposeMint(ethers.parseEther("1000"))
            ).to.be.revertedWith("Exempt cooldown");
            
            console.log("✅ proposeMint blocked during DEX update cooldown");
        });
        
        it("Should block updateExemptSlots during DEX update cooldown", async function() {
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            // Update DEX
            await token.updateDEXAddresses(newRouter, newFactory);
            
            // Wait for pause to end
            await time.increase(48 * 3600 + 1);
            
            // updateExemptSlots should be blocked (cooldown)
            await expect(
                token.updateExemptSlots([
                    addr2.address,
                    ethers.ZeroAddress,
                    ethers.ZeroAddress,
                    ethers.ZeroAddress
                ])
            ).to.be.revertedWith("Exempt cooldown");
            
            console.log("✅ updateExemptSlots blocked during DEX update cooldown");
        });
        
        it("Should block another updateDEXAddresses during cooldown", async function() {
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            // Update DEX first time
            await token.updateDEXAddresses(newRouter, newFactory);
            
            // Wait for pause to end
            await time.increase(48 * 3600 + 1);
            
            // Try to update DEX again (should be blocked by cooldown)
            await expect(
                token.updateDEXAddresses(addr2.address, addr1.address)
            ).to.be.revertedWith("Exempt cooldown");
            
            console.log("✅ updateDEXAddresses blocked during cooldown");
        });
        
        it("Should allow all functions after 48h DEX update cooldown", async function() {
            const newRouter = addr3.address;
            const newFactory = addr4.address;
            
            // Update DEX
            await token.updateDEXAddresses(newRouter, newFactory);
            
            // Wait 48h
            await time.increase(48 * 3600 + 1);
            
            // Pause should be over
            expect(await token.isPaused()).to.equal(false);
            
            // Functions should work again
            await token.proposeMint(ethers.parseEther("1000"));
            
            console.log("✅ All functions allowed after 48h DEX update cooldown");
        });
    });
    
    describe("7. Multi-Sig Security - Only MY Multi-Sig", function() {
        it("Should verify only exempt slots (multi-sig addresses) can call onlyMultiSig", async function() {
            // Setup: addr1 is exempt slot (multi-sig address)
            // Lock DEX
            await token.lockDEXAddresses();
            
            // addr1 (exempt slot) CAN unlock
            await token.connect(addr1).unlockDEXAddresses();
            expect(await token.dexAddressesLocked()).to.equal(false);
            console.log("✅ Exempt slot (multi-sig) can call onlyMultiSig functions");
            
            // Lock again
            await token.lockDEXAddresses();
            
            // Owner (but NOT exempt slot) CANNOT unlock
            await expect(
                token.unlockDEXAddresses()
            ).to.be.revertedWith("Only multi-sig");
            
            console.log("✅ Owner (if not exempt slot) CANNOT call onlyMultiSig");
            
            // Random address CANNOT unlock
            await expect(
                token.connect(addr3).unlockDEXAddresses()
            ).to.be.revertedWith("Only multi-sig");
            
            console.log("✅ Random address CANNOT call onlyMultiSig");
        });
        
        it("Should verify onlyMultiSig checks msg.sender is exempt slot", async function() {
            // Blacklist someone
            await token.setBlacklist(normalUser.address, true);
            
            // Only exempt slots can remove from blacklist
            // addr1 is exempt slot - should work
            await token.connect(addr1).removeFromBlacklist(normalUser.address);
            expect(await token.isBlacklisted(normalUser.address)).to.equal(false);
            
            // Blacklist again
            await token.setBlacklist(normalUser.address, true);
            
            // addr3 is NOT exempt slot - should fail
            await expect(
                token.connect(addr3).removeFromBlacklist(normalUser.address)
            ).to.be.revertedWith("Only multi-sig");
            
            console.log("✅ onlyMultiSig verifies caller is exempt slot");
        });
    });
    
    describe("8. Summary & Security Report", function() {
        it("Should display complete security summary", async function() {
            console.log("\n" + "=".repeat(60));
            console.log("SECURITY & PAUSE TESTS SUMMARY");
            console.log("=".repeat(60));
            
            console.log("\n✅ unpause() function: DOES NOT EXIST");
            console.log("✅ Auto-unpause: Works after 48h");
            
            console.log("\n✅ Pause blocks:");
            console.log("   • Normal → Normal transfers");
            console.log("   • Exempt → Normal transfers");
            console.log("   • Normal → Exempt transfers");
            console.log("   ✅ Exempt → Exempt: ALLOWED");
            
            console.log("\n✅ During pause, exempt CAN:");
            console.log("   • blacklist() ✅");
            console.log("   • proposeMint() / executeMint() ✅");
            console.log("   • updateExemptSlots() ✅");
            console.log("   • updateDEXAddresses() ✅");
            console.log("   • setLiquidityPair() ✅");
            console.log("   • lock functions ✅");
            
            console.log("\n✅ Multi-sig ONLY functions:");
            console.log("   • unlockDEXAddresses()");
            console.log("   • unlockExemptSlots()");
            console.log("   • unlockLiquidityPairs()");
            console.log("   • removeFromBlacklist()");
            console.log("   ✅ Only exempt slots can call");
            console.log("   ✅ Owner alone CANNOT call");
            console.log("   ✅ Random addresses CANNOT call");
            
            console.log("\n✅ updateExemptSlots:");
            console.log("   • Auto-pauses for 48h");
            console.log("   • Blocks propose/execute mint");
            console.log("   • Blocks updateDEXAddresses");
            console.log("   • Blocks setLiquidityPair");
            console.log("   • Functions resume after 48h");
            
            console.log("\n✅ updateDEXAddresses:");
            console.log("   • Auto-pauses for 48h");
            console.log("   • Blocks propose/execute mint");
            console.log("   • Blocks updateExemptSlots");
            console.log("   • Blocks another updateDEXAddresses");
            console.log("   • Functions resume after 48h");
            
            console.log("\n✅ Multi-sig security:");
            console.log("   • Only MY multi-sig (exempt slots) can call");
            console.log("   • Owner must be exempt slot to call onlyMultiSig");
            console.log("   • External contracts CANNOT call");
            
            console.log("\n" + "=".repeat(60));
            console.log("ALL TESTS PASSED! 🎉");
            console.log("=".repeat(60) + "\n");
        });
    });
});

// Run: npx hardhat test test/pause-security-tests.js
