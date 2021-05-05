import { expect } from "chai";
import { aaveloop, deployer, owner, POSITION } from "./test-base";
import { Tokens } from "../src/token";
import { bn, bn18, bn6, ether, fmt18, fmt6, zero } from "../src/utils";
import { jumpTime } from "../src/network";
import BN from "bn.js";

describe("AaveLoop E2E Tests", () => {
  it("happy path", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    await aaveloop.methods.enterPosition(14).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods.exitPosition(14).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.greaterThan(bn6(POSITION));

    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;
  });

  it("Show me the money", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    await aaveloop.methods.enterPosition(14).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    const day = 60 * 60 * 24;
    await jumpTime(day);

    const rewardBalance = await aaveloop.methods.getBalanceReward().call();
    expect(rewardBalance).bignumber.greaterThan(zero);
    console.log("rewards", fmt18(rewardBalance));

    await aaveloop.methods.claimRewardsToOwner().send({ from: deployer });

    const claimedBalance = bn(await Tokens.stkAAVE().methods.balanceOf(owner).call());
    expect(claimedBalance).bignumber.greaterThan(zero).closeTo(rewardBalance, bn18("0.1"));
    console.log("reward stkAAVE", fmt18(claimedBalance));

    await aaveloop.methods.exitPosition(15).send({ from: owner });
    const endBalanceUSDC = bn(await aaveloop.methods.getBalanceUSDC().call());
    expect(endBalanceUSDC).bignumber.greaterThan(POSITION);

    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;

    printAPY(endBalanceUSDC, claimedBalance);
  });

  it("partial exits due to gas limits", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    await aaveloop.methods.enterPosition(20).send({ from: owner });
    const startLeverage = await aaveloop.methods.getBalanceDebtToken().call();
    await aaveloop.methods.exitPosition(10).send({ from: owner });
    const midLeverage = await aaveloop.methods.getBalanceDebtToken().call();
    expect(midLeverage).bignumber.gt(zero).lt(startLeverage);
    await aaveloop.methods.exitPosition(15).send({ from: owner });

    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.greaterThan(POSITION);
    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;
  });

  it("health factor decay rate", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });
    await aaveloop.methods.enterPosition(14).send({ from: owner });

    const startHF = bn((await aaveloop.methods.getPositionData().call()).healthFactor);

    const year = 60 * 60 * 24 * 365;
    await jumpTime(year);

    const endHF = bn((await aaveloop.methods.getPositionData().call()).healthFactor);

    console.log("health factor after 1 year:", fmt18(startHF), fmt18(endHF));
    expect(endHF).bignumber.lt(startHF).gt(ether);
  });

});

function printAPY(endBalanceUSDC: BN, claimedBalance: BN) {
  console.log("=================");
  const profitFromInterest = endBalanceUSDC.sub(bn6(POSITION));
  console.log("profit from interest", fmt6(profitFromInterest));
  const stkAAVEPrice = 470;
  console.log("assuming stkAAVE price in USD", stkAAVEPrice, "$");
  const profitFromRewards = claimedBalance.muln(stkAAVEPrice).div(bn6("1,000,000")); // 18->6 decimals
  console.log("profit from rewards", fmt6(profitFromRewards));
  const profit = profitFromInterest.add(profitFromRewards);

  const dailyRate = profit.mul(bn6("1")).div(bn6(POSITION));
  console.log("dailyRate:", fmt6(dailyRate.muln(100)), "%");

  const APR = dailyRate.muln(365);
  console.log("result APR: ", fmt6(APR.muln(100)), "%");

  const APY = Math.pow(1 + parseFloat(fmt6(dailyRate)), 365) - 1;
  console.log("result APY: ", APY * 100, "%");
  console.log("=================");
}
