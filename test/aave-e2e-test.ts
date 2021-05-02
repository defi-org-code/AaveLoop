import { expect } from "chai";
import { aaveloop, owner, testHelpers } from "./test-base";
import { Tokens } from "../src/token";
import { bn6, many } from "../src/utils";

describe("AaveLoop E2E Tests", () => {
  it("happy path", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6("10,000,000")).send({ from: owner });

    console.log("entering position");
    await aaveloop.methods.enterPosition(20).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    console.log("exiting position");
    await aaveloop.methods.exitPosition().send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.closeTo(bn6("10,000,000"), bn6("1")).greaterThan("10,000,000");

    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect(await aaveloop.methods.getPercentLTV().call()).bignumber.zero;
  });
});
