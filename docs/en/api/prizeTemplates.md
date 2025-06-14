# PrizeTemplates

The **PrizeTemplates** module provides predefined prize distribution schemes.

## Available Templates

| ID | Name       | Description                                           |
| -- | ---------- | ----------------------------------------------------- |
| 0  | EqualSplit | Distributes prize equally among winners.              |
| 1  | TopN       | Fixed shares for top positions (e.g., 1st, 2nd, 3rd). |
| 2  | Custom     | Custom shares defined by `customDistribution`.        |

### EqualSplit (ID 0)

Equal distribution:

```js
await factory.createContest({ ...params, template: 0 });
```

Prizes are split as `prizeAmount / winners.length`.

### TopN (ID 1)

Fixed distribution for top positions:

```json
[50, 30, 20] // 50% for 1st, 30% for 2nd, 20% for 3rd
```

```js
await factory.createContest({ ...params, template: 1, customDistribution: [50, 30, 20] });
```

### Custom (ID 2)

Custom distribution with arbitrary shares summing to 100:

```js
const custom = [70, 20, 10];
await factory.createContest({ ...params, template: 2, customDistribution: custom });
```

## Creating a Custom Template

1. Implement `IPrizeTemplate` interface:

```solidity
interface IPrizeTemplate {
  function distribute(uint256 totalAmount, address[] calldata winners, uint256[] calldata custom) external pure returns (uint256[] memory amounts);
}
```

2. Register the new template in `PrizeTemplates`:

```solidity
uint8 public constant MY_TEMPLATE = 3;
function distribute(...) internal override returns (...) {
  if (templateId == MY_TEMPLATE) {
    // custom logic
  }
}
```

3. Use `template: 3` when creating contests.

## Recommendations

- Use `EqualSplit` for simple contests.
- Predefine shares for `TopN` templates.
- Extend with custom templates for complex scenarios.

