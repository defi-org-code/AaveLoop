import BN from "bn.js";
import path from "path";
import prompts from "prompts";
import { hre, web3 } from "./network";
import { fmt18, zero } from "./utils";
import { execSync } from "child_process";
import { deployContract } from "./extensions";

export async function deploy(contractName: string, args: string[] = [], gasLimit: number = 0, initialETH: BN = zero) {
  const timestamp = new Date().getTime();
  const deployer = await askDeployer();
  const gasPrice = await askGasPrice();

  await confirm(deployer, contractName, args, gasLimit, gasPrice);

  const backup = backupArtifacts(timestamp);

  const result = await deployContract(
    contractName,
    { from: deployer, gas: gasLimit, gasPrice: web3().utils.toWei(gasPrice, "gwei"), value: initialETH },
    args
  );
  const address = result.options.address;
  execSync(`mv ${backup} ${backup}/../${timestamp}-${address}`);

  await hre().run("verify:verify", {
    address: address,
    constructorArguments: args,
  });

  console.log("done");
}

function backupArtifacts(timestamp: number) {
  const dest = path.resolve(`./deployments/${timestamp}`);
  console.log("creating backup at", dest);
  execSync(`mkdir -p ${dest}`);
  execSync(`cp -r ./artifacts ${dest}`);
  return dest;
}

async function askDeployer() {
  const { privateKey } = await prompts({
    type: "password",
    name: "privateKey",
    message: "burner deployer private key with some ETH",
  });

  const account = web3().eth.accounts.privateKeyToAccount(privateKey);
  web3().eth.accounts.wallet.add(account);

  return account.address as string;
}

async function askGasPrice() {
  const { gas } = await prompts({
    type: "number",
    name: "gas",
    message: "gas price in gwei",
    validate: (s) => !!parseInt(s),
  });
  return gas.toString();
}

async function confirm(account: string, contractName: string, args: string[], gasLimit: number, gasPrice: number) {
  const balance = fmt18(await web3().eth.getBalance(account));
  const chainId = await web3().eth.getChainId();

  console.log("deploying!");
  console.log({ chainId, account, balance, contractName, args, gasLimit, gasPrice });
  const { ok } = await prompts({
    type: "confirm",
    name: "ok",
    message: "all ok?",
  });
  if (!ok) throw new Error("aborted");
}
