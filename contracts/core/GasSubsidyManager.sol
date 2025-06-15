// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./AccessControlCenter.sol";

contract GasSubsidyManager {
    AccessControlCenter public access;
    address public owner;

    // ctx => user => имеет ли право на покрытие газа
    mapping(uint8 => mapping(address => bool)) public isEligible;

    // ctx => адрес контракта => включено ли покрытие газа
    mapping(uint8 => mapping(address => bool)) public gasCoverageEnabled;

    event EligibilitySet(uint8 ctx, address user, bool allowed);
    event GasCoverageEnabled(uint8 ctx, address contractAddress, bool enabled);

    modifier onlyAdmin() {
        require(msg.sender == owner, "not admin");
        _;
    }

    modifier onlyFeatureOwner() {
        require(access.hasRole(access.FEATURE_OWNER_ROLE(), msg.sender), "not feature owner");
        _;
    }

    constructor(address accessControl) {
        access = AccessControlCenter(accessControl);
        owner = msg.sender;
    }

    /// Пользователь получает право не платить за газ (его покроет система)
    function setEligibility(uint8 ctx, address user, bool status) external onlyFeatureOwner {
        isEligible[ctx][user] = status;
        emit EligibilitySet(ctx, user, status);
    }

    /// Модуль (feature) регистрирует себя для поддержки покрытия газа
    function setGasCoverageEnabled(uint8 ctx, address contractAddress, bool enabled) external onlyFeatureOwner {
        gasCoverageEnabled[ctx][contractAddress] = enabled;
        emit GasCoverageEnabled(ctx, contractAddress, enabled);
    }

    /// Проверка перед выполнением действия (можно вызывать в модуле)
    function isGasFree(uint8 ctx, address user, address contractAddress) external view returns (bool) {
        return gasCoverageEnabled[ctx][contractAddress] && isEligible[ctx][user];
    }

    function setAccessControl(address newAccess) external onlyAdmin {
        access = AccessControlCenter(newAccess);
    }
}
