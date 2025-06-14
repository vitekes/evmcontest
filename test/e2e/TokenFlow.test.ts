import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullPlatformFixture } from "../fixtures";
import { createTestContest, endContest } from "../helpers/ContestHelper";
import { ContestEscrow, MockUSDC } from "../../typechain-types";

/**
 * Full lifecycle test for contest with ERC20 prizes.
 */
describe("Contest E2E Token Flow", function () {
  it("runs lifecycle with USDC prize", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1, winner1, winner2, jury1, mockUSDC } = fixture;

    const now = await time.latest();
    const startTime = BigInt(now + 3600);
    const endTime = BigInt(now + 7200);
    const totalPrize = ethers.parseUnits("1000", 6);

    const { contestId, escrow, escrowAddress } = await createTestContest(
      contestFactory,
      feeManager,
      creator1,
      {
        token: await mockUSDC.getAddress(),
        totalPrize,
        template: 1,
        startTime,
        endTime,
        jury: [jury1.address],
        metadata: {
          title: "E2E USDC Contest",
          description: "Token flow",
        },
      }
    );

    expect(contestId).to.be.gt(BigInt(0));
    expect(ethers.isAddress(escrowAddress)).to.be.true;

    const token = mockUSDC as MockUSDC;
    const escrowBalance = await token.balanceOf(escrowAddress);
    expect(escrowBalance).to.equal(totalPrize);

    await time.increaseTo(Number(startTime) + 5);
    await endContest(escrow as ContestEscrow);

    const winners = [winner1.address, winner2.address];
    const places = [1, 2];
    await expect(escrow.connect(jury1).declareWinners(winners, places)).to.emit(
      escrow,
      "WinnersDeclared"
    );

    const distribution = await escrow.getDistribution();
    const prize1 = (totalPrize * BigInt(distribution[0].percentage)) / BigInt(10000);
    const prize2 = (totalPrize * BigInt(distribution[1].percentage)) / BigInt(10000);

    const before1 = await token.balanceOf(winner1.address);
    await escrow.connect(winner1).claimPrize();
    const after1 = await token.balanceOf(winner1.address);
    expect(after1 - before1).to.equal(prize1);

    const before2 = await token.balanceOf(winner2.address);
    await escrow.connect(winner2).claimPrize();
    const after2 = await token.balanceOf(winner2.address);
    expect(after2 - before2).to.equal(prize2);
  });
});
