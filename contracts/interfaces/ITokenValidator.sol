// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITokenValidator {
    struct TokenInfo {
        string name;
        string symbol;
        uint8 decimals;
        bool hasLiquidity;
        uint256 priceUSD; // цена в USD с 8 знаками после запятой
        uint256 liquidityUSD; // ликвидность в USD
        uint256 lastValidated;
        bool isStablecoin;
        bool isWrappedNative;
    }
    
    function isValidToken(address token) external view returns (bool);
    function getTokenInfo(address token) external view returns (TokenInfo memory);
    function isLiquidToken(address token) external view returns (bool);
    function getMinimumLiquidity() external view returns (uint256);
    function isStablecoin(address token) external view returns (bool);
}