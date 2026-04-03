// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBondForgeLaunchFeeConfig {
    function issuer() external view returns (address);
    function protocolTreasury() external view returns (address);
    function buybackTokenVault() external view returns (address);
}

contract BondForgeMarketplace is Ownable, ReentrancyGuard {
    struct Listing {
        uint256 id;
        address seller;
        address nft;
        address launch;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Listing) public listings;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function createListing(address nft, address launch, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "price=0");
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        listings[nextId] = Listing(nextId, msg.sender, nft, launch, tokenId, price, true);
        nextId += 1;
    }

    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage item = listings[listingId];
        require(item.active, "inactive");
        require(msg.value >= item.price, "insufficient");
        item.active = false;
        IBondForgeLaunchFeeConfig launch = IBondForgeLaunchFeeConfig(item.launch);
        uint256 feeAmount = item.price / 100;
        uint256 sellerAmount = item.price - feeAmount;
        uint256 buybackAmount = (feeAmount * 90) / 100;
        uint256 issuerAmount = (feeAmount * 5) / 100;
        uint256 protocolAmount = feeAmount - buybackAmount - issuerAmount;

        _safeTransferNative(item.seller, sellerAmount);
        _safeTransferNative(launch.buybackTokenVault(), buybackAmount);
        _safeTransferNative(launch.issuer(), issuerAmount);
        _safeTransferNative(launch.protocolTreasury(), protocolAmount);
        if (msg.value > item.price) _safeTransferNative(msg.sender, msg.value - item.price);
        IERC721(item.nft).transferFrom(address(this), msg.sender, item.tokenId);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage item = listings[listingId];
        require(item.active, "inactive");
        require(item.seller == msg.sender, "not seller");
        item.active = false;
        IERC721(item.nft).transferFrom(address(this), msg.sender, item.tokenId);
    }

    function getListings() external view returns (Listing[] memory result) {
        uint256 count;
        for (uint256 i = 1; i < nextId; i++) if (listings[i].active) count++;
        result = new Listing[](count);
        uint256 idx;
        for (uint256 i = 1; i < nextId; i++) {
            if (listings[i].active) {
                result[idx] = listings[i];
                idx++;
            }
        }
    }

    function _safeTransferNative(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "native transfer failed");
    }
}
