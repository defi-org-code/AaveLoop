import { web3 } from "./network";
import { bn } from "./utils";
import prompts from "prompts";

export class Wallet {
  static async realBurnerDeployer() {
    const { privateKey } = await prompts({
      name: "privateKey",
      message: "burner deployer private key",
      type: "password",
    });
    const account = web3().eth.accounts.privateKeyToAccount(privateKey);
    return this.fromAddress("burner deployer", account.address, account.privateKey);
  }

  static async fake(index: number = 0) {
    const accounts: string[] = await web3().eth.getAccounts();
    return this.fromAddress(`fake${index}`, accounts[index]);
  }

  static random() {
    return this.fromAddress("random", web3().eth.accounts.create().address);
  }

  private static fromAddress(name: string, address: string, privateKeyForDeployment: string = address) {
    return new Wallet(name, address, privateKeyForDeployment);
  }

  private constructor(public name: string, public address: string, public privateKeyForDeployment: string) {
    console.log(name, "wallet address:", address);
  }

  async getBalance() {
    return bn(await web3().eth.getBalance(this.address));
  }

  setAsDefaultSigner() {
    web3().eth.defaultAccount = this.address;
    console.log("default signer:", this.address);
  }
}
