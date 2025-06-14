# NetworkFeeManager

The **NetworkFeeManager** contract calculates and collects platform fees for **evmcontest**.

## Methods

### `calculateFee`

```solidity
function calculateFee(uint256 amount) external view returns (uint256 fee);
```

**Description**: Calculates the fee for a given `amount`.

**Example**

```js
const amount = ethers.utils.parseEther("5");
const fee = await feeManager.calculateFee(amount);
console.log(`Fee for 5 ETH: ${ethers.utils.formatEther(fee)} ETH`);
```

### `collectFee`

```solidity
function collectFee(uint256 amount) external;
```

**Description**: Internal function called by `ContestEscrow` to accumulate fees during prize distribution. Not for external calls.

### `withdrawFees`

```solidity
function withdrawFees() external;
```

**Description**: Withdraws accumulated fees to the `feeRecipient` address.

**Example**

```js
const recipient = await feeManager.feeRecipient();
const before = await ethers.provider.getBalance(recipient);
await feeManager.withdrawFees();
const after = await ethers.provider.getBalance(recipient);
console.log(`Balance before: ${ethers.utils.formatEther(before)} ETH, after: ${ethers.utils.formatEther(after)}`);
```

### `setFeeRecipient`

```solidity
function setFeeRecipient(address recipient) external onlyOwner;
```

**Description**: Sets the address that receives the fees. Owner only.

**Example**

```js
await feeManager.setFeeRecipient(newRecipientAddress);
console.log(`Fee recipient set to ${newRecipientAddress}`);
```

### `setFeePercent`

```solidity
function setFeePercent(uint16 percent) external onlyOwner;
```

**Description**: Updates the fee percentage in hundredths of a percent (e.g., `150` = 1.5%). Owner only.

**Example**

```js
await feeManager.setFeePercent(200); // 2%
console.log("Fee percentage updated to 2%");
```

### `feeRecipient`

```solidity
function feeRecipient() external view returns (address);
```

**Description**: Returns the current fee recipient address.

## Events

- `FeeRecipientChanged(address indexed oldRecipient, address indexed newRecipient)`
- `FeePercentChanged(uint16 oldPercent, uint16 newPercent)`
- `FeesWithdrawn(address indexed recipient, uint256 amount)`

## Recommendations

- Call `withdrawFees` regularly after contests to consolidate fee transfers.
- Consider multisig for `feeRecipient` for added security.


---
*Next: [*TokenValidator*](tokenValidator.md)*