// ==========================================
// 🪙 ФИКСТУРЫ ДЛЯ ТОКЕНОВ
// ==========================================

import { ethers } from "hardhat";
import { TokenValidator, MockUSDC, MockUSDT, MockWETH } from "../../typechain-types";
import { setupTestAccounts } from "./BaseFixture";

export async function deployTokensOnlyFixture() {
    console.log("🪙 Deploying tokens only for simple tests...");
    
    const accounts = await setupTestAccounts();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDTFactory.deploy();
    await mockUSDT.waitForDeployment();

    const MockWETHFactory = await ethers.getContractFactory("MockWETH");
    const mockWETH = await MockWETHFactory.deploy();
    await mockWETH.waitForDeployment();

    // Минт токенов
    const mintAmount = ethers.parseUnits("100000", 6);
    const ethAmount = ethers.parseEther("100");
    
    const users = [accounts.creator1, accounts.creator2, accounts.participant1, accounts.participant2];
    for (const user of users) {
        await mockUSDC.mint(user.address, mintAmount);
        await mockUSDT.mint(user.address, mintAmount);
        await mockWETH.mint(user.address, ethAmount);
    }

    console.log("✅ Tokens deployed successfully!");

    return {
        mockUSDC: mockUSDC as MockUSDC,
        mockUSDT: mockUSDT as MockUSDT,
        mockWETH: mockWETH as MockWETH,
        ...accounts,
        addresses: {
            mockUSDC: await mockUSDC.getAddress(),
            mockUSDT: await mockUSDT.getAddress(),
            mockWETH: await mockWETH.getAddress()
        }
    };
}

export async function deployTokenValidatorFixture() {
    console.log("🔧 Deploying TokenValidator with dependencies...");
    
    const tokenFixture = await deployTokensOnlyFixture();

    const TokenValidatorFactory = await ethers.getContractFactory("TokenValidator");
    const tokenValidator = await TokenValidatorFactory.deploy(
        tokenFixture.addresses.mockWETH,
        [tokenFixture.addresses.mockUSDC, tokenFixture.addresses.mockUSDT]
    );
    await tokenValidator.waitForDeployment();

    // Добавляем тестовые токены в whitelist сразу после деплоя
    await tokenValidator.setTokenWhitelist(tokenFixture.addresses.mockUSDT, true, "Test USDT");
    await tokenValidator.setTokenWhitelist(tokenFixture.addresses.mockUSDC, true, "Test USDC");

    // Устанавливаем тестовые токены как стейблкоины
    try {
        await tokenValidator.setTokenIsStablecoin(tokenFixture.addresses.mockUSDT, true);
        await tokenValidator.setTokenIsStablecoin(tokenFixture.addresses.mockUSDC, true);
        console.log("✅ Токены добавлены как стейблкоины в TokenValidator");
    } catch (error) {
        console.log(`⚠️ Ошибка при установке стейблкоинов: ${error}`);
    }

    // Опциональные mock контракты для тестов ликвидности
    const MockUniswapV2FactoryFactory = await ethers.getContractFactory("MockUniswapV2Factory");
    const mockUniswapFactory = await MockUniswapV2FactoryFactory.deploy();
    await mockUniswapFactory.waitForDeployment();

    // Создание пулов ликвидности
    try {
        await mockUniswapFactory.createPair(
            tokenFixture.addresses.mockUSDC,
            tokenFixture.addresses.mockWETH
        );
        await mockUniswapFactory.createPair(
            tokenFixture.addresses.mockUSDT,
            tokenFixture.addresses.mockWETH
        );
    } catch (error) {
        console.log("⚠️ Warning: Could not create liquidity pairs");
    }

    console.log("✅ TokenValidator deployed successfully!");

    return {
        ...tokenFixture,
        tokenValidator: tokenValidator as TokenValidator,
        mockUniswapFactory,
        addresses: {
            ...tokenFixture.addresses,
            tokenValidator: await tokenValidator.getAddress(),
            mockUniswapFactory: await mockUniswapFactory.getAddress()
        }
    };
}