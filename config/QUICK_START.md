<!-- @version v34 -->

# KCY1 Адреси - Бърз Преглед

## 📍 Централизация на Адреси - Една Диаграма

```
┌─────────────────────────────────────────────────────────────────┐
│                     config/addresses.js                         │
│                  (ЕДИНСТВЕН ИЗТОЧНИК НА АДРЕСИ)                 │
└─────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼               ▼               ▼
        ┌────────────┐   ┌─────────────┐  ┌──────────┐
        │  Hardhat   │   │ BSC Testnet │  │ Mainnet  │
        │ (chainId   │   │ (chainId 97)│  │(chainId  │
        │  31337)    │   │             │  │   56)    │
        └────────────┘   └─────────────┘  └──────────┘
             │                  │               │
    ┌────────┼────────┐  ┌──────┼─────┐  ┌─────┼──────┐
    ▼        ▼        ▼  ▼      ▼     ▼  ▼     ▼      ▼
  [Dist]  [Exempt] [DEX] [Dist][Exempt][DEX] [Dist][Exempt][DEX]
```

## 🔑 Как да Използвате

### Един Ред Код:
```javascript
const addresses = require('./config/addresses');
```

### Тази Линия Ви Дава Достъп До:
- ✅ Всички distribution адреси
- ✅ Всички exempt slots
- ✅ Всички DEX адреси  
- ✅ За всички 3 мрежи

## 📋 Бърза Референция

### Distribution Адреси (Mainnet)
```
DEV:       0x567c1c5e9026E04078F9b92DcF295A58355f60c7
Marketing: 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A
Team:      0x6300811567bed7d69B5AC271060a7E298f99fddd
Advisor:   0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87
```

### DEX Адреси (Mainnet)
```
Router:    0x10ED43C718714eb63d5aA57B78B54704E256024E
Factory:   0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73
WBNB:      0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### Exempt Slots (Mainnet)
```
⚠️  ВАЖНО: Трябва да се конфигурират преди mainnet deploy!
Slot 1: 0x0000... (КОНФИГУРИРАЙТЕ!)
Slot 2: 0x0000... (КОНФИГУРИРАЙТЕ!)
Slot 3: 0x0000... (Резервен)
Slot 4: 0x0000... (Резервен)
```

## 🚀 3 Начина за Достъп

### Начин 1: Директен достъп
```javascript
addresses.bscMainnet.distribution.dev
```

### Начин 2: Helper функции
```javascript
addresses.getDistributionAddresses('bscMainnet')
```

### Начин 3: Чрез networks.js
```javascript
const networks = require('./config/networks');
networks.bscMainnet.router  // Използва addresses.js
```

## ⚠️  Преди Mainnet Deploy

```
[ ] Конфигурирайте exempt slots в config/addresses.js
[ ] Проверете всички mainnet адреси
[ ] Тествайте на testnet
[ ] Deploy на mainnet
[ ] Актуализирайте tokenAddress в config/networks.js
```

## 📚 Пълна Документация

- `config/README_ADDRESSES.md` - Детайлна документация
- `config/example-usage.js` - Практически примери
- `docs/ADDRESSES_CENTRALIZATION_SUMMARY.md` - Пълен summary

## 🎯 Ключови Предимства

```
┌────────────────────────────────────────────────────┐
│ ПРЕДИ                  │  СЕГА                     │
├────────────────────────┼───────────────────────────┤
│ Адреси в 5+ файла      │ ✅ Само в 1 файл          │
│ Хардкоднати навсякъде  │ ✅ Централизирани         │
│ Трудна промяна         │ ✅ Лесна промяна          │
│ Грешки при deploy      │ ✅ По-малко грешки        │
│ Липса на документация  │ ✅ Пълна документация     │
└────────────────────────┴───────────────────────────┘
```

## 🔗 Обратна Съвместимост

Старите файлове продължават да работят:
- `config/exempts-slots.js` → препраща към `addresses.js`
- Всички съществуващи скриптове работят без промени
- Тестовете автоматично използват новите адреси

## ✅ Статус: ГОТОВО

Всички адреси са централизирани и готови за използване!

---

**Версия**: 1.0  
**Дата**: 26 Ноември 2025  
**Автор**: KCY1 Team
