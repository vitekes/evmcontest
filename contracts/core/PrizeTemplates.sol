// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PrizeTemplates {
    
    enum PrizeTemplate {
        WINNER_TAKES_ALL,    // 1 место: 100%
        TOP_2,               // 1-е: 70%, 2-е: 30%
        TOP_3,               // 1-е: 50%, 2-е: 30%, 3-е: 20%
        TOP_5,               // 1-е: 40%, 2-е: 25%, 3-е: 20%, 4-е: 10%, 5-е: 5%
        CUSTOM               // Пользователь задает сам
    }
    
    struct PrizeDistribution {
        uint256 place;           // 1, 2, 3...
        uint256 percentage;      // В базисных пунктах (5000 = 50%)
        string description;      // "1st Place", "Runner-up", etc.
    }
    
    function getTemplate(PrizeTemplate template) external pure returns (PrizeDistribution[] memory) {
        if (template == PrizeTemplate.WINNER_TAKES_ALL) {
            PrizeDistribution[] memory dist = new PrizeDistribution[](1);
            dist[0] = PrizeDistribution(1, 10000, "Winner Takes All");
            return dist;
        }
        
        if (template == PrizeTemplate.TOP_2) {
            PrizeDistribution[] memory dist = new PrizeDistribution[](2);
            dist[0] = PrizeDistribution(1, 7000, "1st Place");
            dist[1] = PrizeDistribution(2, 3000, "2nd Place");
            return dist;
        }
        
        if (template == PrizeTemplate.TOP_3) {
            PrizeDistribution[] memory dist = new PrizeDistribution[](3);
            dist[0] = PrizeDistribution(1, 5000, "1st Place");
            dist[1] = PrizeDistribution(2, 3000, "2nd Place");
            dist[2] = PrizeDistribution(3, 2000, "3rd Place");
            return dist;
        }
        
        if (template == PrizeTemplate.TOP_5) {
            PrizeDistribution[] memory dist = new PrizeDistribution[](5);
            dist[0] = PrizeDistribution(1, 4000, "1st Place");
            dist[1] = PrizeDistribution(2, 2500, "2nd Place");
            dist[2] = PrizeDistribution(3, 2000, "3rd Place");
            dist[3] = PrizeDistribution(4, 1000, "4th Place");
            dist[4] = PrizeDistribution(5, 500, "5th Place");
            return dist;
        }
        
        // CUSTOM - возвращаем пустой массив
        return new PrizeDistribution[](0);
    }
    
    function validateCustomDistribution(PrizeDistribution[] calldata distribution) external pure returns (bool) {
        require(distribution.length > 0 && distribution.length <= 10, "Invalid number of places");
        
        uint256 totalPercentage = 0;
        for (uint i = 0; i < distribution.length; i++) {
            require(distribution[i].place > 0, "Invalid place");
            require(distribution[i].percentage > 0, "Invalid percentage");
            totalPercentage += distribution[i].percentage;
        }
        
        require(totalPercentage == 10000, "Total must be 100%");
        return true;
    }
}