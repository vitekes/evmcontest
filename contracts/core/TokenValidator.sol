// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ITokenValidator.sol";

/// @title TokenValidator - Валидация токенов для платформы конкурсов
/// @notice Проверяет безопасность и ликвидность токенов перед использованием в конкурсах
/// @dev Упрощенный валидатор с явным разрешением/запретом токенов администратором
contract TokenValidator is ITokenValidator, Ownable, ReentrancyGuard {

    /*───────────────────────────  КОНСТАНТЫ  ────────────────────────────────*/

    // Максимальные лимиты для защиты от DoS атак
    uint256 public constant MAX_BATCH_SIZE = 50;

    /*───────────────────────────  STORAGE  ───────────────────────────────────*/

    // Списки токенов (основной механизм валидации)
    mapping(address => bool) public whitelistedTokens;
    mapping(address => bool) public blacklistedTokens;

    // Кешированная информация о токенах
    mapping(address => TokenInfo) public tokenInfoCache;

    // Список стейблкоинов для проверки ликвидности
    address[] public stablecoins;

    // Настройки сети
    address public immutable WRAPPED_NATIVE; // WETH, WBNB, POL и т.д.
    uint256 public immutable CHAIN_ID;

    /*───────────────────────────  EVENTS  ────────────────────────────────────*/

    event TokenWhitelisted(address indexed token, bool status, string reason);
    event TokenBlacklisted(address indexed token, bool status, string reason);
    event TokenInfoUpdated(address indexed token, TokenInfo info);
    event StablecoinUpdated(address indexed stablecoin, bool added);

    /*───────────────────────────  STRUCTS  ───────────────────────────────────*/

    // ✅ УДАЛИЛИ ДУБЛИРУЮЩИЙ STRUCT - используем из интерфейса

    /*───────────────────────────  MODIFIERS  ────────────────────────────────*/

    modifier validAddress(address addr) {
        require(addr != address(0), "Zero address not allowed");
        _;
    }

    modifier notBlacklisted(address token) {
        require(!blacklistedTokens[token], "Token is blacklisted");
        _;
    }

    /*───────────────────────────  CONSTRUCTOR  ───────────────────────────────*/

    /// @notice Инициализирует TokenValidator для конкретной сети
    /// @param _wrappedNative Адрес wrapped native токена (WETH, WBNB, POL)
    /// @param _initialStablecoins Начальный список стейблкоинов
    constructor(
        address _wrappedNative,
        address[] memory _initialStablecoins
    ) Ownable(msg.sender) validAddress(_wrappedNative) {
        WRAPPED_NATIVE = _wrappedNative;
        CHAIN_ID = block.chainid;

        // Добавляем стейблкоины
        for (uint i = 0; i < _initialStablecoins.length; i++) {
            require(_initialStablecoins[i] != address(0), "Invalid stablecoin");
            stablecoins.push(_initialStablecoins[i]);
        }

        // Автоматически добавляем ETH и wrapped native в whitelist
        whitelistedTokens[address(0)] = true; // Native ETH/BNB/MATIC
        whitelistedTokens[_wrappedNative] = true; // WETH/WBNB/POL
    }

    /*───────────────────────────  ОСНОВНЫЕ ФУНКЦИИ ВАЛИДАЦИИ  ───────────────*/

    /// @inheritdoc ITokenValidator
    function isValidToken(address token) external view override returns (bool) {
        // Native токен всегда валиден (ETH, BNB, MATIC и т.д.)
        if (token == address(0)) return true;

        // Проверяем blacklist
        if (blacklistedTokens[token]) return false;

        // Проверяем whitelist - основной механизм валидации
        if (whitelistedTokens[token]) return true;

        // Все остальные токены считаются невалидными
        return false;
    }

    /// @inheritdoc ITokenValidator
    function getTokenInfo(address token) external view override returns (TokenInfo memory) {
        if (token == address(0)) {
            return TokenInfo({
                name: _getNativeTokenName(),
                symbol: _getNativeTokenSymbol(),
                decimals: 18,
                hasLiquidity: true,
                priceUSD: 0, // Не используем цены
                liquidityUSD: type(uint256).max, // Безграничная ликвидность
                lastValidated: block.timestamp,
                isStablecoin: false,
                isWrappedNative: false
            });
        }

        // Возвращаем кешированную информацию или базовую
        TokenInfo memory info = tokenInfoCache[token];
        if (info.lastValidated == 0) {
            return _getBasicTokenInfo(token);
        }

        return info;
    }

    /// @inheritdoc ITokenValidator
    function isLiquidToken(address token) external view override returns (bool) {
        // В нашей реализации все разрешенные токены считаются ликвидными
        if (token == address(0)) return true;
        if (token == WRAPPED_NATIVE) return true;
        return whitelistedTokens[token] && !blacklistedTokens[token];
    }

    /// @inheritdoc ITokenValidator
    function getMinimumLiquidity() external pure override returns (uint256) {
        return 0; // Не используем минимальную ликвидность в этой модели
    }

    /// @notice Проверяет, равны ли две строки
    /// @param a Первая строка
    /// @param b Вторая строка
    /// @return true если строки равны
    function _equals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    /// @notice Проверяет, начинается ли строка с указанного префикса
    /// @param str Проверяемая строка
    /// @param prefix Префикс для проверки
    /// @return true если строка начинается с префикса
    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory prefixBytes = bytes(prefix);

        if (strBytes.length < prefixBytes.length) return false;

        for (uint i = 0; i < prefixBytes.length; i++) {
            if (strBytes[i] != prefixBytes[i]) return false;
        }

        return true;
    }

    /// @inheritdoc ITokenValidator
    function isStablecoin(address token) external view override returns (bool) {
        if (token == address(0)) return false;

        // Проверяем среди известных стейблкоинов
        for (uint i = 0; i < stablecoins.length; i++) {
            if (stablecoins[i] == token) return true;
        }

        // Проверяем информацию в кеше
        TokenInfo memory info = tokenInfoCache[token];
        if (info.lastValidated > 0) {
            return info.isStablecoin;
        }

        return false;
    }

    /// @notice Получает базовую информацию о токене и сохраняет её в кеш
    /// @param token Адрес токена для получения информации
    /// @return info Информация о токене
    function updateTokenInfo(address token) external nonReentrant onlyOwner returns (TokenInfo memory info) {
        if (token == address(0)) {
            info = TokenInfo({
                name: _getNativeTokenName(),
                symbol: _getNativeTokenSymbol(),
                decimals: 18,
                hasLiquidity: true,
                priceUSD: 0,
                liquidityUSD: type(uint256).max,
                lastValidated: block.timestamp,
                isStablecoin: false,
                isWrappedNative: false
            });
            return info;
        }

        // Получаем базовую информацию о токене
        info = _getBasicTokenInfo(token);
        info.lastValidated = block.timestamp;
        info.hasLiquidity = whitelistedTokens[token]; // Все токены в whitelist считаются ликвидными

        // Сохраняем информацию в кеш
        tokenInfoCache[token] = info;
        emit TokenInfoUpdated(token, info);

        return info;
    }

    /*───────────────────────────  ФУНКЦИИ АДМИНИСТРИРОВАНИЯ  ─────────────────*/

    /// @notice Добавляет/удаляет токен из whitelist
    function setTokenWhitelist(address token, bool whitelisted, string calldata reason) external onlyOwner {
        require(token != address(0) || whitelisted, "Cannot remove native token from whitelist");
        whitelistedTokens[token] = whitelisted;

        // Если токен добавляется в whitelist, удаляем его из blacklist
        if (whitelisted && blacklistedTokens[token]) {
            blacklistedTokens[token] = false;
            emit TokenBlacklisted(token, false, "Moved to whitelist");
        }

        emit TokenWhitelisted(token, whitelisted, reason);

        // Обновляем информацию о токене если добавляем в whitelist
        if (whitelisted && tokenInfoCache[token].lastValidated == 0) {
            TokenInfo memory info = _getBasicTokenInfo(token);
            info.lastValidated = block.timestamp;
            info.hasLiquidity = true;
            tokenInfoCache[token] = info;
            emit TokenInfoUpdated(token, info);
        }
    }

    /// @notice Массовое управление whitelist
    function batchWhitelist(
        address[] calldata tokens,
        bool[] calldata statuses,
        string calldata reason
    ) external onlyOwner {
        require(tokens.length == statuses.length, "Length mismatch");
        require(tokens.length <= MAX_BATCH_SIZE, "Batch too large");

        for (uint i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0) || statuses[i], "Cannot remove native token");
            whitelistedTokens[tokens[i]] = statuses[i];

            // Если токен добавляется в whitelist, удаляем его из blacklist
            if (statuses[i] && blacklistedTokens[tokens[i]]) {
                blacklistedTokens[tokens[i]] = false;
                emit TokenBlacklisted(tokens[i], false, "Moved to whitelist");
            }

            emit TokenWhitelisted(tokens[i], statuses[i], reason);
        }
    }

    /// @notice Добавляет/удаляет токен из blacklist
    function setTokenBlacklist(address token, bool blacklisted, string calldata reason) external onlyOwner {
        require(token != address(0), "Cannot blacklist native token");
        require(token != WRAPPED_NATIVE, "Cannot blacklist wrapped native");

        blacklistedTokens[token] = blacklisted;

        // Если токен добавляется в blacklist, удаляем его из whitelist
        if (blacklisted && whitelistedTokens[token]) {
            whitelistedTokens[token] = false;
            emit TokenWhitelisted(token, false, "Moved to blacklist");
        }

        emit TokenBlacklisted(token, blacklisted, reason);
    }

    /// @notice Устанавливает статус токена как стейблкоина вручную
    /// @param token Адрес токена
    /// @param isStable true если токен является стейблкоином
    function setTokenIsStablecoin(address token, bool isStable) external onlyOwner validAddress(token) {
        // Загружаем существующую информацию или создаем новую
        TokenInfo memory info = tokenInfoCache[token];

        // Обновляем статус стейблкоина
        info.isStablecoin = isStable;

        // Если это первое обновление, заполняем базовую информацию
        if (info.lastValidated == 0) {
            TokenInfo memory basicInfo = _getBasicTokenInfo(token);
            info.name = basicInfo.name;
            info.symbol = basicInfo.symbol;
            info.decimals = basicInfo.decimals;
            info.hasLiquidity = whitelistedTokens[token];
        }

        // Обновляем время валидации
        info.lastValidated = block.timestamp;

        // Сохраняем в кеш
        tokenInfoCache[token] = info;

        // Управление списком стейблкоинов
        bool exists = false;
        uint256 index = 0;
        for (uint i = 0; i < stablecoins.length; i++) {
            if (stablecoins[i] == token) {
                exists = true;
                index = i;
                break;
            }
        }

        if (isStable && !exists) {
            stablecoins.push(token);
            emit StablecoinUpdated(token, true);
        } else if (!isStable && exists) {
            stablecoins[index] = stablecoins[stablecoins.length - 1];
            stablecoins.pop();
            emit StablecoinUpdated(token, false);
        }

        emit TokenInfoUpdated(token, info);
    }

    /*───────────────────────────  VIEW FUNCTIONS  ────────────────────────────*/

    /// @notice Получает список всех стейблкоинов
    function getStablecoins() external view returns (address[] memory) {
        return stablecoins;
    }

    /// @notice Проверяет базовую информацию о токене без обновления кеша
    /// @param token Адрес токена
    /// @return Базовая информация о токене
    function checkTokenInfo(address token) external view returns (TokenInfo memory) {
        if (token == address(0)) {
            return TokenInfo({
                name: _getNativeTokenName(),
                symbol: _getNativeTokenSymbol(),
                decimals: 18,
                hasLiquidity: true,
                priceUSD: 0,
                liquidityUSD: type(uint256).max,
                lastValidated: block.timestamp,
                isStablecoin: false,
                isWrappedNative: false
            });
        }

        // Если информация уже есть в кеше, возвращаем её
        TokenInfo memory cached = tokenInfoCache[token];
        if (cached.lastValidated > 0) {
            return cached;
        }

        // Иначе получаем базовую информацию
        return _getBasicTokenInfo(token);
    }

    /*───────────────────────────  INTERNAL FUNCTIONS  ────────────────────────*/

    /// @dev Базовая проверка валидности ERC20 токена
    function _isBasicValidERC20(address token) internal view returns (bool) {
        if (token.code.length == 0) return false;

        try IERC20Metadata(token).name() returns (string memory) {
            try IERC20Metadata(token).symbol() returns (string memory) {
                try IERC20Metadata(token).decimals() returns (uint8) {
                    return true;
                } catch {
                    return false;
                }
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }

    /// @dev Получает базовую информацию о токене
    function _getBasicTokenInfo(address token) internal view returns (TokenInfo memory) {
        try IERC20Metadata(token).name() returns (string memory name) {
            try IERC20Metadata(token).symbol() returns (string memory symbol) {
                try IERC20Metadata(token).decimals() returns (uint8 decimals) {
                    // Проверяем, является ли токен стейблкоином по списку
                    bool isStable = _isStablecoin(token);

                    return TokenInfo({
                        name: name,
                        symbol: symbol,
                        decimals: decimals,
                        hasLiquidity: whitelistedTokens[token], // В нашей модели ликвидные токены - это whitelisted токены
                        priceUSD: 0, // Не используем цены
                        liquidityUSD: 0, // Не используем ликвидность
                        lastValidated: 0,
                        isStablecoin: isStable,
                        isWrappedNative: token == WRAPPED_NATIVE
                    });
                } catch {
                    return _getEmptyTokenInfo();
                }
            } catch {
                return _getEmptyTokenInfo();
            }
        } catch {
            return _getEmptyTokenInfo();
        }
    }

    /// @dev Получает пустую информацию о токене для ошибок
    function _getEmptyTokenInfo() internal pure returns (TokenInfo memory) {
        return TokenInfo({
            name: "",
            symbol: "",
            decimals: 0,
            hasLiquidity: false,
            priceUSD: 0,
            liquidityUSD: 0,
            lastValidated: 0,
            isStablecoin: false,
            isWrappedNative: false
        });
    }

    /// @dev Проверяет, является ли токен стейблкоином
    function _isStablecoin(address token) internal view returns (bool) {
        for (uint i = 0; i < stablecoins.length; i++) {
            if (stablecoins[i] == token) return true;
        }
        return false;
    }

    /// @dev Получает название нативного токена для текущей сети
    function _getNativeTokenName() internal view returns (string memory) {
        if (CHAIN_ID == 1 || CHAIN_ID == 11155111) return "Ethereum";
        if (CHAIN_ID == 56) return "Binance Coin";
        if (CHAIN_ID == 137) return "Polygon";
        if (CHAIN_ID == 42161) return "Ethereum";
        if (CHAIN_ID == 10) return "Ethereum";
        return "Native Token";
    }

    /// @dev Получает символ нативного токена для текущей сети
    function _getNativeTokenSymbol() internal view returns (string memory) {
        if (CHAIN_ID == 1 || CHAIN_ID == 11155111) return "ETH";
        if (CHAIN_ID == 56) return "BNB";
        if (CHAIN_ID == 137) return "MATIC";
        if (CHAIN_ID == 42161) return "ETH";
        if (CHAIN_ID == 10) return "ETH";
        return "NATIVE";
    }
}