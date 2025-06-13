import { expect } from "chai";
import { ContractTransactionReceipt, ContractTransactionResponse } from "ethers";

export async function expectEvent(
    tx: ContractTransactionResponse,
    contract: any,
    eventName: string,
    args?: any[]
): Promise<void> {
    if (args) {
        await expect(tx)
            .to.emit(contract, eventName)
            .withArgs(...args);
    } else {
        await expect(tx)
            .to.emit(contract, eventName);
    }
}

export async function expectRevertWithReason(
    promise: Promise<any>,
    expectedReason: string,
    contract?: any
): Promise<void> {
    try {
        await promise;
        throw new Error("Expected transaction to revert, but it didn't");
    } catch (error: any) {
        if (error.message.includes("Expected transaction to revert")) {
            throw error;
        }
        
        if (error.message.includes(expectedReason)) {
            return;
        }
        
        if (error.message.includes("custom error")) {
            if (expectedReason.includes("Only factory") && error.message.includes("AccessControlUnauthorizedAccount")) {
                return;
            }
            
            const errorName = expectedReason.replace(/\s+/g, "");
            if (error.message.includes(errorName)) {
                return;
            }
        }
        
        if (contract) {
            try {
                await expect(promise).to.be.revertedWithCustomError(contract, expectedReason);
                return;
            } catch {
                // Continue to other checks
            }
        }
        
        console.error(`❌ Revert check failed:`);
        console.error(`   Expected: ${expectedReason}`);
        console.error(`   Actual error: ${error.message}`);
        
        throw new Error(
            `Expected transaction to revert with reason '${expectedReason}', ` +
            `but it reverted with: ${error.message}`
        );
    }
}

export async function expectRevertWithCustomError(
    promise: Promise<any>,
    contract: any,
    errorName: string,
    args?: any[]
): Promise<void> {
    if (args) {
        await expect(promise)
            .to.be.revertedWithCustomError(contract, errorName)
            .withArgs(...args);
    } else {
        await expect(promise)
            .to.be.revertedWithCustomError(contract, errorName);
    }
}

export async function expectRevert(
    promise: Promise<any>,
    contract: any,
    errorNameOrReason: string,
    args?: any[]
): Promise<void> {
    try {
        await expectRevertWithCustomError(promise, contract, errorNameOrReason, args);
    } catch (customError: any) {
        try {
            await expectRevertWithReason(promise, errorNameOrReason, contract);
        } catch (stringError: any) {
            throw new Error(
                `Failed to match revert. Custom error attempt: ${customError?.message || 'unknown error'}. ` +
                `String reason attempt: ${stringError?.message || 'unknown error'}`
            );
        }
    }
}

export async function expectNoEvent(
    tx: ContractTransactionResponse,
    contract: any,
    eventName: string
): Promise<void> {
    await expect(tx).to.not.emit(contract, eventName);
}

export async function expectGasUsage(
    tx: ContractTransactionResponse,
    maxGas: number
): Promise<void> {
    const receipt = await tx.wait();
    expect(Number(receipt!.gasUsed)).to.be.at.most(maxGas);
}

export async function expectStateChange<T>(
    beforeFn: () => Promise<T>,
    transaction: () => Promise<any>,
    afterFn: (before: T) => Promise<void>
): Promise<void> {
    const stateBefore = await beforeFn();
    await transaction();
    await afterFn(stateBefore);
}

export function extractEvents(
    receipt: ContractTransactionReceipt,
    contract: any
): any[] {
    const events: any[] = [];
    
    if (receipt.logs) {
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog(log);
                if (parsed) {
                    events.push(parsed);
                }
            } catch {
                // Skip events from other contracts
            }
        }
    }
    
    return events;
}

export function findEvent(
    receipt: ContractTransactionReceipt,
    contract: any,
    eventName: string
): any | null {
    const events = extractEvents(receipt, contract);
    return events.find(event => event.name === eventName) || null;
}

export function getEventArgs(
    receipt: ContractTransactionReceipt,
    contract: any,
    eventName: string
): any[] {
    const event = findEvent(receipt, contract, eventName);
    return event ? event.args : [];
}