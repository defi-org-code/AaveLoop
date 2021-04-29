# AaveLoop

## What is this

DeFi strategy to invest USDC in [Aave](https://aave.com/) in a loop in order to earn COMP rewards for approx x7 of the initial investment.

## E2E Tests

The tests are explained [here](https://github.com/defi-org-code/AaveLoop/issues/4). Run them on a mainnet fork with Hardhat:

```
npm install
npm run test
```

## Contract deployment

It's recommended to use [Remix](https://remix.ethereum.org/) to deploy the contract using Trezor. Instructions:

1. Create a clean Remix project and upload `/contracts/*.sol` into the Remix `/contracts` directory
2. Fix OpenZepplin imports in all files by replacing `@openzeppelin` with `https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.3.0`
3. Under *Solidity Compiler* tab:
    * Set `Enable optimization: 200` 
    * Click `Compile AaveLoop.sol` 
    * After compilation, copy its ABI by clicking `ABI` below
  
4. Under *Deploy & run transactions* tab: 
    * Set `Environment: Injected Web3`
    * Set `Gas limit: 4000000`
    * Near deploy, set `address _manager` to your Trezor address
    * Click `Deploy`

## Management roles

* *Owner* can withdraw funds
* *Manager* can enter/exit the position in Aave

For simplicity, you can leave both roles as the deployer Trezor account since handling the contract can be manual (no bot needed).

## Sending management transactions

It's recommended to take the ABI created during deployment and upload it as private [custom ABI](https://info.etherscan.com/custom-abi/) to Etherscan and this way we can easily use Etherscan's read/write interface (with Trezor) without publishing the contract source.

## Gas costs

* Entering/exiting with $1M inside (with $10K minimum) takes ~5.5M gas
* Entering/exiting with $5M inside (with $50K minimum) also takes ~5.5M gas
* Claim COMP takes ~1M gas

## Monitoring against liquidations

* Call `getAccountLiquidity` to see that the liquidity is not dropping to zero (approaching liquidation). The liquidity should usually increase over time since combined interest rate should be positive.
* For more exact results, it's better to static call (from a script) `getAccountLiquidityWithInterest` since this takes the latest interest into account too.

## Emergencies

If `exitPosition` fails, exit can be done manually:

1. Using multiple manual rollback transactions, see [test #3](https://github.com/defi-org-code/AaveLoop/issues/4)

2. The owner of the contract can also execute an arbitrary transaction using `emergencySubmitTransaction`

3. By sending more USDC to the contract before running `exitPosition` again, this will reduce the numebr of exit iterations

4. By limiting the number of allowed iterations in `exitPosition` or reducing redeemRatio below 1
