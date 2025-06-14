# Creator badges

`CreatorBadges` mints NFT badges to reward active contest creators. The contract keeps statistics such as number of contests and total prize volume.

Available badges:

1. `FIRST_CONTEST` – first contest created.
2. `CONTEST_VETERAN` – 10 or more contests.
3. `CONTEST_MASTER` – over 50 contests.
4. `BIG_SPENDER` – prizes totaling 10,000+ ETH.
5. `WHALE` – prizes totaling 100,000+ ETH.
6. `VERIFIED_CREATOR` – manual verified status.
7. `EARLY_ADOPTER` – among the first 100 creators.

The badge contract emits events whenever a new badge is minted. Interfaces or front ends can listen to these events to show achievements to users. Badges are non-transferable to prevent trading.

Example check for a badge:
```solidity
bool hasBadge = badges.balanceOf(user, BADGE_ID) > 0;
```
