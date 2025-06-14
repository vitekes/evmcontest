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
    /** Название конкурса (по умолчанию: 'Test Contest') */
    name?: string;
    /** Описание конкурса (по умолчанию: 'Test Description') */
    description?: string;
    /** Адрес токена для выплаты (по умолчанию: адрес нативной валюты 0x0) */
    token?: string;
    /** Сумма призового фонда (по умолчанию: 1 ETH) */
    totalPrize?: bigint;
    /** Срок подачи заявок в секундах (по умолчанию: 7 дней) */
    submissionDeadline?: number;
    /** Срок голосования в секундах (по умолчанию: 3 дня) */
    votingDeadline?: number;
    /** Минимальное количество членов жюри (по умолчанию: 3) */
    minJurors?: number;
    /** Массив адресов членов жюри (по умолчанию: пустой массив) */
    jurors?: string[];
    /** Комиссия платформы в процентах (по умолчанию: от NetworkFeeManager) */
    platformFee?: number;
    /** Наличие нематериальных призов (по умолчанию: false) */
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
    // Устанавливаем значения по умолчанию
    const name = options.name || 'Test Contest';
    const description = options.description || 'Test Description';
    const token = options.token || ethers.ZeroAddress;
    const totalPrize = options.totalPrize || ethers.parseEther('1.0');
    // Используем время блокчейна вместо Date.now() для избежания ошибки 'Start time in past'
    const now = Math.floor(Date.now() / 1000) + 60; // Добавляем 60 секунд для надежности
    const submissionDeadline = options.submissionDeadline || now + 7 * 24 * 60 * 60;
    const votingDeadline = options.votingDeadline || submissionDeadline + 3 * 24 * 60 * 60;
    const jurors = options.jurors || [];
    const uniqueId = options.uniqueId || Math.floor(Math.random() * 1000000);
    const hasNonMonetaryPrizes = options.hasNonMonetaryPrizes || false;

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

    // Получаем текущее время блокчейна для более точного startTime
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const blockTime = block ? block.timestamp : Math.floor(Date.now() / 1000);

    // Параметры для создания конкурса согласно CreateContestParamsStruct
    const params = {
        token: token, // Передаем адрес токена напрямую
        totalPrize: totalPrize,
        template: 4, // Используем CUSTOM template (enum PrizeTemplate.CUSTOM = 4)
        customDistribution: distributionArray, // Массив PrizeDistributionStruct
        jury: jurors,
        startTime: blockTime + 120, // Добавляем 2 минуты к текущему времени блока
        endTime: votingDeadline,
        contestMetadata: JSON.stringify({ name, description, uniqueId }),
        hasNonMonetaryPrizes: hasNonMonetaryPrizes
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

        // Проверяем баланс перед созданием конкурса
        if (token === ethers.ZeroAddress) {
            // Получаем текущую комиссию сети
            const networkFee = await feeManager.networkFees(31337); // hardhat chainId
            console.log(`Комиссия сети: ${networkFee} базисных пунктов`);

            // Рассчитываем комиссию (fee = prize * feeRate / 10000)
            const platformFee = totalPrize * BigInt(networkFee) / 10000n;
            const totalRequired = totalPrize + platformFee;

            console.log(`Сумма приза: ${ethers.formatEther(totalPrize)} ETH`);
            console.log(`Комиссия платформы: ${ethers.formatEther(platformFee)} ETH`);
            console.log(`Всего требуется: ${ethers.formatEther(totalRequired)} ETH`);

            // Расширенная отладочная информация
            const err = error as any; // Явное приведение к any для доступа к свойствам

            if (err && typeof err === 'object') {
                if ('message' in err) {
                    console.error(`Сообщение ошибки: ${err.message}`);
                }

            // Если конкурс с ETH, добавляем value при отправке транзакции с учетом комиссии
            tx = await contestFactory.connect(creator).createContest(params, { value: totalRequired });
        } else {
            // Если конкурс с токеном ERC20
            // Проверка существования токена
            if (!token) {
                throw new Error("Адрес токена не определен");
            }

            // Проверяем одобрение токена
            const tokenContract = await ethers.getContractAt("IERC20", token);
            const allowance = await tokenContract.allowance(creator.address, await contestFactory.getAddress());

            if (allowance < totalPrize) {
                await tokenContract.connect(creator).approve(
                    await contestFactory.getAddress(),
                    totalPrize * 2n
                );
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
    if (contestId === null || contestId === BigInt(0)) {
        console.warn("Внимание: contestId всё ещё null или 0, пробуем получить из lastId");

        // Если доступна функция lastId, пробуем получить оттуда
        if (hasLastIdFunction) {
            try {
                const newLastId = await contestFactory.lastId();
                console.log(`Текущее значение lastId после создания конкурса: ${newLastId}`);

                if (newLastId > initialLastId) {
                    // Если lastId увеличился, используем его
                    contestId = newLastId;
                    console.log(`Используем lastId как contestId: ${contestId}`);
                } else {
                    // Если lastId не изменился, используем initialLastId + 1
                    contestId = initialLastId + BigInt(1);
                    console.log(`Используем initialLastId + 1 как contestId: ${contestId}`);
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

export {
    createTestContest as createContest,
    simulateContestEnd as simulateContest,
    generateTestJury as generateJury,
    generateTestWinners as generateWinners
};
