// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPancakeV3.sol";

contract BondForgeLiquidityLocker is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BUYBACK_SHARE_BPS = 9000;
    uint256 private constant ISSUER_SHARE_BPS = 500;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public immutable launch;
    address public immutable positionManager;
    address public immutable issuer;
    address public immutable buybackVault;
    address public immutable protocolTreasury;
    address public immutable projectToken;
    address public immutable wrappedNativeToken;

    uint256 public positionTokenId;

    event PositionLocked(uint256 indexed tokenId);
    event FeesCollected(uint256 indexed tokenId, uint256 amountProjectToken, uint256 amountWrappedNative);

    constructor(
        address launch_,
        address positionManager_,
        address issuer_,
        address buybackVault_,
        address protocolTreasury_,
        address projectToken_,
        address wrappedNativeToken_
    ) {
        launch = launch_;
        positionManager = positionManager_;
        issuer = issuer_;
        buybackVault = buybackVault_;
        protocolTreasury = protocolTreasury_;
        projectToken = projectToken_;
        wrappedNativeToken = wrappedNativeToken_;
    }

    function onERC721Received(address, address from, uint256 tokenId, bytes calldata) external override returns (bytes4) {
        require(msg.sender == positionManager, "manager only");
        require(positionTokenId == 0, "position exists");
        require(from == address(0) || from == launch, "invalid source");
        positionTokenId = tokenId;
        emit PositionLocked(tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function syncPositionTokenId(uint256 tokenId) external {
        require(msg.sender == launch, "launch only");
        require(tokenId != 0, "tokenId=0");
        require(IERC721(positionManager).ownerOf(tokenId) == address(this), "not locker owner");
        if (positionTokenId == 0) {
            positionTokenId = tokenId;
            emit PositionLocked(tokenId);
            return;
        }
        require(positionTokenId == tokenId, "position mismatch");
    }

    function collectFees() external nonReentrant returns (uint256 amountProjectToken, uint256 amountWrappedNative) {
        uint256 tokenId = positionTokenId;
        require(tokenId != 0, "position missing");

        (uint256 amount0, uint256 amount1) = IPancakeV3PositionManager(positionManager).collect(
            IPancakeV3PositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        bool projectIsToken0 = projectToken < wrappedNativeToken;
        amountProjectToken = _splitAsset(projectToken, projectIsToken0 ? amount0 : amount1);
        amountWrappedNative = _splitAsset(wrappedNativeToken, projectIsToken0 ? amount1 : amount0);
        emit FeesCollected(tokenId, amountProjectToken, amountWrappedNative);
    }

    function _splitAsset(address asset, uint256 amount) internal returns (uint256 distributed) {
        if (amount == 0) return 0;

        if (asset == projectToken) {
            IERC20(asset).safeTransfer(DEAD, amount);
            return amount;
        }

        uint256 buybackAmount = (amount * BUYBACK_SHARE_BPS) / 10_000;
        uint256 issuerAmount = (amount * ISSUER_SHARE_BPS) / 10_000;
        uint256 protocolAmount = amount - buybackAmount - issuerAmount;

        IERC20(asset).safeTransfer(buybackVault, buybackAmount);
        IERC20(asset).safeTransfer(issuer, issuerAmount);
        IERC20(asset).safeTransfer(protocolTreasury, protocolAmount);
        return amount;
    }
}
