# Флоу конкурса

Руководство описывает все этапы проведения конкурса — от создания до выплаты призов.

## Создание конкурса

Вызовите `ContestFactory.createContest`, указав параметры. Создатель выбирает призовой токен ERC‑20 или ETH, шаблон распределения или собственную схему, а также время начала и окончания.

Пример конкурса с призом в ETH:
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
}, { value: ethers.parseEther('1.05') }) // вместе с комиссией
```

Пример конкурса с призом в USDT (ERC‑20):
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

Factory переводит приз в новый `ContestEscrow` и списывает комиссию через `NetworkFeeManager`.

## Проведение конкурса

Участники подают заявки вне блокчейна — контракты их не хранят. Создатель может приостанавливать и возобновлять конкурс при необходимости.

## Выбор победителей

После `endTime` любой член жюри вызывает:
```javascript
await escrow.declareWinners([
  winner1,
  winner2,
  winner3
], [1, 2, 3]);
```
Номера мест должны соответствовать схеме распределения приза. Эскроу сохраняет победителей и финализирует конкурс.

## Получение призов

Каждый победитель вызывает `claimPrize()` в эскроу. Средства выдаются в токене конкурса либо в ETH. Контракт отмечает, получил ли победитель награду.

## Отмена и экстренное изъятие

Пока победители не объявлены, создатель может отменить конкурс через `cancel(reason)` — приз полностью возвращается. Если конкурс завис, владелец фабрики может вызвать `emergencyWithdraw`, чтобы перевести оставшиеся средства в казну.
