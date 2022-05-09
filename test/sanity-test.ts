import { expect } from "chai";
import { erc20s, ether, expectRevert, maxUint256, useChaiBN, web3, zeroAddress } from "@defi.org/web3-candies";
import { aaveloop, asset, deployer, expectOutOfPosition, initFixture, owner } from "./test-base";
import { deployArtifact } from "@defi.org/web3-candies/dist/hardhat";

useChaiBN();

describe("AaveLoop Sanity Tests", () => {
  beforeEach(async () => {
    await initFixture();
  });

  it("empty state", async () => {
    expect(await aaveloop.methods.OWNER().call()).eq(owner);
    await expectOutOfPosition();
    const result = await aaveloop.methods.getPositionData().call();
    expect(result.healthFactor).bignumber.eq(maxUint256);
    expect(result.ltv).bignumber.zero;
    expect(await aaveloop.methods.getPendingRewards().call()).bignumber.zero;
    await aaveloop.methods.claimRewardsToOwner().send({ from: owner });
  });

  it("constructor args", async () => {
    await expectRevert(() => deployArtifact("AaveLoopV3", { from: deployer }, [zeroAddress, zeroAddress, zeroAddress, zeroAddress], 0), "E0");
    await expectRevert(() => deployArtifact("AaveLoopV3", { from: deployer }, [deployer, zeroAddress, zeroAddress, zeroAddress], 0), "E0");
    await expectRevert(() => deployArtifact("AaveLoopV3", { from: deployer }, [deployer, deployer, zeroAddress, zeroAddress], 0), "E0");
    await expectRevert(() => deployArtifact("AaveLoopV3", { from: deployer }, [deployer, deployer, deployer, zeroAddress], 0), "E0");
  });

  it("access control", async () => {
    await expectRevert(() => aaveloop.methods._supply(100).send({ from: deployer }), "E1");
    await expectRevert(() => aaveloop.methods._borrow(50).send({ from: deployer }), "E1");
    await expectRevert(() => aaveloop.methods._repayBorrow(50).send({ from: deployer }), "E1");
    await expectRevert(() => aaveloop.methods._redeemSupply(100).send({ from: deployer }), "E1");

    await expectRevert(() => aaveloop.methods.enter(100, 150).send({ from: deployer }), "E1");
    await expectRevert(() => aaveloop.methods.exit().send({ from: deployer }), "E1");

    await expectRevert(() => aaveloop.methods._withdrawToOwner(asset.address).send({ from: deployer }), "E1");
    await expectRevert(() => aaveloop.methods.emergencyFunctionCall(deployer, zeroAddress).send({ from: deployer }), "E1");
    await expectRevert(() => aaveloop.methods.emergencyFunctionDelegateCall(deployer, zeroAddress).send({ from: deployer }), "E1");
  });
});
