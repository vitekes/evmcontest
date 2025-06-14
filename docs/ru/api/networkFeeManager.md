# NetworkFeeManager

Контракт **NetworkFeeManager** отвечает за вычисление и сбор сетевых комиссий в рамках **evmcontest**.

## Методы

### `calculateFee`

```solidity
function calculateFee(uint256 amount) external view returns (uint256 fee);
```

**Описание**: вычисляет комиссию с указанной суммы `amount`.

**Пример**:

```js
const amount = ethers.utils.parseEther("5");
const fee = await feeManager.calculateFee(amount);
console.log(`Комиссия для 5 ETH: ${ethers.utils.formatEther(fee)} ETH`);
```

### `collectFee`

```solidity
function collectFee(uint256 amount) external;
```

**Описание**: внутренний метод, вызываемый `ContestEscrow` для накопления комиссии при распределении призов. Пользователям вызывать не нужно.

### `withdrawFees`

```solidity
function withdrawFees() external;
```

**Описание**: выводит накопленные комиссии на адрес `feeRecipient`.

**Пример**:

```js
// Адрес получателя комиссии
const recipient = await feeManager.feeRecipient();
console.log(`Получатель комиссий: ${recipient}`);

// Баланс до вывода
const before = await ethers.provider.getBalance(recipient);
await feeManager.withdrawFees();
const after = await ethers.provider.getBalance(recipient);
console.log(`Баланс до: ${ethers.utils.formatEther(before)} ETH, после: ${ethers.utils.formatEther(after)} ETH`);
```

### `setFeeRecipient`

```solidity
function setFeeRecipient(address recipient) external onlyOwner;
```

**Описание**: устанавливает (или меняет) адрес `feeRecipient`, на который будут выводиться комиссии. Только владелец.

**Пример**:

```js
const newRecipient = "0xNewFeeRecipientAddress";
await feeManager.setFeeRecipient(newRecipient);
console.log(`Новый получатель комиссий: ${newRecipient}`);
```

### `setFeePercent`

```solidity
function setFeePercent(uint16 percent) external onlyOwner;
```

**Описание**: изменяет процент комиссии. Значение `percent` указано в сотых процента (например, `150` = 1.5%). Только владелец.

**Пример**:

```js
// Устанавливаем комиссию 2%
await feeManager.setFeePercent(200);
console.log("Комиссия изменена на 2%");
```

### `feeRecipient`

```solidity
function feeRecipient() external view returns (address);
```

**Описание**: возвращает текущий адрес получателя комиссий.

## События

- `FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient)`
- `FeePercentChanged(uint16 oldPercent, uint16 newPercent)`
- `FeesWithdrawn(address indexed recipient, uint256 amount)`

## Рекомендации

- Вызывайте `withdrawFees` регулярно после объявления победителей, чтобы агрегировать всё в одном месте.
- Для распределения комиссий разных типов токенов (ETH и ERC-20) можно расширить контракт, добавив адрес токена-фии.
- Задействуйте multisig-кошелёк для `feeRecipient` для повышения безопасности.

*Далее: [*TokenValidator*](tokenValidator.md)*

