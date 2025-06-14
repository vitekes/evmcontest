// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IContestEscrow.sol";
import "./PrizeTemplates.sol";

contract ContestEscrow is IContestEscrow, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant JURY_ROLE = keccak256("JURY_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Storage variables
    address private _creator;
    IERC20 private _token;
    uint256 private _totalPrize;
    PrizeTemplates.PrizeDistribution[] private _distribution;
    address[] private _jury;
    address private _treasury;
    uint256 private _contestId;
    uint256 private _startTime;
    uint256 private _endTime;
    string private _metadata;
    address private _factory;

    // Contest state
    bool private _isFinalized;
    bool private _isCancelled;
    address[] private _winners;
    uint256[] private _winnerPlaces;
    mapping(address => bool) private _hasClaimed;
    mapping(address => uint256) private _claimedAmounts;
    uint256 public lastEmergencyWithdraw;
    uint256 public constant EMERGENCY_COOLDOWN = 1 days;
    uint256 private constant TIME_BUFFER = 1 minutes;

    error EmergencyCooldownActive();

    // Events
    event ContestInitialized(uint256 indexed contestId, address indexed creator, uint256 totalPrize);
    event WinnersDeclared(address[] winners, uint256[] places);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event ContestCancelled(string reason);
    event EmergencyWithdrawal(address indexed initiator, uint256 amount, string reason);

    modifier onlyCreator() {
        require(msg.sender == _creator, "Only creator can call this");
        _;
    }

    modifier onlyJury() {
        require(hasRole(JURY_ROLE, msg.sender) || msg.sender == _creator, "Only jury or creator");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == _factory, "Only factory can call this");
        _;
    }

    modifier onlyActive() {
        require(!_isCancelled && !_isFinalized, "Contest not active");
        require(block.timestamp + TIME_BUFFER >= _startTime, "Contest not started");
        require(block.timestamp <= _endTime + TIME_BUFFER, "Contest ended");
        _;
    }

    modifier onlyFinalized() {
        require(_isFinalized, "Contest not finalized");
        _;
    }

    function init(ContestParams calldata params) external payable override {
        require(params.creator != address(0), "Zero creator address");
        require(params.treasury != address(0), "Zero treasury address");
        require(_factory == address(0), "Already initialized");

        _factory = msg.sender;
        _creator = params.creator;
        _token = params.token;
        _totalPrize = params.totalPrize;
        _treasury = params.treasury;
        _contestId = params.contestId;
        _startTime = params.startTime;
        _endTime = params.endTime;
        _metadata = params.metadata;

        // Copy distribution array
        for (uint256 i = 0; i < params.distribution.length; i++) {
            _distribution.push(params.distribution[i]);
        }

        // Copy jury array
        for (uint256 i = 0; i < params.jury.length; i++) {
            _jury.push(params.jury[i]);
        }

        // Set up access control
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        _grantRole(EMERGENCY_ROLE, _factory);

        // Grant jury roles
        for (uint256 i = 0; i < _jury.length; i++) {
            _grantRole(JURY_ROLE, _jury[i]);
        }

        // Handle payment - правильная проверка типа токена
        if (address(_token) == address(0)) {
            // ETH конкурс
            require(msg.value == _totalPrize, "Incorrect ETH amount");
        } else {
            // ERC20 конкурс - токены уже должны быть переведены на этот контракт из Factory
            require(msg.value == 0, "No ETH needed for ERC20 contest");
            require(_token.balanceOf(address(this)) >= _totalPrize, "Insufficient token balance");
        }

        emit ContestInitialized(_contestId, _creator, _totalPrize);
    }

    function declareWinners(
        address[] calldata winners,
        uint256[] calldata places
    ) external override onlyJury {
        require(block.timestamp + TIME_BUFFER > _endTime, "Contest still active");
        require(!_isFinalized && !_isCancelled, "Contest already finalized or cancelled");
        require(winners.length == places.length, "Mismatched arrays");
        require(winners.length <= _distribution.length, "Too many winners");

        // Validate places - проверка дубликатов без использования mapping
        for (uint256 i = 0; i < places.length; i++) {
            require(places[i] > 0 && places[i] <= _distribution.length, "Invalid place");
            require(winners[i] != address(0), "Zero winner address");

            // Проверка на дубликаты мест
            for (uint256 j = 0; j < i; j++) {
                require(places[j] != places[i], "Duplicate place");
            }
        }

        _winners = winners;
        _winnerPlaces = places;
        _isFinalized = true;

        emit WinnersDeclared(winners, places);
    }

    function claimPrize() external override onlyFinalized nonReentrant {
        require(!_hasClaimed[msg.sender], "Already claimed");

        uint256 winnerIndex = _findWinnerIndex(msg.sender);
        require(winnerIndex < _winners.length, "Not a winner");

        uint256 place = _winnerPlaces[winnerIndex];
        uint256 prizeAmount = _calculatePrizeAmount(place);

        require(prizeAmount > 0, "No prize for this place");

        _hasClaimed[msg.sender] = true;
        _claimedAmounts[msg.sender] = prizeAmount;

        // Transfer prize - правильная проверка типа токена
        if (address(_token) == address(0)) {
            // ETH конкурс
            (bool success,) = msg.sender.call{value: prizeAmount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20 конкурс - исправлено: переводим приз победителю, а не создателю
            SafeERC20.safeTransfer(_token, msg.sender, prizeAmount);
        }

        emit PrizeClaimed(msg.sender, prizeAmount);
    }

    function cancel(string calldata reason) external override onlyCreator {
        require(!_isFinalized, "Contest already finalized");
        require(!_isCancelled, "Already cancelled");

        _isCancelled = true;

        // Refund the prize to creator - правильная проверка типа токена
        if (address(_token) == address(0)) {
            // ETH конкурс
            (bool success,) = _creator.call{value: _totalPrize}("");
            require(success, "ETH refund failed");
        } else {
            // ERC20 конкурс
            SafeERC20.safeTransfer(_token, _creator, _totalPrize);
        }

        emit ContestCancelled(reason);
    }

    function emergencyWithdraw(string calldata reason) external override onlyFactory {
        // onlyFactory модификатор уже проверяет доступ
        if (block.timestamp < lastEmergencyWithdraw + EMERGENCY_COOLDOWN)
            revert EmergencyCooldownActive();
        lastEmergencyWithdraw = block.timestamp;

        // Emergency withdrawal - правильная проверка типа токена
        uint256 balance;
        if (address(_token) == address(0)) {
            // ETH конкурс
            balance = address(this).balance;
            if (balance > 0) {
                (bool success,) = _treasury.call{value: balance}("");
                require(success, "ETH emergency transfer failed");
            }
        } else {
            // ERC20 конкурс
            balance = _token.balanceOf(address(this));
            if (balance > 0) {
                SafeERC20.safeTransfer(_token, _treasury, balance);
            }
        }

        emit EmergencyWithdrawal(msg.sender, balance, reason);
    }

    // View functions implementing interface
    function getContestInfo() external view override returns (
        address contestCreator,
        uint256 totalPrize,
        uint256 contestStartTime,
        uint256 contestEndTime,
        bool isActive,
        bool isFinalized,
        bool isCancelled
    ) {
        return (
            _creator,
            _totalPrize,
            _startTime,
            _endTime,
            block.timestamp >= _startTime && block.timestamp <= _endTime && !_isCancelled && !_isFinalized,
            _isFinalized,
            _isCancelled
        );
    }

    function token() external view override returns (IERC20) {
        return _token;
    }

    function creator() external view override returns (address) {
        return _creator;
    }

    function factory() external view override returns (address) {
        return _factory;
    }

    function treasury() external view override returns (address) {
        return _treasury;
    }

    function endTime() external view override returns (uint256) {
        return _endTime;
    }

    function startTime() external view override returns (uint256) {
        return _startTime;
    }

    function getContestParams() external view override returns (ContestParams memory) {
        return ContestParams({
            creator: _creator,
            token: _token,
            totalPrize: _totalPrize,
            distribution: _distribution,
            jury: _jury,
            treasury: _treasury,
            contestId: _contestId,
            startTime: _startTime,
            endTime: _endTime,
            metadata: _metadata
        });
    }

    function hasEmergencyRole(address account) external view override returns (bool) {
        return hasRole(EMERGENCY_ROLE, account);
    }

    // Функция для проверки, является ли адрес членом жюри
    function isJury(address account) external view returns (bool) {
        return hasRole(JURY_ROLE, account);
    }

    // Additional view functions
    function getWinners() external view returns (address[] memory, uint256[] memory) {
        return (_winners, _winnerPlaces);
    }

    function getDistribution() external view returns (PrizeTemplates.PrizeDistribution[] memory) {
        return _distribution;
    }

    function getJury() external view returns (address[] memory) {
        return _jury;
    }

    function hasClaimed(address winner) external view returns (bool) {
        return _hasClaimed[winner];
    }

    function getClaimedAmount(address winner) external view returns (uint256) {
        return _claimedAmounts[winner];
    }

    // Private helper functions
    function _findWinnerIndex(address winner) private view returns (uint256) {
        for (uint256 i = 0; i < _winners.length; i++) {
            if (_winners[i] == winner) {
                return i;
            }
        }
        return type(uint256).max; // Not found
    }

    function _calculatePrizeAmount(uint256 place) private view returns (uint256) {
        for (uint256 i = 0; i < _distribution.length; i++) {
            if (_distribution[i].place == place) {
                return (_totalPrize * _distribution[i].percentage) / 10000;
            }
        }
        return 0;
    }

    // Функция для вывода оставшихся средств после окончания конкурса
    function withdrawRemainingFunds() external onlyFactory {
        require(_isFinalized, "Contest not finalized");
        require(block.timestamp > _endTime + 30 days, "Too early for cleanup");

        // Проверяем, все ли призы были выплачены
        bool allClaimedOrExpired = true;
        for (uint256 i = 0; i < _winners.length; i++) {
            if (!_hasClaimed[_winners[i]]) {
                allClaimedOrExpired = false;
                break;
            }
        }

        require(allClaimedOrExpired || block.timestamp > _endTime + 90 days, 
                "Not all prizes claimed and not expired");

        uint256 balance;
        if (address(_token) == address(0)) {
            // ETH конкурс
            balance = address(this).balance;
            if (balance > 0) {
                (bool success, ) = _treasury.call{value: balance}("");
                require(success, "ETH transfer failed");
            }
        } else {
            // ERC20 конкурс
            balance = _token.balanceOf(address(this));
            if (balance > 0) {
                SafeERC20.safeTransfer(_token, _treasury, balance);
            }
        }

        emit EmergencyWithdrawal(msg.sender, balance, "Remaining funds withdrawn");
    }

    // Emergency functions
    receive() external payable {
        // Allow receiving ETH for emergency recovery
    }

    fallback() external payable {
        // Allow receiving ETH for emergency recovery
    }
}