import BN from "bn.js";
import { bn, bn6 } from "../src/utils";
import { deployContract } from "../src/extensions";
import { impersonate, resetNetworkFork, tag } from "../src/network";
import { Wallet } from "../src/wallet";
import { expect } from "chai";
import { AaveLoop } from "../typechain-hardhat/AaveLoop";
import { USDC } from "../src/token";

export const usdcWhale = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";

export let deployer: string;
export let owner: string;
export let aaveloop: AaveLoop;
export const POSITION = bn6("5,000,000");

export async function initOwnerAndUSDC() {
  while (true) {
    try {
      return await doInitState();
    } catch (e) {
      console.error(e, "\ntrying again...");
    }
  }
}

async function doInitState() {
  await resetNetworkFork();
  await impersonate(usdcWhale);
  tag(usdcWhale, "USDC whale");

  await initWallet();

  owner = (await Wallet.fake(1)).address;
  aaveloop = await deployContract<AaveLoop>("AaveLoop", { from: deployer }, [owner]);

  await ensureBalanceUSDC(owner, POSITION);
}

async function initWallet() {
  const wallet = await Wallet.fake();
  wallet.setAsDefaultSigner();
  deployer = wallet.address;
  tag(deployer, "deployer");
}

/**
 * Takes USDC from whale ensuring minimum amount
 */
export async function ensureBalanceUSDC(address: string, amount: BN) {
  if (bn(await USDC().methods.balanceOf(address).call()).lt(amount)) {
    await USDC().methods.transfer(address, amount).send({ from: usdcWhale });
  }
}

export async function expectRevert(fn: () => any) {
  let err: Error | null = null;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  expect(!!err, "expected to revert").true;
}

export async function expectOutOfPosition() {
  expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
  expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
  expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;
}
