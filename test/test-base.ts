import _ from "lodash";
import axios from "axios";
import { expect } from "chai";
import { contracts, erc20s, rewards } from "./consts";
import { account, bn, contract, eqIgnoreCase, maxUint256, Network, networks, Token, useChaiBN, zero } from "@defi.org/web3-candies";
import { artifact, deployArtifact, hre, impersonate, setBalance, tag } from "@defi.org/web3-candies/dist/hardhat";
import type { AaveLoopV3 } from "../typechain-hardhat/AaveLoopV3";
import type { IPool } from "../typechain-hardhat/IPool";
import { IPoolAddressesProvider } from "../typechain-hardhat/IPoolAddressesProvider";
import { IRewardsController } from "../typechain-hardhat/IRewardsController";

useChaiBN();

export const networkShortName = (process.env.NETWORK || (hre().network.name != "hardhat" ? hre().network.name : "eth")).toLowerCase() as "eth" | "poly" | "avax";
export const network = (networks as any)[networkShortName] as Network;
console.log("🌐 using network", network.name, network.id, "🌐");

export let aaveloop: AaveLoopV3;
export let aavePool: IPool;
export let incentives: IRewardsController;
export let asset: Token;
export let reward: Token;

export let deployer: string;
export let owner: string;

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

  aaveloop = await deployArtifact<AaveLoopV3>("AaveLoopV3", { from: deployer }, [owner, asset.address, reward.address, aavePool.options.address, incentives.options.address], 0);

  await setMockConfiguration();
}

async function setMockConfiguration() {
  const NEW_SUPPLY_CAP = bn(10_000_000_000);
  const SUPPLY_CAP_MASK = bn("0xffffffffffffffffffffffffff000000000fffffffffffffffffffffffffffff", 16);
  const SUPPLY_CAP_START_BIT_POSITION = 116;
  // const BORROW_CAP_MASK = bn("0xfffffffffffffffffffffffffffffffffff000000000ffffffffffffffffffff", 16);
  // const BORROW_CAP_START_BIT_POSITION = 80;
  // self.data = (self.data & BORROW_CAP_MASK) | (borrowCap << BORROW_CAP_START_BIT_POSITION);

  const config = (await aavePool.methods.getConfiguration(asset.address).call())[0];
  const poolAddressesProvider = contract<IPoolAddressesProvider>(artifact("IPoolAddressesProvider").abi, await aavePool.methods.ADDRESSES_PROVIDER().call());
  const configurator = await poolAddressesProvider.methods.getPoolConfigurator().call();
  await impersonate(configurator);
  await setBalance(configurator, maxUint256);

  const newConfig = bn(config).uand(SUPPLY_CAP_MASK).uor(NEW_SUPPLY_CAP.ushln(SUPPLY_CAP_START_BIT_POSITION));
  await aavePool.methods.setConfiguration(asset.address, [newConfig.toString()]).send({ from: configurator });
}

export async function fund(target: string, amount: number) {
  const whale = (asset as any).whale;
  await impersonate(whale);
  await setBalance(whale, maxUint256);
  await asset.methods.transfer(target, await asset.amount(amount)).send({ from: whale });
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

  expect(await aaveloop.methods.getLiquidity().call()).bignumber.gt(zero);
  expect(await aaveloop.methods.getAssetBalance().call()).bignumber.zero; // all in
}

export async function expectOutOfPosition() {
  expect(await aaveloop.methods.getSupplyBalance().call()).bignumber.zero;
  expect(await aaveloop.methods.getBorrowBalance().call()).bignumber.zero;
  expect(await aaveloop.methods.getLiquidity().call()).bignumber.zero;
  expect(await aaveloop.methods.getAssetBalance().call()).bignumber.zero;
}

export async function getPrice(asset: Token) {
  if (eqIgnoreCase(asset.address, erc20s.eth.stkAAVE().address)) {
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
