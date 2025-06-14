import { expect } from "chai";
import { ethers } from "hardhat";

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  ContestFactory,
  NetworkFeeManager,
  TokenValidator,
  MockUSDT,
  MockUSDC
} from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
  createTestContest, 
  endContest,
  createContestTimeParams,
  generateTestJury
} from "../helpers/ContestHelper";
import { deployTokenValidatorFixture } from "../fixtures";

describe("Contest Token Integration Tests", function() {
  // Увеличиваем timeout для интеграционных тестов
  this.timeout(120000);

  // Объявление переменных
  let contestFactory: ContestFactory;
  let networkFeeManager: NetworkFeeManager;
  let tokenValidator: TokenValidator;

  let owner: SignerWithAddress;
  let creator: SignerWithAddress;
  let winner: SignerWithAddress;
  let juryMember: SignerWithAddress;
  let treasury: SignerWithAddress;

  let mockUSDT: MockUSDT;
  let mockUSDC: MockUSDC;

  // Упрощенная фикстура для развертывания контрактов
  async function deployContractsFixture() {
    [owner, creator, winner, juryMember, treasury] = await ethers.getSigners();

    // 1. Развертываем токены и валидатор
    const tokenFixture = await deployTokenValidatorFixture();
    tokenValidator = tokenFixture.tokenValidator;
    mockUSDT = tokenFixture.mockUSDT;
    mockUSDC = tokenFixture.mockUSDC;

    // 2. NetworkFeeManager
    const NetworkFeeManager = await ethers.getContractFactory("NetworkFeeManager");
    networkFeeManager = await NetworkFeeManager.deploy(treasury.address);
    await networkFeeManager.waitForDeployment();

    // 3. Остальные контракты
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

    // 4. ContestFactory
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

    // 5. Настройка контрактов
    await networkFeeManager.setNetworkFee(31337, 200); // 2%
    await networkFeeManager.setContestFactory(await contestFactory.getAddress());
    await prizeManager.setAuthorizedCreator(await contestFactory.getAddress(), true);
    await creatorBadges.setContestFactory(await contestFactory.getAddress());

    // 6. Подготовка токенов
    const tokenAmount = ethers.parseUnits("10000", 18);
    
    // Минт токенов создателю
    await mockUSDT.mint(creator.address, tokenAmount);
    await mockUSDC.mint(creator.address, tokenAmount);

    // Одобрения
    await mockUSDT.connect(creator).approve(await contestFactory.getAddress(), tokenAmount);
    await mockUSDC.connect(creator).approve(await contestFactory.getAddress(), tokenAmount);

    return {
      contestFactory,
      networkFeeManager,
      tokenValidator,
      mockUSDT,
      mockUSDC,
      owner,
      creator,
      winner,
      juryMember,
      treasury
    };
  }

  beforeEach(async function() {
    const fixture = await loadFixture(deployContractsFixture);
    Object.assign(this, fixture);
  });

  it("Полный жизненный цикл конкурса с USDT токеном", async function() {
    console.log("🚀 Создание конкурса с USDT призом");

    const totalPrize = ethers.parseUnits("100", await mockUSDT.decimals());
    const currentTime = await time.latest();
    const {startTime, endTime} = createContestTimeParams(currentTime, 24, 1);

    const contestResult = await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: await mockUSDT.getAddress(),
        totalPrize: totalPrize,
        template: 1,
        startTime: startTime,
        endTime: endTime,
        jury: [juryMember.address],
        metadata: {
          title: "USDT Test Contest",
          description: "Testing full contest lifecycle with USDT"
        }
      }
    );

    const { contestId, escrow, escrowAddress } = contestResult;
    console.log(`Конкурс создан: ID=${contestId}, адрес эскроу=${escrowAddress}`);

    // Проверки
    expect(contestId).to.be.gte(BigInt(0));
    expect(escrowAddress).to.not.equal(ethers.ZeroAddress);

    const escrowBalance = await mockUSDT.balanceOf(escrowAddress);
    expect(escrowBalance).to.equal(totalPrize);

    // Начало конкурса
    console.log("⏱️ Ожидание начала конкурса");
    await time.increaseTo(Number(startTime) + 10);

    // Завершение конкурса
    console.log("🏁 Завершение конкурса");
    await endContest(escrow);

    // Объявление победителя
    console.log("🏆 Объявление победителя");
    const winners = [winner.address];
    const places = [1];

    await escrow.connect(juryMember).declareWinners(winners, places);

    // Получение приза
    console.log("💰 Получение приза");
    const winnerBalanceBefore = await mockUSDT.balanceOf(winner.address);
    
    await escrow.connect(winner).claimPrize();
    
    const winnerBalanceAfter = await mockUSDT.balanceOf(winner.address);
    const received = winnerBalanceAfter - winnerBalanceBefore;
    
    expect(received).to.be.gt(0);
    console.log("✅ Тест успешно завершен");
  });

  it("Создание конкурсов с различными типами токенов", async function() {
    console.log("💎 Создание конкурса с ETH");
    
    // ETH конкурс
    const ethTotalPrize = ethers.parseEther("1");
    const currentTime = await time.latest();
    const {startTime: ethStartTime, endTime: ethEndTime} = createContestTimeParams(currentTime, 24, 1);

    const ethContestResult = await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: ethers.ZeroAddress,
        totalPrize: ethTotalPrize,
        template: 0,
        startTime: ethStartTime,
        endTime: ethEndTime,
        metadata: {
          title: "ETH Contest",
          description: "Contest with ETH prize"
        }
      }
    );

    expect(ethContestResult.contestId).to.be.gte(BigInt(0));

    // Контракт ContestFactory требует паузы минимум 1 час между созданиями
    // конкурсов одним и тем же адресом. Продвигаем время, чтобы избежать
    // отката с ошибкой "Wait between contests" при создании следующего
    // конкурса в рамках этого теста.
    await time.increase(3600 + 1);

    // Обновляем текущее время после увеличения, чтобы следующий конкурс
    // имел корректные параметры времени относительно нового блока.
    const timeAfterEth = await time.latest();

    // USDC конкурс
    console.log("💵 Создание конкурса с USDC");
    
    // Убеждаемся, что USDC настроен как стейблкоин
    try {
      const [owner] = await ethers.getSigners();

      // Сначала проверим текущее состояние
      const isValid = await tokenValidator.isValidToken(await mockUSDC.getAddress());
      const isStable = await tokenValidator.isStablecoin(await mockUSDC.getAddress());
      console.log(`USDC перед настройкой: isValid=${isValid}, isStable=${isStable}`);

      // Добавляем USDC в whitelist (гарантируем, что используем owner)
      if (!isValid) {
        await tokenValidator.connect(owner).setTokenWhitelist(await mockUSDC.getAddress(), true, "USDC for test");
        console.log("✅ USDC добавлен в whitelist");
      }

      if (!isStable) {
        console.log("Попробуем добавить USDC как стейблкоин через прямое добавление в whitelist с признаком стейблкоина");

        // Проверим информацию о токене
        const tokenInfo = await mockUSDC.name();
        const tokenSymbol = await mockUSDC.symbol();
        const tokenDecimals = await mockUSDC.decimals();
        console.log(`Информация о токене: ${tokenInfo} (${tokenSymbol}), decimals: ${tokenDecimals}`);

        // Этот подход должен сработать для любой имплементации TokenValidator
        try {
          // Добавляем токен в whitelist с признаком, что это стейблкоин
          await tokenValidator.connect(owner).setTokenWhitelist(await mockUSDC.getAddress(), true, 
              "USDC stablecoin for test");

          // Проверяем информацию о токене через TokenInfo (если доступно)
          try {
            const info = await tokenValidator.tokenInfoCache?.(await mockUSDC.getAddress());
            console.log(`Информация из кеша о токене: ${JSON.stringify(info || 'недоступно')}`);
          } catch (cacheErr) {
            console.log(`Не удалось получить информацию из кеша: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`);
          }

          console.log("✅ USDC добавлен в whitelist с указанием, что это стейблкоин");
        } catch (whitelistErr) {
          console.error(`⛔ Не удалось обновить whitelist для USDC: ${whitelistErr}`);
        }
      }

      // Проверяем еще раз после настройки
      const isValidAfter = await tokenValidator.isValidToken(await mockUSDC.getAddress());
      const isStableAfter = await tokenValidator.isStablecoin(await mockUSDC.getAddress());
      console.log(`USDC после настройки: isValid=${isValidAfter}, isStable=${isStableAfter}`);

    } catch (error) {
      console.log(`Предупреждение: не удалось настроить USDC: ${error}`);
    }

    // Проверяем баланс и разрешения перед созданием конкурса
    const usdcTotalPrize = ethers.parseUnits("50", await mockUSDC.decimals());
    const usdcFee = await networkFeeManager.calculateFee(31337, usdcTotalPrize);
    const usdcTotal = usdcTotalPrize + usdcFee;

    console.log(`USDC: приз=${usdcTotalPrize}, комиссия=${usdcFee}, всего=${usdcTotal}`);
    console.log(`Баланс USDC у создателя: ${await mockUSDC.balanceOf(creator.address)}`);
    console.log(`Разрешение USDC: ${await mockUSDC.allowance(creator.address, await contestFactory.getAddress())}`);

    // Обновляем разрешение для большей уверенности
    await mockUSDC.connect(creator).approve(await contestFactory.getAddress(), ethers.parseUnits("1000", await mockUSDC.decimals()));
    console.log(`Новое разрешение USDC: ${await mockUSDC.allowance(creator.address, await contestFactory.getAddress())}`);

    const {startTime: usdcStartTime, endTime: usdcEndTime} = createContestTimeParams(timeAfterEth, 72, 2);

    // Объявляем переменную вне блока try
    let usdcContestResult;

    try {
      console.log("Попытка создания конкурса с USDC...");

      // Проверяем фактический баланс и разрешения перед созданием
      console.log(`Баланс USDC перед созданием: ${await mockUSDC.balanceOf(creator.address)}`);
      console.log(`Разрешение USDC перед созданием: ${await mockUSDC.allowance(creator.address, await contestFactory.getAddress())}`);

      // Проверка существующих конкурсов
      try {
        const lastId = await contestFactory.lastId();
        console.log(`Текущее количество конкурсов (lastId): ${lastId}`);
      } catch (err) {
        console.log(`Не удалось получить lastId: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Увеличиваем лимит газа для более надежного создания конкурса
      const gasLimit = 12000000; // Увеличиваем еще больше
      console.log(`Используем увеличенный gasLimit: ${gasLimit}`);

      // Пробуем создать конкурс напрямую через контракт, обходя helper
      const usdcAddress = await mockUSDC.getAddress();

      // Обеспечиваем дополнительный approve
      await mockUSDC.connect(creator).approve(await contestFactory.getAddress(), usdcTotal * BigInt(2));
      console.log(`Обновленное разрешение USDC: ${await mockUSDC.allowance(creator.address, await contestFactory.getAddress())}`);

      // Создаем параметры для прямого вызова
      const contestParams = {
        token: mockUSDC,
        totalPrize: usdcTotalPrize,
        template: 0,
        customDistribution: [],
        jury: [creator.address],
        startTime: usdcStartTime,
        endTime: usdcEndTime,
        contestMetadata: JSON.stringify({
          title: "USDC Contest",
          description: "Contest with USDC prize"
        }),
        hasNonMonetaryPrizes: false
      };

      console.log("Прямой вызов createContest с настроенным USDC токеном...");

      try {
        // Пробуем напрямую вызвать метод с контрактом
        const tx = await contestFactory.connect(creator).createContest(contestParams, {
          gasLimit: gasLimit
        });

        console.log(`Транзакция отправлена: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Транзакция подтверждена: ${receipt?.hash || 'нет хеша'}`);

        // Определяем contestId по последнему значению lastId после выполнения
        // транзакции. lastId увеличивается постфиксно, поэтому он указывает на
        // следующий свободный идентификатор. ID только что созданного конкурса
        // равен lastId - 1.
        const lastIdAfter = await contestFactory.lastId();
        let contestId = lastIdAfter - BigInt(1);
        console.log(`Используем lastId-1 как contestId: ${contestId}`);

        // Теперь получаем эскроу контракт
        const escrowAddress = await contestFactory.escrows(Number(contestId));
        const escrow = await ethers.getContractAt("ContestEscrow", escrowAddress);

        usdcContestResult = {
          contestId,
          escrow,
          escrowAddress,
          transaction: tx,
          receipt
        };

      } catch (directError) {
        console.error(`❌ Ошибка при прямом вызове createContest: ${directError}`);
        console.error(`Детали ошибки: ${JSON.stringify(directError, (_, v) => 
          typeof v === 'bigint' ? v.toString() : v, 2)}`);

        // Возвращаемся к использованию helper
        console.log("Возвращаемся к использованию helper createTestContest...");
        usdcContestResult = await createTestContest(
          contestFactory,
          networkFeeManager,
          creator,
          {
            token: usdcAddress,
            totalPrize: usdcTotalPrize,
            template: 0,
            startTime: usdcStartTime,
            endTime: usdcEndTime,
            metadata: {
              title: "USDC Contest",
              description: "Contest with USDC prize"
            }
          }
        );
      }

      console.log(`✅ Конкурс с USDC создан успешно! ID: ${usdcContestResult.contestId}`);
    } catch (error) {
      console.error(`❌ Ошибка при создании конкурса с USDC: ${error}`);
      throw error; // Пробрасываем ошибку дальше для провала теста
    }

    expect(usdcContestResult.contestId).to.be.gte(BigInt(0));
    expect(usdcContestResult.contestId).to.be.gt(ethContestResult.contestId);

    console.log("✅ Тест с различными токенами успешно завершен");
  });

  it("Проверка валидации токенов через TokenValidator", async function() {
    console.log("🔍 Проверка валидности токена USDT");
    
    const isUsdtValid = await tokenValidator.isValidToken(await mockUSDT.getAddress());
    console.log(`USDT валиден: ${isUsdtValid}`);

    const usdtInfo = await tokenValidator.getTokenInfo(await mockUSDT.getAddress());
    console.log(`USDT информация: hasLiquidity=${usdtInfo.hasLiquidity}, isStablecoin=${usdtInfo.isStablecoin}`);

    const isUsdtStablecoin = await tokenValidator.isStablecoin(await mockUSDT.getAddress());
    expect(isUsdtStablecoin).to.be.true;

    // Создание конкурса для проверки валидации
    const totalPrize = ethers.parseUnits("100", await mockUSDT.decimals());
    const currentTime = await time.latest();
    const {startTime, endTime} = createContestTimeParams(currentTime, 24, 1);

    const contestResult = await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: await mockUSDT.getAddress(),
        totalPrize: totalPrize,
        template: 0,
        startTime: startTime,
        endTime: endTime,
        metadata: {
          title: "USDT Validation Test",
          description: "Testing token validation"
        }
      }
    );

    expect(contestResult.contestId).to.be.gte(BigInt(0));
    console.log("✅ Тест валидации токенов успешно завершен");
  });

  it("Проверка расчета комиссий для различных токенов", async function() {
    console.log("💼 Проверка комиссий");

    // ETH конкурс
    const ethTotalPrize = ethers.parseEther("10");
    const ethFee = await networkFeeManager.calculateFee(31337, ethTotalPrize);
    const currentTime = await time.latest();
    const {startTime: ethStartTime, endTime: ethEndTime} = createContestTimeParams(currentTime, 24, 1);

    await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: ethers.ZeroAddress,
        totalPrize: ethTotalPrize,
        template: 0,
        startTime: ethStartTime,
        endTime: ethEndTime,
        metadata: {
          title: "ETH Fee Test",
          description: "Testing fee calculation with ETH"
        }
      }
      );

      // Проверяем комиссию ETH
      const availableETHFees = await networkFeeManager.getAvailableETHFees();
      expect(availableETHFees).to.equal(ethFee);

      // Между созданием конкурсов должна пройти как минимум 1 час. Увеличиваем
      // время, чтобы следующая транзакция не была отклонена проверкой
      // `Wait between contests` в контракте ContestFactory.
      await time.increase(3600 + 1);

      // Обновляем время после паузы, чтобы следующий конкурс имел
      // корректные временные параметры.
      const afterEthFeeTime = await time.latest();

    // USDT конкурс
    const usdtTotalPrize = ethers.parseUnits("1000", await mockUSDT.decimals());
    const usdtFee = await networkFeeManager.calculateFee(31337, usdtTotalPrize);
    const {startTime: usdtStartTime, endTime: usdtEndTime} = createContestTimeParams(afterEthFeeTime, 24, 2);

    await createTestContest(
      contestFactory,
      networkFeeManager,
      creator,
      {
        token: await mockUSDT.getAddress(),
        totalPrize: usdtTotalPrize,
        template: 0,
        startTime: usdtStartTime,
        endTime: usdtEndTime,
        metadata: {
          title: "USDT Fee Test",
          description: "Testing fee calculation with USDT"
        }
      }
    );

    // Проверяем комиссию USDT
    const availableUSDTFees = await networkFeeManager.getAvailableTokenFees(await mockUSDT.getAddress());
    expect(availableUSDTFees).to.equal(usdtFee);

    console.log("✅ Тест расчета комиссий успешно завершен");
  });

});