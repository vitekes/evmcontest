// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IPrizeManager.sol";

contract MockPrizeManager is IPrizeManager {
    mapping(uint256 => ContestPrizes) public contestPrizes;
    mapping(uint256 => address) public contestCreators;
    
    function createContest(uint256 contestId, string calldata metadata) external {
        contestCreators[contestId] = msg.sender;
        contestPrizes[contestId].contestMetadata = metadata;
    }
    
    function addPrize(
        uint256 contestId,
        PrizeType prizeType,
        uint256 monetaryValue,
        string calldata metadata,
        bytes32 secretHash,
        uint256 expirationDate
    ) external override {
        Prize memory newPrize = Prize({
            prizeType: prizeType,
            monetaryValue: monetaryValue,
            metadata: metadata,
            claimed: false,
            secretHash: secretHash,
            expirationDate: expirationDate
        });
        
        contestPrizes[contestId].prizes.push(newPrize);
        
        if (prizeType == PrizeType.MONETARY) {
            contestPrizes[contestId].totalMonetaryValue += monetaryValue;
        } else {
            contestPrizes[contestId].hasNonMonetaryPrizes = true;
        }
    }
    
    function claimPrize(uint256 contestId, uint256 prizeIndex, address /* winner */) external override {
        require(prizeIndex < contestPrizes[contestId].prizes.length, "Invalid prize index");
        contestPrizes[contestId].prizes[prizeIndex].claimed = true;
        
        // Эмитируем событие для неденежных призов
        Prize memory prize = contestPrizes[contestId].prizes[prizeIndex];
        if (prize.prizeType != PrizeType.MONETARY) {
            // В реальной реализации здесь будет emit PromocodeRequested
        }
    }
    
    function revealSecret(uint256 contestId, uint256 prizeIndex, string calldata secret) external view override {
        Prize storage prize = contestPrizes[contestId].prizes[prizeIndex];
        require(prize.claimed, "Prize not claimed yet");
        require(keccak256(abi.encodePacked(secret)) == prize.secretHash, "Invalid secret");
        // Секрет верифицирован
    }
    
    function getContestPrizes(uint256 contestId) external view override returns (ContestPrizes memory) {
        return contestPrizes[contestId];
    }
}