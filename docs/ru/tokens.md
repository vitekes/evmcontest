# Работа с токенами

`TokenValidator` позволяет платформе ограничивать использование сомнительных токенов в конкурсах. Главные методы:

- `isValidToken(address)` — проверяет разрешён ли токен.
- `isStablecoin(address)` — определяет стейблкоины.
- `getTokenInfo(address)` — возвращает базовую информацию о токене (имя, символ, ликвидность).

Контракт поддерживает белый и чёрный списки, а также хранит список известных стейблкоинов. Создатели конкурсов могут использовать только прошедшие проверку токены.

Токены можно добавлять в список разрешённых или запрещённых вручную владельцем. Если токен не указан ни в одном списке, фабрика отклонит попытку использовать его в конкурсе.

Стейблкоины можно помечать через `setTokenIsStablecoin`, чтобы учитывать их стабильность при расчётах комиссий.

Добавление токенов пакетно:
```solidity
address[] memory tokens = [USDC, DAI];
validator.setWhitelist(tokens, true);
```

Пример одобрения одного токена:
```solidity
validator.setTokenWhitelist(MY_TOKEN, true, "надёжный");
```

Для анализа ликвидности и цены можно обновлять информацию о токене через `updateTokenInfo` вне цепочки.

Структура `TokenInfo`, которую возвращает `getTokenInfo`, содержит поля:
```solidity
struct TokenInfo {
  string name;
  string symbol;
  uint8  decimals;
  bool   hasLiquidity;
  uint256 priceUSD;      // 8 знаков после запятой
  uint256 liquidityUSD;
  uint256 lastValidated;
  bool   isStablecoin;
  bool   isWrappedNative;
}
```
Пример запроса информации по токену:
```solidity
ITokenValidator.TokenInfo memory info = validator.getTokenInfo(USDC);
console.log(info.symbol, info.decimals);
```
