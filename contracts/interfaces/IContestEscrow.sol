// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../core/PrizeTemplates.sol";

interface IContestEscrow {
    struct ContestParams {
        address creator;
        IERC20 token;
        uint256 totalPrize;
        PrizeTemplates.PrizeDistribution[] distribution;
        address[] jury;
        address treasury;
        uint256 contestId;
        uint256 startTime;
        uint256 endTime;
        string metadata;
    }

    function init(ContestParams calldata params) external payable;
    
    function declareWinners(
        address[] calldata winners,
        uint256[] calldata places
    ) external;
    
    function claimPrize() external;
    
    function cancel(string calldata reason) external;
    
    function getContestInfo() external view returns (
        address creator,
        uint256 totalPrize,
        uint256 startTime,
        uint256 endTime,
        bool isActive,
        bool isFinalized,
        bool isCancelled
    );

    function emergencyWithdraw(string calldata reason) external;

    function withdrawRemainingFunds() external;

    function token() external view returns (IERC20);
    function creator() external view returns (address);
    function factory() external view returns (address);
    function treasury() external view returns (address);
    function endTime() external view returns (uint256);
    function startTime() external view returns (uint256);
    function getContestParams() external view returns (ContestParams memory);
    function hasEmergencyRole(address account) external view returns (bool);
    function isJury(address account) external view returns (bool);
}