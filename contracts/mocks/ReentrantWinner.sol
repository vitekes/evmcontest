// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ContestEscrow} from "../core/ContestEscrow.sol";

/// @title ReentrantWinner
/// @notice Malicious contract used to test reentrancy protection in ContestEscrow
contract ReentrantWinner {
    ContestEscrow public escrow;
    bool public attacked;

    constructor(address payable _escrow) {
        escrow = ContestEscrow(_escrow);
    }

    /// @notice Initiates the reentrancy attack by calling claimPrize
    function attack() external {
        escrow.claimPrize();
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // try to re-enter claimPrize
            try escrow.claimPrize() {} catch {}
        }
    }
}
