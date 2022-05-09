import { expect } from "chai";
import { aaveloop, asset, deployer, expectInPosition, expectOutOfPosition, fund, getPrice, initFixture, owner, reward } from "./test-base";
import { bn, bn18, ether, fmt18, useChaiBN, zero } from "@defi.org/web3-candies";
import { mineBlock } from "@defi.org/web3-candies/dist/hardhat";

useChaiBN();

describe("AaveLoop E2E Tests", () => {
  const ASSUME_LTV = 9700;
  const DAYS_TO_SAFE_GAS = 180;
  const PRINCIPAL = 5_000_000;
  const MAX_SAGE_GAS = 10_000_000;

  const LEVERAGE = 29;
  const BORROW_PERCENT = (LEVERAGE - 1) * 100; // 2800%

  beforeEach(async () => {
    await initFixture();
    expect(await aaveloop.methods.getLTV4().call()).bignumber.eq(bn(ASSUME_LTV));

    await fund(owner, PRINCIPAL);

    await asset.methods.approve(aaveloop.options.address, await asset.amount(PRINCIPAL)).send({ from: owner });
  });

  it.only(`Show me the money: ${DAYS_TO_SAFE_GAS} day safe exit $${PRINCIPAL} x${LEVERAGE}`, async () => {
    await aaveloop.methods.enter(await asset.amount(PRINCIPAL), BORROW_PERCENT).send({ from: owner });
    await expectInPosition(PRINCIPAL, LEVERAGE);

    await mineBlock(60 * 60 * 24 * DAYS_TO_SAFE_GAS);

    expect(await aaveloop.methods.getLiquidity().call())
      .bignumber.gt(zero)
      .lt(await asset.amount(PRINCIPAL * 0.02)); // < 2% liquidity

    const tx = await aaveloop.methods.exit().send({ from: owner });
    expect(tx.gasUsed).lt(MAX_SAGE_GAS);

    await expectOutOfPosition();
    expect(await asset.methods.balanceOf(owner).call()).bignumber.gt(zero);

    expect(await aaveloop.methods.getPendingRewards().call()).bignumber.gt(zero);
    expect(await reward.methods.balanceOf(owner).call()).bignumber.zero;

    await aaveloop.methods.claimRewardsToOwner().send({ from: deployer });
    expect(await reward.methods.balanceOf(owner).call()).bignumber.gt(zero);

    console.log("=================");
    const endBalance = bn(await asset.methods.balanceOf(owner).call());
    const profitFromInterest = await asset.mantissa(endBalance.sub(await asset.amount(PRINCIPAL)));
    console.log("profit from interest", fmt18(profitFromInterest));

    const rewardPrice = await getPrice(reward);
    const principalUsd = PRINCIPAL * (await getPrice(asset));
    console.log("assuming reward price in USD", rewardPrice);
    const rewardBalance = await reward.mantissa(await reward.methods.balanceOf(owner).call());
    const profitFromRewards = await reward.mantissa(rewardBalance.muln(rewardPrice));
    console.log("profit from rewards", fmt18(profitFromRewards));
    const rewardsAPR = profitFromRewards.mul(ether).div(bn18(principalUsd)).muln(365).divn(DAYS_TO_SAFE_GAS);
    console.log("rewards APR", fmt18(rewardsAPR.muln(100)), "%");

    const interestAPR = profitFromInterest.mul(ether).div(bn18(principalUsd)).muln(365).divn(DAYS_TO_SAFE_GAS);
    console.log("interest APR:", fmt18(interestAPR.muln(100)), "%");
    console.log("=================");
  });

  // it("Add to existing position", async () => {
  //   await aaveloop.methods.enterPosition(await asset.amount(PRINCIPAL), ITERATIONS).send({ from: owner });
  //   await expectInPosition(PRINCIPAL, 4);
  //
  //   await fundOwner(PRINCIPAL);
  //   await aaveloop.methods.enterPosition(await asset.amount(PRINCIPAL), ITERATIONS).send({ from: owner });
  //   await expectInPosition(PRINCIPAL * 2, 4);
  // });

  // it("partial exit, lower leverage", async () => {
  //   await aaveloop.methods.enterPositionFully(ITERATIONS).send({ from: owner });
  //   await expectInPosition(10_000_000, 4);
  //   expect(await asset.methods.balanceOf(owner).call()).bignumber.zero;
  //   const startBorrowBalance = await aaveloop.methods.getBorrowBalance().call();
  //   const startLiquidity = await aaveloop.methods.getLiquidity().call();
  //   const startHealthFactor = (await aaveloop.methods.getPositionData().call()).healthFactor;
  //
  //   await aaveloop.methods.exitPosition(5).send({ from: owner });
  //   expect(await aaveloop.methods.getSupplyBalance().call()).bignumber.gt(zero);
  //   expect(await asset.methods.balanceOf(owner).call()).bignumber.zero;
  //   expect(await aaveloop.methods.getBorrowBalance().call())
  //     .bignumber.lt(startBorrowBalance)
  //     .gt(zero);
  //   expect(await aaveloop.methods.getLiquidity().call())
  //     .bignumber.gt(startLiquidity)
  //     .gt(zero);
  //   expect((await aaveloop.methods.getPositionData().call()).healthFactor).bignumber.gt(startHealthFactor);
  //
  //   await aaveloop.methods.exitPosition(100).send({ from: owner });
  //   await expectOutOfPosition();
  //   expect(await asset.methods.balanceOf(owner).call()).bignumber.closeTo(await asset.amount(PRINCIPAL), await asset.amount(1));
  // });

  // it("Liquidity decrease over time", async () => {
  //   await aaveloop.methods.enterPositionFully(5).send({ from: owner });
  //
  //   const startHF = bn((await aaveloop.methods.getPositionData().call()).healthFactor);
  //   const startLiquidity = bn(await aaveloop.methods.getLiquidity().call());
  //
  //   await mineBlock(60 * 60 * 24 * 365);
  //
  //   expect((await aaveloop.methods.getPositionData().call()).healthFactor)
  //     .bignumber.lt(startHF)
  //     .gt(ether); // must be > 1e18 or be liquidated
  //   expect(await aaveloop.methods.getLiquidity().call())
  //     .bignumber.lt(startLiquidity)
  //     .gt(zero); // must be > 0 or be liquidated
  // });

  // it("When low liquidity, must provide additional collateral and exit in multiple txs", async () => {
  //   await aaveloop.methods.enterPositionFully(ITERATIONS).send({ from: owner });
  //   await expectInPosition(10_000_000, 4);
  //
  //   const redeemable = bn(await aaveloop.methods.getLiquidity().call())
  //     .muln(1e4)
  //     .divn(ASSUME_LTV);
  //   await aaveloop.methods._redeemSupply(redeemable.subn(100)).send({ from: owner }); // redeem 99.99999%
  //   await aaveloop.methods._withdrawToOwner(asset.address).send({ from: owner });
  //
  //   expect(await aaveloop.methods.getLiquidity().call()).bignumber.closeTo(zero, await asset.amount(1));
  //
  //   await expectRevert(() => aaveloop.methods.exitPosition(100).send({ from: owner }), "revert"); // block gas limit
  //
  //   await fundOwner(1_000);
  //   await aaveloop.methods.enterPosition(await asset.amount(1_000), 0).send({ from: owner });
  //
  //   while (bn(await aaveloop.methods.getSupplyBalance().call()).gtn(0)) {
  //     await aaveloop.methods.exitPosition(20).send({ from: owner });
  //   }
  //
  //   await expectOutOfPosition();
  // });
});
