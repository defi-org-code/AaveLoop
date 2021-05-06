import { expect } from "chai";
import { aaveloop, expectOutOfPosition, initOwnerAndUSDC, owner, POSITION } from "./test-base";
import { bn6, max } from "../src/utils";
import { USDC } from "../src/token";

describe("AaveLoop Emergency Tests", () => {
  beforeEach(async () => {
    await initOwnerAndUSDC();
  });

  it("owner able to call step by step", async () => {
    await USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    await aaveloop.methods._deposit(100).send({ from: owner });
    await aaveloop.methods._borrow(50).send({ from: owner });
    await aaveloop.methods._repay(50).send({ from: owner });
    await aaveloop.methods._withdraw(100).send({ from: owner });

    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.eq(POSITION);
  });

  it("withdrawAllUSDCToOwner", async () => {
    await USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });
    await aaveloop.methods.withdrawAllUSDCToOwner().send({ from: owner });
    expect(await USDC().methods.balanceOf(owner).call()).bignumber.eq(POSITION);
  });

  it("emergency function call", async () => {
    await USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    const encoded = await USDC().methods.transfer(owner, POSITION).encodeABI();
    await aaveloop.methods.emergencyFunctionCall(USDC().options.address, encoded).send({ from: owner });

    expect(await USDC().methods.balanceOf(aaveloop.options.address).call()).bignumber.zero;
    expect(await USDC().methods.balanceOf(owner).call()).bignumber.eq(POSITION);
  });

  it("emergency function delegate call", async () => {
    await USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    const encoded = await aaveloop.methods.renounceOwnership().encodeABI();
    await aaveloop.methods.emergencyFunctionDelegateCall(aaveloop.options.address, encoded).send({ from: owner });

    expect(await aaveloop.methods.owner().call()).eq("0x0000000000000000000000000000000000000000");
  });

  it("exit position one by one manually", async () => {
    await USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    await aaveloop.methods.enterPosition(5).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods._withdraw(bn6("1,638,000")).send({ from: owner });
    await aaveloop.methods._repay(bn6("1,638,000")).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods._withdraw(bn6("2,048,000")).send({ from: owner });
    await aaveloop.methods._repay(bn6("2,048,000")).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods._withdraw(bn6("2,560,000")).send({ from: owner });
    await aaveloop.methods._repay(bn6("2,560,000")).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods._withdraw(bn6("3,200,000")).send({ from: owner });
    await aaveloop.methods._repay(bn6("3,200,000")).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods._withdraw(bn6("4,000,000")).send({ from: owner });
    await aaveloop.methods._repay(bn6("4,000,000")).send({ from: owner });
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;

    await aaveloop.methods._withdraw(bn6("1,000")).send({ from: owner });
    await aaveloop.methods._repay(bn6("1,000")).send({ from: owner });

    await aaveloop.methods._withdraw(max).send({ from: owner });

    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.greaterThan(POSITION);

    await expectOutOfPosition();
  });
});
