# Комиссии и сборы

`NetworkFeeManager` задаёт размер платформенной комиссии для каждой сети. Комиссия указывается в базисных пунктах и удерживается при создании конкурса.

Основные функции:

- `calculateFee(chainId, amount)` — расчёт комиссии.
- `collectFee(contestId, creator, token, prizeAmount)` — вызывается `ContestFactory` при создании конкурса.
- `withdrawFees(token, amount)` — вывод собранных комиссий в казну.
- `banCreator(address, reason)` и `unbanCreator(address)` — система банов создателей.

Комиссия выражается в базисных пунктах (1/100 процента). Например, значение `500` означает 5% от суммы приза. При создании конкурса фабрика сохраняет сведения о внесённой комиссии.

Актуальный размер комиссии можно узнать через `getNetworkFee(chainId)`. Для разных сетей можно установить как одинаковую ставку, так и индивидуальные значения.

Владелец может менять размер комиссий или адрес казны:
```solidity
feeManager.setNetworkFee(1, 300); // 3% в основной сети
feeManager.setTreasury(newTreasury);
```

Пример расчёта комиссии для приза 1000 USDC в сети 1:
```solidity
uint256 fee = feeManager.calculateFee(1, 1000e6);
```

Забаненные создатели не могут запускать конкурсы, пока владелец не снимет бан через `unbanCreator`.

Пример вывода всех собранных ETH-комиссий в казну:
```solidity
uint256 amount = feeManager.availableFees(address(0));
feeManager.withdrawFees(address(0), amount);
```
