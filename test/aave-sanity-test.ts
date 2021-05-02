import { expect } from "chai";
import { aaveloop, owner, testHelpers } from "./test-base";
import { Tokens } from "../src/token";

describe("AaveLoop Sanity Tests", () => {
  it("empty state", async () => {
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect(await aaveloop.methods.owner().call()).eq(owner);
    expect(await aaveloop.methods.getHealthFactor().call()).bignumber.eq(await testHelpers.methods.maxUint256().call());
    expect(await aaveloop.methods.getPercentLTV().call()).bignumber.zero;
    await aaveloop.methods.claimRewardsToOwner().send();
    expect(await Tokens.stkAAVE().methods.balanceOf(owner).call()).bignumber.zero;
  });
});
