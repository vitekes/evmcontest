# Architecture

This chapter describes the internal structure of **evmcontest**, the main contracts, patterns, and extension modules.

---

## Contracts & Patterns

### ContestFactory

**ContestFactory** is responsible for:
- Creating new contests (`ContestEscrow` contracts).
- Managing the addresses of `TokenValidator` and `NetworkFeeManager`.
- Storing the list of all escrow instances and their statuses.

**Key methods:**
- `createContest(CreateParams params) → address escrow` — deploys a new `ContestEscrow` and returns its address.
- `getContests() → address[]` — returns an array of all escrow addresses.
- `setTokenValidator(address)` — (owner) updates the token validator.
- `setFeeManager(address)` — (owner) updates the fee manager.

**Events:**
- `ContestCreated(address indexed escrow)`

---

### ContestEscrow

**ContestEscrow** encapsulates the logic of a single contest:
- Accepting prize funds (ETH or ERC-20).
- Declaring winners and distributing prizes.
- Storing contest metadata (`startTime`, `endTime`, `params`).

**Key methods:**
- `initialize(InitParams params)` — called by the factory to set up the contest.
- `declareWinners(address[] winners, uint256[] amounts)` — distributes prizes.
- `claimPrize()` — allows a winner to claim their share.
- `refund()` — returns funds to the organizer if the contest is cancelled.

**Events:**
- `WinnersDeclared(address[] winners, uint256[] amounts)`
- `PrizeClaimed(address indexed user, uint256 amount)`
- `Refunded(address indexed recipient, uint256 amount)`

---

## Extension Modules

### NetworkFeeManager

- Calculates and collects platform fees.
- Supports fixed and percentage-based fees.
- The fee recipient address can be updated via `setFeeRecipient(address)`.

**Key methods:**
- `calculateFee(uint256 amount) → uint256 fee`
- `withdrawFees()` — transfers accumulated fees to the recipient.

---

### TokenValidator

- Verifies that an ERC-20 token meets requirements (`decimals()`, `totalSupply()`, etc.).
- Supports allowlist/blocklist for tokens.

**Key methods:**
- `isValid(address token) → bool`
- `addToAllowlist(address token)` — (owner)
- `removeFromAllowlist(address token)` — (owner)

---

### PrizeManager & PrizeTemplates

- **PrizeManager** handles non-financial prizes (NFTs, badges).
- **PrizeTemplates** provides built-in distribution schemes:
  - `EqualSplit` — equal shares.
  - `TopN` — fixed shares for top ranks.
  - `Custom` — custom shares via `customDistribution`.

**Extensibility:**
1. Implement a new template in `PrizeTemplates`.
2. Use the template’s ID when creating a contest.

---

## Security & Upgradability

### Security
- Uses OpenZeppelin standards.
- Filters malicious tokens via `TokenValidator`.
- Each contest is isolated in its own contract.

### Upgradability
- Does **not** include proxy patterns by default.
- For upgradeable deployments, use OpenZeppelin Upgrades (UUPS/Transparent Proxy).
- Admin functions (`setFeeManager`, `setTokenValidator`) can be moved to a multisig `Governance` contract.

---

*Next: API by Contract*

- [ContestFactory](api/contestFactory.md)
- [ContestEscrow](api/contestEscrow.md)
- [NetworkFeeManager](api/networkFeeManager.md)
- [TokenValidator](api/tokenValidator.md)
- [PrizeTemplates](api/prizeTemplates.md)

---
*Examples: [Examples](examples.md)*