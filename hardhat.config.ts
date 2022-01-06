import { HardhatUserConfig } from "hardhat/types";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-tracer";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-etherscan";
import { task } from "hardhat/config";
import { bn18, networks } from "@defi.org/web3-candies";
import { askAddress, deploy } from "@defi.org/web3-candies/dist/hardhat/deploy";

task("deploy").setAction(async () => {
  const owner = await askAddress("owner address 0x");
  const gasLimit = 2_000_000;
  await deploy("AaveLoop", [owner], gasLimit, 0, true, 0);
});

const configFile = () => require("./.config.json");

export default {
  solidity: {
    version: "0.8.6",
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
        blockNumber: process.env.BLOCK_NUMBER ? parseInt(process.env.BLOCK_NUMBER!) : undefined,
        url: configFile()[`NODE_URL_${process.env.NETWORK?.toUpperCase() || "ETH"}`] as string,
      },
      blockGasLimit: 12e6,
      accounts: {
        accountsBalance: bn18("1,000,000").toString(),
      },
    },
    eth: {
      chainId: networks.eth.id,
      url: configFile().NODE_URL_ETH,
    },
    poly: {
      chainId: networks.poly.id,
      url: configFile().NODE_URL_POLY,
    },
    avax: {
      chainId: networks.avax.id,
      url: configFile().NODE_URL_AVAX,
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
} as HardhatUserConfig;
