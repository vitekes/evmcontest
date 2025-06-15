// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../../core/Registry.sol";
import "../../core/AccessControlCenter.sol";
import "../../core/PaymentGateway.sol";
import "../../core/MultiValidator.sol";
import "../../shared/ResourceStorage.sol";
import "./ContestEscrow.sol";

contract ContestFactory {
    AccessControlCenter public access;
    Registry public registry;

    uint256 public contestIdCounter;
    mapping(uint256 => address) public contests;

    bytes32 public constant MODULE_NAME = keccak256("Contest");
    uint8 public immutable contextId;

    event ContestCreated(uint256 indexed id, address indexed contractAddress, address creator);

    struct ContestParams {
        string title;
        string customFormUri;
        address paymentToken;
        uint256 totalPrize;
        uint8 prizeDistributionType;
        uint8 winnersCount;
        bool isPublic;
        bool soulboundReward;
        string rewardMetadataUri;
    }

    constructor(address registryAddress) {
        registry = Registry(registryAddress);
        access = registry.access();
        contextId = registry.getContext(MODULE_NAME);
    }

    function createContest(ContestParams calldata params) external returns (address) {
        // Validate token
        address validator = registry.getCoreService("Validator");
        require(
            MultiValidator(validator).isTokenAllowed(contextId, params.paymentToken),
            "invalid token"
        );

        // Collect fee and return net prize amount
        address gateway = registry.getCoreService("PaymentGateway");
        uint256 netAmount = PaymentGateway(gateway).processPayment(
            contextId, params.paymentToken, msg.sender, params.totalPrize
        );

        // Deploy new ContestEscrow
        ContestEscrow contest = new ContestEscrow(
            registry,
            msg.sender,
            params.paymentToken,
            netAmount,
            params.winnersCount,
            params.prizeDistributionType,
            params.soulboundReward,
            params.rewardMetadataUri
        );

        // Store metadata in ResourceStorage
        address storageContract = registry.getCoreService("ResourceStorage");
        ResourceStorage(storageContract).setResource(contestIdCounter, "title", params.title);
        ResourceStorage(storageContract).setResource(contestIdCounter, "form", params.customFormUri);

        contests[contestIdCounter] = address(contest);
        emit ContestCreated(contestIdCounter, address(contest), msg.sender);
        contestIdCounter++;

        return address(contest);
    }

    function getAllContests() external view returns (address[] memory result) {
        result = new address[](contestIdCounter);
        for (uint256 i = 0; i < contestIdCounter; i++) {
            result[i] = contests[i];
        }
    }
}
