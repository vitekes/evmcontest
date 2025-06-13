import { ethers } from "hardhat";
import {
    ContestFactory,
    PrizeManager,
    CreatorBadges
} from "../../typechain-types";
import { deployTokenValidatorFixture } from "./TokenFixture";
import { deployNetworkFeeManagerFixture } from "./FeesFixture";
import { prepareAllTokensForAccounts } from "../helpers";

/**
 * Фикстура для тестирования жизненного цикла конкурса
 * @returns Развернутые контракты и аккаунты для тестов
 */
export async function deployContestLifecycleFixture() {
    const [owner, creator, winner1, winner2, juryMember, treasury] = await ethers.getSigners();

    // Развертываем все необходимые контракты
    const tokenFixture = await deployTokenValidatorFixture();
    const tokenValidator = tokenFixture.tokenValidator;

    // NetworkFeeManager
    const NetworkFeeManager = await ethers.getContractFactory("NetworkFeeManager");
    const networkFeeManager = await NetworkFeeManager.deploy(treasury.address);
    await networkFeeManager.waitForDeployment();

    // PrizeTemplates
    const PrizeTemplates = await ethers.getContractFactory("PrizeTemplates");
    const prizeTemplates = await PrizeTemplates.deploy();
    await prizeTemplates.waitForDeployment();

    // PrizeManager
    const PrizeManager = await ethers.getContractFactory("PrizeManager");
    const prizeManager = await PrizeManager.deploy();
    await prizeManager.waitForDeployment();

    // CreatorBadges
    const CreatorBadges = await ethers.getContractFactory("CreatorBadges");
    const creatorBadges = await CreatorBadges.deploy();
    await creatorBadges.waitForDeployment();

    // ContestEscrow (имплементация для клонов)
    const ContestEscrow = await ethers.getContractFactory("ContestEscrow");
    const contestEscrow = await ContestEscrow.deploy();
    await contestEscrow.waitForDeployment();

    // ContestFactory (основной контракт)
    const ContestFactory = await ethers.getContractFactory("ContestFactory");
    const contestFactory = await ContestFactory.deploy(
        await contestEscrow.getAddress(),
        await networkFeeManager.getAddress(),
        await prizeTemplates.getAddress(),
        await creatorBadges.getAddress(),
        await tokenValidator.getAddress(),
        await prizeManager.getAddress()
    );
    await contestFactory.waitForDeployment();

    // Настройка взаимодействия между контрактами
    await networkFeeManager.setNetworkFee(31337, 200); // 2% для Hardhat Network
    await networkFeeManager.setContestFactory(await contestFactory.getAddress());
    await prizeManager.setAuthorizedCreator(await contestFactory.getAddress(), true);
    await creatorBadges.setContestFactory(await contestFactory.getAddress());

    return {
      contestFactory,
      networkFeeManager,
      tokenValidator,
      prizeTemplates,
      owner,
      creator,
      winner1,
      winner2,
      juryMember,
      treasury
    };
}

export async function deployFullPlatformFixture() {
    console.log("🚀 Deploying full platform for tests...");

    // Используем существующие фикстуры
    const tokenFixture = await deployTokenValidatorFixture();
    const feeFixture = await deployNetworkFeeManagerFixture();

    // Деплой дополнительных контрактов для конкурсов
    const PrizeTemplatesFactory = await ethers.getContractFactory("PrizeTemplates");
    const prizeTemplates = await PrizeTemplatesFactory.deploy();
    await prizeTemplates.waitForDeployment();

    const PrizeManagerFactory = await ethers.getContractFactory("PrizeManager");
    const prizeManager = await PrizeManagerFactory.deploy();
    await prizeManager.waitForDeployment();

    const CreatorBadgesFactory = await ethers.getContractFactory("CreatorBadges");
    const creatorBadges = await CreatorBadgesFactory.deploy();
    await creatorBadges.waitForDeployment();

    const ContestEscrowFactory = await ethers.getContractFactory("ContestEscrow");
    const escrowImpl = await ContestEscrowFactory.deploy();
    await escrowImpl.waitForDeployment();

    const ContestFactoryFactory = await ethers.getContractFactory("ContestFactory");
    const contestFactory = await ContestFactoryFactory.deploy(
        await escrowImpl.getAddress(),
        feeFixture.addresses.feeManager,
        await prizeTemplates.getAddress(),
        await creatorBadges.getAddress(),
        tokenFixture.addresses.tokenValidator,
        await prizeManager.getAddress()
    );
    await contestFactory.waitForDeployment();

    // Связывание контрактов
    await feeFixture.feeManager.setContestFactory(await contestFactory.getAddress());
    await creatorBadges.setContestFactory(await contestFactory.getAddress());
    
    const allAccounts = [
        tokenFixture.creator1,
        tokenFixture.creator2,
        tokenFixture.participant1,
        tokenFixture.participant2,
        tokenFixture.winner1,
        tokenFixture.winner2,
        tokenFixture.winner3
    ];

    console.log("🪙 Preparing tokens for all accounts...");
    await prepareAllTokensForAccounts(
        {
            mockUSDC: tokenFixture.mockUSDC,
            mockUSDT: tokenFixture.mockUSDT,
            mockWETH: tokenFixture.mockWETH
        },
        tokenFixture.tokenValidator,
        allAccounts,
        await contestFactory.getAddress()
    );

    console.log("✅ Full platform deployed successfully!");

    return {
        // Контракты
        contestFactory: contestFactory as ContestFactory,
        feeManager: feeFixture.feeManager,
        tokenValidator: tokenFixture.tokenValidator,
        prizeManager: prizeManager as PrizeManager,
        creatorBadges: creatorBadges as CreatorBadges,
        prizeTemplates,
        escrowImpl,

        // Mock токены из tokenFixture
        mockUSDC: tokenFixture.mockUSDC,
        mockUSDT: tokenFixture.mockUSDT,
        mockWETH: tokenFixture.mockWETH,

        // Аккаунты из tokenFixture (они одинаковые)
        owner: tokenFixture.owner,
        creator1: tokenFixture.creator1,
        creator2: tokenFixture.creator2,
        jury1: tokenFixture.jury1,
        jury2: tokenFixture.jury2,
        jury3: tokenFixture.jury3,
        winner1: tokenFixture.winner1,
        winner2: tokenFixture.winner2,
        winner3: tokenFixture.winner3,
        participant1: tokenFixture.participant1,
        participant2: tokenFixture.participant2,
        treasury: tokenFixture.treasury,
        maliciousUser: tokenFixture.maliciousUser,

        // Все адреса
        addresses: {
            ...tokenFixture.addresses,
            ...feeFixture.addresses,
            contestFactory: await contestFactory.getAddress(),
            prizeManager: await prizeManager.getAddress(),
            creatorBadges: await creatorBadges.getAddress(),
            prizeTemplates: await prizeTemplates.getAddress(),
            escrowImpl: await escrowImpl.getAddress()
        }
    };
}