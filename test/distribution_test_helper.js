const { expect } = require("chai");
const { ethers } = require("hardhat");

// Адресите са прости string константи
const DEV_WALLET_mm_vis = "0x567c1c5e9026E04078F9b92DcF295A58355f60c7";
const MARKETING_WALLET_tng = "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A";
const TEAM_WALLET_trz_hdn = "0x6300811567bed7d69B5AC271060a7E298f99fddd";
const ADVISOR_WALLET_trz_vis = "0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87";

describe("KCY1 Token - Detailed Distribution Tests", function () {
  let token;
  let owner;
  let addr1, addr2, addr3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const KCY1Token = await ethers.getContractFactory("KCY1Token");
    token = await KCY1Token.deploy();
    await token.waitForDeployment();
  });

  describe("Simulated Real Network Distribution", function () {
    it("Should correctly distribute to different wallets (BSC simulation)", async function () {
      // На Hardhat (chainid 31337), owner получава 96M токена, не реалния BSC адрес
      const initialOwnerBalance = await token.balanceOf(owner.address);
      expect(initialOwnerBalance).to.equal(ethers.parseEther("96000000")); // 96M to owner

      const initialContractBalance = await token.balanceOf(await token.getAddress());
      expect(initialContractBalance).to.equal(ethers.parseEther("4000000")); // 4M to contract

      // ✅ ПОПРАВКА: Направи получателите exempt за да могат да получават повече от 1000 токена
      await token.updateExemptSlots(
        [addr1.address, addr2.address, addr3.address, ethers.ZeroAddress]
      );

      // Simulate distribution from owner to other wallets
      const distributions = [
        { wallet: addr1.address, amount: ethers.parseEther("24000000") },  // 24M
        { wallet: addr2.address, amount: ethers.parseEther("48000000") },   // 48M
        { wallet: addr3.address, amount: ethers.parseEther("24000000") }, // 24M
      ];

      for (const dist of distributions) {
        await token.connect(owner).transfer(dist.wallet, dist.amount);
      }

      // Verify balances after distribution (should be exact amounts - NO FEES because both parties are exempt)
      const addr1Balance = await token.balanceOf(addr1.address);
      const addr2Balance = await token.balanceOf(addr2.address);
      const addr3Balance = await token.balanceOf(addr3.address);

      expect(addr1Balance).to.equal(ethers.parseEther("24000000")); // ✅ 24M exact
      expect(addr2Balance).to.equal(ethers.parseEther("48000000"));      // ✅ 48M exact
      expect(addr3Balance).to.equal(ethers.parseEther("24000000"));   // ✅ 24M exact

      // Owner should have 0 remaining (96M distributed)
      const finalOwnerBalance = await token.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(0);
    });

    it("Should verify all allocations add up correctly", async function () {
      // Направи получателите exempt за да могат да получават повече от 1000 токена
      await token.updateExemptSlots(
        [addr1.address, addr2.address, addr3.address, ethers.ZeroAddress]
      );
      
      // Distribute all 96M from owner
      await token.connect(owner).transfer(addr1.address, ethers.parseEther("24000000"));
      await token.connect(owner).transfer(addr2.address, ethers.parseEther("48000000"));
      await token.connect(owner).transfer(addr3.address, ethers.parseEther("24000000"));

      // Sum of all allocations
      const addr1Balance = await token.balanceOf(addr1.address);
      const addr2Balance = await token.balanceOf(addr2.address);
      const addr3Balance = await token.balanceOf(addr3.address);
      const contractBalance = await token.balanceOf(await token.getAddress());

      const totalDistributed = addr1Balance + addr2Balance + addr3Balance + contractBalance;

      // Should equal 100M total supply (96M distributed + 4M in contract)
      expect(totalDistributed).to.equal(ethers.parseEther("100000000")); // ✅ 100M exact
    });

    it("Should handle multiple small transfers without fee accumulation for exempt", async function () {
      // Направи addr1 exempt за да може да получава 1M на трансфер (над лимита от 1000)
      await token.updateExemptSlots(
        [addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
      );
      
      const initialBalance = await token.balanceOf(owner.address);
      const transferAmount = ethers.parseEther("1000000"); // 1M per transfer

      // Make 10 transfers of 1M each = 10M total
      for (let i = 0; i < 10; i++) {
        await token.connect(owner).transfer(addr1.address, transferAmount);
      }

      const finalOwnerBalance = await token.balanceOf(owner.address);
      const addr1Balance = await token.balanceOf(addr1.address);

      // Owner should have exactly 10M less (no fees)
      expect(finalOwnerBalance).to.equal(initialBalance - ethers.parseEther("10000000"));
      
      // addr1 should have exactly 10M (no fees deducted)
      expect(addr1Balance).to.equal(ethers.parseEther("10000000"));
    });

    it("Should correctly distribute with mixed exempt and non-exempt recipients", async function () {
      // Make addr1 exempt via slot1, owner is already exempt by default
      // addr2 is NOT exempt
      await token.updateExemptSlots(
        [addr1.address, ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress]
      );

      const exemptAmount = ethers.parseEther("1000000"); // 1M - OK for exempt
      const normalAmount = ethers.parseEther("500"); // 500 tokens - под лимита от 1000

      // Transfer from owner (exempt) to addr1 (exempt) - NO fees, no limits
      await token.connect(owner).transfer(addr1.address, exemptAmount);
      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(exemptAmount); // ✅ Exact 1M

      // Transfer from owner (exempt) to addr2 (NOT exempt) - 0.08% fees apply + limits
      // BURN_FEE = 30 (0.03%), OWNER_FEE = 50 (0.05%), FEE_DENOMINATOR = 100000
      // Total fee = (30 + 50) / 100000 = 80 / 100000 = 0.08%
      await token.connect(owner).transfer(addr2.address, normalAmount);
      const addr2Balance = await token.balanceOf(addr2.address);
      
      // Calculate expected: amount - (amount * 80 / 100000)
      const feeAmount = (normalAmount * 80n) / 100000n;
      const expectedAddr2 = normalAmount - feeAmount;
      
      expect(addr2Balance).to.equal(expectedAddr2); // ✅ 499.96 tokens (0.08% fee)
    });
  });
});

// Export адресите за използване в други тестове
module.exports = {
  DEV_WALLET_mm_vis,
  MARKETING_WALLET_tng,
  TEAM_WALLET_trz_hdn,
  ADVISOR_WALLET_trz_vis,
};