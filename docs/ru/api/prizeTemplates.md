# PrizeTemplates

Модуль **PrizeTemplates** предоставляет шаблоны распределения призового фонда.

## Доступные шаблоны

| ID | Название   | Описание                                                                   |
|----|------------|----------------------------------------------------------------------------|
| 0  | EqualSplit | Равномерное распределение между всеми победителями.                        |
| 1  | TopN       | Фиксированное распределение для топовых позиций (например, 1-е, 2-е, 3-е). |
| 2  | Custom     | Кастомное распределение по массиву `customDistribution`.                   |

### EqualSplit (ID 0)

Равномерное распределение призового фонда:

```js
await factory.createContest({...params, template: 0});
```

Все победители получают `prizeAmount / winners.length`.

### TopN (ID 1)

Шаблон с фиксированными долями:

```js
// Пример распределения: 1-е место 50%, 2-е — 30%, 3-е — 20%
[50, 30, 20]
```

```js
await factory.createContest({
    ...params,
    template: 1,
    customDistribution: [50, 30, 20]
});
```

### Custom (ID 2)

Кастомное распределение, заданное произвольным массивом долей. Сумма всех элементов должна быть равна `100` (100%).

```js
const custom = [70, 20, 10];
await factory.createContest({
    ...params,
    template: 2,
    customDistribution: custom
});
```

## Создание собственного шаблона

1. Реализуйте интерфейс `IPrizeTemplate` в новом контракте:

```solidity
interface IPrizeTemplate {
    function distribute(uint256 totalAmount, address[] calldata winners, uint256[] calldata custom) external pure returns (uint256[] memory amounts);
}
```

2. Добавьте новый шаблон в `PrizeTemplates`:

```solidity
uint8 public constant MY_TEMPLATE = 3;
    function customDistribution(uint8 templateId, ...) internal override returns (...) {
    if (templateId == MY_TEMPLATE) {
    // логика распределения
    }
}
```

3. Используйте `template: 3` при создании конкурса.

## Рекомендации

- Для простых конкурсов используйте `EqualSplit`.
- Для топовых состязаний (`TopN`) заранее определите доли.
- При сложных сценариях экспортируйте новую реализацию `IPrizeTemplate`.

