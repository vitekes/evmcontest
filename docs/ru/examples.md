# Примеры использования

В этой секции представлены компактные примеры интеграции **evmcontest**. Каждый сценарий разбит по шагам и снабжён короткими фрагментами кода.

---

## 1. Node.js: end-to-end сценарий

**Шаг 1. Подключение и инициализация**

```js
import { ethers } from "ethers";
import { ContestFactory__factory, ContestEscrow__factory } from "evmcontest";

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const factory = ContestFactory__factory.connect(FACTORY_ADDRESS, wallet);
```

**Шаг 2. Создание конкурса**

```js
const params = {
    token: ethers.constants.AddressZero,       // ETH
    prizeAmount: ethers.utils.parseEther("10"),
    template: 0,
    customDistribution: [],
    startTime: now + 600,
    endTime: now + 3600,
};
const tx = await factory.createContest(params);
const escrowAddr = (await tx.wait()).events[0].args.escrow;
const escrow = ContestEscrow__factory.connect(escrowAddr, wallet);
```

**Шаг 3. Инициализация призового фонда**

```js
await escrow.initialize({ ...params, creator: wallet.address }, { value: params.prizeAmount });
```

**Шаг 4. Завершение конкурса**

```js
// после времени окончания\await escrow.declareWinners([addr1, addr2], [six, four]);
```

**Шаг 5. Получение призов**

```js
await escrow.connect(winner1).claimPrize();
await escrow.connect(winner2).claimPrize();
```

---

## 2. Node.js: конкурс с ERC-20 токеном

**Подготовка токена**

```js
await token.approve(factory.address, amount);
```

**Создание и инициализация**

```js
await factory.createContest({ ...params, token: TOKEN_ADDRESS, prizeAmount: amount });
await escrow.initialize({ ...params, creator: wallet.address });
```

---

## 3. Browser DApp (React)

**Подключение кошелька**

```tsx
const web3Modal = new Web3Modal();
const instance = await web3Modal.connect();
const provider = new ethers.providers.Web3Provider(instance);
const signer = provider.getSigner();
const factory = ContestFactory__factory.connect(FACTORY_ADDRESS, signer);
```

**Создание конкурса**

```tsx
const tx = await factory.createContest({
    token: AddressZero,
    prizeAmount: parseEther("1"),
    template: 0,
    customDistribution: [],
    startTime: now + 60,
    endTime: now + 3600,
});
const escrow = (await tx.wait()).events[0].args.escrow;
setEscrowAddress(escrow);
```

---

*Для более сложных сценариев смотрите:\

- [ContestFactory](api/contestFactory.md)
- [ContestEscrow](api/contestEscrow.md)
- [NetworkFeeManager](api/networkFeeManager.md)
- [TokenValidator](api/tokenValidator.md)
- [PrizeTemplates](api/prizeTemplates.md)

---
*Далее: [Тесты](testing.md)*
