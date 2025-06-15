// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PrizeManager is ReentrancyGuard {
    /// @notice Distributes prize pool among winners or handles non-monetary rewards
    /// @param token Address of ERC20 prize token (or zero address for non-monetary)
    /// @param total Amount of prize pool (ignored for non-monetary)
    /// @param winners List of winning addresses
    /// @param mode Distribution mode:
    ///        0 - equal split (ERC20),
    ///        1 - descending (not implemented),
    ///        2 - non-monetary (e.g., promo codes)
    function distributePrizes(
        address token,
        uint256 total,
        address[] calldata winners,
        uint8 mode
    ) external nonReentrant {
        require(winners.length > 0, "no winners");

        if (mode == 0) {
            require(token != address(0), "token required for mode 0");
            IERC20 erc20 = IERC20(token);
            uint256 share = total / winners.length;
            for (uint256 i = 0; i < winners.length; i++) {
                erc20.transfer(winners[i], share);
                emit MonetaryPrizeTransferred(winners[i], share);
            }
        } else if (mode == 2) {
            require(token == address(0), "token must be zero for non-monetary");
            for (uint256 i = 0; i < winners.length; i++) {
                emit NonMonetaryPrizeAssigned(winners[i], i);
            }
        } else {
            revert("mode not implemented");
        }
    }

    /// @notice Emitted when a winner receives a monetary reward
    event MonetaryPrizeTransferred(address indexed winner, uint256 amount);

    /// @notice Emitted when a winner receives a non-monetary reward (e.g., promo code)
    /// @dev `index` can be used off-chain to match reward metadata or promo code list
    event NonMonetaryPrizeAssigned(address indexed winner, uint256 indexed index);
}
