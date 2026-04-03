// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BondForgeLaunch.sol";
import "./BondForgeCreate2Deployer.sol";

contract BondForgeFactory is Ownable {
    address[] public launches;
    address public create2Deployer;
    address public positionManager;
    address public marketplace;
    address public swapRouter;

    event LaunchCreated(address indexed launch, address indexed token, address indexed nft, address issuer, string name, string symbol);

    constructor(address initialOwner, address create2Deployer_, address positionManager_, address marketplace_, address swapRouter_) Ownable(initialOwner) {
        create2Deployer = create2Deployer_;
        positionManager = positionManager_;
        marketplace = marketplace_;
        swapRouter = swapRouter_;
    }

    function getLaunches() external view returns (address[] memory) {
        return launches;
    }

    function createLaunchWithSalt(
        BondForgeLaunch.InitParams calldata params,
        bytes32 salt,
        bytes calldata creationCode
    ) external returns (address launchAddress) {
        launchAddress = BondForgeCreate2Deployer(create2Deployer).deploy(creationCode, salt);
        launches.push(launchAddress);
        BondForgeLaunch launch = BondForgeLaunch(payable(launchAddress));
        emit LaunchCreated(launchAddress, address(launch.token()), address(launch.nft()), msg.sender, params.name, params.symbol);
    }
}
