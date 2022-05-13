/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./RBAC.sol";

contract UMToken is ERC20("Universal ar Meta", "UM"), RBAC {
    uint256 public immutable MAX_SUPPLY;

    constructor(address _admin, uint256 _max_supply) RBAC(_admin) {
        require(_admin != address(0), "Is admin black hole?");

        MAX_SUPPLY = _max_supply;
    }

    // @dev Destroys `amount` tokens from the caller.
    function burn(uint256 _amount) public onlyRole(BURNER_ROLE)  {
        _burn(_msgSender(), _amount);
    }

    /// @dev Creates `_amount` token to `_to`.
    function mint(address _to, uint256 _amount) public onlyRole(MINTER_ROLE)  {
        _mint(_to, _amount);

        require(super.totalSupply() <= MAX_SUPPLY, "MAX_SUPPLY overflow");
    }
}
