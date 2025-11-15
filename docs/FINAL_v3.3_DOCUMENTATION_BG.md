# KCY1 Token v3.3 FINAL - Документация

## 🎯 Финална Структура на Разпределението

### Преименувани Портфейли

| Старо Име | Ново Име | Адрес | Количество |
|-----------|----------|-------|------------|
| DEV_WALLET | **DEV_WALLET_mm_vis** | 0x567c1c5e9026E04078F9b92DcF295A58355f60c7 | 600,000 → остават 100,000 след distribution |
| MARKETING_WALLET | **MARKETING_WALLET_tng** | 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A | 150,000 |
| TEAM_WALLET | **TEAM_WALLET_trz_hdn** | 0x6300811567bed7d69B5AC271060a7E298f99fddd | 200,000 |
| ADVISOR_WALLET | **ADVISOR_WALLET_trz_vis** | 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87 | 150,000 |
| ~~COMMUNITY_WALLET~~ | ❌ **ПРЕМАХНАТ** | - | - |

---

## 🔄 Нова Логика на Разпределението

### При Deployment (Constructor):

```
TOTAL SUPPLY: 1,000,000 токена
├─ DEV_WALLET_mm_vis: 600,000 токена (60%)
└─ Contract address:  400,000 токена (40%)
```

**Важно:** Вече DEV_WALLET_mm_vis получава токените директно, **НЕ owner-ът!**

### При Натискане на Distribution Бутона:

Функцията `distributeInitialAllocations()` прехвърля **ОТ DEV_WALLET_mm_vis**:

```
DEV_WALLET_mm_vis (600,000 токена)
├─ MARKETING_WALLET_tng:     150,000 токена
├─ TEAM_WALLET_trz_hdn:      200,000 токена
├─ ADVISOR_WALLET_trz_vis:   150,000 токена
└─ Остават в DEV_WALLET_mm_vis: 100,000 токена ✅
```

**Общо разпределени:** 500,000 токена  
**Остават в DEV_WALLET_mm_vis:** 100,000 токена (автоматично, без self-transfer)

---

## 📊 Визуализация на Потока

### Deployment Момент:
```
[Mint 1,000,000 KCY1]
         │
         ├──► DEV_WALLET_mm_vis: 600,000 токена
         └──► Contract: 400,000 токена
```

### След Distribution:
```
[DEV_WALLET_mm_vis: 600,000 токена]
         │
         ├──► MARKETING_WALLET_tng: 150,000 токена
         ├──► TEAM_WALLET_trz_hdn: 200,000 токена
         ├──► ADVISOR_WALLET_trz_vis: 150,000 токена
         └──► [Остават в DEV_WALLET_mm_vis: 100,000 токена]
```

---

## ⚙️ Технически Детайли

### Константи:

```solidity
// Main distribution wallet
address private constant DEV_WALLET_mm_vis = 0x567c1c5e9026E04078F9b92DcF295A58355f60c7;

// Recipients
address private constant MARKETING_WALLET_tng = 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A;
uint256 private constant MARKETING_ALLOCATION = 150_000 * 10**18;

address private constant TEAM_WALLET_trz_hdn = 0x6300811567bed7d69B5AC271060a7E298f99fddd;
uint256 private constant TEAM_ALLOCATION = 200_000 * 10**18;

address private constant ADVISOR_WALLET_trz_vis = 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87;
uint256 private constant ADVISOR_ALLOCATION = 150_000 * 10**18;

// Total to distribute FROM DEV_WALLET_mm_vis
uint256 private constant TOTAL_DISTRIBUTION = 500_000 * 10**18;
```

### Constructor Промени:

```solidity
// СТАРО (v3.2):
balanceOf[owner] = 600_000 * 10**decimals;
balanceOf[address(this)] = 400_000 * 10**decimals;

// НОВО (v3.3):
balanceOf[DEV_WALLET_mm_vis] = 600_000 * 10**decimals;
balanceOf[address(this)] = 400_000 * 10**decimals;
```

### Distribution Function:

```solidity
function distributeInitialAllocations() external onlyOwner {
    require(!initialDistributionCompleted, "Distribution already completed");
    require(balanceOf[DEV_WALLET_mm_vis] >= TOTAL_DISTRIBUTION, "Insufficient balance");
    
    initialDistributionCompleted = true;
    
    // Transfer from DEV_WALLET_mm_vis to MARKETING
    balanceOf[DEV_WALLET_mm_vis] -= MARKETING_ALLOCATION;
    balanceOf[MARKETING_WALLET_tng] += MARKETING_ALLOCATION;
    emit Transfer(DEV_WALLET_mm_vis, MARKETING_WALLET_tng, MARKETING_ALLOCATION);
    
    // Transfer from DEV_WALLET_mm_vis to TEAM
    balanceOf[DEV_WALLET_mm_vis] -= TEAM_ALLOCATION;
    balanceOf[TEAM_WALLET_trz_hdn] += TEAM_ALLOCATION;
    emit Transfer(DEV_WALLET_mm_vis, TEAM_WALLET_trz_hdn, TEAM_ALLOCATION);
    
    // Transfer from DEV_WALLET_mm_vis to ADVISOR
    balanceOf[DEV_WALLET_mm_vis] -= ADVISOR_ALLOCATION;
    balanceOf[ADVISOR_WALLET_trz_vis] += ADVISOR_ALLOCATION;
    emit Transfer(DEV_WALLET_mm_vis, ADVISOR_WALLET_trz_vis, ADVISOR_ALLOCATION);
    
    // DEV_WALLET_mm_vis automatically keeps remaining 100,000 tokens
    // No self-transfer needed!
    
    emit InitialDistributionCompleted(TOTAL_DISTRIBUTION);
}
```

---

## 🎯 Ключови Промени от v3.2 → v3.3

### 1. Премахнат COMMUNITY_WALLET
- ❌ Напълно изтрит от кода
- ❌ Няма повече COMMUNITY_ALLOCATION
- ❌ Няма повече проверка за community wallet в distribution

### 2. Преименувани Портфейли
- ✅ DEV_WALLET → DEV_WALLET_mm_vis
- ✅ MARKETING_WALLET → MARKETING_WALLET_tng
- ✅ TEAM_WALLET → TEAM_WALLET_trz_hdn
- ✅ ADVISOR_WALLET → ADVISOR_WALLET_trz_vis

### 3. Променена Deployment Логика
- **СТАРО:** 600,000 токена → owner
- **НОВО:** 600,000 токена → DEV_WALLET_mm_vis

### 4. Променена Distribution Логика
- **СТАРО:** От contract (400,000) → разпределение
- **НОВО:** От DEV_WALLET_mm_vis (600,000) → разпределение (500,000)
- **НОВО:** DEV_WALLET_mm_vis задържа 100,000 автоматично

### 5. Без Self-Transfer
- **СТАРО:** DEV_WALLET получаваше трансфер от contract към себе си
- **НОВО:** DEV_WALLET_mm_vis просто задържа останалите токени, без self-transfer

---

## 📋 Deployment Инструкции

### Преди Deployment:
1. ✅ Всички адреси са зададени правилно (вече са въведени)
2. ✅ Портфейлите са преименувани
3. ✅ COMMUNITY_WALLET е премахнат
4. ✅ Готово за deployment!

### След Deployment:

**Стъпка 1:** Провери баланси
```javascript
// DEV_WALLET_mm_vis трябва да има 600,000 токена
await contract.balanceOf("0x567c1c5e9026E04078F9b92DcF295A58355f60c7")
// Очаквано: 600000000000000000000000

// Contract трябва да има 400,000 токена
await contract.balanceOf(contractAddress)
// Очаквано: 400000000000000000000000
```

**Стъпка 2:** Извикай Distribution
```javascript
// Като owner
await contract.distributeInitialAllocations()
```

**Стъпка 3:** Провери разпределението
```javascript
// MARKETING_WALLET_tng трябва да има 150,000
await contract.balanceOf("0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A")
// Очаквано: 150000000000000000000000

// TEAM_WALLET_trz_hdn трябва да има 200,000
await contract.balanceOf("0x6300811567bed7d69B5AC271060a7E298f99fddd")
// Очаквано: 200000000000000000000000

// ADVISOR_WALLET_trz_vis трябва да има 150,000
await contract.balanceOf("0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87")
// Очаквано: 150000000000000000000000

// DEV_WALLET_mm_vis трябва да има 100,000 (останали)
await contract.balanceOf("0x567c1c5e9026E04078F9b92DcF295A58355f60c7")
// Очаквано: 100000000000000000000000
```

**Стъпка 4:** Настрой Exempt Addresses (ако е нужно)
```javascript
await contract.updateExemptAddresses(
    [addr1, addr2, addr3, addr4, addr5],
    pancakeswapRouter,
    pancakeswapFactory
)
```

**Стъпка 5:** Lock Exempt Addresses (опционално)
```javascript
await contract.lockExemptAddressesForever()
```

---

## 💡 Често Срещани Въпроси

### В: Защо DEV_WALLET_mm_vis получава 600,000 вместо owner?
**О:** Това опростява логиката - DEV_WALLET_mm_vis е основният разпределителен портфейл, откъдето се изпращат токените. Той действа като централен hub.

### В: Какво става с owner-а?
**О:** Owner остава като контролен адрес с administrative права (pause, blacklist, exempt settings), но не получава токени при deployment.

### В: Защо COMMUNITY_WALLET е премахнат?
**О:** Не е необходим в текущата структура. Всички нужни портфейли са покрити с останалите 4.

### В: Може ли owner да вземе токени след това?
**О:** Да, може да използва `withdrawCirculationTokens()` за да изтегли токени от contract-а (400,000), но НЕ може да докосне токените в DEV_WALLET_mm_vis (освен ако няма private key за този адрес).

### В: DEV_WALLET_mm_vis exempt ли е?
**О:** НЕ автоматично! За да го направите exempt, трябва да го добавите в един от 5-те exempt slots чрез `updateExemptAddresses()`.

---

## 📊 Финална Таблица на Разпределението

| Портфейл | Адрес | При Deployment | След Distribution |
|----------|-------|----------------|-------------------|
| DEV_WALLET_mm_vis | 0x567c...f60c7 | 600,000 | 100,000 |
| MARKETING_WALLET_tng | 0x58ec...E28A | 0 | 150,000 |
| TEAM_WALLET_trz_hdn | 0x6300...fddd | 0 | 200,000 |
| ADVISOR_WALLET_trz_vis | 0x8d95...8b87 | 0 | 150,000 |
| Contract | contract address | 400,000 | 400,000 |
| **ОБЩО** | - | **1,000,000** | **1,000,000** |

---

## ✅ Checklist за Production

- [x] COMMUNITY_WALLET премахнат
- [x] Портфейлите преименувани правилно
- [x] DEV_WALLET_mm_vis получава 600,000 при deployment
- [x] Distribution изпраща ОТ DEV_WALLET_mm_vis
- [x] DEV_WALLET_mm_vis задържа 100,000 без self-transfer
- [x] Всички адреси валидни и проверени
- [x] TOTAL_DISTRIBUTION = 500,000 (не 600,000)
- [x] Pause и Blacklist не важат за exempt
- [x] Exempt→Normal ограничения (100 токена, 24h)

---

**Версия:** 3.3 FINAL  
**Статус:** ✅ Production Ready  
**Дата:** 2025  
**Препоръка:** Използвай тази версия за окончателен deployment
