const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xF8EEA8E071184AF41127Bf95da23D1d4879Cf41F";
  
  console.log("=== Withdraw Contract Tokens ===\n");
  
  const token = await hre.ethers.getContractAt("KCY1Token", tokenAddress);
  const [owner] = await hre.ethers.getSigners();
  
  console.log("Owner address:", owner.address);
  
  // Check if you're the owner
  const contractOwner = await token.owner();
  console.log("Contract owner:", contractOwner);
  
  if (owner.address.toLowerCase() !== contractOwner.toLowerCase()) {
    console.log("\n❌ ERROR: You are NOT the contract owner!");
    return;
  }
  
  // Check contract balance
  const contractBalance = await token.balanceOf(tokenAddress);
  console.log("\nContract balance:", hre.ethers.formatEther(contractBalance), "KCY1");
  
  if (contractBalance === 0n) {
    console.log("❌ Contract has no tokens to withdraw!");
    return;
  }
  
  // Check if distribution was done
  const distCompleted = await token.initialDistributionCompleted();
  console.log("Distribution completed:", distCompleted);
  
  if (!distCompleted) {
    console.log("\n⚠️  Distribution NOT completed yet!");
    console.log("Run: npx hardhat run scripts/configure.js --network bscTestnet");
    console.log("Then run this script again.");
    return;
  }
  
  // Withdraw remaining tokens from contract
  const amountToWithdraw = contractBalance; // Withdraw all
  
  console.log("\n💰 Withdrawing", hre.ethers.formatEther(amountToWithdraw), "KCY1 to owner...");
  
  const tx = await token.withdrawCirculationTokens(amountToWithdraw);
  console.log("Transaction sent:", tx.hash);
  
  await tx.wait();
  console.log("✅ Withdrawal complete!");
  
  // Check new balances
  const newOwnerBalance = await token.balanceOf(owner.address);
  const newContractBalance = await token.balanceOf(tokenAddress);
  
  console.log("\n📊 New Balances:");
  console.log("Owner:", hre.ethers.formatEther(newOwnerBalance), "KCY1");
  console.log("Contract:", hre.ethers.formatEther(newContractBalance), "KCY1");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });