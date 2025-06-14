# Testing

This section covers running and structure of tests for **evmcontest**.

---

## Running Tests

Test scripts are defined in `package.json`. For example:

```bash
npm run test                 # run all tests
npm run test:unit            # unit tests (unit folder)
npm run test:integration     # integration tests (integration folder)
npm run test:e2e             # end-to-end tests (e2e folder)
npm run test:security        # security tests (ContestSecurity)
npm run test:stress          # stress tests (ContestStress & GasOptimization)
```

---

## Test Folder Structure

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

---

## Testing Practices

1. **Isolation**: each `describe` deploys fresh contracts in `beforeEach`.
2. **Event assertions**: use `await expect(tx).to.emit(contract, event).withArgs(...)`.
3. **Negative cases**: `await expect(tx).to.be.revertedWith("...")` for revert checks.
4. **Integration flows**: `escrow` tests cover fund deposit → winner declaration → prize claim.

---

## Suggestions

- Use Hardhat fixtures for faster testing.
- Expand custom distribution edge cases.
- Document fixture usage in tests for new contributors.

