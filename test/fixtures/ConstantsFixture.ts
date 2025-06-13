// ==========================================
// 📋 КОНСТАНТЫ И КОНФИГУРАЦИИ
// ==========================================

import { ethers } from "hardhat";

export const TEST_CONSTANTS = {
    // Временные параметры
    MIN_CONTEST_DURATION: 3600, // 1 час
    DEFAULT_START_DELAY: 3600,   // 1 час
    DEFAULT_DURATION: 86400,     // 24 часа
    
    // Призовые фонды
    SMALL_PRIZE: ethers.parseEther("1.0"),
    MEDIUM_PRIZE: ethers.parseEther("10.0"),
    LARGE_PRIZE: ethers.parseEther("100.0"),
    
    // Комиссии
    DEFAULT_FEE_BP: 200, // 2%
    HIGH_FEE_BP: 500,    // 5%
    
    // Токены
    USDC_DECIMALS: 6,
    USDT_DECIMALS: 6,
    WETH_DECIMALS: 18
} as const;

export const CONTEST_TEMPLATES = {
    WINNER_TAKES_ALL: 0,
    TOP_2: 1,
    TOP_3: 2,
    TOP_5: 3
} as const;

export const PRIZE_TYPES = {
    MONETARY: 0,
    PROMOCODE: 1,
    PRIVILEGE: 2,
    NFT: 3,
    EXTERNAL: 4
} as const;

export const NETWORK_IDS = {
    LOCALHOST: 31337,
    ETHEREUM: 1,
    POLYGON: 137,
    BSC: 56
} as const;