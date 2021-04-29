import { expect } from "chai";
import { aaveloop, balanceReward, owner, testHelpers } from "./test-base";
import { zero } from "../src/utils";

describe("AaveLoop Sanity Tests", () => {
  it("empty state", async () => {
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.owner().call()).eq(owner);
    expect(await aaveloop.methods.getHealthFactor().call()).bignumber.eq(await testHelpers.methods.maxUint256().call());
    await aaveloop.methods.claimRewards().send();
    expect(await balanceReward(owner)).bignumber.zero;
  });
});
