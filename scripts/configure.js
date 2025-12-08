/**
 * @version v34
 */

const hre = require("hardhat");
const {
  displayNetworkInfo,
  getTokenContract,
  getDistributionAddresses,
  waitForTx,
  getAllBalances,
  displayBalances,
  getExplorerUrl
} = require("../utils/helpers");
const exemptConfig = require("../config/exempts-slots");

async function main() {
  console.log("=== KCY1 Token Configuration ===\n");
  
  await displayNetworkInfo();
  
  const token = await getTokenContract();
  const networkName = hre.network.name;
  
  // ============================================
  // STEP 1: Distribution
  // ============================================
  console.log("📦 STEP 1: Token Distribution");
  const distCompleted = await token.initialDistributionCompleted();
  console.log("Status:", distCompleted ? "✅ Completed" : "⏳ Pending");
  
  if (!distCompleted) {
    console.log("\nDistributing tokens...");
    const tx = await token.distributeInitialAllocations();
    await waitForTx(tx, "Distribution");
    
    const distAddrs = await getDistributionAddresses(token);
    console.log("\n✅ Tokens distributed to:");
    console.log("  DEV:", distAddrs.dev);
    console.log("  Marketing:", distAddrs.marketing);
    console.log("  Team:", distAddrs.team);
    console.log("  Advisor:", distAddrs.advisor);
  } else {
    console.log("Distribution already completed - skipping");
  }
  console.log("");
  
  // ============================================
  // STEP 2: Exempt Slots
  // ============================================
  console.log("🔓 STEP 2: Exempt Slots");
  
  const exempts = await token.getExemptAddresses();
  console.log("Current slots:");
  console.log("  Slot 1:", exempts.slots[0]);
  console.log("  Slot 2:", exempts.slots[1]);
  console.log("  Slot 3:", exempts.slots[2]);
  console.log("  Slot 4:", exempts.slots[3]);
  console.log("  Locked:", exempts.slotsLocked);
  console.log("");
  
  if (!exempts.slotsLocked) {
    const newSlots = exemptConfig.getExemptSlots(networkName);
    
    const needsUpdate = 
      exempts.slots[0] !== newSlots[0] ||
      exempts.slots[1] !== newSlots[1] ||
      exempts.slots[2] !== newSlots[2] ||
      exempts.slots[3] !== newSlots[3];
    
    if (needsUpdate) {
      console.log("Updating to:");
      console.log("  Slot 1:", newSlots[0]);
      console.log("  Slot 2:", newSlots[1]);
      console.log("  Slot 3:", newSlots[2]);
      console.log("  Slot 4:", newSlots[3]);
      
      const tx = await token.updateExemptSlots(newSlots);
      await waitForTx(tx, "Exempt slots update");
    } else {
      console.log("Slots already configured correctly - skipping");
    }
  } else {
    console.log("⚠️  Slots are LOCKED - cannot update");
  }
  console.log("");
  
  // ============================================
  // STEP 3: Summary
  // ============================================
  console.log("=== Configuration Summary ===\n");
  
  const balances = await getAllBalances(token);
  const distAddrs = await getDistributionAddresses(token);
  
  await displayBalances(balances, distAddrs);
  
  const tradingEnabled = await token.isTradingEnabled();
  console.log("\n⏰ Trading Status:");
  console.log("  Enabled:", tradingEnabled ? "✅ Yes" : "⏳ No (48h lock)");
  
  if (!tradingEnabled) {
    const timeLeft = await token.timeUntilTradingEnabled();
    const hours = Number(timeLeft) / 3600;
    console.log("  Time left:", hours.toFixed(2), "hours");
  }
  
  console.log("\n✅ Configuration complete!");
  console.log("\n🔗 View on explorer:");
  console.log(await getExplorerUrl());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });