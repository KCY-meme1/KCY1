/**
 * @version v34
 */

const hre = require("hardhat");
const {
  displayNetworkInfo,
  getCurrentNetworkConfig,
  getTokenContract,
  waitForTx,
  getExplorerUrl
} = require("../utils/helpers");

async function main() {
  console.log("=== Set Liquidity Pair ===\n");
  
  await displayNetworkInfo();
  
  const config = await getCurrentNetworkConfig();
  const token = await getTokenContract();
  
  const WBNB = config.WBNB;
  console.log("📍 WBNB Address:", WBNB);
  console.log("");
  
  // Get pair address from PancakeSwap factory
  console.log("Getting pair address from factory...");
  const pairAddress = await token.getLiquidityPairAddress(WBNB);
  
  if (pairAddress === hre.ethers.ZeroAddress) {
    console.log("❌ Pair doesn't exist yet!");
    console.log("\nYou need to:");
    console.log("1. Go to PancakeSwap (testnet/mainnet)");
    console.log("2. Add liquidity for KCY1/WBNB");
    console.log("3. Then run this script again");
    return;
  }
  
  console.log("✅ Pair found:", pairAddress);
  console.log("");
  
  // Check if already set
  const isAlreadySet = await token.isLiquidityPair(pairAddress);
  console.log("Already registered:", isAlreadySet);
  
  if (!isAlreadySet) {
    console.log("\nSetting liquidity pair...");
    const tx = await token.setLiquidityPair(pairAddress, true);
    await waitForTx(tx, "Set liquidity pair");
    console.log("✅ Liquidity pair registered!");
  } else {
    console.log("✅ Liquidity pair already configured");
  }
  
  console.log("\n🔗 View pair on explorer:");
  console.log(await getExplorerUrl("address", pairAddress));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });