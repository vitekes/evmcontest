# Contest flow

1. The creator calls `ContestFactory.createContest` specifying token, prize amount, prize template, jury and timing.
2. Upon creation the prize is transferred to `ContestEscrow` and a fee is paid to `NetworkFeeManager`.
3. During the contest the jury can declare winners via escrow functions.
4. After winners are declared they call `claimPrize` to receive funds.
5. If the creator cancels the contest, `cancel` refunds the prize.
6. In emergencies the factory can withdraw funds with `emergencyWithdraw`.

A typical contest lasts from several hours to several months. The minimum and maximum duration are enforced by the factory so that extremely long contests are not allowed.

During the active phase the creator can pause the contest if a problem occurs. When paused, no new winners can be declared until the creator resumes it.

If the jury fails to declare winners before the end time, the creator may cancel the contest and withdraw the prize. Alternatively the factory owner can step in with an emergency withdrawal.

