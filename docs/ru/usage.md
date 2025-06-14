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
