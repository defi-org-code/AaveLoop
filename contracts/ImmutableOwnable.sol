// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

/**
 * Immutable version of Ownable
 */
abstract contract ImmutableOwnable {
    address public immutable OWNER; // solhint-disable-line

    modifier onlyOwner() {
        require(msg.sender == OWNER, "onlyOwner");
        _;
    }

    constructor(address owner) {
        require(owner != address(0), "owner 0");
        OWNER = owner;
    }
}
