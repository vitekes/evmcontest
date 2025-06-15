// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./AccessControlCenter.sol";

contract MultiValidator {
    AccessControlCenter public access;
    address public owner;

    // Контекст => токен => разрешено ли
    mapping(uint8 => mapping(address => bool)) public isAllowed;

    event TokenAllowed(uint8 indexed context, address indexed token, bool allowed);

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

    function setAllowed(uint8 ctx, address token, bool allowed) external onlyFeatureOwner {
        require(token != address(0), "zero address");
        isAllowed[ctx][token] = allowed;
        emit TokenAllowed(ctx, token, allowed);
    }

    function bulkSetAllowed(uint8 ctx, address[] calldata tokens, bool allowed) external onlyFeatureOwner {
        for (uint i = 0; i < tokens.length; i++) {
            isAllowed[ctx][tokens[i]] = allowed;
            emit TokenAllowed(ctx, tokens[i], allowed);
        }
    }

    function isTokenAllowed(uint8 ctx, address token) external view returns (bool) {
        return isAllowed[ctx][token];
    }

    /// Позволяет заменить AccessControl в случае необходимости
    function setAccessControl(address newAccess) external onlyAdmin {
        access = AccessControlCenter(newAccess);
    }
}
