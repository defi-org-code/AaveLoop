import BN from "bn.js";
import { expect } from "chai";
import { aaveloop, asset, deployer, expectInPosition, expectOutOfPosition, fundOwner, incentives, initFixture, lendingPool, networkShortName, owner } from "./test-base";
import { weth } from "./consts";
import { bn, ether, maxUint256 } from "@defi.org/web3-candies";
import { deployArtifact } from "@defi.org/web3-candies/dist/hardhat";
import { AaveLoop } from "../typechain-hardhat/AaveLoop";

describe("AaveLoop Emergency Tests", () => {
  const PRINCIPAL = 1_000_000;
  let initialBalance: BN;

  beforeEach(async () => {
    await initFixture();
    await fundOwner(PRINCIPAL);
    initialBalance = bn(await asset.methods.balanceOf(owner).call());
  });

  it("Owner able to call step by step", async () => {
    await asset.methods.transfer(aaveloop.options.address, 100).send({ from: owner });
    await aaveloop.methods._supply(100).send({ from: owner });
    await aaveloop.methods._borrow(50).send({ from: owner });
    await aaveloop.methods._repayBorrow(50).send({ from: owner });
    await aaveloop.methods._redeemSupply(100).send({ from: owner });
    await aaveloop.methods._withdrawToOwner(asset.address).send({ from: owner });
    await expectOutOfPosition();
  });

  it("withdrawToOwner", async () => {
    const _weth = weth[networkShortName]();
    await _weth.methods.deposit().send({ from: owner, value: ether });
    const balance = await _weth.methods.balanceOf(owner).call();

    await _weth.methods.transfer(aaveloop.options.address, ether).send({ from: owner });
    expect(await _weth.methods.balanceOf(owner).call()).bignumber.zero;

    await aaveloop.methods._withdrawToOwner(_weth.address).send({ from: owner });

    expect(await _weth.methods.balanceOf(owner).call()).bignumber.eq(balance);
  });

  it("emergencyFunctionCall", async () => {
    await asset.methods.transfer(aaveloop.options.address, await asset.amount(PRINCIPAL)).send({ from: owner });

    const encoded = asset.methods.transfer(owner, await asset.amount(PRINCIPAL)).encodeABI();
    await aaveloop.methods.emergencyFunctionCall(asset.options.address, encoded).send({ from: owner });

    expect(await asset.methods.balanceOf(aaveloop.options.address).call()).bignumber.zero;
    expect(await asset.methods.balanceOf(owner).call()).bignumber.eq(initialBalance);
  });

  it("emergencyFunctionDelegateCall", async () => {
    await asset.methods.transfer(aaveloop.options.address, await asset.amount(PRINCIPAL)).send({ from: owner });

    const deployed = await deployArtifact<AaveLoop>("AaveLoop", { from: deployer }, [owner, asset.address, lendingPool.options.address, incentives.options.address], 0);
    const encoded = deployed.methods._withdrawToOwner(asset.address).encodeABI();
    await aaveloop.methods.emergencyFunctionDelegateCall(deployed.options.address, encoded).send({ from: owner }); // run _withdrawToOwner in the context of original aaveloop

    expect(await asset.methods.balanceOf(aaveloop.options.address).call()).bignumber.zero;
    expect(await asset.methods.balanceOf(owner).call()).bignumber.eq(initialBalance);
  });

  it("Exit position one by one manually", async () => {
    await asset.methods.approve(aaveloop.options.address, await asset.amount(PRINCIPAL)).send({ from: owner });

    await aaveloop.methods.enterPosition(await asset.amount(PRINCIPAL), 1).send({ from: owner });
    await expectInPosition(PRINCIPAL, 1.5); // at least x1.5

    while (bn(await aaveloop.methods.getBorrowBalance().call()).gtn(0)) {
      await aaveloop.methods._redeemSupply(await asset.amount(100_000)).send({ from: owner });
      await aaveloop.methods._repayBorrow(await asset.amount(100_000)).send({ from: owner });
    }
    await aaveloop.methods._redeemSupply(maxUint256).send({ from: owner });
    await aaveloop.methods._withdrawToOwner(asset.address).send({ from: owner });

    expect(await asset.methods.balanceOf(owner).call())
      .bignumber.gt(initialBalance)
      .closeTo(initialBalance, await asset.amount(1));
    await expectOutOfPosition();
  });
});
