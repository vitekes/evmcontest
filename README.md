# EVMContest

A set of Solidity smart contracts and scripts for running prize contests on EVM compatible networks. The project provides a factory for deploying contest escrows, fee management, token validation and additional modules such as creator badges and prize manager.

* **ContestFactory** – deploys and controls escrows for each contest.
* **ContestEscrow** – holds prizes and manages winners.
* **NetworkFeeManager** – calculates and collects network fees.
* **TokenValidator** – validates ERC‑20 tokens used in contests.
* **PrizeManager** – keeps track of non‑monetary prizes.
* **CreatorBadges** – ERC‑721 badges for active contest creators.

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

> Some networks require environment variables. Copy `env-example.js` to `.env` and fill in private keys and RPC URLs.

More documentation is available inside the [docs](docs/) directory in both Russian and English.
Start exploring at docs/en/index.md (English) or docs/ru/index.md (Russian).

