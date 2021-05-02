import { expect } from "chai";
import { aaveloop, balanceReward, balanceUSDC, owner, testHelpers } from "./test-base";
import { Tokens } from "../src/token";
import { bn6, many } from "../src/utils";

describe("AaveLoop E2E Tests", () => {
  it("happy path", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6("10,000,000")).send({ from: owner });

    console.log("entering position");
    await aaveloop.methods.enterPosition(2).send({ from: owner });
    expect(await balanceUSDC()).bignumber.zero;

    console.log("exiting position");
    await aaveloop.methods.exitPosition().send({ from: owner });
    expect(await balanceUSDC()).bignumber.eq(bn6("10,000,000"));
  });
});
