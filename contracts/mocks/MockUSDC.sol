// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockERC20.sol";
import "./MockConstants.sol";

contract MockUSDC is MockERC20 {
    constructor() MockERC20(
        MockConstants.USDC_NAME,
        MockConstants.USDC_SYMBOL,
        MockConstants.USDC_DECIMALS,
        MockConstants.INITIAL_USDC_SUPPLY
    ) {
        // 1M USDC с 6 decimals
    }
    
    /// @notice Получить стандартную цену USDC для тестов
    /// @return Цена в формате Chainlink (8 знаков)
    function getTestPrice() external pure returns (int256) {
        return MockConstants.USDC_PRICE_USD;
    }
}