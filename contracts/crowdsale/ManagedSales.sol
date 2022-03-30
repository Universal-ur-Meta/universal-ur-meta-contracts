/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

abstract contract ManagedSales is Ownable {
    enum SalesStatus {
        DISABLED,
        PRESALE,
        SALE
    }

    SalesStatus public status;

    address public umToken;
    address public giftToken;
    address payable public fund;

    uint256 public price = 1e18;
    uint256 public maxTokenPurchase = 25;

    uint256 public giftPrice = 200e18; // 200$

    event FundSet(address payable account);
    event PriceSet(uint256 price);
    event GiftPriceSet(uint256 price);
    event StatusSet(SalesStatus status);
    event TokenSet(address token);
    event GiftTokenSet(address token);
    event MaxTokenPurchaseSet(uint256 amount);
    event PriceOracleSet(address oracle);

    function setFund(address payable _newFund) external onlyOwner {
        require(
            _newFund != address(0) && _newFund != address(this),
            "Unacceptable address set"
        );

        fund = _newFund;
        emit FundSet(_newFund);
    }

    function setPrice(uint256 _price) external onlyOwner {
        require(_price != 0, "Incorrect price");

        price = _price;
        emit PriceSet(_price);
    }

    function setGiftPrice(uint256 _price) external onlyOwner {
        require(_price != 0, "Incorrect price");

        giftPrice = _price;
        emit GiftPriceSet(_price);
    }

    function setStatus(SalesStatus _status) external onlyOwner {
        status = _status;
        emit StatusSet(_status);
    }

    function setRoundWithDetails(
        SalesStatus _status,
        uint256 _price,
        uint256 _maxPurchase
    )
        external
        onlyOwner
    {
        require(_status != SalesStatus.DISABLED, "Only active sales _status");
        require(_price != 0, "Incorrect _price");
        require(_maxPurchase != 0, "Incorrect _maxPurchase");

        status = _status;
        price = _price;
        maxTokenPurchase = _maxPurchase;

        emit StatusSet(_status);
        emit PriceSet(_price);
        emit MaxTokenPurchaseSet(_maxPurchase);
    }

    function setToken(address _umToken) external onlyOwner {
        umToken = _umToken;
        emit TokenSet(_umToken);
    }

    function setGiftToken(address _giftToken) external onlyOwner {
        _checkSupportGiftToken(_giftToken);

        giftToken = _giftToken;
        emit GiftTokenSet(_giftToken);
    }

    function setMaxTokenPurchase(uint256 _amount) external onlyOwner {
        require(_amount != 0, "Incorrect amount");

        maxTokenPurchase = _amount;
        emit MaxTokenPurchaseSet(_amount);
    }
    
    function _checkSupportGiftToken(address _token) internal {
        require(
            IERC165(_token).supportsInterface(type(IERC1155).interfaceId),
            "Gift token interface not supported"
        );
    }
}