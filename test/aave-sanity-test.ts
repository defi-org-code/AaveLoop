import { expect } from "chai";
import { aaveloop, expectRevert, owner, POSITION } from "./test-base";
import { Tokens } from "../src/token";
import { bn6 } from "../src/utils";

describe("AaveLoop Sanity Tests", () => {
  it("empty state", async () => {
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect(await aaveloop.methods.owner().call()).eq(owner);
    const result = await aaveloop.methods.getPositionData().call();
    expect(result.healthFactor).bignumber.eq("");
    expect(result.ltv).bignumber.zero;
    await aaveloop.methods.claimRewardsToOwner().send();
    expect(await Tokens.stkAAVE().methods.balanceOf(owner).call()).bignumber.zero;
  });

  it("access control", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    await expectRevert(() => aaveloop.methods._deposit(100).send());
    await expectRevert(() => aaveloop.methods._borrow(50).send());
    await expectRevert(() => aaveloop.methods._repay(50).send());
    await expectRevert(() => aaveloop.methods._withdraw(100).send());

    await expectRevert(() => aaveloop.methods.enterPosition(1).send());
    await expectRevert(() => aaveloop.methods.exitPosition().send());

    await expectRevert(() => aaveloop.methods.withdrawToOwner(Tokens.USDC().address).send());
    await expectRevert(() => aaveloop.methods.emergencyFunctionCall("", "").send());
    await expectRevert(() => aaveloop.methods.emergencyFunctionDelegateCall("", "").send());
  });
});
