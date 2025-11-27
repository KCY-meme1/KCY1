<!-- @version v35 -->

# Exempt Slots = Distribution Addresses

## Какво Беше Променено (v35)

### Преди (v34)
```javascript
// config/addresses.js
exemptSlots: [
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000"
]

// contracts/kcy-meme-1.sol
eAddr1 = address(0);
eAddr2 = address(0);
eAddr3 = address(0);
eAddr4 = address(0);
```

### След (v35)
```javascript
// config/addresses.js
exemptSlots: [
  "0x567c1c5e9026E04078F9b92DcF295A58355f60c7",  // Same as DEV
  "0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A",  // Same as Marketing
  "0x6300811567bed7d69B5AC271060a7E298f99fddd",  // Same as Team
  "0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87"   // Same as Advisor
]

// contracts/kcy-meme-1.sol
eAddr1 = DEVw_mv;      // Same as DEV wallet
eAddr2 = Mw_tng;       // Same as Marketing wallet
eAddr3 = Tw_trz_hdn;   // Same as Team wallet
eAddr4 = Aw_trzV;      // Same as Advisor wallet
```

## Защо Тази Промяна?

### Логика
Distribution адресите ТРЯБВА да имат exempt статус защото:
1. **DEV wallet** трябва да може да добавя ликвидност без ограничения
2. **Marketing/Team/Advisor** трябва да получават токените си без fees
3. Те трябва да могат да трансферират без cooldown периоди

### Преимущества
- ✅ **Без fees** за distribution адресите
- ✅ **Без лимити** за тях
- ✅ **Логично** - distribution адресите са exempt по дефиниция
- ✅ **Синхронизирано** - addresses.js и контрактът са еднакви

## Адреси по Мрежи

### BSC Mainnet (chainId: 56)
```
Distribution & Exempt Slots:
  [1] DEV:       0x567c1c5e9026E04078F9b92DcF295A58355f60c7 (mm6)
  [2] Marketing: 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A (tng)
  [3] Team:      0x6300811567bed7d69B5AC271060a7E298f99fddd (trz hdn)
  [4] Advisor:   0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87 (trz vs)
```

### BSC Testnet (chainId: 97)
```
Distribution & Exempt Slots:
  [1] DEV:       0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702
  [2] Marketing: 0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7
  [3] Team:      0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6
  [4] Advisor:   0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6
```

### Hardhat (chainId: 31337)
```
Distribution & Exempt Slots:
  [1-4] All: msg.sender (deployer)
```

## Файлове Променени

### 1. config/addresses.js
**Версия**: v34 → v35

**Промени:**
- Exempt slots за всички мрежи са същите като distribution адресите
- Премахнати ZeroAddress стойности

### 2. contracts/kcy-meme-1.sol
**Версия**: v34 → v35

**Промени:**
- Constructor инициализира exempt slots с distribution адресите:
  ```solidity
  eAddr1 = DEVw_mv;
  eAddr2 = Mw_tng;
  eAddr3 = Tw_trz_hdn;
  eAddr4 = Aw_trzV;
  ```
- Актуализирана документация в @dev коментарите

## Проверка

### Проверка на addresses.js
```bash
node config/example-usage.js
```

**Очакван резултат:**
```
Mainnet Exempt Slots:
  Slot 1: 0x567c1c5e9026E04078F9b92DcF295A58355f60c7  (DEV)
  Slot 2: 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A  (Marketing)
  Slot 3: 0x6300811567bed7d69B5AC271060a7E298f99fddd  (Team)
  Slot 4: 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87  (Advisor)
```

### Проверка на контракта
```bash
npx hardhat test
```

**Exempt адресите в deploy:**
- След deploy, eAddr1-4 ще бъдат същите като DEV, Marketing, Team, Advisor

## Имплементация в Контракта

### Constructor Logic
```solidity
// Distribution addresses
DEVw_mv = block.chainid == 31337 ? msg.sender : 
          (block.chainid == 97 ? 0xCBfA... : 0x567c...);

Mw_tng = block.chainid == 31337 ? msg.sender :
         (block.chainid == 97 ? 0x67eD... : 0x58ec...);

Tw_trz_hdn = block.chainid == 31337 ? msg.sender :
             (block.chainid == 97 ? 0xD1a7... : 0x6300...);

Aw_trzV = block.chainid == 31337 ? msg.sender :
          (block.chainid == 97 ? 0xD1a7... : 0x8d95...);

// Exempt slots = Distribution addresses
eAddr1 = DEVw_mv;
eAddr2 = Mw_tng;
eAddr3 = Tw_trz_hdn;
eAddr4 = Aw_trzV;
```

## Ефекти

### За Distribution Адресите
```
✅ NO transaction fees (0%)
✅ NO transaction limits (unlimited)
✅ NO cooldown periods
✅ CAN add/remove liquidity directly
✅ CAN transfer to anyone without restrictions
```

### За Normal Users
```
✓ 0.08% fees
✓ 2,000 token max per transaction
✓ 2 hour cooldown
✓ 4,000 token max wallet
```

### Специално: Exempt → Normal User
```
✓ 0.08% fees (SAME as normal)
✓ 100 token max (stricter than normal)
✓ 24 hour cooldown (stricter than normal)
```

## Важни Бележки

1. **Автоматично**: Exempt slots се инициализират автоматично в constructor
2. **Immutable**: След deploy, тези адреси НЕ МОГАТ да се променят (освен ако не са locked)
3. **Синхронизация**: addresses.js и контрактът са 100% синхронизирани
4. **Тестване**: Задължително тествайте на testnet преди mainnet deploy

## Миграция

### Ако Deploy-нете Стар Контракт (v34)
```
⚠️ Exempt slots ще бъдат address(0)
⚠️ Ще трябва РЪЧНО да ги конфигурирате след deploy
```

### С Нов Контракт (v35)
```
✅ Exempt slots автоматично = Distribution адреси
✅ Готово за production веднага след deploy
```

## Статус

- **Версия**: v35
- **Дата**: 26 Ноември 2025
- **Статус**: ✅ Готово за тестване
- **Следваща стъпка**: Deploy на testnet за проверка

---

**Важно:** Exempt slots = Distribution addresses е ЛОГИЧНИЯТ подход за този проект!
