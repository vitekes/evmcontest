// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockERC20.sol";
import "./MockConstants.sol";

contract MockWETH is MockERC20 {
    constructor() MockERC20(
        MockConstants.WETH_NAME,
        MockConstants.WETH_SYMBOL,
        MockConstants.WETH_DECIMALS,
        MockConstants.INITIAL_WETH_SUPPLY
    ) {
        // 1M WETH
    }
    
    /// @notice Получить стандартную цену WETH для тестов
    /// @return Цена в формате Chainlink (8 знаков)
    function getTestPrice() external pure returns (int256) {
        return MockConstants.WETH_PRICE_USD;
    }
    
    // Добавляем функции deposit/withdraw для совместимости с WETH
    receive() external payable {
        _mint(msg.sender, msg.value);
    }
    
    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }
    
    function withdraw(uint256 amount) external {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }
}