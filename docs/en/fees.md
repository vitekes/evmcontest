# Fees

`NetworkFeeManager` defines platform fees for each chain. Fees are stored in basis points and are deducted when a contest is created.

Key functions:

- `calculateFee(chainId, amount)` – fee calculation helper.
- `collectFee(contestId, creator, token, prizeAmount)` – called by the factory on contest creation.
- `withdrawFees(token, amount)` – withdraws accumulated fees to the treasury.
- `banCreator(address, reason)` and `unbanCreator(address)` – ban list management.
