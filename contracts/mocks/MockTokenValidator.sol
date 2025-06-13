// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/ITokenValidator.sol";
import "./MockConstants.sol";

contract MockTokenValidator is ITokenValidator {
    // Метод для определения, что это мок-реализация
    function isMockTokenValidator() external pure returns (bool) {
        return true;
    }
    mapping(address => bool) public validTokens;
    mapping(address => bool) public liquidTokens;
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
        return liquidTokens[token];
    }
    
    function getMinimumLiquidity() external pure override returns (uint256) {
        return MockConstants.MINIMUM_LIQUIDITY;
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