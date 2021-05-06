import { expect } from "chai";
import { aaveloop, initOwnerAndUSDC, MAX_VALUE, owner, POSITION } from "./test-base";
import { Tokens } from "../src/token";
import { bn6 } from "../src/utils";

describe("AaveLoop Emergency Tests", () => {
  beforeEach(async () => {
    await initOwnerAndUSDC();
  });

  it("owner able to call step by step", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    await aaveloop.methods._deposit(100).send({ from: owner });
    await aaveloop.methods._borrow(50).send({ from: owner });
    await aaveloop.methods._repay(50).send({ from: owner });
    await aaveloop.methods._withdraw(100).send({ from: owner });

    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.eq(POSITION);
  });

  it("withdrawToOwner", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });
    await aaveloop.methods.withdrawToOwner(Tokens.USDC().address).send({ from: owner });
    expect(await Tokens.USDC().methods.balanceOf(owner).call()).bignumber.eq(POSITION);
  });

  it("emergency function call", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    const encoded = await Tokens.USDC().methods.transfer(owner, POSITION).encodeABI();
    await aaveloop.methods.emergencyFunctionCall(Tokens.USDC().options.address, encoded).send({ from: owner });

    expect(await Tokens.USDC().methods.balanceOf(aaveloop.options.address).call()).bignumber.zero;
    expect(await Tokens.USDC().methods.balanceOf(owner).call()).bignumber.eq(POSITION);
  });

  it("emergency function delegate call", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

    const encoded = await aaveloop.methods.renounceOwnership().encodeABI();
    await aaveloop.methods.emergencyFunctionDelegateCall(aaveloop.options.address, encoded).send({ from: owner });

    expect(await aaveloop.methods.owner().call()).eq("0x0000000000000000000000000000000000000000");
  });

  it("exit position one by one manually", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, POSITION).send({ from: owner });

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

    await aaveloop.methods._withdraw(MAX_VALUE).send({ from: owner });

    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.greaterThan(POSITION);

    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;
  });
});
