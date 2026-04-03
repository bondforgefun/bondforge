// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IPancakeV3.sol";

interface IBondForgeMarketplaceBuyback {
    function nextId() external view returns (uint256);
    function listings(uint256 listingId) external view returns (
        uint256 id,
        address seller,
        address nft,
        address launch,
        uint256 tokenId,
        uint256 price,
        bool active
    );
    function buy(uint256 listingId) external payable;
}

interface IBondForgeLaunchBurnPool {
    function burnToPool(uint256 tokenId) external;
}

contract BondForgeNftBuybackVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FLOOR_PREMIUM_BPS = 11_000;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public immutable launch;
    address public immutable marketplace;
    address public immutable nftAddress;
    address public immutable projectToken;
    address public immutable wrappedNativeToken;

    event NftBuybackExecuted(uint256 listingId, uint256 tokenId, uint256 pricePaid, uint256 tokenBurned);

    constructor(
        address launch_,
        address marketplace_,
        address nftAddress_,
        address projectToken_,
        address wrappedNativeToken_
    ) {
        launch = launch_;
        marketplace = marketplace_;
        nftAddress = nftAddress_;
        projectToken = projectToken_;
        wrappedNativeToken = wrappedNativeToken_;
    }

    receive() external payable {}

    function floorListing()
        public
        view
        returns (uint256 listingId, uint256 tokenId, uint256 price)
    {
        uint256 nextId = IBondForgeMarketplaceBuyback(marketplace).nextId();
        for (uint256 id = 1; id < nextId; id++) {
            (
                ,
                ,
                address listedNft,
                address listedLaunch,
                uint256 listedTokenId,
                uint256 listedPrice,
                bool active
            ) = IBondForgeMarketplaceBuyback(marketplace).listings(id);

            if (!active || listedLaunch != launch || listedNft != nftAddress || listedPrice == 0) continue;
            if (price == 0 || listedPrice < price) {
                listingId = id;
                tokenId = listedTokenId;
                price = listedPrice;
            }
        }
    }

    function canExecuteBuyback()
        external
        view
        returns (bool eligible, uint256 listingId, uint256 tokenId, uint256 price, uint256 wrappedBalance, uint256 requiredBalance)
    {
        (listingId, tokenId, price) = floorListing();
        wrappedBalance = IERC20(wrappedNativeToken).balanceOf(address(this));
        requiredBalance = price == 0 ? 0 : (price * FLOOR_PREMIUM_BPS + 9_999) / 10_000;
        eligible = listingId != 0 && wrappedBalance >= requiredBalance;
    }

    function executeBuyback() external nonReentrant returns (uint256 listingId, uint256 tokenId, uint256 pricePaid, uint256 tokenBurned) {
        (listingId, tokenId, pricePaid) = floorListing();
        require(listingId != 0 && pricePaid > 0, "no floor listing");

        uint256 wrappedBalance = IERC20(wrappedNativeToken).balanceOf(address(this));
        uint256 requiredBalance = (pricePaid * FLOOR_PREMIUM_BPS + 9_999) / 10_000;
        require(wrappedBalance >= requiredBalance, "threshold not met");

        IWBNB(wrappedNativeToken).withdraw(pricePaid);
        IBondForgeMarketplaceBuyback(marketplace).buy{value: pricePaid}(listingId);
        IBondForgeLaunchBurnPool(launch).burnToPool(tokenId);

        tokenBurned = IERC20(projectToken).balanceOf(address(this));
        if (tokenBurned > 0) {
            IERC20(projectToken).safeTransfer(DEAD, tokenBurned);
        }

        emit NftBuybackExecuted(listingId, tokenId, pricePaid, tokenBurned);
    }
}
