// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPrizeManager {
    enum PrizeType {
        MONETARY,        // Денежные призы (ETH/ERC20)
        PROMOCODE,       // Промокоды
        PRIVILEGE,       // Привилегии на сайте
        NFT,            // NFT призы
        EXTERNAL        // Внешние награды
    }
    
    struct Prize {
        PrizeType prizeType;
        uint256 monetaryValue;      // Для денежных призов
        string metadata;            // JSON с описанием неденежного приза
        bool claimed;               // Получен ли приз
        bytes32 secretHash;         // Хеш секретных данных (промокод)
        uint256 expirationDate;     // Дата истечения
    }
    
    struct ContestPrizes {
        Prize[] prizes;
        uint256 totalMonetaryValue;
        bool hasNonMonetaryPrizes;
        string contestMetadata;     // Общее описание конкурса
    }
    
    function addPrize(
        uint256 contestId,
        PrizeType prizeType,
        uint256 monetaryValue,
        string calldata metadata,
        bytes32 secretHash,
        uint256 expirationDate
    ) external;
    
    function claimPrize(uint256 contestId, uint256 prizeIndex, address winner) external;
    function revealSecret(uint256 contestId, uint256 prizeIndex, string calldata secret) external;
    function getContestPrizes(uint256 contestId) external view returns (ContestPrizes memory);
}