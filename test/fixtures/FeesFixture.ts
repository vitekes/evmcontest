
// ==========================================
// 💰 ФИКСТУРЫ ДЛЯ КОМИССИЙ
// ==========================================

import { ethers } from "hardhat";
import { NetworkFeeManager } from "../../typechain-types";
import { setupTestAccounts } from "./BaseFixture";
import { NETWORK_IDS, TEST_CONSTANTS } from "./ConstantsFixture";

export async function deployNetworkFeeManagerFixture() {
    console.log("💰 Deploying NetworkFeeManager for fee tests...");
    
    const accounts = await setupTestAccounts();

    const NetworkFeeManagerFactory = await ethers.getContractFactory("NetworkFeeManager");
    const feeManager = await NetworkFeeManagerFactory.deploy(accounts.treasury.address);
    await feeManager.waitForDeployment();

    // Настройка стандартных комиссий для разных сетей
    await feeManager.setNetworkFee(NETWORK_IDS.ETHEREUM, 200);   // 2% для Ethereum Mainnet
    await feeManager.setNetworkFee(NETWORK_IDS.POLYGON, 100);    // 1% для Polygon
    await feeManager.setNetworkFee(NETWORK_IDS.LOCALHOST, 200); // 2% для локальной сети

    console.log("✅ NetworkFeeManager deployed successfully!");

    return {
        feeManager: feeManager as NetworkFeeManager,
        ...accounts,
        addresses: {
            feeManager: await feeManager.getAddress()
        }
    };
}