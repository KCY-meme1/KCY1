/**
 * @version v34
 */

const hre = require("hardhat");
const { getCurrentNetworkConfig, getExplorerUrl } = require("../utils/helpers");

async function main() {
  console.log("=== Contract Verification ===\n");
  
  const config = await getCurrentNetworkConfig();
  
  console.log("🌐 Network:", config.name);
  console.log("📄 Token:", config.tokenAddress);
  console.log("");
  
  console.log("Verifying contract on BSCScan...");
  
  try {
    await hre.run("verify:verify", {
      address: config.tokenAddress,
      constructorArguments: [],
    });
    console.log("✅ Contract verified successfully!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
      process.exit(1);
    }
  }
  
  console.log("\n🔗 View verified contract:");
  console.log(await getExplorerUrl());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });