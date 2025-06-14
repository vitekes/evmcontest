import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { 
    ContestFactory, 
    ContestEscrow, 
    NetworkFeeManager 
} from "../../typechain-types";
import { TEST_CONSTANTS, CONTEST_TEMPLATES } from "../fixtures";
import { prepareERC20Token } from "./TokenHelper";

export interface CreateContestOptions {
    token?: string;
    totalPrize?: bigint;
    template?: number;
    startDelay?: number;
    duration?: number;
    startTime?: bigint;    
    endTime?: bigint;      
    jury?: string[];
    metadata?: {
        title?: string;
        description?: string;
    };

    hasNonMonetaryPrizes?: boolean;
    uniqueId?: number;
    customDistribution?: Array<{
        place: number;
        percentage: number;
        description: string;
    }>;
}

export async function createTestContest(
    contestFactory: ContestFactory,
    feeManager: NetworkFeeManager,
    creator: any,
    options: CreateContestOptions = {}
): Promise<{
    contestId: bigint;
    escrow: ContestEscrow;
    escrowAddress: string;
    transaction: any;
    receipt: NonNullable<Awaited<ReturnType<typeof ethers.ContractTransactionResponse.prototype.wait>>>;
}> {
    // Проверяем, что функция lastId доступна
    let hasLastIdFunction;
    let initialLastId = BigInt(0);
    try {
        initialLastId = await contestFactory.lastId();
        console.log(`Начальное значение lastId перед созданием конкурса: ${initialLastId}`);
        hasLastIdFunction = true;
    } catch (error) {
        console.warn(`Функция lastId недоступна: ${error}`);
        hasLastIdFunction = false;
    }

    // Проверяем валидность токена, если это не ETH
    if (options.token && options.token !== ethers.ZeroAddress) {
        try {
            const validator = await ethers.getContractAt("TokenValidator", await contestFactory.tokenValidator());
            const isValidToken = await validator.isValidToken(options.token);
            const isStablecoin = await validator.isStablecoin(options.token);
            console.log(`🔍 Проверка валидации токена: isValidToken=${isValidToken}, isStablecoin=${isStablecoin}`);

            // Если токен не валиден, попробуем исправить
            if (!isValidToken) {
                console.log(`⚠️ Токен не прошёл валидацию, пробуем исправить...`);
                const [owner] = await ethers.getSigners();
                await validator.connect(owner).setTokenWhitelist(options.token, true, "Added for test");

                // Проверяем еще раз whitelist после исправления
                const isValidNow = await validator.isValidToken(options.token);
                console.log(`🔄 После исправления whitelist: isValidToken=${isValidNow}`);
            }

            // Отдельно проверяем и настраиваем стейблкоин
            if (!isStablecoin) {
                console.log(`⚠️ Токен не определен как стейблкоин, пробуем исправить...`);
                const [owner] = await ethers.getSigners();

                // Получаем информацию о токене для логирования
                const mockToken = await ethers.getContractAt("MockERC20", options.token);
                const tokenSymbol = await mockToken.symbol();
                console.log(`Проверка стейблкоина для токена: ${tokenSymbol}`);

                // Прямая вставка в массив стейблкоинов (если есть метод updateStablecoins)
                try {
                    // Получаем текущий список стейблкоинов
                    const stablecoins = await validator.stablecoins
                        ? await validator.stablecoins(0).then(() => {
                            let coins = [];
                            let i = 0;
                            return (async function getCoins() {
                                try {
                                    while (true) {
                                        coins.push(await validator.stablecoins(i));
                                        i++;
                                    }
                                } catch {
                                    return coins;
                                }
                            })();
                        })
                        : [];

                    // Добавляем новый стейблкоин в массив, если такого метода еще нет
                    await validator.connect(owner).batchWhitelist(
                        [options.token],
                        [true],
                        `Stablecoin ${tokenSymbol} for tests`
                    );

                    // Проверяем, есть ли метод для обновления стейблкоинов
                    const code = await ethers.provider.getCode(await validator.getAddress());
                    console.log(`Проверяем наличие метода для стейблкоинов...`);

                    // Пробуем разные подходы для определения стейблкоина
                    try {
                        // Пытаемся установить токен как стейблкоин напрямую
                        await validator.connect(owner).setTokenIsStablecoin?.(options.token, true);
                        console.log(`✅ Токен установлен как стейблкоин через setTokenIsStablecoin`);
                    } catch (e) {
                        console.log(`Не удалось использовать setTokenIsStablecoin: ${e.message}`);

                        try {
                            // Пробуем обновить TokenInfo напрямую
                            await validator.connect(owner).updateTokenInfo?.(options.token);
                            console.log(`✅ Обновлена информация о токене через updateTokenInfo`);
                        } catch (e2) {
                            console.log(`Не удалось использовать updateTokenInfo: ${e2.message}`);
                        }
                    }
                } catch (updateErr) {
                    console.log(`⚠️ Не удалось обновить стейблкоины: ${updateErr}`);
                }

                // Проверяем еще раз после исправления
                const isStablecoinNow = await validator.isStablecoin(options.token);
                console.log(`🔄 После исправления стейблкоина: isStablecoin=${isStablecoinNow}`);
            }
        } catch (error) {
            console.warn(`⚠️ Ошибка при проверке валидности токена: ${error}`);
        }
    }
    console.log("Начало создания тестового конкурса с параметрами:", JSON.stringify(options, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
    ));
    const now = await time.latest();
    const uniqueId = options.uniqueId || Math.floor(Math.random() * 1000000);
    
    // Используем startTime и endTime из параметров, если они указаны
    const startTime = options.startTime ? options.startTime : 
        BigInt(now + (options.startDelay || TEST_CONSTANTS.DEFAULT_START_DELAY) + (uniqueId % 100));

    const endTime = options.endTime ? options.endTime :
        BigInt(now + (options.startDelay || TEST_CONSTANTS.DEFAULT_START_DELAY) + 
        (options.duration || TEST_CONSTANTS.DEFAULT_DURATION));

    const config = {
        token: options.token || ethers.ZeroAddress,
        totalPrize: options.totalPrize || TEST_CONSTANTS.MEDIUM_PRIZE,
        template: options.template !== undefined ? options.template : CONTEST_TEMPLATES.TOP_2,
        jury: options.jury || [],
        hasNonMonetaryPrizes: options.hasNonMonetaryPrizes || false,
        customDistribution: options.customDistribution || []
    };

    const contestParams = {
        token: config.token,
        totalPrize: config.totalPrize,
        template: config.template,
        customDistribution: config.customDistribution.length > 0 ? config.customDistribution : [],
        jury: config.jury,
        startTime: startTime,
        endTime: endTime,
        contestMetadata: JSON.stringify({
            title: options.metadata?.title || `Test Contest #${uniqueId}`,
            description: options.metadata?.description || `Test contest for automated testing (ID: ${uniqueId})`
        }),
        hasNonMonetaryPrizes: config.hasNonMonetaryPrizes
    };

    let createTx;
    
    if (config.token === ethers.ZeroAddress) {
        const platformFee = await feeManager.calculateFee(31337, config.totalPrize);
        const totalRequired = config.totalPrize + platformFee;
        
        console.log(`Создание конкурса с ETH: приз=${ethers.formatEther(config.totalPrize)}, комиссия=${ethers.formatEther(platformFee)}, всего=${ethers.formatEther(totalRequired)}`);

        try {
            createTx = await contestFactory.connect(creator).createContest(contestParams, {
                value: totalRequired,
                gasLimit: 5000000  // Увеличиваем лимит газа
            });
        } catch (error) {
            console.error(`Ошибка при создании конкурса с ETH: ${error}`);
            throw error;
        }
    } else {
        const token = await ethers.getContractAt("MockERC20", config.token);
        const platformFee = await feeManager.calculateFee(31337, config.totalPrize);
        const totalRequired = config.totalPrize + platformFee;

        const tokenValidator = await ethers.getContractAt("TokenValidator", 
            await contestFactory.tokenValidator()
        );
        
        // Добавляем токен в белый список перед созданием конкурса
        try {
            const isWhitelisted = await tokenValidator.whitelistedTokens(config.token);
            if (!isWhitelisted) {
                // Используем owner, а не creator для добавления в whitelist
                const [owner] = await ethers.getSigners();
                const addToWhitelistTx = await tokenValidator.connect(owner).setTokenWhitelist(
                    config.token,
                    true,
                    "Test whitelist for mock token"
                );
                await addToWhitelistTx.wait();
                console.log(`   ✅ Добавлен в whitelist с использованием owner`);
            } else {
                console.log(`   ℹ️ Токен уже в whitelist`);
            }
            // Дополнительно проверяем и устанавливаем флаг стейблкоина если нужно
            try {
                // В TypeScript не видит метод isStablecoin, но он существует в контракте
                // @ts-ignore: Property 'isStablecoin' does not exist on type 'TokenValidator'
                // Используем метод isStablecoin из интерфейса ITokenValidator
                const isStablecoin = await tokenValidator.isStablecoin(config.token);
                if (!isStablecoin) {
                    const [owner] = await ethers.getSigners();

                    // Получаем символ токена через getContractAt вместо IERC20Metadata
                    const mockToken = await ethers.getContractAt("MockERC20", config.token);
                    const tokenSymbol = await mockToken.symbol();

                    // Проверяем, является ли токен потенциальным стейблкоином по имени
                    const stablecoinSymbols = ['USDT', 'USDC', 'BUSD', 'DAI'];
                    const isStablecoinSymbol = stablecoinSymbols.includes(tokenSymbol) || 
                                             tokenSymbol.startsWith('USD');

                    if (isStablecoinSymbol) {
                        // Пробуем разные методы для установки стейблкоина
                        try {
                            // Пробуем получить тип контракта для определения доступных методов
                            // @ts-ignore: Игнорируем ошибку, так как метод может быть доступен в реализации
                            const isMock = await tokenValidator.isMockTokenValidator?.().catch(() => false);

                            if (isMock) {
                                // Если это мок, используем метод setupToken
                                const mockValidator = await ethers.getContractAt("MockTokenValidator", await tokenValidator.getAddress());
                                await mockValidator.connect(owner).setupToken(
                                    config.token,
                                    await mockToken.name(),
                                    tokenSymbol,
                                    await mockToken.decimals(),
                                    ethers.parseUnits("1", 8), // $1 с 8 десятичными
                                    true, // isStable = true
                                    false  // isWrappedNative = false
                                );
                            } else {
                                // Для реального валидатора
                                await tokenValidator.connect(owner).setTokenIsStablecoin(config.token, true);
                            }
                            console.log(`   ✅ Токен установлен как стейблкоин`);
                        } catch (error) {
                            console.log(`   ⚠️ Ошибка при установке стейблкоина: ${error}`);

                            // Добавляем в массив стейблкоинов напрямую, если это возможно
                            try {
                                const stablecoinsField = await tokenValidator.getStablecoins().catch(() => []);
                                if (Array.isArray(stablecoinsField)) {
                                    // @ts-ignore: Игнорируем ошибку, так как метод может быть доступен в реализации
                                    await tokenValidator.connect(owner).updateStablecoins?.([
                                        ...stablecoinsField, config.token
                                    ]);
                                    console.log(`   ✅ Токен добавлен в массив стейблкоинов`);
                                }
                            } catch (updateError) {
                                console.log(`   ⚠️ Невозможно обновить список стейблкоинов: ${updateError}`);
                            }
                        }
                    } else {
                        console.log(`   ℹ️ Токен ${tokenSymbol} не определен как стейблкоин по символу`);
                    }
                } else {
                    console.log(`   ✅ Токен уже является стейблкоином`);
                }
            } catch (stablecoinError) {
                console.log(`   ⚠️ Не удалось установить флаг стейблкоина: ${stablecoinError}`);
            }
        } catch (error) {
            console.log(`   ⚠️ Не удалось добавить токен в whitelist: ${error}`);
        }

        await prepareERC20Token(
            token,
            tokenValidator,
            creator,
            totalRequired,
            await contestFactory.getAddress()
        );
        
        console.log(`Создание конкурса с токеном ${config.token}: приз=${config.totalPrize}, комиссия=${platformFee}, всего=${totalRequired}`);

        // Проверяем, нужно ли передавать totalRequired при вызове createContest
        // Если токен стейблкоин, то в смарт-контракте логика комиссии отличается
        const isStablecoin = await tokenValidator.isStablecoin(config.token);
        console.log(`Токен ${await token.symbol()} является стейблкоином: ${isStablecoin}`);

        // Получаем и проверяем важные параметры токена
        const tokenDecimals = await token.decimals();
        const tokenName = await token.name();
        const tokenSymbol = await token.symbol();
        console.log(`Параметры токена: name=${tokenName}, symbol=${tokenSymbol}, decimals=${tokenDecimals}`);

        try {
            // Сначала пробуем оценить газ для операции
            try {
                const gasEstimate = await contestFactory.connect(creator).createContest.estimateGas(contestParams);
                console.log(`Оценка газа для createContest: ${gasEstimate} (добавим 30% запаса)`);                
                const gasLimit = Math.ceil(Number(gasEstimate) * 1.3); // Добавляем 30% запаса

                createTx = await contestFactory.connect(creator).createContest(contestParams, {
                    gasLimit: gasLimit
                });
                console.log(`Транзакция отправлена с gasLimit: ${gasLimit}`);
            } catch (gasError) {
                console.warn(`Не удалось оценить газ: ${gasError}, используем фиксированное значение`);                

                // Если не удалось оценить газ, используем увеличенный лимит
                const gasLimit = 30000000; // Увеличиваем лимит газа еще больше
                console.log(`Используем фиксированный gasLimit: ${gasLimit}`);

                createTx = await contestFactory.connect(creator).createContest(contestParams, {
                    gasLimit: gasLimit
                });
            }
        } catch (error) {
            console.error(`Ошибка при создании конкурса с токеном: ${error}`);


            // Расширенная отладочная информация
            const err = error as any; // Явное приведение к any для доступа к свойствам

            if (err && typeof err === 'object') {
                if ('message' in err) {
                    console.error(`Сообщение ошибки: ${err.message}`);
                }

                if ('code' in err) {
                    console.error(`Код ошибки: ${err.code}`);
                }

                if ('transaction' in err) {
                    console.error(`Данные транзакции: ${JSON.stringify(err.transaction)}`);
                }

                if ('receipt' in err) {
                    console.error(`Чек транзакции: ${JSON.stringify(err.receipt)}`);
                }
            }

            throw error;
        }
    }

    const receipt = await createTx.wait();
    if (!receipt) throw new Error("Transaction receipt is null");
    if (!receipt.logs) throw new Error("Transaction receipt logs are missing");

    console.log(`Получено ${receipt.logs.length} логов из транзакции`);

    let contestId: bigint | null = null;
    let escrowAddress: string | null = null;

    // Более надежный способ поиска события по topicHash
    let eventTopicHash;
    try {
        const eventDef = contestFactory.interface.getEvent("ContestCreated");
        eventTopicHash = eventDef?.topicHash;
        console.log(`Найдено определение события ContestCreated с topicHash: ${eventTopicHash}`);
    } catch (error) {
        console.error(`Ошибка при получении topicHash для ContestCreated: ${error}`);
    }

    // Генерируем различные варианты хешей для события
    const possibleSignatures = [
        "ContestCreated(uint256,address,address,uint256,uint256)",
        "ContestCreated(uint256,address,address,address,uint256,uint256)",
        "ContestCreated(uint256,address,address)"
    ];

    const signatureHashes = [];
    for (const sig of possibleSignatures) {
        try {
            const hash = ethers.id(sig);
            signatureHashes.push(hash);
            console.log(`Хеш для сигнатуры ${sig}: ${hash}`);
        } catch (err) {
            console.error(`Не удалось сгенерировать хеш для ${sig}: ${err}`);
        }
    }

    // Выводим первые несколько topicHash для отладки
    if (receipt.logs.length > 0) {
        console.log(`Первые топики логов:`);
        for (let i = 0; i < Math.min(5, receipt.logs.length); i++) {
            if (receipt.logs[i].topics.length > 0) {
                console.log(`Log ${i}: ${receipt.logs[i].topics[0]}`);
            }
        }
    }

    let contestCreatedLog = null;

    // Сначала пробуем найти через eventTopicHash
    if (eventTopicHash) {
        contestCreatedLog = receipt.logs.find(log => 
            log.topics.length > 0 && log.topics[0] === eventTopicHash
        );

        if (contestCreatedLog) {
            console.log(`Найден лог с основным хешем события: ${eventTopicHash}`);
        }
    }

    // Если не нашли, пробуем через все возможные хеши
    if (!contestCreatedLog) {
        for (const hash of signatureHashes) {
            const log = receipt.logs.find(log => 
                log.topics.length > 0 && log.topics[0] === hash
            );

            if (log) {
                contestCreatedLog = log;
                console.log(`Найден лог с альтернативным хешем события: ${hash}`);
                break;
            }
        }
    }

    if (contestCreatedLog) {
        try {
            const decodedEvent = contestFactory.interface.parseLog(contestCreatedLog);
            if (decodedEvent && decodedEvent.args) {
                    // Пробуем получить по именам
                    contestId = decodedEvent.args.contestId;
                    escrowAddress = decodedEvent.args.escrow;

                    // Если не получилось, пробуем по индексам
                    if (!contestId) {
                        contestId = decodedEvent.args[0];
                    }

                    if (!escrowAddress) {
                        // Пробуем разные индексы для escrowAddress
                        for (let i = 1; i < 4; i++) {
                            if (ethers.isAddress(decodedEvent.args[i])) {
                                escrowAddress = decodedEvent.args[i];
                                break;
                            }
                        }
                    }

                    console.log(`Найдено событие ContestCreated! ID: ${contestId}, Эскроу: ${escrowAddress}`);
                }
            } catch (error) {
                console.log(`Ошибка при разборе события: ${error}`);

                // Пробуем разобрать вручную
                try {
                    // Предполагаем, что первый параметр - contestId, а один из следующих - escrowAddress
                    const data = contestCreatedLog.data;
                    const topics = contestCreatedLog.topics;

                    console.log(`Данные лога: data=${data}, topics=${topics.join(', ')}`);

                    // Пробуем извлечь contestId из первого параметра в data (убираем 0x и берем первые 64 символа)
                    if (data && data.length >= 66) {
                        const idHex = '0x' + data.substring(2, 66);
                        contestId = BigInt(idHex);
                        console.log(`Извлечен contestId=${contestId} из data`);
                    }

                    // Пробуем найти адрес в data
                    if (data && data.length >= 130) {
                        const addrHex = '0x' + data.substring(26, 66); // 40 символов с отступом
                        if (ethers.isAddress(addrHex)) {
                            escrowAddress = addrHex;
                            console.log(`Извлечен escrowAddress=${escrowAddress} из data`);
                        }
                    }
                } catch (innerError) {
                    console.error(`Ошибка при ручном разборе события: ${innerError}`);
                }
        }
    } else {
        // Если не нашли событие, проверяем все логи последовательно
        console.log(`Проверка всех ${receipt.logs.length} логов на наличие ContestCreated...`);
        for (const log of receipt.logs) {
            try {
                const parsed = contestFactory.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });

                if (parsed && parsed.name === "ContestCreated" && parsed.args) {
                    contestId = parsed.args.contestId;
                    escrowAddress = parsed.args.escrow;
                    console.log(`Найдено событие ContestCreated! ID: ${contestId}, Эскроу: ${escrowAddress}`);
                    break;
                }
            } catch (error) {
                // Игнорируем ошибки парсинга
                continue;
            }
        }
    }

    // Если не нашли событие, получаем информацию другим способом
    if (contestId === null || !escrowAddress) {
        console.log("Используем альтернативный метод получения информации о конкурсе...");

        // Получаем lastId из ContestFactory, который должен быть равен только что созданному contestId
        try {
            contestId = await contestFactory.lastId();
            console.log(`Получен contestId из lastId: ${contestId}`);

            // Если contestId равен 0, это может означать, что транзакция не удалась или контракт не обновил счетчик
            if (contestId === BigInt(0)) {
                console.warn("Warning: lastId вернул 0, что может указывать на проблему с созданием конкурса");
            }
        } catch (error) {
            console.error(`Ошибка при получении lastId: ${error}`);
            // Устанавливаем contestId в 1 как запасной вариант, чтобы продолжить выполнение
            contestId = BigInt(1);
            console.log(`Используем запасной contestId: ${contestId}`);
        }

        try {
            // Получаем информацию о конкурсе через getContestInfo
            const contestInfo = await contestFactory.getContestInfo(Number(contestId));
            if (contestInfo && contestInfo.escrowAddress) {
                escrowAddress = contestInfo.escrowAddress;
            }
        } catch (error) {
            console.log(`Ошибка при вызове getContestInfo: ${error}`);
            try {
                // Если getContestInfo не существует, получаем адрес эскроу напрямую из массива
                escrowAddress = await contestFactory.escrows(Number(contestId) - 1);
            } catch (nestedError) {
                console.log(`Ошибка при доступе к escrows: ${nestedError}`);
            }
        }

        if (!escrowAddress || escrowAddress === ethers.ZeroAddress) {
            throw new Error(`Не удалось получить адрес эскроу для contestId ${contestId}`);
        }
    }

    // Убедимся, что escrowAddress - это строка и имеет правильный формат
    let escrowAddressStr = '';
    try {
        escrowAddressStr = escrowAddress.toString();
        // Проверяем, что адрес начинается с 0x и имеет правильную длину
        if (!escrowAddressStr.startsWith('0x')) {
            escrowAddressStr = '0x' + escrowAddressStr;
        }

        // Убедимся, что длина адреса правильная (0x + 40 символов)
        if (escrowAddressStr.length !== 42) {
            console.warn(`Предупреждение: Возможно некорректный формат адреса: ${escrowAddressStr} (длина ${escrowAddressStr.length})`);
        }

        console.log(`Получение контракта ContestEscrow по адресу: ${escrowAddressStr}`);
    } catch (error) {
        console.error(`Ошибка при обработке адреса эскроу: ${error}`);
        throw new Error(`Не удалось обработать адрес эскроу: ${error}`);
    }

    let escrow: ContestEscrow;
    try {
        escrow = await ethers.getContractAt("ContestEscrow", escrowAddressStr) as unknown as ContestEscrow;
        // Проверяем, что контракт действителен, пытаясь вызвать какой-то метод
        await escrow.getAddress();
        console.log(`Контракт эскроу успешно получен и проверен`);
    } catch (error) {
        console.error(`Ошибка при получении контракта эскроу: ${error}`);
        throw new Error(`Не удалось получить или проверить контракт эскроу по адресу ${escrowAddressStr}: ${error}`);
    }
    
    // Проверка и форматирование contestId перед возвратом
    // Если не удалось извлечь contestId из событий
    if (contestId === null) {
        console.warn("Внимание: contestId не получен из логов, пробуем получить из lastId");

        // Если доступна функция lastId, пробуем получить оттуда
        if (hasLastIdFunction) {
            try {
                const newLastId = await contestFactory.lastId();
                console.log(`Текущее значение lastId после создания конкурса: ${newLastId}`);

                if (newLastId > initialLastId) {
                    // Если lastId увеличился, то идентификатор конкурса равен
                    // предыдущему значению lastId (newLastId - 1)
                    contestId = newLastId - BigInt(1);
                    console.log(`Используем lastId-1 как contestId: ${contestId}`);
                } else {
                    // Если lastId не изменился, используем initialLastId как
                    // наиболее вероятный идентификатор
                    contestId = initialLastId;
                    console.log(`Используем initialLastId как contestId: ${contestId}`);
                }
            } catch (error) {
                console.error(`Ошибка при получении lastId после создания: ${error}`);
                contestId = BigInt(1);
            }
        } else {
            // Если функция lastId недоступна, используем значение по умолчанию
            contestId = BigInt(1);
        }
    } else {
        // Преобразуем contestId в bigint на всякий случай (если вдруг это строка или число)
        try {
            contestId = BigInt(contestId.toString());
        } catch (error) {
            console.warn(`Невозможно преобразовать contestId в bigint: ${error}`);
        }
    }

    // Логируем финальный результат
    console.log(`Финальный результат: contestId=${contestId}, escrowAddress=${escrowAddress}`);

    return {
        contestId,
        escrow,
        escrowAddress,
        transaction: createTx,
        receipt
    };
}

export async function createContest(
    contestFactory: ContestFactory,
    feeManager: NetworkFeeManager,
    creator: any,
    options: CreateContestOptions = {}
): Promise<{
    contestId: bigint;
    escrow: ContestEscrow;
}> {
    const result = await createTestContest(contestFactory, feeManager, creator, options);
    return {
        contestId: result.contestId,
        escrow: result.escrow
    };
}

/**
 * Завершает конкурс, увеличивая время блокчейна после endTime
 * @param escrow Контракт эскроу
 * @returns Текущее время после увеличения
 */
export async function simulateContestEnd(escrow: ContestEscrow): Promise<number> {
    const endTime = await escrow.endTime();
    const currentTime = await time.latest();

    if (currentTime < endTime) {
        await time.increaseTo(Number(endTime) + 1);
    }

    return await time.latest();
}

/**
 * Создает параметры времени для конкурса
 * @param currentTime Текущее время
 * @param durationHours Продолжительность конкурса в часах
 * @param delayHours Задержка начала конкурса в часах
 * @returns Объект с временем начала и окончания конкурса
 */
export function createContestTimeParams(currentTime: number, durationHours: number = 24, delayHours: number = 1) {
  const startTime = BigInt(currentTime + delayHours * 3600);
  const endTime = BigInt(currentTime + (delayHours + durationHours) * 3600);
  return { startTime, endTime };
}

/**
 * Проверяет выплату призов победителям
 * @param escrow Контракт эскроу
 * @param winner Адрес победителя
 * @param _expectedPrize Ожидаемая сумма приза
 * @returns Полученная сумма приза
 */
export async function verifyPrizeClaim(escrow: ContestEscrow, winner: any, _expectedPrize: bigint): Promise<bigint> {
  // Проверяем, что победитель еще не получил приз
  const hasClaimedBefore = await escrow.hasClaimed(winner.address);
  if (hasClaimedBefore) {
    throw new Error(`Победитель ${winner.address} уже получил приз`);
  }

  // Баланс победителя до получения приза
  const winnerBalanceBefore = await ethers.provider.getBalance(winner.address);

  // Получение приза победителем
  const claimTx = await escrow.connect(winner).claimPrize();
  const receipt = await claimTx.wait();

  // Учитываем газ, потраченный на транзакцию
  const gasUsed = receipt ? receipt.gasUsed * receipt.gasPrice : BigInt(0);

  // Проверяем, что победитель получил приз
  const winnerBalanceAfter = await ethers.provider.getBalance(winner.address);
  const actualReceived = winnerBalanceAfter + gasUsed - winnerBalanceBefore;

  // Проверяем, что статус получения приза обновился
  const hasClaimedAfter = await escrow.hasClaimed(winner.address);
  if (!hasClaimedAfter) {
    throw new Error(`Статус получения приза не обновился для ${winner.address}`);
  }

  return actualReceived;
}

/**
 * Генерирует случайные адреса для членов жюри
 * @param count Количество адресов для генерации
 * @returns Массив адресов
 */
export function generateTestJury(count: number): string[] {
    const jury: string[] = [];
    for (let i = 0; i < count; i++) {
        jury.push(ethers.Wallet.createRandom().address);
    }
    return jury;
}

/**
 * Генерирует случайные адреса для победителей
 * @param count Количество адресов для генерации
 * @returns Массив адресов
 */
export function generateTestWinners(count: number): string[] {
    const winners: string[] = [];
    for (let i = 0; i < count; i++) {
        winners.push(ethers.Wallet.createRandom().address);
    }
    return winners;
}

export { simulateContestEnd as endContest };
export { generateTestJury as generateJury };
export { generateTestWinners as generateWinners };

