// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract AaveLoop is Ownable {
    using SafeERC20 for IERC20;

    // --- fields ---
    address public constant UNITROLLER = address(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);
    address public constant CUSDC = address(0x39AA39c021dfbaE8faC545936693aC917d5E7563);
    address public constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    address public constant COMP = address(0xc00e94Cb662C3520282E6f5717214004A7f26888);
    address public manager;

    // --- events ---
    event ManagerUpdated(address prevManager, address newManager);
    event LogMint(address token, address owner, uint256 tokenAmount);
    event LogBorrow(address token, address owner, uint256 tokenAmount);
    event LogRedeem(address token, address owner, uint256 tokenAmount);
    event LogRedeemUnderlying(address token, address owner, uint256 tokenAmount);
    event LogRepay(address token, address owner, uint256 tokenAmount);

    // --- modifiers ---
    modifier onlyManagerOrOwner() {
        require(msg.sender == manager || msg.sender == owner(), "Caller is not manager or owner");
        _;
    }

    constructor(address _manager) {
        setManager(_manager);
    }

    // --- views ---

    function cTokenBalance() public view returns (uint256) {
        return IERC20(CUSDC).balanceOf(address(this));
    }

    function underlyingBalance() public view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }

    function getAccountLiquidity()
        public
        view
        returns (
            uint256 err,
            uint256 liquidity,
            uint256 shortfall
        )
    {
        return Comptroller(UNITROLLER).getAccountLiquidity(address(this));
    }

    // --- unrestricted actions ---

    function borrowBalanceCurrent() public returns (uint256) {
        return CERC20(CUSDC).borrowBalanceCurrent(address(this));
    }

    function claimComp() public returns (uint256) {
        Comptroller(UNITROLLER).claimComp(address(this));
        return IERC20(COMP).balanceOf(address(this));
    }

    function claimComp(
        address[] memory holders,
        address[] memory cTokens,
        bool borrowers,
        bool suppliers
    ) public {
        Comptroller(UNITROLLER).claimComp(holders, cTokens, borrowers, suppliers);
    }

    function getAccountLiquidityWithInterest()
        public
        returns (
            uint256 err,
            uint256 accountLiquidity,
            uint256 accountShortfall
        )
    {
        require(CERC20(CUSDC).accrueInterest() == 0, "accrueInterest failed");
        return Comptroller(UNITROLLER).getAccountLiquidity(address(this));
    }

    // --- main ---

    // 3 typical cases:
    // minAmountIn = account balance (this goes for one iteration: mint, borrow, mint)
    // minAmountIn < account balance (this goes for multiple iterations: mint, borrow, mint, borrow, ..., mint until the last mint was for a sum smaller than minAmountIn)
    // minAmountIn = uint(-1) (this goes for zero iterations: mint)
    function enterPosition(
        uint256 minAmountIn,
        uint256 borrowRatioNum,
        uint256 borrowRatioDenom
    ) external onlyManagerOrOwner {
        (bool isListed, ) = Comptroller(UNITROLLER).markets(CUSDC);
        require(isListed, "cToken not listed");

        setApprove();
        enterMarkets();

        uint256 usdcBalance = underlyingBalance();
        require(usdcBalance > 0, "not enough USDC balance");

        while (usdcBalance >= minAmountIn) {
            mintCToken(usdcBalance);

            (uint256 err, uint256 liquidity, uint256 shortfall) = getAccountLiquidity(); // 18 decimals
            require(err == 0, "getAccountLiquidity error");
            require(shortfall == 0, "shortfall");

            uint256 amountToBorrow = eighteenToUSDC(liquidity); // 6 decimals
            amountToBorrow = amountToBorrow.mul(borrowRatioNum).div(borrowRatioDenom);

            borrow(amountToBorrow);

            usdcBalance = underlyingBalance();
        }

        mintCToken(usdcBalance);
    }

    // maxIterations control the loop
    function exitPosition(
        uint256 maxIterations,
        uint256 redeemRatioNum,
        uint256 redeemRatioDenom
    ) external onlyManagerOrOwner returns (uint256) {
        require(cTokenBalance() > 0, "cUSDC balance = 0");

        setApprove();

        (, uint256 collateralFactor) = Comptroller(UNITROLLER).markets(CUSDC);

        uint256 _borrowBalance = borrowBalanceCurrent();

        for (uint256 i = 0; _borrowBalance > 0 && i < maxIterations; i++) {
            (uint256 err, uint256 liquidity, uint256 shortfall) = getAccountLiquidity(); // 18 decimals
            require(err == 0, "getAccountLiquidity error");
            require(shortfall == 0, "shortfall");

            // getAmountToRedeem from liquidity and collateralFactor
            (, Exp memory amountToRedeemExp) = getExp(liquidity, collateralFactor);
            uint256 amountToRedeem = eighteenToUSDC(amountToRedeemExp.mantissa);
            amountToRedeem = amountToRedeem.mul(redeemRatioNum).div(redeemRatioDenom); // 6 decimals

            redeemUnderlying(amountToRedeem);

            uint256 usdcBalance = underlyingBalance();
            if (usdcBalance > _borrowBalance) {
                require(CERC20(CUSDC).repayBorrow(uint256(-1)) == 0, "repayBorrow -1 failed");
            } else {
                require(CERC20(CUSDC).repayBorrow(usdcBalance) == 0, "repayBorrow failed");
            }

            _borrowBalance = CERC20(CUSDC).borrowBalanceStored(address(this));
        }

        if (_borrowBalance == 0) {
            redeemCToken(cTokenBalance());
        }

        return underlyingBalance();
    }

    // --- internal ---

    function eighteenToUSDC(uint256 amount18Decimals) internal pure returns (uint256) {
        return amount18Decimals.div(10**12);
    }

    // --- withdraw assets by owner ---

    function claimAndTransferAllCompToOwner() public onlyManagerOrOwner {
        uint256 balance = claimComp();
        if (balance > 0) {
            IERC20(COMP).safeTransfer(owner(), balance);
        }
    }

    function safeTransferUSDCToOwner() public onlyOwner {
        uint256 usdcBalance = underlyingBalance();
        if (usdcBalance > 0) {
            IERC20(USDC).safeTransfer(owner(), usdcBalance);
        }
    }

    function safeTransferAssetToOwner(address src) public onlyOwner {
        uint256 balance = IERC20(src).balanceOf(address(this));
        if (balance > 0) {
            IERC20(src).safeTransfer(owner(), balance);
        }
    }

    function transferFrom(address src_, uint256 amount_) public onlyOwner {
        IERC20(USDC).transferFrom(src_, address(this), amount_);
    }

    // --- administration ---

    function setManager(address _newManager) public onlyOwner {
        require(_newManager != address(0), "_newManager is null");
        emit ManagerUpdated(manager, _newManager);
        manager = _newManager;
    }

    function setApprove() public onlyManagerOrOwner {
        if (IERC20(USDC).allowance(address(this), CUSDC) != uint256(-1)) {
            IERC20(USDC).approve(CUSDC, uint256(-1));
        }
    }

    function enterMarkets() public onlyManagerOrOwner {
        address[] memory arrayForEnterMarkets = new address[](1);
        arrayForEnterMarkets[0] = CUSDC;
        Comptroller(UNITROLLER).enterMarkets(arrayForEnterMarkets);
    }

    function mintCToken(uint256 amount) public onlyManagerOrOwner {
        require(CERC20(CUSDC).mint(amount) == 0, "mint has failed");
        emit LogMint(CUSDC, address(this), amount);
    }

    function borrow(uint256 amount) public onlyManagerOrOwner {
        require(CERC20(CUSDC).borrow(amount) == 0, "borrow has failed");
        emit LogBorrow(CUSDC, address(this), amount);
    }

    function redeemCToken(uint256 amount) public onlyManagerOrOwner {
        require(CERC20(CUSDC).redeem(amount) == 0, "redeem failed");
        emit LogRedeem(CUSDC, address(this), amount);
    }

    function redeemUnderlying(uint256 amount) public onlyManagerOrOwner {
        require(CERC20(CUSDC).redeemUnderlying(amount) == 0, "redeemUnderlying failed");
        emit LogRedeemUnderlying(CUSDC, address(this), amount);
    }

    function repayBorrow(uint256 amount) public onlyManagerOrOwner {
        require(CERC20(CUSDC).repayBorrow(amount) == 0, "repayBorrow failed");
        emit LogRepay(CUSDC, address(this), amount);
    }

    function repayBorrowAll() public onlyManagerOrOwner {
        uint256 usdcBalance = underlyingBalance();
        if (usdcBalance > borrowBalanceCurrent()) {
            require(CERC20(CUSDC).repayBorrow(uint256(-1)) == 0, "repayBorrow -1 failed");
            emit LogRepay(CUSDC, address(this), uint256(-1));
        } else {
            require(CERC20(CUSDC).repayBorrow(usdcBalance) == 0, "repayBorrow failed");
            emit LogRepay(CUSDC, address(this), usdcBalance);
        }
    }

    // --- emergency ---

    function emergencyTransferAsset(
        address asset_,
        address to_,
        uint256 amount_
    ) public onlyOwner {
        IERC20(asset_).transfer(to_, amount_);
    }

    function emergencySafeTransferAsset(
        address asset_,
        address to_,
        uint256 amount_
    ) public onlyOwner {
        IERC20(asset_).safeTransfer(to_, amount_);
    }

    function emergencyTransferAll(address[] memory tokens_, address to_) public onlyOwner {
        uint256 ercLen = tokens_.length;
        for (uint256 i = 0; i < ercLen; i++) {
            IERC20 erc = IERC20(tokens_[i]);
            uint256 balance = erc.balanceOf(address(this));
            if (balance > 0) {
                erc.safeTransfer(to_, balance);
            }
        }
    }

    function emergencySubmitTransaction(
        address destination,
        bytes memory data,
        uint256 gasLimit
    ) public onlyOwner returns (bool) {
        uint256 dataLength = data.length;
        bool result;
        // solhint-disable-next-line
        assembly {
            let x := mload(0x40) // memory for output
            let d := add(data, 32) // first 32 bytes are the padded length of data, so exclude that
            result := call(
                gasLimit,
                destination,
                0, // value is ignored
                d,
                dataLength,
                x,
                0 // output is ignored
            )
        }
        return result;
    }
}
