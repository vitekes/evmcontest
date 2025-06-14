# Project overview

EVMContest is a set of Solidity contracts for running prize contests with ETH or ERC‑20 tokens. Creators can start contests, specify prize distribution rules and safely pay out rewards to winners.  The system aims to be an easy drop‑in component for any Web3 product wishing to host on‑chain competitions.

Besides handling prize funds the contracts keep rich statistics about contest activity and offer optional modules such as NFT badges and off‑chain prize management.  Everything is permissionless: anyone can create a contest provided the chosen token is approved and the platform fee is paid.

Features:

- Create contests through `ContestFactory`.
- Hold prize funds in `ContestEscrow` until completion.
- Use predefined prize templates from `PrizeTemplates`.
- Customize distribution or create your own template with just a few lines of code.
- Collect platform fees via `NetworkFeeManager`.
- Validate tokens using `TokenValidator`.
- Award active creators with NFT badges (`CreatorBadges`).
- Manage additional prizes with `PrizeManager`.
- Pause, resume or cancel contests through built‑in emergency roles.

## Key benefits

- Fully on-chain prize accounting.
- Modular architecture allows replacing or upgrading components individually.
- Built-in spam protection and contest duration limits.
- Designed to work across different EVM-compatible networks.

See [How it works](architecture.md) for a deeper dive into the contract structure.
