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

### Modules in detail

**ContestFactory**
- Validates tokens via `TokenValidator` before allowing a contest to be created.
- Transfers network fees to `NetworkFeeManager` and records the contest ID.
- Issues creator badges automatically when thresholds are met.

**ContestEscrow**
- Holds ERC-20 or native tokens until the contest ends.
- Provides `declareWinners` and `claimPrize` methods to distribute funds.
- Supports emergency withdrawals if the factory enters emergency mode.

**NetworkFeeManager**
- Stores fee percentages per chain and allows the owner to adjust them.
- Keeps a registry of banned creators to prevent abuse.
- Collected fees can be withdrawn to the treasury address.

**PrizeManager**
- Keeps metadata for off-chain prizes (promo codes, NFTs, etc.).
- Optionally integrates with a backend via emitted events.

**TokenValidator**
- Maintains a whitelist and blacklist of tokens.
- Can store liquidity info to discourage illiquid assets.
- Includes a stablecoin list for more accurate price conversions.

**CreatorBadges**
- ERC-721 token where each badge type corresponds to a constant ID.
- Automatically mints when certain milestones are reached.

For a practical example of contract interactions see the [Usage guide](usage.md).
