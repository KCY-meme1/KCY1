<!-- @version v34 -->

# Адреси в Контракта vs Config Файлове

## Преглед

Този документ показва съответствието между адресите хардкоднати в Solidity контракта (`contracts/kcy-meme-1.sol`) и адресите дефинирани в конфигурационните файлове (`config/addresses.js`).

## ⚠️ ВАЖНО

Адресите в контракта са **hardcoded** в конструктора и се определят автоматично на база `block.chainid`. След deployment на контракта, тези адреси **НЕ МОГАТ ДА СЕ ПРОМЕНЯТ**.

Файлът `config/addresses.js` служи като:
1. **Референтен източник** за документация
2. **Източник на адреси** за скриптове и тестове
3. **Източник на истина** преди deployment

## Адреси в Контракта

### Код в Constructor (lines 180-193)

```solidity
// Distribution Addresses
DEVw_mv = block.chainid == 31337 ? msg.sender : 
          (block.chainid == 97 ? 0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702 : 0x567c1c5e9026E04078F9b92DcF295A58355f60c7);

Mw_tng = block.chainid == 31337 ? msg.sender :
         (block.chainid == 97 ? 0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7 : 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A);

Tw_trz_hdn = block.chainid == 31337 ? msg.sender :
             (block.chainid == 97 ? 0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6 : 0x6300811567bed7d69B5AC271060a7E298f99fddd);

Aw_trzV = block.chainid == 31337 ? msg.sender :
          (block.chainid == 97 ? 0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6 : 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87);

// DEX Addresses
pncswpRouter = block.chainid == 97 ? 0xD99D1c33F9fC3444f8101754aBC46c52416550D1 : 0x10ED43C718714eb63d5aA57B78B54704E256024E;
pncswpFactory = block.chainid == 97 ? 0x6725F303b657a9451d8BA641348b6761A6CC7a17 : 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
```

## Съответствие с Config Файлове

### Hardhat (chainId: 31337)

| Wallet | Contract Value | addresses.js | Match |
|--------|---------------|--------------|-------|
| DEV | `msg.sender` | `"deployer"` | ✅ |
| Marketing | `msg.sender` | `"deployer"` | ✅ |
| Team | `msg.sender` | `"deployer"` | ✅ |
| Advisor | `msg.sender` | `"deployer"` | ✅ |
| Router | N/A | `ZeroAddress` | ✅ |
| Factory | N/A | `ZeroAddress` | ✅ |

### BSC Testnet (chainId: 97)

| Wallet | Contract Address | addresses.js | Match |
|--------|-----------------|--------------|-------|
| DEV | `0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702` | `0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702` | ✅ |
| Marketing | `0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7` | `0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7` | ✅ |
| Team | `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` | `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` | ✅ |
| Advisor | `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` | `0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6` | ✅ |
| Router | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` | ✅ |
| Factory | `0x6725F303b657a9451d8BA641348b6761A6CC7a17` | `0x6725F303b657a9451d8BA641348b6761A6CC7a17` | ✅ |
| WBNB | N/A (not in constructor) | `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd` | ✅ |

### BSC Mainnet (chainId: 56)

| Wallet | Contract Address | addresses.js | Match |
|--------|-----------------|--------------|-------|
| DEV | `0x567c1c5e9026E04078F9b92DcF295A58355f60c7` | `0x567c1c5e9026E04078F9b92DcF295A58355f60c7` | ✅ |
| Marketing | `0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A` | `0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A` | ✅ |
| Team | `0x6300811567bed7d69B5AC271060a7E298f99fddd` | `0x6300811567bed7d69B5AC271060a7E298f99fddd` | ✅ |
| Advisor | `0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87` | `0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87` | ✅ |
| Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` | `0x10ED43C718714eb63d5aA57B78B54704E256024E` | ✅ |
| Factory | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` | ✅ |
| WBNB | N/A (not in constructor) | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` | ✅ |

## ✅ Резултат

**Всички адреси съвпадат на 100%!**

Файлът `config/addresses.js` е напълно синхронизиран с адресите в контракта.

## Защо Два Източника?

1. **Contract (Solidity)**:
   - Immutable след deployment
   - Source of truth ЗА deployed контракта
   - Не може да се променя

2. **config/addresses.js**:
   - Source of truth ПРЕДИ deployment
   - Използва се от скриптове и тестове
   - Лесно се променя и актуализира
   - Документационна референция

## Workflow

```
1. Промяна в addresses.js (ако е необходимо)
   ↓
2. Актуализиране на контракта (constructor addresses)
   ↓
3. Deploy на контракта
   ↓
4. Адресите в контракта стават immutable
   ↓
5. addresses.js остава за скриптове и документация
```

## Проверка на Синхронизация

Можете да проверите синхронизацията като:

1. Прегледате този документ
2. Сравните адресите в `contracts/kcy-meme-1.sol` (lines 180-193)
3. Сравните адресите в `config/addresses.js`

Или изпълнете:

```bash
# Извличане на адресите от контракта
grep -A 1 "chainid == 97\|chainid == 56" contracts/kcy-meme-1.sol

# Извеждане на адресите от config
node -e "const a = require('./config/addresses'); console.log(JSON.stringify(a.bscTestnet, null, 2)); console.log(JSON.stringify(a.bscMainnet, null, 2))"
```

## Важни Бележки

⚠️ **КРИТИЧНО**: При промяна на адреси:

1. **ПЪРВО** променете `config/addresses.js`
2. **СЛЕД ТОВА** актуализирайте контракта (constructor)
3. **ВИНАГИ** проверете че са синхронизирани преди deploy
4. **СЛЕД deploy** адресите в контракта са IMMUTABLE

## История на Промените

- **v34**: Създаване на този документ, валидиране на всички адреси
- Всички адреси са проверени и потвърдени като коректни

---

**Последна проверка**: 26 Ноември 2025
**Статус**: ✅ Всички адреси синхронизирани
**Версия**: v34
