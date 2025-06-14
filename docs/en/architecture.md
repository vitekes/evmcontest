# How it works

The system is composed of several modules:

- **ContestFactory** – creates new contests and deploys an escrow for each of them.
- **ContestEscrow** – cloned contract that stores prizes. Jury or the creator declare winners and funds are released.
- **NetworkFeeManager** – keeps fee rates per network and collects platform fees.
- **TokenValidator** – validates tokens and guards against malicious assets.
- **PrizeManager** – additional module for off‑chain or non monetary prizes.
- **CreatorBadges** – ERC721 contract that mints badges for active creators.

Typical flow:
1. The creator calls `ContestFactory.createContest` with desired parameters and pays the fee.
2. The factory clones `ContestEscrow`, transfers prize tokens and starts the contest.
3. After the end the jury declares winners in the escrow.
4. Winners claim funds or additional prizes via `PrizeManager`.
