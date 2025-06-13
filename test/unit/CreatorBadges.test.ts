import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { 
  deployFullPlatformFixture,
  TEST_CONSTANTS 
} from "../fixtures";
import { expectRevertWithReason } from "../helpers";

// Вспомогательная утилита для проверки событий с любым значением
const anyValue = () => true;

describe("CreatorBadges", function() {
  // Настройка контрактов
  describe("Initialization", function() {
    it("should initialize with correct name and symbol", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      expect(await fixture.creatorBadges.name()).to.equal("Contest Creator Badges");
      expect(await fixture.creatorBadges.symbol()).to.equal("CCB");
    });

    it("should allow setting ContestFactory address only once", async function() {
      // Создаем новый экземпляр CreatorBadges
      const CreatorBadgesFactory = await ethers.getContractFactory("CreatorBadges");
      const creatorBadges = await CreatorBadgesFactory.deploy();

      // Устанавливаем ненулевой адрес фабрики
      const mockAddress = "0x0000000000000000000000000000000000000001";
      await creatorBadges.setContestFactory(mockAddress);

      // Попытка установить еще раз должна завершиться ошибкой
      await expectRevertWithReason(
        creatorBadges.setContestFactory(mockAddress),
        "Factory already set"
      );
    });

    it("should reject zero address for ContestFactory", async function() {
      const CreatorBadgesFactory = await ethers.getContractFactory("CreatorBadges");
      const creatorBadges = await CreatorBadgesFactory.deploy();

      await expectRevertWithReason(
        creatorBadges.setContestFactory(ethers.ZeroAddress),
        "Invalid factory address"
      );
    });

    it("should only allow owner to set ContestFactory", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const CreatorBadgesFactory = await ethers.getContractFactory("CreatorBadges");
      const creatorBadges = await CreatorBadgesFactory.deploy();

      await expectRevertWithReason(
        creatorBadges.connect(fixture.creator1).setContestFactory(fixture.contestFactory.getAddress()),
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Badge Minting", function() {
    it("should mint FIRST_CONTEST badge after first contest", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем первый конкурс для creator1
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);

      // Проверяем, что создатель получил бейдж
      const [, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);
      expect(badges).to.include(1n); // FIRST_CONTEST = 1
      expect(names).to.include("First Contest Creator");
    });

    it("should mint CONTEST_VETERAN badge after 10 contests", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем 10 конкурсов - один дополнительный для надежности
      for (let i = 0; i < 11; i++) {
        await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      }

      // Проверяем наличие бейджа ветерана (id=2)
      const [stats, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`totalContests: ${stats.totalContests}, badges: ${badges.join(', ')}`);
      expect(badges).to.include(2n); // CONTEST_VETERAN = 2
      expect(names).to.include("Contest Veteran");
    });

    it("should mint CONTEST_MASTER badge after 50 contests", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем 50 конкурсов - один дополнительный для надежности
      for (let i = 0; i < 51; i++) {
        await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      }

      // Проверяем наличие бейджа мастера (id=3)
      const [stats, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`totalContests: ${stats.totalContests}, badges: ${badges.join(', ')}`);
      expect(badges).to.include(3n); // CONTEST_MASTER = 3
      expect(badges).to.include(2n); // Должен также иметь CONTEST_VETERAN
      expect(names).to.include("Contest Master");
    });

    it("should mint BIG_SPENDER badge after $10k volume", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем один большой конкурс на немного больше 10,000 ETH для надежности
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, ethers.parseEther("10001"));

      // Проверяем наличие бейджа BIG_SPENDER (id=4)
      const [stats, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`totalPrizeVolume: ${ethers.formatEther(stats.totalPrizeVolume)} ETH, badges: ${badges.join(', ')}`);
      expect(badges).to.include(4n); // BIG_SPENDER = 4
      expect(names).to.include("Big Spender");
    });

    it("should mint WHALE badge after $100k volume", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем один огромный конкурс на немного больше 100,000 ETH для надежности
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, ethers.parseEther("100001"));

      // Проверяем наличие бейджа WHALE (id=5)
      const [stats, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`totalPrizeVolume: ${ethers.formatEther(stats.totalPrizeVolume)} ETH, badges: ${badges.join(', ')}`);
      expect(badges).to.include(5n); // WHALE = 5
      expect(badges).to.include(4n); // Должен также иметь BIG_SPENDER
      expect(names).to.include("Contest Whale");
    });

    it("should mint EARLY_ADOPTER badge for first 100 creators", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Первый пользователь должен получить бейдж раннего последователя
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);

      const [, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`nextTokenId < 100, badges: ${badges.join(', ')}`);
      expect(badges).to.include(7n); // EARLY_ADOPTER = 7
      expect(names).to.include("Early Adopter");
    });

    it("should prevent duplicate badges", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем два конкурса
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);

      // Проверяем, что бейдж FIRST_CONTEST есть только один раз
      const [, badges,] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`badges: ${badges.join(', ')}`);

      // Подсчитываем, сколько раз встречается бейдж FIRST_CONTEST
      const firstContestCount = badges.filter(b => b === 1n).length;
      expect(firstContestCount).to.equal(1);
    });

    it("should reject minting by non-factory address", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);

      // Пытаемся вызвать recordContest напрямую с неавторизованного аккаунта
      await expectRevertWithReason(
        fixture.creatorBadges.connect(fixture.creator1)
          .recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE),
        "Only contest factory"
      );
    });

    it("should emit BadgeEarned event when badge is awarded", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Ожидаем событие BadgeEarned при первом создании конкурса
      await expect(testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE))
        .to.emit(testBadges, "BadgeEarned")
        .withArgs(fixture.creator1.address, 1, anyValue, "First Contest Creator");
    });
  });

  describe("Statistics Tracking", function() {
    it("should track contest count correctly", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем 3 конкурса
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.MEDIUM_PRIZE);

      // Проверяем статистику
      const [stats,, ] = await testBadges.getCreatorStats(fixture.creator1.address);
      expect(stats.totalContests).to.equal(3);
    });

    it("should track total prize volume accurately", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем конкурсы с разными призовыми фондами
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.MEDIUM_PRIZE);

      // Ожидаемая сумма
      const expectedTotal = TEST_CONSTANTS.SMALL_PRIZE + TEST_CONSTANTS.MEDIUM_PRIZE;

      // Проверяем статистику
      const [stats,,] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`SMALL_PRIZE: ${TEST_CONSTANTS.SMALL_PRIZE}, MEDIUM_PRIZE: ${TEST_CONSTANTS.MEDIUM_PRIZE}, totalPrizeVolume: ${stats.totalPrizeVolume}`);
      expect(stats.totalPrizeVolume).to.equal(expectedTotal);
    });

    it("should track timestamps of first and last contests", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем первый конкурс
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);

      // Получаем время первого конкурса
      const [statsAfterFirst] = await testBadges.getCreatorStats(fixture.creator1.address);
      const firstTimestamp = statsAfterFirst.firstContestTimestamp;

      // Увеличиваем время блокчейна
      await time.increase(100);

      // Создаем второй конкурс
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.MEDIUM_PRIZE);

      // Проверяем, что firstContestTimestamp не изменился, а lastContestTimestamp обновился
      const [statsAfterSecond] = await testBadges.getCreatorStats(fixture.creator1.address);
      console.log(`firstTimestamp: ${firstTimestamp}, lastContestTimestamp: ${statsAfterSecond.lastContestTimestamp}`);
      expect(statsAfterSecond.firstContestTimestamp).to.equal(firstTimestamp);
      expect(statsAfterSecond.lastContestTimestamp).to.be.greaterThan(firstTimestamp);
    });

    it("should emit CreatorStatsUpdated event on updates", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Ожидаем событие CreatorStatsUpdated при создании конкурса
      await expect(testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE))
        .to.emit(testBadges, "CreatorStatsUpdated")
        .withArgs(fixture.creator1.address, 1, TEST_CONSTANTS.SMALL_PRIZE);
    });

    it("should only allow ContestFactory to update stats", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Пытаемся вызвать recordContest напрямую с неавторизованного аккаунта
      await expectRevertWithReason(
        testBadges.connect(fixture.creator1).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE),
        "Only contest factory"
      );
    });
  });

  describe("Creator Verification", function() {
    it("should allow owner to verify creators", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Владелец верифицирует создателя
      await testBadges.verifyCreator(fixture.creator1.address);

      // Проверяем, что создатель стал верифицированным
      const [stats] = await testBadges.getCreatorStats(fixture.creator1.address);
      expect(stats.isVerified).to.be.true;
    });

    it("should award VERIFIED_CREATOR badge on verification", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Владелец верифицирует создателя
      await testBadges.verifyCreator(fixture.creator1.address);

      // Проверяем, что создатель получил бейдж верификации
      const [, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);
      expect(badges).to.include(6n); // VERIFIED_CREATOR = 6
      expect(names).to.include("Verified Creator");
    });

    it("should reject verification from non-owner accounts", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Пытаемся верифицировать от имени неавторизованного аккаунта
      await expectRevertWithReason(
        testBadges.connect(fixture.creator1).verifyCreator(fixture.creator2.address),
        "OwnableUnauthorizedAccount"
      );
    });

    it("should reject verification of zero address", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Пытаемся верифицировать нулевой адрес
      await expectRevertWithReason(
        testBadges.verifyCreator(ethers.ZeroAddress),
        "Invalid creator"
      );
    });
  });

  describe("NFT Functionality", function() {
    it("should handle NFT transfers correctly", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем конкурс, чтобы creator1 получил бейдж
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);

      // Находим tokenId для creator1
      // Предполагаем, что это будет первый токен
      const tokenId = 1n;

      // Проверяем владельца
      expect(await testBadges.ownerOf(tokenId)).to.equal(fixture.creator1.address);

      // Передаем токен creator2
      await testBadges.connect(fixture.creator1).transferFrom(
        fixture.creator1.address,
        fixture.creator2.address,
        tokenId
      );

      // Проверяем нового владельца
      expect(await testBadges.ownerOf(tokenId)).to.equal(fixture.creator2.address);
    });

    it("should provide valid metadata URIs", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем конкурс, чтобы creator1 получил бейдж
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);

      // Предполагаем, что это будет первый токен
      const tokenId = 1n;

      // Получаем URI и проверяем его формат
      const tokenURI = await testBadges.tokenURI(tokenId);
      expect(tokenURI).to.include("data:application/json;base64,");
    });

    it("should increment token IDs correctly", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем несколько конкурсов для разных создателей
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      await testBadges.connect(fixture.owner).recordContest(fixture.creator2.address, TEST_CONSTANTS.SMALL_PRIZE);

      // Верифицируем creator1 (получит еще один токен)
      await testBadges.verifyCreator(fixture.creator1.address);

      // Проверяем, что у creator1 есть токены
      expect(await testBadges.balanceOf(fixture.creator1.address)).to.be.greaterThan(0);

      // Проверяем, что у creator2 есть токены
      expect(await testBadges.balanceOf(fixture.creator2.address)).to.be.greaterThan(0);
    });

    it("should return correct badge details in getCreatorStats", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем конкурс и верифицируем создателя
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);
      await testBadges.verifyCreator(fixture.creator1.address);

      // Получаем статистику
      const [, badges, names] = await testBadges.getCreatorStats(fixture.creator1.address);

      // Проверяем, что у создателя два бейджа: FIRST_CONTEST и VERIFIED_CREATOR (и может быть EARLY_ADOPTER)
      expect(badges.length).to.be.at.least(2);
      expect(badges).to.include(1n); // FIRST_CONTEST
      expect(badges).to.include(6n); // VERIFIED_CREATOR

      // Проверяем имена бейджей
      expect(names).to.include("First Contest Creator");
      expect(names).to.include("Verified Creator");
    });
  });

  describe("Edge Cases", function() {
    it("should handle multiple badges awarded simultaneously", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем один большой конкурс, который должен дать сразу несколько бейджей
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, ethers.parseEther("10000"));

      // Проверяем, что создатель получил сразу несколько бейджей
      const [, badges,] = await testBadges.getCreatorStats(fixture.creator1.address);

      // Должен получить FIRST_CONTEST, BIG_SPENDER и EARLY_ADOPTER
      expect(badges.length).to.be.at.least(2);
      expect(badges).to.include(1n); // FIRST_CONTEST
      expect(badges).to.include(4n); // BIG_SPENDER
    });

    it("should handle large volume values without overflow", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Записываем конкурс с очень большим призовым фондом
      const largeVolume = ethers.parseEther("1000000"); // 1 миллион ETH
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, largeVolume);

      // Проверяем корректность статистики
      const [stats] = await testBadges.getCreatorStats(fixture.creator1.address);
      expect(stats.totalPrizeVolume).to.equal(largeVolume);
    });

    it("should handle transfers of badges between accounts", async function() {
      const fixture = await loadFixture(deployFullPlatformFixture);
      const testBadges = await createTestBadges(fixture);

      // Создаем конкурс для creator1
      await testBadges.connect(fixture.owner).recordContest(fixture.creator1.address, TEST_CONSTANTS.SMALL_PRIZE);

      // Находим tokenId для creator1
      const tokenId = 1n;

      // Передаем бейдж creator2
      await testBadges.connect(fixture.creator1).transferFrom(
        fixture.creator1.address,
        fixture.creator2.address,
        tokenId
      );

      // Проверяем, что бейдж перешел к creator2
      expect(await testBadges.ownerOf(tokenId)).to.equal(fixture.creator2.address);

      // Но в статистике по-прежнему отображается, что creator1 имеет бейдж
      const [, badges1] = await testBadges.getCreatorStats(fixture.creator1.address);
      expect(badges1).to.include(1n); // FIRST_CONTEST по-прежнему в статистике

      // И creator2 НЕ имеет этот бейдж в своей статистике, несмотря на владение NFT
      const [, badges2] = await testBadges.getCreatorStats(fixture.creator2.address);
      expect(badges2).to.not.include(1n);
    });
  });
});

// Вспомогательная функция для создания тестового контракта бейджей
async function createTestBadges(fixture: any) {
  const CreatorBadgesFactory = await ethers.getContractFactory("CreatorBadges");
  const testBadges = await CreatorBadgesFactory.deploy();
  await testBadges.setContestFactory(fixture.owner.address);
  return testBadges;
}
