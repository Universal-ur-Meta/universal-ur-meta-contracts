/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IFungibleToken.sol";
import "../interfaces/IUniV2PriceOracle.sol";
import "../interfaces/INFT.sol";
import "./ManagedSales.sol";

contract UMUSDXSales is ReentrancyGuard, ManagedSales {
    using SafeERC20 for IERC20;

    address public depositToken;

    event DepositTokenSet(address token);
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

    function mint(uint256 _intAmount)
        external
        nonReentrant
    {
        require(
            _intAmount != 0 && _intAmount <= maxTokenPurchase,
            "Invalid token amount"
        );

        _mint(msg.sender, _intAmount);
    }

    function setDepositToken(address _token) external onlyOwner {
        depositToken = _token;
        emit DepositTokenSet(_token);
    }

    // @dev {_intAmount} - integer tokens amount.
    function countInputAmount(uint256 _intAmount) public view returns (uint256 inputAmount) {
        inputAmount = price * _intAmount;
    }

    function _mint(address _caller, uint256 _intAmount) internal {
        require(status != SalesStatus.DISABLED, "Sales DISABLED");

        // min umAmount
        uint256 inputAmount = countInputAmount(_intAmount);
        IERC20(depositToken).safeTransferFrom(_caller, fund, inputAmount);

        uint256 umAmount = _intAmount * 1e18;
        IFungibleToken(umToken).mint(_caller, umAmount);

        if (status == SalesStatus.PRESALE) {
            uint256 giftAmount = inputAmount / giftPrice;
            if (giftAmount > 0) {
                // send gift
                INFT(giftToken).mint(_caller, giftAmount);
            }
        }

        emit Purchase(_caller, umAmount, inputAmount);
    }
}
