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
        address token0 = _priceOracle.token0();
        address token1 = _priceOracle.token1();
        _ethInput *= 1e18;
        if (token0 == baseStablecoin) {
            umOutput = _priceOracle.consult(token0, _ethInput);
        } else {
            umOutput = _priceOracle.consult(token1, _ethInput);
        }
        umOutput /= price * 1e18;
        usdOutput /= 1e18;
    }

    function _updatePrice() internal {
        IUniV2PriceOracle _priceOracle = IUniV2PriceOracle(priceOracle);
        if (_priceOracle.blockTimestampLast() + _priceOracle.PERIOD() >= block.timestamp) {
            _priceOracle.update();
        }
    }
}