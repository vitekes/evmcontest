// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract Payments is ReentrancyGuard{
    uint public txId;
    uint16 public fee; // 55 = 5.5%   x / 1000 * fee
    address payable public owner;
    mapping (IERC20 => uint) tokenAiPrice; //  0x0000000000000000000000000000000000000000 == eth / native coin price
    mapping (IERC20 => uint) tokenPremiumPrice;
    mapping (address => uint16) public personalFee;
    mapping (address => mapping (uint16 => mapping (IERC20 => uint))) itemPrice;
    mapping (address => mapping (uint8 => mapping (IERC20 => uint))) subLevelPrice;
    event newPremium(address user, uint8 month, uint price, IERC20 token, uint id);
    event newAiToken(address user, uint8 amount, uint price, IERC20 token, uint id);
    event newDonation(address from, address to, uint amount, IERC20 token, uint id);
    event newItem(address user, address seller, uint16 itemId, uint price, IERC20 token, uint id);
    event newSubToUser(address user, address subscribeTo, uint8 month, uint8 level, uint price, IERC20 token, uint id);
    constructor() {
        owner = payable(msg.sender);
    }
    fallback()external{}
    receive() external payable{}
//____Owner____//
    function changeTokenPrices(IERC20 _token, uint _premiumPrice, uint _aiPrice) external {
        require(msg.sender == owner, "Wrong sender");
        tokenPremiumPrice[_token] = _premiumPrice;
        tokenAiPrice[_token] = _aiPrice;
    }

    function withdraw(IERC20 _token, uint _amount) external {
        require(msg.sender == owner, "Wrong sender");
        if(_token == IERC20(address(0))){
            (bool sent, ) = owner.call{value: _amount}("");
            require(sent);        
        } else {
            _token.transfer(owner, _amount);
        }
    }

    function chagneOwner(address _owner) external {
        require(msg.sender == owner, "Wrong sender");
        owner = payable(_owner);
    }
    
    function changeFee(uint16 _fee) external {
        require(msg.sender == owner, "Wrong sender");
        fee = _fee;
    }

    function changePersonalFee(address _user, uint16 _fee) external {
        require(msg.sender == owner, "Wrong sender");
        personalFee[_user] = _fee;
    }
//____User____//
    function buyAiToken(address _to, uint8 _amount, IERC20 _token) external payable nonReentrant(){
        require(tokenAiPrice[_token] > 0, "Can't pay with this token");
        require(msg.sender != address(0), "Wrong sender");
        uint price = tokenAiPrice[_token] * _amount;
        if(_token == IERC20(address(0)))
            require(msg.value >= price, "Wrong eth amount");
        send(_token, price, msg.sender, owner);
        emit newAiToken(_to, _amount, price, _token, txId);
        txId++;
    }

    function buyPremium(address _to, uint8 _month, IERC20 _token) external payable nonReentrant(){
        require(_month == 1 || _month == 3 || _month == 6 || _month == 9 || _month == 12, "Choose correct month");
        require(tokenPremiumPrice[_token] > 0, "Can't pay with this token");
        require(msg.sender != address(0), "Wrong sender");
        uint price = tokenPremiumPrice[_token] * _month;
        if(_token == IERC20(address(0)))
            require(msg.value >= price, 'Wrong eth amount');
        send(_token, price, msg.sender, owner);
        emit newPremium(_to, _month, price, _token, txId);
        txId++;
    }

    function buySubToUser(address _to, address _user, uint8 _month, uint8 _level, IERC20 _token) external payable nonReentrant(){
        require(_month == 1 || _month == 3 || _month == 6 || _month == 9 || _month == 12, "Choose correct month");
        require(subLevelPrice[_user][_level][_token] > 0 && tokenPremiumPrice[_token] > 0, "Can't pay with this token");
        require(msg.sender != address(0), "Wrong sender");
        uint price = subLevelPrice[_user][_level][_token] * _month;
        uint _fee = personalFee[msg.sender] == 0 ? fee : personalFee[msg.sender];
        uint tax = price * _fee / 1000 ;
        if(_token == IERC20(address(0)))
            require(msg.value >= price, 'Wrong eth amount');
        send(_token, (price - tax), msg.sender, _user);
        send(_token, tax, msg.sender, owner);
        emit newSubToUser(_to, _user, _month, _level, price, _token, txId);
        txId++;
    }

    function buyItem(address _to, address _seller, uint16 _itemId, IERC20 _token) external payable nonReentrant(){
        uint price = itemPrice[_seller][_itemId][_token];
        require(tokenPremiumPrice[_token] > 0 && price > 0, "Can't use this token");
        uint _fee = personalFee[msg.sender] == 0 ? fee : personalFee[msg.sender];
        uint tax = price * _fee / 1000 ;
        if(_token == IERC20(address(0)))
            require(msg.value >= price, "Not enough eth to buy item");
        send(_token, (price - tax), msg.sender, _seller);
        send(_token, tax, msg.sender, owner);
        emit newItem(_to, _seller, _itemId, price, _token, txId);
        txId++;
    }

    function donation(address _user, uint _amount, IERC20 _token) external payable nonReentrant(){
        require(tokenPremiumPrice[_token] > 0, "can't use this token");
        if(_token == IERC20(address(0)))
            _amount = msg.value;
        send(_token, _amount, msg.sender, _user);
        emit newDonation(msg.sender, _user, _amount, _token, txId);
        txId++;
    }

    function changeUserSubPrice(IERC20 _token, uint8 _level, uint _price) external {
        require(tokenPremiumPrice[_token] > 0, "Can't use this token");
        subLevelPrice[msg.sender][_level][_token] = _price;
    }

    function changeItemPrice(IERC20 _token, uint16 _id, uint _price) external {
        require(tokenPremiumPrice[_token] > 0, "Can't use this token");
        itemPrice[msg.sender][_id][_token] = _price; 
    }
//___Private___//
    function send(IERC20 _token, uint _amount, address _from, address _to) private {
        if(_token == IERC20(address(0))){
            (bool sent, ) = _to.call{value: _amount}("");
            require(sent);        
        } else {
            _token.transferFrom(_from, _to, _amount);
        }        
    }
//____View____//
    function getTokenPrices(IERC20 _token) external view returns (uint _premiumPrice, uint _aiPrice) {
        _premiumPrice = tokenPremiumPrice[_token];
        _aiPrice = tokenAiPrice[_token];
    }

    function getUserLevelPrice(address _user, uint8 _level, IERC20 _token) external view returns (uint _subLevelPrice) {
        _subLevelPrice = subLevelPrice[_user][_level][_token];
    }
}
