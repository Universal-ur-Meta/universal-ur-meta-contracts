/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IFungibleToken.sol";
import "../interfaces/IUniV2PriceOracle.sol";
import "../interfaces/INFT.sol";
import "./OracleSales.sol";

contract UMEthereumSales is ReentrancyGuard, OracleSales {
    event Purchase(address indexed buyer, uint256 indexed bought, uint256 indexed paid);

    constructor(
        address _umToken,
        address _giftToken,
        address payable _fund
    ) {
        require(
            _umToken != address(0) &&
            _fund != address(0),
            "Unacceptable address set"
        );

        _checkSupportGiftToken(_giftToken);

        umToken = _umToken;
        giftToken = _giftToken;
        fund = _fund;
    }

    receive()
        external
        payable
        nonReentrant
    {
        _mint(msg.sender, msg.value);
    }

    function mint()
        external
        payable
        nonReentrant
    {
        _mint(msg.sender, msg.value);
    }
    
    function _mint(address _to, uint256 _deposit) internal {
        require(status != SalesStatus.DISABLED, "Sales DISABLED");

        _updatePrice();

        // min umAmount
        (uint256 umAmount, uint256 usdAmount) = countOutputAmount(_deposit);

        require(umAmount > 0, "Impossible buy zero tokens");

        Address.sendValue(fund, _deposit);
        IFungibleToken(umToken).mint(_to, umAmount);

        if (status == SalesStatus.PRESALE) {
            uint256 giftAmount = usdAmount / giftPrice;
            if (giftAmount > 0) {
                // send gift
                INFT(giftToken).mint(_to, giftAmount);
            }
        }

        emit Purchase(_to, umAmount, _deposit);
    }
}