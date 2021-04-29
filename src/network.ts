import _ from "lodash";
import { Artifact } from "hardhat/types";
import { TransactionReceipt } from "web3-core";

const parseReceiptEvents = require("web3-parse-receipt-events");

function hre() {
  return require("hardhat");
}

export function web3() {
  return hre().web3;
}

export function network() {
  return hre().network;
}

export function artifact(name: string): Artifact {
  return hre().artifacts.readArtifactSync(name);
}

export function tag(address: string, name: string) {
  hre().tracer.nameTags[address] = name;
}

export async function impersonate(address: string) {
  console.log("impersonating", address);
  await network().provider.send("hardhat_impersonateAccount", [address]);
}

export async function resetNetworkFork(blockNumber: number = forkingBlockNumber()) {
  console.log("resetNetworkFork");
  await network().provider.send("hardhat_reset", [
    {
      forking: {
        blockNumber,
        jsonRpcUrl: forkingUrl(),
      },
    },
  ]);
  console.log("block", await web3().eth.getBlockNumber());
}

export async function advanceTime(seconds: number) {
  console.log(`advancing time by ${seconds} seconds`);
  const startBlock = await web3().eth.getBlockNumber();
  const startBlockTime = (await web3().eth.getBlock(startBlock)).timestamp;

  const secondsPerBlock = 13;
  const blocks = Math.round(seconds / secondsPerBlock);
  for (let i = 0; i < blocks; i++) {
    await network().provider.send("evm_increaseTime", [secondsPerBlock]);
    await network().provider.send("evm_mine", [1 + startBlockTime + secondsPerBlock * i]);
  }
  const nowBlock = await web3().eth.getBlockNumber();
  console.log("was block", startBlock.toFixed(), "now block", nowBlock);
  console.log(
    "was block time",
    startBlockTime.toFixed(),
    "now block time",
    (await web3().eth.getBlock(nowBlock)).timestamp
  );
}

export function parseEvents(abis: any[], address: string, tx: TransactionReceipt) {
  parseReceiptEvents(abis, address, tx);
}

function forkingBlockNumber() {
  return _.get(network().config, "forking.blockNumber");
}

function forkingUrl() {
  return _.get(network().config, "forking.url");
}
