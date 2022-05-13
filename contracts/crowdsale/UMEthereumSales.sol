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
        address payable _fund,
        address _weth
    )
        OracleSales(_weth)
    {
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

    function mint(uint256 _intAmount)
        external
        payable
        nonReentrant
    {
        _mint(msg.sender, msg.value);
    }

        _mint(msg.sender, _intAmount);
    }

    // @dev {_intAmount} - integer tokens amount.
    function countInputAmount(uint256 _intAmount) public view returns (uint256 inputAmount) {
        IUniV2PriceOracle _priceOracle = IUniV2PriceOracle(priceOracle);
        inputAmount = _priceOracle.consult(baseStablecoin, _intAmount * price);
    }

    function _mint(address _to, uint256 _tokens) internal {
        require(status != SalesStatus.DISABLED, "Sales DISABLED");

        _updatePrice();

        uint256 deposit = countInputAmount(_tokens);

        Address.sendValue(fund, deposit);
        IFungibleToken(umToken).mint(_to, _tokens * 1e18);

        if (status == SalesStatus.PRESALE) {
            uint256 usdAmount = _tokens * price;
            uint256 giftAmount = usdAmount / giftPrice;
            if (giftAmount > 0) {
                // send gift
                INFT(giftToken).mint(_to, giftAmount);
            }
        }

        emit Purchase(_to, _tokens * 1e18, deposit);
    }
}
