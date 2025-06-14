# Project overview

EVMContest is a set of Solidity contracts for running prize contests with ETH or ERC‑20 tokens. Creators can start contests, specify prize distribution rules and safely pay out rewards to winners.

Features:

- Create contests through `ContestFactory`.
- Hold prize funds in `ContestEscrow` until completion.
- Use predefined prize templates from `PrizeTemplates`.
- Collect platform fees via `NetworkFeeManager`.
- Validate tokens using `TokenValidator`.
- Award active creators with NFT badges (`CreatorBadges`).
- Manage additional prizes with `PrizeManager`.


## Key benefits

- Fully on-chain prize accounting.
- Modular architecture allows replacing or upgrading components individually.
- Built-in spam protection and contest duration limits.
- Designed to work across different EVM-compatible networks.

See [How it works](architecture.md) for a deeper dive into the contract structure.
