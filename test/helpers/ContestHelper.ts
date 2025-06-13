import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    ContestFactory,
    ContestEscrow,
    NetworkFeeManager
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractTransactionResponse } from "ethers";

export interface CreateContestOptions {
    token?: string;
    totalPrize?: bigint;
    template?: number;
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
    creator: SignerWithAddress,
    options: CreateContestOptions = {}
): Promise<{
    contestId: bigint;
    escrow: ContestEscrow;
    escrowAddress: string;
    transaction: ContractTransactionResponse;
}> {
    const token = options.token ?? ethers.ZeroAddress;
    const totalPrize = options.totalPrize ?? ethers.parseEther("1");
    const template = options.template ?? 0;
    const customDistribution = options.customDistribution ?? [];
    const jury = options.jury ?? [];
    const metadata = options.metadata ?? { title: "Test Contest", description: "" };
    const uniqueId = options.uniqueId ?? Math.floor(Math.random() * 1_000_000);
    const hasNonMonetaryPrizes = options.hasNonMonetaryPrizes ?? false;

    const now = await time.latest();
    const startTime = options.startTime ?? BigInt(now + 120);
    const endTime = options.endTime ?? startTime + 24n * 3600n;

    const params = {
        token,
        totalPrize,
        template,
        customDistribution,
        jury,
        startTime,
        endTime,
        contestMetadata: JSON.stringify({
            title: metadata.title ?? "",
            description: metadata.description ?? "",
            uniqueId
        }),
        hasNonMonetaryPrizes
    };

    let tx: ContractTransactionResponse;

    if (token === ethers.ZeroAddress) {
        const feeRate = await feeManager.networkFees(31337);
        const fee = (totalPrize * BigInt(feeRate)) / 10000n;
        const value = totalPrize + fee;
        tx = await contestFactory.connect(creator).createContest(params, { value });
    } else {
        const tokenContract = await ethers.getContractAt("IERC20", token);
        const allowance = await tokenContract.allowance(
            creator.address,
            await contestFactory.getAddress()
        );
        if (allowance < totalPrize) {
            await tokenContract
                .connect(creator)
                .approve(await contestFactory.getAddress(), totalPrize * 2n);
        }
        tx = await contestFactory.connect(creator).createContest(params);
    }

    const receipt = await tx.wait();
    if (!receipt) {
        throw new Error("Transaction receipt is null");
    }

    const event = receipt.logs.find((log) => {
        try {
            const parsed = contestFactory.interface.parseLog({
                topics: log.topics as string[],
                data: log.data
            });
            return parsed?.name === "ContestCreated";
        } catch {
            return false;
        }
    });
    if (!event) {
        throw new Error("ContestCreated event not found");
    }
    const parsed = contestFactory.interface.parseLog({
        topics: event.topics as string[],
        data: event.data
    });
    const contestId = parsed.args.contestId as bigint;
    const escrowAddress = parsed.args.escrow as string;
    const escrow = (await ethers.getContractAt(
        "ContestEscrow",
        escrowAddress
    )) as ContestEscrow;

    return { contestId, escrow, escrowAddress, transaction: tx };
}

export async function endContest(escrow: ContestEscrow): Promise<number> {
    const endTime = await escrow.endTime();
    const now = await time.latest();
    if (now < endTime) {
        await time.increaseTo(Number(endTime) + 1);
    }
    return await time.latest();
}

export function createContestTimeParams(
    currentTime: number,
    durationHours: number = 24,
    delayHours: number = 1
) {
    const startTime = BigInt(currentTime + delayHours * 3600);
    const endTime = BigInt(currentTime + (delayHours + durationHours) * 3600);
    return { startTime, endTime };
}

export async function verifyPrizeClaim(
    escrow: ContestEscrow,
    winner: SignerWithAddress,
    expectedPrize: bigint
): Promise<bigint> {
    const before = await ethers.provider.getBalance(winner.address);
    const tx = await escrow.connect(winner).claimPrize();
    const receipt = await tx.wait();
    const gasUsed = receipt ? receipt.gasUsed * receipt.gasPrice : 0n;
    const after = await ethers.provider.getBalance(winner.address);
    return after + gasUsed - before;
}

export function generateTestJury(count: number): string[] {
    const jury: string[] = [];
    for (let i = 0; i < count; i++) {
        jury.push(ethers.Wallet.createRandom().address);
    }
    return jury;
}

export function generateTestWinners(count: number): string[] {
    const winners: string[] = [];
    for (let i = 0; i < count; i++) {
        winners.push(ethers.Wallet.createRandom().address);
    }
    return winners;
}

export { endContest as simulateContestEnd };
