// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract usdtMock is ERC20 {
    constructor( ) ERC20("USDt", "USDt") {
    }


function mint(address user, uint amount) external {
    _mint(user,amount*10**decimals());
}

function decimals() public pure override returns(uint8){
    return 18;
}
}