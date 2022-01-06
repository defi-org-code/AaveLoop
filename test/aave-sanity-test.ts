import { expect } from "chai";
import { erc20s, expectRevert, maxUint256, useChaiBN, zeroAddress } from "@defi.org/web3-candies";
import { aaveloop, deployer, initFixture, owner } from "./test-base";
import { deployArtifact } from "@defi.org/web3-candies/dist/hardhat";

useChaiBN();

describe("AaveLoop Sanity Tests", () => {
  beforeEach(async () => {
    await initFixture();
  });

  it("empty state", async () => {
    expect(await aaveloop.methods.getBalanceUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
    expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
    expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;
    expect(await aaveloop.methods.owner().call()).eq(owner);
    const result = await aaveloop.methods.getPositionData().call();
    expect(result.healthFactor).bignumber.eq(maxUint256);
    expect(result.ltv).bignumber.zero;
    await aaveloop.methods.claimRewardsToOwner().send({ from: owner });
    expect(await erc20s.eth.Aave_stkAAVE().methods.balanceOf(owner).call()).bignumber.zero;

    await expectRevert(() => deployArtifact("AaveLoop", { from: deployer }, [zeroAddress], 0), "zero address");
  });

  it("access control", async () => {
    await erc20s.eth
      .USDC()
      .methods.transfer(aaveloop.options.address, await erc20s.eth.USDC().amount(1_000_000))
      .send({ from: owner });

    await expectRevert(() => aaveloop.methods._deposit(100).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods._borrow(50).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods._repay(50).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods._withdraw(100).send({ from: deployer }), "onlyOwner");

    await expectRevert(() => aaveloop.methods.enterPosition(1).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods.exitPosition(20).send({ from: deployer }), "onlyOwner");

    await expectRevert(() => aaveloop.methods.withdrawAllUSDCToOwner().send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods.emergencyFunctionCall(deployer, zeroAddress).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods.emergencyFunctionDelegateCall(deployer, zeroAddress).send({ from: deployer }), "onlyOwner");
  });
});
