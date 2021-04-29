import BN from "bn.js";
import { NexusLPSushi } from "../typechain-hardhat/NexusLPSushi";
import { bn, bn6, ether, fmt18, fmt6, many } from "../src/utils";
import { IUniswapV2Pair } from "../typechain-hardhat/IUniswapV2Pair";
import { contract, deployContract } from "../src/extensions";
import { impersonate, resetNetworkFork, tag, web3 } from "../src/network";
import { Tokens } from "../src/token";
import { IUniswapV2Router02 } from "../typechain-hardhat/IUniswapV2Router02";
import { Wallet } from "../src/wallet";
import { IWETH } from "../typechain-hardhat/IWETH";
import { expect } from "chai";

export const usdcWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // binance8

export const deadline = many;
export let deployer: string;
export let nexus: NexusLPSushi;
export let startDeployerBalanceETH: BN;
export let startNexusBalanceUSDC: BN;
export let startPrice: BN;
export let sushiRouter: IUniswapV2Router02;
export let sushiEthUsdPair: IUniswapV2Pair;
export let IWETHContract: IWETH;

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

async function initWallet() {
  const wallet = await Wallet.fake();
  wallet.setAsDefaultSigner();
  deployer = wallet.address;
  tag(deployer, "deployer");
}

async function doBeforeEach() {
  await resetNetworkFork();
  await impersonate(usdcWhale);
  await impersonate(usdcWhale2);
  tag(usdcWhale, "USDC whale (binance8)");
  tag(usdcWhale2, "USDC whale (binance7)");

  await initWallet();

  nexus = await deployContract<NexusLPSushi>("NexusLPSushi", deployer);

  sushiRouter = contract<IUniswapV2Router02>(
    require("../artifacts/contracts/interface/ISushiswapRouter.sol/IUniswapV2Router02.json").abi,
    "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
  );
  tag(sushiRouter.options.address, "sushiRouter");
  sushiEthUsdPair = contract<IUniswapV2Pair>(
    require("../artifacts/contracts/interface/ISushiswapRouter.sol/IUniswapV2Pair.json").abi,
    "0x397FF1542f962076d0BFE58eA045FfA2d347ACa0"
  );
  tag(sushiEthUsdPair.options.address, "sushiETH/USDCPair");
  IWETHContract = contract<IWETH>(
    require("../artifacts/contracts/interface/ISushiswapRouter.sol/IWETH.json").abi,
    Tokens.WETH().address
  );

  await supplyCapitalAsDeployer(bn6("10,000,000"));
  [startDeployerBalanceETH, startNexusBalanceUSDC, startPrice] = await Promise.all([
    balanceETH(deployer),
    balanceUSDC(),
    quote(),
  ]);
}

/**
 * @returns eth price quote in usd, from nexus contract
 */
export async function quote() {
  return bn(await nexus.methods.quote(ether).call());
}

/**
 * @returns usdc balance, defaults to nexus address
 */
export async function balanceUSDC(address: string = nexus.options.address) {
  return bn(await Tokens.USDC().methods.balanceOf(address).call());
}

/**
 * @returns eth balance, defaults to nexus address
 */
export async function balanceETH(address: string = nexus.options.address) {
  return bn(await web3().eth.getBalance(address));
}

export async function balanceWETH(address: string = nexus.options.address) {
  return bn(await Tokens.WETH().methods.balanceOf(address).call());
}

export async function totalPairedUSDC() {
  return bn(await nexus.methods.totalPairedUSDC().call());
}

/**
 * Changes eth price in pool by dumping USDC or ETH from a whale
 *
 * @param percent increase or decrease (- or +)
 * @returns the new eth price in usd
 */
export async function changePriceETHByPercent(percent: number) {
  console.log("changing ETH price by", percent, "%");

  const price = await quote();
  console.log("start price", fmt6(price));

  const targetPrice = price.muln((1 + percent / 100) * 1000).divn(1000);
  const usdDelta = await computeUsdDeltaForTargetPrice(targetPrice);

  if (targetPrice.gt(price)) {
    await Tokens.USDC().methods.approve(sushiRouter.options.address, many).send({ from: usdcWhale });
    await sushiRouter.methods
      .swapExactTokensForETH(usdDelta, 0, [Tokens.USDC().address, Tokens.WETH().address], usdcWhale, many)
      .send({ from: usdcWhale });
  } else {
    await sushiRouter.methods
      .swapETHForExactTokens(
        usdDelta.muln(997).divn(1000),
        [Tokens.WETH().address, Tokens.USDC().address],
        usdcWhale,
        many
      )
      .send({ from: usdcWhale, value: (await balanceETH(usdcWhale)).sub(ether) });
  }

  const result = await quote();
  console.log("end price", fmt6(result));
  return result;
}

/**
 * Swap large amounts several times to accrue interest via swap fees, returning to the same(-ish) price
 */
export async function simulateInterestAccumulation() {
  for (let i = 0; i < 50; i++) {
    await changePriceETHByPercent(300);
    await changePriceETHByPercent(-75);
  }
}

async function supplyCapitalAsDeployer(amount: BN) {
  await ensureUsdBalance(deployer, amount);
  await Tokens.USDC().methods.approve(nexus.options.address, many).send({ from: deployer });
  await nexus.methods.depositAllCapital().send({ from: deployer });
}

/**
 * Takes USDC from whale ensuring minimum amount
 */
async function ensureUsdBalance(address: string, amount: BN) {
  if ((await balanceUSDC(address)).lt(amount)) {
    await Tokens.USDC().methods.transfer(address, amount).send({ from: usdcWhale2 });
  }
}

async function computeUsdDeltaForTargetPrice(targetPrice: BN) {
  const { reserve0, reserve1 } = await sushiEthUsdPair.methods.getReserves().call();
  const rUsd = bn(reserve0).divn(1e6).toNumber();
  const rEth = bn(reserve1).div(ether).toNumber();
  const nTargetPrice = targetPrice.divn(1e6).toNumber();
  const targetUsdReserve = Math.sqrt(nTargetPrice * rEth * rUsd);
  return bn(Math.abs(targetUsdReserve - rUsd) * 1e6);
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
