# Тестирование

Раздел посвящён запуску и структуре тестов **evmcontest**.

---

## Запуск тестов

Скрипты для запуска тестов описаны в `package.json`. Например:

```bash
npm run test                 # запустить все тесты
npm run test:unit            # модульные тесты (папка unit)
npm run test:integration     # интеграционные тесты (папка integration)
npm run test:e2e             # end-to-end тесты (папка e2e)
```

## Структура каталога `test/` `test/`

```
test/
├── ContestSecurity.test.ts
├── ContestStress.test.ts
├── e2e/
│   ├── CancellationFlow.test.ts
│   ├── ContestFlow.test.ts
│   └── TokenFlow.test.ts
├── fixtures/
│   ├── BaseFixture.ts
│   ├── ConstantsFixture.ts
│   ├── ContestFixture.ts
│   ├── FeesFixture.ts
│   ├── index.ts
│   └── TokenFixture.ts
├── GasOptimization.test.ts
├── helpers/
│   ├── AmountHelper.ts
│   ├── ContestHelper.ts
│   ├── EventsHelper.ts
│   ├── index.ts
│   ├── SecurityHelper.ts
│   └── TokenHelper.ts
├── integration/
│   ├── ContestCreation.test.ts
│   ├── ContestJury.test.ts
│   ├── ContestLifecycle.test.ts
│   └── ContestTokens.test.ts
├── test-runner.js
├── test.config.js
└── unit/
    ├── ContestEscrow.test.ts
    ├── ContestFactory.test.ts
    ├── CreatorBadges.test.ts
    ├── EmergencyRoles.test.ts
    ├── NetworkFeeManager.test.ts
    ├── PrizeManager.test.ts
    ├── TokenValidator.stablecoin.test.ts
    └── TokenValidator.test.ts
```

- **e2e**: end-to-end тесты ключевых сценариев (flow, cancellation, token).
- **fixtures**: базовые фикстуры для развёртывания контрактов и констант.
- **helpers**: утилиты для работы с суммами, событиями и безопасностью.
- **integration**: интеграционные тесты жизненного цикла конкурса и работы с токенами.
- **unit**: модульные тесты для отдельных контрактов и ролей.

## Основные подходы в тестах в тестах

1. **Изоляция через независимые деплои**\
   Каждый `describe` использует `beforeEach` для развёртывания нового контракта фабрики и связанных с ней модулей.

2. **Проверка событий**\
   Используется `await expect(tx).to.emit(contract, eventName).withArgs(...)` для валидации корридора событий.

3. **Тестирование негативных сценариев**\
   С помощью `await expect(tx).to.be.revertedWith(errorMessage)` проверяются проверки на параметры, фазы конкурса и права доступа.

4. **Интеграционные сценарии**\
   В `escrow.test.ts` проверяется полный поток: деплой → оплата приза → объявление победителей → получение призов.

---

## Советы по улучшению тестов

- Рассмотреть использование `hardhat-deploy` fixtures для ускорения работы тестового конвейера.
- Добавить больше тестов для пользовательских шаблонов распределения (`customDistribution`).
- Документировать в тестах примеры использования `fixtures`, чтобы новые разработчики быстрее ориентировались.
