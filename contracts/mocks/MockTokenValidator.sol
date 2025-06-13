// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/ITokenValidator.sol";
import "./MockConstants.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract MockTokenValidator is ITokenValidator {
    // Массив стейблкоинов для тестирования
    address[] public stablecoins;
    // Метод для определения, что это мок-реализация
    function isMockTokenValidator() external pure returns (bool) {
        return true;
    }
    mapping(address => bool) public validTokens;
    mapping(address => bool) public liquidTokens;
    mapping(address => bool) public blacklistedTokens;
    mapping(address => TokenInfo) public tokenInfos;
    
    function setValidToken(address token, bool valid) external {
        validTokens[token] = valid;

        // Автоматически инициализируем liquidTokens, если добавляем токен в validTokens
        if (valid && !liquidTokens[token]) {
            liquidTokens[token] = true;
        }

        // Автоматически инициализируем базовую информацию о токене, если её ещё нет
        if (valid && tokenInfos[token].lastValidated == 0) {
            // Пытаемся определить имя и символ токена из его адреса (для известных токенов)
            string memory name = "Unknown Token";
            string memory symbol = "UNKNOWN";
            bool isStable = false;

            // Простая эвристика для определения типа токена по адресу (упрощенно для тестов)
            bytes memory addrBytes = abi.encodePacked(token);
            if (addrBytes.length > 0) {
                // Используем последний байт адреса для определения типа токена
                uint8 lastByte = uint8(addrBytes[addrBytes.length - 1]);

                if (lastByte % 3 == 0) { // Условная логика для имитации разных токенов
                    name = "USD Tether";
                    symbol = "USDT";
                    isStable = true;
                } else if (lastByte % 3 == 1) {
                    name = "USD Coin";
                    symbol = "USDC";
                    isStable = true;
                } else {
                    name = "Test Token";
                    symbol = "TEST";
                }
            }

            tokenInfos[token] = TokenInfo({
                name: name,
                symbol: symbol,
                decimals: 18,
                hasLiquidity: true,
                priceUSD: 100 * 1e8, // $100 для тестов
                liquidityUSD: MockConstants.MINIMUM_LIQUIDITY * 2,
                lastValidated: block.timestamp,
                isStablecoin: isStable,
                isWrappedNative: false
            });
        }
    }
    
    function setLiquidToken(address token, bool liquid) external {
        liquidTokens[token] = liquid;
    }
    
    function setTokenInfo(address token, TokenInfo calldata info) external {
        tokenInfos[token] = info;
    }
    
    function isValidToken(address token) external view override returns (bool) {
        // ETH всегда валиден
        if (token == address(0)) return true;

        // Проверяем blacklist в первую очередь
        if (blacklistedTokens[token]) return false;

        return validTokens[token];
    }
    
    function getTokenInfo(address token) external view override returns (TokenInfo memory) {
        if (token == address(0)) {
            return TokenInfo({
                name: MockConstants.ETH_NAME,
                symbol: MockConstants.ETH_SYMBOL,
                decimals: 18,
                hasLiquidity: true,
                priceUSD: uint256(MockConstants.ETH_PRICE_USD),
                liquidityUSD: MockConstants.MINIMUM_LIQUIDITY * 10,
                lastValidated: block.timestamp,
                isStablecoin: false,
                isWrappedNative: false
            });
        }
        return tokenInfos[token];
    }
    
    function isLiquidToken(address token) external view override returns (bool) {
        if (token == address(0)) return true;

        // Проверяем blacklist в первую очередь
        if (blacklistedTokens[token]) return false;

        return liquidTokens[token];
    }
    
    function getMinimumLiquidity() external pure override returns (uint256) {
        return MockConstants.MINIMUM_LIQUIDITY;
    }

    // Возвращает список всех стейблкоинов
    function getStablecoins() external view returns (address[] memory) {
        return stablecoins;
    }

    /// @notice Обновляет список стейблкоинов
    /// @param _stablecoins Новый список стейблкоинов
    function updateStablecoins(address[] calldata _stablecoins) external {
        delete stablecoins; // Очищаем текущий массив

        // Добавляем новые стейблкоины
        for (uint i = 0; i < _stablecoins.length; i++) {
            stablecoins.push(_stablecoins[i]);

            // Если такого токена нет в нашей информации, добавляем его
            if (tokenInfos[_stablecoins[i]].lastValidated == 0) {
                tokenInfos[_stablecoins[i]] = TokenInfo({
                    name: "Stablecoin",
                    symbol: "STABLE",
                    decimals: 18,
                    hasLiquidity: true,
                    priceUSD: 100 * 1e8, // $1.00
                    liquidityUSD: MockConstants.MINIMUM_LIQUIDITY * 5,
                    lastValidated: block.timestamp,
                    isStablecoin: true,
                    isWrappedNative: false
                });
            } else {
                // Если информация уже есть, просто обновляем флаг
                tokenInfos[_stablecoins[i]].isStablecoin = true;
            }

            // Автоматически добавляем в whitelist
            validTokens[_stablecoins[i]] = true;
            liquidTokens[_stablecoins[i]] = true;
        }
    }

    /// @notice Обновляет информацию о токене
    /// @param token Адрес токена
    /// @return info Обновленная информация о токене
    function updateTokenInfo(address token) external returns (TokenInfo memory info) {
        // Для ETH возвращаем стандартную информацию
        if (token == address(0)) {
            return TokenInfo({
                name: MockConstants.ETH_NAME,
                symbol: MockConstants.ETH_SYMBOL,
                decimals: 18,
                hasLiquidity: true,
                priceUSD: uint256(MockConstants.ETH_PRICE_USD),
                liquidityUSD: MockConstants.MINIMUM_LIQUIDITY * 10,
                lastValidated: block.timestamp,
                isStablecoin: false,
                isWrappedNative: false
            });
        }

        // Проверяем, есть ли информация о токене
        if (tokenInfos[token].lastValidated > 0) {
            // Обновляем существующую информацию
            info = tokenInfos[token];
            info.lastValidated = block.timestamp;
            info.hasLiquidity = liquidTokens[token];

            // Проверяем, является ли токен стейблкоином по символу
            string memory symbol = info.symbol;
            bytes32 symbolHash = keccak256(bytes(symbol));

            if (symbolHash == keccak256(bytes("USDT")) ||
                symbolHash == keccak256(bytes("USDC")) ||
                symbolHash == keccak256(bytes("DAI")) ||
                symbolHash == keccak256(bytes("BUSD"))) {
                info.isStablecoin = true;

                // Добавляем в список стейблкоинов, если его там нет
                bool isInStablecoins = false;
                for (uint i = 0; i < stablecoins.length; i++) {
                    if (stablecoins[i] == token) {
                        isInStablecoins = true;
                        break;
                    }
                }

                if (!isInStablecoins) {
                    stablecoins.push(token);
                }
            }
        } else {
            // Создаем новую запись с базовой информацией
            // Пытаемся получить название и символ из контракта
            string memory name = "Unknown Token";
            string memory symbol = "UNK";
            uint8 decimals = 18;
            bool isStable = false;

            try IERC20Metadata(token).name() returns (string memory n) {
                name = n;
            } catch {}

            try IERC20Metadata(token).symbol() returns (string memory s) {
                symbol = s;

                // Определяем стейблкоины по символу
                bytes32 symbolHash = keccak256(bytes(symbol));
                if (symbolHash == keccak256(bytes("USDT")) ||
                    symbolHash == keccak256(bytes("USDC")) ||
                    symbolHash == keccak256(bytes("DAI")) ||
                    symbolHash == keccak256(bytes("BUSD"))) {
                    isStable = true;
                }
            } catch {}

            try IERC20Metadata(token).decimals() returns (uint8 d) {
                decimals = d;
            } catch {}

            info = TokenInfo({
                name: name,
                symbol: symbol,
                decimals: decimals,
                hasLiquidity: true,
                priceUSD: isStable ? 100 * 1e8 : 1000 * 1e8, // $1.00 для стейбла, $10.00 для других
                liquidityUSD: MockConstants.MINIMUM_LIQUIDITY * 3,
                lastValidated: block.timestamp,
                isStablecoin: isStable,
                isWrappedNative: false
            });

            // Если это стейблкоин, добавляем в список
            if (isStable) {
                bool isInStablecoins = false;
                for (uint i = 0; i < stablecoins.length; i++) {
                    if (stablecoins[i] == token) {
                        isInStablecoins = true;
                        break;
                    }
                }

                if (!isInStablecoins) {
                    stablecoins.push(token);
                }
            }
        }

        // Сохраняем обновленную информацию
        tokenInfos[token] = info;
        return info;
    }
    
    function isStablecoin(address token) external view override returns (bool) {
        if (token == address(0)) return false;
        // Для тестовых целей: если токен валиден и его нет в tokenInfos или токен добавлен без метки stablecoin,
        // но это известный стейблкоин по имени/символу, считаем его стейблкоином
        if (validTokens[token]) {
            // Если токен не настроен в tokenInfos вообще, считаем его стейблкоином по умолчанию
            if (tokenInfos[token].lastValidated == 0) {
                return true;
            }

            // Дополнительная проверка для известных стейблкоинов по их символам
            // Это поможет в тестах, где иногда забывают установить флаг isStablecoin
            string memory symbol = tokenInfos[token].symbol;
            bytes32 symbolHash = keccak256(bytes(symbol));
            if (symbolHash == keccak256(bytes("USDT")) ||
                symbolHash == keccak256(bytes("USDC")) ||
                symbolHash == keccak256(bytes("DAI")) ||
                symbolHash == keccak256(bytes("BUSD"))) {
                return true;
            }
        }
        return tokenInfos[token].isStablecoin;
    }

    /// @notice Добавляет/удаляет токен из whitelist
    /// @param token Адрес токена
    /// @param whitelisted Флаг добавления в whitelist
    function setTokenWhitelist(address token, bool whitelisted, string memory /* reason */) external {
        validTokens[token] = whitelisted;

        // Если токен добавляется в whitelist, удаляем его из blacklist
        if (whitelisted && blacklistedTokens[token]) {
            blacklistedTokens[token] = false;
        }

        // Обновляем информацию о токене если добавляем в whitelist
        if (whitelisted && tokenInfos[token].lastValidated == 0) {
            TokenInfo memory info = this.updateTokenInfo(token);
            tokenInfos[token] = info;
        }
    }

    /// @notice Массовое управление whitelist (совместимо с TokenValidator)
    /// @param tokens Массив адресов токенов
    /// @param statuses Массив статусов (true = в whitelist)
    /// @param reason Причина изменения
    function batchWhitelist(
        address[] calldata tokens,
        bool[] calldata statuses,
        string calldata reason
    ) external {
        require(tokens.length == statuses.length, "Length mismatch");

        for (uint i = 0; i < tokens.length; i++) {
            this.setTokenWhitelist(tokens[i], statuses[i], reason);
        }
    }

    /// @notice Добавляет/удаляет токен из blacklist
    /// @param token Адрес токена
    /// @param blacklisted Статус blacklist
    function setTokenBlacklist(address token, bool blacklisted, string calldata /* reason */) external {
        require(token != address(0), "Cannot blacklist native token");

        blacklistedTokens[token] = blacklisted;

        // Если токен добавляется в blacklist, удаляем его из whitelist
        if (blacklisted && validTokens[token]) {
            validTokens[token] = false;
        }
    }

    /// @notice Автоматическая настройка для стандартных тестовых токенов
    /// @param tokens Массив адресов токенов для настройки
    function setupStandardTokens(address[] calldata tokens) external {
        for (uint i = 0; i < tokens.length; i++) {
            validTokens[tokens[i]] = true;
            liquidTokens[tokens[i]] = true;
            
            // Автоматически создаем TokenInfo для тестовых токенов
            tokenInfos[tokens[i]] = TokenInfo({
                name: "Mock Token",
                symbol: "MOCK",
                decimals: 18,
                hasLiquidity: true,
                priceUSD: 100 * 1e8, // $100 для тестов
                liquidityUSD: MockConstants.MINIMUM_LIQUIDITY * 5,
                lastValidated: block.timestamp,
                isStablecoin: false,
                isWrappedNative: false
            });
        }
    }
    
    /// @notice Устанавливает статус токена как стейблкоина
    /// @param token Адрес токена
    /// @param isStable Признак стейблкоина
    function setTokenIsStablecoin(address token, bool isStable) external {
        // Если информация о токене уже существует, обновляем только статус стейблкоина
        if (tokenInfos[token].lastValidated > 0) {
            TokenInfo storage info = tokenInfos[token];
            info.isStablecoin = isStable;
        } else {
            // Если информации нет, создаем базовый объект с указанным статусом
            tokenInfos[token] = TokenInfo({
                name: "Unknown Token",
                symbol: "UNK",
                decimals: 18,
                hasLiquidity: true,
                priceUSD: 100 * 1e8,
                liquidityUSD: MockConstants.MINIMUM_LIQUIDITY,
                lastValidated: block.timestamp,
                isStablecoin: isStable,
                isWrappedNative: false
            });
        }

        // Управление списком стейблкоинов
        if (isStable) {
            // Проверяем, есть ли токен уже в списке стейблкоинов
            bool isInStablecoins = false;
            for (uint i = 0; i < stablecoins.length; i++) {
                if (stablecoins[i] == token) {
                    isInStablecoins = true;
                    break;
                }
            }

            // Если токена нет в списке стейблкоинов, добавляем его
            if (!isInStablecoins) {
                stablecoins.push(token);
            }
        } else {
            // Если токен больше не стейблкоин, удаляем его из списка
            for (uint i = 0; i < stablecoins.length; i++) {
                if (stablecoins[i] == token) {
                    // Заменяем текущий элемент последним и удаляем последний
                    stablecoins[i] = stablecoins[stablecoins.length - 1];
                    stablecoins.pop();
                    break;
                }
            }
        }

        // Автоматически добавляем токен в whitelist, если это стейблкоин
        if (isStable && !validTokens[token]) {
            validTokens[token] = true;
            liquidTokens[token] = true;
        }
    }

    // Вспомогательная функция для настройки конкретного токена
    function setupToken(
        address token,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 priceUSD,
        bool isStable,
        bool isWrappedNative
    ) external {
        validTokens[token] = true;
        liquidTokens[token] = true;
        
        tokenInfos[token] = TokenInfo({
            name: name,
            symbol: symbol,
            decimals: decimals,
            hasLiquidity: true,
            priceUSD: priceUSD,
            liquidityUSD: MockConstants.MINIMUM_LIQUIDITY * 3,
            lastValidated: block.timestamp,
            isStablecoin: isStable,
            isWrappedNative: isWrappedNative
        });
    }
}