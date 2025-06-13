// =============================================
// 🚀 УНИВЕРСАЛЬНЫЙ RUNNER ДЛЯ ТЕСТОВ
// =============================================

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Получаем аргументы командной строки
const args = process.argv.slice(2);
const testType = args[0] || 'unit';
const additionalArgs = args.slice(1);

// =============================================
// 📝 КОНФИГУРАЦИИ ТЕСТОВ
// =============================================

const testConfigs = {
    // Unit тесты
    unit: {
        pattern: 'test/unit/*.test.ts',
        folder: 'test/unit',
        description: 'Модульные тесты контрактов',
        timeout: 60000,
        env: {
            NODE_ENV: 'test',
            DEBUG: 'true',
            REPORT_GAS: 'true'
        }
    },

    // Integration тесты  
    integration: {
        pattern: 'test/integration/*.test.ts',
        folder: 'test/integration',
        description: 'Интеграционные тесты',
        timeout: 120000,
        env: {
            NODE_ENV: 'test',
            DEBUG: 'true',
            REPORT_GAS: 'false'
        }
    },

    // E2E тесты
    e2e: {
        pattern: 'test/e2e/*.test.ts',
        folder: 'test/e2e',
        description: 'End-to-end тесты',
        timeout: 180000,
        env: {
            NODE_ENV: 'test',
            DEBUG: 'false',
            REPORT_GAS: 'false'
        }
    },

    // Все тесты
    all: {
        pattern: 'test/**/*.test.ts',
        folder: 'test',
        description: 'Все тесты',
        timeout: 180000,
        env: {
            NODE_ENV: 'test',
            DEBUG: 'true',
            REPORT_GAS: 'true'
        }
    },

    // Coverage
    coverage: {
        pattern: 'test/unit/**/*.test.ts',
        folder: 'test/unit',
        description: 'Тесты с покрытием кода',
        timeout: 120000,
        env: {
            NODE_ENV: 'test',
            DEBUG: 'false',
            REPORT_GAS: 'false',
            COVERAGE: 'true'
        }
    },

    // Быстрые тесты (только самые важные)
    quick: {
        // ИСПРАВЛЕНО: Используем корректный паттерн для конкретных файлов
        pattern: 'test/unit/{ContestEscrow,TokenValidator}.test.ts',
        folder: 'test/unit',
        description: 'Быстрые smoke тесты',
        timeout: 30000,
        env: {
            NODE_ENV: 'test',
            DEBUG: 'false',
            REPORT_GAS: 'false'
        }
    }
};

// =============================================
// 🛠️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================

function getTestConfig(type) {
    const config = testConfigs[type];
    if (!config) {
        console.error(`❌ Неизвестный тип тестов: ${type}`);
        console.log(`📋 Доступные типы: ${Object.keys(testConfigs).join(', ')}`);
        process.exit(1);
    }
    return config;
}

function checkTestFiles(config) {
    // Проверяем, что папка с тестами существует
    if (!fs.existsSync(config.folder)) {
        console.error(`❌ Папка с тестами не найдена: ${config.folder}`);
        console.log(`💡 Создайте папку: mkdir -p ${config.folder}`);
        return false;
    }

    // Проверяем, что есть тестовые файлы
    const glob = require('child_process').execSync(`ls ${config.pattern} 2>/dev/null || echo "NO_FILES"`, {encoding: 'utf8'}).trim();
    
    if (glob === 'NO_FILES' || glob === '') {
        console.error(`❌ Тестовые файлы не найдены в: ${config.folder}`);
        console.log(`💡 Паттерн поиска: ${config.pattern}`);
        return false;
    }

    return true;
}

function showHelp() {
    console.log(`
🧪 УНИВЕРСАЛЬНЫЙ RUNNER ДЛЯ ТЕСТОВ

Использование:
  node test/test-runner.js [тип] [дополнительные-аргументы]

Доступные типы тестов:
`);
    
    Object.entries(testConfigs).forEach(([type, config]) => {
        console.log(`  ${type.padEnd(12)} - ${config.description}`);
    });
    
    console.log(`
Примеры:
  node test/test-runner.js unit
  node test/test-runner.js integration
  node test/test-runner.js coverage
  node test/test-runner.js unit --grep "should validate"
  node test/test-runner.js --help

Переменные окружения:
  DEBUG=true          - Подробные логи
  REPORT_GAS=true     - Отчет по газу
  COVERAGE=true       - Режим покрытия кода
`);
}

// =============================================
// 🚀 ОСНОВНАЯ ЛОГИКА
// =============================================

// Показать help
if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
}

console.log(`🧪 Запуск ${testType} тестов...`);

try {
    const config = getTestConfig(testType);
    
    // Проверяем наличие файлов
    if (!checkTestFiles(config)) {
        process.exit(1);
    }
    
    // Устанавливаем переменные окружения
    Object.assign(process.env, config.env);
    
    console.log(`📋 ${config.description}`);
    console.log(`📁 Папка: ${config.folder}`);
    console.log(`🔍 Паттерн: ${config.pattern}`);
    console.log(`⏱️  Timeout: ${config.timeout}ms`);
    console.log(`🌍 Env: ${JSON.stringify(config.env, null, 2)}`);
    
    // Специальная обработка для coverage
    if (testType === 'coverage') {
        console.log(`🚀 Команда: npx hardhat coverage --testfiles "${config.pattern}"\n`);
        
        const coverageProcess = spawn('npx', ['hardhat', 'coverage', '--testfiles', config.pattern], {
            stdio: 'inherit',
            env: process.env,
            shell: process.platform === 'win32'
        });
        
        coverageProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ Coverage тесты завершены успешно!`);
                console.log(`📊 Отчет о покрытии сохранен в ./coverage/`);
            } else {
                console.log(`\n❌ Coverage тесты завершились с ошибкой (код: ${code})`);
            }
            process.exit(code);
        });
        
        return;
    }
    
    // ИСПРАВЛЕНО: Используем паттерн файлов вместо папки для обычных тестов
    const command = 'npx';
    const baseArgs = ['hardhat', 'test', config.pattern]; // Используем pattern вместо folder
    const finalArgs = [...baseArgs, ...additionalArgs];
    
    console.log(`🚀 Команда: ${command} ${finalArgs.join(' ')}\n`);
    
    // Запускаем тесты
    const testProcess = spawn(command, finalArgs, {
        stdio: 'inherit',
        env: process.env,
        shell: process.platform === 'win32'
    });
    
    testProcess.on('close', (code) => {
        if (code === 0) {
            console.log(`\n✅ ${testType} тесты завершены успешно!`);
            
            // Дополнительная информация
            if (testType === 'unit') {
                console.log(`📈 Для запуска с покрытием: npm run test:coverage`);
            }
            if (process.env.REPORT_GAS === 'true') {
                console.log(`⛽ Отчет о газе сохранен в ./gas-report.txt`);
            }
        } else {
            console.log(`\n❌ ${testType} тесты завершились с ошибкой (код: ${code})`);
            console.log(`💡 Попробуйте: node test/test-runner.js ${testType} --help`);
        }
        process.exit(code);
    });
    
    testProcess.on('error', (error) => {
        console.error(`❌ Ошибка запуска тестов: ${error.message}`);
        console.log(`💡 Убедитесь что установлены зависимости: npm install`);
        process.exit(1);
    });
    
} catch (error) {
    console.error(`❌ Ошибка конфигурации: ${error.message}`);
    showHelp();
    process.exit(1);
}