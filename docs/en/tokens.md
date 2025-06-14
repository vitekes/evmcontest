# Token validation

The `TokenValidator` contract restricts which ERC‑20 tokens can be used in contests.

Main methods:

- `isValidToken(address)` – returns true if the token is allowed.
- `isStablecoin(address)` – checks whether a token is a known stable coin.
- `getTokenInfo(address)` – returns basic info such as name, symbol and liquidity data.

Only tokens approved by the validator may be specified when creating contests.

Tokens can be manually whitelisted or blacklisted by the contract owner. If a token is neither whitelisted nor blacklisted the factory refuses to use it.

Stable coins may also be marked with `setTokenIsStablecoin` so that fees or
price conversions can take their stability into account.

To add several tokens in batch:
```solidity
address[] memory tokens = [USDC, DAI];
validator.setWhitelist(tokens, true);
```

To explicitly approve a single token:
```solidity
validator.setTokenWhitelist(MY_TOKEN, true, "trusted");
```

Each token has cached metadata which can be updated off-chain using `updateTokenInfo` to store liquidity or price information.

`TokenInfo` returned by `getTokenInfo` has the following fields:
```solidity
struct TokenInfo {
  string name;
  string symbol;
  uint8  decimals;
  bool   hasLiquidity;
  uint256 priceUSD;      // 8 decimal places
  uint256 liquidityUSD;
  uint256 lastValidated;
  bool   isStablecoin;
  bool   isWrappedNative;
}
```
You can query information for a whitelisted token like so:
```solidity
ITokenValidator.TokenInfo memory info = validator.getTokenInfo(USDC);
console.log(info.symbol, info.decimals);
```
