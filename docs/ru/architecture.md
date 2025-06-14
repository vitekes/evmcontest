# Архитектура

Эта глава описывает внутреннюю структуру **evmcontest**, основные контракты, паттерны и модули расширения.

---

## Контракты и паттерны

### ContestFactory

**ContestFactory** отвечает за:

- Создание новых конкурсов (контрактов `ContestEscrow`).
- Управление адресом валидатора токенов `TokenValidator` и менеджера комиссий `NetworkFeeManager`.
- Хранение списка всех эскроу-концернов и их статусов.

**Основные методы:**

- `createContest(CreateParams params) → address escrow` — деплоит новый `ContestEscrow` и возвращает его адрес.
- `getContests() → address[]` — возвращает массив адресов всех созданных эскроу.
- `setTokenValidator(address)` — (админ) обновляет валидатор токенов.
- `setFeeManager(address)` — (админ) обновляет менеджер комиссий.

**События:**

- `ContestCreated(address indexed escrow)`

---

### ContestEscrow

**ContestEscrow** инкапсулирует логику отдельного конкурса:

- Приём призового фонда (ETH или ERC-20).
- Объявление победителей и распределение призов.
- Хранение метаданных конкурса (`startTime`, `endTime`, `params`).

**Основные методы:**

- `initialize(InitParams params)` — вызывается фабрикой для инициализации.
- `declareWinners(address[] winners, uint256[] amounts)` — распределяет призы.
- `claimPrize()` — позволяет победителю получить свою долю.
- `refund()` — в случае отмены конкурса возвращает средства организатору.

**События:**

- `WinnersDeclared(address[] winners, uint256[] amounts)`
- `PrizeClaimed(address indexed user, uint256 amount)`
- `Refunded(address indexed recipient, uint256 amount)`

---

## Модули расширений

### NetworkFeeManager

- Отвечает за расчёт и сбор комиссий.
- Поддерживает фиксированные и процентные сборы.
- Адрес получателя комиссий задаётся через `setFeeRecipient(address)`.

**Основные методы:**

- `calculateFee(uint256 amount) → (uint256 fee)`
- `withdrawFees()` — переводит накопленные средства на адрес получателя.

---

### TokenValidator

- Проверяет, что ERC-20 токен соответствует требованиям (наличие `decimals()`, `totalSupply()` и т.д.).
- Поддерживает `allowlist` и `blocklist` токенов.

**Основные методы:**

- `isValid(address token) → bool`
- `addToAllowlist(address token)` — (админ)
- `removeFromAllowlist(address token)` — (админ)

---

### PrizeManager и PrizeTemplates

- **PrizeManager** обеспечивает работу с нефинансовыми призами (NFT, бейджи).
- **PrizeTemplates** — библиотека шаблонов распределения призов:
    - `EqualSplit` — равная доля каждому победителю.
    - `TopN` — фиксированное распределение по рангу.
    - `Custom` — произвольные доли, задаваемые вызовом `customDistribution`.

**Расширяемость:**

1. Добавьте новую реализацию шаблона в `PrizeTemplates`.
2. При создании конкурса укажите новый `templateId`.

---

## Безопасность и апгрейдность

### Безопасность

- Контракты используют стандарты OpenZeppelin.
- Фильтрация фейковых токенов через `TokenValidator`.
- Чёткая изоляция каждого конкурса в отдельном контракте.

### Апгрейдность

- Текущая реализация **не** поддерживает прокси-паттерны.
- Для добавления апгрейдов рекомендуем использовать OpenZeppelin Upgrades (UUPS/Transparent Proxy).
- Админ-функции (`setFeeManager`, `setTokenValidator`) могут перенести в мультисиг `Governance` контракт.

---

*Далее: API*

- [ContestFactory](api/contestFactory.md)
- [ContestEscrow](api/contestEscrow.md)
- [NetworkFeeManager](api/networkFeeManager.md)
- [TokenValidator](api/tokenValidator.md)
- [PrizeTemplates](api/prizeTemplates.md)

---
*Примеры использования: [Examples](examples.md)*
