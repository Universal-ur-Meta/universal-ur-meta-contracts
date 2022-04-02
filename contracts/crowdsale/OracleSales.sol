/// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IUniV2PriceOracle.sol";
import "./ManagedSales.sol";

abstract contract OracleSales is ManagedSales {
    address public priceOracle;
    address public baseStablecoin;

    function setPriceOracle(address _priceOracle, address _baseStablecoin) external onlyOwner {
        require(
            IUniV2PriceOracle(_priceOracle).token0() != _baseStablecoin ||
            IUniV2PriceOracle(_priceOracle).token1() != _baseStablecoin,
            "Stablecoin not supported"
        );

        priceOracle = _priceOracle;
        baseStablecoin = _baseStablecoin;
        emit PriceOracleSet(_priceOracle);
    }

    // eth-usd pair
    function countOutputAmount(uint256 _ethInput) public view returns (uint256 umOutput, uint256 usdOutput) {
        IUniV2PriceOracle _priceOracle = IUniV2PriceOracle(priceOracle);
        usdOutput = _priceOracle.consult(baseStablecoin, _ethInput);
        umOutput = usdOutput / price;
    }

    function _updatePrice() internal {
        IUniV2PriceOracle _priceOracle = IUniV2PriceOracle(priceOracle);
        if (block.timestamp - _priceOracle.blockTimestampLast() > _priceOracle.PERIOD()) {
            _priceOracle.update();
        }
    }
}