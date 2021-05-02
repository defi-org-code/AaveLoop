import { expect } from "chai";
import { aaveloop, deployer, owner, POSITION } from "./test-base";
import { Tokens } from "../src/token";
import { bn6, zero } from "../src/utils";
import { advanceTime } from "../src/network";

describe("AaveLoop E2E Tests", () => {
  it("happy path", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    await aaveloop.methods.enterPosition(20).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods.exitPosition().send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call())
      .bignumber.closeTo(bn6(POSITION), bn6("1"))
      .greaterThan(POSITION);

    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect(await aaveloop.methods.getPercentLTV().call()).bignumber.zero;
  });

  it("Show me the money", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    await aaveloop.methods.enterPosition(20).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await advanceTime(86400);

    expect(await aaveloop.methods.getBalanceReward().call()).bignumber.greaterThan(zero);

    console.log("Reward", await aaveloop.methods.getBalanceReward().call());

    await aaveloop.methods.claimRewardsToOwner().send({ from: deployer });

    const rewards = await Tokens.stkAAVE().methods.balanceOf(owner).call();
    console.log("Reward stkAAVE", rewards);

    expect(rewards).bignumber.greaterThan(zero);

    await aaveloop.methods.exitPosition().send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.greaterThan(POSITION);

    console.log("Balance USDC", await aaveloop.methods.getBalanceUSDC().call());

    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect(await aaveloop.methods.getPercentLTV().call()).bignumber.zero;
  });

  // Utilization high / low
});
