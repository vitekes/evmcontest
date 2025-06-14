# Contest flow

1. The creator calls `ContestFactory.createContest` specifying token, prize amount, prize template, jury and timing.
2. Upon creation the prize is transferred to `ContestEscrow` and a fee is paid to `NetworkFeeManager`.
3. During the contest the jury can declare winners via escrow functions.
4. After winners are declared they call `claimPrize` to receive funds.
5. If the creator cancels the contest, `cancel` refunds the prize.
6. In emergencies the factory can withdraw funds with `emergencyWithdraw`.
