// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IAaveInterfaces.sol";

import "hardhat/console.sol"; // TODO remove

contract AaveLoop is Ownable {
    using SafeERC20 for IERC20;

    // ---- fields ----
    address public constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address public constant LENDING_POOL = address(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);
    address public constant AUSDC = address(0xBcca60bB61934080951369a648Fb03DF4F96263C); // aave USDC v2
    address public constant REWARD_TOKEN = address(0x4da27a545c0c5B758a6BA100e3a049001de870f5); // stkAAVE
    address public constant DEBT_TOKEN = address(0x619beb58998eD2278e08620f97007e1116D5D25b); // Aave variable debt bearing USDC (variableD...)
    address public constant LIQUIDITY_MINING = address(0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5); // IncentivesController
    uint256 public constant BASE_PERCENT = 100_000; // percentmil == 1/100,000

    // ---- events ----
    event LogDeposit(uint256 amount);
    event LogWithdraw(uint256 amount);
    event LogBorrow(uint256 amount);
    event LogRepay(uint256 amount);

    // ---- Constructor ----

    constructor(address owner) {
        transferOwnership(owner);
        IERC20(USDC).safeApprove(LENDING_POOL, type(uint256).max);
    }

    // ---- views ----

    function getBalanceAUSDC() public view returns (uint256) {
        return IERC20(AUSDC).balanceOf(address(this));
    }

    function getBalanceDebtToken() public view returns (uint256) {
        return IERC20(DEBT_TOKEN).balanceOf(address(this));
    }

    function getBalanceUSDC() public view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }

    function getBalanceReward() public view returns (uint256) {
        return IAaveIncentivesController(LIQUIDITY_MINING).getRewardsBalance(getRewardTokenAssets(), address(this));
    }

    function getPercentLTV() public view returns (uint256) {
        (, , , , uint256 ltv, ) = ILendingPool(LENDING_POOL).getUserAccountData(address(this));
        return ltv * 10; // from 10,000 to PCM_BASE
    }

    function getHealthFactor() public view returns (uint256) {
        (, , , , , uint256 healthFactor) = ILendingPool(LENDING_POOL).getUserAccountData(address(this));
        return healthFactor;
    }

    function claimRewardsToOwner() external {
        IAaveIncentivesController(LIQUIDITY_MINING).claimRewards(getRewardTokenAssets(), type(uint256).max, owner());
    }

    // ---- main ----

    function enterPosition(uint256 iterations) external onlyOwner {
        uint256 balanceUSDC = getBalanceUSDC();
        require(balanceUSDC > 0, "insufficient funds");

        for (uint256 i = 0; i < iterations; i++) {
            _deposit(balanceUSDC);
            uint256 borrowAmount = (balanceUSDC * getPercentLTV()) / BASE_PERCENT;
            _borrow(borrowAmount);
            balanceUSDC = getBalanceUSDC();
        }

        _deposit(balanceUSDC);
    }

    function exitPosition() external onlyOwner {
        while (getBalanceDebtToken() > 0) {
            uint256 amountToWithdraw = getBalanceAUSDC() - ((getBalanceDebtToken() * BASE_PERCENT) / getPercentLTV());
            _withdraw(amountToWithdraw);
            _repay(getBalanceUSDC());
        }
        _withdraw(type(uint256).max);
    }

    // ---- internals ----

    function _deposit(uint256 amount) public onlyOwner {
        ILendingPool(LENDING_POOL).deposit(USDC, amount, address(this), 0);
        emit LogDeposit(amount);
    }

    function _borrow(uint256 amount) public onlyOwner {
        ILendingPool(LENDING_POOL).borrow(USDC, amount, 2, 0, address(this));
        emit LogBorrow(amount);
    }

    function _withdraw(uint256 amount) public onlyOwner {
        ILendingPool(LENDING_POOL).withdraw(USDC, amount, address(this));
        emit LogWithdraw(amount);
    }

    function _repay(uint256 amount) public onlyOwner {
        ILendingPool(LENDING_POOL).repay(USDC, amount, 2, address(this));
        emit LogRepay(amount);
    }

    function getRewardTokenAssets() internal pure returns (address[] memory) {
        address[] memory addresses = new address[](2);
        addresses[0] = AUSDC;
        addresses[1] = DEBT_TOKEN;
        return addresses;
    }

    // ---- emergency ----

    function withdrawToOwner(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        IERC20(asset).safeTransfer(owner(), balance);
    }

    function emergencyFunctionCall(address target, bytes memory data) external onlyOwner {
        Address.functionCall(target, data);
    }

    function emergencyFunctionDelegateCall(address target, bytes memory data) external onlyOwner {
        Address.functionDelegateCall(target, data);
    }
}
