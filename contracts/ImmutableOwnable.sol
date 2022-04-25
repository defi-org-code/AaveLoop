// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

/**
 * Immutable version of Ownable
 */
abstract contract ImmutableOwnable {
    address public immutable OWNER; // solhint-disable-line

    modifier onlyOwner() {
        require(msg.sender == OWNER, "E1");
        _;
    }

    constructor(address owner) {
        require(owner != address(0), "E0");
        OWNER = owner;
    }
}
