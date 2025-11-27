<!-- @version v34 -->

# Централизирана Конфигурация на Адреси

## Преглед

Всички адреси за проекта KCY1 (тестов и майннет блокчейн) са централизирани в един файл:

```
config/addresses.js
```

Този файл съдържа **всички** адреси използвани в проекта:
- Distribution адреси (DEV, Marketing, Team, Advisor)
- Exempt slots адреси (4 слота с NO fees и NO limits)
- DEX адреси (PancakeSwap Router, Factory, WBNB)
- Допълнителни референтни токени адреси

## Структура

### 1. config/addresses.js (ГЛАВЕН ФАЙЛ)

Централизирана конфигурация за всички три мрежи:

```javascript
const addresses = require('./config/addresses');

// Достъп до адресите за конкретна мрежа
const mainnetDist = addresses.bscMainnet.distribution;
console.log(mainnetDist.dev);      // 0x567c1c5e9026E04078F9b92DcF295A58355f60c7
console.log(mainnetDist.marketing); // 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A

// Или използвайте helper функциите
const distAddrs = addresses.getDistributionAddresses('bscMainnet');
const exemptSlots = addresses.getExemptSlots('bscMainnet');
const dexAddrs = addresses.getDexAddresses('bscMainnet');
```

### 2. config/networks.js

Използва `addresses.js` за DEX адресите:
```javascript
const addresses = require('./addresses');

module.exports = {
  bscMainnet: {
    router: addresses.bscMainnet.dex.router,
    factory: addresses.bscMainnet.dex.factory,
    WBNB: addresses.bscMainnet.dex.wbnb
  }
};
```

### 3. config/exempts-slots.js

**DEPRECATED** - Препраща към `addresses.js`:
```javascript
const addresses = require('./addresses');

module.exports = {
  bscMainnet: addresses.bscMainnet.exemptSlots
};
```

## Мрежови Конфигурации

### Hardhat (chainId: 31337)
- **Distribution**: Deployer получава всичко (локално тестване)
- **Exempt Slots**: 4x ZeroAddress (празни слотове)
- **DEX**: Не е приложимо

### BSC Testnet (chainId: 97)
- **Distribution**: Тестови кошелци
  - DEV: `0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702`
  - Marketing: `0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7`
  - Team: `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6`
  - Advisor: `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6`
- **Exempt Slots**: ✅ Същите като Distribution адресите
  - Slot 1: `0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702` (DEV)
  - Slot 2: `0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7` (Marketing)
  - Slot 3: `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` (Team)
  - Slot 4: `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` (Advisor)
- **DEX**: PancakeSwap Testnet
  - Router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`
  - Factory: `0x6725F303b657a9451d8BA641348b6761A6CC7a17`
  - WBNB: `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd`

### BSC Mainnet (chainId: 56)
- **Distribution**: ПРОДУКЦИОННИ кошелци
  - DEV mm6: `0x567c1c5e9026E04078F9b92DcF295A58355f60c7`
  - Marketing tng: `0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A`
  - Team trz hdn: `0x6300811567bed7d69B5AC271060a7E298f99fddd`
  - Advisor trz vs: `0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87`
- **Exempt Slots**: ✅ Същите като Distribution адресите
  - Slot 1: `0x567c1c5e9026E04078F9b92DcF295A58355f60c7` (DEV mm6)
  - Slot 2: `0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A` (Marketing tng)
  - Slot 3: `0x6300811567bed7d69B5AC271060a7E298f99fddd` (Team trz hdn)
  - Slot 4: `0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87` (Advisor trz vs)
- **DEX**: PancakeSwap V2 Mainnet
  - Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
  - Factory: `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73`
  - WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`

## Как се Използва

### В Solidity Контракти

Адресите са hardcoded в конструктора на `kcy-meme-1.sol`:
```solidity
constructor() {
    // Използва chainId за автоматично определяне на адресите
    DEVw_mv = block.chainid == 31337 ? msg.sender : 
              (block.chainid == 97 ? 0xCBfA... : 0x567c...);
}
```

### В JavaScript/TypeScript

#### Използване в скриптове:
```javascript
const addresses = require('../config/addresses');

// Получаване на адресите за текущата мрежа
const networkName = hre.network.name; // 'hardhat', 'bscTestnet', 'bscMainnet'
const distAddrs = addresses.getDistributionAddresses(networkName);
const exemptSlots = addresses.getExemptSlots(networkName);
const dexAddrs = addresses.getDexAddresses(networkName);

console.log('DEV wallet:', distAddrs.dev);
console.log('Router:', dexAddrs.router);
```

#### Използване в тестове:
```javascript
const addresses = require('../config/addresses');

// За mainnet адресите
const MAINNET_ADDRESSES = addresses.bscMainnet.distribution;
const DEV_WALLET = MAINNET_ADDRESSES.dev;
```

## Helper Функции

### getNetworkAddresses(networkName)
Връща всички адреси за конкретна мрежа.

```javascript
const allAddrs = addresses.getNetworkAddresses('bscMainnet');
// { distribution: {...}, exemptSlots: [...], dex: {...} }
```

### getDistributionAddresses(networkName)
Връща само distribution адресите.

```javascript
const distAddrs = addresses.getDistributionAddresses('bscMainnet');
// { dev: '0x567...', marketing: '0x58e...', team: '0x630...', advisor: '0x8d9...' }
```

### getExemptSlots(networkName)
Връща масив с 4 exempt slot адреса.

```javascript
const slots = addresses.getExemptSlots('bscMainnet');
// ['0x000...', '0x000...', '0x000...', '0x000...']
```

### getDexAddresses(networkName)
Връща DEX адресите (router, factory, WBNB).

```javascript
const dex = addresses.getDexAddresses('bscMainnet');
// { router: '0x10E...', factory: '0xcA1...', wbnb: '0xbb4...' }
```

### isExemptSlot(networkName, address)
Проверява дали даден адрес е в exempt slots.

```javascript
const isExempt = addresses.isExemptSlot('bscMainnet', '0x123...');
// true или false
```

## Промяна на Адреси

⚠️ **ВАЖНО**: Всички адреси се променят само в `config/addresses.js`!

### Преди Mainnet Deploy:

1. Отворете `config/addresses.js`
2. Намерете секцията `bscMainnet.exemptSlots`
3. Заменете `ZeroAddress` с реалните exempt адреси:

```javascript
bscMainnet: {
  exemptSlots: [
    "0xYourSecureAddress1",  // Slot 1 - ВАЖЕН адрес
    "0xYourSecureAddress2",  // Slot 2 - ВАЖЕН адрес
    "0x0000000000000000000000000000000000000000", // Slot 3 - Резервен
    "0x0000000000000000000000000000000000000000"  // Slot 4 - Резервен
  ]
}
```

### След Deploy:

1. Актуализирайте `tokenAddress` в `config/networks.js`:

```javascript
bscMainnet: {
  tokenAddress: "0xYourNewTokenAddress"
}
```

## Проверка на Конфигурацията

Преди deploy на mainnet, проверете всички адреси:

```bash
# Проверка на конфигурацията
node -e "const a = require('./config/addresses'); console.log(JSON.stringify(a.bscMainnet, null, 2))"
```

## Тестване

Тестовете автоматично използват адресите от `addresses.js`:

```bash
# Всички тестове ще използват централизираните адреси
npx hardhat test
```

## Контрол Версии

✅ **Файлове под контрол**:
- `config/addresses.js` - ГЛАВЕН ФАЙЛ
- `config/networks.js` - използва addresses.js
- `config/exempts-slots.js` - DEPRECATED, препраща към addresses.js

❌ **Не хардкодвайте адреси в**:
- Тестови файлове
- Скриптове за deploy
- Други конфигурационни файлове

## Миграция от Стари Файлове

Ако имате код, който използва старите файлове:

### Преди:
```javascript
const exemptSlots = require('./config/exempts-slots');
const slots = exemptSlots.bscMainnet;
```

### Сега (препоръчително):
```javascript
const addresses = require('./config/addresses');
const slots = addresses.getExemptSlots('bscMainnet');
```

### Или (за обратна съвместимост):
```javascript
const exemptSlots = require('./config/exempts-slots');
const slots = exemptSlots.bscMainnet; // Работи, но е deprecated
```

## Подкрепа и Въпроси

При въпроси или проблеми с адресите:
1. Проверете `config/addresses.js` - това е единственият authoritative източник
2. Всички адреси трябва да са 42 символа (0x + 40 hex символа)
3. ZeroAddress е валиден само за тестване, НЕ за mainnet

---

**Последна актуализация**: Ноември 2025
**Версия**: 1.0
