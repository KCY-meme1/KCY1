const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xF8EEA8E071184AF41127Bf95da23D1d4879Cf41F";
  const checkAddress = "0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6";
  
  console.log("=== Balance Check for Specific Address ===\n");
  
  const token = await hre.ethers.getContractAt("KCY1Token", tokenAddress);
  
  // Get basic token info
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  
  console.log("Token Info:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Decimals:", decimals);
  console.log("  Contract:", tokenAddress);
  console.log("");
  
  // Check balance
  const balance = await token.balanceOf(checkAddress);
  console.log("Address:", checkAddress);
  console.log("Balance:", hre.ethers.formatEther(balance), "KCY1");
  console.log("Balance (raw):", balance.toString());
  console.log("");
  
  // Check if address is exempt
  const isExempt = await token.isExemptAddress(checkAddress);
  const isExemptSlot = await token.isExemptSlot(checkAddress);
  console.log("Is Exempt:", isExempt);
  console.log("Is Exempt Slot:", isExemptSlot);
  console.log("");
  
  // Check if blacklisted
  const isBlacklisted = await token.isBlacklisted(checkAddress);
  console.log("Is Blacklisted:", isBlacklisted);
  console.log("");
  
  // Distribution check
  const distAddrs = await token.getDistributionAddresses();
  console.log("Distribution Addresses:");
  console.log("  DEV:", distAddrs[0]);
  console.log("  Marketing:", distAddrs[1]);
  console.log("  Team:", distAddrs[2]);
  console.log("  Advisor:", distAddrs[3]);
  console.log("");
  
  if (checkAddress.toLowerCase() === distAddrs[2].toLowerCase() ||
      checkAddress.toLowerCase() === distAddrs[3].toLowerCase()) {
    console.log("✅ This address is Team or Advisor wallet");
  }
  
  // BSCScan link
  console.log("View on BSCScan Testnet:");
  console.log(`https://testnet.bscscan.com/token/${tokenAddress}?a=${checkAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });