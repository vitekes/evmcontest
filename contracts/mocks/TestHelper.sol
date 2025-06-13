// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockConstants.sol";
import "./MockFactory.sol";

/// @title TestHelper - Вспомогательный контракт для тестов
/// @notice Предоставляет удобные функции для настройки тестовых сценариев
contract TestHelper {
    MockFactory public immutable mockFactory;
    
    constructor() {
        mockFactory = new MockFactory();
    }
    
    /// @notice Инициализирует полную тестовую среду
    function initTestEnvironment() external returns (MockFactory.MockContracts memory) {
        return mockFactory.deployAllMocks();
    }
    
    /// @notice Выдает тестовые токены указанному адресу
    /// @param recipient Получатель токенов
    /// @param usdcAmount Количество USDC (в wei с учетом 6 decimals)
    /// @param usdtAmount Количество USDT (в wei с учетом 6 decimals)
    /// @param wethAmount Количество WETH (в wei с учетом 18 decimals)
    function mintTestTokens(
        address recipient,
        uint256 usdcAmount,
        uint256 usdtAmount,
        uint256 wethAmount
    ) public {  // ✅ ИСПРАВЛЕНО: изменили с external на public
        MockFactory.MockContracts memory contracts = mockFactory.contracts();
        
        if (usdcAmount > 0) {
            contracts.usdc.mint(recipient, usdcAmount);
        }
        if (usdtAmount > 0) {
            contracts.usdt.mint(recipient, usdtAmount);
        }
        if (wethAmount > 0) {
            contracts.weth.mint(recipient, wethAmount);
        }
    }
    
    /// @notice Выдает стандартный набор тестовых токенов
    /// @param recipient Получатель
    function mintStandardTestTokens(address recipient) external {
        mintTestTokens(  // ✅ Теперь этот вызов будет работать
            recipient,
            100000 * 10**MockConstants.USDC_DECIMALS,  // 100k USDC
            100000 * 10**MockConstants.USDT_DECIMALS,  // 100k USDT
            1000 * 10**MockConstants.WETH_DECIMALS     // 1k WETH
        );
    }
}