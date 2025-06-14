# Призы и PrizeManager

Контракт `PrizeManager` хранит информацию о дополнительных призах, которые не являются частью основного денежного фонда. С его помощью можно раздавать промокоды, NFT или другие награды.

Ключевые методы:

- `createContest(contestId, metadata)` — регистрация конкурса.
- `addPrize(contestId, prizeType, value, metadata, secretHash, expiration)` — добавление неденежного или денежного приза.
- `claimPrize(contestId, prizeIndex, winner)` — отметка получения приза.
- `revealSecret(contestId, prizeIndex, secret)` — раскрытие секрета (например, промокода) победителю.
- `getContestPrizes(contestId)` — получение структуры с перечнем всех призов конкурса.

Призы могут быть трёх типов: `MONETARY`, `NON_MONETARY` и `PROMOCODE`. В случае промокода хранится лишь хэш секрета, а реальное значение открывается функцией `revealSecret`.

Пример добавления промокода:
```solidity
prizeManager.addPrize(contestId, PrizeType.PROMOCODE, 0, 'Gift card', keccak256('code123'), block.timestamp + 30 days);
```

Получить сведения о призах можно через `getContestPrizes`, который возвращает массив структур с метаданными и статусом получения.
