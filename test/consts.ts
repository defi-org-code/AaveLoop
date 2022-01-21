import _ from "lodash";
import { erc20s as erc20sOrig, contracts as contractsOrig } from "@defi.org/web3-candies/dist/erc20";

export const erc20s = _.merge({}, erc20sOrig, {
  eth: {
    USDC: () => _.merge(erc20sOrig.eth.USDC(), { whale: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8" }),
  },
  poly: {
    USDC: () => _.merge(erc20sOrig.poly.USDC(), { whale: "0xBA12222222228d8Ba445958a75a0704d566BF2C8" }),
    WETH: () => _.merge(erc20sOrig.poly.WETH(), { whale: "0xBA12222222228d8Ba445958a75a0704d566BF2C8" }),
    DAI: () => _.merge(erc20sOrig.poly.DAI(), { whale: "0xBA12222222228d8Ba445958a75a0704d566BF2C8" }),
  },
  avax: {
    USDC: () => erc20s.avax.USDCe(),
    USDCe: () => _.merge(erc20sOrig.avax.USDCe(), { whale: "0xA389f9430876455C36478DeEa9769B7Ca4E3DDB1" }),
  },
});

export const contracts = _.merge({}, contractsOrig, {
  eth: {
    //
  },
  poly: {
    //
  },
  avax: {
    //
  },
});

export const rewards = {
  eth: () => erc20s.eth.Aave_stkAAVE(),
  poly: () => erc20s.poly.WMATIC(),
  avax: () => erc20s.avax.WAVAX(),
};

export const weth = {
  eth: () => erc20s.eth.WETH(),
  poly: () => erc20s.poly.WMATIC(),
  avax: () => erc20s.avax.WAVAX(),
};
