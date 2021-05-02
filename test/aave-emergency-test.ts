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

    //TODO
  });

  it("emergency function delegate call", async () => {
    await Tokens.USDC().methods.transfer(aaveloop.options.address, bn6(POSITION)).send({ from: owner });

    //TODO
  });
});
