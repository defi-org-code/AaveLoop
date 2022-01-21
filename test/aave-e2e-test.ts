import { expect } from "chai";
import {
  aaveloop,
  asset,
  DAYS_TO_SAFE_GAS,
  deployer,
  expectInPosition,
  expectOutOfPosition,
  fundOwner,
  getPrice,
  initFixture,
  owner,
  config,
  PRINCIPAL,
  reward,
} from "./test-base";
import { bn, bn18, ether, expectRevert, fmt18, maxUint256, useChaiBN, zero } from "@defi.org/web3-candies";
import { mineBlock, mineBlocks, resetNetworkFork } from "@defi.org/web3-candies/dist/hardhat";

useChaiBN();

describe("AaveLoop E2E Tests", () => {
  beforeEach(async () => {
    await resetNetworkFork();
    await initFixture();
    expect(await aaveloop.methods.getLTV().call()).bignumber.eq(bn(config.LTV), `assuming ${config.LTV} LTV`);

    await fundOwner(PRINCIPAL);

    const initialAssetBalance = bn(await asset.methods.balanceOf(owner).call());
    expect(initialAssetBalance).bignumber.eq(await asset.amount(PRINCIPAL), `assuming ${PRINCIPAL} principal`);
    await asset.methods.approve(aaveloop.options.address, maxUint256).send({ from: owner });
  });

  it(`Full E2E ${DAYS_TO_SAFE_GAS} days exit safely under current market conditions: LTV=${config.LTV} ITERATIONS=${config.iterations}`, async () => {
    await aaveloop.methods.enterPositionFully(config.iterations).send({ from: owner });
    // ITERATIONS will result in free liquidity of 5% (+-1%) of PRINCIPAL
    expect(await aaveloop.methods.getLiquidity().call()).bignumber.closeTo(await asset.amount(PRINCIPAL * 0.05), await asset.amount(PRINCIPAL * 0.01));
    await expectInPosition(PRINCIPAL, config.expectedLeverage);

    await mineBlock(60 * 60 * 24 * DAYS_TO_SAFE_GAS);

    expect(await aaveloop.methods.getLiquidity().call())
      .bignumber.gt(zero)
      .lt(await asset.amount(PRINCIPAL * 0.02)); // < 2% liquidity

    const tx = await aaveloop.methods.exitPosition(50).send({ from: owner });
    expect(tx.gasUsed).lt(10_000_000);
    await expectOutOfPosition();

    expect(await asset.methods.balanceOf(owner).call()).bignumber.closeTo(await asset.amount(PRINCIPAL), await asset.amount(PRINCIPAL * 0.05)); // 5% max interest paid over 1 year
  });

  [0, 1, 2].map((iterations) =>
    it(`Enter & exit with ${iterations} iterations`, async () => {
      await aaveloop.methods.enterPositionFully(iterations).send({ from: owner });
      await expectInPosition(PRINCIPAL, iterations == 0 ? 0 : 1.1); // depends on LTV

      // expect(await aaveloop.methods.exitPosition(100).call({ from: owner })).bignumber.closeTo(await asset.amount(PRINCIPAL), await asset.amount(1));
      await aaveloop.methods.exitPosition(100).send({ from: owner });
      await expectOutOfPosition();

      expect(await asset.methods.balanceOf(owner).call()).bignumber.closeTo(await asset.amount(PRINCIPAL), await asset.amount(1));
    })
  );

  it("Show me the money", async () => {
    await aaveloop.methods.enterPosition(await asset.amount(PRINCIPAL), config.iterations).send({ from: owner });
    await expectInPosition(PRINCIPAL, config.expectedLeverage);

    await mineBlocks(60 * 60 * 24, 10); // secondsPerBlock does not change outcome (Aave uses block.timestamp)

    const pending = await aaveloop.methods.getPendingRewards().call();
    expect(pending).bignumber.gt(zero);
    expect(await reward.methods.balanceOf(owner).call()).bignumber.zero;

    await aaveloop.methods.claimRewardsToOwner().send({ from: deployer });

    expect(await reward.methods.balanceOf(owner).call())
      .bignumber.gt(zero)
      .closeTo(pending, bn(pending).muln(0.01));

    await aaveloop.methods.exitPosition(50).send({ from: owner });
    await expectOutOfPosition();

    const endBalance = bn(await asset.methods.balanceOf(owner).call());
    const profitFromInterest = await asset.mantissa(endBalance.sub(await asset.amount(PRINCIPAL)));
    console.log("profit from interest", fmt18(profitFromInterest));

    const rewardPrice = await getPrice(reward);
    console.log("assuming reward price in USD", rewardPrice);
    const rewardBalance = await reward.mantissa(await reward.methods.balanceOf(owner).call());
    const profitFromRewards = await reward.mantissa(rewardBalance.muln(rewardPrice));
    console.log("profit from rewards", fmt18(profitFromRewards));
    const profit = profitFromInterest.add(profitFromRewards);
    console.log("total profit", fmt18(profit));

    const principalUsd = PRINCIPAL * (await getPrice(asset));
    const dailyRate = profit.mul(ether).div(bn18(principalUsd));
    console.log("dailyRate:", fmt18(dailyRate.muln(100)), "%");

    const APR = dailyRate.muln(365);
    console.log("result APR: ", fmt18(APR.muln(100)), "%");

    const APY = Math.pow(1 + parseFloat(fmt18(APR.divn(365))), 365) - 1;
    console.log("result APY: ", APY * 100, "%");
    console.log("=================");
  });

  it("Add to existing position", async () => {
    await aaveloop.methods.enterPosition(await asset.amount(PRINCIPAL), config.iterations).send({ from: owner });
    await expectInPosition(PRINCIPAL, config.expectedLeverage);

    await fundOwner(PRINCIPAL);
    await aaveloop.methods.enterPosition(await asset.amount(PRINCIPAL), config.iterations).send({ from: owner });
    await expectInPosition(PRINCIPAL * 2, config.expectedLeverage);
  });

  it("partial exit, lower leverage", async () => {
    await aaveloop.methods.enterPositionFully(config.iterations).send({ from: owner });
    await expectInPosition(10_000_000, config.expectedLeverage);
    expect(await asset.methods.balanceOf(owner).call()).bignumber.zero;
    const startBorrowBalance = await aaveloop.methods.getBorrowBalance().call();
    const startLiquidity = await aaveloop.methods.getLiquidity().call();
    const startHealthFactor = (await aaveloop.methods.getPositionData().call()).healthFactor;

    await aaveloop.methods.exitPosition(5).send({ from: owner });
    expect(await aaveloop.methods.getSupplyBalance().call()).bignumber.gt(zero);
    expect(await asset.methods.balanceOf(owner).call()).bignumber.zero;
    expect(await aaveloop.methods.getBorrowBalance().call())
      .bignumber.lt(startBorrowBalance)
      .gt(zero);
    expect(await aaveloop.methods.getLiquidity().call())
      .bignumber.gt(startLiquidity)
      .gt(zero);
    expect((await aaveloop.methods.getPositionData().call()).healthFactor).bignumber.gt(startHealthFactor);

    await aaveloop.methods.exitPosition(100).send({ from: owner });
    await expectOutOfPosition();
    expect(await asset.methods.balanceOf(owner).call()).bignumber.closeTo(await asset.amount(PRINCIPAL), await asset.amount(1));
  });

  it("Liquidity decrease over time", async () => {
    await aaveloop.methods.enterPositionFully(5).send({ from: owner });

    const startHF = bn((await aaveloop.methods.getPositionData().call()).healthFactor);
    const startLiquidity = bn(await aaveloop.methods.getLiquidity().call());

    await mineBlock(60 * 60 * 24 * 365);

    expect((await aaveloop.methods.getPositionData().call()).healthFactor)
      .bignumber.lt(startHF)
      .gt(ether); // must be > 1e18 or be liquidated
    expect(await aaveloop.methods.getLiquidity().call())
      .bignumber.lt(startLiquidity)
      .gt(zero); // must be > 0 or be liquidated
  });

  it("When low liquidity, must provide additional collateral and exit in multiple txs", async () => {
    await aaveloop.methods.enterPositionFully(config.iterations).send({ from: owner });
    await expectInPosition(10_000_000, config.expectedLeverage);

    const redeemable = bn(await aaveloop.methods.getLiquidity().call())
      .muln(1e4)
      .divn(config.LTV);
    await aaveloop.methods._redeemSupply(redeemable.subn(100)).send({ from: owner }); // redeem 99.99999%
    await aaveloop.methods._withdrawToOwner(asset.address).send({ from: owner });

    expect(await aaveloop.methods.getLiquidity().call()).bignumber.closeTo(zero, await asset.amount(1));

    await expectRevert(() => aaveloop.methods.exitPosition(100).send({ from: owner }), "revert"); // block gas limit

    await fundOwner(1_000);
    await aaveloop.methods.enterPosition(await asset.amount(1_000), 0).send({ from: owner });

    while (bn(await aaveloop.methods.getSupplyBalance().call()).gtn(0)) {
      await aaveloop.methods.exitPosition(20).send({ from: owner });
    }

    await expectOutOfPosition();
  });
});
