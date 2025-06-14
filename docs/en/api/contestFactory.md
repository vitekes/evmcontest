# ContestFactory

The **ContestFactory** contract is responsible for creating and managing contests.

## Methods

### `createContest`

```solidity
function createContest(CreateParams calldata params) external returns (address escrow);
```

**Description**: Deploys a new `ContestEscrow` contract with the specified parameters.

**Parameters** (`CreateParams`):

| Field                | Type        | Description                                                |
| -------------------- | ----------- | ---------------------------------------------------------- |
| `token`              | `address`   | Address of the ERC-20 token or `0x000...0` for ETH.        |
| `prizeAmount`        | `uint256`   | Prize amount in wei or token's smallest units.             |
| `template`           | `uint8`     | Distribution template ID (0=EqualSplit, 1=TopN, 2=Custom). |
| `customDistribution` | `uint256[]` | Array of shares for the Custom template (sums to 100).     |
| `startTime`          | `uint256`   | UNIX timestamp for contest start.                          |
| `endTime`            | `uint256`   | UNIX timestamp for contest end.                            |

**Examples**

**ETH Contest**

```js
const params = {
  token: ethers.constants.AddressZero,
  prizeAmount: ethers.utils.parseEther("10"),
  template: 0,
  customDistribution: [],
  startTime: Math.floor(Date.now() / 1000) + 600,
  endTime: Math.floor(Date.now() / 1000) + 3600,
};

const tx = await factory.createContest(params);
const receipt = await tx.wait();
const escrowAddress = receipt.events[0].args.escrow;
console.log("Escrow address:", escrowAddress);
```

**ERC-20 Contest (USDT)**

```js
await usdt.approve(factory.address, ethers.utils.parseUnits("1000", 6));
const tx = await factory.createContest({
  token: USDT_ADDRESS,
  prizeAmount: ethers.utils.parseUnits("1000", 6),
  template: 1,
  customDistribution: [],
  startTime: Math.floor(Date.now() / 1000) + 300,
  endTime: Math.floor(Date.now() / 1000) + 7200,
});
const receipt = await tx.wait();
console.log("USDT Contest Escrow:", receipt.events[0].args.escrow);
```

### `getContests`

```solidity
function getContests() external view returns (address[] memory);
```

**Description**: Returns an array of all deployed `ContestEscrow` addresses.

**Example**

```js
const contests = await factory.getContests();
console.log("All contests:", contests);
```

### Administrative Functions

#### `setTokenValidator`

```solidity
function setTokenValidator(address validator) external onlyOwner;
```

**Description**: Updates the `TokenValidator` contract address. Only callable by the owner.

**Example**

```js
await factory.setTokenValidator(validatorAddress);
console.log("TokenValidator updated to", validatorAddress);
```

#### `setFeeManager`

```solidity
function setFeeManager(address feeManager) external onlyOwner;
```

**Description**: Updates the `NetworkFeeManager` contract address. Only callable by the owner.

**Example**

```js
await factory.setFeeManager(feeManagerAddress);
console.log("NetworkFeeManager updated to", feeManagerAddress);
```

## Events

### `ContestCreated`

```solidity
event ContestCreated(address indexed escrow);
```

Emitted when a new contest is created.

---
*Next: *[*ContestEscrow*](contestEscrow.md)