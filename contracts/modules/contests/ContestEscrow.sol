// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../../core/Registry.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../shared/NFTManager.sol";

contract ContestEscrow is Ownable {
    Registry public registry;
    address public creator;
    address public paymentToken;
    uint256 public prizePool;
    uint8 public winnersCount;
    uint8 public prizeDistributionType; // 0 - equal, 1 - descending (TBD)
    bool public soulboundReward;
    string public rewardMetadataUri;

    address[] public participants;
    address[] public winners;
    bool public isFinalized;

    event Participated(address indexed user);
    event Finalized(address[] winners);

    modifier onlyCreator() {
        require(msg.sender == creator, "not creator");
        _;
    }

    constructor(
        Registry _registry,
        address _creator,
        address _paymentToken,
        uint256 _prizePool,
        uint8 _winnersCount,
        uint8 _prizeDistributionType,
        bool _soulboundReward,
        string memory _rewardMetadataUri
    ) {
        registry = _registry;
        creator = _creator;
        paymentToken = _paymentToken;
        prizePool = _prizePool;
        winnersCount = _winnersCount;
        prizeDistributionType = _prizeDistributionType;
        soulboundReward = _soulboundReward;
        rewardMetadataUri = _rewardMetadataUri;
    }

    function participate() external {
        require(!isFinalized, "contest ended");
        participants.push(msg.sender);
        emit Participated(msg.sender);
    }

    function finalize(address[] calldata _winners) external onlyCreator {
        require(!isFinalized, "already finalized");
        require(_winners.length == winnersCount, "wrong winners count");

        winners = _winners;
        isFinalized = true;

        // Distribute rewards
        uint256 amountPerWinner = prizePool / winnersCount;
        for (uint256 i = 0; i < _winners.length; i++) {
            IERC20(paymentToken).transfer(_winners[i], amountPerWinner);
        }

        // Mint NFTs
        address nftManager = registry.getCoreService("NFTManager");
        for (uint256 i = 0; i < _winners.length; i++) {
            NFTManager(nftManager).mint(_winners[i], rewardMetadataUri, soulboundReward);
        }

        emit Finalized(_winners);
    }

    function getParticipants() external view returns (address[] memory) {
        return participants;
    }

    function getWinners() external view returns (address[] memory) {
        return winners;
    }
}
