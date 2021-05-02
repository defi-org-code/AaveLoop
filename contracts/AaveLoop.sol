// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./IAaveInterfaces.sol";

import "hardhat/console.sol"; // TODO remove

contract AaveLoop is Ownable {
    using SafeERC20 for IERC20;

    // --- fields ---
    address public constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address public constant LENDING_POOL = address(0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9);
    address public constant AUSDC = address(0xBcca60bB61934080951369a648Fb03DF4F96263C); // aave USDC v2
    address public constant DTOKEN = address(0x619beb58998eD2278e08620f97007e1116D5D25b); // variable debt token
    address public constant REWARD_TOKEN = address(0x4da27a545c0c5B758a6BA100e3a049001de870f5); // stkAAVE
    address public constant DEBT_TOKEN = address(0x619beb58998eD2278e08620f97007e1116D5D25b); // Aave variable debt bearing USDC (variableD...)
    uint256 public constant BASE_PERCENT = 100_000; // percentmil == 1/100,000

    // --- events ---
    event LogDeposit(uint256 amount);
    event LogWithdraw(uint256 amount);
    event LogBorrow(uint256 amount);
    event LogRepay(uint256 amount);

    // --- Constructor ---

    constructor(address owner) {
        transferOwnership(owner);
        IERC20(USDC).safeApprove(LENDING_POOL, type(uint256).max);
        IERC20(AUSDC).safeApprove(LENDING_POOL, type(uint256).max);
    }

    // --- views ---

    function getBalanceAUSDC() public view returns (uint256) {
        return IERC20(AUSDC).balanceOf(address(this));
    }

    function getBalanceDebtToken() public view returns (uint256) {
        return IERC20(DEBT_TOKEN).balanceOf(address(this));
    }

    function getBalanceUSDC() public view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }

    function getHealthFactor() public view returns (uint256) {
        (, , , , , uint256 healthFactor) = getUserAccountData();
        return healthFactor;
    }

    function getPercentLTV() public view returns (uint256) {
        (, , , , uint256 ltv,) = getUserAccountData();
        return ltv * 10;
        // from 10,000 to PCM_BASE
    }

    function getUserAccountData()
    public
    view
    returns (
        uint256 totalCollateralETH,
        uint256 totalDebtETH,
        uint256 availableBorrowsETH,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    )
    {
        return ILendingPool(LENDING_POOL).getUserAccountData(address(this));
    }

    // --- unrestricted actions ---

    function claimRewardsToOwner() external {
        IStakedAave(REWARD_TOKEN).claimRewards(owner(), type(uint256).max);
    }

    // --- main ---

    function enterPosition(uint256 iterations) external onlyOwner {
        uint256 balanceUSDC = getBalanceUSDC();
        require(balanceUSDC > 0, "insufficient funds");

        for (uint256 i = 0; i < iterations; i++) {
            _deposit(balanceUSDC);
            uint256 borrowAmount = (balanceUSDC * getPercentLTV()) / BASE_PERCENT;
            _borrow(borrowAmount - 1e6);
            // $1 buffer for rounding errors
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

    //
    //    // --- withdraw assets by owner ---
    //
    //    function claimAndTransferAllCompToOwner() public onlyManagerOrOwner {
    //        uint256 balance = claimComp();
    //        if (balance > 0) {
    //            IERC20(COMP).safeTransfer(owner(), balance);
    //        }
    //    }
    //
    //    function safeTransferUSDCToOwner() public onlyOwner {
    //        uint256 usdcBalance = underlyingBalance();
    //        if (usdcBalance > 0) {
    //            IERC20(USDC).safeTransfer(owner(), usdcBalance);
    //        }
    //    }
    //
    //    function safeTransferAssetToOwner(address src) public onlyOwner {
    //        uint256 balance = IERC20(src).balanceOf(address(this));
    //        if (balance > 0) {
    //            IERC20(src).safeTransfer(owner(), balance);
    //        }
    //    }
    //
    //    function transferFrom(address src_, uint256 amount_) public onlyOwner {
    //        IERC20(USDC).transferFrom(src_, address(this), amount_);
    //    }
    //
    // function setApprove() public onlyManagerOrOwner {
    //        if (IERC20(USDC).allowance(address(this), CUSDC) != uint256(-1)) {
    //            IERC20(USDC).approve(CUSDC, uint256(-1));
    //        }
    //    }
    //

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

    //    function redeemCToken(uint256 amount) public onlyManagerOrOwner {
    //        require(CERC20(CUSDC).redeem(amount) == 0, "redeem failed");
    //        emit LogRedeem(CUSDC, address(this), amount);
    //    }
    //
    //    function redeemUnderlying(uint256 amount) public onlyManagerOrOwner {
    //        require(CERC20(CUSDC).redeemUnderlying(amount) == 0, "redeemUnderlying failed");
    //        emit LogRedeemUnderlying(CUSDC, address(this), amount);
    //    }
    //
    //    function repayBorrow(uint256 amount) public onlyManagerOrOwner {
    //        require(CERC20(CUSDC).repayBorrow(amount) == 0, "repayBorrow failed");
    //        emit LogRepay(CUSDC, address(this), amount);
    //    }
    //
    //    function repayBorrowAll() public onlyManagerOrOwner {
    //        uint256 usdcBalance = underlyingBalance();
    //        if (usdcBalance > borrowBalanceCurrent()) {
    //            require(CERC20(CUSDC).repayBorrow(uint256(-1)) == 0, "repayBorrow -1 failed");
    //            emit LogRepay(CUSDC, address(this), uint256(-1));
    //        } else {
    //            require(CERC20(CUSDC).repayBorrow(usdcBalance) == 0, "repayBorrow failed");
    //            emit LogRepay(CUSDC, address(this), usdcBalance);
    //        }
    //    }
    //
    //    // --- emergency ---
    //
    //    function emergencyTransferAsset(
    //        address asset_,
    //        address to_,
    //        uint256 amount_
    //    ) public onlyOwner {
    //        IERC20(asset_).transfer(to_, amount_);
    //    }
    //
    //    function emergencySafeTransferAsset(
    //        address asset_,
    //        address to_,
    //        uint256 amount_
    //    ) public onlyOwner {
    //        IERC20(asset_).safeTransfer(to_, amount_);
    //    }
    //
    //    function emergencyTransferAll(address[] memory tokens_, address to_) public onlyOwner {
    //        uint256 ercLen = tokens_.length;
    //        for (uint256 i = 0; i < ercLen; i++) {
    //            IERC20 erc = IERC20(tokens_[i]);
    //            uint256 balance = erc.balanceOf(address(this));
    //            if (balance > 0) {
    //                erc.safeTransfer(to_, balance);
    //            }
    //        }
    //    }
    //
    //    function emergencySubmitTransaction(
    //        address destination,
    //        bytes memory data,
    //        uint256 gasLimit
    //    ) public onlyOwner returns (bool) {
    //        uint256 dataLength = data.length;
    //        bool result;
    //        // solhint-disable-next-line
    //        assembly {
    //            let x := mload(0x40) // memory for output
    //            let d := add(data, 32) // first 32 bytes are the padded length of data, so exclude that
    //            result := call(
    //                gasLimit,
    //                destination,
    //                0, // value is ignored
    //                d,
    //                dataLength,
    //                x,
    //                0 // output is ignored
    //            )
    //        }
    //        return result;
    //    }
}
