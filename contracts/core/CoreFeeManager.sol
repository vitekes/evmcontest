// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./AccessControlCenter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract CoreFeeManager {
    using Address for address payable;

    AccessControlCenter public access;
    address public owner;

    /// @notice ctx => token => fee % (в 10000 базисных точках: 100 = 1%)
    mapping(uint8 => mapping(address => uint16)) public percentFee;

    /// @notice ctx => token => фиксированная плата (в токенах)
    mapping(uint8 => mapping(address => uint256)) public fixedFee;

    /// @notice ctx => токен => собранная сумма
    mapping(uint8 => mapping(address => uint256)) public collectedFees;

    /// @notice ctx => адрес => без комиссии?
    mapping(uint8 => mapping(address => bool)) public isZeroFeeAddress;

    event FeeCollected(uint8 indexed ctx, address indexed token, uint256 amount);
    event FeeWithdrawn(uint8 indexed ctx, address indexed token, address to, uint256 amount);

    modifier onlyFeatureOwner() {
        require(access.hasRole(access.FEATURE_OWNER_ROLE(), msg.sender), "not feature owner");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == owner, "not admin");
        _;
    }

    constructor(address accessControl) {
        access = AccessControlCenter(accessControl);
        owner = msg.sender;
    }

    function collect(uint8 ctx, address token, address payer, uint256 amount) external onlyFeatureOwner returns (uint256 feeAmount) {
        if (isZeroFeeAddress[ctx][payer]) return 0;

        uint16 pFee = percentFee[ctx][token];
        uint256 fFee = fixedFee[ctx][token];

        feeAmount = fFee + ((amount * pFee) / 10_000);
        if (feeAmount > 0) {
            IERC20(token).transferFrom(payer, address(this), feeAmount);
            collectedFees[ctx][token] += feeAmount;
            emit FeeCollected(ctx, token, feeAmount);
        }
    }

    function withdrawFees(uint8 ctx, address token, address to) external onlyAdmin {
        uint256 amount = collectedFees[ctx][token];
        require(amount > 0, "nothing to withdraw");

        collectedFees[ctx][token] = 0;
        IERC20(token).transfer(to, amount);
        emit FeeWithdrawn(ctx, token, to, amount);
    }

    function setPercentFee(uint8 ctx, address token, uint16 feeBps) external onlyFeatureOwner {
        require(feeBps <= 10_000, "fee too high");
        percentFee[ctx][token] = feeBps;
    }

    function setFixedFee(uint8 ctx, address token, uint256 feeAmount) external onlyFeatureOwner {
        fixedFee[ctx][token] = feeAmount;
    }

    function setZeroFeeAddress(uint8 ctx, address user, bool status) external onlyFeatureOwner {
        isZeroFeeAddress[ctx][user] = status;
    }

    /// Позволяет заменить AccessControl
    function setAccessControl(address newAccess) external onlyAdmin {
        access = AccessControlCenter(newAccess);
    }
}
