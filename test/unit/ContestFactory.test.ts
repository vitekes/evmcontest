import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { 
    TEST_CONSTANTS, 
    CONTEST_TEMPLATES, 
    deployFullPlatformFixture 
} from "../fixtures";

describe("ContestFactory", function() {
    this.timeout(60000);

    async function createBasicContest(
        fixture: any,
        creator: any,
        options: any = {}
    ) {
        const now = await time.latest();
        
        const contestParams = {
            token: options.token || ethers.ZeroAddress,
            totalPrize: options.totalPrize || ethers.parseEther("1"),
            template: options.template || CONTEST_TEMPLATES.WINNER_TAKES_ALL,
            customDistribution: options.customDistribution || [],
            jury: options.jury || [],
            startTime: BigInt(now + 3600),
            endTime: BigInt(now + 7200),
            contestMetadata: options.contestMetadata || "Test contest",
            hasNonMonetaryPrizes: options.hasNonMonetaryPrizes || false
        };

        const platformFee = await fixture.feeManager.calculateFee(31337, contestParams.totalPrize);
        let value = 0n;

        if (contestParams.token === ethers.ZeroAddress) {
            value = contestParams.totalPrize + platformFee;
        } else {
            const tokenContract = await ethers.getContractAt("MockERC20", contestParams.token);
            const totalRequired = contestParams.totalPrize + platformFee;
            await tokenContract.mint(creator.address, totalRequired);
            await tokenContract.connect(creator).approve(
                await fixture.contestFactory.getAddress(),
                totalRequired
            );
        }

        const tx = await fixture.contestFactory.connect(creator)
            .createContest(contestParams, { value });

        const receipt = await tx.wait();
        const event = receipt!.logs.find((log: any) => {
            try {
                const parsed = fixture.contestFactory.interface.parseLog(log);
                return parsed?.name === "ContestCreated";
            } catch {
                return false;
            }
        });

        const parsed = fixture.contestFactory.interface.parseLog(event!);
        return {
            contestId: parsed!.args.contestId,
            escrowAddress: parsed!.args.escrow,
            transaction: tx,
            receipt
        };
    }

    describe("Constructor and Initial State", function() {
        it("should initialize with correct parameters", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            expect(await fixture.contestFactory.owner()).to.equal(fixture.owner.address);
            expect(await fixture.contestFactory.lastId()).to.equal(0);
            expect(await fixture.contestFactory.getEscrowsCount()).to.equal(0);
            expect(await fixture.contestFactory.emergencyStop()).to.be.false;
        });

        it("should set immutable addresses correctly", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            expect(await fixture.contestFactory.escrowImpl()).to.not.equal(ethers.ZeroAddress);
            expect(await fixture.contestFactory.feeManager()).to.equal(await fixture.feeManager.getAddress());
            expect(await fixture.contestFactory.prizeTemplates()).to.equal(await fixture.prizeTemplates.getAddress());
        });
    });

    describe("Contest Creation - Basic Functionality", function() {
        it("should create ETH contest and increment counters", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const initialCount = await fixture.contestFactory.getEscrowsCount();
            const initialLastId = await fixture.contestFactory.lastId();

            const result = await createBasicContest(fixture, fixture.creator1);

            expect(result.contestId).to.equal(initialLastId);
            expect(await fixture.contestFactory.lastId()).to.equal(initialLastId + 1n);
            expect(await fixture.contestFactory.getEscrowsCount()).to.equal(initialCount + 1n);
            expect(result.escrowAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("should create ERC20 contest", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const result = await createBasicContest(
                fixture,
                fixture.creator1,
                { token: await fixture.mockUSDC.getAddress() }
            );

            expect(result.contestId).to.be.at.least(0);
            expect(result.escrowAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("should store escrow addresses in array", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const result = await createBasicContest(fixture, fixture.creator1);
            const escrowsCount = await fixture.contestFactory.getEscrowsCount();
            const storedEscrow = await fixture.contestFactory.getEscrow(escrowsCount - 1n);

            expect(storedEscrow).to.equal(result.escrowAddress);
        });

        it("should generate unique contest IDs", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const contest1 = await createBasicContest(fixture, fixture.creator1);
            await time.increase(3601); // Wait for anti-spam
            const contest2 = await createBasicContest(fixture, fixture.creator1);

            expect(contest2.contestId).to.equal(contest1.contestId + 1n);
        });
    });

    describe("Parameter Validation", function() {
        it("should reject zero prize", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();

            const contestParams = {
                token: ethers.ZeroAddress,
                totalPrize: 0n, // Явно ноль
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now + 3600),
                endTime: BigInt(now + 7200),
                contestMetadata: "Test contest",
                hasNonMonetaryPrizes: false
            };

            await expect(
                fixture.contestFactory.connect(fixture.creator1)
                    .createContest(contestParams, { value: 0 })
            ).to.be.revertedWith("Prize must be positive");
        });

        it("should reject start time in past", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();

            const contestParams = {
                token: ethers.ZeroAddress,
                totalPrize: ethers.parseEther("1"),
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now - 1000), 
                endTime: BigInt(now + 3600),
                contestMetadata: "Test contest",
                hasNonMonetaryPrizes: false
            };

            const platformFee = await fixture.feeManager.calculateFee(31337, contestParams.totalPrize);

            await expect(
                fixture.contestFactory.connect(fixture.creator1)
                    .createContest(contestParams, { value: contestParams.totalPrize + platformFee })
            ).to.be.reverted;
        });

        it("should reject end time before start time", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();

            const contestParams = {
                token: ethers.ZeroAddress,
                totalPrize: ethers.parseEther("1"),
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now + 3600),
                endTime: BigInt(now + 1800), // Before start time
                contestMetadata: "Test contest",
                hasNonMonetaryPrizes: false
            };

            const platformFee = await fixture.feeManager.calculateFee(31337, contestParams.totalPrize);

            await expect(
                fixture.contestFactory.connect(fixture.creator1)
                    .createContest(contestParams, { value: contestParams.totalPrize + platformFee })
            ).to.be.reverted;
        });

        it("should reject contest duration too short", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();

            const contestParams = {
                token: ethers.ZeroAddress,
                totalPrize: ethers.parseEther("1"),
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now + 3600),
                endTime: BigInt(now + 3600 + 1800), // Only 30 minutes
                contestMetadata: "Test contest",
                hasNonMonetaryPrizes: false
            };

            const platformFee = await fixture.feeManager.calculateFee(31337, contestParams.totalPrize);

            await expect(
                fixture.contestFactory.connect(fixture.creator1)
                    .createContest(contestParams, { value: contestParams.totalPrize + platformFee })
            ).to.be.reverted;
        });
    });

    describe("Anti-Spam Protection", function() {
        it("should enforce minimum interval between contests", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            await createBasicContest(fixture, fixture.creator1);

            await expect(
                createBasicContest(fixture, fixture.creator1)
            ).to.be.revertedWithCustomError(
                fixture.contestFactory,
                "WaitBetweenContests"
            );
        });

        it("should allow contest creation after interval", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            await createBasicContest(fixture, fixture.creator1);
            await time.increase(3601); // 1 hour + 1 second
            await createBasicContest(fixture, fixture.creator1);
        });

        it("should track last contest time per creator", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const timeBefore = await fixture.contestFactory.lastContestTime(fixture.creator1.address);
            await createBasicContest(fixture, fixture.creator1);
            const timeAfter = await fixture.contestFactory.lastContestTime(fixture.creator1.address);

            expect(timeAfter).to.be.greaterThan(timeBefore);
        });
    });

    describe("Payment Handling", function() {
        it("should handle exact ETH payment", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const prize = ethers.parseEther("1");
            const platformFee = await fixture.feeManager.calculateFee(31337, prize);
            const exactAmount = prize + platformFee;

            const result = await createBasicContest(
                fixture,
                fixture.creator1,
                { totalPrize: prize }
            );

            expect(result.contestId).to.be.at.least(0);
        });

        it("should refund excess ETH", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();
            const prize = ethers.parseEther("1");
            const platformFee = await fixture.feeManager.calculateFee(31337, prize);
            const excess = ethers.parseEther("0.1");

            const contestParams = {
                token: ethers.ZeroAddress,
                totalPrize: prize,
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now + 3600),
                endTime: BigInt(now + 7200),
                contestMetadata: "Test contest",
                hasNonMonetaryPrizes: false
            };

            const tx = await fixture.contestFactory.connect(fixture.creator1)
                .createContest(contestParams, { value: prize + platformFee + excess });

            await expect(tx)
                .to.emit(fixture.contestFactory, "ExcessRefunded")
                .withArgs(fixture.creator1.address, excess);
        });

        it("should reject insufficient ETH", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();
            const prize = ethers.parseEther("1");
            const platformFee = await fixture.feeManager.calculateFee(31337, prize);
            const insufficient = prize + platformFee - ethers.parseEther("0.001");

            const contestParams = {
                token: ethers.ZeroAddress,
                totalPrize: prize,
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now + 3600),
                endTime: BigInt(now + 7200),
                contestMetadata: "Test contest",
                hasNonMonetaryPrizes: false
            };

            await expect(
                fixture.contestFactory.connect(fixture.creator1)
                    .createContest(contestParams, { value: insufficient })
            ).to.be.revertedWith("Insufficient ETH");
        });

        it("should reject ETH for ERC20 contests", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();

            const contestParams = {
                token: await fixture.mockUSDC.getAddress(),
                totalPrize: ethers.parseEther("100"),
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now + 3600),
                endTime: BigInt(now + 7200),
                contestMetadata: "Test contest",
                hasNonMonetaryPrizes: false
            };

            await expect(
                fixture.contestFactory.connect(fixture.creator1)
                    .createContest(contestParams, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("No ETH needed for ERC20 contest");
        });
    });

    describe("Events", function() {
        it("should emit ContestCreated event with correct parameters", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const prize = ethers.parseEther("1");
            const expectedFee = await fixture.feeManager.calculateFee(31337, prize);

            // Получаем время ДО создания конкурса
            const now = await time.latest();
            const expectedStartTime = BigInt(now + 3600);
            const expectedEndTime = BigInt(now + 7200);

            const result = await createBasicContest(fixture, fixture.creator1, { totalPrize: prize });

            await expect(result.transaction)
                .to.emit(fixture.contestFactory, "ContestCreated")
                .withArgs(
                    result.contestId,
                    fixture.creator1.address,
                    result.escrowAddress,
                    ethers.ZeroAddress,
                    prize,
                    expectedFee,
                    CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                    expectedStartTime,
                    expectedEndTime
                );
        });

        it("should emit NetworkWarning for high fee networks", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            // Set high fee for current network
            await fixture.feeManager.connect(fixture.owner).setNetworkFee(31337, 1500); // 15%

            const result = await createBasicContest(fixture, fixture.creator1);

            await expect(result.transaction)
                .to.emit(fixture.contestFactory, "NetworkWarning");
        });
    });

    describe("Access Control", function() {
        it("should allow anyone to create contests", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            await createBasicContest(fixture, fixture.creator1);
            await time.increase(3601);
            await createBasicContest(fixture, fixture.participant1);
        });

        it("should reject banned creators", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            await fixture.feeManager.connect(fixture.owner)
                .banCreator(fixture.creator1.address, "Test ban");

            await expect(
                createBasicContest(fixture, fixture.creator1)
            ).to.be.revertedWith("Creator is banned");
        });

        it("should only allow owner to set emergency stop", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            await expect(
                fixture.contestFactory.connect(fixture.creator1).setEmergencyStop(true)
            ).to.be.reverted;

            await fixture.contestFactory.connect(fixture.owner).setEmergencyStop(true);
            expect(await fixture.contestFactory.emergencyStop()).to.be.true;
        });

        it("should block creation during emergency stop", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            await fixture.contestFactory.connect(fixture.owner).setEmergencyStop(true);

            await expect(
                createBasicContest(fixture, fixture.creator1)
            ).to.be.revertedWith("Factory in emergency mode");
        });
    });

    describe("View Functions", function() {
        it("should return correct contest info", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const result = await createBasicContest(fixture, fixture.creator1);
            const [escrowAddr, exists] = await fixture.contestFactory.getContestInfo(result.contestId);

            expect(exists).to.be.true;
            expect(escrowAddr).to.equal(result.escrowAddress);
        });

        it("should return false for non-existent contests", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const [escrowAddr, exists] = await fixture.contestFactory.getContestInfo(999999n);
            expect(exists).to.be.false;
            expect(escrowAddr).to.equal(ethers.ZeroAddress);
        });

        it("should provide escrow access by index", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const result = await createBasicContest(fixture, fixture.creator1);
            const escrowsCount = await fixture.contestFactory.getEscrowsCount();
            const lastEscrow = await fixture.contestFactory.getEscrow(escrowsCount - 1n);

            expect(lastEscrow).to.equal(result.escrowAddress);
        });

        it("should revert for invalid escrow index", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const escrowsCount = await fixture.contestFactory.getEscrowsCount();
            await expect(
                fixture.contestFactory.getEscrow(escrowsCount + 1n)
            ).to.be.reverted;
        });
    });

    describe("Emergency Functions", function() {
        it("should provide emergency info for existing contests", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const result = await createBasicContest(fixture, fixture.creator1);
            
            // Перематываем время, чтобы конкурс закончился
            await time.increaseTo((await time.latest()) + 7201); // endTime + 1 second
            
            const emergencyInfo = await fixture.contestFactory.getEscrowEmergencyInfo(result.contestId);

            expect(emergencyInfo.escrowAddress).to.equal(result.escrowAddress);
            expect(emergencyInfo.canEmergencyWithdraw).to.be.a('boolean');
            expect(emergencyInfo.isStale).to.be.a('boolean');
            expect(emergencyInfo.daysSinceEnd).to.be.a('bigint');
        });

        it("should revert emergency info for non-existent contests", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            await expect(
                fixture.contestFactory.getEscrowEmergencyInfo(999999n)
            ).to.be.revertedWith("Contest does not exist");
        });

        it("should only allow owner to emergency withdraw", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const result = await createBasicContest(fixture, fixture.creator1);

            await expect(
                fixture.contestFactory.connect(fixture.creator1)
                    .emergencyWithdrawFromEscrow(result.contestId, "Unauthorized")
            ).to.be.reverted;
        });

        it("should recover stuck ETH from factory", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            // Send ETH to the factory
            await fixture.creator1.sendTransaction({
                to: await fixture.contestFactory.getAddress(),
                value: ethers.parseEther("0.1")
            });

            const tx = await fixture.contestFactory.connect(fixture.owner).recoverFactoryETH();
            await expect(tx).to.emit(fixture.contestFactory, "FactoryETHRecovered");
        });

        it("should recover stuck ERC20 tokens from factory", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const amount = ethers.parseEther("100");
            await fixture.mockUSDC.mint(await fixture.contestFactory.getAddress(), amount);

            const tx = await fixture.contestFactory.connect(fixture.owner)
                .recoverFactoryTokens(fixture.mockUSDC);
            
            await expect(tx)
                .to.emit(fixture.contestFactory, "FactoryTokenRecovered")
                .withArgs(await fixture.mockUSDC.getAddress(), amount);
        });
    });

    describe("Edge Cases", function() {
        it("should handle maximum contest duration", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);
            const now = await time.latest();

            const contestParams = {
                token: ethers.ZeroAddress,
                totalPrize: ethers.parseEther("1"),
                template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
                customDistribution: [],
                jury: [],
                startTime: BigInt(now + 3600),
                endTime: BigInt(now + 3600 + 270 * 24 * 3600), // 270 days
                contestMetadata: "Max duration contest",
                hasNonMonetaryPrizes: false
            };

            const platformFee = await fixture.feeManager.calculateFee(31337, contestParams.totalPrize);

            await fixture.contestFactory.connect(fixture.creator1)
                .createContest(contestParams, { value: contestParams.totalPrize + platformFee });
        });

        it("should handle custom prize distributions", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const customDistribution = [
                { place: 1, percentage: 5000, description: "1st place" },
                { place: 2, percentage: 3000, description: "2nd place" },
                { place: 3, percentage: 2000, description: "3rd place" }
            ];

            await createBasicContest(fixture, fixture.creator1, {
                template: 4, // Custom template
                customDistribution: customDistribution
            });
        });

        it("should auto-assign creator as jury if empty", async function() {
            const fixture = await loadFixture(deployFullPlatformFixture);

            const result = await createBasicContest(fixture, fixture.creator1, {
                jury: [] // Empty jury
            });

            expect(result.contestId).to.be.at.least(0);
        });
    });
});