import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "ethers";
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

            // 2. Проверяем настройки валидации по умолчанию
            // Вызов публичных свойств strictMode и minimumLiquidityUSD
            const strictMode = await tokenValidator.strictMode();
            const minLiquidity = await tokenValidator.minimumLiquidityUSD();

            expect(strictMode).to.equal(true, "Строгий режим должен быть включен по умолчанию");
            expect(minLiquidity).to.equal(
                ethers.parseUnits("10000", 18), 
                "Минимальная ликвидность должна быть $10,000"
            );

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
            const minLiquidityFromMethod = await tokenValidator.getMinimumLiquidity();
            expect(minLiquidityFromMethod).to.equal(
                ethers.parseUnits("10000", 18),
                "getMinimumLiquidity() должен возвращать $10,000"
            );
        });
    });

            /**
             * Тестирование функций управления whitelist'ом
             * TokenValidator позволяет владельцу контракта добавлять/удалять токены из whitelist'а
             */
            describe("Управление whitelist'ом", function () {
        it("должен добавлять токены в whitelist", async function () {
            // Получаем экземпляр контракта и связанные данные из фикстуры
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // 1. Проверяем, что токен изначально не в whitelist'е
            // Вызываем метод isValidToken из интерфейса ITokenValidator
            const isValidBefore = await tokenValidator.isValidToken(tokenAddress);
            expect(isValidBefore).to.be.false, "Токен не должен быть валидным до добавления в whitelist";

            // Также проверяем через прямой доступ к маппингу whitelistedTokens
            const isWhitelistedBefore = await tokenValidator.whitelistedTokens(tokenAddress);
            expect(isWhitelistedBefore).to.be.false, "Токен не должен быть в whitelist изначально";

            // 2. Добавляем токен в whitelist, вызывая метод setTokenWhitelist
            // Этот метод есть только в TokenValidator (расширение ITokenValidator)
            // Проверяем, что при вызове генерируется ожидаемый эвент
            await expect(
                tokenValidator
                    .connect(owner) // Вызываем от имени владельца контракта
                    .setTokenWhitelist(
                        tokenAddress, // Адрес токена
                        true,        // Флаг добавления в whitelist
                        "Adding USDC for testing" // Причина добавления
                    )
            ).to.emit(tokenValidator, "TokenWhitelisted") // Должен сгенерировать эвент
                .withArgs(tokenAddress, true, "Adding USDC for testing"); // С этими параметрами

            // 3. Проверяем, что токен стал валидным после добавления в whitelist
            // Снова вызываем isValidToken из интерфейса ITokenValidator
            const isValidAfter = await tokenValidator.isValidToken(tokenAddress);
            expect(isValidAfter).to.be.true, "Токен должен стать валидным после добавления в whitelist";

            // И проверяем через прямой доступ к маппингу
            const isWhitelistedAfter = await tokenValidator.whitelistedTokens(tokenAddress);
            expect(isWhitelistedAfter).to.be.true, "Токен должен быть в whitelist после добавления";
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
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Токен не валиден изначально
            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.false;

            // Добавляем в whitelist
            await tokenValidator.connect(owner).setTokenWhitelist(
                tokenAddress,
                true,
                "Adding to whitelist"
            );

            // Токен должен быть валидным
            expect(await tokenValidator.isValidToken(tokenAddress)).to.be.true;
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
            expect(initialInfo.lastValidated).to.equal(0); // Ещё не валидирован

            // Валидируем токен
            await tokenValidator.connect(owner).validateTokenDetailed(tokenAddress);

            // Получаем обновленную информацию
            const updatedInfo = await tokenValidator.getTokenInfo(tokenAddress);
            expect(updatedInfo.lastValidated).to.not.equal(0); // Должен быть валидирован
        });
    });

    describe("Настройки валидации", function () {
        it("должен позволять владельцу обновлять настройки валидации", async function () {
            const { tokenValidator, owner } = await loadFixture(deployTokenValidatorFixture);

            const newStrictMode = false;
            const newMinLiquidity = ethers.parseUnits("5000", 18); // $5,000
            const newCacheExpiry = 30 * 60; // 30 минут

            await tokenValidator.connect(owner).updateValidationSettings(
                newStrictMode,
                newMinLiquidity,
                newCacheExpiry
            );

            expect(await tokenValidator.strictMode()).to.equal(newStrictMode);
            expect(await tokenValidator.minimumLiquidityUSD()).to.equal(newMinLiquidity);
            expect(await tokenValidator.cacheExpiry()).to.equal(newCacheExpiry);
        });

        it("должен ограничивать параметры настроек валидации", async function () {
            const { tokenValidator, owner } = await loadFixture(deployTokenValidatorFixture);

            // Слишком короткое время кеширования
            await expect(
                tokenValidator.connect(owner).updateValidationSettings(
                    true,
                    ethers.parseUnits("10000", 18),
                    60 // 1 минута
                )
            ).to.be.reverted;

            // Нулевой минимальный порог ликвидности
            await expect(
                tokenValidator.connect(owner).updateValidationSettings(
                    true,
                    0,
                    60 * 60 // 1 час
                )
            ).to.be.reverted;
        });
    });

    describe("Расширенная валидация", function () {
        it("должен возвращать детальную информацию при валидации токена", async function () {
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Нужно использовать callStatic для получения значения, возвращаемого функцией, а не транзакцию
            const validationResult = await tokenValidator.connect(owner).validateTokenDetailed.staticCall(tokenAddress);

            // Базовые проверки результата
            expect(validationResult.isValid).to.be.a('boolean');
            expect(validationResult.info.name).to.equal("USD Coin");
            expect(validationResult.info.symbol).to.equal("USDC");
            expect(validationResult.info.decimals).to.equal(6);
            expect(validationResult.info.lastValidated).to.not.equal(0);
        });

        it("должен автоматически обновлять кеш при детальной валидации", async function () {
            const { tokenValidator, mockUSDC, owner } = await loadFixture(deployTokenValidatorFixture);
            const tokenAddress = await mockUSDC.getAddress();

            // Проверяем, что кеш истек
            expect(await tokenValidator.isCacheExpired(tokenAddress)).to.be.true;

            // Выполняем валидацию - это будет реальная транзакция, а не staticCall,
            // так как нам нужно, чтобы состояние контракта изменилось
            const tx = await tokenValidator.connect(owner).validateTokenDetailed(tokenAddress);
            await tx.wait(); // Ждем завершения транзакции

            // Проверяем, что кеш обновлен
            expect(await tokenValidator.isCacheExpired(tokenAddress)).to.be.false;
        });
    });
});