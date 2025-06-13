// ==========================================
// 🏗️ БАЗОВЫЕ УТИЛИТЫ И АККАУНТЫ
// ==========================================

import { ethers } from "hardhat";

export async function setupTestAccounts() {
    const signers = await ethers.getSigners();

    if (signers.length < 13) {
        throw new Error(`Not enough signers available. Need 13, got ${signers.length}`);
    }
    
    const [
        owner, 
        creator1, 
        creator2, 
        jury1, 
        jury2, 
        jury3,
        winner1, 
        winner2, 
        winner3,
        participant1,
        participant2,
        treasury,
        maliciousUser
    ] = signers;

    console.log("🔑 Test accounts setup:");
    console.log(`   Owner: ${owner.address}`);
    console.log(`   Creator1: ${creator1.address}`);
    console.log(`   Treasury: ${treasury.address}`);

    // Обеспечиваем достаточные балансы ETH
    const requiredBalance = ethers.parseEther("5000"); // Увеличиваем до 5000 ETH
    const accounts = [creator1, creator2, participant1, participant2, winner1, winner2, winner3];
    
    for (const account of accounts) {
        const balance = await ethers.provider.getBalance(account.address);
        if (balance < requiredBalance) {
            const tx = await owner.sendTransaction({
                to: account.address,
                value: requiredBalance - balance
            });
            await tx.wait();
        }
    }

    return {
        owner,
        creator1,
        creator2,
        jury1,
        jury2,
        jury3,
        winner1,
        winner2,
        winner3,
        participant1,
        participant2,
        treasury,
        maliciousUser
    };
}