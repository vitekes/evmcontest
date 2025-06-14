# Fees

`NetworkFeeManager` defines platform fees for each chain. Fees are stored in basis points and are deducted when a contest is created.

Key functions:

- `calculateFee(chainId, amount)` – fee calculation helper.
- `collectFee(contestId, creator, token, prizeAmount)` – called by the factory on contest creation.
- `withdrawFees(token, amount)` – withdraws accumulated fees to the treasury.
- `banCreator(address, reason)` and `unbanCreator(address)` – ban list management.

Fees are denominated in basis points (1/100 of a percent). A network can for example set `500` to charge a 5% fee on the prize amount. When the factory collects the fee it records how much each contest paid.

Use `getNetworkFee(chainId)` to read the current fee.  Multiple chains can share the same fee schedule or each chain can be configured individually.

The owner may update fees or change the treasury address:
```solidity
feeManager.setNetworkFee(1, 300); // 3% on mainnet
feeManager.setTreasury(newTreasury);
```

Example: calculate the fee for a 1000 USDC prize on chain id 1
```solidity
uint256 fee = feeManager.calculateFee(1, 1000e6);
```

Banned creators are prevented from creating new contests. The owner can lift the ban later using `unbanCreator`.

To withdraw all accumulated ETH fees to the treasury:
```solidity
uint256 amount = feeManager.availableFees(address(0));
feeManager.withdrawFees(address(0), amount);
```
