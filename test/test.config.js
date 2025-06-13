// =============================================
// 🧪 УНИВЕРСАЛЬНАЯ КОНФИГУРАЦИЯ ТЕСТОВ
// =============================================

const path = require('path');

// Базовые настройки для всех типов тестов
const baseConfig = {
    timeout: 60000,
    retries: 1,
    reporter: 'spec',
    require: [
        'hardhat/register',
        'ts-node/register'
    ],
    extensions: ['ts'],
    recursive: true
};

// Конфигурации для разных типов тестов
const testConfigs = {
    // Unit тесты
    unit: {
        ...baseConfig,
        pattern: 'test/unit/**/*.test.ts',
        folder: 'test/unit',
        description: 'Модульные тесты контрактов',
        env: {
            NODE_ENV: 'test',
            DEBUG: 'true',
            REPORT_GAS: 'true'
        }
    },

    // Integration тесты  
    integration: {
        ...baseConfig,
        pattern: 'test/integration/**/*.test.ts',
        folder: 'test/integration',
        description: 'Интеграционные тесты',
        timeout: 120000, // ИСПРАВЛЕНО: Переопределяем timeout
        env: {
            NODE_ENV: 'test',
            DEBUG: 'true',
            REPORT_GAS: 'false'
        }
    },

    // E2E тесты
    e2e: {
        ...baseConfig,
        pattern: 'test/e2e/**/*.test.ts',
        folder: 'test/e2e',
        description: 'End-to-end тесты',
        timeout: 180000, // ИСПРАВЛЕНО: Переопределяем timeout
        env: {
            NODE_ENV: 'test',
            DEBUG: 'false',
            REPORT_GAS: 'false'
        }
    },

    // Все тесты
    all: {
        ...baseConfig,
        pattern: 'test/**/*.test.ts',
        folder: 'test',
        description: 'Все тесты',
        timeout: 180000, // ИСПРАВЛЕНО: Переопределяем timeout
        env: {
            NODE_ENV: 'test',
            DEBUG: 'true',
            REPORT_GAS: 'true'
        }
    },

    // Coverage
    coverage: {
        ...baseConfig,
        pattern: 'test/unit/**/*.test.ts',
        folder: 'test/unit',
        description: 'Тесты с покрытием кода',
        timeout: 120000, // ДОБАВЛЕНО: timeout для coverage
        env: {
            NODE_ENV: 'test',
            DEBUG: 'false',
            REPORT_GAS: 'false',
            COVERAGE: 'true'
        }
    },

    // ДОБАВЛЕНО: Быстрые smoke тесты
    quick: {
        ...baseConfig,
        pattern: 'test/unit/**/ContestEscrow.test.ts test/unit/**/TokenValidator.test.ts',
        folder: 'test/unit',
        description: 'Быстрые smoke тесты',
        timeout: 30000,
        env: {
            NODE_ENV: 'test',
            DEBUG: 'false',
            REPORT_GAS: 'false'
        }
    },

    // ДОБАВЛЕНО: Debug режим
    debug: {
        ...baseConfig,
        pattern: 'test/unit/**/*.test.ts',
        folder: 'test/unit',
        description: 'Отладочные тесты с verbose логами',
        timeout: 300000, // 5 минут для debug
        env: {
            NODE_ENV: 'test',
            DEBUG: 'hardhat:*',
            REPORT_GAS: 'true',
            HARDHAT_VERBOSE: 'true'
        }
    }
};

// Функция для получения конфигурации
function getTestConfig(type = 'unit') {
    const config = testConfigs[type];
    if (!config) {
        throw new Error(`Unknown test type: ${type}. Available: ${Object.keys(testConfigs).join(', ')}`);
    }
    return config;
}

// УЛУЧШЕНО: Функция для генерации npm script команды
function generateNpmCommand(type = 'unit', useHardhat = true) {
    const config = getTestConfig(type);
    
    if (useHardhat) {
        return `npx hardhat test ${config.folder}`;
    } else {
        // Для прямого использования Mocha
        return `npx mocha "${config.pattern}" --timeout ${config.timeout} --require hardhat/register --require ts-node/register`;
    }
}

// УЛУЧШЕНО: Функция для генерации coverage команды
function generateCoverageCommand(type = 'unit') {
    const config = getTestConfig(type);
    return `npx hardhat coverage --testfiles "${config.folder}"`;
}

// ДОБАВЛЕНО: Функция для валидации конфигурации
function validateConfig(type) {
    try {
        const config = getTestConfig(type);
        
        // Проверяем обязательные поля
        if (!config.folder) throw new Error('Missing folder field');
        if (!config.pattern) throw new Error('Missing pattern field');
        if (!config.description) throw new Error('Missing description field');
        if (!config.env) throw new Error('Missing env field');
        
        return true;
    } catch (error) {
        console.error(`Configuration validation failed for ${type}:`, error.message);
        return false;
    }
}

// ДОБАВЛЕНО: Получение всех доступных типов
function getAvailableTypes() {
    return Object.keys(testConfigs);
}

// ДОБАВЛЕНО: Получение help информации
function getHelpInfo() {
    const types = Object.entries(testConfigs).map(([type, config]) => ({
        type,
        description: config.description,
        timeout: config.timeout,
        folder: config.folder
    }));
    
    return {
        types,
        usage: 'node test/test-runner.js [type] [options]',
        examples: [
            'node test/test-runner.js unit',
            'node test/test-runner.js coverage',
            'node test/test-runner.js debug',
            'npm run test:unit'
        ]
    };
}

module.exports = {
    testConfigs,
    getTestConfig,
    generateNpmCommand,
    generateCoverageCommand,
    validateConfig,
    getAvailableTypes,
    getHelpInfo,
    baseConfig
};