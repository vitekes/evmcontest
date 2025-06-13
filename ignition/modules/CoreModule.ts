import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CoreModule = buildModule("CoreModule", (m) => {
  console.log("🏗️ Деплой основных контрактов платформы конкурсов...");

  // =============================================
  // ПОЛУЧЕНИЕ ПАРАМЕТРОВ КОНФИГУРАЦИИ
  // =============================================
  
  const treasuryAddress = m.getParameter("treasuryAddress", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  const platformFeePercentage = m.getParameter("platformFeePercentage", 500);
  const minContestDuration = m.getParameter("minContestDuration", 3600);
  const maxContestDuration = m.getParameter("maxContestDuration", 2592000);

  console.log(`💰 Treasury: ${treasuryAddress}`);
  console.log(`💸 Комиссия платформы: ${platformFeePercentage} bp (${Number(platformFeePercentage)/100}%)`);
  console.log(`⏱️ Длительность конкурса: ${minContestDuration}s - ${maxContestDuration}s`);

  // =============================================
  // ПОЛУЧЕНИЕ АДРЕСОВ ТОКЕНОВ ДЛЯ КОНКРЕТНОЙ СЕТИ
  // =============================================
  
  // Для основных сетей получаем адреса реальных токенов
  const wrappedNativeAddress = m.getParameter("wrappedNativeAddress", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"); // WETH по умолчанию
  const stablecoins = m.getParameter("stablecoins", [
    "0xA0b86a33E6441F8C55088123Aed7FEe3c99B81b2", // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7"  // USDT
  ]);

  console.log(`🔗 Wrapped Native: ${wrappedNativeAddress}`);
  console.log(`💰 Stablecoins: настроены для деплоя`);

  // =============================================
  // ДЕПЛОЙ ОСНОВНЫХ КОНТРАКТОВ
  // =============================================

  // 1. NetworkFeeManager
  const networkFeeManager = m.contract("NetworkFeeManager", [treasuryAddress]);

  // 2. PrizeTemplates  
  const prizeTemplates = m.contract("PrizeTemplates");

  // 3. TokenValidator 
  const tokenValidator = m.contract("TokenValidator", [
    wrappedNativeAddress, // WETH/WBNB/WMATIC
    stablecoins          // Массив стейблкоинов
  ]);

  // 4. PrizeManager
  const prizeManager = m.contract("PrizeManager");

  // 5. CreatorBadges (передаем адрес 0, factory установится позже)
  const creatorBadges = m.contract("CreatorBadges", ["0x0000000000000000000000000000000000000000"]);

  // 6. ContestEscrow implementation (для клонирования)
  const escrowImpl = m.contract("ContestEscrow");

  // 7. ContestFactory - ИСПРАВЛЕНО: Передаем ТОЧНО 6 параметров как в конструкторе
  const contestFactory = m.contract("ContestFactory", [
    escrowImpl,          // 1. _escrowImpl
    networkFeeManager,   // 2. _feeManager  
    prizeTemplates,      // 3. _prizeTemplates
    creatorBadges,       // 4. _badges
    tokenValidator,      // 5. _tokenValidator
    prizeManager         // 6. _prizeManager
  ]);

  // =============================================
  // НАСТРОЙКА СВЯЗЕЙ МЕЖДУ КОНТРАКТАМИ
  // =============================================

  // Устанавливаем factory в NetworkFeeManager
  m.call(networkFeeManager, "setContestFactory", [contestFactory]);

  // Устанавливаем factory в CreatorBadges
  m.call(creatorBadges, "setContestFactory", [contestFactory]);

  // Авторизуем factory в PrizeManager
  m.call(prizeManager, "setAuthorizedCreator", [contestFactory, true]);

  console.log("✅ Основные контракты настроены!");

  return {
    contestFactory,
    networkFeeManager,
    prizeTemplates,
    tokenValidator,
    prizeManager,
    creatorBadges,
    escrowImpl
  };
});

export default CoreModule;