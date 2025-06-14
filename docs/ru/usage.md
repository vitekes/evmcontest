# Как пользоваться

1. Установите зависимости:
   ```bash
   npm install
   ```
2. Запустите локальную сеть Hardhat:
   ```bash
   npx hardhat node &
   ```
3. Разверните контракты:
   ```bash
   npm run deploy:local
   ```
4. Запустите тесты при необходимости:
   ```bash
   npm run test
   ```

Перед деплоем в публичные сети заполните файл `.env` на основе `env-example.js`.

## Деплой в тестовые сети

Добавьте в `.env` RPC URL и приватный ключ:
```bash
PRIVATE_KEY=0xabc...
SEPOLIA_RPC=https://sepolia.infura.io/v3/KEY
```
Затем выполните:
```bash
npm run deploy:sepolia
```

Скрипт `ignition/modules/PublicDeploy.ts` развёртывает основные контракты и связывает модули между собой.

## Взаимодействие с контрактами

Пример создания конкурса из скрипта или консоли Hardhat:
```javascript
const factory = await ethers.getContract('ContestFactory');
await factory.createContest({
  token: tokenAddress,
  totalPrize: ethers.parseEther('10'),
  template: 0,
  customDistribution: [],
  jury: [juryAddress],
  startTime: Math.floor(Date.now()/1000),
  endTime: Math.floor(Date.now()/1000) + 86400,
  contestMetadata: 'ipfs://Qm...',
  hasNonMonetaryPrizes: false
});

// Свой вариант распределения 70/20/10
await factory.createContest({
  token: tokenAddress,
  totalPrize: ethers.parseEther('10'),
  template: PrizeTemplates.PrizeTemplate.CUSTOM,
  customDistribution: [7000, 2000, 1000],
  jury: [juryAddress],
  startTime: Math.floor(Date.now()/1000),
  endTime: Math.floor(Date.now()/1000) + 86400,
  contestMetadata: 'ipfs://Qm...'
});
```

После окончания конкурса один из членов жюри объявляет победителей:
```javascript
const escrow = await ethers.getContractAt('ContestEscrow', escrowAddress);
await escrow.declareWinners([winner1, winner2], [1, 2]);
```
Затем каждый победитель вызывает `claimPrize`, чтобы получить награду.

Получить полную информацию о конкурсе можно так:
```javascript
const info = await factory.getContest(contestId);
console.log(info.prizeToken, info.totalPrize);
```

### Управление токенами и комиссиями

Использовать в конкурсах можно только токены из белого списка. Владелец
`TokenValidator` добавляет или удаляет токены так:

```solidity
validator.setTokenWhitelist(USDC, true, "стейблкоин");
validator.setTokenBlacklist(BAD_TOKEN, true, "блокирован");
```
Получить информацию о токене:
```solidity
ITokenValidator.TokenInfo memory info = validator.getTokenInfo(USDC);
```

Параметры комиссий задаются в `NetworkFeeManager` и могут изменяться по
каждой сети:

```solidity
feeManager.setNetworkFee(137, 250); // 2.5% в сети Polygon
```
Текущий размер комиссии можно получить так:
```solidity
uint256 bp = feeManager.getNetworkFee(137);
```
