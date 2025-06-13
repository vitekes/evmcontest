// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library MockConstants {
    // Начальные запасы токенов
    uint256 public constant INITIAL_USDC_SUPPLY = 1000000 * 10**6;  // 1M USDC
    uint256 public constant INITIAL_USDT_SUPPLY = 1000000 * 10**6;  // 1M USDT  
    uint256 public constant INITIAL_WETH_SUPPLY = 1000000 * 10**18; // 1M WETH
    
    // Decimals для разных токенов
    uint8 public constant USDC_DECIMALS = 6;
    uint8 public constant USDT_DECIMALS = 6;
    uint8 public constant WETH_DECIMALS = 18;
    
    // Стандартные цены для тестов (в формате Chainlink с 8 знаками)
    int256 public constant ETH_PRICE_USD = 2000 * 1e8;      // $2,000
    int256 public constant USDC_PRICE_USD = 1 * 1e8;        // $1.00
    int256 public constant USDT_PRICE_USD = 1 * 1e8;        // $1.00
    int256 public constant WETH_PRICE_USD = 2000 * 1e8;     // $2,000
    
    // Минимальная ликвидность для тестов
    uint256 public constant MINIMUM_LIQUIDITY = 10000 * 1e18; // $10,000
    
    // Chainlink decimals
    uint8 public constant CHAINLINK_DECIMALS = 8;
    
    // Chainlink round ID для тестов
    uint80 public constant DEFAULT_ROUND_ID = 1;
    
    // Названия токенов
    string public constant ETH_NAME = "Ethereum";
    string public constant ETH_SYMBOL = "ETH";
    string public constant USDC_NAME = "USD Coin";
    string public constant USDC_SYMBOL = "USDC";
    string public constant USDT_NAME = "Tether USD";
    string public constant USDT_SYMBOL = "USDT";
    string public constant WETH_NAME = "Wrapped Ether";
    string public constant WETH_SYMBOL = "WETH";
}