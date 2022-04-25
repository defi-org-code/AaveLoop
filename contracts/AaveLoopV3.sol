// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./ImmutableOwnable.sol";
import "./IAave.sol";

/**
 * Single asset leveraged reborrowing strategy on AAVE, chain agnostic.
 * Position managed by this contract, with full ownership and control by Owner.
 * Monitor position health to avoid liquidation.
 */
contract AaveLoopV3 is ImmutableOwnable, IFlashLoanReceiver {
    using SafeERC20 for ERC20;

    uint256 public constant USE_VARIABLE_DEBT = 2;
    uint8 public constant EMODE = 1;

    ERC20 public immutable ASSET; // solhint-disable-line
    IPool public immutable POOL; // solhint-disable-line
    IAaveIncentivesController public immutable INCENTIVES; // solhint-disable-line

    /**
     * @param owner The contract owner, has complete ownership, immutable
     * @param asset The target underlying asset ex. USDC
     * @param pool The deployed AAVE IPool
     * @param incentives The deployed AAVE IAaveIncentivesController
     */
    constructor(
        address owner,
        address asset,
        address pool,
        address incentives
    ) ImmutableOwnable(owner) {
        require(asset != address(0) && pool != address(0) && incentives != address(0), "E0");

        ASSET = ERC20(asset);
        POOL = IPool(pool);
        INCENTIVES = IAaveIncentivesController(incentives);
    }

    // ------------------------------------------------ views ------------------------------------------------

    function getSupplyAndBorrowAssets() public view returns (address[] memory assets) {
        DataTypes.ReserveData memory data = POOL.getReserveData(address(ASSET));
        assets = new address[](2);
        assets[0] = data.aTokenAddress;
        assets[1] = data.variableDebtTokenAddress;
    }

    /**
     * @return The ASSET price in Base token, according to Aave PriceOracle, used internally for all ASSET amounts
     */
    function getAssetPrice() public view returns (uint256) {
        return IPriceOracle(POOL.ADDRESSES_PROVIDER().getPriceOracle()).getAssetPrice(address(ASSET));
    }

    /**
     * @return total supply balance in ASSET
     */
    function getSupplyBalance() public view returns (uint256) {
        (uint256 totalCollateralBase, , , , , ) = getPositionData();
        return (totalCollateralBase * (10**ASSET.decimals())) / getAssetPrice();
    }

    /**
     * @return total borrow balance in ASSET
     */
    function getBorrowBalance() public view returns (uint256) {
        (, uint256 totalDebtBase, , , , ) = getPositionData();
        return (totalDebtBase * (10**ASSET.decimals())) / getAssetPrice();
    }

    /**
     * @return available liquidity in ASSET
     */
    function getLiquidity() public view returns (uint256) {
        (, , uint256 availableBorrowsBase, , , ) = getPositionData();
        return (availableBorrowsBase * (10**ASSET.decimals())) / getAssetPrice();
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
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        return POOL.getUserAccountData(address(this));
    }

    /**
     * @return LTV of ASSET in eMode, in 4 decimals ex. 82.5% == 8250
     */
    function getLTV() public view returns (uint256) {
        return POOL.getEModeCategoryData(EMODE).ltv;
    }

    // ------------------------------------------------ actions ------------------------------------------------

    /**
     * Claims and transfers all pending rewards to OWNER
     */
    function claimRewardsToOwner() external {
        INCENTIVES.claimAllRewards(getSupplyAndBorrowAssets(), OWNER);
    }

    // ------------------------------------------------ main ------------------------------------------------

    function enterAll() external onlyOwner returns (uint256) {
        uint256 buffer = 100; // 0.01
        uint256 borrowFactor4 = (1e4 / (1e4 - (getLTV() - buffer))) * 1e4; // 0.97 => 0.96 => x25 => 2500
        return enter(ASSET.balanceOf(msg.sender), borrowFactor4);
    }

    function enter(uint256 principal, uint256 borrowFactor4) public onlyOwner returns (uint256) {
        POOL.setUserEMode(EMODE);
        ASSET.safeTransferFrom(msg.sender, address(this), principal);

        uint256 borrowAmount = (principal * borrowFactor4) / 1e4;
        _flashBorrowThenSupply(borrowAmount);

        return getLiquidity();
    }

    function exit() external onlyOwner returns (uint256) {
        _flashBorrowThenExit();
        return _withdrawToOwner(address(ASSET));
    }

    // ---------------------- internals, public onlyOwner in case of emergency ------------------------

    function _flashBorrowThenSupply(uint256 amount) public onlyOwner {
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);
        assets[0] = address(ASSET);
        amounts[0] = amount;
        modes[0] = USE_VARIABLE_DEBT;
        POOL.flashLoan(address(this), assets, amounts, modes, address(this), abi.encode(false), 0);
    }

    function _flashBorrowThenExit() public onlyOwner {
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);
        assets[0] = address(ASSET);
        amounts[0] = getBorrowBalance();
        modes[0] = 0;
        POOL.flashLoan(address(this), assets, amounts, modes, address(this), abi.encode(true), 0);
    }

    /**
     * falshloan callback
     */
    function executeOperation(
        address[] calldata, /* assets */
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(initiator == address(this), "E1");
        bool willExit = abi.decode(params, (bool));
        if (willExit) {
            POOL.repayWithATokens(address(ASSET), type(uint256).max, USE_VARIABLE_DEBT);
            POOL.withdraw(address(ASSET), type(uint256).max, address(this));
            ASSET.safeIncreaseAllowance(address(POOL), amounts[0] + premiums[0]);
        } else {
            uint256 amount = ASSET.balanceOf(address(this));
            ASSET.safeIncreaseAllowance(address(POOL), amount);
            POOL.supply(address(ASSET), amount, address(this), 0);
        }

        return true;
    }

    /**
     * amount in ASSET
     */
    function _supply(uint256 amount) public onlyOwner {
        ASSET.safeIncreaseAllowance(address(POOL), amount);
        POOL.supply(address(ASSET), amount, address(this), 0);
    }

    /**
     * amount in ASSET
     */
    function _borrow(uint256 amount) public onlyOwner {
        POOL.borrow(address(ASSET), amount, USE_VARIABLE_DEBT, 0, address(this));
    }

    /**
     * amount in ASSET
     */
    function _redeemSupply(uint256 amount) public onlyOwner {
        POOL.withdraw(address(ASSET), amount, address(this));
    }

    /**
     * amount in ASSET
     */
    function _repayBorrow(uint256 amount) public onlyOwner {
        ASSET.safeIncreaseAllowance(address(POOL), amount);
        POOL.repay(address(ASSET), amount, USE_VARIABLE_DEBT, address(this));
    }

    function _withdrawToOwner(address asset) public onlyOwner returns (uint256) {
        uint256 balance = ERC20(asset).balanceOf(address(this));
        ERC20(asset).safeTransfer(OWNER, balance);
        return balance;
    }

    // -------------------------------------- emergency --------------------------------------

    function emergencyFunctionCall(address target, bytes memory data) external onlyOwner {
        Address.functionCall(target, data);
    }

    function emergencyFunctionDelegateCall(address target, bytes memory data) external onlyOwner {
        Address.functionDelegateCall(target, data);
    }
}
