import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { deployTokenValidatorFixture } from "../fixtures";

// Константа для нулевого адреса (аналог ethers.ZeroAddress)
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Тесты для контракта TokenValidator
 * 
 * TokenValidator реализует интерфейс ITokenValidator и добавляет дополнительную функциональность
 * для управления whitelist'ом, blacklist'ом и валидацией токенов.
 * 
 * В этих тестах мы проверяем все методы контракта TokenValidator, включая:
 * - isValidToken(address): проверка валидности токена
 * - getTokenInfo(address): получение информации о токене
 * - isLiquidToken(address): проверка ликвидности токена
 * - getMinimumLiquidity(): получение минимального порога ликвидности
 * - Методы управления whitelist/blacklist и другие административные функции
 */

describe("TokenValidator", function () {
    /**
     * Тестирование базовой функциональности контракта
     * Проверяем, что контракт был правильно инициализирован при деплое
     */
    describe("Базовая функциональность", function () {
        it("должен иметь правильные начальные настройки", async function () {
            // Получаем экземпляр контракта и связанные данные из фикстуры
            const { tokenValidator, addresses } = await loadFixture(deployTokenValidatorFixture);

            // 1. Проверяем, что адрес WRAPPED_NATIVE установлен правильно
            // Вызов публичного свойства WRAPPED_NATIVE из контракта TokenValidator
            const wrappedNative = await tokenValidator.WRAPPED_NATIVE();
            expect(wrappedNative).to.equal(addresses.mockWETH, "WRAPPED_NATIVE должен быть установлен как mockWETH");

            // 2. Проверяем минимальный порог ликвидности по умолчанию
            const minLiquidityFromMethod = await tokenValidator.getMinimumLiquidity();
            expect(minLiquidityFromMethod).to.equal(0n);

            // 3. Проверяем список стейблкоинов
            // Вызов метода getStablecoins() из контракта TokenValidator
            const stablecoins = await tokenValidator.getStablecoins();
            expect(stablecoins).to.include(
                addresses.mockUSDC, 
                "USDC должен быть в списке стейблкоинов"
            );
            expect(stablecoins).to.include(
                addresses.mockUSDT, 
                "USDT должен быть в списке стейблкоинов"
            );
            expect(stablecoins.length).to.equal(2, "Должно быть ровно 2 стейблкоина");

            // 4. Проверяем, что нативный токен и WETH в whitelist по умолчанию
            // Вызов публичного маппинга whitelistedTokens из контракта
            const isNativeWhitelisted = await tokenValidator.whitelistedTokens(ZERO_ADDRESS);
            const isWETHWhitelisted = await tokenValidator.whitelistedTokens(addresses.mockWETH);

            expect(isNativeWhitelisted).to.equal(true, "Нативный токен должен быть в whitelist");
            expect(isWETHWhitelisted).to.equal(true, "WETH должен быть в whitelist");

            // 5. Проверяем метод getMinimumLiquidity из интерфейса ITokenValidator
            const minLiquidityFromMethod2 = await tokenValidator.getMinimumLiquidity();
            expect(minLiquidityFromMethod2).to.equal(0n);
        });
    });

            /**
             * Тестирование функций управления whitelist'ом
             * TokenValidator позволяет владельцу контракта добавлять/удалять токены из whitelist'а
             */
            describe("Управление whitelist'ом", function () {
        it("должен добавлять токены в whitelist", async function () {
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Удаляем токен из whitelist установленной фикстурой
            await tokenValidator.connect(owner).setTokenWhitelist(tokenAddress, false, "reset");
            expect(await tokenValidator.whitelistedTokens(tokenAddress)).to.be.false;

            // Добавляем токен в whitelist
            await expect(
                tokenValidator.connect(owner).setTokenWhitelist(
                    tokenAddress,
                    true,
                    "Adding USDC for testing"
                )
            ).to.emit(tokenValidator, "TokenWhitelisted")
                .withArgs(tokenAddress, true, "Adding USDC for testing");

            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.true;
            expect(await tokenValidator.whitelistedTokens(tokenAddress)).to.be.true;
        });

        it("должен удалять токены из whitelist'а", async function () {
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Сначала добавляем токен в whitelist
            await tokenValidator.connect(owner).setTokenWhitelist(tokenAddress, true, "Adding for testing");
            expect(await tokenValidator.whitelistedTokens(tokenAddress)).to.be.true;

            // Удаляем токен из whitelist'а
            await tokenValidator.connect(owner).setTokenWhitelist(
                tokenAddress,
                false,
                "Removing from whitelist"
            );

            // Проверка после удаления
            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.false;
            expect(await tokenValidator.whitelistedTokens(tokenAddress)).to.be.false;
        });

        it("должен разрешать только владельцу управлять whitelist'ом", async function () {
            const { tokenValidator, mockUSDC, maliciousUser } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Попытка добавления в whitelist неавторизованным пользователем
            await expect(
                tokenValidator.connect(maliciousUser).setTokenWhitelist(
                    tokenAddress,
                    true,
                    "Unauthorized attempt"
                )
            ).to.be.reverted;
        });

        it("должен поддерживать массовое управление whitelist'ом", async function () {
            const { tokenValidator, mockUSDC, mockUSDT, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokens = [await mockUSDC.getAddress(), await mockUSDT.getAddress()];
            const statuses = [true, true];

            await tokenValidator.connect(owner).batchWhitelist(tokens, statuses, "Batch whitelist");

            expect(await tokenValidator.whitelistedTokens(tokens[0])).to.be.true;
            expect(await tokenValidator.whitelistedTokens(tokens[1])).to.be.true;
        });

        it("должен предотвращать удаление нативного токена из whitelist'а", async function () {
            const { tokenValidator, owner } = await loadFixture(deployTokenValidatorFixture);

            await expect(
                tokenValidator.connect(owner).setTokenWhitelist(ZERO_ADDRESS, false, "Attempt to remove native")
            ).to.be.reverted;
        });
    });

    describe("Управление blacklist'ом", function () {
        it("должен добавлять токены в blacklist", async function () {
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Добавление токена в whitelist
            await tokenValidator.connect(owner).setTokenWhitelist(tokenAddress, true, "Adding to whitelist");
            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.true;

            // Добавление токена в blacklist
            await expect(tokenValidator.connect(owner).setTokenBlacklist(
                tokenAddress,
                true,
                "Blacklisting token"
            )).to.emit(tokenValidator, "TokenBlacklisted")
                .withArgs(tokenAddress, true, "Blacklisting token");

            // Проверка после добавления в blacklist
            expect(await tokenValidator.blacklistedTokens(tokenAddress)).to.be.true;
            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.false;

            // Токен должен быть удален из whitelist'а автоматически
            expect(await tokenValidator.whitelistedTokens(tokenAddress)).to.be.false;
        });

        it("должен предотвращать добавление нативного токена в blacklist", async function () {
            const { tokenValidator, owner } = await loadFixture(deployTokenValidatorFixture);

            await expect(
                tokenValidator.connect(owner).setTokenBlacklist(
                    ZERO_ADDRESS,
                    true,
                    "Attempt to blacklist native"
                )
            ).to.be.reverted;
        });

        it("должен предотвращать добавление wrapped native в blacklist", async function () {
            const { tokenValidator, addresses, owner } = await loadFixture(deployTokenValidatorFixture);

            await expect(
                tokenValidator.connect(owner).setTokenBlacklist(
                    addresses.mockWETH,
                    true,
                    "Attempt to blacklist WETH"
                )
            ).to.be.reverted;
        });
    });

    describe("Валидация токенов", function () {
        it("должен считать нативный токен и WETH валидными по умолчанию", async function () {
            const { tokenValidator, addresses } = await loadFixture(deployTokenValidatorFixture);

            // Проверка нативного токена
            expect(await tokenValidator.isValidToken(ZERO_ADDRESS)).to.be.true;

            // Проверка WETH
            expect(await tokenValidator.isValidToken(addresses.mockWETH)).to.be.true;
        });

        it("должен считать токены в whitelist'е валидными", async function () {
            const { tokenValidator, mockUSDC } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.true;
            expect(await tokenValidator.whitelistedTokens(tokenAddress)).to.be.true;
        });

        it("должен считать токены в blacklist'е невалидными", async function () {
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Добавляем токен в whitelist
            await tokenValidator.connect(owner).setTokenWhitelist(
                tokenAddress,
                true,
                "Adding to whitelist"
            );

            // Подтверждаем, что токен валиден
            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.true;

            // Добавляем токен в blacklist
            await tokenValidator.connect(owner).setTokenBlacklist(
                tokenAddress,
                true,
                "Blacklisting token"
            );

            // Токен должен быть невалидным
            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.false;
        });
    });

            /**
             * Тестирование получения информации о токенах
             * TokenValidator предоставляет методы для получения информации о токенах
             */
            describe("Информация о токенах", function () {
        it("должен проверять ликвидность токенов через isLiquidToken", async function () {
            // Получаем экземпляр контракта из фикстуры
            const { tokenValidator, addresses } = await loadFixture(deployTokenValidatorFixture);

            // Вызываем метод isLiquidToken из интерфейса ITokenValidator
            // для проверки ликвидности нативного токена
            const isNativeLiquid = await tokenValidator.isLiquidToken(ZERO_ADDRESS);
            expect(isNativeLiquid).to.be.true, "Нативный токен должен быть ликвидным";

            // Проверяем ликвидность WETH
            const isWethLiquid = await tokenValidator.isLiquidToken(addresses.mockWETH);
            expect(isWethLiquid).to.be.true, "WETH должен быть ликвидным";

            // Проверяем ликвидность обычного токена (USDC)
            // Он может быть не ликвидным, если не был добавлен в whitelist
            // или если нет достаточной ликвидности в пуле
            const isUsdcLiquid = await tokenValidator.isLiquidToken(addresses.mockUSDC);
            // Здесь мы просто проверяем, что метод возвращает boolean значение
            expect(typeof isUsdcLiquid).to.equal('boolean');
        });

        it("должен возвращать корректную информацию о нативном токене", async function () {
            // Получаем экземпляр контракта из фикстуры
            const { tokenValidator } = await loadFixture(deployTokenValidatorFixture);

            // Вызываем метод getTokenInfo из интерфейса ITokenValidator
            const nativeInfo = await tokenValidator.getTokenInfo(ZERO_ADDRESS);

            // Проверяем все поля структуры TokenInfo, определенной в ITokenValidator
            expect(nativeInfo.symbol).to.be.oneOf(["ETH", "NATIVE"]); // Зависит от chainId
            expect(nativeInfo.decimals).to.equal(18);
            expect(nativeInfo.hasLiquidity).to.be.true;
            expect(nativeInfo.isWrappedNative).to.be.false;

            // Дополнительные проверки других полей
            expect(nativeInfo.name).to.be.a('string');
            expect(nativeInfo.priceUSD).to.be.a('bigint');
            expect(nativeInfo.liquidityUSD).to.be.a('bigint');
            expect(nativeInfo.lastValidated).to.be.a('bigint');
        });

        it("должен возвращать корректную информацию о ERC20 токенах", async function () {
            const { tokenValidator, mockUSDC } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            const tokenInfo = await tokenValidator.getTokenInfo(tokenAddress);

            expect(tokenInfo.name).to.equal("USD Coin");
            expect(tokenInfo.symbol).to.equal("USDC");
            expect(tokenInfo.decimals).to.equal(6);
        });

        it("должен обновлять кешированную информацию о токенах", async function () {
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Исходная информация
            const initialInfo = await tokenValidator.getTokenInfo(tokenAddress);

            await tokenValidator.connect(owner).updateTokenInfo(tokenAddress);

            const updatedInfo = await tokenValidator.getTokenInfo(tokenAddress);
            expect(updatedInfo.lastValidated).to.be.gt(initialInfo.lastValidated);
        });

        it("не должен считать ребейз-токен валидным", async function () {
            const { tokenValidator, owner } = await loadFixture(deployTokenValidatorFixture);
            const RebaseToken = await ethers.getContractFactory("MockERC20");
            const rebase = await RebaseToken.deploy("Rebase", "RBS", 18, 0);
            const addr = await rebase.getAddress();

            await tokenValidator.connect(owner).setTokenWhitelist(addr, true, "test");
            await tokenValidator.connect(owner).setRebaseToken(addr, true);

            expect(await tokenValidator.isValidToken(addr)).to.equal(false);
        });
    });

});