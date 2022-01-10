import _ from "lodash";
import axios from "axios";
import { expect } from "chai";
import { contracts, erc20s, rewards } from "./consts";
import { account, Network, networks, Token, useChaiBN, zero } from "@defi.org/web3-candies";
import { deployArtifact, impersonate, tag } from "@defi.org/web3-candies/dist/hardhat";
import type { AaveLoop } from "../typechain-hardhat/AaveLoop";
import type { ILendingPool } from "../typechain-hardhat/ILendingPool";
import type { IAaveIncentivesController } from "../typechain-hardhat/IAaveIncentivesController";

useChaiBN();

export let deployer: string;
export let owner: string;
export let aaveloop: AaveLoop;
export let lendingPool: ILendingPool;
export let incentives: IAaveIncentivesController;
export let asset: Token;
export let reward: Token;

const networkShortName = (process.env.NETWORK || "eth").toLowerCase() as "eth" | "poly" | "avax";
export const network = (networks as any)[networkShortName] as Network;

export async function initFixture() {
  deployer = await account(0);
  owner = await account(1);
  tag(deployer, "deployer");
  tag(owner, "owner");
  asset = erc20s[networkShortName].USDC();
  reward = rewards[networkShortName]();
  lendingPool = (contracts[networkShortName] as any).Aave_LendingPool();
  incentives = (contracts[networkShortName] as any).Aave_Incentives();

  aaveloop = await deployArtifact<AaveLoop>("AaveLoop", { from: deployer }, [owner, asset.address, lendingPool.options.address, incentives.options.address], 0);
}

export async function fundOwner(amount: number) {
  const whale = (asset as any).whale;
  await impersonate(whale);
  await asset.methods.transfer(owner, await asset.amount(amount)).send({ from: whale });
}

export async function expectInPosition(principal: number, leverage: number) {
  expect(await aaveloop.methods.getSupplyBalance().call())
    .bignumber.gt(zero)
    .gte(await asset.amount(principal * leverage));
  if (leverage > 1) {
    expect(await aaveloop.methods.getBorrowBalance().call()).bignumber.gte(await asset.amount(principal * leverage - principal));
  } else {
    expect(await aaveloop.methods.getBorrowBalance().call()).bignumber.zero;
  }
  expect(await aaveloop.methods.getLiquidity().call()).bignumber.gt(zero); //depends on LTV
  expect(await aaveloop.methods.getAssetBalance().call()).bignumber.zero;
}

export async function expectOutOfPosition() {
  expect(await aaveloop.methods.getSupplyBalance().call()).bignumber.zero;
  expect(await aaveloop.methods.getBorrowBalance().call()).bignumber.zero;
  expect(await aaveloop.methods.getLiquidity().call()).bignumber.zero;
  expect(await aaveloop.methods.getAssetBalance().call()).bignumber.zero;
}

export async function getPrice(asset: Token) {
  if (asset.address.toLowerCase() == erc20s.eth.Aave_stkAAVE().address.toLowerCase()) {
    // special case for stkAAVE
    asset = erc20s.eth.AAVE();
  }
  const coingeckoIds = {
    [networks.eth.id]: "ethereum",
    [networks.poly.id]: "polygon-pos",
    [networks.avax.id]: "avalanche",
  };
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${coingeckoIds[network.id]}?contract_addresses=${asset.address}&vs_currencies=usd`;
  const response = await axios.get(url);
  return (_.values(response.data)[0]["usd"] as number) || 1;
}
