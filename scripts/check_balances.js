const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xF8EEA8E071184AF41127Bf95da23D1d4879Cf41F";
  
  console.log("=== KCY1 Token Balance Check ===\n");
  
  const token = await hre.ethers.getContractAt("KCY1Token", tokenAddress);
  
  // Get distribution addresses
  const distAddrs = await token.getDistributionAddresses();
  console.log("📋 Distribution Addresses:");
  console.log("DEV Wallet:", distAddrs[0]);
  console.log("Marketing Wallet:", distAddrs[1]);
  console.log("Team Wallet:", distAddrs[2]);
  console.log("Advisor Wallet:", distAddrs[3]);
  console.log("");
  
  // Get balances
  const devBalance = await token.balanceOf(distAddrs[0]);
  const marketingBalance = await token.balanceOf(distAddrs[1]);
  const teamBalance = await token.balanceOf(distAddrs[2]);
  const advisorBalance = await token.balanceOf(distAddrs[3]);
  const contractBalance = await token.balanceOf(tokenAddress);
  
  console.log("💰 Balances:");
  console.log("DEV:", hre.ethers.formatEther(devBalance), "KCY1");
  console.log("Marketing:", hre.ethers.formatEther(marketingBalance), "KCY1");
  console.log("Team:", hre.ethers.formatEther(teamBalance), "KCY1");
  console.log("Advisor:", hre.ethers.formatEther(advisorBalance), "KCY1");
  console.log("Contract:", hre.ethers.formatEther(contractBalance), "KCY1");
  console.log("");
  
  // Check if distribution completed
  const distCompleted = await token.initialDistributionCompleted();
  console.log("✅ Distribution Completed:", distCompleted);
  
  // Check your deployer address
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n🔑 Your Deployer Address:", deployer.address);
  const yourBalance = await token.balanceOf(deployer.address);
  console.log("Your Balance:", hre.ethers.formatEther(yourBalance), "KCY1");
  
  // Total supply
  const totalSupply = await token.totalSupply();
  console.log("\n📊 Total Supply:", hre.ethers.formatEther(totalSupply), "KCY1");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });