const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xF8EEA8E071184AF41127Bf95da23D1d4879Cf41F";
  
  console.log("=== KCY1 Token Full Configuration ===\n");
  
  const token = await hre.ethers.getContractAt("KCY1Token", tokenAddress);
  const [owner] = await hre.ethers.getSigners();
  
  console.log("Owner Address:", owner.address);
  console.log("Contract Address:", tokenAddress);
  console.log("");
  
  // Check current state
  const distCompleted = await token.initialDistributionCompleted();
  const exemptSlotsLocked = await token.exemptSlotsLocked();
  const pairsLocked = await token.liquidityPairsLocked();
  
  console.log("📊 Current Status:");
  console.log("  Distribution Completed:", distCompleted);
  console.log("  Exempt Slots Locked:", exemptSlotsLocked);
  console.log("  Liquidity Pairs Locked:", pairsLocked);
  console.log("");
  
  // Get exempt addresses
  const exempts = await token.getExemptAddresses();
  console.log("🔓 Exempt Addresses:");
  console.log("  Slot 1:", exempts.slots[0]);
  console.log("  Slot 2:", exempts.slots[1]);
  console.log("  Slot 3:", exempts.slots[2]);
  console.log("  Slot 4:", exempts.slots[3]);
  console.log("  Router:", exempts.router);
  console.log("  Factory:", exempts.factory);
  console.log("");
  
  // Get distribution addresses
  const distAddrs = await token.getDistributionAddresses();
  console.log("💰 Distribution Addresses:");
  console.log("  DEV:", distAddrs[0]);
  console.log("  Marketing:", distAddrs[1]);
  console.log("  Team:", distAddrs[2]);
  console.log("  Advisor:", distAddrs[3]);
  console.log("");
  
  // Check balances
  const devBalance = await token.balanceOf(distAddrs[0]);
  const mktBalance = await token.balanceOf(distAddrs[1]);
  const teamBalance = await token.balanceOf(distAddrs[2]);
  const advBalance = await token.balanceOf(distAddrs[3]);
  const contractBalance = await token.balanceOf(tokenAddress);
  const ownerBalance = await token.balanceOf(owner.address);
  
  console.log("💵 Balances:");
  console.log("  DEV:", hre.ethers.formatEther(devBalance), "KCY1");
  console.log("  Marketing:", hre.ethers.formatEther(mktBalance), "KCY1");
  console.log("  Team:", hre.ethers.formatEther(teamBalance), "KCY1");
  console.log("  Advisor:", hre.ethers.formatEther(advBalance), "KCY1");
  console.log("  Contract:", hre.ethers.formatEther(contractBalance), "KCY1");
  console.log("  Owner:", hre.ethers.formatEther(ownerBalance), "KCY1");
  console.log("");
  
  // Trading status
  const tradingEnabled = await token.isTradingEnabled();
  const timeLeft = await token.timeUntilTradingEnabled();
  
  console.log("⏰ Trading Status:");
  console.log("  Trading Enabled:", tradingEnabled);
  if (!tradingEnabled) {
    const hours = Number(timeLeft) / 3600;
    console.log("  Time Until Trading:", hours.toFixed(2), "hours");
  }
  console.log("");
  
  console.log("✅ Configuration check complete!");
  console.log("\nView on BSCScan:");
  console.log(`https://testnet.bscscan.com/address/${tokenAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });