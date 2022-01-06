import { account, networks, Token } from "@defi.org/web3-candies";
import { deployArtifact, impersonate, tag } from "@defi.org/web3-candies/dist/hardhat";
import type { AaveLoop } from "../typechain-hardhat/AaveLoop";
import { erc20s } from "./consts";
import { expect } from "chai";

export let deployer: string;
export let owner: string;
export let aaveloop: AaveLoop;

const networkShortName = (process.env.NETWORK || "eth").toLowerCase() as "eth" | "poly" | "avax";
export const network = (networks as any)[networkShortName];

export let asset: Token;

export async function initFixture() {
  deployer = await account(0);
  owner = await account(1);
  tag(deployer, "deployer");
  tag(owner, "owner");

  await initAssets();

  aaveloop = await deployArtifact("AaveLoop", { from: deployer }, [owner], 0);
}

async function initAssets() {
  asset = erc20s[networkShortName].USDC();
  const whale = (asset as any).whale;
  await impersonate(whale);
  await asset.methods.transfer(owner, await asset.amount(10_000_000)).send({ from: whale });
}

export async function expectOutOfPosition() {
  expect(await aaveloop.methods.getBalanceAUSDC().call()).bignumber.zero;
  expect(await aaveloop.methods.getBalanceDebtToken().call()).bignumber.zero;
  expect((await aaveloop.methods.getPositionData().call()).ltv).bignumber.zero;
}

// export async function getProtocolInterestRates() {
//   const lendingPool = contract<ILendingPool>(
//     require("../artifacts/contracts/IAaveInterfaces.sol/ILendingPool.json").abi,
//     "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"
//   );
//   const reserveData = await lendingPool.methods.getReserveData(USDC().options.address).call();
//   const supplyRate = bn(reserveData[3]).div(bn8("0.1")); // ray to ether
//   const borrowRate = bn(reserveData[4]).div(bn8("0.1")); // ray to ether
//   return { supplyRate, borrowRate };
// }
