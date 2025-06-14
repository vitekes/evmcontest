import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullPlatformFixture, TEST_CONSTANTS, CONTEST_TEMPLATES } from "./fixtures";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { createContest, endContest, generateWinners } from "./helpers";

describe("Stress Testing", function () {
  this.timeout(120000);

  it("should handle contest with many winners", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1 } = fixture;

    const distribution = Array.from({ length: 50 }, (_, i) => ({
      place: i + 1,
      percentage: 200, // 2% each -> 100%
      description: "" ,
    }));

    const { escrow } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      { customDistribution: distribution, duration: 3600, template: CONTEST_TEMPLATES.CUSTOM }
    );

    await endContest(escrow);
    const winners = generateWinners(50);

    await expect(
      escrow.connect(creator1).declareWinners(winners, distribution.map(d => d.place))
    ).to.emit(escrow, "WinnersDeclared");
  });

  it("should handle multiple prize claims", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1, winner1, winner2, winner3 } = fixture;

    const { escrow } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      { duration: 3600, template: 2 } // TOP_3
    );

    await endContest(escrow);
    await escrow
      .connect(creator1)
      .declareWinners([
        winner1.address,
        winner2.address,
        winner3.address,
      ], [1, 2, 3]);

    await Promise.all([
      escrow.connect(winner1).claimPrize(),
      escrow.connect(winner2).claimPrize(),
      escrow.connect(winner3).claimPrize(),
    ]);

    expect(await escrow.hasClaimed(winner1.address)).to.be.true;
    expect(await escrow.hasClaimed(winner2.address)).to.be.true;
    expect(await escrow.hasClaimed(winner3.address)).to.be.true;
  });

  it("should handle rapid contest creation", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1 } = fixture;

    const initialId = await contestFactory.lastId();
    for (let i = 0; i < 5; i++) {
      await createContest(contestFactory, feeManager, creator1, { duration: 3600, uniqueId: i });
      if (i < 4) {
        await time.increase(3600);
      }
    }

    expect(await contestFactory.lastId()).to.equal(initialId + BigInt(5));
  });
});
