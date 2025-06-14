# Комиссии и сборы

`NetworkFeeManager` задаёт размер платформенной комиссии для каждой сети. Комиссия указывается в базисных пунктах и удерживается при создании конкурса.

Основные функции:

- `calculateFee(chainId, amount)` — расчёт комиссии.
- `collectFee(contestId, creator, token, prizeAmount)` — вызывается `ContestFactory` при создании конкурса.
- `withdrawFees(token, amount)` — вывод собранных комиссий в казну.
- `banCreator(address, reason)` и `unbanCreator(address)` — система банов создателей.
