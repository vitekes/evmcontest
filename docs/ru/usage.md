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
```

После объявления победителей вызывайте `claimPrize` в эскроу, чтобы забрать награду.
