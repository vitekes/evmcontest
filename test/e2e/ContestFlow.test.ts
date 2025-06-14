import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullPlatformFixture } from "../fixtures";
import { createTestContest, endContest, verifyPrizeClaim } from "../helpers/ContestHelper";
import { ContestEscrow } from "../../typechain-types";

/**
 * E2E tests covering full contest lifecycle using ETH prizes.
 */
describe("Contest E2E Flow", function () {
  it("runs full lifecycle with ETH prize", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1, winner1, winner2, jury1 } = fixture;

    const now = await time.latest();
    const startTime = BigInt(now + 3600); // start in 1 hour
    const endTime = BigInt(now + 7200);   // end in 2 hours
    const totalPrize = ethers.parseEther("1");

    const { contestId, escrow, escrowAddress } = await createTestContest(
      contestFactory,
      feeManager,
      creator1,
      {
        token: ethers.ZeroAddress,
        totalPrize,
        template: 1,
        startTime,
        endTime,
        jury: [jury1.address],
        metadata: {
          title: "E2E ETH Contest",
          description: "Full flow"
        }
      }
    );

    expect(contestId).to.be.gte(BigInt(0));
    expect(ethers.isAddress(escrowAddress)).to.be.true;

    const initialBalance = await ethers.provider.getBalance(escrowAddress);
    expect(initialBalance).to.equal(totalPrize);

    // move time to contest start then end
    await time.increaseTo(Number(startTime) + 5);
    await endContest(escrow as ContestEscrow);

    const winners = [winner1.address, winner2.address];
    const places = [1, 2];
    await expect(escrow.connect(jury1).declareWinners(winners, places)).to.emit(
      escrow,
      "WinnersDeclared"
    );

    // calculate expected prizes
    const distribution = await escrow.getDistribution();
    const prize1 = (totalPrize * BigInt(distribution[0].percentage)) / BigInt(10000);
    const prize2 = (totalPrize * BigInt(distribution[1].percentage)) / BigInt(10000);

    const actual1 = await verifyPrizeClaim(escrow as ContestEscrow, winner1, prize1);
    expect(actual1).to.be.closeTo(prize1, BigInt(1e14));

    const actual2 = await verifyPrizeClaim(escrow as ContestEscrow, winner2, prize2);
    expect(actual2).to.be.closeTo(prize2, BigInt(1e14));
  });
});
