import { contract } from "./extensions";
import { ERC20 } from "../typechain-hardhat/ERC20";
import { tag } from "./network";

const abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json").abi;

export function WETH() {
  return newToken("$WETH", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
}

export function USDC() {
  return newToken("$USDC", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
}

export function stkAAVE() {
  return newToken("$stkAAVE", "0x4da27a545c0c5B758a6BA100e3a049001de870f5");
}

export interface Token extends ERC20 {
  displayName: string;
}

export function newToken(name: string, address: string) {
  const token = contract<Token>(abi, address);
  token.displayName = name;
  tag(address, name);
  return token;
}
