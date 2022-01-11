import { expect } from "chai";
import { erc20s, expectRevert, maxUint256, useChaiBN, web3, zeroAddress } from "@defi.org/web3-candies";
import { aaveloop, asset, deployer, initFixture, owner } from "./test-base";
import { deployArtifact } from "@defi.org/web3-candies/dist/hardhat";

useChaiBN();

describe("AaveLoop Sanity Tests", () => {
  beforeEach(async () => {
    await initFixture();
  });

  it("empty state", async () => {
    expect(await aaveloop.methods.OWNER().call()).eq(owner);
    expect(await aaveloop.methods.getSupplyBalance().call()).bignumber.zero;
    expect(await aaveloop.methods.getBorrowBalance().call()).bignumber.zero;
    expect(await aaveloop.methods.getAssetBalance().call()).bignumber.zero;
    expect(await aaveloop.methods.getLiquidity().call()).bignumber.zero;
    const result = await aaveloop.methods.getPositionData().call();
    expect(result.healthFactor).bignumber.eq(maxUint256);
    expect(result.ltv).bignumber.zero;
    await aaveloop.methods.claimRewardsToOwner().send({ from: owner });
  });

  it("constructor args", async () => {
    await expectRevert(() => deployArtifact("AaveLoop", { from: deployer }, [zeroAddress, zeroAddress, zeroAddress, zeroAddress], 0), "owner 0");
    await expectRevert(() => deployArtifact("AaveLoop", { from: deployer }, [deployer, zeroAddress, zeroAddress, zeroAddress], 0), "address 0");
    await expectRevert(() => deployArtifact("AaveLoop", { from: deployer }, [deployer, deployer, zeroAddress, zeroAddress], 0), "address 0");
    await expectRevert(() => deployArtifact("AaveLoop", { from: deployer }, [deployer, deployer, deployer, zeroAddress], 0), "address 0");
  });

  it("access control", async () => {
    await expectRevert(() => aaveloop.methods._supply(100).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods._borrow(50).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods._repayBorrow(50).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods._redeemSupply(100).send({ from: deployer }), "onlyOwner");

    await expectRevert(() => aaveloop.methods.enterPosition(100, 1).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods.exitPosition(1).send({ from: deployer }), "onlyOwner");

    await expectRevert(() => aaveloop.methods._withdrawToOwner(asset.address).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods.emergencyFunctionCall(deployer, zeroAddress).send({ from: deployer }), "onlyOwner");
    await expectRevert(() => aaveloop.methods.emergencyFunctionDelegateCall(deployer, zeroAddress).send({ from: deployer }), "onlyOwner");
  });
});
