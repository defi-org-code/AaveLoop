# AaveLoop

## What is this

A self-deployed DeFi strategy for Leveraged Reborrowing (borrow-supply loop) of a single supported asset (such as USDC) on [Aave](https://aave.com/) to maximize yield.

Cross-asset loops are not (yet?) supported.

All funds are fully controlled by the contract owner, as provided to the constructor at deployment.
All values are immutable, contract is only accesible to owner, with the exception of `claimRewardsToOwner` which can be called by anyone.

Supported networks:

- Ethereum
- Avalanche
- Polygon

> Use at your own risk

## E2E Tests

Run test on a mainnet fork with Hardhat:

```
npm install
npm run build
npm run test
npm run test:avax
npm run test:poly
```

## Contract deployment

1. Clone and initialize the repo:
   - `git clone`
   - create a .config.json file in root with keys as shown below
   - `npm install`
   - `npm run build`
1. Enter your infura/alchemy endpoint in `hardhat.config.ts` under `networks.eth.url`
1. Create a new temporary address with a [mnemonic generator](https://iancoleman.io/bip39/) and import the private key to metamask
1. Send enough ETH for deployment to the temp address
1. `npm run deploy eth` and follow the prompts
1. The deploy script will take care of everything, after deployment send any leftover funds back and burn the temp private keys
1. A backup is created under `./deployments` just in case
1. The contract is ready to be used by the owner
1. To add custom abi to etherscan, use the ABI in `deployments/*/artifacts/contracts/AaveLoop.sol/AaveLoop.json`

### expected .config.json
```json
{
  "NODE_URL_ETH": "",
  "NODE_URL_POLY": "",
  "NODE_URL_AVAX": "",
  "coinmarketcapKey": "",
  "ETHERSCAN_ETH": "",
  "ETHERSCAN_POLY": "",
  "ETHERSCAN_AVAX": ""
}
```


## Management roles

- _Owner_ owns the contract and the funds inside. Can enter, exit and withdraw.

## Sending management transactions

It's recommended to take the ABI created during deployment and upload it as private [custom ABI](https://info.etherscan.com/custom-abi/) to Etherscan and this way we can easily use Etherscan's read/write interface without publishing the contract source. (pass false at contract deployment to skip source upload).

## Monitoring against liquidations

- Call `getPositionData` or `getLiquidity` to monitor liquidity decrease over time.
- If `healthFactor < 1e18` or `liquidity = 0` the position will be liquidated! it is recommended not to go below `0.5%-1%` of the principal.

## Emergencies

If `exitPosition` fails due to hittin gas limit, exit can be done manually:

1. Using a lower number in iterations. Partial exits are supported, will de-leverage but stay in position
2. Using multiple manual rollback transactions
3. The owner of the contract can also execute an arbitrary transaction using `emergencyFunctionCall` or `emergencyFunctionDelegateCall`. Check the tests.
4. By sending more of the asset to the contract before running `exitPosition` again, this will reduce the number of exit iterations
