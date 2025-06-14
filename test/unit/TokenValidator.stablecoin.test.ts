import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TokenValidator, MockERC20 } from "../../typechain-types";

describe("TokenValidator - Тесты для стейблкоинов", function () {
  let tokenValidator: TokenValidator;
  let usdc: MockERC20;
  let dai: MockERC20;
  let randomToken: MockERC20;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let wethAddress: string;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Деплоим WETH
    const mockWETH = await ethers.getContractFactory("MockERC20");
    const weth = await mockWETH.deploy("Wrapped Ether", "WETH", 18, 0);
    wethAddress = await weth.getAddress();

    // Деплоим стейблкоины
    usdc = await ethers.getContractFactory("MockERC20")
      .then(factory => factory.deploy("USD Coin", "USDC", 6, 0));

    dai = await ethers.getContractFactory("MockERC20")
      .then(factory => factory.deploy("Dai Stablecoin", "DAI", 18, 0));

    // Деплоим обычный токен
    randomToken = await ethers.getContractFactory("MockERC20")
      .then(factory => factory.deploy("Random Token", "RND", 18, 0));

    // Деплоим валидатор
    const initialStablecoins = [await usdc.getAddress()];
    tokenValidator = await ethers.getContractFactory("TokenValidator")
      .then(factory => factory.deploy(wethAddress, initialStablecoins));
  });

  describe("Базовые проверки стейблкоинов", function () {
    it("Должен правильно определять стейблкоины из начального списка", async function () {
      expect(await tokenValidator.isStablecoin(await usdc.getAddress())).to.equal(true);
    });

    it("Токены вне списка не считаются стейблкоинами по умолчанию", async function () {
      // DAI не был добавлен в initialStablecoins
      expect(await tokenValidator.isStablecoin(await dai.getAddress())).to.equal(false);
    });

    it("Должен правильно определять не-стейблкоины", async function () {
      expect(await tokenValidator.isStablecoin(await randomToken.getAddress())).to.equal(false);
    });

    it("Нативный токен не должен быть стейблкоином", async function () {
      expect(await tokenValidator.isStablecoin(ethers.ZeroAddress)).to.equal(false);
    });
  });

  describe("Управление стейблкоинами", function () {
    it("Владелец может добавить токен в список стейблкоинов", async function () {
      // Создаем новый токен
    const newToken = await ethers.getContractFactory("MockERC20")
      .then(factory => factory.deploy("Test Token", "TEST", 18, 0));
      const tokenAddress = await newToken.getAddress();

      // Добавляем в список стейблкоинов
      await tokenValidator.connect(owner).setTokenIsStablecoin(tokenAddress, true);

      // Проверяем, что токен определяется как стейблкоин
      expect(await tokenValidator.isStablecoin(tokenAddress)).to.equal(true);
    });

    it("Владелец может удалить токен из списка стейблкоинов", async function () {
      const usdcAddress = await usdc.getAddress();

      // Проверяем, что USDC изначально стейблкоин
      expect(await tokenValidator.isStablecoin(usdcAddress)).to.equal(true);

      // Удаляем из списка стейблкоинов
      await tokenValidator.connect(owner).setTokenIsStablecoin(usdcAddress, false);

      // Проверяем, что USDC больше не в списке (но может определяться по символу)
      const stablecoinsAfter = await tokenValidator.getStablecoins();
      expect(stablecoinsAfter).to.not.include(usdcAddress);
    });

    it("Обычный пользователь не может управлять списком стейблкоинов", async function () {
      const newTokenAddress = await randomToken.getAddress();
      await expect(tokenValidator.connect(user).setTokenIsStablecoin(newTokenAddress, true))
        .to.be.revertedWithCustomError(tokenValidator, "OwnableUnauthorizedAccount");
    });

    it("Должен обновлять кеш при изменении статуса стейблкоина", async function () {
      const tokenAddress = await randomToken.getAddress();

      // Первоначально проверяем информацию
      const infoBefore = await tokenValidator.getTokenInfo(tokenAddress);
      expect(infoBefore.isStablecoin).to.equal(false);

      // Устанавливаем как стейблкоин
      await tokenValidator.connect(owner).setTokenIsStablecoin(tokenAddress, true);

      // Проверяем обновленную информацию
      const infoAfter = await tokenValidator.getTokenInfo(tokenAddress);
      expect(infoAfter.isStablecoin).to.equal(true);
      expect(infoAfter.lastValidated).to.be.gt(0);
    });
  });

  describe("Интеграционные тесты для стейблкоинов", function () {
    it("Должен добавлять новые токены в список через setTokenIsStablecoin", async function () {
      // Получаем начальный список стейблкоинов
      const initialStablecoins = await tokenValidator.getStablecoins();
      const initialCount = initialStablecoins.length;

      // Добавляем новый токен
      const newToken = await ethers.getContractFactory("MockERC20")
        .then(factory => factory.deploy("New Stable", "NUSD", 18, 0));
      const tokenAddress = await newToken.getAddress();

      await tokenValidator.connect(owner).setTokenIsStablecoin(tokenAddress, true);

      // Проверяем, что список обновился
      const updatedStablecoins = await tokenValidator.getStablecoins();
      expect(updatedStablecoins.length).to.equal(initialCount + 1);
      expect(updatedStablecoins).to.include(tokenAddress);
    });
  });
});
