import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import CoreModule from "./CoreModule";
import MockModule from "./MockModule";

const LocalDeploy = buildModule("LocalDeploy", (m) => {
  console.log("🏠 Локальный деплой платформы конкурсов с Mock токенами...");

  // =============================================
  // ПОЛУЧЕНИЕ ПАРАМЕТРОВ ДЛЯ LOCALHOST
  // =============================================
  
  // Для localhost используем адрес первого аккаунта из hardhat
  const treasuryAddress = m.getParameter("treasuryAddress", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  const platformFeePercentage = m.getParameter("platformFeePercentage", 300); // 3% для локальных тестов

  console.log(`🏠 Локальная сборка для быстрой разработки`);
  console.log(`💰 Treasury: ${treasuryAddress}`);
  console.log(`💸 Комиссия: ${Number(platformFeePercentage)/100}%`);
  console.log(`⏱️ Время: Используем дефолтные значения (1 час - 30 дней)`);

  // =============================================
  // ДЕПЛОЙ ОСНОВНЫХ КОНТРАКТОВ
  // =============================================
  
  // ИСПРАВЛЕНО: Используем CoreModule без параметров (как в PublicDeploy)
  const coreModule = m.useModule(CoreModule);
  
  // =============================================
  // ДЕПЛОЙ И НАСТРОЙКА MOCK ТОКЕНОВ
  // =============================================
  
  const mockModule = m.useModule(MockModule);
  
  console.log("🪙 Настройка Mock токенов в TokenValidator...");

  // Добавляем mock токены в whitelist
  m.call(coreModule.tokenValidator, "setTokenWhitelisted", [mockModule.mockUSDC, true], {
    id: "whitelist_mock_usdc"
  });
  
  m.call(coreModule.tokenValidator, "setTokenWhitelisted", [mockModule.mockUSDT, true], {
    id: "whitelist_mock_usdt"
  });
  
  m.call(coreModule.tokenValidator, "setTokenWhitelisted", [mockModule.mockWETH, true], {
    id: "whitelist_mock_weth"
  });

  // Настраиваем price feeds для mock токенов
  m.call(coreModule.tokenValidator, "setPriceFeed", [mockModule.mockUSDC, mockModule.usdcPriceFeed], {
    id: "set_mock_usdc_price"
  });
  
  m.call(coreModule.tokenValidator, "setPriceFeed", [mockModule.mockUSDT, mockModule.usdtPriceFeed], {
    id: "set_mock_usdt_price"
  });
  
  m.call(coreModule.tokenValidator, "setPriceFeed", [mockModule.mockWETH, mockModule.wethPriceFeed], {
    id: "set_mock_weth_price"
  });

  // Устанавливаем минимальные суммы для localhost (очень низкие для тестов)
  m.call(coreModule.tokenValidator, "setMinimumPrizeAmount", [mockModule.mockWETH, "1000000000000000"], {
    id: "set_mock_weth_minimum" // 0.001 WETH
  });

  m.call(coreModule.tokenValidator, "setMinimumPrizeAmount", [mockModule.mockUSDC, "1000000"], {
    id: "set_mock_usdc_minimum" // $1 USDC (6 decimals)
  });

  m.call(coreModule.tokenValidator, "setMinimumPrizeAmount", [mockModule.mockUSDT, "1000000"], {
    id: "set_mock_usdt_minimum" // $1 USDT (6 decimals)
  });

  // =============================================
  // СПЕЦИАЛЬНЫЕ НАСТРОЙКИ ДЛЯ LOCALHOST
  // =============================================
  
  // Устанавливаем очень низкую комиссию для localhost
  m.call(coreModule.networkFeeManager, "setNetworkFee", [31337, 100], { // 1% для localhost (chainId 31337)
    id: "set_localhost_fee"
  });

  // =============================================
  // МИНТ ТОКЕНОВ ДЛЯ ТЕСТИРОВАНИЯ
  // =============================================
  
  console.log("💰 Минтим токены на тестовые аккаунты...");
  
  const testAccounts = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // account 1
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // account 2
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906"  // account 3
  ];

  // Минтим каждому аккаунту токены для тестирования
  for (let i = 0; i < testAccounts.length; i++) {
    // USDC (6 decimals) - 10,000 USDC
    m.call(mockModule.mockUSDC, "mint", [testAccounts[i], "10000000000"], {
      id: `mint_usdc_${i}`
    });
    
    // USDT (6 decimals) - 10,000 USDT
    m.call(mockModule.mockUSDT, "mint", [testAccounts[i], "10000000000"], {
      id: `mint_usdt_${i}`
    });
    
    // WETH (18 decimals) - 100 WETH
    m.call(mockModule.mockWETH, "mint", [testAccounts[i], "100000000000000000000"], {
      id: `mint_weth_${i}`
    });
  }

  console.log("🎉 Localhost деплой завершен!");
  console.log("🧪 Mock токены готовы для тестирования");
  console.log("💰 Тестовые аккаунты пополнены токенами");
  console.log("⏱️ Для настройки времени используйте админские методы:");
  console.log("   - contestFactory.setMinContestDuration(300)  // 5 минут для быстрых тестов");
  console.log("   - contestFactory.setMaxContestDuration(86400) // 1 день максимум");

  return {
    // Основные контракты платформы
    contestFactory: coreModule.contestFactory,
    prizeTemplates: coreModule.prizeTemplates,
    tokenValidator: coreModule.tokenValidator,
    networkFeeManager: coreModule.networkFeeManager,
    prizeManager: coreModule.prizeManager,
    creatorBadges: coreModule.creatorBadges,
    
    // Mock токены для тестирования
    mockUSDC: mockModule.mockUSDC,
    mockUSDT: mockModule.mockUSDT,
    mockWETH: mockModule.mockWETH,
    
    // Price feeds для тестов
    usdcPriceFeed: mockModule.usdcPriceFeed,
    usdtPriceFeed: mockModule.usdtPriceFeed,
    wethPriceFeed: mockModule.wethPriceFeed,
    
    // Вспомогательные контракты для тестирования
    testHelper: mockModule.testHelper,
    mockFactory: mockModule.mockFactory
  };
});

export default LocalDeploy;