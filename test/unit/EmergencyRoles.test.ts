import { expect } from "chai";
import { ethers } from "hardhat";
import { ContestEscrow, NetworkFeeManager } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Emergency Roles Unit Tests", function () {
    let escrow: ContestEscrow;
    let feeManager: NetworkFeeManager;
    
    let admin: SignerWithAddress;
    let creator: SignerWithAddress;
    let jury: SignerWithAddress;
    let treasury: SignerWithAddress;
    let emergencyUser1: SignerWithAddress;
    let emergencyUser2: SignerWithAddress;
    let maliciousUser: SignerWithAddress;

    const EMERGENCY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EMERGENCY_ROLE"));
    const JURY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("JURY_ROLE"));
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

    beforeEach(async function () {
        [admin, creator, jury, treasury, emergencyUser1, emergencyUser2, maliciousUser] = await ethers.getSigners();

        // Deploy NetworkFeeManager
        const NetworkFeeManagerFactory = await ethers.getContractFactory("NetworkFeeManager");
        feeManager = await NetworkFeeManagerFactory.deploy(treasury.address);

        // Deploy ContestEscrow
        const ContestEscrowFactory = await ethers.getContractFactory("ContestEscrow");
        escrow = await ContestEscrowFactory.deploy();

        // Initialize escrow with test contest
        const contestParams = {
            creator: creator.address,
            token: ethers.ZeroAddress, // ETH
            totalPrize: ethers.parseEther("1.0"),
            distribution: [{
                place: 1,
                percentage: 10000, // 100%
                description: "Winner Takes All"
            }],
            jury: [jury.address],
            treasury: treasury.address,
            contestId: 1,
            startTime: await time.latest() + 3600,
            endTime: await time.latest() + 86400,
            metadata: "Test contest"
        };

        await escrow.init(contestParams, { value: ethers.parseEther("1.0") });
    });

    describe("🛡️ Role Hierarchy and Permissions", function () {
        it("✅ Should properly set initial roles", async function () {
            // Check admin role for creator (creator gets DEFAULT_ADMIN_ROLE)
            expect(await escrow.hasRole(DEFAULT_ADMIN_ROLE, creator.address)).to.be.true;
            
            // Check jury role
            expect(await escrow.hasRole(JURY_ROLE, jury.address)).to.be.true;
            
            // Check emergency role for factory
            // В тесте admin используется вместо factory
            expect(await escrow.hasEmergencyRole(admin.address)).to.be.true;
        });

        it("✅ Should allow admin to grant emergency roles", async function () {
            await expect(
                escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address)
            ).to.emit(escrow, "RoleGranted")
             .withArgs(EMERGENCY_ROLE, emergencyUser1.address, creator.address);

            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.true;
        });

        it("❌ Should prevent non-admin from granting emergency roles", async function () {
            await expect(
                escrow.connect(jury).grantRole(EMERGENCY_ROLE, emergencyUser1.address)
            ).to.be.reverted;

            await expect(
                escrow.connect(maliciousUser).grantRole(EMERGENCY_ROLE, emergencyUser1.address)
            ).to.be.reverted;
        });

        it("✅ Should allow admin to revoke emergency roles", async function () {
            // First grant the role
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.true;

            // Then revoke it
            await expect(
                escrow.connect(creator).revokeRole(EMERGENCY_ROLE, emergencyUser1.address)
            ).to.emit(escrow, "RoleRevoked")
             .withArgs(EMERGENCY_ROLE, emergencyUser1.address, creator.address);

            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.false;
        });

        it("✅ Should allow revoking and re-granting roles", async function () {
            // Тест для проверки возможности отозвать и затем вернуть роль
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.true;
            
            await escrow.connect(creator).revokeRole(EMERGENCY_ROLE, emergencyUser1.address);
            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.false;
            
            // Можем повторно выдать роль
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.true;
        });
    });

    describe("⏰ Emergency Operations", function () {
        beforeEach(async function () {
            // Grant emergency role to test user
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            
            // Теперь emergencyWithdraw() будет вызываться через factory (в нашем тесте - admin)
            // так как в ContestEscrow есть модификатор onlyFactory
        });

        it("✅ Should allow emergency withdrawal by factory", async function () {
            // Имитируем окончание конкурса
            const contestInfo = await escrow.getContestInfo();
            const endTime = contestInfo[3]; // endTime is 4th element
            await time.increaseTo(Number(endTime) + 1);
            
            // Выполняем экстренный вывод средств
            await expect(
                escrow.connect(admin).emergencyWithdraw("Valid emergency")
            ).to.emit(escrow, "EmergencyWithdrawal");
        });

        it("❌ Should prevent unauthorized emergency withdrawals", async function () {
            // Пользователь с emergency ролью не может вызвать emergencyWithdraw напрямую
            // из-за модификатора onlyFactory
            await expect(
                escrow.connect(emergencyUser1).emergencyWithdraw("Unauthorized")
            ).to.be.revertedWith("Only factory can call this");
        });

        it("✅ Should handle multiple emergency roles correctly", async function () {
            // Добавляем второго пользователя с emergency ролью
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser2.address);
            
            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.true;
            expect(await escrow.hasEmergencyRole(emergencyUser2.address)).to.be.true;
            
            // Проверяем, что обе роли действительны
            const canEmergency1 = await escrow.hasEmergencyRole(emergencyUser1.address);
            const canEmergency2 = await escrow.hasEmergencyRole(emergencyUser2.address);
            
            expect(canEmergency1 && canEmergency2).to.be.true;
        });
    });

    describe("🔄 Role Renunciation", function () {
        it("✅ Should allow role renunciation", async function () {
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            
            // Пользователь может отказаться от своей роли
            await expect(
                escrow.connect(emergencyUser1).renounceRole(EMERGENCY_ROLE, emergencyUser1.address)
            ).to.emit(escrow, "RoleRevoked")
             .withArgs(EMERGENCY_ROLE, emergencyUser1.address, emergencyUser1.address);

            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.false;
        });

        it("❌ Should prevent renouncing others' roles", async function () {
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            
            // Пользователь не может отказаться от чужой роли
            await expect(
                escrow.connect(emergencyUser1).renounceRole(EMERGENCY_ROLE, emergencyUser2.address)
            ).to.be.reverted;
        });
    });

    describe("🛡️ Role Security", function () {
        it("❌ Should prevent role escalation attacks", async function () {
            // Выдаем emergency роль
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            
            // Пользователь с emergency ролью не должен иметь возможность выдавать admin роли
            await expect(
                escrow.connect(emergencyUser1).grantRole(DEFAULT_ADMIN_ROLE, maliciousUser.address)
            ).to.be.reverted;
        });

        it("🔒 Should maintain role integrity across operations", async function () {
            // Выдаем роль
            await escrow.connect(creator).grantRole(EMERGENCY_ROLE, emergencyUser1.address);
            
            // Выполняем другие операции
            await time.increase(1000);
            
            // Роль должна сохраниться
            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.true;
            
            // Отзываем роль
            await escrow.connect(creator).revokeRole(EMERGENCY_ROLE, emergencyUser1.address);
            
            // Роль должна быть отозвана
            expect(await escrow.hasEmergencyRole(emergencyUser1.address)).to.be.false;
        });
    });
});