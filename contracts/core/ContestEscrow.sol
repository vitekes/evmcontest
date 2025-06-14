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
    error OnlyCreator();
    error OnlyJuryOrCreator();
    error OnlyFactory();
    error ContestNotActive();
    error ContestNotStarted();
    error ContestEnded();
    error ContestNotFinalized();
    error ZeroCreatorAddress();
    error ZeroTreasuryAddress();
    error AlreadyInitialized();
    error IncorrectEthAmount();
    error NoEthNeeded();
    error InsufficientTokenBalance();
    error ContestStillActive();
    error AlreadyFinalizedOrCancelled();
    error MismatchedArrays();
    error TooManyWinners();
    error InvalidPlace();
    error ZeroWinnerAddress();
    error DuplicatePlace();
    error AlreadyClaimed();
    error NotAWinner();
    error NoPrizeForPlace();
    error EthTransferFailed();
    error ContestAlreadyFinalized();
    error AlreadyCancelled();
    error EthRefundFailed();
    error EthEmergencyTransferFailed();
    error ContestNotFinalizedForWithdraw();
    error TooEarlyForCleanup();
    error NotAllPrizesClaimed();

    // Events
    event ContestInitialized(uint256 indexed contestId, address indexed creator, uint256 totalPrize);
    event WinnersDeclared(address[] winners, uint256[] places);
    event PrizeClaimed(address indexed winner, uint256 amount);
    event ContestCancelled(string reason);
    event EmergencyWithdrawal(address indexed initiator, uint256 oldBalance, uint256 newBalance, string reason);

    modifier onlyCreator() {
        if (msg.sender != _creator) revert OnlyCreator();
        _;
    }

    modifier onlyJury() {
        if (!(hasRole(JURY_ROLE, msg.sender) || msg.sender == _creator)) revert OnlyJuryOrCreator();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != _factory) revert OnlyFactory();
        _;
    }

    modifier onlyActive() {
        if (_isCancelled || _isFinalized) revert ContestNotActive();
        if (block.timestamp + TIME_BUFFER < _startTime) revert ContestNotStarted();
        if (block.timestamp > _endTime + TIME_BUFFER) revert ContestEnded();
        _;
    }

    modifier onlyFinalized() {
        if (!_isFinalized) revert ContestNotFinalized();
        _;
    }

    function init(ContestParams calldata params) external payable override {
        if (params.creator == address(0)) revert ZeroCreatorAddress();
        if (params.treasury == address(0)) revert ZeroTreasuryAddress();
        if (_factory != address(0)) revert AlreadyInitialized();

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
            if (msg.value != _totalPrize) revert IncorrectEthAmount();
        } else {
            // ERC20 конкурс - токены уже должны быть переведены на этот контракт из Factory
            if (msg.value != 0) revert NoEthNeeded();
            if (_token.balanceOf(address(this)) < _totalPrize) revert InsufficientTokenBalance();
        }

        emit ContestInitialized(_contestId, _creator, _totalPrize);
    }

    function declareWinners(
        address[] calldata winners,
        uint256[] calldata places
    ) external override onlyJury {
        if (block.timestamp + TIME_BUFFER <= _endTime) revert ContestStillActive();
        if (_isFinalized || _isCancelled) revert AlreadyFinalizedOrCancelled();
        if (winners.length != places.length) revert MismatchedArrays();
        if (winners.length > _distribution.length) revert TooManyWinners();

        // Validate places - проверка дубликатов без использования mapping
        for (uint256 i = 0; i < places.length; i++) {
            if (places[i] == 0 || places[i] > _distribution.length) revert InvalidPlace();
            if (winners[i] == address(0)) revert ZeroWinnerAddress();

            // Проверка на дубликаты мест
            for (uint256 j = 0; j < i; j++) {
                if (places[j] == places[i]) revert DuplicatePlace();
            }
        }

        _winners = winners;
        _winnerPlaces = places;
        _isFinalized = true;

        emit WinnersDeclared(winners, places);
    }

    function claimPrize() external override onlyFinalized nonReentrant {
        if (_hasClaimed[msg.sender]) revert AlreadyClaimed();

        uint256 winnerIndex = _findWinnerIndex(msg.sender);
        if (winnerIndex >= _winners.length) revert NotAWinner();

        uint256 place = _winnerPlaces[winnerIndex];
        uint256 prizeAmount = _calculatePrizeAmount(place);

        if (prizeAmount == 0) revert NoPrizeForPlace();

        _hasClaimed[msg.sender] = true;
        _claimedAmounts[msg.sender] = prizeAmount;

        // Transfer prize - правильная проверка типа токена
        if (address(_token) == address(0)) {
            // ETH конкурс
            (bool success,) = msg.sender.call{value: prizeAmount}("");
            if (!success) revert EthTransferFailed();
        } else {
            // ERC20 конкурс - исправлено: переводим приз победителю, а не создателю
            SafeERC20.safeTransfer(_token, msg.sender, prizeAmount);
        }

        emit PrizeClaimed(msg.sender, prizeAmount);
    }

    function cancel(string calldata reason) external override onlyCreator {
        if (_isFinalized) revert ContestAlreadyFinalized();
        if (_isCancelled) revert AlreadyCancelled();

        _isCancelled = true;

        // Refund the prize to creator - правильная проверка типа токена
        if (address(_token) == address(0)) {
            // ETH конкурс
            (bool success,) = _creator.call{value: _totalPrize}("");
            if (!success) revert EthRefundFailed();
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
        uint256 oldBalance;
        if (address(_token) == address(0)) {
            // ETH конкурс
            oldBalance = address(this).balance;
            if (oldBalance > 0) {
                (bool success,) = _treasury.call{value: oldBalance}("");
                if (!success) revert EthEmergencyTransferFailed();
            }
        } else {
            // ERC20 конкурс
            oldBalance = _token.balanceOf(address(this));
            if (oldBalance > 0) {
                SafeERC20.safeTransfer(_token, _treasury, oldBalance);
            }
        }
        uint256 newBalance = address(_token) == address(0)
            ? address(this).balance
            : _token.balanceOf(address(this));

        emit EmergencyWithdrawal(msg.sender, oldBalance, newBalance, reason);
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
        if (!_isFinalized) revert ContestNotFinalizedForWithdraw();
        if (block.timestamp <= _endTime + 30 days) revert TooEarlyForCleanup();

        // Проверяем, все ли призы были выплачены
        bool allClaimedOrExpired = true;
        for (uint256 i = 0; i < _winners.length; i++) {
            if (!_hasClaimed[_winners[i]]) {
                allClaimedOrExpired = false;
                break;
            }
        }

        if (!(allClaimedOrExpired || block.timestamp > _endTime + 90 days)) revert NotAllPrizesClaimed();

        uint256 oldBalance;
        if (address(_token) == address(0)) {
            // ETH конкурс
            oldBalance = address(this).balance;
            if (oldBalance > 0) {
                (bool success, ) = _treasury.call{value: oldBalance}("");
                if (!success) revert EthTransferFailed();
            }
        } else {
            // ERC20 конкурс
            oldBalance = _token.balanceOf(address(this));
            if (oldBalance > 0) {
                SafeERC20.safeTransfer(_token, _treasury, oldBalance);
            }
        }
        uint256 newBalance = address(_token) == address(0)
            ? address(this).balance
            : _token.balanceOf(address(this));

        emit EmergencyWithdrawal(msg.sender, oldBalance, newBalance, "Remaining funds withdrawn");
    }

    // Emergency functions
    receive() external payable {
        // Allow receiving ETH for emergency recovery
    }

    fallback() external payable {
        // Allow receiving ETH for emergency recovery
    }
}