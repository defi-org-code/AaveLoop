import BN from "bn.js";
import { bn, bn6 } from "../src/utils";
import { deployContract } from "../src/extensions";
import { impersonate, resetNetworkFork, tag } from "../src/network";
import { Tokens } from "../src/token";
import { Wallet } from "../src/wallet";
import { expect } from "chai";
import { AaveLoop } from "../typechain-hardhat/AaveLoop";
import { TestHelpers } from "../typechain-hardhat/TestHelpers";

export const usdcWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // binance8

export let deployer: string;
export let owner: string;
export let aaveloop: AaveLoop;
export let testHelpers: TestHelpers;
export const POSITION = "20,000,000";

/**
 * test case state init
 */
beforeEach(async () => {
  while (true) {
    try {
      return await doBeforeEach();
    } catch (e) {
      console.error(e, "\ntrying again...");
    }
  }
});

async function doBeforeEach() {
  await resetNetworkFork();
  await impersonate(usdcWhale);
  tag(usdcWhale, "USDC whale (binance8)");

  await initWallet();

  owner = (await Wallet.fake(1)).address;
  aaveloop = await deployContract<AaveLoop>("AaveLoop", deployer, [owner]);
  testHelpers = await deployContract<TestHelpers>("TestHelpers", deployer);

  await ensureBalanceUSDC(owner, bn6(POSITION));
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
async function ensureBalanceUSDC(address: string, amount: BN) {
  if (bn(await Tokens.USDC().methods.balanceOf(address).call()).lt(amount)) {
    await Tokens.USDC().methods.transfer(address, amount).send({ from: usdcWhale });
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
