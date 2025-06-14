import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullPlatformFixture, TEST_CONSTANTS, CONTEST_TEMPLATES } from "./fixtures";
import { createContest, endContest } from "./helpers";
import { expectGasUsage } from "./helpers/EventsHelper";

describe("Gas Optimization", function () {
  this.timeout(120000);

  it("should create contest within gas limits", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1 } = fixture;

    const { transaction } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      { duration: 3600 }
    );

    await expectGasUsage(transaction, 5_000_000);
  });

  it("should declare winners within gas limits", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1, winner1 } = fixture;

    const { escrow } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      { duration: 3600 }
    );

    await endContest(escrow);

    const tx = await escrow
      .connect(creator1)
      .declareWinners([winner1.address], [1]);

    await expectGasUsage(tx, 200000);
  });

  it("should claim prize within gas limits", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1, winner1 } = fixture;

    const { escrow } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      { duration: 3600 }
    );

    await endContest(escrow);
    await escrow.connect(creator1).declareWinners([winner1.address], [1]);

    const tx = await escrow.connect(winner1).claimPrize();
    await expectGasUsage(tx, 150000);
  });
});
