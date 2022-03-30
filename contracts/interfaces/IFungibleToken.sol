// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <1.0.0;

interface IFungibleToken {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}