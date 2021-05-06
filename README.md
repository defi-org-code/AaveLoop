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

1. Check that `hardhat.config.ts` has all the correct deployment arguments, like constructor args and gas limit and wether or not to upload sources.
2. Create a new temporary wallet address with a mnemonic generator and import to metamask.
3. Send some initial ETH to the temp address (preferably from a cefi origin like Binance, so that it will be a "clean" account with no history)
4. `npm run deploy eth` and follow the prompts.
5. The deploy script will take care of everything, after deployment send any leftover funds back and BURN THE MNEMONIC
6. The contract is ready to be used by the owner.

## Management roles

- _Owner_ owns the contract and the funds inside. Can enter, exit and withdraw.

## Sending management transactions

It's recommended to take the ABI created during deployment and upload it as private [custom ABI](https://info.etherscan.com/custom-abi/) to Etherscan and this way we can easily use Etherscan's read/write interface (with Trezor) without publishing the contract source. (pass false at contract deployment to skip source upload).

## Gas costs

- Entering/exiting with $1M inside (with $10K minimum) takes ~5.5M gas
- Entering/exiting with $5M inside (with $50K minimum) also takes ~5.5M gas
- Claim COMP takes ~1M gas

## Monitoring against liquidations

- Call `getPositionData` to see that the liquidity is not dropping to `1` (approaching liquidation). The liquidity should usually increase over time since combined interest rate should be positive.
- For more exact results, it's better to static call (from a script) `getAccountLiquidityWithInterest` since this takes the latest interest into account too.

## Emergencies

If `exitPosition` fails, exit can be done manually:

1. Using multiple manual rollback transactions, see [test #3](https://github.com/defi-org-code/AaveLoop/issues/4)

2. The owner of the contract can also execute an arbitrary transaction using `emergencySubmitTransaction`

3. By sending more USDC to the contract before running `exitPosition` again, this will reduce the numebr of exit iterations

4. By limiting the number of allowed iterations in `exitPosition` or reducing redeemRatio below 1
