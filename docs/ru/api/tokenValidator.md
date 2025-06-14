# TokenValidator

Контракт **TokenValidator** проверяет корректность ERC-20 токенов для участия в конкурсах.

## Методы

### `isValid`

```solidity
function isValid(address token) external view returns (bool);
```

**Описание**: проверяет, находится ли `token` в белом списке (`allowlist`) и соответствует базовому ERC-20 (наличие `decimals`, `totalSupply`, `balanceOf`).

**Пример**:

```js
const tokenAddress = process.env.SOME_TOKEN;
const valid = await tokenValidator.isValid(tokenAddress);
console.log(`Token ${tokenAddress} valid? ${valid}`);
```

### `addToAllowlist`

```solidity
function addToAllowlist(address token) external onlyOwner;
```

**Описание**: добавляет `token` в белый список допустимых токенов. Только владелец.

**Пример**:

```js
await tokenValidator.addToAllowlist(tokenAddress);
console.log(`Token ${tokenAddress} добавлен в allowlist`);
```

### `removeFromAllowlist`

```solidity
function removeFromAllowlist(address token) external onlyOwner;
```

**Описание**: убирает `token` из белого списка. Только владелец.

**Пример**:

```js
await tokenValidator.removeFromAllowlist(tokenAddress);
console.log(`Token ${tokenAddress} удалён из allowlist`);
```

### `allowlist`

```solidity
function allowlist(address token) external view returns (bool);
```

**Описание**: возвращает `true`, если `token` в белом списке.

## События

- `TokenAllowed(address indexed token)` — при добавлении в allowlist.
- `TokenRemoved(address indexed token)` — при удалении из allowlist.

## Рекомендации

- Перед созданием конкурса проверяйте валидность токена через `isValid`.
- Регулярно обновляйте allowlist через multisig для повышения безопасности.

*Далее: *[*PrizeTemplates*](prizeTemplates.md)

