// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BondForgeNFT is ERC721Enumerable, Ownable {
    uint256 public nextTokenId = 1;
    uint256 public constant MAX_TRACKED_HOLDERS = 20;
    string private _baseTokenURI;
    string public uniformTokenURI;
    uint8 public immutable mode; // 0 own metadata, 1 uniform meme image
    address[] private _trackedHolders;
    mapping(address => bool) private _isTrackedHolder;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        string memory uniformTokenURI_,
        uint8 mode_,
        address launch_
    ) ERC721(name_, symbol_) Ownable(launch_) {
        _baseTokenURI = baseTokenURI_;
        uniformTokenURI = uniformTokenURI_;
        mode = mode_;
    }

    function mintTo(address to) external onlyOwner returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _safeMint(to, tokenId);
    }


    function seizeToPool(address from, uint256 tokenId) external onlyOwner {
        _transfer(from, address(this), tokenId);
    }

    function releaseFromPool(address to, uint256 tokenId) external onlyOwner {
        _transfer(address(this), to, tokenId);
    }

    function trackedHolders() external view returns (address[] memory holders, uint256[] memory balances) {
        uint256 liveCount;
        for (uint256 i = 0; i < _trackedHolders.length; i++) {
            if (balanceOf(_trackedHolders[i]) > 0) liveCount++;
        }

        holders = new address[](liveCount);
        balances = new uint256[](liveCount);
        uint256 idx;
        for (uint256 i = 0; i < _trackedHolders.length; i++) {
            address holder = _trackedHolders[i];
            uint256 holderBalance = balanceOf(holder);
            if (holderBalance == 0) continue;
            holders[idx] = holder;
            balances[idx] = holderBalance;
            idx++;
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (mode == 1 && bytes(uniformTokenURI).length > 0) {
            return uniformTokenURI;
        }
        return bytes(_baseTokenURI).length > 0 ? string(abi.encodePacked(_baseTokenURI, _toString(tokenId), ".json")) : "";
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        address previousOwner = super._update(to, tokenId, auth);
        _syncTrackedHolder(from);
        _syncTrackedHolder(to);
        return previousOwner;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _syncTrackedHolder(address holder) internal {
        if (holder == address(0)) return;

        uint256 holderBalance = balanceOf(holder);
        if (holderBalance == 0) {
            if (_isTrackedHolder[holder]) {
                _removeTrackedHolder(holder);
            }
            return;
        }

        if (_isTrackedHolder[holder]) return;
        if (_trackedHolders.length >= MAX_TRACKED_HOLDERS) return;

        _isTrackedHolder[holder] = true;
        _trackedHolders.push(holder);
    }

    function _removeTrackedHolder(address holder) internal {
        _isTrackedHolder[holder] = false;
        uint256 length = _trackedHolders.length;
        for (uint256 i = 0; i < length; i++) {
            if (_trackedHolders[i] != holder) continue;
            if (i != length - 1) {
                _trackedHolders[i] = _trackedHolders[length - 1];
            }
            _trackedHolders.pop();
            return;
        }
    }
}
