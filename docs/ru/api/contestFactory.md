# ContestFactory

Контракт **ContestFactory** создаёт и управляет конкурсами.

## Методы

### `createContest`

```solidity
function createContest(CreateParams calldata params) external returns (address escrow);
```

**Описание**: деплоит новый контракт `ContestEscrow` с заданными параметрами.

**Параметры** (`CreateParams`):

| Поле                 | Тип         | Описание                                                   |
| -------------------- | ----------- | ---------------------------------------------------------- |
| `token`              | `address`   | Адрес ERC-20 токена или `0x000...0` для ETH.               |
| `prizeAmount`        | `uint256`   | Сумма приза в wei или минимальных единицах токена.         |
| `template`           | `uint8`     | ID шаблона распределения (0=EqualSplit, 1=TopN, 2=Custom). |
| `customDistribution` | `uint256[]` | Массив долей для кастомного шаблона (сумма долей = 100%).  |
| `startTime`          | `uint256`   | UNIX-время старта конкурса.                                |
| `endTime`            | `uint256`   | UNIX-время завершения конкурса.                            |

**Примеры**:

Создание конкурса на ETH:

```js
const params = {
  token: ethers.constants.AddressZero,
  prizeAmount: ethers.utils.parseEther("10"),
  template: 0,
  customDistribution: [],
  startTime: Math.floor(Date.now()/1000) + 600,
  endTime: Math.floor(Date.now()/1000) + 3600,
};
const tx = await factory.createContest(params);
const receipt = await tx.wait();
const escrowAddress = receipt.events[0].args.escrow;
```

Создание конкурса с USDT (ERC-20):

```js
await usdt.approve(factory.address, ethers.utils.parseUnits("1000", 6));
const tx = await factory.createContest({
  token: USDT_ADDRESS,
  prizeAmount: ethers.utils.parseUnits("1000", 6),
  template: 1,
  customDistribution: [],
  startTime: Math.floor(Date.now()/1000) + 300,
  endTime: Math.floor(Date.now()/1000) + 7200,
});
const escrowAddress = (await tx.wait()).events[0].args.escrow;
```

### `getContests`

```solidity
function getContests() external view returns (address[] memory);
```

**Описание**: возвращает список всех созданных адресов `ContestEscrow`.

**Пример**:

```js
const contests = await factory.getContests();
console.log("Existing contests:", contests);
```

### Управление модулями

#### `setTokenValidator`

```solidity
function setTokenValidator(address validator) external onlyOwner;
```

**Описание**: обновляет адрес контракта `TokenValidator`. Только владелец.

**Пример**:

```js
await factory.setTokenValidator(validatorAddress);
```

#### `setFeeManager`

```solidity
function setFeeManager(address feeManager) external onlyOwner;
```

**Описание**: устанавливает адрес контракта `NetworkFeeManager`. Только владелец.

**Пример**:

```js
await factory.setFeeManager(feeManagerAddress);
```

## События

### `ContestCreated`

```solidity
event ContestCreated(address indexed escrow);
```

Срабатывает после создания конкурса.


*Далее: *[*ContestEscrow*](contestEscrow.md)