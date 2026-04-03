// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BondForgeToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant MAX_TRACKED_HOLDERS = 20;

    address[] private _trackedHolders;
    mapping(address => bool) private _isTrackedHolder;

    constructor(string memory name_, string memory symbol_, address launch_) ERC20(name_, symbol_) Ownable(launch_) {
        _mint(launch_, TOTAL_SUPPLY);
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

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        _syncTrackedHolder(from);
        _syncTrackedHolder(to);
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
