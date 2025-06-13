import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullPlatformFixture } from "../fixtures";
import { createTestContest } from "../helpers/ContestHelper";
import { ContestEscrow } from "../../typechain-types";

/**
 * Test contest cancellation and refund of ETH prize.
 */
describe("Contest E2E Cancellation", function () {
  it("cancels contest and refunds creator", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1 } = fixture;

    const now = await time.latest();
    const startTime = BigInt(now + 3600);
    const endTime = BigInt(now + 7200);
    const totalPrize = ethers.parseEther("2");

    const { escrow } = await createTestContest(
      contestFactory,
      feeManager,
      creator1,
      {
        token: ethers.ZeroAddress,
        totalPrize,
        template: 0,
        startTime,
        endTime,
        metadata: { title: "Cancellation", description: "" },
      }
    );

    const before = await ethers.provider.getBalance(creator1.address);
    const tx = await escrow.connect(creator1).cancel("E2E cancel");
    const receipt = await tx.wait();
    const gasUsed = receipt ? receipt.gasUsed * receipt.gasPrice : 0n;
    const after = await ethers.provider.getBalance(creator1.address);

    expect(after).to.equal(before + totalPrize - gasUsed);

    const info = await escrow.getContestInfo();
    expect(info.isCancelled).to.be.true;
  });
});
