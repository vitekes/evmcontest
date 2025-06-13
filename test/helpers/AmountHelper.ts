// ==========================================
// 💰 ХЕЛПЕРЫ ДЛЯ РАБОТЫ С СУММАМИ ТОКЕНОВ
// ==========================================

import { ethers } from "hardhat";

/**
 * ✅ Конвертирует сумму с учетом decimals токена
 * @param amount Сумма в основных единицах
 * @param decimals Количество decimals
 * @returns Сумма в токен-юнитах (wei, satoshi и т.д.)
 */
export function toTokenUnits(amount: number, decimals: number): bigint {
    if (amount < 0) {
        throw new Error("Amount cannot be negative");
    }
    return BigInt(Math.floor(amount * 10 ** decimals));
}

/**
 * ✅ Конвертирует сумму из токен units в читаемый формат
 * @param amount Сумма в токен units
 * @param decimals Количество decimals
 * @returns Сумма в основных единицах (например, ETH вместо wei)
 */
export function fromTokenUnits(amount: bigint, decimals: number): number {
    const divisor = 10 ** decimals;
    return Number(amount) / divisor;
}

/**
 * ✅ Форматирует сумму с заданным количеством десятичных знаков
 * @param amount Сумма для форматирования
 * @param decimals Количество decimals токена
 * @param displayDecimals Количество отображаемых десятичных знаков
 * @returns Отформатированная строка
 */
export function formatTokenAmount(amount: bigint, decimals: number, displayDecimals: number = 2): string {
    const value = fromTokenUnits(amount, decimals);
    return value.toFixed(displayDecimals);
}

/**
 * ✅ Получает информацию о токене из контракта
 * @param tokenContract Контракт токена
 * @returns Объект с информацией о токене
 */
export async function getTokenInfo(tokenContract: any) {
    const [name, symbol, decimals, address] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.getAddress()
    ]);

    return { name, symbol, decimals, address };
}
