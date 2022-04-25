import _ from "lodash";
import axios from "axios";
import { expect } from "chai";
import { contracts, erc20s, rewards } from "./consts";
import { account, bn, maxUint256, Network, networks, Token, useChaiBN, web3, zero } from "@defi.org/web3-candies";
import { deployArtifact, hre, impersonate, setBalance, tag } from "@defi.org/web3-candies/dist/hardhat";
import type { AaveLoopV3 } from "../typechain-hardhat/AaveLoopV3";
import type { IPool } from "../typechain-hardhat/IPool";
import type { IAaveIncentivesController } from "../typechain-hardhat/IAaveIncentivesController";

useChaiBN();

export const networkShortName = (process.env.NETWORK || (hre().network.name != "hardhat" ? hre().network.name : "eth")).toLowerCase() as "eth" | "poly" | "avax";
export const network = (networks as any)[networkShortName] as Network;
console.log("🌐 using network 🌐", network.name);

export let aaveloop: AaveLoopV3;
export let aavePool: IPool;
export let incentives: IAaveIncentivesController;
export let asset: Token;
export let reward: Token;

export let deployer: string; // used only in tests
export let owner: string; // used only in tests

export function initNetworkContracts() {
  asset = erc20s[networkShortName].USDC();
  reward = rewards[networkShortName]();
  aavePool = (contracts[networkShortName] as any).AavePool();
  incentives = (contracts[networkShortName] as any).AaveIncentives();
}

export async function initFixture() {
  initNetworkContracts();
  deployer = await account(0);
  owner = await account(1);
  tag(deployer, "deployer");
  tag(owner, "owner");

  aaveloop = await deployArtifact<AaveLoopV3>("AaveLoopV3", { from: deployer }, [owner, asset.address, aavePool.options.address, incentives.options.address], 0);
}

export async function fundOwner(amount: number) {
  const whale = (asset as any).whale;
  await impersonate(whale);
  await setBalance(whale, maxUint256);
  await asset.methods.transfer(owner, await asset.amount(amount)).send({ from: whale });
}

export async function expectInPosition(principal: number, leverage: number) {
  expect(await aaveloop.methods.getSupplyBalance().call())
    .bignumber.gt(zero)
    .gte(await asset.amount(bn(principal * leverage)));
  if (leverage > 1) {
    expect(await aaveloop.methods.getBorrowBalance().call()).bignumber.gte(await asset.amount(bn(principal * leverage - principal)));
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
