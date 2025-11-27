/**
 * @version v34
 */

const {
  displayNetworkInfo,
  getTokenContract,
  getAllBalances,
  displayBalances,
  getDistributionAddresses,
  formatTokens,
  getExplorerUrl
} = require("../utils/helpers");

async function main() {
  console.log("=== KCY1 Token Full Status ===\n");
  
  await displayNetworkInfo();
  
  const token = await getTokenContract();
  
  // ============================================
  // Distribution Status
  // ============================================
  console.log("📦 Distribution:");
  const distCompleted = await token.initialDistributionCompleted();
  console.log("  Completed:", distCompleted ? "✅ Yes" : "⏳ No");
  
  const distAddrs = await getDistributionAddresses(token);
  console.log("  DEV:", distAddrs.dev);
  console.log("  Marketing:", distAddrs.marketing);
  console.log("  Team:", distAddrs.team);
  console.log("  Advisor:", distAddrs.advisor);
  console.log("");
  
  // ============================================
  // Exempt Slots
  // ============================================
  console.log("🔓 Exempt Slots:");
  const exempts = await token.getExemptAddresses();
  console.log("  Slot 1:", exempts.slots[0]);
  console.log("  Slot 2:", exempts.slots[1]);
  console.log("  Slot 3:", exempts.slots[2]);
  console.log("  Slot 4:", exempts.slots[3]);
  console.log("  Locked:", exempts.slotsLocked ? "🔒 Yes" : "🔓 No");
  console.log("");
  
  console.log("🏭 DEX Addresses:");
  console.log("  Router:", exempts.router);
  console.log("  Factory:", exempts.factory);
  console.log("");
  
  // ============================================
  // Liquidity Pairs
  // ============================================
  console.log("💧 Liquidity Pairs:");
  const pairsLocked = await token.liquidityPairsLocked();
  console.log("  Locked:", pairsLocked ? "🔒 Yes" : "🔓 No");
  console.log("");
  
  // ============================================
  // Balances
  // ============================================
  const balances = await getAllBalances(token);
  await displayBalances(balances, distAddrs);
  
  // ============================================
  // Trading Status
  // ============================================
  console.log("\n⏰ Trading Status:");
  const tradingEnabled = await token.isTradingEnabled();
  console.log("  Enabled:", tradingEnabled ? "✅ Yes" : "⏳ No (48h lock)");
  
  if (!tradingEnabled) {
    const timeLeft = await token.timeUntilTradingEnabled();
    const hours = Number(timeLeft) / 3600;
    const tradingTime = new Date(Date.now() + Number(timeLeft) * 1000);
    console.log("  Time left:", hours.toFixed(2), "hours");
    console.log("  Trading starts:", tradingTime.toLocaleString());
  }
  console.log("");
  
  // ============================================
  // Pause Status
  // ============================================
  console.log("⏸️  Pause Status:");
  const isPaused = await token.isPaused();
  console.log("  Paused:", isPaused ? "⏸️  Yes" : "▶️  No");
  
  if (isPaused) {
    const pauseLeft = await token.timeUntilUnpaused();
    const hours = Number(pauseLeft) / 3600;
    console.log("  Time until unpause:", hours.toFixed(2), "hours");
  }
  console.log("");
  
  // ============================================
  // Fee Info
  // ============================================
  console.log("💸 Fee Structure:");
  const burnFee = await token.BURN_FEE();
  const ownerFee = await token.OWNER_FEE();
  const feeDenom = await token.FEE_DENOMINATOR();
  const totalFeePercent = (Number(burnFee) + Number(ownerFee)) / Number(feeDenom) * 100;
  console.log("  Total Fee:", totalFeePercent.toFixed(3) + "%");
  console.log("  Burn:", (Number(burnFee) / Number(feeDenom) * 100).toFixed(3) + "%");
  console.log("  Owner:", (Number(ownerFee) / Number(feeDenom) * 100).toFixed(3) + "%");
  console.log("");
  
  // ============================================
  // Limits
  // ============================================
  console.log("🚧 Transaction Limits:");
  const maxTx = await token.MAX_TRANSACTION();
  const maxWallet = await token.MAX_WALLET();
  const cooldown = await token.COOLDOWN_PERIOD();
  console.log("  Max Transaction:", formatTokens(maxTx), "KCY1");
  console.log("  Max Wallet:", formatTokens(maxWallet), "KCY1");
  console.log("  Cooldown:", Number(cooldown) / 3600, "hours");
  console.log("");
  
  console.log("🎯 Exempt → Normal Limits:");
  const maxExemptToNormal = await token.MAX_EXEMPT_TO_NORMAL();
  const exemptCooldown = await token.EXEMPT_TO_NORMAL_COOLDOWN();
  console.log("  Max Amount:", formatTokens(maxExemptToNormal), "KCY1");
  console.log("  Cooldown:", Number(exemptCooldown) / 3600, "hours");
  console.log("");
  
  console.log("✅ Status check complete!");
  console.log("\n🔗 View on explorer:");
  console.log(await getExplorerUrl());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });