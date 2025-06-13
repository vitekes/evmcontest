import {buildModule} from "@nomicfoundation/hardhat-ignition/modules";

const MockModule = buildModule("MockModule", (m) => {
    console.log("🧪 Деплой Mock токенов для локальной разработки...");

    // =============================================
    // ДЕПЛОЙ MOCK ТОКЕНОВ
    // =============================================

    // Mock USDC (6 decimals)
    const mockUSDC = m.contract("MockERC20", [
        "Mock USD Coin",
        "USDC",
        6,
        "1000000000000000" // 1 миллиард USDC для тестов
    ]);

    // Mock USDT (6 decimals)
    const mockUSDT = m.contract("MockERC20", [
        "Mock Tether USD",
        "USDT",
        6,
        "1000000000000000" // 1 миллиард USDT для тестов
    ]);

    // Mock WETH (18 decimals)
    const mockWETH = m.contract("MockERC20", [
        "Mock Wrapped Ether",
        "WETH",
        18,
        "1000000000000000000000000" // 1 миллион WETH для тестов
    ]);

    // =============================================
    // MOCK PRICE FEEDS (для локального тестирования)
    // =============================================

    // Mock Chainlink price feeds
    const usdcPriceFeed = m.contract("MockPriceFeed", [
        8, // decimals
        "100000000" // $1.00 с 8 decimals (1 * 10^8)
    ]);

    const usdtPriceFeed = m.contract("MockPriceFeed", [
        8,
        "100000000" // $1.00
    ]);

    const wethPriceFeed = m.contract("MockPriceFeed", [
        8,
        "250000000000" // $2500 с 8 decimals (2500 * 10^8)
    ]);

    // =============================================
    // ВСПОМОГАТЕЛЬНЫЕ КОНТРАКТЫ ДЛЯ ТЕСТОВ
    // =============================================

    // Контракт для раздачи токенов в тестах
    const testHelper = m.contract("TestHelper", [
        mockUSDC,
        mockUSDT,
        mockWETH
    ]);

    // Factory для создания новых mock токенов если нужно
    const mockFactory = m.contract("MockTokenFactory");

    console.log("✅ Mock токены развернуты!");
    console.log(`📄 Mock USDC: ${mockUSDC}`);
    console.log(`📄 Mock USDT: ${mockUSDT}`);
    console.log(`📄 Mock WETH: ${mockWETH}`);

    return {
        // Mock токены
        mockUSDC,
        mockUSDT,
        mockWETH,

        // Mock price feeds
        usdcPriceFeed,
        usdtPriceFeed,
        wethPriceFeed,

        // Вспомогательные контракты
        testHelper,
        mockFactory
    };
});

export default MockModule;