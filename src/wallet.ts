import { web3 } from "./network";

export class Wallet {
  static async fake(index: number = 0) {
    const accounts: string[] = await web3().eth.getAccounts();
    return this.fromAddress(`fake${index}`, accounts[index]);
  }

  static random() {
    return this.fromAddress("random", web3().eth.accounts.create().address);
  }

  private static fromAddress(name: string, address: string) {
    return new Wallet(name, address);
  }

  private constructor(public name: string, public address: string) {
    console.log(name, "wallet address:", address);
  }

  setAsDefaultSigner() {
    web3().eth.defaultAccount = this.address;
    console.log("default signer:", this.address);
  }
}
