# TokenValidator

The **TokenValidator** contract ensures that only approved ERC-20 tokens can be used in contests.

## Methods

### `isValid`

```solidity
function isValid(address token) external view returns (bool);
```

**Description**: Returns `true` if `token` is in the allowlist and implements basic ERC-20 functions (`decimals`,
`totalSupply`, `balanceOf`).

**Example**

```js
const valid = await tokenValidator.isValid(TOKEN_ADDRESS);
console.log(`Token valid? ${valid}`);
```

### `addToAllowlist`

```solidity
function addToAllowlist(address token) external onlyOwner;
```

**Description**: Adds `token` to the allowlist. Owner only.

**Example**

```js
await tokenValidator.addToAllowlist(TOKEN_ADDRESS);
console.log(`Token added to allowlist: ${TOKEN_ADDRESS}`);
```

### `removeFromAllowlist`

```solidity
function removeFromAllowlist(address token) external onlyOwner;
```

**Description**: Removes `token` from the allowlist. Owner only.

**Example**

```js
await tokenValidator.removeFromAllowlist(TOKEN_ADDRESS);
console.log(`Token removed from allowlist: ${TOKEN_ADDRESS}`);
```

### `allowlist`

```solidity
function allowlist(address token) external view returns (bool);
```

**Description**: Returns current allowlist status of `token`.

## Events

- `TokenAllowed(address indexed token)` — when a token is added.
- `TokenRemoved(address indexed token)` — when a token is removed.

## Recommendations

- Verify token validity with `isValid` before creating contests.
- Manage the allowlist via a multisig for security.

---

*Next: [*PrizeTemplates*](prizeTemplates.md)*