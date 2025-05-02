// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "./interfaces/iPayment.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract Giveaways is ReentrancyGuard{
    struct Giveaway {
        address owner;
        IERC20  token;
        uint    prize;
        uint8[] prizeType;

        uint    startTime;
        uint    endTime;
        uint    prizeTime;

        address[]  users;
        address[]  winners;

        bool    active;
    }
    uint64 public id;
    IPayment payment;
    address payable public owner;
    mapping (uint64 => Giveaway) giveaways;
    mapping (uint64 => mapping (address => uint64)) usersId;
    event sendMoney(address user, uint amount, IERC20 token);
    event endGiveaways(uint64 id, Giveaway data);
    constructor(IPayment _payment) {
        owner = payable(msg.sender);
        payment = _payment;
    }
    fallback()external{}
    receive() external payable{}
//____Owner____//
    function endGiveaway(uint64 _id, address[] memory _winners) external {
        Giveaway storage gw = giveaways[_id];
        require(gw.endTime < block.timestamp, "Giveaway is not ended");
        require(gw.winners.length == 0, "Giveaway is ended");
        require(msg.sender == owner, "You aren't the owner");
        gw.active  = false;
        if(gw.users.length < gw.prizeType.length){
            send(gw.token,gw.prize,gw.owner);
            gw.winners.push(gw.owner);
            emit endGiveaways(_id, gw);
            return;
        }else{
            require((_winners.length) == gw.prizeType.length, "Wrong winners amount");
        }
        gw.winners = _winners;
        emit endGiveaways(_id, gw);
    }

    function changeActive(uint64 _id, bool _active) external {
        require(msg.sender == owner, "Wrong sender");
        giveaways[_id].active = _active;
    }

    function changePayment( IPayment _payment) external {
        require(msg.sender == owner, "Wrong sender");
        payment = _payment;
    }

    function withdraw(IERC20 _token, uint _amount) external {
        require(msg.sender == owner, "Wrong sender");
        send(_token,_amount,owner);
    }

    function sendPrize(address[] memory _users, uint[] memory _amount, IERC20 _token) external {
        require(_users.length == _amount.length, "arrays must be the same length");
        require(msg.sender == owner, "Wrong sender");
        if (_token == IERC20(address(0))){
            for(uint i = 0; i < _users.length; i++){
                (bool sent, ) = _users[i].call{value: _amount[i]}("");
                if(sent){
                    emit sendMoney(_users[i], _amount[i], _token);
                }                 
            }
        } else {
            for(uint i = 0; i < _users.length; i++){
                _token.transfer(_users[i], _amount[i]);
                emit sendMoney(_users[i], _amount[i], _token);
            }
        }

    }

//____User____//
    function createGiveaway(uint _prize, IERC20 _token, uint8[] memory _prizeType, uint _startTime, uint _endTime, uint _prizeTime) external payable nonReentrant() {
        (uint premiumPrice, ) = payment.getTokenPrices(_token);
        if(_token == IERC20(address(0))) {
            _prize = msg.value;
        } else {
            _token.transferFrom(msg.sender, address(this), _prize);
        }
        require(_endTime > _startTime, "End time must be more than start time");
        require(_prizeTime >= _endTime, "Prize time must be >= end time");
        require(msg.sender != address(0), "Wrong sender");
        require(premiumPrice > 0, "Can't use this token");
        require(_prize > 0, "choose prize above 0");
        _startTime += block.timestamp;
        _endTime += block.timestamp;
        _prizeTime += block.timestamp;
        address[] memory _users;
        giveaways[id] = Giveaway(
            msg.sender,
            _token,
            _prize,
            _prizeType,
            _startTime,
            _endTime,
            _prizeTime,
            _users,
            _users,
            true
        );
        id++;
    }

    function addPrize(uint64 _id, uint _prize) external payable nonReentrant(){
        Giveaway storage gw = giveaways[_id];
        require(gw.endTime > block.timestamp && gw.active, "giveaway is not active");
        require(msg.sender != address(0), "Wrong sender");
        require(gw.owner == msg.sender, "Wrong sender");
        gw.prize += _prize;
    }

    function participate(uint64 _id) external {
        Giveaway storage gw = giveaways[_id];
        require(gw.active, "Giveaway is not active");
        require(msg.sender != address(0), "Wrong sender");
        require(usersId[_id][msg.sender] == 0, "You are already participated");
        require(gw.startTime < block.timestamp && gw.endTime > block.timestamp, "giveaway is not active");
        gw.users.push(payable(msg.sender));
        usersId[_id][msg.sender] = uint64(gw.users.length);
    }
//__Private__//
    function send(IERC20 _token, uint _amount, address _to) private {
        if(_token == IERC20(address(0))){
            (bool sent, ) = _to.call{value: _amount}("");
            require(sent);        
        } else {
            _token.transfer(_to, _amount);
        }        
    }
//____View____//
    function getGiveaway(uint64 _id) external view returns (Giveaway memory _gw) {
        _gw = giveaways[_id];
    }

    function getGiveaways(uint64 _page, uint64 _amount) external view returns (Giveaway[] memory _gw) {
        if(_amount == 0){
            _amount = id;
            _page = 0;
        }
        _gw = new Giveaway[](_amount);
        uint64 from = _page * _amount;
        uint64 to = (_page + 1) * _amount;
        for(uint64 i=from; i<to;i++){
            Giveaway memory item = giveaways[i];
            _gw[i] = item;
        }
    }

    function getWinners(uint64 _id) external view returns (address[] memory _winners) {
        _winners = giveaways[_id].winners;
    }
}
