/**
 * @version v34
 * @description Пример скрипт за използване на централизираните адреси
 */

// config/example-usage.js

const addresses = require('./addresses');
const networks = require('./networks');

console.log('=== KCY1 Централизирани Адреси - Пример за Използване ===\n');

// =====================================================
// ПРИМЕР 1: Достъп до адресите за различни мрежи
// =====================================================
console.log('📌 ПРИМЕР 1: Достъп до адресите\n');

// Hardhat
console.log('--- Hardhat Network ---');
const hardhatAddrs = addresses.getNetworkAddresses('hardhat');
console.log('Distribution:', hardhatAddrs.distribution);
console.log('Exempt Slots:', hardhatAddrs.exemptSlots);
console.log('');

// BSC Testnet
console.log('--- BSC Testnet ---');
const testnetAddrs = addresses.getNetworkAddresses('bscTestnet');
console.log('Distribution:', testnetAddrs.distribution);
console.log('DEX Router:', testnetAddrs.dex.router);
console.log('DEX Factory:', testnetAddrs.dex.factory);
console.log('WBNB:', testnetAddrs.dex.wbnb);
console.log('');

// BSC Mainnet
console.log('--- BSC Mainnet ---');
const mainnetAddrs = addresses.getNetworkAddresses('bscMainnet');
console.log('Distribution:', mainnetAddrs.distribution);
console.log('DEX Router:', mainnetAddrs.dex.router);
console.log('DEX Factory:', mainnetAddrs.dex.factory);
console.log('WBNB:', mainnetAddrs.dex.wbnb);
console.log('\n');

// =====================================================
// ПРИМЕР 2: Използване на helper функциите
// =====================================================
console.log('📌 ПРИМЕР 2: Helper функции\n');

// Получаване на distribution адресите
const mainnetDist = addresses.getDistributionAddresses('bscMainnet');
console.log('Mainnet Distribution адреси:');
console.log('  DEV:', mainnetDist.dev);
console.log('  Marketing:', mainnetDist.marketing);
console.log('  Team:', mainnetDist.team);
console.log('  Advisor:', mainnetDist.advisor);
console.log('');

// Получаване на exempt slots
const mainnetSlots = addresses.getExemptSlots('bscMainnet');
console.log('Mainnet Exempt Slots:');
mainnetSlots.forEach((slot, index) => {
  console.log(`  Slot ${index + 1}:`, slot);
});
console.log('');

// Получаване на DEX адресите
const mainnetDex = addresses.getDexAddresses('bscMainnet');
console.log('Mainnet DEX адреси:');
console.log('  Router:', mainnetDex.router);
console.log('  Factory:', mainnetDex.factory);
console.log('  WBNB:', mainnetDex.wbnb);
console.log('\n');

// =====================================================
// ПРИМЕР 3: Проверка дали адрес е exempt slot
// =====================================================
console.log('📌 ПРИМЕР 3: Проверка на exempt slots\n');

const testAddress = '0x0000000000000000000000000000000000000000';
const isExempt = addresses.isExemptSlot('bscMainnet', testAddress);
console.log(`Адресът ${testAddress} е exempt slot:`, isExempt);
console.log('\n');

// =====================================================
// ПРИМЕР 4: Интеграция с networks.js
// =====================================================
console.log('📌 ПРИМЕР 4: Интеграция с networks.js\n');

const mainnetConfig = networks.getNetworkConfig('bscMainnet');
console.log('BSC Mainnet конфигурация:');
console.log('  Name:', mainnetConfig.name);
console.log('  Chain ID:', mainnetConfig.chainId);
console.log('  Token Address:', mainnetConfig.tokenAddress || 'Not deployed yet');
console.log('  Explorer:', mainnetConfig.explorer);
console.log('  RPC:', mainnetConfig.rpc);
console.log('  Router:', mainnetConfig.router);
console.log('  Factory:', mainnetConfig.factory);
console.log('  WBNB:', mainnetConfig.WBNB);
console.log('\n');

// =====================================================
// ПРИМЕР 5: Допълнителни mainnet токени
// =====================================================
console.log('📌 ПРИМЕР 5: Референтни mainnet токени\n');

console.log('Популярни BSC токени:');
console.log('  USDT:', addresses.mainnetTokens.usdt);
console.log('  BUSD:', addresses.mainnetTokens.busd);
console.log('  BTCB:', addresses.mainnetTokens.btcb);
console.log('  ETH:', addresses.mainnetTokens.eth);
console.log('\n');

// =====================================================
// ПРИМЕР 6: Използване в deploy скрипт
// =====================================================
console.log('📌 ПРИМЕР 6: Примерен код за deploy скрипт\n');

console.log(`
// В вашия deploy.js скрипт:
const addresses = require('./config/addresses');

async function deploy() {
  const networkName = hre.network.name;
  
  // Получаване на адресите за текущата мрежа
  const distAddrs = addresses.getDistributionAddresses(networkName);
  const exemptSlots = addresses.getExemptSlots(networkName);
  const dexAddrs = addresses.getDexAddresses(networkName);
  
  console.log('Deploying to network:', networkName);
  console.log('DEV address will be:', distAddrs.dev);
  console.log('Router address:', dexAddrs.router);
  
  // Deploy contract...
}
`);

// =====================================================
// ПРЕДУПРЕЖДЕНИЯ
// =====================================================
console.log('⚠️  ВАЖНИ БЕЛЕЖКИ:\n');
console.log('1. Всички адреси се променят САМО в config/addresses.js');
console.log('2. Преди mainnet deploy, ЗАДЪЛЖИТЕЛНО конфигурирайте exempt slots!');
console.log('3. ZeroAddress е валиден само за тестване');
console.log('4. След deploy, актуализирайте tokenAddress в config/networks.js');
console.log('');
console.log('✅ Централизираната конфигурация е готова за използване!');
