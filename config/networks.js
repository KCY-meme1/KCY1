/**
 * @version v34
 * @description Network-specific configuration
 * Token addresses are added AFTER deployment
 * 
 * ЗАБЕЛЕЖКА: Този файл използва централизираните адреси от addresses.js
 * За промяна на distribution адреси, DEX адреси или exempt slots използвайте addresses.js
 */

const addresses = require('./addresses');

// Конфигурация за Hardhat локална мрежа
const hardhatConfig = {
  name: "Hardhat Local",
  chainId: 31337,
  tokenAddress: "", // Set after local deploy
  explorer: "http://localhost:8545",
  rpc: "http://127.0.0.1:8545/",
  // DEX адреси от addresses.js
  ...addresses.hardhat.dex
};

// Конфигурация за BSC Testnet
const bscTestnetConfig = {
  name: "BSC Testnet",
  chainId: 97,
  tokenAddress: "0xF8EEA8E071184AF41127Bf95da23D1d4879Cf41F", // UPDATE after testnet deploy
  explorer: "https://testnet.bscscan.com",
  rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
  // DEX адреси от addresses.js
  router: addresses.bscTestnet.dex.router,
  factory: addresses.bscTestnet.dex.factory,
  WBNB: addresses.bscTestnet.dex.wbnb
};

// Конфигурация за BSC Mainnet
const bscMainnetConfig = {
  name: "BSC Mainnet",
  chainId: 56,
  tokenAddress: "", // UPDATE after mainnet deploy
  explorer: "https://bscscan.com",
  rpc: "https://bsc-dataseed.binance.org/",
  // DEX адреси от addresses.js
  router: addresses.bscMainnet.dex.router,
  factory: addresses.bscMainnet.dex.factory,
  WBNB: addresses.bscMainnet.dex.wbnb
};

// Експортиране на конфигурациите
module.exports = {
  hardhat: hardhatConfig,
  bscTestnet: bscTestnetConfig,
  bscMainnet: bscMainnetConfig
};

// Helper function to get config by network name
function getNetworkConfig(networkName) {
  const config = module.exports[networkName];
  if (!config) {
    throw new Error(`Unknown network: ${networkName}. Valid networks: hardhat, bscTestnet, bscMainnet`);
  }
  return config;
}

module.exports.getNetworkConfig = getNetworkConfig;
