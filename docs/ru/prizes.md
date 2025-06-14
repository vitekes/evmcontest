# Призы и PrizeManager

Контракт `PrizeManager` хранит информацию о дополнительных призах, которые не являются частью основного денежного фонда. С его помощью можно раздавать промокоды, NFT или другие награды.

Ключевые методы:

- `createContest(contestId, metadata)` — регистрация конкурса.
- `addPrize(contestId, prizeType, value, metadata, secretHash, expiration)` — добавление неденежного или денежного приза.
- `claimPrize(contestId, prizeIndex, winner)` — отметка получения приза.
- `revealSecret(contestId, prizeIndex, secret)` — раскрытие секрета (например, промокода) победителю.
- `getContestPrizes(contestId)` — получение структуры с перечнем всех призов конкурса.
