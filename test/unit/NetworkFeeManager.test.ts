import { expect } from "chai";
import { ethers } from "hardhat";
import { NetworkFeeManager } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther, ZeroAddress } from "ethers";
import { ContractTransaction } from "ethers";

describe("NetworkFeeManager", function() {
  // Объявление переменных
  let feeManager: NetworkFeeManager;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let factory: SignerWithAddress;
  let creator: SignerWithAddress;
  let anotherCreator: SignerWithAddress;
  let user: SignerWithAddress;
  let mockERC20: any; // Используем any для упрощения

  beforeEach(async function() {
    // Получаем аккаунты
    [owner, treasury, factory, creator, anotherCreator, user] = await ethers.getSigners();

    // Деплоим NetworkFeeManager
    const NetworkFeeManagerFactory = await ethers.getContractFactory("NetworkFeeManager");
    feeManager = await NetworkFeeManagerFactory.deploy(treasury.address);

    // Устанавливаем фабрику контестов
    await feeManager.setContestFactory(factory.address);

    // Деплоим мок ERC20 токена для тестов
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20Factory.deploy("Mock Token", "MOCK", 18, parseEther("1000"));
    await mockERC20.transfer(creator.address, parseEther("1000"));
    await mockERC20.connect(creator).approve(feeManager.target, parseEther("1000"));
  });

  describe("Fee Calculation", function() {
    it("should calculate fees based on network", async function() {
      // Проверяем комиссии для разных сетей
      const ethereumFee = await feeManager.calculateFee(1, parseEther("1"));
      const polygonFee = await feeManager.calculateFee(137, parseEther("1"));
      const arbitrumFee = await feeManager.calculateFee(42161, parseEther("1"));
      const sepoliaFee = await feeManager.calculateFee(11155111, parseEther("1"));

      // Проверяем значения (3%, 2.5%, 2%, 1%)
      expect(ethereumFee).to.equal(parseEther("0.03"));
      expect(polygonFee).to.equal(parseEther("0.025"));
      expect(arbitrumFee).to.equal(parseEther("0.02"));
      expect(sepoliaFee).to.equal(parseEther("0.01"));
    });

    it("should handle different prize amounts", async function() {
      // Ethereum fee (3%)
      expect(await feeManager.calculateFee(1, parseEther("10"))).to.equal(parseEther("0.3"));
      expect(await feeManager.calculateFee(1, parseEther("100"))).to.equal(parseEther("3"));
      expect(await feeManager.calculateFee(1, parseEther("0.1"))).to.equal(parseEther("0.003"));
      expect(await feeManager.calculateFee(1, 0)).to.equal(0);
    });

    it("should apply fee caps", async function() {
      // Пытаемся установить комиссию выше 20%
      await expect(feeManager.setNetworkFee(999, 2001))
        .to.be.revertedWith("Fee too high");

      // Устанавливаем максимальную разрешенную комиссию (20%)
      await feeManager.setNetworkFee(999, 2000);
      expect(await feeManager.calculateFee(999, parseEther("1"))).to.equal(parseEther("0.2"));
    });

    it("should handle zero fees for unsupported networks", async function() {
      // Проверяем комиссию для неподдерживаемой сети
      const unsupportedNetworkFee = await feeManager.calculateFee(999999, parseEther("1"));
      expect(unsupportedNetworkFee).to.equal(0);
    });
  });

  describe("Fee Collection", function() {
    beforeEach(async function() {
      // Настраиваем комиссию для текущей сети (Hardhat Network по умолчанию имеет chainId 31337)
      const chainId = (await ethers.provider.getNetwork()).chainId;
      await feeManager.setNetworkFee(chainId, 300); // 3%
    });

    it("should collect ETH fees to treasury", async function() {
      // Собираем комиссию (используем настроенный процент 3%)
      const prizeAmount = parseEther("10");
      const feeAmount = parseEther("0.3"); // 3% от 10 ETH
      const contestId = 1;

      // Проверяем event при сборе комиссии
      await expect(feeManager.connect(factory).collectFee(
        contestId,
        creator.address,
        ZeroAddress, // ETH
        prizeAmount,
        { value: feeAmount }
      )).to.emit(feeManager, "FeeCollected")
        .withArgs(contestId, creator.address, ZeroAddress, feeAmount);

      // Проверяем доступные комиссии
      expect(await feeManager.getAvailableETHFees()).to.equal(feeAmount);

      // Выводим комиссию в treasury
      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      await feeManager.connect(owner).withdrawFees(ZeroAddress, feeAmount);
      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);

      // Проверяем, что treasury получил комиссию
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(feeAmount);
    });

    it("should handle ERC20 fee collection", async function() {
      // Комиссия уже настроена в beforeEach

      const prizeAmount = parseEther("10");
      const feeAmount = parseEther("0.3"); // 3% от 10 токенов
      const contestId = 2;

      // Переводим токены на контракт feeManager
      await mockERC20.connect(creator).transfer(feeManager.target, feeAmount);

      // Собираем комиссию в токенах
      await expect(feeManager.connect(factory).collectFee(
        contestId,
        creator.address,
        mockERC20.target,
        prizeAmount
      )).to.emit(feeManager, "FeeCollected")
        .withArgs(contestId, creator.address, mockERC20.target, feeAmount);

      // Проверяем доступные комиссии в токенах
      expect(await feeManager.getAvailableTokenFees(mockERC20.target)).to.equal(feeAmount);

      // Выводим комиссию в токенах в treasury
      const treasuryTokenBalanceBefore = await mockERC20.balanceOf(treasury.address);
      await feeManager.connect(owner).withdrawFees(mockERC20.target, feeAmount);
      const treasuryTokenBalanceAfter = await mockERC20.balanceOf(treasury.address);

      // Проверяем, что treasury получил токены
      expect(treasuryTokenBalanceAfter - treasuryTokenBalanceBefore).to.equal(feeAmount);
    });

    it("should handle excess ETH refund", async function() {
      const prizeAmount = parseEther("10");
      const feeAmount = parseEther("0.3"); // 3% от 10 ETH
      const excessAmount = parseEther("0.1");
      const contestId = 3;

      const factoryBalanceBefore = await ethers.provider.getBalance(factory.address);

      // Отправляем избыточную сумму комиссии
      const tx = await feeManager.connect(factory).collectFee(
        contestId,
        creator.address,
        ZeroAddress,
        prizeAmount,
        { value: feeAmount + excessAmount }
      );

      // Получаем расход газа
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const factoryBalanceAfter = await ethers.provider.getBalance(factory.address);

      // Проверяем, что фабрика получила возврат излишка минус расходы на газ
      const expectedBalance = factoryBalanceBefore - feeAmount - gasCost;
      expect(factoryBalanceAfter).to.be.closeTo(expectedBalance, parseEther("0.001"));
    });
  });

  describe("Network Settings", function() {
    it("should detect correct network", async function() {
      // Получаем информацию о сети Ethereum
      const [feePercentage, networkName, isSupported] = await feeManager.getNetworkInfo(1);

      expect(feePercentage).to.equal(300); // 3%
      expect(networkName).to.equal("Ethereum Mainnet");
      expect(isSupported).to.be.true;
    });

    it("should handle unsupported networks", async function() {
      // Проверяем неподдерживаемую сеть
      const [feePercentage, networkName, isSupported] = await feeManager.getNetworkInfo(999999);

      expect(feePercentage).to.equal(0); // 0%
      expect(networkName).to.equal("");
      expect(isSupported).to.be.false;
    });

    it("should allow fee updates by owner", async function() {
      // Устанавливаем новую комиссию для тестовой сети
      const testChainId = 999;
      const newFee = 150; // 1.5%

      await expect(feeManager.setNetworkFee(testChainId, newFee))
        .to.emit(feeManager, "NetworkFeeUpdated")
        .withArgs(testChainId, 0, newFee);

      // Проверяем обновленную комиссию
      const [feePercentage] = await feeManager.getNetworkInfo(testChainId);
      expect(feePercentage).to.equal(newFee);

      // Меняем существующую комиссию
      const updatedFee = 200; // 2%
      await feeManager.setNetworkFee(testChainId, updatedFee);

      const [updatedFeePercentage] = await feeManager.getNetworkInfo(testChainId);
      expect(updatedFeePercentage).to.equal(updatedFee);
    });

    it("should prevent non-owners from updating fees", async function() {
      await expect(
        feeManager.connect(user).setNetworkFee(1, 100)
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("Ban System", function() {
    it("should allow banning creators", async function() {
      await expect(feeManager.connect(owner).banCreator(creator.address, "Violation"))
        .to.emit(feeManager, "CreatorBanned")
        .withArgs(creator.address, "Violation");

      expect(await feeManager.isCreatorBanned(creator.address)).to.be.true;
    });

    it("should allow unbanning creators", async function() {
      // Сначала баним
      await feeManager.connect(owner).banCreator(creator.address, "Violation");
      expect(await feeManager.isCreatorBanned(creator.address)).to.be.true;

      // Затем разбаниваем
      await expect(feeManager.connect(owner).unbanCreator(creator.address))
        .to.emit(feeManager, "CreatorUnbanned")
        .withArgs(creator.address);

      expect(await feeManager.isCreatorBanned(creator.address)).to.be.false;
    });
  });
});