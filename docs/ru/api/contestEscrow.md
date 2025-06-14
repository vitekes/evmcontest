# ContestEscrow

Контракт **ContestEscrow** управляет жизненным циклом одного конкурса: приём средств, объявление победителей и распределение призов.

## Жизненный цикл конкурса

1. **Инициализация**: вызывается методом `initialize` после деплоя.
2. **Период приёма** (`startTime` → `endTime`): участники вносят призовой фонд.
3. **Завершение конкурса**: организатор вызывает `declareWinners`.
4. **Получение призов**: победители вызывают `claimPrize`.
5. **Возврат средств**: организатор может отменить конкурс до старта и вернуть приз.

## Методы

### `initialize`

```solidity
function initialize(InitParams calldata params) external payable;
```

**Описание**: устанавливает параметры конкурса и депонирует призовой фонд.

**Параметры** (`InitParams`):

| Поле                 | Тип         | Описание                                       |
| -------------------- | ----------- | ---------------------------------------------- |
| `creator`            | `address`   | Организатор конкурса.                          |
| `token`              | `address`   | Адрес ERC-20 токена или `0x000...0` для ETH.   |
| `prizeAmount`        | `uint256`   | Размер призового фонда.                        |
| `template`           | `uint8`     | ID шаблона распределения (см. PrizeTemplates). |
| `customDistribution` | `uint256[]` | Массив долей для шаблона `Custom`.             |
| `startTime`          | `uint256`   | UNIX-время старта конкурса.                    |
| `endTime`            | `uint256`   | UNIX-время окончания конкурса.                 |

**Пример (ETH)**:

```js
await escrow.initialize(
  { ...params, creator: wallet.address },
  { value: params.prizeAmount }
);
```

**Пример (ERC-20)**:

```js
await tokenContract.approve(escrow.address, params.prizeAmount);
await escrow.initialize({ ...params, creator: wallet.address });
```

### `declareWinners`

```solidity
function declareWinners(address[] calldata winners, uint256[] calldata amounts) external;
```

**Описание**: завершает конкурс после `endTime`, фиксирует список победителей и их выигрыши.

**Пример**:

```js
// Проверяем, что конкурс завершён
if (Math.floor(Date.now()/1000) >= params.endTime) {
  await escrow.declareWinners(
    [addr1, addr2],
    [ethers.utils.parseEther("6"), ethers.utils.parseEther("4")]
  );
}
```

### `claimPrize`

```solidity
function claimPrize() external;
```

**Описание**: позволяет участнику получить свою часть приза после `declareWinners`.

**Пример**:

```js
await escrow.connect(winnerWallet).claimPrize();
```

### `refund`

```solidity
function refund() external;
```

**Описание**: возвращает призовой фонд организатору до старта конкурса или при отмене.

**Пример**:

```js
// В случае необходимости отмены конкурса
await escrow.refund();
```

## События

- `WinnersDeclared(address[] winners, uint256[] amounts)` — при завершении.
- `PrizeClaimed(address indexed user, uint256 amount)` — при выдаче приза участнику.
- `Refunded(address indexed recipient, uint256 amount)` — при возврате средств организатору.

## Нюансы и рекомендации

- Метод `initialize` может быть `payable` для ETH либо требует `approve` для ERC-20.
- После вызова `declareWinners` вызов `refund` недоступен.
- Следите за тем, чтобы сумма `amounts` в `declareWinners` соответствовала `prizeAmount` за вычетом комиссии.

*Далее: [*NetworkFeeManager*](networkFeeManager.md)*

