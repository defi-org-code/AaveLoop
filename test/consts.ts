import _ from "lodash";
import { erc20, erc20s as erc20sOrig } from "@defi.org/web3-candies/dist/erc20";
import { contract } from "@defi.org/web3-candies";
import { artifact } from "@defi.org/web3-candies/dist/hardhat";
import { IPool } from "../typechain-hardhat/IPool";

export const erc20s = _.merge({}, erc20sOrig, {
  eth: {
    USDC: () => _.merge(erc20sOrig.eth.USDC(), { whale: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8" }),
    AAVE: () => erc20("AAVE", "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"),
    stkAAVE: () => erc20("stkAAVE", "0x4da27a545c0c5B758a6BA100e3a049001de870f5"),
  },
  poly: {
    USDC: () => _.merge(erc20sOrig.poly.USDC(), { whale: "0xBA12222222228d8Ba445958a75a0704d566BF2C8" }),
    WETH: () => _.merge(erc20sOrig.poly.WETH(), { whale: "0xBA12222222228d8Ba445958a75a0704d566BF2C8" }),
    DAI: () => _.merge(erc20sOrig.poly.DAI(), { whale: "0xBA12222222228d8Ba445958a75a0704d566BF2C8" }),
  },
  avax: {
    USDC: () => _.merge(erc20sOrig.avax.USDC(), { whale: "0x1da20Ac34187b2d9c74F729B85acB225D3341b25" }),
    USDCe: () => _.merge(erc20sOrig.avax.USDCe(), { whale: "0xA389f9430876455C36478DeEa9769B7Ca4E3DDB1" }),
  },
});

export const contracts = {
  eth: {
    // Aave_LendingPool: () => contract<AaveLendingPoolAbi>(require("../abi/AaveLendingPoolAbi.json"), "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"),
    // Aave_Incentives: () => contract<AaveIncentivesAbi>(require("../abi/AaveIncentivesAbi.json"), "0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5"),
  },
  poly: {
    // Aave_LendingPool: () => contract<AaveLendingPoolAbi>(require("../abi/AaveLendingPoolAbi.json"), "0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf"),
    // Aave_Incentives: () => contract<AaveIncentivesAbi>(require("../abi/AaveIncentivesAbi.json"), "0x357D51124f59836DeD84c8a1730D72B749d8BC23"),
  },
  avax: {
    AavePool: () => contract<IPool>(artifact("IPool").abi, "0x794a61358D6845594F94dc1DB02A252b5b4814aD"),
    AaveIncentives: () => contract(artifact("IRewardsController").abi, "0x929EC64c34a17401F460460D4B9390518E5B473e"),
  },
};

export const rewards = {
  eth: () => erc20s.eth.stkAAVE(),
  poly: () => erc20s.poly.WMATIC(),
  avax: () => erc20s.avax.WAVAX(),
};

export const weth = {
  eth: () => erc20s.eth.WETH(),
  poly: () => erc20s.poly.WMATIC(),
  avax: () => erc20s.avax.WAVAX(),
};
