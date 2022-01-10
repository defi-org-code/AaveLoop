import _ from "lodash";
import { erc20s as erc20sOrig, contracts as contractsOrig } from "@defi.org/web3-candies/dist/erc20";

export const erc20s = _.merge({}, erc20sOrig, {
  eth: {
    USDC: () => _.merge(erc20sOrig.eth.USDC(), { whale: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8" }),
  },
  poly: {
    USDC: () => _.merge(erc20sOrig.poly.USDC(), { whale: "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245" }),
  },
  avax: {
    USDC: () => erc20s.avax.USDCe(),
    USDCe: () => _.merge(erc20sOrig.avax.USDCe(), { whale: "0xCe2CC46682E9C6D5f174aF598fb4931a9c0bE68e" }),
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