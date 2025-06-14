# EVMContest

EVMContest is a toolkit for launching prize competitions on any EVM compatible
network. It bundles a factory for deploying contest escrows, flexible fee
management, token validation and optional modules such as NFT badges and a prize
manager.

The goal is to provide a ready-made component that any DApp can plug into. The system records every contest, collects usage statistics and lets communities reward creators with NFT achievements. Its modular design lets you use only the parts you need or extend the contracts with new features.

The contracts can be integrated into any DApp or backend to launch contests, hold prizes securely and distribute rewards once a jury reaches a decision.

* **ContestFactory** – deploys and controls escrows for each contest.
* **ContestEscrow** – holds prizes and manages winners.
* **NetworkFeeManager** – calculates and collects network fees.
* **TokenValidator** – validates ERC‑20 tokens used in contests.
* **PrizeManager** – keeps track of non‑monetary prizes.
* **CreatorBadges** – ERC‑721 badges for active contest creators.
* **PrizeTemplates** – helper library with common prize distributions.
* 
Contest metadata such as an IPFS description is passed via `contestMetadata` when creating a contest. The string is stored in each escrow and in `PrizeManager` so front ends can display details.


## Getting started

```bash
npm install
```

To run a local Hardhat node and deploy the core contracts:

```bash
npx hardhat node &
npm run deploy:local
```

Tests can be executed with:

```bash
npm run test
```

### Quick demo

Create a contest from a client application:

```javascript
const factory = await ethers.getContract('ContestFactory');
await factory.createContest({
  token: ethers.ZeroAddress,
  totalPrize: ethers.parseEther('5'),
  template: PrizeTemplates.PrizeTemplate.TOP_3,
  customDistribution: [],
  jury: [jury],
  startTime: Math.floor(Date.now() / 1000),
  endTime: Math.floor(Date.now() / 1000) + 3 * 86400,
  contestMetadata: 'ipfs://Qm...'
}, { value: ethers.parseEther('5.1') });

// later
const escrow = await ethers.getContractAt('ContestEscrow', escrowAddress);
await escrow.declareWinners([winner1, winner2, winner3], [1, 2, 3]);
const params = await escrow.getContestParams();
console.log(params.metadata);
```

Each winner then calls `claimPrize()` on the escrow to receive funds.

> Some networks require environment variables. Copy `env-example.js` to `.env` and fill in private keys and RPC URLs.

More documentation is available inside the [docs](docs/) directory in both Russian and English.
Start exploring at docs/en/index.md (English) or docs/ru/index.md (Russian).
