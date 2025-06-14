# Contest flow

This guide explains the full lifecycle of a contest from creation to prize payout.

## Creating a contest

Use `ContestFactory.createContest` with the desired parameters. The creator chooses an ERC‑20 token or ETH for the prize, selects a predefined prize template or provides a custom distribution and sets the start and end time.

Example ETH contest (prize in ETH):
```javascript
await factory.createContest({
  token: ethers.ZeroAddress,
  totalPrize: ethers.parseEther('1'),
  template: PrizeTemplates.PrizeTemplate.TOP_3,
  customDistribution: [],
  jury: [jury1, jury2],
  startTime: now,
  endTime: now + 3 * 24 * 3600,
  contestMetadata: 'ipfs://Qm...',
  hasNonMonetaryPrizes: false
}, { value: ethers.parseEther('1.05') }) // includes platform fee
```

Example USDT contest (ERC‑20 prize):
```javascript
await usdt.approve(factory, prize + fee);
await factory.createContest({
  token: usdtAddress,
  totalPrize: prize,
  template: PrizeTemplates.PrizeTemplate.WINNER_TAKES_ALL,
  customDistribution: [],
  jury: [jury1],
  startTime: now,
  endTime: now + 7 * 24 * 3600,
  contestMetadata: 'ipfs://Qm...',
  hasNonMonetaryPrizes: true
});
```

The factory transfers the prize to a new `ContestEscrow` instance and collects the platform fee via `NetworkFeeManager`.

## Running the contest

During the active period participants submit their work off‑chain. The contract does not store entries. The creator may pause and resume the contest if needed.

## Declaring winners

After `endTime` any jury member calls:
```javascript
await escrow.declareWinners([
  winner1,
  winner2,
  winner3
], [1, 2, 3]);
```
The places correspond to the configured prize distribution. The escrow records the winners and finalizes the contest.
After winners are declared you can fetch the original metadata:
```javascript
const info = await escrow.getContestParams();
console.log(info.metadata);
```

## Claiming prizes

Each winner calls `claimPrize()` on the escrow. Funds are paid in the contest token (or ETH). The contract tracks whether a winner already claimed.

## Canceling and emergency withdrawal

Before winners are declared the creator can cancel the contest with `cancel(reason)` and the entire prize is refunded. If a contest becomes stuck the factory owner may call `emergencyWithdraw` from the escrow which transfers remaining funds to the treasury.
