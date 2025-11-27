<!-- @version v36 -->

# Централизирани Адреси - Пълна Интеграция

## 🎯 Как Работи

### Source of Truth
```
config/addresses.js (JavaScript)
         ↓
         ↓ node config/generate-solidity-addresses.js
         ↓
contracts/AddressConstants.sol (Solidity)
         ↓
         ↓ import "./AddressConstants.sol"
         ↓
contracts/kcy-meme-1.sol (Използва константите)
```

## 📁 Файлове

### 1. config/addresses.js
**Source of Truth** - Всички адреси са тук!

```javascript
module.exports = {
  bscTestnet: {
    distribution: {
      dev: "0xCBfA...",
      marketing: "0x67eD...",
      // ...
    },
    exemptSlots: [
      "0xCBfA...",  // Same as dev
      // ...
    ]
  }
}
```

### 2. contracts/AddressConstants.sol
**Генериран автоматично** от addresses.js

```solidity
library AddressConstants {
    address internal constant TESTNET_DEV = 0xCBfA...;
    address internal constant MAINNET_DEV = 0x567c...;
    // ...
}
```

**ВАЖНО**: НЕ редактирай ръчно! Генерирай с:
```bash
node config/generate-solidity-addresses.js
```

### 3. contracts/kcy-meme-1.sol
**Използва константите** от AddressConstants.sol

```solidity
import "./AddressConstants.sol";

constructor() {
    DEVw_mv = block.chainid == 97 ? 
        AddressConstants.TESTNET_DEV : 
        AddressConstants.MAINNET_DEV;
    
    exemptSlots[0] = block.chainid == 97 ?
        AddressConstants.TESTNET_DEV :
        AddressConstants.MAINNET_DEV;
}
```

## 🔄 Workflow при Промяна на Адреси

### Стъпка 1: Промени addresses.js
```javascript
// config/addresses.js
bscMainnet: {
  distribution: {
    dev: "0xNEW_ADDRESS",  // Променен адрес
    // ...
  }
}
```

### Стъпка 2: Генерирай AddressConstants.sol
```bash
node config/generate-solidity-addresses.js
```

Това автоматично ще:
- Прочете addresses.js
- Генерира нов AddressConstants.sol
- Запише го в contracts/

### Стъпка 3: Контрактът автоматично използва новите адреси
```solidity
// kcy-meme-1.sol вече използва новите адреси
// защото import-ва AddressConstants.sol
```

### Стъпка 4: Компилирай и Тествай
```bash
npx hardhat compile
npx hardhat test
```

## ✅ Предимства

### ✅ Един Source of Truth
- Всички адреси на едно място: `config/addresses.js`
- И JavaScript и Solidity използват същите адреси

### ✅ Няма Hardcoded Адреси
**Преди:**
```solidity
DEVw_mv = block.chainid == 97 ? 
    0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702 :  // Hardcoded!
    0x567c1c5e9026E04078F9b92DcF295A58355f60c7;
```

**Сега:**
```solidity
DEVw_mv = block.chainid == 97 ? 
    AddressConstants.TESTNET_DEV :  // От централен файл!
    AddressConstants.MAINNET_DEV;
```

### ✅ Лесна Промяна
1. Промени само `addresses.js`
2. Генерирай `AddressConstants.sol`
3. Готово!

### ✅ Синхронизация
- JavaScript скриптове → четат от `addresses.js`
- Solidity контракт → чете от `AddressConstants.sol` (генериран от `addresses.js`)
- Винаги синхронизирани!

## 📊 Текущи Адреси

### BSC Testnet (97)
```
Distribution = Exempt Slots:
  DEV:       0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702
  Marketing: 0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7
  Team:      0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6
  Advisor:   0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6
```

### BSC Mainnet (56)
```
Distribution = Exempt Slots:
  DEV:       0x567c1c5e9026E04078F9b92DcF295A58355f60c7
  Marketing: 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A
  Team:      0x6300811567bed7d69B5AC271060a7E298f99fddd
  Advisor:   0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87
```

## 🎓 За Разработчици

### Проверка на Адресите

**JavaScript:**
```javascript
const addresses = require('./config/addresses');
console.log(addresses.bscMainnet.distribution.dev);
// Output: 0x567c1c5e9026E04078F9b92DcF295A58355f60c7
```

**Solidity (след deploy):**
```solidity
// В теста:
console.log(token.DEVw_mv());
// Output: 0x567c1c5e9026E04078F9b92DcF295A58355f60c7
```

### Промяна на Exempt Slots

Exempt slots автоматично използват distribution адресите:

```javascript
// addresses.js
distribution: {
  dev: "0xNEW..."
},
exemptSlots: [
  "0xNEW...",  // Същият адрес!
]
```

## ⚠️ ВАЖНО

### НЕ Редактирай Ръчно
- ❌ НЕ редактирай `AddressConstants.sol` ръчно
- ✅ Винаги генерирай с `node config/generate-solidity-addresses.js`

### Винаги Регенерирай
След промяна на `addresses.js`:
```bash
node config/generate-solidity-addresses.js
```

### Exempt Slots = Distribution
Exempt slots винаги са същите като distribution адресите:
```javascript
exemptSlots: [
  distribution.dev,        // Slot 0
  distribution.marketing,  // Slot 1
  distribution.team,       // Slot 2
  distribution.advisor     // Slot 3
]
```

## 🎉 Резултат

```
✅ Централизация:        addresses.js е source of truth
✅ Автоматична генерация: AddressConstants.sol
✅ Няма hardcoded адреси: Използват се константи
✅ Синхронизация:         JS и Solidity винаги съвпадат
✅ Лесна промяна:         Само на едно място
✅ Exempt slots:          Автоматично = distribution
```

---

**Версия**: v36  
**Дата**: 26 Ноември 2025  
**Статус**: ✅ ПЪЛНА ЦЕНТРАЛИЗАЦИЯ
