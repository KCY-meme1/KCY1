/**
 * @version v37
 * Чете адреси директно от contracts/Addresses.sol
 * ЕДИН ФАЙЛ - ЕДИН ИЗТОЧНИК НА ИСТИНА!
 */

const fs = require('fs');
const path = require('path');

// Четене на Addresses.sol
const addressesFile = path.join(__dirname, '..', 'contracts', 'Addresses.sol');
const content = fs.readFileSync(addressesFile, 'utf8');

// Парсване на адрес от константа
function parseAddress(constantName) {
  const regex = new RegExp(`${constantName}\\s*=\\s*(0x[a-fA-F0-9]{40})`, 'i');
  const match = content.match(regex);
  return match ? match[1] : null;
}

// Експорт
module.exports = {
  // Hardhat (за локално тестване)
  hardhat: {
    distribution: {
      dev: "deployer",
      marketing: "deployer",
      team: "deployer",
      advisor: "deployer"
    },
    dex: {
      router: "0x0000000000000000000000000000000000000000",
      factory: "0x0000000000000000000000000000000000000000",
      wbnb: "0x0000000000000000000000000000000000000000"
    },
    get exemptSlots() {
      return ["deployer", "deployer", "deployer", "deployer"];
    }
  },
  
  // BSC Testnet
  bscTestnet: {
    distribution: {
      dev: parseAddress('TESTNET_DEV'),
      marketing: parseAddress('TESTNET_MARKETING'),
      team: parseAddress('TESTNET_TEAM'),
      advisor: parseAddress('TESTNET_ADVISOR')
    },
    dex: {
      router: parseAddress('TESTNET_ROUTER'),
      factory: parseAddress('TESTNET_FACTORY'),
      wbnb: parseAddress('TESTNET_WBNB')
    },
    // Exempt slots = distribution addresses
    get exemptSlots() {
      return [
        this.distribution.dev,
        this.distribution.marketing,
        this.distribution.team,
        this.distribution.advisor
      ];
    }
  },
  
  // BSC Mainnet
  bscMainnet: {
    distribution: {
      dev: parseAddress('MAINNET_DEV'),
      marketing: parseAddress('MAINNET_MARKETING'),
      team: parseAddress('MAINNET_TEAM'),
      advisor: parseAddress('MAINNET_ADVISOR')
    },
    dex: {
      router: parseAddress('MAINNET_ROUTER'),
      factory: parseAddress('MAINNET_FACTORY'),
      wbnb: parseAddress('MAINNET_WBNB')
    },
    // Exempt slots = distribution addresses
    get exemptSlots() {
      return [
        this.distribution.dev,
        this.distribution.marketing,
        this.distribution.team,
        this.distribution.advisor
      ];
    }
  },
  
  // Helper функции (обратна съвместимост)
  getNetworkAddresses(network) {
    return this[network];
  },
  
  getDistributionAddresses(network) {
    return this[network]?.distribution;
  },
  
  getExemptSlots(network) {
    return this[network]?.exemptSlots;
  },
  
  getDexAddresses(network) {
    return this[network]?.dex;
  }
};
