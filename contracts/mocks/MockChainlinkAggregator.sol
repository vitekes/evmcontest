// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockConstants.sol";

contract MockChainlinkAggregator {
    int256 private _price;
    uint8 private _decimals;
    uint256 private _updatedAt;
    
    /// @notice Создать агрегатор с предустановленной ценой для конкретного токена
    /// @param tokenSymbol Символ токена ("ETH", "USDC", "USDT", "WETH")
    constructor(string memory tokenSymbol) {
        _decimals = MockConstants.CHAINLINK_DECIMALS;
        _updatedAt = block.timestamp;
        
        if (keccak256(abi.encodePacked(tokenSymbol)) == keccak256(abi.encodePacked("ETH"))) {
            _price = MockConstants.ETH_PRICE_USD;
        } else if (keccak256(abi.encodePacked(tokenSymbol)) == keccak256(abi.encodePacked("USDC"))) {
            _price = MockConstants.USDC_PRICE_USD;
        } else if (keccak256(abi.encodePacked(tokenSymbol)) == keccak256(abi.encodePacked("USDT"))) {
            _price = MockConstants.USDT_PRICE_USD;
        } else if (keccak256(abi.encodePacked(tokenSymbol)) == keccak256(abi.encodePacked("WETH"))) {
            _price = MockConstants.WETH_PRICE_USD;
        } else {
            _price = 1 * 1e8; // По умолчанию $1
        }
    }
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 price,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (
            MockConstants.DEFAULT_ROUND_ID,
            _price,
            _updatedAt,
            _updatedAt,
            MockConstants.DEFAULT_ROUND_ID
        );
    }
    
    function decimals() external view returns (uint8) {
        return _decimals;
    }
    
    // Функции для тестов
    function setPrice(int256 newPrice) external {
        _price = newPrice;
        _updatedAt = block.timestamp;
    }
    
    function setUpdatedAt(uint256 timestamp) external {
        _updatedAt = timestamp;
    }
}