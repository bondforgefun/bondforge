// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BondForgeCreate2Deployer is Ownable {
    address public factory;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setFactory(address factory_) external onlyOwner {
        require(factory == address(0), "factory already set");
        require(factory_ != address(0), "factory=0");
        factory = factory_;
    }

    function deploy(bytes calldata creationCode, bytes32 salt) external returns (address deployed) {
        require(msg.sender == factory, "only factory");
        bytes memory code = creationCode;
        assembly {
            deployed := create2(0, add(code, 0x20), mload(code), salt)
        }
        require(deployed != address(0), "deploy failed");
    }
}
