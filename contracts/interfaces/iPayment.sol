// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IPayment {

    function getTokenPrices(IERC20 _token) external view returns (uint _premiumPrice, uint _aiPrice);


}