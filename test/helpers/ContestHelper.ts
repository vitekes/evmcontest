import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    ContestFactory,
    ContestEscrow,
    NetworkFeeManager
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractTransactionResponse } from "ethers";

/**
 * Опции для создания тестового конкурса
 */
export interface CreateContestOptions {
    /** Название конкурса (по умолчанию: 'Test Contest') */
    name?: string;
    /** Описание конкурса (по умолчанию: 'Test Description') */
    description?: string;
    /** Адрес токена для выплаты (по умолчанию: адрес нативной валюты 0x0) */
    paymentToken?: string;
    /** Сумма призового фонда (по умолчанию: 1 ETH) */
    prizeAmount?: bigint;
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
    /** Уникальный ID конкурса (по умолчанию: генерируется автоматически) */
    uniqueId?: number;
    /** Произвольное распределение призового фонда */
    customDistribution?: {
        places: number[];
        percentages: number[];
        descriptions: string[];
    };
}

/**
 * Создает тестовый конкурс с заданными параметрами
 * @param contestFactory - Фабрика конкурсов
 * @param feeManager - Менеджер комиссий
 * @param creator - Создатель конкурса (Signer)
 * @param options - Настройки конкурса
 * @returns Объект с информацией о созданном конкурсе
 */
export async function createTestContest(
    contestFactory: ContestFactory,
    feeManager: NetworkFeeManager,
    creator: SignerWithAddress,
    options: CreateContestOptions = {}
): Promise<{
    contestId: bigint;
    escrow: ContestEscrow;
    escrowAddress: string;
    transaction: ContractTransactionResponse;
}> {
    // Устанавливаем значения по умолчанию
    const name = options.name || 'Test Contest';
    const description = options.description || 'Test Description';
    const paymentToken = options.paymentToken || ethers.ZeroAddress;
    const prizeAmount = options.prizeAmount || ethers.parseEther('1.0');
    // Используем время блокчейна вместо Date.now() для избежания ошибки 'Start time in past'
    const now = Math.floor(Date.now() / 1000) + 60; // Добавляем 60 секунд для надежности
    const submissionDeadline = options.submissionDeadline || now + 7 * 24 * 60 * 60;
    const votingDeadline = options.votingDeadline || submissionDeadline + 3 * 24 * 60 * 60;
    const jurors = options.jurors || [];
    const uniqueId = options.uniqueId || Math.floor(Math.random() * 1000000);
    const hasNonMonetaryPrizes = options.hasNonMonetaryPrizes || false;

    // Настраиваем распределение призового фонда как массив структур
    let distributionArray: Array<{
        place: number;
        percentage: number;
        description: string;
    }>;

    if (options.customDistribution) {
        const { places, percentages, descriptions } = options.customDistribution;
        distributionArray = places.map((place, index) => ({
            place: place,
            percentage: percentages[index] || 0,
            description: descriptions[index] || `Place ${place}`
        }));
    } else {
        // Стандартное распределение: 60% за 1 место, 30% за 2 место, 10% за 3 место
        distributionArray = [
            { place: 1, percentage: 6000, description: 'First place' },   // 60% в базисных пунктах
            { place: 2, percentage: 3000, description: 'Second place' },  // 30% в базисных пунктах  
            { place: 3, percentage: 1000, description: 'Third place' }    // 10% в базисных пунктах
        ];
    }

    // Получаем текущее время блокчейна для более точного startTime
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const blockTime = block ? block.timestamp : Math.floor(Date.now() / 1000);

    // Параметры для создания конкурса согласно CreateContestParamsStruct
    const params = {
        token: paymentToken, // Передаем адрес токена напрямую
        totalPrize: prizeAmount,
        template: 4, // Используем CUSTOM template (enum PrizeTemplate.CUSTOM = 4)
        customDistribution: distributionArray, // Массив PrizeDistributionStruct
        jury: jurors,
        startTime: blockTime + 120, // Добавляем 2 минуты к текущему времени блока
        endTime: votingDeadline,
        contestMetadata: JSON.stringify({ name, description, uniqueId }),
        hasNonMonetaryPrizes: hasNonMonetaryPrizes
    };

    // Создаем конкурс
    let tx: ContractTransactionResponse;
    try {
        // Проверяем параметры перед созданием конкурса
        if (!contestFactory || !creator) {
            throw new Error("Некорректные параметры для создания конкурса");
        }

        // Проверяем баланс перед созданием конкурса
        if (paymentToken === ethers.ZeroAddress) {
            // Получаем текущую комиссию сети
            const networkFee = await feeManager.networkFees(31337); // hardhat chainId
            console.log(`Комиссия сети: ${networkFee} базисных пунктов`);

            // Рассчитываем комиссию (fee = prize * feeRate / 10000)
            const platformFee = prizeAmount * BigInt(networkFee) / 10000n;
            const totalRequired = prizeAmount + platformFee;

            console.log(`Сумма приза: ${ethers.formatEther(prizeAmount)} ETH`);
            console.log(`Комиссия платформы: ${ethers.formatEther(platformFee)} ETH`);
            console.log(`Всего требуется: ${ethers.formatEther(totalRequired)} ETH`);

            // Проверка баланса ETH
            const balance = await ethers.provider.getBalance(creator.address);
            console.log(`Баланс ETH создателя: ${ethers.formatEther(balance)}`);

            if (balance < totalRequired) {
                throw new Error(`Недостаточно ETH для создания конкурса. Баланс: ${ethers.formatEther(balance)}, требуется: ${ethers.formatEther(totalRequired)}`);
            }

            // Если конкурс с ETH, добавляем value при отправке транзакции с учетом комиссии
            tx = await contestFactory.connect(creator).createContest(params, { value: totalRequired });
        } else {
            // Если конкурс с токеном ERC20
            // Проверка существования токена
            if (!paymentToken) {
                throw new Error("Адрес токена не определен");
            }

            // Проверяем одобрение токена
            const tokenContract = await ethers.getContractAt("IERC20", paymentToken);
            const allowance = await tokenContract.allowance(creator.address, await contestFactory.getAddress());

            if (allowance < prizeAmount) {
                await tokenContract.connect(creator).approve(
                    await contestFactory.getAddress(),
                    prizeAmount * 2n
                );
            }

            tx = await contestFactory.connect(creator).createContest(params);
        }
    } catch (error) {
        console.error(`Ошибка при создании конкурса: ${error}`);
        throw error;
    }

    // Ждем выполнения транзакции и получаем receipt
    const receipt = await tx.wait();
    if (!receipt) {
        throw new Error('Transaction receipt is null');
    }

    // Ищем событие ContestCreated
    const contestCreatedEvent = receipt.logs.find(log => {
        try {
            const parsed = contestFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data
            });
            return parsed?.name === 'ContestCreated';
        } catch (e) {
            return false;
        }
    });

    if (!contestCreatedEvent) {
        throw new Error('Contest creation failed: ContestCreated event not found');
    }

    // Парсим данные из события
    const parsedEvent = contestFactory.interface.parseLog({
        topics: contestCreatedEvent.topics as string[],
        data: contestCreatedEvent.data
    });

    if (!parsedEvent) {
        throw new Error('Failed to parse ContestCreated event');
    }

    const contestId = parsedEvent.args.contestId as bigint;
    const escrowAddress = parsedEvent.args.escrow as string;

    // Подключаемся к контракту эскроу
    const escrow = await ethers.getContractAt('ContestEscrow', escrowAddress) as ContestEscrow;

    return {
        contestId,
        escrow,
        escrowAddress,
        transaction: tx
    };
}

/**
 * Опции для имитации завершения конкурса
 */
export interface SimulateContestEndOptions {
    /** Адреса победителей */
    winners: string[];
    /** Адреса членов жюри для голосования */
    jurors?: string[];
    /** Пометить конкурс как заблокированный (по умолчанию: false) */
    flagAsFraud?: boolean;
    /** Результаты голосования */
    votes?: Array<{
        juror: string;
        contestantAddress: string;
        place: number;
        comment: string;
    }>;
}

/**
 * Имитирует завершение конкурса с голосованием и определением победителей
 * @param escrow - Контракт эскроу конкурса
 * @param admin - Администратор платформы
 * @param options - Опции для симуляции завершения
 * @returns Результат операции
 */
export async function simulateContestEnd(
    escrow: ContestEscrow,
    admin: SignerWithAddress,
    options: SimulateContestEndOptions
): Promise<{
    winners: string[];
    places: number[];
    escrow: ContestEscrow;
    finalState: string;
}> {
    // Получаем информацию о конкурсе
    try {
        const contestInfo = await escrow.getContestInfo();
        const distribution = await escrow.getDistribution();
        const numPlaces = distribution.length;

        // Проверяем, что у нас достаточно победителей
        if (options.winners.length < numPlaces) {
            throw new Error(`Not enough winners provided. Need at least ${numPlaces} winners.`);
        }

        // Если конкурс помечен как мошеннический, используем emergency withdraw
        if (options.flagAsFraud) {
            try {
                await escrow.connect(admin).emergencyWithdraw("Fraud detected");
            } catch (error) {
                console.warn('Emergency withdraw failed:', error);
            }

            return {
                winners: [],
                places: [],
                escrow,
                finalState: 'EMERGENCY_WITHDRAWN'
            };
        }

        // Получаем время окончания конкурса
        const endTime = await escrow.endTime();
        const currentTime = await time.latest();

        // Если конкурс еще не закончился, перематываем время
        if (currentTime < endTime) {
            await time.increaseTo(Number(endTime) + 1);
        }

        // Подготавливаем данные победителей
        const finalWinners = options.winners.slice(0, numPlaces);
        const finalPlaces = Array.from({ length: finalWinners.length }, (_, i) => i + 1);

        try {
            // Объявляем победителей (только 2 параметра)
            await escrow.connect(admin).declareWinners(finalWinners, finalPlaces);

            return {
                winners: finalWinners,
                places: finalPlaces,
                escrow,
                finalState: 'FINALIZED'
            };
        } catch (error) {
            console.error('Failed to declare winners:', error);
            
            return {
                winners: [],
                places: [],
                escrow,
                finalState: 'ERROR'
            };
        }
    } catch (error) {
        console.error('Failed to simulate contest end:', error);
        return {
            winners: [],
            places: [],
            escrow,
            finalState: 'ERROR'
        };
    }
}

/**
 * Завершает конкурс, увеличивая время блокчейна после endTime
 * @param escrow Контракт эскроу
 * @returns Текущее время после увеличения
 */
export async function endContest(escrow: ContestEscrow): Promise<number> {
    try {
        const endTime = await escrow.endTime();
        const currentTime = await time.latest();

        if (currentTime < endTime) {
            await time.increaseTo(Number(endTime) + 1);
        }

        return await time.latest();
    } catch (error) {
        console.error('Failed to end contest:', error);
        return await time.latest();
    }
}

/**
 * Генерирует массив случайных адресов для тестовых членов жюри
 * @param count - Количество адресов (по умолчанию 3)
 * @returns Массив адресов
 */
export async function generateTestJury(count: number = 3): Promise<string[]> {
    const jurors: string[] = [];
    const signers = await ethers.getSigners();

    // Используем адреса из доступных signers, начиная с 5-го
    const startIndex = 5;
    for (let i = 0; i < count; i++) {
        if (startIndex + i < signers.length) {
            jurors.push(await signers[startIndex + i].getAddress());
        } else {
            // Если не хватает signers, создаем новый случайный адрес
            const wallet = ethers.Wallet.createRandom();
            jurors.push(wallet.address);
        }
    }

    return jurors;
}

/**
 * Генерирует массив случайных адресов для тестовых победителей
 * @param count - Количество адресов (по умолчанию 3)
 * @returns Массив адресов
 */
export async function generateTestWinners(count: number = 3): Promise<string[]> {
    const winners: string[] = [];
    const signers = await ethers.getSigners();

    // Используем адреса из доступных signers, начиная с 10-го
    const startIndex = 10;
    for (let i = 0; i < count; i++) {
        if (startIndex + i < signers.length) {
            winners.push(await signers[startIndex + i].getAddress());
        } else {
            // Если не хватает signers, создаем новый случайный адрес
            const wallet = ethers.Wallet.createRandom();
            winners.push(wallet.address);
        }
    }

    return winners;
}

export {
    createTestContest as createContest,
    simulateContestEnd as simulateContest,
    generateTestJury as generateJury,
    generateTestWinners as generateWinners
};