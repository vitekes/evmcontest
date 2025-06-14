# ContestEscrow

The **ContestEscrow** contract manages the lifecycle of an individual contest: accepting funds, declaring winners, and
distributing prizes.

## Lifecycle

1. **Initialization**: `initialize` is called immediately after deployment.
2. **Funding Period** (`startTime` → `endTime`): participants deposit the prize fund.
3. **Contest Completion**: organizer calls `declareWinners`.
4. **Prize Claiming**: winners call `claimPrize`.
5. **Refund**: organizer can cancel the contest before start and refund the prize.

## Methods

### `initialize`

```solidity
function initialize(InitParams calldata params) external payable;
```

**Description**: Sets contest parameters and deposits the prize fund.

**Parameters** (`InitParams`):

| Field                | Type        | Description                                  |
|----------------------|-------------|----------------------------------------------|
| `creator`            | `address`   | Contest organizer.                           |
| `token`              | `address`   | ERC-20 token address or `0x000...0` for ETH. |
| `prizeAmount`        | `uint256`   | Prize fund amount.                           |
| `template`           | `uint8`     | Distribution template ID.                    |
| `customDistribution` | `uint256[]` | Array of custom shares.                      |
| `startTime`          | `uint256`   | UNIX timestamp for start.                    |
| `endTime`            | `uint256`   | UNIX timestamp for end.                      |

**Example (ETH)**

```js
await escrow.initialize(
    {...params, creator: wallet.address},
    {value: params.prizeAmount}
);
```

**Example (ERC-20)**

```js
await tokenContract.approve(escrow.address, params.prizeAmount);
await escrow.initialize({...params, creator: wallet.address});
```

### `declareWinners`

```solidity
function declareWinners(address[] calldata winners, uint256[] calldata amounts) external;
```

**Description**: Completes the contest after `endTime`, recording winners and their prizes.

**Example**

```js
if (Math.floor(Date.now() / 1000) >= params.endTime) {
    await escrow.declareWinners(
        [addr1, addr2],
        [ethers.utils.parseEther("6"), ethers.utils.parseEther("4")]
    );
}
```

### `claimPrize`

```solidity
function claimPrize() external;
```

**Description**: Allows a winner to claim their prize share after `declareWinners`.

**Example**

```js
await escrow.connect(winnerWallet).claimPrize();
```

### `refund`

```solidity
function refund() external;
```

**Description**: Returns the prize fund to the organizer before the contest starts or if canceled.

**Example**

```js
await escrow.refund();
```

## Events

- `WinnersDeclared(address[] winners, uint256[] amounts)` — emitted when winners are declared.
- `PrizeClaimed(address indexed user, uint256 amount)` — emitted when a prize is claimed.
- `Refunded(address indexed recipient, uint256 amount)` — emitted when funds are refunded.

## Notes

- `initialize` is `payable` for ETH or requires `approve` for ERC-20.
- After `declareWinners`, `refund` is disabled.
- Ensure the sum of `amounts` equals the prize fund minus fees.

---

*Next: [*NetworkFeeManager*](networkFeeManager.md)*