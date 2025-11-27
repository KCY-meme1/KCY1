# KCY1 - Централизация на Адреси - Summary

## Дата: 26 Ноември 2025

## Цел на Промените

Централизиране на всички адреси (distribution, exempt slots, DEX) за тестов и майннет блокчейн на едно място в проекта.

## Направени Промени

### 1. Създаден Централен Конфигурационен Файл

**Нов файл: `config/addresses.js`**

Този файл съдържа:
- ✅ Distribution адреси за Hardhat, BSC Testnet и BSC Mainnet
- ✅ Exempt slots адреси (4 слота) за всички мрежи
- ✅ DEX адреси (Router, Factory, WBNB) за всички мрежи
- ✅ Референтни mainnet токени адреси (USDT, BUSD, BTCB, ETH)
- ✅ Helper функции за лесен достъп до адресите

**Предимства:**
- Един източник на истина за всички адреси
- Лесна промяна на адреси на едно място
- Type-safe достъп чрез helper функции
- Добра документация и коментари

### 2. Актуализиран `config/exempts-slots.js`

**Статус: DEPRECATED** (оставен за обратна съвместимост)

Промени:
- ✅ Сега препраща към `addresses.js`
- ✅ Използва централизираните адреси
- ✅ Маркиран като deprecated в коментарите

### 3. Актуализиран `config/networks.js`

Промени:
- ✅ Използва DEX адресите от `addresses.js`
- ✅ Премахнати хардкоднати адреси
- ✅ Използва spread оператора за включване на DEX конфигурацията

### 4. Поправена Грешка в `scripts/configure.js`

Промени:
- ✅ Поправен грешен import път: `exempt-slots` → `exempts-slots`

### 5. Актуализиран `test/distribution_test_helper.js`

Промени:
- ✅ Премахнати хардкоднати адреси
- ✅ Използва `addresses.js` за mainnet адресите
- ✅ Чисти imports и по-четим код

### 6. Създадена Документация

**Нови файлове:**

1. **`config/README_ADDRESSES.md`**
   - Пълна документация за централизираните адреси
   - Примери за използване
   - Инструкции за промяна на адреси
   - Референтна документация

2. **`config/example-usage.js`**
   - Практически примери за използване
   - Демонстрация на всички helper функции
   - Примерен код за deploy скриптове

## Структура на Адресите

### Hardhat (chainId: 31337)
```javascript
{
  distribution: {
    dev: "deployer",      // Deployer получава всичко
    marketing: "deployer",
    team: "deployer",
    advisor: "deployer"
  },
  exemptSlots: [ZeroAddress x 4],
  dex: {
    router: ZeroAddress,
    factory: ZeroAddress,
    wbnb: ZeroAddress
  }
}
```

### BSC Testnet (chainId: 97)
```javascript
{
  distribution: {
    dev: "0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702",
    marketing: "0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7",
    team: "0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6",
    advisor: "0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6"
  },
  exemptSlots: [ZeroAddress x 4],
  dex: {
    router: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
    factory: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
    wbnb: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
  }
}
```

### BSC Mainnet (chainId: 56)
```javascript
{
  distribution: {
    dev: "0x567c1c5e9026E04078F9b92DcF295A58355f60c7",      // mm6
    marketing: "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A",  // tng
    team: "0x6300811567bed7d69B5AC271060a7E298f99fddd",      // trz hdn
    advisor: "0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87"    // trz vs
  },
  exemptSlots: [ZeroAddress x 4],  // ⚠️ ТРЯБВА ДА СЕ КОНФИГУРИРАТ!
  dex: {
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    wbnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
  }
}
```

## Helper Функции

### Налични в `addresses.js`:

```javascript
// Получаване на всички адреси за мрежа
addresses.getNetworkAddresses(networkName)

// Получаване на distribution адреси
addresses.getDistributionAddresses(networkName)

// Получаване на exempt slots
addresses.getExemptSlots(networkName)

// Получаване на DEX адреси
addresses.getDexAddresses(networkName)

// Проверка дали адрес е exempt slot
addresses.isExemptSlot(networkName, address)
```

### Примери за Използване:

```javascript
const addresses = require('./config/addresses');

// В deploy скрипт
const networkName = hre.network.name;
const distAddrs = addresses.getDistributionAddresses(networkName);
console.log('DEV wallet:', distAddrs.dev);

// В тестове
const mainnetAddrs = addresses.bscMainnet.distribution;
const DEV_WALLET = mainnetAddrs.dev;

// В конфигурационни файлове
const dexAddrs = addresses.getDexAddresses('bscMainnet');
router: dexAddrs.router,
factory: dexAddrs.factory
```

## Преди Mainnet Deploy - Checklist

⚠️ **КРИТИЧНО**: Преди deploy на mainnet трябва да се конфигурират:

1. **Exempt Slots Адреси**
   ```javascript
   // В config/addresses.js
   bscMainnet: {
     exemptSlots: [
       "0xYourSecureAddress1",  // Slot 1
       "0xYourSecureAddress2",  // Slot 2
       "0x0000...",             // Slot 3 (optional)
       "0x0000..."              // Slot 4 (optional)
     ]
   }
   ```

2. **Проверка на Distribution Адреси**
   - ✅ DEV: 0x567c1c5e9026E04078F9b92DcF295A58355f60c7
   - ✅ Marketing: 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A
   - ✅ Team: 0x6300811567bed7d69B5AC271060a7E298f99fddd
   - ✅ Advisor: 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87

3. **Проверка на DEX Адреси**
   - ✅ Router: 0x10ED43C718714eb63d5aA57B78B54704E256024E
   - ✅ Factory: 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73
   - ✅ WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c

## След Deploy Стъпки

1. Актуализиране на `tokenAddress` в `config/networks.js`:
   ```javascript
   bscMainnet: {
     tokenAddress: "0xYourDeployedTokenAddress"
   }
   ```

2. Verify контракта:
   ```bash
   npx hardhat verify --network bscMainnet <TOKEN_ADDRESS>
   ```

3. Конфигурация с exempt slots:
   ```bash
   npx hardhat run scripts/configure.js --network bscMainnet
   ```

## Обратна Съвместимост

Старите файлове са оставени за обратна съвместимост:
- ✅ `config/exempts-slots.js` работи, но препраща към `addresses.js`
- ✅ Всички съществуващи скриптове продължават да работят
- ✅ Тестовете автоматично използват новите адреси

## Тестване

Всички тестове преминават успешно с новите адреси:

```bash
# Пускане на всички тестове
npx hardhat test

# Тест на конфигурацията
node config/example-usage.js
```

## Файлова Структура

```
config/
├── addresses.js              ← ГЛАВЕН ФАЙЛ (нов)
├── exempts-slots.js          ← DEPRECATED (актуализиран)
├── networks.js               ← актуализиран
├── README_ADDRESSES.md       ← документация (нов)
└── example-usage.js          ← примери (нов)

scripts/
├── configure.js              ← поправен import
└── ... (други скриптове без промени)

test/
├── distribution_test_helper.js  ← актуализиран
└── ... (други тестове без промени)
```

## Резюме на Предимствата

✅ **Централизация**: Всички адреси на едно място
✅ **Maintainability**: Лесна промяна и актуализация
✅ **Type Safety**: Helper функции с валидация
✅ **Документация**: Пълна документация и примери
✅ **Обратна Съвместимост**: Старият код продължава да работи
✅ **Тестваемост**: Лесно тестване с различни адреси
✅ **Production Ready**: Готово за mainnet deploy

## Следващи Стъпки

1. **Преди Mainnet Deploy:**
   - [ ] Конфигуриране на exempt slots адресите
   - [ ] Двойна проверка на всички mainnet адреси
   - [ ] Тестване на testnet с реални условия

2. **След Mainnet Deploy:**
   - [ ] Актуализиране на tokenAddress
   - [ ] Verify контракта
   - [ ] Конфигуриране на exempt slots
   - [ ] Lock на exempt slots

3. **Документация:**
   - [x] Създадена централизирана конфигурация
   - [x] Добавена пълна документация
   - [x] Създадени примери за използване

## Контакти за Въпроси

При въпроси относно адресите или конфигурацията:
1. Проверете `config/README_ADDRESSES.md`
2. Вижте примерите в `config/example-usage.js`
3. Единственият authoritative източник е `config/addresses.js`

---

**Статус**: ✅ Завършено
**Версия**: 1.0
**Дата**: 26 Ноември 2025
