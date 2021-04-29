import { HardhatRuntimeEnvironment } from "hardhat/types";
import "hardhat-deploy";
import { Wallet } from "../src/wallet";
import { fmt18 } from "../src/utils";

const main = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = await hre.deployments;

  const wallet = hre.network.live ? await Wallet.realBurnerDeployer() : await Wallet.fake();

  console.log("deployer balance", fmt18(await wallet.getBalance()));
  console.log("deploying NexusLPSushi on network", await hre.getChainId());

  const res = await deploy("NexusLPSushi", {
    from: wallet.privateKeyForDeployment,
    args: [],
    log: true,
    gasLimit: 5_000_000,
  });

  await hre.run("verify", { address: res.address });
};
export default main;
