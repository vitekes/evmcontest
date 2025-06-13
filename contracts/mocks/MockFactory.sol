// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockUSDC.sol";
import "./MockUSDT.sol";
import "./MockWETH.sol";
import "./MockChainlinkAggregator.sol";

contract MockFactory {
    
    struct MockContracts {
        MockUSDC usdc;
        MockUSDT usdt;
        MockWETH weth;
        MockChainlinkAggregator usdcPriceFeed;
        MockChainlinkAggregator usdtPriceFeed;
        MockChainlinkAggregator wethPriceFeed;
    }
    
    MockContracts private _contracts;
    bool private _deployed;
    
    function deployAllMocks() external returns (MockContracts memory) { // ✅ Убрали маппинги из структуры
        require(!_deployed, "Already deployed");
        
        _contracts.usdc = new MockUSDC();
        _contracts.usdt = new MockUSDT();
        _contracts.weth = new MockWETH();
        _contracts.usdcPriceFeed = new MockChainlinkAggregator("USDC");
        _contracts.usdtPriceFeed = new MockChainlinkAggregator("USDT");
        _contracts.wethPriceFeed = new MockChainlinkAggregator("WETH");
        
        _deployed = true;
        return _contracts;
    }
    
    function contracts() external view returns (MockContracts memory) {
        require(_deployed, "Not deployed yet");
        return _contracts;
    }
}