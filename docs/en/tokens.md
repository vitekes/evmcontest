# Token validation

The `TokenValidator` contract restricts which ERC‑20 tokens can be used in contests.

Main methods:

- `isValidToken(address)` – returns true if the token is allowed.
- `isStablecoin(address)` – checks whether a token is a known stable coin.
- `getTokenInfo(address)` – returns basic info such as name, symbol and liquidity data.

Only tokens approved by the validator may be specified when creating contests.

Tokens can be manually whitelisted or blacklisted by the contract owner. If a token is neither whitelisted nor blacklisted the factory refuses to use it.

To add several tokens in batch:
```solidity
address[] memory tokens = [USDC, DAI];
validator.setWhitelist(tokens, true);
```

Each token has cached metadata which can be updated off-chain using `updateTokenInfo` to store liquidity or price information.

