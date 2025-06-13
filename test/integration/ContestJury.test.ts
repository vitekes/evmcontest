import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  ContestFactory,
  ContestEscrow,
  NetworkFeeManager,
  TokenValidator
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { createTestContest, endContest, generateJury, generateWinners } from "../helpers/ContestHelper";
import { TEST_CONSTANTS, deployTokenValidatorFixture } from "../fixtures";

describe("Contest Jury Integration", function() {
  // Объявление переменных
  let contestFactory: ContestFactory;
  let networkFeeManager: NetworkFeeManager;
  let tokenValidator: TokenValidator;

  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let juryMember1: SignerWithAddress;
  let juryMember2: SignerWithAddress;
  let juryMember3: SignerWithAddress;
  let participant: SignerWithAddress;
  let treasury: SignerWithAddress;

  // Фикстура для развертывания контрактов
  async function deployContractsFixture() {
    // Получаем подписанты (аккаунты)
    [owner, creator, juryMember1, juryMember2, juryMember3, participant, treasury] = await ethers.getSigners();

    // Развертываем все необходимые контракты
    const tokenFixture = await deployTokenValidatorFixture();
    tokenValidator = tokenFixture.tokenValidator;

    const NetworkFeeManager = await ethers.getContractFactory("NetworkFeeManager");
    networkFeeManager = await NetworkFeeManager.deploy(treasury.address);
    await networkFeeManager.waitForDeployment();

    const PrizeTemplates = await ethers.getContractFactory("PrizeTemplates");
    const prizeTemplates = await PrizeTemplates.deploy();
    await prizeTemplates.waitForDeployment();

    const PrizeManager = await ethers.getContractFactory("PrizeManager");
    const prizeManager = await PrizeManager.deploy();
    await prizeManager.waitForDeployment();

    const CreatorBadges = await ethers.getContractFactory("CreatorBadges");
    const creatorBadges = await CreatorBadges.deploy();
    await creatorBadges.waitForDeployment();

    const ContestEscrow = await ethers.getContractFactory("ContestEscrow");
    const contestEscrow = await ContestEscrow.deploy();
    await contestEscrow.waitForDeployment();

    const ContestFactory = await ethers.getContractFactory("ContestFactory");
    contestFactory = await ContestFactory.deploy(
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
      owner,
      creator,
      juryMember1,
      juryMember2,
      juryMember3,
      participant,
      treasury
    };
  }

  // Перед каждым тестом загружаем фикстуру
  beforeEach(async function() {
    const fixture = await loadFixture(deployContractsFixture);
    Object.assign(this, fixture);
  });

  // Тест на проверку объявления победителей с большим жюри
  it("should allow any jury member to declare winners", async function() {
    // Создаем конкурс с 3 членами жюри
    const totalPrize = ethers.parseEther("1");
    const currentTime = await time.latest();
    const startTime = BigInt(currentTime + 3600);
    const endTime = BigInt(currentTime + 86400);

    const juryMembers = [juryMember1.address, juryMember2.address, juryMember3.address];

    const contestResult = await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: ethers.ZeroAddress,
        totalPrize: totalPrize,
        template: 0, // Winner takes all
        startTime: startTime,
        endTime: endTime,
        jury: juryMembers,
        metadata: {
          title: "Multi-Jury Test",
          description: "Testing contest with multiple jury members"
        }
      }
    );

    const { escrow } = contestResult;
    console.log("Конкурс с несколькими членами жюри создан");

    // Проверяем, что все указанные члены жюри действительно имеют роль жюри
    for (const juryAddress of juryMembers) {
      const isJury = await escrow.isJury(juryAddress);
      expect(isJury).to.be.true;
    }

    // Проверяем, что создатель не является членом жюри (так как мы явно указали жюри)
    const isCreatorJury = await escrow.isJury(creator.address);
    expect(isCreatorJury).to.be.false;

    // Завершаем конкурс
    await endContest(escrow);

    // Генерируем случайного победителя
    const winners = generateWinners(1);
    const places = [1];

    // Объявляем победителя от имени первого члена жюри
    await escrow.connect(juryMember1).declareWinners(winners, places);

    // Проверяем, что победитель был объявлен
    const [declaredWinners, declaredPlaces] = await escrow.getWinners();
    expect(declaredWinners.length).to.equal(1);
    expect(declaredWinners[0]).to.equal(winners[0]);

    console.log("Тест с несколькими членами жюри успешно завершен");
  });

  // Тест проверки на конфликт при объявлении победителей разными членами жюри
  it("should prevent declaring winners twice", async function() {
    // Создаем конкурс с 2 членами жюри
    const totalPrize = ethers.parseEther("1");
    const currentTime = await time.latest();
    const startTime = BigInt(currentTime + 3600);
    const endTime = BigInt(currentTime + 86400);

    const juryMembers = [juryMember1.address, juryMember2.address];

    const contestResult = await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: ethers.ZeroAddress,
        totalPrize: totalPrize,
        template: 0,
        startTime: startTime,
        endTime: endTime,
        jury: juryMembers,
        metadata: {
          title: "Jury Conflict Test",
          description: "Testing prevention of multiple winner declarations"
        }
      }
    );

    const { escrow } = contestResult;
    console.log("Конкурс для проверки конфликта жюри создан");

    // Завершаем конкурс
    await endContest(escrow);

    // Генерируем победителей
    const winners1 = generateWinners(1);
    const places1 = [1];

    // Объявляем победителя от имени первого члена жюри
    await escrow.connect(juryMember1).declareWinners(winners1, places1);

    // Проверяем, что конкурс уже финализирован
    const contestInfo = await escrow.getContestInfo();
    expect(contestInfo.isFinalized).to.be.true;

    // Генерируем других победителей
    const winners2 = generateWinners(1);
    const places2 = [1];

    // Пытаемся объявить других победителей от имени второго члена жюри
    // Это должно быть отклонено, так как конкурс уже финализирован
    await expect(
      escrow.connect(juryMember2).declareWinners(winners2, places2)
    ).to.be.reverted;

    // Проверяем, что победители не изменились
    const [declaredWinners, declaredPlaces] = await escrow.getWinners();
    expect(declaredWinners.length).to.equal(1);
    expect(declaredWinners[0]).to.equal(winners1[0]);

    console.log("Тест на предотвращение повторного объявления победителей успешно завершен");
  });

  // Тест на проверку безопасности: конкурс без жюри
  it("should make creator the default jury when no jury specified", async function() {
    // Создаем конкурс без явного указания жюри
    const totalPrize = ethers.parseEther("0.5");
    const currentTime = await time.latest();
    const startTime = BigInt(currentTime + 3600);
    const endTime = BigInt(currentTime + 86400);

    const contestResult = await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: ethers.ZeroAddress,
        totalPrize: totalPrize,
        template: 0,
        startTime: startTime,
        endTime: endTime,
        // Не указываем jury, должен использоваться creator по умолчанию
        metadata: {
          title: "Default Jury Test",
          description: "Testing creator as default jury"
        }
      }
    );

    const { escrow } = contestResult;
    console.log("Конкурс без явного указания жюри создан");

    // Проверяем, что создатель имеет роль жюри
    const isCreatorJury = await escrow.isJury(creator.address);
    expect(isCreatorJury).to.be.true;

    // Проверяем, что другие адреса не имеют роли жюри
    const isJuryMember1Jury = await escrow.isJury(juryMember1.address);
    expect(isJuryMember1Jury).to.be.false;

    // Завершаем конкурс
    await endContest(escrow);

    // Генерируем победителя
    const winners = generateWinners(1);
    const places = [1];

    // Объявляем победителя от имени создателя
    await escrow.connect(creator).declareWinners(winners, places);

    // Проверяем, что победитель был объявлен
    const [declaredWinners, declaredPlaces] = await escrow.getWinners();
    expect(declaredWinners.length).to.equal(1);
    expect(declaredWinners[0]).to.equal(winners[0]);

    console.log("Тест с создателем в качестве жюри по умолчанию успешно завершен");
  });

  // Тест на большое количество членов жюри
  it("should handle a large jury", async function() {
    // Создаем конкурс с 10 членами жюри
    const totalPrize = ethers.parseEther("1");
    const currentTime = await time.latest();
    const startTime = BigInt(currentTime + 3600);
    const endTime = BigInt(currentTime + 86400);

    // Генерируем 10 случайных адресов жюри
    const juryMembers = generateJury(10);

    const contestResult = await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: ethers.ZeroAddress,
        totalPrize: totalPrize,
        template: 0,
        startTime: startTime,
        endTime: endTime,
        jury: juryMembers,
        metadata: {
          title: "Large Jury Test",
          description: "Testing contest with many jury members"
        }
      }
    );

    const { escrow } = contestResult;
    console.log("Конкурс с большим количеством членов жюри создан");

    // Проверяем, что все члены жюри действительно имеют роль жюри
    for (const juryAddress of juryMembers) {
      const isJury = await escrow.isJury(juryAddress);
      expect(isJury).to.be.true;
    }

    console.log("Тест с большим количеством членов жюри успешно завершен");
  });
});
