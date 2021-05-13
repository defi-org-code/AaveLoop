import { expect } from "chai";
import { aaveloop, expectOutOfPosition, expectRevert, initForkOwnerAndUSDC, owner, POSITION } from "./test-base";
import { stkAAVE, USDC } from "../src/token";
import { max } from "../src/utils";

describe("AaveLoop Sanity Tests", () => {
  beforeEach(async () => {
    await initForkOwnerAndUSDC();
  });

  it("empty state", async () => {
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;
    expect(await aaveloop.methods.owner().call()).eq(owner);
    const result = await aaveloop.methods.getPositionData().call();
    expect(result.healthFactor).bignumber.eq(max);
    expect(result.ltv).bignumber.zero;
    await aaveloop.methods.claimRewardsToOwner().send();
    expect(await stkAAVE().methods.balanceOf(owner).call()).bignumber.zero;
  });

  it("access control", async () => {
    await USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    await expectRevert(() => aaveloop.methods._deposit(100).send());
    await expectRevert(() => aaveloop.methods._borrow(50).send());
    await expectRevert(() => aaveloop.methods._repay(50).send());
    await expectRevert(() => aaveloop.methods._withdraw(100).send());

    await expectRevert(() => aaveloop.methods.enterPosition(1).send());
    await expectRevert(() => aaveloop.methods.exitPosition(20).send());

    await expectRevert(() => aaveloop.methods.withdrawAllUSDCToOwner().send());
    await expectRevert(() => aaveloop.methods.emergencyFunctionCall("", "").send());
    await expectRevert(() => aaveloop.methods.emergencyFunctionDelegateCall("", "").send());
  });
});
