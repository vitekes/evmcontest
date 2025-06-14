# Token validation

The `TokenValidator` contract restricts which ERC‑20 tokens can be used in contests.

Main methods:

- `isValidToken(address)` – returns true if the token is allowed.
- `isStablecoin(address)` – checks whether a token is a known stable coin.
- `getTokenInfo(address)` – returns basic info such as name, symbol and liquidity data.

Only tokens approved by the validator may be specified when creating contests.
