НИКАКВИ Python script-а!!!!
НЕ ИЗПОЛЗВАЙ СКРИПТОВЕ, ЗА ДА ПРОМЕНЯШ ГЛОБАЛНО КОДА! ТОВА ЧЕСТО ВОДИ ДО МНОЖЕСТВО ГРЕШКИ
И ПОНЯКОГА МИНАВАЩИ ТЕСТОВЕ, А ВСЪЩНОСТ СЛУЧАЯ НЕ Е ИЗТЕСТВАН ПРАВИЛНО ЗАРАДИ ЕДНАКВО
НАНЕСЕНИ КОРЕКЦИИ НЕСЪОБРАЗЕНИ С КОНКРЕТНИЯ СЛУЧАЙ!!!

ТОЗИ ФАЙЛ Е ЗА ДА СЕ СЪОБРАЗЯВАШ С ПРАВИЛАТА, ТАКИВА КАКВИТО СА ТУК
АКО НЕЩО СИ НАПРАВИЛ И РАБОТИ, НЕ Е НУЖНО ДА ГЛЕДАШ ТЕЗИ СЛУЧАИ ТУК ВСЕКИ ПЪТ,
А САМО КОГАТО Е НЕОБХОДИМО

Правило за редактиране на кода и файловете от проекта:
във всеки файл слагаш версията на файла най-отгоре в първият коментар
версията не трябва да се повтаря никъде другаде във файла
Не сменяй имената на файловете, ако по някаква причина не съм ти казал!
Това е програмиране, поддържането на версиите на кода се прави от git или
друга програма подобна на subversion, а не чрез смяна на имената на файловете,
където да включваш версията в името на файла!!!

# ВЕРСИЯ 1 (ПО-СТАРА) - 01.01.2026

# KCY1 TOKEN - ПЪЛНИ ПРАВИЛА И ЛОГИКА

---

## ⚠️ КРИТИЧНО ВАЖНО:
1. **Owner = Exempt Slot!** Owner е част от exempt slots, НЕ е отделна категория!
2. **Multi-sig НЕ може да прави transfer!** Само UNlock функции и removeFromBlacklist!
3. **При PAUSE: ЩОМ ИМА NORMAL → БЛОКИРАН!**

Направи задължително обявяване на Owner в Exempt Slot, също че собственика не може да бъде
премахнат или изтрит от Exempt-Slots списъка.

---
## СЪЗДАВАНЕ НА ТОКЕНА: при създаването се извиква автоматично само PAUSE,
при това нормалните потребители не могат нищо да правят,
докато админ портфейлите сетват токени, трансферират, сетват адреси и прочие,
неща които са описани в правилата на PAUSE



## ТАБЛИЦА 1: PAUSE ПРАВИЛА

```
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┓
┃ Transfer Type   ┃ При PAUSE (48h)   ┃ При NORMAL        ┃
┣━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Exempt → Exempt    ┃ ✅ РАЗРЕШЕН    ┃ ✅ РАЗРЕШЕН      ┃
┃ Exempt → Normal    ┃ ❌ БЛОКИРАН    ┃ ✅ РАЗРЕШЕН      ┃
┃ Normal → Exempt    ┃ ❌ БЛОКИРАН    ┃ ✅ РАЗРЕШЕН      ┃
┃ Normal → Normal    ┃ ❌ БЛОКИРАН    ┃ ✅ РАЗРЕШЕН      ┃
┗━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━┛
```

**ЛОГИКА В CONTRACT:**
```solidity
bool isNormalTransaction = !fromExempt || !toExempt;
if (isNormalTransaction) {
    require(!isPaused(), "Paused");  // ✅ ПРАВИЛНО!
}
```

**ПРАВИЛО:** ЩОМ ИМА NORMAL В ТРАНЗАКЦИЯТА → БЛОКИРАН ПРИ PAUSE!
PAUSE() може да се вика колкото пъти искаме, никой не забранява
по време на пауза да се вика pause() !

---

## ТАБЛИЦА 2: COOLDOWN ПРАВИЛА

```
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Transfer Type   ┃ Cooldown на SENDER┃ Cooldown на RECEIVER┃
┣━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Exempt → Exempt ┃ ❌ НЯМА           ┃ ❌ НЯМА             ┃
┃ Exempt → Normal ┃ ⏰ 24h            ┃ ❌ НЯМА             ┃
┃ Normal → Exempt ┃ ⏰ 2h             ┃ ❌ НЯМА             ┃
┃ Normal → Normal ┃ ⏰ 2h             ┃ ❌ НЯМА             ┃
┗━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**КОНСТАНТИ:**
- `COOLDOWN = 2 hours` (7200 секунди)
- `EXEMPT_TO_NORMAL_COOLDOWN = 24 hours` (86400 секунди)

---

## ТАБЛИЦА 3: ЛИМИТИ

```
Търговия:
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┓
┃ Trade Type      ┃ Max Transaction┃ Max Wallet ┃
┃                 ┃                ┃ RECEIVER   ┃
┣━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━┫
┃ Router → Exempt ┃ ∞ БЕЗ ЛИМИТ    ┃ ∞ БЕЗ ЛИМИТ┃
┃ Router → Normal ┃ 2000 tokens    ┃ 4000 tokens┃
┃ Exempt → Router ┃ ∞ БЕЗ ЛИМИТ    ┃ ∞ БЕЗ ЛИМИТ┃
┃ Normal → Router ┃ 2000 tokens    ┃ ∞ БЕЗ ЛИМИТ┃
┗━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━┛
Прехвърляне/Трансфер:
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┓
┃ Transfer Type   ┃ Max Transaction   ┃ Max Wallet   ┃
┣━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━┫
┃ Exempt → Exempt ┃ ∞ БЕЗ ЛИМИТ       ┃ ∞ БЕЗ ЛИМИТ  ┃
┃ Exempt → Normal ┃ 100 tokens        ┃ 4000 tokens  ┃
┃ Normal → Exempt ┃ 2000 tokens       ┃ ∞ БЕЗ ЛИМИТ  ┃
┃ Normal → Normal ┃ 2000 tokens       ┃ 4000 tokens  ┃
┗━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━┛
```

**КОНСТАНТИ:**
- `EXEMPT_TO_NORMAL_LIMIT = 100 tokens`
- `MAX_TRANSACTION = 2000 tokens`
- `MAX_WALLET = 4000 tokens`

---

## ТАБЛИЦА 4: FEES

```
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Transfer Type   ┃ Fee (Burn + Owner)    ┃
┣━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Exempt → Exempt ┃ 0% (БЕЗ ТАКСА)        ┃
┃ Exempt → Normal ┃ 0.08% (0.03% + 0.05%) ┃
┃ Normal → Exempt ┃ 0.08% (0.03% + 0.05%) ┃
┃ Normal → Normal ┃ 0.08% (0.03% + 0.05%) ┃
┗━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**КОНСТАНТИ:**
- `BURN_FEE = 30` (0.03%)
- `OWNER_FEE = 50` (0.05%)
- `FEE_DENOMINATOR = 100000`
- **Total Fee = 80 / 100000 = 0.08%**

---

## ТАБЛИЦА 5: ФУНКЦИИ И PERMISSIONS

### Случай 5.0: Multi-Sig работи винаги независимо от зададени паузи или cooldown-и
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┓
┃ Функцията работи винаги с┃Multi-Sig ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━┃
┃ updateExemptSlot()       ┃ ✅ ДА    ┃
┃ updateDEXAddresses()     ┃ ✅ ДА    ┃
┃ setLiquidityPair()       ┃ ✅ ДА    ┃
┃ unlockExemptSlots()      ┃ ✅ ДА    ┃
┃ unlockDEXAddresses()     ┃ ✅ ДА    ┃
┃ unlockLiquidityP()       ┃ ✅ ДА    ┃
┃ setBlacklist()blacklist()┃ ✅ ДА    ┃
┃ removeFromBlacklist()    ┃ ✅ ДА    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━┛



### Случай 5.1: БЕЗ PAUSE (Normal Operation)
Trade:
┃ Exempt  ┃ ✅ ДА ┃
┃ Normal  ┃ ✅ ДА ┃
Transfer:
┃ Exempt → Exempt     ┃ ✅ ДА ┃
┃ Exempt → Normal     ┃ ✅ ДА ┃
┃ Normal → Exempt     ┃ ✅ ДА ┃
┃ Normal → Normal     ┃ ✅ ДА ┃
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━┓
┃ Функция                ┃Owner=Exempt┃ Normal┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━╋━━━━━━━━━┃
┃ transfer()             ┃ ✅ ДА      ┃ ✅ ДА ┃
┃ transferFrom()         ┃ ✅ ДА      ┃ ✅ ДА ┃
┃ approve()              ┃ ✅ ДА      ┃ ✅ ДА ┃
┃ pause()                ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ updateExemptSlot()     ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ updateDEXAddresses()   ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ setLiquidityPair()     ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ setBlacklist()blacklist┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ proposeMint()          ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ executeMint()          ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockExemptSlots()      ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockDEXAddresses()     ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockPairs()            ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ removeFromBlacklist()  ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockExemptSlots()    ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockDEXAddresses()   ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockLiquidityP()     ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━┻━━━━━━━━━┛
```
### Случай 5.2: ПРИ PAUSE (Create Token/Emergency/Security)
Trade:
┃ Exempt  ┃ ✅ ДА ┃
┃ Normal  ┃ ❌ НЕ ┃
Transfer:
┃ Exempt → Exempt     ┃ ✅ ДА ┃
┃ Exempt → Normal     ┃ ❌ НЕ ┃
┃ Normal → Exempt     ┃ ❌ НЕ ┃
┃ Normal → Normal     ┃ ❌ НЕ ┃
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━┓
┃ Функция                ┃Owner=Exempt┃ Normal┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━╋━━━━━━━━━┃
┃ transfer()             ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ transferFrom()         ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ approve()              ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ pause()                ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ updateExemptSlot()     ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ updateDEXAddresses()   ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ setLiquidityPair()     ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ setBlacklist()blacklist┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ proposeMint()          ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ executeMint()          ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockExemptSlots()      ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockDEXAddresses()     ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockPairs()            ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ removeFromBlacklist()  ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockExemptSlots()    ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockDEXAddresses()   ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockLiquidityP()     ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━┻━━━━━━━━━┛
```

### Случай 5.3: ПРИ ADMIN COOLDOWN (След updateExemptSlot/updateDEXAddresses/setLiquidityPair()) → Auto-pause 48h + Cooldown 48h
### ADMIN Cooldown 48h /проверка на админ действие/
Trade:
┃ Exempt  ┃ ❌ НЕ ┃
┃ Normal  ┃ ❌ НЕ ┃
Transfer:
┃ Exempt → Exempt     ┃ ❌ НЕ ┃
┃ Exempt → Normal     ┃ ❌ НЕ ┃
┃ Normal → Exempt     ┃ ❌ НЕ ┃
┃ Normal → Normal     ┃ ❌ НЕ ┃
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━┓
┃ Функция                ┃Owner=Exempt┃ Normal┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━╋━━━━━━━━━┃
┃ transfer()             ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ transferFrom()         ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ approve()              ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ pause()                ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ updateExemptSlot()     ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ updateDEXAddresses()   ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ setLiquidityPair()     ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ setBlacklist()blacklist┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ proposeMint()          ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ executeMint()          ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ lockExemptSlots()      ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockDEXAddresses()     ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ lockPairs()            ┃ ✅ ДА      ┃ ❌ НЕ ┃
┃ removeFromBlacklist()  ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockExemptSlots()    ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockDEXAddresses()   ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┃ unlockLiquidityP()     ┃ ❌ НЕ      ┃ ❌ НЕ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━┻━━━━━━━━━┛
```



**MODIFIERS:**
- `onlyAdmin`: Owner ИЛИ Exempt Slot (eAddr1-4)
- `onlyMultiSig`: САМО Multi-sig адрес (трябва да е exempt slot)

---

## ТАБЛИЦА 6: AUTO-PAUSE И COOLDOWN МЕХАНИЗМИ

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Функция              ┃ Ефект                                    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ updateExemptSlot()   ┃ NotExemptTradeTransferPausedUntil = +48h ┃
┃ updateDEXAddresses() ┃ mainAddressChangersCooldown = +48h       ┃
┃ setLiquidityPair()   ┃                                          ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ pause()              ┃ NotExemptTradeTransferPausedUntil = +48h ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**КАКВО БЛОКИРА mainAddressChangersCooldown:**
1. updateExemptSlot()
2. updateDEXAddresses()
3. setLiquidityPair()
4. proposeMint()
5. executeMint()

**ЛОГИКА:**
Всяка от трите функции (updateExemptSlot/updateDEX/setLiquidityPair) блокира ВСИЧКИ ТРИ + mint функциите за 48 часа!
След първо извикване на някоя от посочените функции (updateExemptSlot/updateDEX/setLiquidityPair) предизвиква
48 часа cooldown, ако не се извика някоя от тези функции чрез Multi-sig, то няма как да се получи повторно удължаване от
нови 48 часа cooldown, тъй като вече след първото извикване повторното им извикване е блокирано

---

## ТАБЛИЦА 7: ПРОМЕНЛИВИ

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Променлива                       ┃ Цел                              ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ NotExemptTradeTransferPausedUntil┃ Блокира trading на Normal users  ┃
┃ mainAddressChangersCooldown      ┃ Блокира address-changing функции ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

**ВАЖНО:**
- `NotExemptTradeTransferPausedUntil` блокира САМО transfers където участва Normal
- `mainAddressChangersCooldown` блокира admin функции

---

## DEPLOYMENT VS TESTS АНАЛИЗ

```
┏━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Параметър         ┃ При Deployment    ┃ При Tests (beforeEach)┃
┣━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Exempt slots      ┃ НЕ (constructor)  ┃ ДА (updateExemptSlot)┃
┃ DEX addresses     ┃ НЕ (constructor)  ┃ НЕ (може updateDEX)   ┃
┃ Liquidity pairs   ┃ НЕ (constructor)  ┃ НЕ (setLiquidityPair) ┃
┣━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Auto-pause при    ┃ НЕ (constructor)  ┃ ДА (updateExemptSlot)┃
┃ exempt slots      ┃                   ┃                       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ Auto-pause при    ┃ НЕ (constructor)  ┃ ДА (ако се променя)   ┃
┃ DEX               ┃                   ┃                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

# КЛЮЧОВИ ПРАВИЛА (ОБОБЩЕНИЕ)

## 1. КОЙ Е КОЙ?
- **Owner** = първият exempt slot (eAddr1 обикновено)
- **Exempt Slots** = eAddr1, eAddr2, eAddr3, eAddr4
- **Normal User** = всеки който НЕ е exempt
- **Multi-sig** = специален адрес, трябва да е exempt slot

## 2. PAUSE ЛОГИКА
```solidity
bool isNormalTransaction = !fromExempt || !toExempt;
if (isNormalTransaction) {
    require(!isPaused(), "Paused");
}
```
**Резултат:** Exempt → Exempt = OK, всичко друго = БЛОКИРАНО

## 3. AUTO-PAUSE МЕХАНИЗЪМ
Три функции задават auto-pause + cooldown:
1. updateExemptSlot()
2. updateDEXAddresses()
3. setLiquidityPair()

Всяка от тях:
- Задава `NotExemptTradeTransferPausedUntil = +48h` (блокира Normal trading)
- Задава `mainAddressChangersCooldown = +48h` (блокира и трите + mint)

## 4. COOLDOWN ТИПОВЕ
- **2 часа:** Normal → Anyone (sender cooldown)
- **24 часа:** Exempt → Normal (sender cooldown)
- **48 часа:** mainAddressChangersCooldown (блокира admin функции)

## 5. ЛИМИТИ
- **Exempt → Normal:** Max 100 tokens per tx
- **Normal → Anyone:** Max 2000 tokens per tx
- **Anyone → Normal:** Max 4000 tokens in wallet
- **Exempt → Exempt:** БЕЗ ЛИМИТИ

## 6. FEES
- **Exempt → Exempt:** 0%
- **Всичко друго с Normal:** 0.08% (0.03% burn + 0.05% owner)

---


## 6. TEST CASES
Използвай Pool→Normal за зареждане до 2000/4000 tokens!

✅ Реалистични сценарии - симулираме реални ситуации
✅ Чист beforeEach - само initial setup
✅ Лесно debugging - всеки тест е self-contained
✅ Гъвкавост - всеки тест setup-ва точно каквото му трябва
✅ Използвам helper - setupNormalUser() прави temp exempt trick веднъж

Тестовете трябва да симулират РЕАЛНИ ситуации! 
Ако тестваш Normal→Normal transfer, НЕ трябва да използваш owner/exempt, за да дадеш tokens!

В beforeEach: ще вкараш само неща, които трябва да слагаш във всеки тест! Това и значи beforeEach - пред всеки!
Няма защо да правиш непрекъснато за всеки тест деплойване, сетване на екземпт и други глупости дето ти трябват 
само за част от тестовете. Максимално може да изтеглиш в "предвсеки" само код, който го има в 95% от тестовете,
тоест дори да се повтори за 4-5 теста няма да забави останалите. Но ако добавиш код, който е за 5 или дори 50% от
тестовете, а за другите не се прилага, няма смисъл.
По-скоро ако искаш оптимизация за код, който се прилага в половината от сегашните случаи, но нямаш гаранция дали
ще ти трябва за нови тестове - вкарваш го в хелпър и там му даваш име на функцията, която ще извишваш в 50% от тестовете.

първо виж защо си го направил тоя хелпър, какви тестове трябва да включва, 
второ дали тези тестове вече ги няма в други тестове

трето ако ще тестваш нещо по таблиците, което да е еднотипно и можеш да направиш една постановка за 10 теста, 
направи тази постановка и наведнъж с един тест изтествай всички случаи, като имаш впредвид, 
че тестове дето дават exception може да прекъснат изпълнението на теста... 
ако ти позволява тествай exception-ите без да прекъсваш процеса
тоест като групираш тестовете групирай ги по сценарии и ако можеш изтествай няколко сценария наведнъж
и прегледай дали тестовете тестват всички сценарии, а не "то беше 500 сега го направих на 100 и минава, тъпак"

 ВСИЧКИ ТЕСТОВЕ ДА ПОКРИВАТ ВСИЧКИ СЦЕНАРИИ, и по възможност да са групирани по сценарии, 
 например: тестваш трансфер по време на пауза - правиш един тест в който е включена пауза и тестваш всички случаи на трансфери 
 според таблиците, ако можеш при един сценарий да го направиш с един тест ок, 
 ако ли не правиш 2-3... колкото теста трябват за всички случаи, но в един файл, 
 тоест да се знае, че всяка таблица я има на едно място в тестовете в един файл, а не на 10 места в 10 файла

След всяка от трите updateExemptSlot/updateDEXAddresses/setLiquidityPair() трябва да се чака
await time.increase(PAUSE_DURATION + 1); освен ако не тестваш грешка при неизчакване 24 часа

След всяко await buyFromDEX(normal1.address, ethers.parseEther(amount));
await time.increase(COOLDOWN_2H + 1); освен ако не тестваш грешка при неизчакване 2 часа



# КРАЙ НА ДОКУМЕНТ
