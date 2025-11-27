/**
 * @version v34
 */

const hre = require("hardhat");
const networkConfig = require("../config/networks");

/**
 * Get current network configuration
 */
async function getCurrentNetworkConfig() {
  const networkName = hre.network.name;
  const config = networkConfig.getNetworkConfig(networkName);
  
  if (!config.tokenAddress || config.tokenAddress === "") {
    throw new Error(
      `Token address not set for ${networkName}!\n` +
      `Please update config/networks.js after deployment.`
    );
  }
  
  return config;
}

/**
 * Get token contract instance
 */
async function getTokenContract(address = null) {
  if (!address) {
    const config = await getCurrentNetworkConfig();
    address = config.tokenAddress;
  }
  
  return await hre.ethers.getContractAt("KCY1Token", address);
}

/**
 * Get current signer (deployer/owner)
 */
async function getSigner() {
  const [signer] = await hre.ethers.getSigners();
  return signer;
}

/**
 * Format token amount for display
 */
function formatTokens(amount) {
  return hre.ethers.formatEther(amount);
}

/**
 * Parse token amount from string
 */
function parseTokens(amount) {
  return hre.ethers.parseEther(amount.toString());
}

/**
 * Wait for transaction with logging
 */
async function waitForTx(tx, message = "Transaction") {
  console.log(`${message} sent:`, tx.hash);
  await tx.wait();
  console.log(`✅ ${message} confirmed`);
  return tx;
}

/**
 * Display network info
 */
async function displayNetworkInfo() {
  const config = await getCurrentNetworkConfig();
  const signer = await getSigner();
  
  console.log("🌐 Network:", config.name);
  console.log("📍 Chain ID:", config.chainId);
  console.log("🔑 Signer:", signer.address);
  console.log("📄 Token:", config.tokenAddress);
  console.log("");
}

/**
 * Get distribution addresses from contract
 */
async function getDistributionAddresses(token = null) {
  if (!token) {
    token = await getTokenContract();
  }
  const addrs = await token.getDistributionAddresses();
  return {
    dev: addrs[0],
    marketing: addrs[1],
    team: addrs[2],
    advisor: addrs[3]
  };
}

/**
 * Get all balances
 */
async function getAllBalances(token = null) {
  if (!token) {
    token = await getTokenContract();
  }
  
  const config = await getCurrentNetworkConfig();
  const signer = await getSigner();
  const distAddrs = await getDistributionAddresses(token);
  
  return {
    dev: await token.balanceOf(distAddrs.dev),
    marketing: await token.balanceOf(distAddrs.marketing),
    team: await token.balanceOf(distAddrs.team),
    advisor: await token.balanceOf(distAddrs.advisor),
    contract: await token.balanceOf(config.tokenAddress),
    owner: await token.balanceOf(signer.address),
    totalSupply: await token.totalSupply()
  };
}

/**
 * Display balances
 */
async function displayBalances(balances = null, distAddrs = null) {
  if (!balances) {
    balances = await getAllBalances();
  }
  if (!distAddrs) {
    distAddrs = await getDistributionAddresses();
  }
  
  console.log("💰 Balances:");
  console.log(`  DEV (${distAddrs.dev}):`, formatTokens(balances.dev), "KCY1");
  console.log(`  Marketing (${distAddrs.marketing}):`, formatTokens(balances.marketing), "KCY1");
  console.log(`  Team (${distAddrs.team}):`, formatTokens(balances.team), "KCY1");
  console.log(`  Advisor (${distAddrs.advisor}):`, formatTokens(balances.advisor), "KCY1");
  console.log("  Contract:", formatTokens(balances.contract), "KCY1");
  console.log("  Owner:", formatTokens(balances.owner), "KCY1");
  console.log("");
  console.log("📊 Total Supply:", formatTokens(balances.totalSupply), "KCY1");
}

/**
 * Get explorer URL
 */
async function getExplorerUrl(type = "address", value = null) {
  const config = await getCurrentNetworkConfig();
  
  if (type === "address") {
    value = value || config.tokenAddress;
    return `${config.explorer}/address/${value}`;
  } else if (type === "tx") {
    return `${config.explorer}/tx/${value}`;
  } else if (type === "token") {
    const address = value?.address || value;
    const holder = value?.holder;
    if (holder) {
      return `${config.explorer}/token/${config.tokenAddress}?a=${holder}`;
    }
    return `${config.explorer}/token/${address || config.tokenAddress}`;
  }
  
  return config.explorer;
}

module.exports = {
  getCurrentNetworkConfig,
  getTokenContract,
  getSigner,
  formatTokens,
  parseTokens,
  waitForTx,
  displayNetworkInfo,
  getDistributionAddresses,
  getAllBalances,
  displayBalances,
  getExplorerUrl
};