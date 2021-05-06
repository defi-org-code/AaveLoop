# AaveLoop

## What is this

DeFi strategy to invest USDC in [Aave](https://aave.com/) in a loop in order to earn stkAAVE rewards for approx x7 of the initial investment.

## E2E Tests

Run test on a mainnet fork with Hardhat:

```
npm install
npm run build
npm run test
```

To see all event logs pass `--logs` to the test command.

## Contract deployment

1. Clone and initialize the repo:
   - `git clone`
   - `npm install`
   - `npm run build`
1. Create a new temporary address with a [mnemonic generator](https://iancoleman.io/bip39/) and import the private key to metamask.
1. Send 0.3ETH (enough for deployment) to the temp address (preferably from a cefi origin like Binance, so that it will be a "clean" account with no history)
1. `npm run deploy eth` and follow the prompts.
1. The deploy script will take care of everything, after deployment send any leftover funds back and BURN THE MNEMONIC!
1. A backup is created under `./deployments` just in case.
1. The contract is ready to be used by the owner.

## Management roles

- _Owner_ owns the contract and the funds inside. Can enter, exit and withdraw.

## Sending management transactions

It's recommended to take the ABI created during deployment and upload it as private [custom ABI](https://info.etherscan.com/custom-abi/) to Etherscan and this way we can easily use Etherscan's read/write interface (with Trezor) without publishing the contract source. (pass false at contract deployment to skip source upload).

## Monitoring against liquidations

- Call `getPositionData` to see that the liquidity is not dropping to `1` (approaching liquidation).

## Emergencies

If `exitPosition` fails, exit can be done manually:

1. Using a lower number in maxIterations. Partial exits are supported, will deleverage but stay in position.
2. Using multiple manual rollback transactions
3. The owner of the contract can also execute an arbitrary transaction using `emergencyFunctionCall` or `emergencyFunctionDelegateCall`. Check the tests.
4. By sending more USDC to the contract before running `exitPosition` again, this will reduce the numebr of exit iterations
