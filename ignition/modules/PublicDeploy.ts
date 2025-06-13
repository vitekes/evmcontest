import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import CoreModule from "./CoreModule";

const PublicDeploy = buildModule("PublicDeploy", (m) => {
  console.log("🌐 Публичный деплой платформы конкурсов с реальными токенами...");

  // =============================================
  // ПОЛУЧЕНИЕ ПАРАМЕТРОВ ДЛЯ ПУБЛИЧНЫХ СЕТЕЙ
  // =============================================
  
  // ОБЯЗАТЕЛЬНЫЕ параметры для продакшн деплоя
  const treasuryAddress = m.getParameter("treasuryAddress");
  const platformFeePercentage = m.getParameter("platformFeePercentage", 500); // 5% по умолчанию
  
  // Адреса реальных токенов (ОБЯЗАТЕЛЬНЫЕ)
  const wethAddress = m.getParameter("wethAddress");
  const usdcAddress = m.getParameter("usdcAddress");
  const usdtAddress = m.getParameter("usdtAddress");
  
  // Chainlink price feeds (с дефолтами для Ethereum mainnet)
  const wethPriceFeed = m.getParameter("wethPriceFeed", "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419");
  const usdcPriceFeed = m.getParameter("usdcPriceFeed", "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6");
  const usdtPriceFeed = m.getParameter("usdtPriceFeed", "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D");

  console.log(`🌐 Публичный деплой`);
  console.log(`💰 Treasury: ${treasuryAddress}`);
  // ИСПРАВЛЕНО: Приведение к числу для арифметики
  console.log(`💸 Комиссия: ${platformFeePercentage} bp (${Number(platformFeePercentage)/100}%)`);
  console.log(`🪙 WETH: ${wethAddress}`);
  console.log(`🪙 USDC: ${usdcAddress}`);
  console.log(`🪙 USDT: ${usdtAddress}`);

  // =============================================
  // ДЕПЛОЙ ОСНОВНЫХ КОНТРАКТОВ
  // =============================================
  
  // ИСПРАВЛЕНО: Убираем передачу параметров, используем CoreModule как есть
  const coreModule = m.useModule(CoreModule);
  
  // =============================================
  // НАСТРОЙКА РЕАЛЬНЫХ ТОКЕНОВ
  // =============================================
  
  console.log("🪙 Настройка реальных токенов в TokenValidator...");

  // Добавляем реальные токены в whitelist
  m.call(coreModule.tokenValidator, "setTokenWhitelisted", [wethAddress, true], {
    id: "whitelist_weth"
  });

  m.call(coreModule.tokenValidator, "setTokenWhitelisted", [usdcAddress, true], {
    id: "whitelist_usdc"
  });

  m.call(coreModule.tokenValidator, "setTokenWhitelisted", [usdtAddress, true], {
    id: "whitelist_usdt"
  });

  // Настраиваем Chainlink price feeds
  m.call(coreModule.tokenValidator, "setPriceFeed", [wethAddress, wethPriceFeed], {
    id: "set_weth_price_feed"
  });

  m.call(coreModule.tokenValidator, "setPriceFeed", [usdcAddress, usdcPriceFeed], {
    id: "set_usdc_price_feed"
  });

  m.call(coreModule.tokenValidator, "setPriceFeed", [usdtAddress, usdtPriceFeed], {
    id: "set_usdt_price_feed"
  });

  // =============================================
  // ПРОДАКШН НАСТРОЙКИ МИНИМАЛЬНЫХ СУММ
  // =============================================
  
  // WETH: минимум 0.01 ETH (продакшн значение)
  m.call(coreModule.tokenValidator, "setMinimumPrizeAmount", [wethAddress, "10000000000000000"], {
    id: "set_weth_minimum"
  });

  // USDC: минимум $50 (продакшн значение)
  m.call(coreModule.tokenValidator, "setMinimumPrizeAmount", [usdcAddress, "50000000"], {
    id: "set_usdc_minimum"
  });

  // USDT: минимум $50 (продакшн значение)
  m.call(coreModule.tokenValidator, "setMinimumPrizeAmount", [usdtAddress, "50000000"], {
    id: "set_usdt_minimum"
  });

  // =============================================
  // ДОПОЛНИТЕЛЬНЫЕ ПРОДАКШН НАСТРОЙКИ
  // =============================================
  
  // Настраиваем более высокие комиссии для testnets для покрытия gas costs
  m.call(coreModule.networkFeeManager, "setNetworkFee", [11155111, 200], { // 2% для Sepolia
    id: "set_sepolia_fee_override"
  });

  m.call(coreModule.networkFeeManager, "setNetworkFee", [5, 300], { // 3% для Goerli
    id: "set_goerli_fee"
  });

  // =============================================
  // БЕЗОПАСНОСТЬ: ПЕРЕДАЧА OWNERSHIP
  // =============================================
  
  // ИСПРАВЛЕНО: Используем строковое значение по умолчанию
  const multisigAddress = m.getParameter("multisigAddress", "");
  
  // ИСПРАВЛЕНО: Правильная проверка на пустую строку
  const shouldUseMultisig = m.getParameter("useMultisig", false);
  
  // Условная передача ownership, только если указан multisig
  if (shouldUseMultisig) {
    // Передаем ownership ключевых контрактов
    m.call(coreModule.networkFeeManager, "transferOwnership", [multisigAddress], {
      id: "transfer_fee_manager_ownership"
    });

    m.call(coreModule.tokenValidator, "transferOwnership", [multisigAddress], {
      id: "transfer_token_validator_ownership"
    });

    m.call(coreModule.prizeManager, "transferOwnership", [multisigAddress], {
      id: "transfer_prize_manager_ownership"
    });
    
    console.log("🔒 Ownership передан multisig кошельку");
  } else {
    console.log("⚠️ Ownership остался у деплойера");
  }

  console.log("🎉 Публичный деплой завершен!");
  console.log("🌐 Платформа готова к продакшн использованию");

  // ИСПРАВЛЕНО: Возвращаем только ContractFuture объекты
  return {
    // Основные контракты платформы
    contestFactory: coreModule.contestFactory,
    prizeTemplates: coreModule.prizeTemplates,
    tokenValidator: coreModule.tokenValidator,
    networkFeeManager: coreModule.networkFeeManager,
    prizeManager: coreModule.prizeManager,
    creatorBadges: coreModule.creatorBadges
  };
});

export default PublicDeploy;