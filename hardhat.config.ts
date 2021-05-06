import { HardhatUserConfig } from "hardhat/types";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-tracer";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-etherscan";
import { task } from "hardhat/config";
import { configFile } from "./src/configFile";
import { bn18 } from "./src/utils";
import { deploy } from "./src/deploy";
import prompts from "prompts";
import { web3 } from "./src/network";

task("deploy").setAction(async () => {
  const name = "AaveLoop";
  const owner = await askOwner();
  const gasLimit = 2_000_000;

  await deploy(name, [owner], gasLimit, 0, false);
});

async function askOwner() {
  const { owner } = await prompts({
    type: "text",
    name: "owner",
    message: "owner",
    validate: (s) => web3().utils.isAddress(s),
  });
  if (!owner) throw new Error("aborted");
  return owner.toString();
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        blockNumber: 12379550,
        url: "https://eth-mainnet.alchemyapi.io/v2/" + configFile().alchemyKey,
      },
      blockGasLimit: 12e6,
      accounts: {
        accountsBalance: bn18("1,000,000").toString(),
      },
    },
    eth: {
      chainId: 1,
      url: "https://eth-mainnet.alchemyapi.io/v2/" + configFile().alchemyKey,
    },
  },
  typechain: {
    outDir: "typechain-hardhat",
    target: "web3-v1",
  },
  mocha: {
    timeout: 240_000,
    retries: 1,
    bail: true,
  },
  gasReporter: {
    currency: "USD",
    coinmarketcap: configFile().coinmarketcapKey,
    showTimeSpent: true,
  },
  etherscan: {
    apiKey: configFile().etherscanKey,
  },
};
export default config;
