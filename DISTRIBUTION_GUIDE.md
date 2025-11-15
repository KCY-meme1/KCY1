# 🚀 KCY1 Token - Automatic Distribution Guide

## 📦 Нова функционалност: Автоматично разпределение

Добавих функция за **автоматично разпределение** на токени към предварително зададени адреси. Това елиминира грешки и спестява gas fees.

---

## ⚙️ КАК РАБОТИ:

### 1. **ПРЕДИ DEPLOY - Промени адресите и сумите**

Отвори файла `KCY1Token_WITH_DISTRIBUTION.sol` и промени тези редове (ред 60-80):

```solidity
// ПРОМЕНИ ТЕЗИ АДРЕСИ И СУМИ!

// Marketing wallet - ще получи 50,000 токена
address private constant MARKETING_WALLET = 0xТвоят_Marketing_Адрес_Тук;
uint256 private constant MARKETING_ALLOCATION = 50_000 * 10**18;

// Team wallet - ще получи 30,000 токена
address private constant TEAM_WALLET = 0xТвоят_Team_Адрес_Тук;
uint256 private constant TEAM_ALLOCATION = 30_000 * 10**18;

// Development wallet - ще получи 20,000 токена
address private constant DEV_WALLET = 0xТвоят_Dev_Адрес_Тук;
uint256 private constant DEV_ALLOCATION = 20_000 * 10**18;

// Advisor wallet - ще получи 10,000 токена
address private constant ADVISOR_WALLET = 0xТвоят_Advisor_Адрес_Тук;
uint256 private constant ADVISOR_ALLOCATION = 10_000 * 10**18;

// Community wallet - ще получи 15,000 токена
address private constant COMMUNITY_WALLET = 0xТвоят_Community_Адрес_Тук;
uint256 private constant COMMUNITY_ALLOCATION = 15_000 * 10**18;
```

**Общо за разпределение: 125,000 токена** (от 400,000 в contract balance)

---

## 📋 СЛЕД DEPLOY - Процес на разпределение:

### Стъпка 1: Deploy контракта
```javascript
const KCY1Token = await ethers.getContractFactory("KCY1Token");
const token = await KCY1Token.deploy();
await token.waitForDeployment();
console.log("Token deployed to:", await token.getAddress());
```

### Стъпка 2: Провери конфигурацията
```javascript
// Провери дали адресите и сумите са правилни
const config = await token.getDistributionConfig();
console.log("Marketing:", config.marketing, "Amount:", config.marketingAmount);
console.log("Team:", config.team, "Amount:", config.teamAmount);
console.log("Dev:", config.dev, "Amount:", config.devAmount);
console.log("Advisor:", config.advisor, "Amount:", config.advisorAmount);
console.log("Community:", config.community, "Amount:", config.communityAmount);
console.log("Total to distribute:", config.totalAmount);
```

### Стъпка 3: Изпълни автоматичното разпределение
```javascript
// САМО ЕДИН ПЪТ! Не може да се повтори!
await token.distributeInitialAllocations();
console.log("Distribution completed!");
```

### Стъпка 4: (Опционално) Направи ги exempt адреси
```javascript
// Автоматично задава всички distribution wallets като exempt
await token.setDistributionWalletsAsExempt();
console.log("Distribution wallets set as exempt!");
```

### Стъпка 5: Lock exempt адресите (когато си готов)
```javascript
// ВНИМАНИЕ: НЕОБРАТИМО!
await token.lockExemptAddresses();
console.log("Exempt addresses locked forever!");
```

---

## 💰 РАЗПРЕДЕЛЕНИЕ НА ТОКЕНИТЕ:

| Получател | Адрес (промени!) | Сума | % от Contract |
|-----------|------------------|------|---------------|
| Owner | Deploy адрес | 600,000 | 60% от total |
| Contract | Самият контракт | 400,000 | 40% от total |
| **След distributeInitialAllocations():** |
| Marketing | Хардкоднат | 50,000 | 12.5% от contract |
| Team | Хардкоднат | 30,000 | 7.5% от contract |
| Development | Хардкоднат | 20,000 | 5% от contract |
| Advisor | Хардкоднат | 10,000 | 2.5% от contract |
| Community | Хардкоднат | 15,000 | 3.75% от contract |
| **Остава в contract:** | | 275,000 | 68.75% от contract |

---

## ✅ ПРЕДИМСТВА:

1. **Без грешки** - Адресите и сумите са хардкоднати
2. **Един клик** - Само извикваш `distributeInitialAllocations()`
3. **Gas ефективно** - Всичко в една транзакция
4. **Защита** - Може да се извика само веднъж
5. **Прозрачност** - Events за всяко разпределение

---

## ⚠️ ВАЖНИ БЕЛЕЖКИ:

### ЗАДЪЛЖИТЕЛНО:
1. **Промени адресите ПРЕДИ deploy** - Те са constants и не могат да се променят после!
2. **Тествай на testnet** първо
3. **Провери два пъти адресите** - няма връщане назад!

### НЕ ЗАБРАВЯЙ:
- Функцията `distributeInitialAllocations()` може да се извика **САМО ВЕДНЪЖ**
- След извикване, `initialDistributionCompleted` става `true` завинаги
- Ако адрес е `0x0` или сумата е 0, пропуска се

---

## 📝 ПРИМЕРЕН СЦЕНАРИЙ:

```javascript
// 1. Deploy
const token = await KCY1Token.deploy();

// 2. Провери баланси преди
console.log("Contract balance:", await token.balanceOf(contractAddress));
// Output: 400,000 tokens

// 3. Разпредели
await token.distributeInitialAllocations();

// 4. Провери баланси след
console.log("Marketing balance:", await token.balanceOf(MARKETING_WALLET));
// Output: 50,000 tokens

console.log("Contract balance:", await token.balanceOf(contractAddress));
// Output: 275,000 tokens (400k - 125k distributed)

// 5. Направи ги exempt (опционално)
await token.setDistributionWalletsAsExempt();

// 6. По-късно, когато си готов
await token.lockExemptAddresses();
```

---

## 🔥 PRO TIPS:

1. **Можеш да промениш сумите** - Просто редактирай константите
2. **Можеш да добавиш/премахнеш адреси** - Но трябва да промениш и функцията
3. **Можеш да използваш същите адреси за exempt** - Функцията `setDistributionWalletsAsExempt()` го прави автоматично
4. **Остатъкът остава в контракта** - 275,000 токена за liquidity и бъдещи нужди

---

## 📊 GAS ESTIMATES:

- `distributeInitialAllocations()`: ~150,000 gas (за 5 адреса)
- `setDistributionWalletsAsExempt()`: ~50,000 gas
- Спестяване: Вместо 5 отделни транзакции, всичко в една!

---

**Версия:** 3.0 с Auto-Distribution
**Статус:** Production Ready
**Препоръка:** Тествай на BSC Testnet първо!