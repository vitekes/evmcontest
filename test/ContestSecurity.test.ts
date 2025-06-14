import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  TEST_CONSTANTS,
  CONTEST_TEMPLATES,
  deployFullPlatformFixture
} from "./fixtures";
import {
  createContest,
  endContest
} from "./helpers";

// Tests focusing on common security risks
describe("Security", function () {
  this.timeout(120000);

  it("should prevent reentrancy attacks on claimPrize", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1 } = fixture;

    const { escrow } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      {
        totalPrize: TEST_CONSTANTS.SMALL_PRIZE,
        template: CONTEST_TEMPLATES.WINNER_TAKES_ALL,
        duration: 3600
      }
    );

    await endContest(escrow);

    const Attacker = await ethers.getContractFactory("ReentrantWinner");
    const attacker = await Attacker.deploy(await escrow.getAddress());
    await attacker.waitForDeployment();

    await escrow
      .connect(creator1)
      .declareWinners([await attacker.getAddress()], [1]);

    await expect(attacker.attack()).to.be.revertedWith("ETH transfer failed");
    expect(await escrow.hasClaimed(await attacker.getAddress())).to.be.false;
  });

  it("should restrict declareWinners to jury or creator", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1, participant1 } = fixture;

    const { escrow } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      { duration: 3600 }
    );
    await endContest(escrow);

    await expect(
      escrow
        .connect(participant1)
        .declareWinners([participant1.address], [1])
    ).to.be.revertedWith("Only jury or creator");
  });

  it("should restrict emergencyWithdraw to factory", async function () {
    const fixture = await loadFixture(deployFullPlatformFixture);
    const { contestFactory, feeManager, creator1, participant1 } = fixture;

    const { escrow } = await createContest(
      contestFactory,
      feeManager,
      creator1,
      { duration: 3600 }
    );

    await expect(
      escrow.connect(participant1).emergencyWithdraw("hack")
    ).to.be.revertedWith("Only factory can call this");
  });
});
