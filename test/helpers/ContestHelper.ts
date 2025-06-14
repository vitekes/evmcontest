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
    // Проверка наличия функции lastId не обязательна для тестов
    console.log("Начало создания тестового конкурса с параметрами:", JSON.stringify(options, (_, value) => 
        typeof value === 'bigint' ? value.toString() : value
    ));
    const now = await time.latest();
    const uniqueId = options.uniqueId || Math.floor(Math.random() * 1000000);

    // Временные параметры конкурса
    const startDelay = options.startDelay ?? TEST_CONSTANTS.DEFAULT_START_DELAY;
    const duration = options.duration ?? TEST_CONSTANTS.DEFAULT_DURATION;

    // Используем startTime и endTime из параметров, если они указаны
    const startTime = options.startTime ??
        BigInt(now + startDelay + (uniqueId % 100));

    const endTime = options.endTime ??
        startTime + BigInt(duration);

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

        const tokenValidator = await ethers.getContractAt(
            "TokenValidator",
            await contestFactory.tokenValidator(),
        );

        await prepareERC20Token(
            token,
            tokenValidator,
            creator,
            totalRequired,
            await contestFactory.getAddress(),
        );

        try {
            const gasEstimate = await contestFactory
                .connect(creator)
                .createContest.estimateGas(contestParams);
            const gasLimit = Math.ceil(Number(gasEstimate) * 1.3);
            createTx = await contestFactory.connect(creator).createContest(contestParams, {
                gasLimit,
            });
        } catch {
            createTx = await contestFactory.connect(creator).createContest(contestParams, {
                gasLimit: 10_000_000,
            });
        }
    }

    const receipt = await createTx.wait();

    const parsed = receipt.logs
        .map((log) => {
            try {
                return contestFactory.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .find((e) => e && e.name === "ContestCreated");

    if (!parsed) {
        throw new Error("ContestCreated event not found");
    }

    const contestId: bigint = parsed.args.contestId;
    const escrowAddress: string = parsed.args.escrow;
    const escrow = (await ethers.getContractAt(
        "ContestEscrow",
        escrowAddress,
    )) as unknown as ContestEscrow;

    return {
        contestId,
        escrow,
        escrowAddress,
        transaction: createTx,
        receipt,
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

