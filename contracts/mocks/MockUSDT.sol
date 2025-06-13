// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockERC20.sol";
import "./MockConstants.sol";

contract MockUSDT is MockERC20 {
    constructor() MockERC20(
        MockConstants.USDT_NAME,
        MockConstants.USDT_SYMBOL,
        MockConstants.USDT_DECIMALS,
        MockConstants.INITIAL_USDT_SUPPLY
    ) {
        // 1M USDT с 6 decimals
    }
    
    /// @notice Получить стандартную цену USDT для тестов
    /// @return Цена в формате Chainlink (8 знаков)
    function getTestPrice() external pure returns (int256) {
        return MockConstants.USDT_PRICE_USD;
    }
}