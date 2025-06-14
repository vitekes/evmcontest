# Prizes and PrizeManager

The `PrizeManager` contract stores information about extra prizes that are not part of the main prize pool. It can be used to distribute promocodes, NFTs or any other rewards.

Important methods:

- `createContest(contestId, metadata)` – register a contest.
- `addPrize(contestId, prizeType, value, metadata, secretHash, expiration)` – add a monetary or non‑monetary prize.
- `claimPrize(contestId, prizeIndex, winner)` – mark a prize as claimed.
- `revealSecret(contestId, prizeIndex, secret)` – reveal secret data (e.g. promocode) to the winner.
- `getContestPrizes(contestId)` – return a structure describing all prizes of a contest.

Prizes can be of type `MONETARY`, `NON_MONETARY` or `PROMOCODE`. When adding a promocode prize you provide only a hash of the secret. The actual code is revealed later with `revealSecret`.

Example of adding a promocode prize:
```solidity
prizeManager.addPrize(contestId, PrizeType.PROMOCODE, 0, 'Gift card', keccak256('code123'), block.timestamp + 30 days);
```

Anyone can query prize details using `getContestPrizes` which returns an array of metadata and claim status.