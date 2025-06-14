# Examples

This section presents concise integration examples of **evmcontest**. Each scenario is broken into steps with small code snippets.

---

## 1. Node.js: End-to-End Flow (ETH)

**Step 1. Setup**

```js
import { ethers } from "ethers";
import { ContestFactory__factory, ContestEscrow__factory } from "evmcontest";

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const factory = ContestFactory__factory.connect(FACTORY_ADDRESS, wallet);
```

**Step 2. Create Contest**

```js
const now = Math.floor(Date.now() / 1000);
const params = { token: ethers.constants.AddressZero, prizeAmount: ethers.utils.parseEther("10"), template: 0, customDistribution: [], startTime: now + 600, endTime: now + 3600 };
const tx = await factory.createContest(params);
const escrowAddr = (await tx.wait()).events[0].args.escrow;
const escrow = ContestEscrow__factory.connect(escrowAddr, wallet);
```

**Step 3. Fund Escrow**

```js
await escrow.initialize({ ...params, creator: wallet.address }, { value: params.prizeAmount });
```

**Step 4. Declare Winners**

```js
await escrow.declareWinners([addr1, addr2], [ethers.utils.parseEther("6"), ethers.utils.parseEther("4")]);
```

**Step 5. Claim Prizes**

```js
await escrow.connect(winner1).claimPrize();
await escrow.connect(winner2).claimPrize();
```

---

## 2. Node.js: ERC-20 Token Contest

**Step 1. Approve Token**

```js
await token.approve(factory.address, amount);
```

**Step 2. Create & Initialize**

```js
const tx = await factory.createContest({ ...params, token: TOKEN_ADDRESS, prizeAmount: amount });
const escrowAddr = (await tx.wait()).events[0].args.escrow;
const escrow = ContestEscrow__factory.connect(escrowAddr, wallet);
await escrow.initialize({ ...params, creator: wallet.address });
```

---

## 3. Browser DApp (React)

**Connect Wallet**

```tsx
const web3Modal = new Web3Modal();
const instance = await web3Modal.connect();
const provider = new ethers.providers.Web3Provider(instance);
const signer = provider.getSigner();
const factory = ContestFactory__factory.connect(FACTORY_ADDRESS, signer);
```

**Create Contest**

```tsx
const tx = await factory.createContest({ token: AddressZero, prizeAmount: parseEther("1"), template: 0, customDistribution: [], startTime: now + 60, endTime: now + 3600 });
const escrow = (await tx.wait()).events[0].args.escrow;
setEscrowAddress(escrow);
```

---

**For more advanced flows, see:**

- [ContestFactory](api/contestFactory.md)
- [ContestEscrow](api/contestEscrow.md)
- [NetworkFeeManager](api/networkFeeManager.md)
- [TokenValidator](api/tokenValidator.md)
- [PrizeTemplates](api/prizeTemplates.md)

