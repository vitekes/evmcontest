// ==========================================
// 🔐 ХЕЛПЕРЫ ДЛЯ ТЕСТИРОВАНИЯ БЕЗОПАСНОСТИ
// ==========================================

import { expect } from "chai";
import { ethers } from "hardhat";

// Убираем проблемную функцию testReentrancy, так как она требует специальный малицевый контракт

export async function testOverflow(
    contract: any,
    methodName: string,
    args: any[] = [],
    maxValue: bigint = ethers.MaxUint256
): Promise<void> {
    const method = (contract as any)[methodName];
    if (typeof method !== 'function') {
        throw new Error(`Method ${methodName} not found on contract`);
    }
    
    // Заменяем последний аргумент на максимальное значение
    const testArgs = [...args];
    testArgs[testArgs.length - 1] = maxValue;
    
    await expect(
        method(...testArgs)
    ).to.be.revertedWithPanic(0x11); // Overflow panic code
}

export async function testUnauthorizedAccess(
    contract: any,
    methodName: string,
    unauthorizedSigner: any,
    args: any[] = [],
    expectedError: string = "OwnableUnauthorizedAccount"
): Promise<void> {
    const method = (contract.connect(unauthorizedSigner) as any)[methodName];
    if (typeof method !== 'function') {
        throw new Error(`Method ${methodName} not found on contract`);
    }
    
    await expect(
        method(...args)
    ).to.be.revertedWithCustomError(contract, expectedError);
}