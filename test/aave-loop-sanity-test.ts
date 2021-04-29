import { expect } from "chai";
import { aaveloop, balanceReward, owner, testHelpers } from "./test-base";

describe("AaveLoop Sanity Tests", () => {
  it("empty state", async () => {
    expect(await aaveloop.methods.aTokenBalance().call()).bignumber.zero;
    expect(await aaveloop.methods.underlyingBalance().call()).bignumber.zero;
    expect(await aaveloop.methods.owner().call()).eq(owner);
    const result = await aaveloop.methods.getAccountLiquidity().call();
    expect(result.healthFactor).bignumber.eq(await testHelpers.methods.maxUint256().call());
    await aaveloop.methods.claimRewards().send();
    expect(await balanceReward(owner)).bignumber.zero;
  });
});
