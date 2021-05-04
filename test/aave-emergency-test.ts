import { expect } from "chai";
import { aaveloop, owner, POSITION } from "./test-base";
import { Tokens } from "../src/token";
import { bn6 } from "../src/utils";

describe("AaveLoop Emergency Tests", () => {
  it("owner able to call step by step", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    await aaveloop.methods._deposit(100).send({ from: owner });
    await aaveloop.methods._borrow(50).send({ from: owner });
    await aaveloop.methods._repay(50).send({ from: owner });
    await aaveloop.methods._withdraw(100).send({ from: owner });

    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.eq(bn6(POSITION));
  });

  it("withdrawToOwner", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });
    await aaveloop.methods.withdrawToOwner(Tokens.USDC().address).send({ from: owner });
    expect(await Tokens.USDC().methods.balanceOf(owner).call()).bignumber.eq(bn6(POSITION));
  });

  it("emergency function call", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    const encoded = await Tokens.USDC().methods.transfer(owner, bn6(POSITION)).encodeABI();
    await aaveloop.methods.emergencyFunctionCall(Tokens.USDC().options.address, encoded).send({ from: owner });

    expect(await Tokens.USDC().methods.balanceOf(aaveloop.options.address).call()).bignumber.zero;
    expect(await Tokens.USDC().methods.balanceOf(owner).call()).bignumber.gt(POSITION);
  });

  it("emergency function delegate call", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    const encoded = await aaveloop.methods.renounceOwnership().encodeABI();
    const result = await aaveloop.methods
      .emergencyFunctionDelegateCall(aaveloop.options.address, encoded)
      .send({ from: owner });

    expect(await aaveloop.methods.owner().call()).eq("0x0000000000000000000000000000000000000000");
  });
});
