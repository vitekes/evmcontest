import { ethers } from "hardhat";
import { expect } from "chai";

// ==========================================
// 🪙 ТИПЫ ДЛЯ ТОКЕНОВ
// ==========================================
export interface TokenBalance {
    token: any;
    account: any;
    amount: bigint;
}

export interface MockTokens {
    usdc: any;
    usdt: any;
    weth: any;
}

// ==========================================
// 💰 ФУНКЦИИ ДЛЯ РАБОТЫ С БАЛАНСАМИ
// ==========================================

/**
 * ✅ Пополняет баланс токена у аккаунта
 * @param tokenContract Контракт токена
 * @param account Аккаунт для пополнения
 * @param amount Сумма для пополнения
 */
export async function setupTokenBalance(
    tokenContract: any, 
    account: any, 
    amount: bigint
): Promise<void> {
    try {
        // Пробуем использовать функцию mint (если есть)
        await tokenContract.mint(account.address, amount);
        console.log(`✅ Minted ${amount} tokens to ${account.address}`);
    } catch {
        try {
            // Если mint нет, пробуем transfer от owner
            const [owner] = await ethers.getSigners();
            await tokenContract.connect(owner).transfer(account.address, amount);
            console.log(`✅ Transferred ${amount} tokens to ${account.address}`);
        } catch (error) {
            throw new Error(`Failed to setup token balance: ${error}`);
        }
    }
}

/**
 * ✅ Массовое пополнение балансов
 * @param balances Массив настроек балансов
 */
export async function setupMultipleTokenBalances(
    balances: TokenBalance[]
): Promise<void> {
    for (const balance of balances) {
        await setupTokenBalance(balance.token, balance.account, balance.amount);
    }
}

/**
 * ✅ УЛУЧШЕННАЯ ФУНКЦИЯ для подготовки ERC20 токена
 * @param tokenContract Контракт токена
 * @param tokenValidator Валидатор токенов
 * @param account Аккаунт создателя
 * @param amount Требуемая сумма (включая fees)
 * @param spender Адрес для approve (обычно factory)
 */
export async function prepareERC20Token(
    tokenContract: any,
    tokenValidator: any,
    account: any,
    amount: bigint,
    spender: string
): Promise<void> {
    console.log(`🔧 Preparing ERC20 token for ${account.address}, amount: ${amount}`);

    try {
        // Получаем минимальную информацию о токене для отладки
        const tokenSymbol = await tokenContract.symbol();
        const tokenAddress = await tokenContract.getAddress();
        console.log(`📝 Информация о токене: ${tokenSymbol}, address: ${tokenAddress}`);

        // Проверяем валидность токена до любых операций
        if (tokenValidator) {
            try {
                const isValid = await tokenValidator.isValidToken(tokenAddress).catch(() => false);
                const isStable = await tokenValidator.isStablecoin?.(tokenAddress).catch(() => false);
                console.log(`🔍 Статус токена перед операциями: isValid=${isValid}, isStablecoin=${isStable}`);
            } catch (validationError) {
                console.log(`⚠️ Не удалось проверить статус токена: ${validationError}`);
            }
        }

        // 1. Проверяем текущий баланс
        const currentBalance = await tokenContract.balanceOf(account.address);
        console.log(`   Current balance: ${currentBalance}`);

        // 2. Если баланса недостаточно, пополняем
        if (currentBalance < amount) {
            const needAmount = amount - currentBalance;
            console.log(`   Need additional: ${needAmount}`);

            // Пробуем mint с очень большим запасом
            try {
                // Используем mint с подписью owner, так как другие аккаунты могут не иметь права на mint
                const [owner] = await ethers.getSigners();
                // Минтим в 100 раз больше для гарантированного запаса
                const largeAmount = amount * 100n;
                await tokenContract.connect(owner).mint(account.address, largeAmount);
                console.log(`   ✅ Minted ${largeAmount} tokens with large buffer`);
            } catch (mintError) {
                console.error(`   ❌ All mint attempts failed: ${mintError}`);
                throw new Error(`Не удалось пополнить баланс токена ${tokenSymbol}: ${mintError}`);
            }
        }

        // 3. Проверяем баланс после пополнения
        const balanceAfterMint = await tokenContract.balanceOf(account.address);
        console.log(`   💰 Баланс после пополнения: ${balanceAfterMint}`);
        if (balanceAfterMint < amount) {
            throw new Error(`Критическая ошибка: после mint баланс ${balanceAfterMint} все еще меньше требуемого ${amount}`);
        }

        // 4. Добавляем токен в whitelist
        try {
            // Проверяем текущий статус токена
            const isWhitelisted = await tokenValidator.isValidToken(await tokenContract.getAddress());
            const isStablecoin = await tokenValidator.isStablecoin?.(await tokenContract.getAddress()).catch(() => false);
            console.log(`   🔍 Токен перед валидацией: isWhitelisted=${isWhitelisted}, isStablecoin=${isStablecoin}`);

            if (!isWhitelisted) {
                // Добавляем токен в whitelist
                const [owner] = await ethers.getSigners();
                await tokenValidator.connect(owner).setTokenWhitelist(
                    await tokenContract.getAddress(),
                    true,
                    `${tokenSymbol} token for tests`
                );
                console.log(`   ✅ Токен ${tokenSymbol} добавлен в whitelist`);
            }

            // Стейблкоины требуют дополнительной настройки - проверяем по символу
            const stablecoinSymbols = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD'];
            const isStablecoinBySymbol = stablecoinSymbols.includes(tokenSymbol) || tokenSymbol.startsWith('USD');

            if (isStablecoinBySymbol && !isStablecoin) {
                console.log(`   ⚠️ Токен ${tokenSymbol} похож на стейблкоин, но не отмечен как стейблкоин`);

                // Пробуем разные методы для обновления стейблкоинов
                const [owner] = await ethers.getSigners();

                try {
                    // Проверяем наличие метода updateTokenInfo
                    if (typeof tokenValidator.updateTokenInfo === 'function') {
                        console.log(`   🔄 Вызываем updateTokenInfo для ${tokenSymbol}...`);
                        await tokenValidator.connect(owner).updateTokenInfo(await tokenContract.getAddress());
                    }
                } catch (updateError) {
                    console.log(`   ⚠️ Не удалось обновить информацию о токене: ${updateError}`);
                }

                // Пробуем напрямую добавить в whitelist еще раз с пометкой stablecoin
                try {
                    await tokenValidator.connect(owner).setTokenWhitelist(
                        await tokenContract.getAddress(),
                        true,
                        `${tokenSymbol} STABLECOIN for tests`
                    );
                    console.log(`   ✅ Токен ${tokenSymbol} добавлен в whitelist как стейблкоин`);
                } catch (whitelistError) {
                    console.log(`   ⚠️ Не удалось обновить whitelist: ${whitelistError}`);
                }

                // Проверяем статус токена после обновлений
                const isValidNow = await tokenValidator.isValidToken(await tokenContract.getAddress());
                const isStablecoinNow = await tokenValidator.isStablecoin?.(await tokenContract.getAddress()).catch(() => false);
                console.log(`   🔍 Токен после обновлений: isValid=${isValidNow}, isStablecoin=${isStablecoinNow}`);
            }
        } catch (validationError) {
            console.error(`   ❌ Ошибка при валидации токена: ${validationError}`);
            // Продолжаем выполнение, так как это не критическая ошибка
        }

        // 5. Делаем approve с очень большим запасом
        const currentAllowance = await tokenContract.allowance(account.address, spender);
        console.log(`   💰 Текущий баланс: ${await tokenContract.balanceOf(account.address)}, необходимо: ${amount}`);
        console.log(`   🔓 Текущий allowance: ${currentAllowance}, адрес spender: ${spender}`);

        try {
            // Устанавливаем новое значение с большим запасом (в 100 раз больше)
            const approveAmount = amount * BigInt(100);
            console.log(`   🔄 Устанавливаем увеличенный allowance: ${approveAmount}`);

            // Для некоторых токенов сброс к 0 может быть необходим
            try {
                await tokenContract.connect(account).approve(spender, 0);
                console.log(`   ✅ Сброс allowance к 0 выполнен успешно`);
            } catch (resetError) {
                console.log(`   ⚠️ Не удалось сбросить allowance: ${resetError}`);
                // Продолжаем с установкой нового значения
            }

            const approveTx = await tokenContract.connect(account).approve(spender, approveAmount);
            const receipt = await approveTx.wait();
            console.log(`   ✅ Транзакция approve подтверждена: ${receipt?.hash || 'нет хеша'}`);

            // Проверяем установленный allowance
            const newAllowance = await tokenContract.allowance(account.address, spender);
            console.log(`   ✅ Новый allowance: ${newAllowance} для ${spender}`);

            if (newAllowance < amount) {
                throw new Error(`Allowance ${newAllowance} меньше требуемого ${amount}`);
            }
        } catch (approveError) {
            console.error(`   ❌ Критическая ошибка при установке allowance: ${approveError}`);
            throw new Error(`Не удалось установить allowance для ${tokenSymbol}: ${approveError}`);
        }

        console.log(`✅ ERC20 токен ${tokenSymbol} успешно подготовлен для ${account.address}`);

    } catch (error) {
        console.error(`❌ Не удалось подготовить токен: ${error}`);
        throw error;
    }
}

/**
 * ✅ НОВАЯ ФУНКЦИЯ: Быстрая подготовка всех токенов для аккаунта
 * @param mockTokens Объект с mock токенами  
 * @param tokenValidator Валидатор токенов
 * @param accounts Аккаунты для подготовки
 * @param spender Адрес для approve
 */
export async function prepareAllTokensForAccounts(
    mockTokens: { mockUSDC: any, mockUSDT: any, mockWETH: any },
    tokenValidator: any,
    accounts: any[],
    spender: string
): Promise<void> {
    console.log(`🚀 Preparing all tokens for ${accounts.length} accounts...`);
    
    const tokens = [mockTokens.mockUSDC, mockTokens.mockUSDT, mockTokens.mockWETH];
    const largeAmount = ethers.parseUnits("10000000", 18); // 10M токенов
    
    for (const token of tokens) {
        // Добавляем в whitelist
        try {
            // Сначала проверяем, нужно ли добавлять в whitelist
            const isAlreadyValid = await tokenValidator.isValidToken(await token.getAddress())
                .catch(() => false);

            if (!isAlreadyValid) {
                await tokenValidator.setTokenWhitelist(
                    await token.getAddress(),
                    true,
                    "Bulk preparation for tests"
                );
            }
        } catch (error) {
            console.log(`⚠️ Не удалось добавить токен в whitelist: ${error}`);
        }
        
        // Подготавливаем для всех аккаунтов
        for (const account of accounts) {
            try {
                await token.mint(account.address, largeAmount);
                await token.connect(account).approve(spender, largeAmount);
            } catch (error) {
                console.log(`⚠️ Warning: Could not prepare ${await token.symbol()} for ${account.address}`);
            }
        }
    }
    
    console.log(`✅ All tokens prepared successfully!`);
}

// ==========================================
// 📊 ФУНКЦИИ ДЛЯ ПРОВЕРКИ БАЛАНСОВ
// ==========================================

/**
 * ✅ Проверяет баланс ETH у аккаунта
 * @param account Аккаунт для проверки
 * @param expectedMin Минимальный ожидаемый баланс
 */
export async function expectETHBalance(
    account: any,
    expectedMin: bigint
): Promise<void> {
    const balance = await ethers.provider.getBalance(account.address);
    expect(balance).to.be.at.least(expectedMin);
}

/**
 * ✅ Проверяет баланс ERC20 токена у аккаунта
 * @param tokenContract Контракт токена
 * @param account Аккаунт для проверки
 * @param expectedAmount Ожидаемый баланс
 */
export async function expectTokenBalance(
    tokenContract: any,
    account: any,
    expectedAmount: bigint
): Promise<void> {
    const balance = await tokenContract.balanceOf(account.address);
    expect(balance).to.equal(expectedAmount);
}

/**
 * ✅ Проверяет изменение баланса ETH после транзакции
 * @param account Аккаунт для проверки
 * @param transaction Функция для выполнения транзакции
 * @param expectedChange Ожидаемое изменение (может быть отрицательным)
 */
export async function expectETHBalanceChange(
    account: any,
    transaction: () => Promise<any>,
    expectedChange: bigint
): Promise<void> {
    const balanceBefore = await ethers.provider.getBalance(account.address);
    
    const tx = await transaction();
    const receipt = await tx.wait();
    
    const balanceAfter = await ethers.provider.getBalance(account.address);
    
    // 🔧 ИСПРАВЛЕНО: Правильное приведение типов для gas costs
    if (tx.from.toLowerCase() === account.address.toLowerCase()) {
        // Конвертируем gasUsed и gasPrice в bigint
        const gasUsed = BigInt(receipt!.gasUsed.toString());
        const gasPrice = BigInt(receipt!.gasPrice.toString());
        const gasCost = gasUsed * gasPrice;
        
        const actualChange = balanceAfter - balanceBefore + gasCost;
        expect(actualChange).to.equal(expectedChange);
    } else {
        const actualChange = balanceAfter - balanceBefore;
        expect(actualChange).to.equal(expectedChange);
    }
}

/**
 * ✅ Проверяет изменение баланса ERC20 токена после транзакции
 * @param tokenContract Контракт токена
 * @param account Аккаунт для проверки
 * @param transaction Функция для выполнения транзакции
 * @param expectedChange Ожидаемое изменение
 */
export async function expectTokenBalanceChange(
    tokenContract: any,
    account: any,
    transaction: () => Promise<any>,
    expectedChange: bigint
): Promise<void> {
    const balanceBefore = await tokenContract.balanceOf(account.address);
    
    await transaction();
    
    const balanceAfter = await tokenContract.balanceOf(account.address);
    const actualChange = balanceAfter - balanceBefore;
    
    expect(actualChange).to.equal(expectedChange);
}

// Остальные функции остаются без изменений...
// ==========================================
// 🔧 УТИЛИТЫ ДЛЯ РАБОТЫ С ТОКЕНАМИ
// ==========================================

/**
 * ✅ Проверяет, является ли токен стейблкоином через валидатор
 * @param tokenContract Контракт токена
 * @param tokenValidator Валидатор токенов
 */
export async function isStablecoin(
    tokenContract: any,
    tokenValidator: any
): Promise<boolean> {
    try {
        const tokenAddress = await tokenContract.getAddress();
        return await tokenValidator.isStablecoin(tokenAddress);
    } catch (error) {
        console.error(`Ошибка при проверке стейблкоина: ${error}`);

        // Пробуем альтернативный способ через getTokenInfo
        try {
            const tokenAddress = await tokenContract.getAddress();
            const tokenInfo = await tokenValidator.getTokenInfo(tokenAddress);
            return tokenInfo.isStablecoin;
        } catch (infoError) {
            console.error(`Не удалось получить информацию через getTokenInfo: ${infoError}`);
            return false;
        }
    }
}

/**
 * ✅ Получает информацию о токене (название, символ, decimals)
 * @param tokenContract Контракт токена
 */
export async function getTokenInfo(tokenContract: any): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    address: string;
}> {
    const [name, symbol, decimals, address] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.getAddress()
    ]);

    return { name, symbol, decimals, address };
}

/**
 * ✅ Конвертирует сумму с учетом decimals токена
 * @param amount Сумма в основных единицах
 * @param decimals Количество decimals
 */
export function toTokenUnits(amount: number, decimals: number): bigint {
    return BigInt(amount) * BigInt(10 ** decimals);
}

/**
 * ✅ Конвертирует сумму из токен units в читаемый формат
 * @param amount Сумма в токен units
 * @param decimals Количество decimals
 */
export function fromTokenUnits(amount: bigint, decimals: number): number {
    return Number(amount) / (10 ** decimals);
}

/**
 * ✅ Форматирует баланс для читаемого вывода
 * @param tokenContract Контракт токена
 * @param account Аккаунт
 */
export async function formatBalance(
    tokenContract: any,
    account: any
): Promise<string> {
    const balance = await tokenContract.balanceOf(account.address);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    
    const readable = fromTokenUnits(balance, decimals);
    return `${readable} ${symbol}`;
}

// ==========================================
// 🧪 MOCK ТОКЕНЫ ДЛЯ ТЕСТОВ
// ==========================================

/**
 * ✅ Настраивает mock токены для всех тестов
 * @param mockTokens Объект с mock токенами
 * @param tokenValidator Валидатор токенов
 * @param accounts Массив аккаунтов для пополнения
 * @param amount Сумма для каждого аккаунта
 */
export async function setupMockTokensForAccounts(
    mockTokens: MockTokens,
    tokenValidator: any,
    accounts: any[],
    amount: bigint = toTokenUnits(1000000, 18) // 1M токенов по умолчанию
): Promise<void> {
    const tokens = [mockTokens.usdc, mockTokens.usdt, mockTokens.weth];
    
    // Добавляем все токены в whitelist
    for (const token of tokens) {
        const tokenAddress = await token.getAddress();
        const isAlreadyValid = await tokenValidator.isValidToken(tokenAddress)
            .catch(() => false);

        if (!isAlreadyValid) {
            try {
                await tokenValidator.setTokenWhitelist(
                    tokenAddress,
                    true,
                    "Mock token for tests"
                );
                console.log(`Token ${await token.symbol()} added to whitelist`);
            } catch (error) {
                console.log(`⚠️ Не удалось добавить ${await token.symbol()} в whitelist: ${error}`);
            }
        } else {
            console.log(`Token ${await token.symbol()} is already valid`);
        }
    }
    
    // Пополняем балансы всех аккаунтов
    for (const account of accounts) {
        for (const token of tokens) {
            const decimals = await token.decimals();
            const tokenAmount = decimals === 6 ? 
                toTokenUnits(1000000, 6) : // 1M для USDC/USDT
                amount; // Стандартная сумма для остальных
                
            await setupTokenBalance(token, account, tokenAmount);
        }
    }
    
    console.log(`✅ Setup complete for ${accounts.length} accounts with ${tokens.length} tokens`);
}

/**
 * ✅ Создает набор балансов для разных сценариев тестирования
 */
export const BALANCE_SCENARIOS = {
    // Минимальные балансы для основных операций
    MINIMAL: {
        usdc: toTokenUnits(1000, 6),      // 1,000 USDC
        usdt: toTokenUnits(1000, 6),      // 1,000 USDT
        weth: toTokenUnits(1, 18),        // 1 WETH
        eth: ethers.parseEther("10")      // 10 ETH
    },

    // Средние балансы для большинства тестов
    STANDARD: {
        usdc: toTokenUnits(100000, 6),    // 100,000 USDC
        usdt: toTokenUnits(100000, 6),    // 100,000 USDT
        weth: toTokenUnits(50, 18),       // 50 WETH
        eth: ethers.parseEther("100")     // 100 ETH
    },

    // Большие балансы для стресс-тестов
    LARGE: {
        usdc: toTokenUnits(10000000, 6),  // 10M USDC
        usdt: toTokenUnits(10000000, 6),  // 10M USDT
        weth: toTokenUnits(5000, 18),     // 5,000 WETH
        eth: ethers.parseEther("10000")   // 10,000 ETH
    }
};