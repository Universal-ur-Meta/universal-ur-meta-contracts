/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import { ERC1155, ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { AccessControlEnumerable, RBAC } from "./RBAC.sol";

contract PresaleTicket is ERC1155Supply, RBAC {
    uint256 public constant TICKET_ID = 0;

    constructor(address _admin)
        ERC1155("https://example.com/api/presale-ticket/{id}.json")
        RBAC(_admin)
    {
        require(_admin != address(0), "Is admin black hole?");
    }

    function mint(address _to, uint256 _amount) external onlyRole(MINTER_ROLE) {
        _mint(_to, TICKET_ID, _amount, bytes(""));
    }

    function burn(uint256 _amount) external onlyRole(BURNER_ROLE) {
        _burn(msg.sender, TICKET_ID, _amount);
    }

    function supportsInterface(bytes4 _interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, ERC1155)
        returns (bool)
    {
        return
            AccessControlEnumerable.supportsInterface(_interfaceId) ||
            ERC1155.supportsInterface(_interfaceId);
    }
}