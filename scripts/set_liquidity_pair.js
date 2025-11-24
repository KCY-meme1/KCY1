const hre = require("hardhat");

async function main() {
  const tokenAddress = "0xF8EEA8E071184AF41127Bf95da23D1d4879Cf41F";
  const WBNB_TESTNET = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  
  console.log("=== Set Liquidity Pair ===\n");
  
  const token = await hre.ethers.getContractAt("KCY1Token", tokenAddress);
  
  // Get the pair address from PancakeSwap factory
  console.log("Getting pair address from factory...");
  const pairAddress = await token.getLiquidityPairAddress(WBNB_TESTNET);
  
  if (pairAddress === hre.ethers.ZeroAddress) {
    console.log("❌ Pair doesn't exist yet!");
    console.log("\nYou need to:");
    console.log("1. Go to PancakeSwap Testnet");
    console.log("2. Add liquidity for KCY1/WBNB");
    console.log("3. Then run this script again");
    return;
  }
  
  console.log("Pair Address:", pairAddress);
  console.log("");
  
  // Check if already set
  const isAlreadySet = await token.isLiquidityPair(pairAddress);
  console.log("Already set as LP:", isAlreadySet);
  
  if (!isAlreadySet) {
    console.log("\nSetting liquidity pair...");
    const tx = await token.setLiquidityPair(pairAddress, true);
    await tx.wait();
    console.log("✅ Liquidity pair set!");
    console.log("Transaction:", tx.hash);
  } else {
    console.log("✅ Liquidity pair already configured");
  }
  
  console.log("\nView pair on BSCScan:");
  console.log(`https://testnet.bscscan.com/address/${pairAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });