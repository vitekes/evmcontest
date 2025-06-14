# Prizes and PrizeManager

The `PrizeManager` contract stores information about extra prizes that are not part of the main prize pool. It can be used to distribute promocodes, NFTs or any other rewards.

Important methods:

- `createContest(contestId, metadata)` – register a contest.
- `addPrize(contestId, prizeType, value, metadata, secretHash, expiration)` – add a monetary or non‑monetary prize.
- `claimPrize(contestId, prizeIndex, winner)` – mark a prize as claimed.
- `revealSecret(contestId, prizeIndex, secret)` – reveal secret data (e.g. promocode) to the winner.
- `getContestPrizes(contestId)` – return a structure describing all prizes of a contest.
