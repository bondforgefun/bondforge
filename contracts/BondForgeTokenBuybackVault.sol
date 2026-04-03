// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPancakeV3.sol";

contract BondForgeTokenBuybackVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_NATIVE_TRIGGER = 0.11 ether;
    uint256 public constant NATIVE_RESERVE = 0.01 ether;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public immutable launch;
    address public immutable projectToken;
    address public immutable wrappedNativeToken;
    address public immutable swapRouter;
    uint24 public immutable poolFee;

    event TokenBuybackExecuted(uint256 nativeSpent, uint256 tokenBurned);

    constructor(
        address launch_,
        address projectToken_,
        address wrappedNativeToken_,
        address swapRouter_,
        uint24 poolFee_
    ) {
        launch = launch_;
        projectToken = projectToken_;
        wrappedNativeToken = wrappedNativeToken_;
        swapRouter = swapRouter_;
        poolFee = poolFee_;
    }

    receive() external payable {}

    function spendableNative() public view returns (uint256) {
        uint256 balance = address(this).balance;
        if (balance < MIN_NATIVE_TRIGGER || balance <= NATIVE_RESERVE) return 0;
        return balance - NATIVE_RESERVE;
    }

    function canExecuteBuyback() external view returns (bool eligible, uint256 nativeToSpend) {
        nativeToSpend = spendableNative();
        eligible = nativeToSpend > 0;
    }

    function executeBuyback(uint256 amountOutMinimum) external nonReentrant returns (uint256 amountOut) {
        uint256 nativeToSpend = spendableNative();
        require(nativeToSpend > 0, "threshold not met");

        IWBNB(wrappedNativeToken).deposit{value: nativeToSpend}();
        IERC20(wrappedNativeToken).forceApprove(swapRouter, nativeToSpend);

        amountOut = IPancakeV3SwapRouter(swapRouter).exactInputSingle(
            IPancakeV3SwapRouter.ExactInputSingleParams({
                tokenIn: wrappedNativeToken,
                tokenOut: projectToken,
                fee: poolFee,
                recipient: DEAD,
                deadline: block.timestamp,
                amountIn: nativeToSpend,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            })
        );

        emit TokenBuybackExecuted(nativeToSpend, amountOut);
    }
}
