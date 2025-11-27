/**
 * @version v34
 */

const {
  displayNetworkInfo,
  getTokenContract,
  getSigner,
  formatTokens,
  waitForTx,
  getCurrentNetworkConfig
} = require("../utils/helpers");

async function main() {
  console.log("=== Withdraw Contract Tokens ===\n");
  
  await displayNetworkInfo();
  
  const token = await getTokenContract();
  const signer = await getSigner();
  const config = await getCurrentNetworkConfig();
  
  // Check ownership
  const contractOwner = await token.owner();
  console.log("Contract owner:", contractOwner);
  
  if (signer.address.toLowerCase() !== contractOwner.toLowerCase()) {
    console.log("\n❌ ERROR: You are NOT the contract owner!");
    console.log("Current signer:", signer.address);
    return;
  }
  console.log("✅ Ownership verified");
  console.log("");
  
  // Check contract balance
  const contractBalance = await token.balanceOf(config.tokenAddress);
  console.log("Contract balance:", formatTokens(contractBalance), "KCY1");
  
  if (contractBalance === 0n) {
    console.log("❌ Contract has no tokens to withdraw!");
    return;
  }
  
  // Check if distribution was done
  const distCompleted = await token.initialDistributionCompleted();
  console.log("Distribution completed:", distCompleted);
  
  if (!distCompleted) {
    console.log("\n⚠️  Distribution NOT completed yet!");
    console.log("Run: npx hardhat run scripts/configure.js --network", config.network);
    console.log("Then run this script again.");
    return;
  }
  console.log("");
  
  // Withdraw
  console.log(`💰 Withdrawing ${formatTokens(contractBalance)} KCY1 to owner...`);
  const tx = await token.withdrawCirculationTokens(contractBalance);
  await waitForTx(tx, "Withdrawal");
  
  // Check new balances
  const newOwnerBalance = await token.balanceOf(signer.address);
  const newContractBalance = await token.balanceOf(config.tokenAddress);
  
  console.log("\n📊 New Balances:");
  console.log("  Owner:", formatTokens(newOwnerBalance), "KCY1");
  console.log("  Contract:", formatTokens(newContractBalance), "KCY1");
  console.log("\n✅ Withdrawal complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });