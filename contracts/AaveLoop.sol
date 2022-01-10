// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./IAaveInterfaces.sol";
import "./ImmutableOwnable.sol";

/**
 * Single asset leveraged reborrowing strategy on AAVE, chain agnostic.
 * Position managed by this contract, with full ownership and control by Owner.
 * Monitor position health to avoid liquidation.
 */
contract AaveLoop is ImmutableOwnable {
    using SafeERC20 for ERC20;

    ERC20 public immutable ASSET; // solhint-disable-line
    ILendingPool public immutable LENDING_POOL; // solhint-disable-line
    IAaveIncentivesController public immutable INCENTIVES; // solhint-disable-line

    /**
     * @param owner The contract owner, has complete ownership, immutable
     * @param asset The target underlying asset ex. USDC
     * @param lendingPool The deployed AAVE ILendingPool
     * @param incentives The deployed AAVE IAaveIncentivesController
     */
    constructor(
        address owner,
        address asset,
        address lendingPool,
        address incentives
    ) ImmutableOwnable(owner) {
        require(asset != address(0) && lendingPool != address(0) && incentives != address(0), "address 0");

        ASSET = ERC20(asset);
        LENDING_POOL = ILendingPool(lendingPool);
        INCENTIVES = IAaveIncentivesController(incentives);
    }

    // ---- views ----

    function getSupplyAndBorrowAssets() public view returns (address[] memory assets) {
        DataTypes.ReserveData memory data = LENDING_POOL.getReserveData(address(ASSET));
        assets = new address[](2);
        assets[0] = data.aTokenAddress;
        assets[1] = data.variableDebtTokenAddress;
    }

    /**
     * @return The ASSET price in ETH according to Aave PriceOracle, used internally for all ASSET amounts calculations
     */
    function getAssetPrice() public view returns (uint256) {
        return IAavePriceOracle(LENDING_POOL.getAddressesProvider().getPriceOracle()).getAssetPrice(address(ASSET));
    }

    /**
     * @return total supply balance in ASSET
     */
    function getSupplyBalance() public view returns (uint256) {
        (uint256 totalCollateralETH, , , , , ) = getPositionData();
        return (totalCollateralETH * (10**ASSET.decimals())) / getAssetPrice();
    }

    /**
     * @return total borrow balance in ASSET
     */
    function getBorrowBalance() public view returns (uint256) {
        (, uint256 totalDebtETH, , , , ) = getPositionData();
        return (totalDebtETH * (10**ASSET.decimals())) / getAssetPrice();
    }

    /**
     * @return available liquidity in ASSET
     */
    function getLiquidity() public view returns (uint256) {
        (, , uint256 availableBorrowsETH, , , ) = getPositionData();
        return (availableBorrowsETH * (10**ASSET.decimals())) / getAssetPrice();
    }

    /**
     * @return ASSET balanceOf(this)
     */
    function getAssetBalance() public view returns (uint256) {
        return ASSET.balanceOf(address(this));
    }

    /**
     * @return Pending rewards
     */
    function getPendingRewards() public view returns (uint256) {
        return INCENTIVES.getRewardsBalance(getSupplyAndBorrowAssets(), address(this));
    }

    /**
     * Position data from Aave
     */
    function getPositionData()
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
        return LENDING_POOL.getUserAccountData(address(this));
    }

    /**
     * @return LTV of ASSET in 4 decimals ex. 82.5% == 8250
     */
    function getLTV() public view returns (uint256) {
        DataTypes.ReserveConfigurationMap memory config = LENDING_POOL.getConfiguration(address(ASSET));
        return config.data & 0xffff; // bits 0-15 in BE
    }

    // ---- unrestricted ----

    /**
     * Claims and transfers all pending rewards to OWNER
     */
    function claimRewardsToOwner() external {
        INCENTIVES.claimRewards(getSupplyAndBorrowAssets(), type(uint256).max, OWNER);
    }

    // ---- main ----

    /**
     * @param iterations - Loop count
     * @return Liquidity at end of the loop
     */
    function enterPositionFully(uint256 iterations) external onlyOwner returns (uint256) {
        return enterPosition(ASSET.balanceOf(msg.sender), iterations);
    }

    /**
     * @param principal - ASSET transferFrom sender amount, can be 0
     * @param iterations - Loop count
     * @return Liquidity at end of the loop
     */
    function enterPosition(uint256 principal, uint256 iterations) public onlyOwner returns (uint256) {
        if (principal > 0) {
            ASSET.safeTransferFrom(msg.sender, address(this), principal);
        }

        if (getAssetBalance() > 0) {
            _supply(getAssetBalance());
        }

        for (uint256 i = 0; i < iterations; i++) {
            _borrow(getLiquidity());
            _supply(getAssetBalance());
        }

        return getLiquidity();
    }

    /**
     * @param iterations - MAX loop count
     * @return Withdrawn amount of ASSET to OWNER
     */
    function exitPosition(uint256 iterations) external onlyOwner returns (uint256) {
        (, , , , uint256 ltv, ) = getPositionData(); // 4 decimals

        for (uint256 i = 0; i < iterations && getBorrowBalance() > 0; i++) {
            _redeemSupply((getLiquidity() * 1e4) / ltv);
            _repayBorrow(getAssetBalance());
        }

        if (getBorrowBalance() == 0) {
            _redeemSupply(type(uint256).max);
        }

        return _withdrawToOwner(address(ASSET));
    }

    // ---- internals, public onlyOwner in case of emergency ----

    /**
     * amount in ASSET
     */
    function _supply(uint256 amount) public onlyOwner {
        ASSET.safeIncreaseAllowance(address(LENDING_POOL), amount);
        LENDING_POOL.deposit(address(ASSET), amount, address(this), 0);
    }

    /**
     * amount in ASSET
     */
    function _borrow(uint256 amount) public onlyOwner {
        LENDING_POOL.borrow(address(ASSET), amount, 2, 0, address(this));
    }

    /**
     * amount in ASSET
     */
    function _redeemSupply(uint256 amount) public onlyOwner {
        LENDING_POOL.withdraw(address(ASSET), amount, address(this));
    }

    /**
     * amount in ASSET
     */
    function _repayBorrow(uint256 amount) public onlyOwner {
        ASSET.safeIncreaseAllowance(address(LENDING_POOL), amount);
        LENDING_POOL.repay(address(ASSET), amount, 2, address(this));
    }

    function _withdrawToOwner(address asset) public onlyOwner returns (uint256) {
        uint256 balance = ERC20(asset).balanceOf(address(this));
        ERC20(asset).safeTransfer(OWNER, balance);
        return balance;
    }

    // ---- emergency ----

    function emergencyFunctionCall(address target, bytes memory data) external onlyOwner {
        Address.functionCall(target, data);
    }

    function emergencyFunctionDelegateCall(address target, bytes memory data) external onlyOwner {
        Address.functionDelegateCall(target, data);
    }
}
