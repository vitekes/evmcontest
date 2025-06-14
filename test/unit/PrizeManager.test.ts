import { expect } from "chai";
import { ethers } from "hardhat";
import { PrizeManager } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther, keccak256, toUtf8Bytes } from "ethers";

describe("PrizeManager", function() {
  // Объявление переменных
  let prizeManager: PrizeManager;
  let owner: SignerWithAddress;
  let authorizedCreator: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;
  let winner: SignerWithAddress;
  let contestId: number;

  // Константы для типов призов
  const PrizeType = {
    MONETARY: 0,
    PROMOCODE: 1,
    PRIVILEGE: 2,
    NFT: 3,
    EXTERNAL: 4
  };

  // Хеширование строки для secretHash
  const hashString = (str: string) => {
    return keccak256(toUtf8Bytes(str));
  };

  beforeEach(async function() {
    // Получаем аккаунты
    [owner, authorizedCreator, unauthorizedUser, winner] = await ethers.getSigners();

    // Деплоим PrizeManager
    const PrizeManagerFactory = await ethers.getContractFactory("PrizeManager");
    prizeManager = await PrizeManagerFactory.deploy();

    // Авторизуем создателя
    await prizeManager.setAuthorizedCreator(authorizedCreator.address, true);

    // Создаем тестовый конкурс
    contestId = 1;
    await prizeManager.connect(authorizedCreator).createContest(
      contestId,
      JSON.stringify({ name: "Test Contest", description: "A test contest" })
    );
  });

  describe("Admin Functions", function() {
    it("should set authorized creator", async function() {
      const newCreator = unauthorizedUser;
      await prizeManager.setAuthorizedCreator(newCreator.address, true);
      expect(await prizeManager.authorizedCreators(newCreator.address)).to.be.true;

      await prizeManager.setAuthorizedCreator(newCreator.address, false);
      expect(await prizeManager.authorizedCreators(newCreator.address)).to.be.false;
    });

    it("should prevent non-owners from setting authorized creators", async function() {
      await expect(
        prizeManager.connect(unauthorizedUser).setAuthorizedCreator(unauthorizedUser.address, true)
      ).to.be.reverted;
    });
  });

  describe("Contest Creation", function() {
    it("should create a contest with metadata", async function() {
      const newContestId = 2;
      const metadata = JSON.stringify({ name: "New Contest", description: "Another test contest" });

      await prizeManager.connect(authorizedCreator).createContest(newContestId, metadata);

      const contestData = await prizeManager.getContestPrizes(newContestId);
      expect(contestData.contestMetadata).to.equal(metadata);
      expect(await prizeManager.contestCreators(newContestId)).to.equal(authorizedCreator.address);
    });

    it("should prevent creating a contest with an existing ID", async function() {
      await expect(
        prizeManager.connect(authorizedCreator).createContest(contestId, "")
      ).to.be.revertedWithCustomError(prizeManager, "ContestAlreadyExists");
    });

    it("should prevent unauthorized users from creating contests", async function() {
      await expect(
        prizeManager.connect(unauthorizedUser).createContest(2, "")
      ).to.be.revertedWithCustomError(prizeManager, "NotAuthorized");
    });
  });

  describe("Prize Creation", function() {
    it("should add MONETARY prizes", async function() {
      const value = parseEther("1");
      const metadata = "Cash prize";

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.MONETARY,
        value,
        metadata,
        ethers.ZeroHash,
        0 // Без срока действия
      );

      const prizeData = await prizeManager.getPrize(contestId, 0);
      expect(prizeData.prizeType).to.equal(PrizeType.MONETARY);
      expect(prizeData.monetaryValue).to.equal(value);
      expect(prizeData.metadata).to.equal(metadata);

      // Проверяем общую стоимость денежных призов
      const contestData = await prizeManager.getContestPrizes(contestId);
      expect(contestData.totalMonetaryValue).to.equal(value);
    });

    it("should add PROMOCODE prizes", async function() {
      const metadata = JSON.stringify({ service: "Netflix", duration: "1 month" });
      const secretHash = hashString("SECRET_CODE_123");
      const expiration = Math.floor(Date.now() / 1000) + 86400; // Срок действия - 1 день

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.PROMOCODE,
        0, // Нулевая денежная стоимость
        metadata,
        secretHash,
        expiration
      );

      const prizeData = await prizeManager.getPrize(contestId, 0);
      expect(prizeData.prizeType).to.equal(PrizeType.PROMOCODE);
      expect(prizeData.metadata).to.equal(metadata);
      expect(prizeData.secretHash).to.equal(secretHash);
      expect(prizeData.expirationDate).to.equal(expiration);

      // Проверяем флаг неденежных призов
      const contestData = await prizeManager.getContestPrizes(contestId);
      expect(contestData.hasNonMonetaryPrizes).to.be.true;
    });

    it("should add PRIVILEGE prizes", async function() {
      const metadata = JSON.stringify({ privilege: "VIP access", duration: "3 months" });

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.PRIVILEGE,
        0,
        metadata,
        ethers.ZeroHash,
        0
      );

      const prizeData = await prizeManager.getPrize(contestId, 0);
      expect(prizeData.prizeType).to.equal(PrizeType.PRIVILEGE);
      expect(prizeData.metadata).to.equal(metadata);
    });

    it("should add NFT prizes", async function() {
      const metadata = JSON.stringify({ 
        contract: "0x1234567890123456789012345678901234567890", 
        tokenId: 123 
      });

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.NFT,
        0,
        metadata,
        ethers.ZeroHash,
        0
      );

      const prizeData = await prizeManager.getPrize(contestId, 0);
      expect(prizeData.prizeType).to.equal(PrizeType.NFT);
      expect(prizeData.metadata).to.equal(metadata);
    });

    it("should add EXTERNAL prizes", async function() {
      const metadata = JSON.stringify({ 
        type: "Physical item", 
        description: "Gaming laptop",
        shipping: "Worldwide" 
      });

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.EXTERNAL,
        parseEther("2"), // Указываем примерную стоимость
        metadata,
        ethers.ZeroHash,
        0
      );

      const prizeData = await prizeManager.getPrize(contestId, 0);
      expect(prizeData.prizeType).to.equal(PrizeType.EXTERNAL);
      expect(prizeData.monetaryValue).to.equal(parseEther("2"));
      expect(prizeData.metadata).to.equal(metadata);
    });

    it("should handle prize expiration", async function() {
      // Создаем приз с истекшим сроком действия
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // Час назад
      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.PROMOCODE,
        0,
        "Expired prize",
        ethers.ZeroHash,
        expiredTime
      );

      // Попытка выдать истекший приз должна быть отклонена
      await expect(
        prizeManager.connect(owner).claimPrize(contestId, 0, winner.address)
      ).to.be.revertedWithCustomError(prizeManager, "PrizeExpired");
    });

    it("should prevent non-contest creators from adding prizes", async function() {
      await expect(
        prizeManager.connect(unauthorizedUser).addPrize(
          contestId,
          PrizeType.MONETARY,
          parseEther("1"),
          "Unauthorized prize",
          ethers.ZeroHash,
          0
        )
      ).to.be.revertedWithCustomError(prizeManager, "NotContestCreator");
    });
  });

  describe("Prize Claims", function() {
    beforeEach(async function() {
      // Добавляем несколько призов для тестирования
      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.MONETARY,
        parseEther("1"),
        "Money prize",
        ethers.ZeroHash,
        0
      );

      const secretCode = "SECRET123";
      const secretHash = hashString(secretCode);

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.PROMOCODE,
        0,
        "Code prize",
        secretHash,
        Math.floor(Date.now() / 1000) + 86400
      );
    });

    it("should assign prizes to winners", async function() {
      await prizeManager.connect(owner).claimPrize(contestId, 0, winner.address);

      const prize = await prizeManager.getPrize(contestId, 0);
      expect(prize.claimed).to.be.true;
    });

    it("should prevent unauthorized claims", async function() {
      await expect(
        prizeManager.connect(unauthorizedUser).claimPrize(contestId, 0, winner.address)
      ).to.be.revertedWithCustomError(prizeManager, "NotAuthorized");
    });

    it("should prevent claiming the same prize twice", async function() {
      await prizeManager.connect(owner).claimPrize(contestId, 0, winner.address);

      await expect(
        prizeManager.connect(owner).claimPrize(contestId, 0, winner.address)
      ).to.be.revertedWithCustomError(prizeManager, "PrizeAlreadyClaimed");
    });

    it("should handle secret reveals", async function() {
      // Сначала выдаем приз
      await prizeManager.connect(owner).claimPrize(contestId, 1, winner.address);

      // Затем раскрываем секрет (промокод)
      const secretCode = "SECRET123";
      await expect(
        prizeManager.connect(winner).revealSecret(contestId, 1, secretCode)
      ).to.emit(prizeManager, "SecretRevealed")
        .withArgs(contestId, 1, winner.address, secretCode);
    });

    it("should validate secret hashes", async function() {
      await prizeManager.connect(owner).claimPrize(contestId, 1, winner.address);

      // Попытка раскрыть с неверным секретом
      await expect(
        prizeManager.connect(winner).revealSecret(contestId, 1, "WRONG_SECRET")
      ).to.be.revertedWithCustomError(prizeManager, "InvalidSecret");
    });

    it("should prevent revealing secrets for unclaimed prizes", async function() {
      await expect(
        prizeManager.connect(winner).revealSecret(contestId, 1, "SECRET123")
      ).to.be.revertedWithCustomError(prizeManager, "PrizeNotClaimed");
    });
  });

  describe("Backend Integration", function() {
    it("should handle promocode creation confirmation", async function() {
      // Добавляем промокод-приз
      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.PROMOCODE,
        0,
        "Netflix subscription",
        ethers.ZeroHash, // Изначально нет хеша
        Math.floor(Date.now() / 1000) + 86400
      );

      // Выдаем приз
      await prizeManager.connect(owner).claimPrize(contestId, 0, winner.address);

      // Генерируем ID запроса (как это делает контракт)
      const requestId = keccak256(
        ethers.solidityPacked(
          ["uint256", "uint256", "address", "uint256"],
          [contestId, 0, winner.address, Math.floor(Date.now() / 1000)]
        )
      );

      // Бэкенд подтверждает создание промокода
      const promocode = "NETFLIX123";
      await prizeManager.connect(owner).confirmPromocodeCreated(
        requestId,
        contestId,
        0,
        promocode
      );

      // Проверяем, что хеш промокода установлен
      const prize = await prizeManager.getPrize(contestId, 0);
      expect(prize.secretHash).to.equal(hashString(promocode));

      // Получатель может раскрыть секрет
      await expect(
        prizeManager.connect(winner).revealSecret(contestId, 0, promocode)
      ).to.emit(prizeManager, "SecretRevealed")
        .withArgs(contestId, 0, winner.address, promocode);
    });

    it("should prevent processing the same request twice", async function() {
      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.PROMOCODE,
        0,
        "Netflix subscription",
        ethers.ZeroHash,
        Math.floor(Date.now() / 1000) + 86400
      );

      await prizeManager.connect(owner).claimPrize(contestId, 0, winner.address);

      const requestId = keccak256(
        ethers.solidityPacked(
          ["uint256", "uint256", "address", "uint256"],
          [contestId, 0, winner.address, Math.floor(Date.now() / 1000)]
        )
      );

      await prizeManager.connect(owner).confirmPromocodeCreated(
        requestId,
        contestId,
        0,
        "NETFLIX123"
      );

      await expect(
        prizeManager.connect(owner).confirmPromocodeCreated(
          requestId,
          contestId,
          0,
          "ANOTHER_CODE"
        )
      ).to.be.revertedWithCustomError(prizeManager, "AlreadyProcessed");
    });
  });

  describe("View Functions", function() {
    beforeEach(async function() {
      // Добавляем несколько призов
      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.MONETARY,
        parseEther("1"),
        "Prize 1",
        ethers.ZeroHash,
        0
      );

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.MONETARY,
        parseEther("2"),
        "Prize 2",
        ethers.ZeroHash,
        0
      );

      await prizeManager.connect(authorizedCreator).addPrize(
        contestId,
        PrizeType.PROMOCODE,
        0,
        "Prize 3",
        ethers.ZeroHash,
        0
      );
    });

    it("should get contest prizes", async function() {
      const contestData = await prizeManager.getContestPrizes(contestId);
      expect(contestData.prizes.length).to.equal(3);
      expect(contestData.totalMonetaryValue).to.equal(parseEther("3"));
      expect(contestData.hasNonMonetaryPrizes).to.be.true;
    });

    it("should get prize by index", async function() {
      const prize = await prizeManager.getPrize(contestId, 1);
      expect(prize.prizeType).to.equal(PrizeType.MONETARY);
      expect(prize.monetaryValue).to.equal(parseEther("2"));
      expect(prize.metadata).to.equal("Prize 2");
    });

    it("should get prizes count", async function() {
      const count = await prizeManager.getPrizesCount(contestId);
      expect(count).to.equal(3);
    });

    it("should page prizes correctly", async function() {
      const page = await prizeManager.getPrizesPaged(contestId, 1, 2);
      expect(page.length).to.equal(2);
      expect(page[0].metadata).to.equal("Prize 2");
      expect(page[1].metadata).to.equal("Prize 3");
    });

    it("should get monetary prizes total", async function() {
      const total = await prizeManager.getMonetaryPrizesTotal(contestId);
      expect(total).to.equal(parseEther("3"));
    });

    it("should revert on invalid prize index", async function() {
      await expect(
        prizeManager.getPrize(contestId, 99)
      ).to.be.revertedWithCustomError(prizeManager, "InvalidPrizeIndex");
    });
  });
});