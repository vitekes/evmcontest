// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "./NetworkFeeManager.sol";
import "./PrizeTemplates.sol";
import "./CreatorBadges.sol";
import "./PrizeManager.sol";
import "./TokenValidator.sol";
import "../interfaces/IContestEscrow.sol";

contract ContestFactory is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /*───────────────────────────  STORAGE  ───────────────────────────────────*/

    address public owner;
    uint64 public lastId;
    address[] public escrows;

    address public immutable escrowImpl;
    NetworkFeeManager public immutable feeManager;
    PrizeTemplates public immutable prizeTemplates;
    CreatorBadges public immutable badges;
    TokenValidator public immutable tokenValidator;
    PrizeManager public immutable prizeManager;

    bool public emergencyStop = false;

    // Защита от спама
    mapping(address => uint256) public lastContestTime;
    uint256 public constant MIN_CONTEST_INTERVAL = 1 hours;

    // Ограничения на время конкурса
    uint256 public constant MAX_CONTEST_DURATION = 270 days;
    uint256 public constant MIN_CONTEST_DURATION = 1 hours;

    /*───────────────────────────  EVENTS  ────────────────────────────────────*/

    event ContestCreated(
        uint64 indexed contestId,
        address indexed creator,
        address escrow,
        IERC20 token,
        uint256 totalPrize,
        uint256 platformFee,
        PrizeTemplates.PrizeTemplate template,
        uint256 startTime,
        uint256 endTime
    );

    event NetworkWarning(
        address indexed creator,
        uint256 chainId,
        string networkName,
        uint256 feePercentage,
        string recommendation
    );

    event ExcessRefunded(
        address indexed creator,
        uint256 excessAmount
    );

    event EmergencyStopActivated(address indexed by, uint256 timestamp);
    event EmergencyStopDeactivated(address indexed by, uint256 timestamp);

    event PrizeManagerIntegrationFailed(uint256 indexed contestId, string reason);

    // Emergency events
    event EscrowEmergencyWithdrawal(
        uint64 indexed contestId,
        address indexed escrowAddress,
        address indexed initiator,
        string reason
    );

    event BatchEmergencyCompleted(
        uint256 totalAttempts,
        uint256 successCount,
        string reason
    );

    event BatchEmergencyFailure(
        uint64 indexed contestId,
        string reason
    );

    event EmergencyRoleGranted(
        uint64 indexed contestId,
        address indexed escrowAddress,
        address indexed emergencyAddress
    );

    event EmergencyRoleRevoked(
        uint64 indexed contestId,
        address indexed escrowAddress,
        address indexed emergencyAddress
    );

    event FactoryETHRecovered(uint256 amount);
    event FactoryTokenRecovered(address indexed token, uint256 amount);

    /*───────────────────────────  STRUCTS  ───────────────────────────────────*/

    struct CreateContestParams {
        IERC20 token;
        uint256 totalPrize;
        PrizeTemplates.PrizeTemplate template;
        PrizeTemplates.PrizeDistribution[] customDistribution;
        address[] jury;
        uint256 startTime;
        uint256 endTime;
        string contestMetadata;
        bool hasNonMonetaryPrizes;
    }

    /*───────────────────────────  MODIFIERS  ────────────────────────────────*/

    modifier notInEmergency() {
        require(!emergencyStop, "Factory in emergency mode");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /*───────────────────────────  CONSTRUCTOR  ───────────────────────────────*/

    constructor(
        address _escrowImpl,
        address _feeManager,
        address _prizeTemplates,
        address _badges,
        address _tokenValidator,
        address _prizeManager
    ) {
        require(_escrowImpl != address(0), "Invalid escrow impl");
        require(_feeManager != address(0), "Invalid fee manager");
        require(_prizeTemplates != address(0), "Invalid prize templates");
        require(_badges != address(0), "Invalid badges");
        require(_tokenValidator != address(0), "Invalid token validator");
        require(_prizeManager != address(0), "Invalid prize manager");

        owner = msg.sender;
        escrowImpl = _escrowImpl;
        feeManager = NetworkFeeManager(payable(_feeManager));
        prizeTemplates = PrizeTemplates(_prizeTemplates);
        badges = CreatorBadges(_badges);
        tokenValidator = TokenValidator(_tokenValidator);
        prizeManager = PrizeManager(_prizeManager);
    }

    /*───────────────────────────  CREATE CONTEST  ────────────────────────────*/

    function createContest(CreateContestParams calldata params)
    external
    payable
    nonReentrant
    notInEmergency
    returns (address esc)
    {
        // Защита от спама
        require(
            block.timestamp >= lastContestTime[msg.sender] + MIN_CONTEST_INTERVAL,
            "Wait between contests"
        );
        lastContestTime[msg.sender] = block.timestamp;

        // Проверяем что создатель не забанен
        require(!feeManager.isCreatorBanned(msg.sender), "Creator is banned");

        // Проверка валидности токена
        if (address(params.token) != address(0)) {
            // Сначала проверяем через isValidToken
            bool isValid = tokenValidator.isValidToken(address(params.token));

            // Если не валиден, проверяем является ли стейблкоином
            if (!isValid) {
                isValid = tokenValidator.isStablecoin(address(params.token));
            }

            // Окончательная проверка
            require(isValid, "Invalid or non-liquid token");
        }

        // Валидация базовых параметров
        require(params.totalPrize > 0, "Prize must be positive");
        require(params.startTime >= block.timestamp, "Start time in past");
        require(params.endTime > params.startTime, "Invalid end time");

        uint256 duration = params.endTime - params.startTime;
        require(duration >= MIN_CONTEST_DURATION, "Contest too short");
        require(duration <= MAX_CONTEST_DURATION, "Contest too long");

        uint64 contestId = lastId++;

        // Получаем распределение призов
        PrizeTemplates.PrizeDistribution[] memory distribution = _getPrizeDistribution(
            params.template,
            params.customDistribution
        );

        // Настройка жюри
        address[] memory jury = params.jury;
        if (jury.length == 0) {
            jury = new address[](1);
            jury[0] = msg.sender;
        }

        // Безопасный расчет комиссии с проверкой overflow
        uint256 platformFee = feeManager.calculateFee(block.chainid, params.totalPrize);
        require(params.totalPrize <= type(uint256).max - platformFee, "Prize amount too large");
        uint256 totalRequired = params.totalPrize + platformFee;

        // Предупреждение о дорогих сетях
        (uint256 feePercentage, string memory networkName, bool isSupported) =
                            feeManager.getNetworkInfo(block.chainid);
        require(isSupported, "Network not supported");

        if (feePercentage >= 1000) {
            emit NetworkWarning(
                msg.sender,
                block.chainid,
                networkName,
                feePercentage,
                "Consider using a cheaper network"
            );
        }

        // Клонируем эскроу контракт
        esc = Clones.clone(escrowImpl);
        escrows.push(esc);

        // Создаем параметры для escrow
        IContestEscrow.ContestParams memory escrowParams = IContestEscrow.ContestParams({
            creator: msg.sender,
            token: params.token,
            totalPrize: params.totalPrize,
            distribution: distribution,
            jury: jury,
            treasury: address(feeManager),
            contestId: contestId,
            startTime: params.startTime,
            endTime: params.endTime,
            metadata: params.contestMetadata
        });

        // Правильная логика переводов средств
        if (address(params.token) == address(0)) {
            // ETH КОНКУРС
            require(msg.value >= totalRequired, "Insufficient ETH");

            uint256 remainingValue = msg.value;

            // 1. Сначала собираем комиссию в FeeManager (если есть)
            if (platformFee > 0) {
                feeManager.collectFee{value: platformFee}(
                    contestId, msg.sender, address(0), params.totalPrize
                );
                remainingValue -= platformFee;
            }

            // 2. Проверяем что достаточно средств для приза
            require(remainingValue >= params.totalPrize, "Insufficient funds after fee");

            // 3. Передаем ТОЧНО params.totalPrize в эскроу
            IContestEscrow(esc).init{value: params.totalPrize}(escrowParams);
            remainingValue -= params.totalPrize;

            // 4. Безопасный возврат излишка с call()
            if (remainingValue > 0) {
                (bool success, ) = payable(msg.sender).call{value: remainingValue}("");
                require(success, "Excess refund failed");
                emit ExcessRefunded(msg.sender, remainingValue);
            }

        } else {
            // ERC20 КОНКУРС
            require(msg.value == 0, "No ETH needed for ERC20 contest");

            // 1. Переводим общую сумму в этот контракт
            params.token.safeTransferFrom(msg.sender, address(this), totalRequired);

            // 2. Собираем комиссию в FeeManager (если есть)
            if (platformFee > 0) {
                params.token.safeTransfer(address(feeManager), platformFee);
                // Уведомляем FeeManager о получении комиссии
                feeManager.collectFee(contestId, msg.sender, address(params.token), params.totalPrize);
            }

            // 3. Передаем токены в escrow ДО инициализации
            params.token.safeTransfer(esc, params.totalPrize);

            // 4. Инициализируем escrow (БЕЗ value - только параметры)
            IContestEscrow(esc).init(escrowParams);
        }

        // Интеграция с PrizeManager - используем try/catch для совместимости
        try prizeManager.createContest(contestId, params.contestMetadata) {
            // Success - PrizeManager уведомлен
        } catch {
            emit PrizeManagerIntegrationFailed(contestId, "Registration failed");
        }

        // Награждаем создателя за активность - используем try/catch для совместимости
        try badges.recordContest(msg.sender, contestId) {
            // Success - Badge создан
        } catch {
            // Ошибка badge не критична для создания конкурса
        }

        emit ContestCreated(
            contestId,
            msg.sender,
            esc,
            params.token,
            params.totalPrize,
            platformFee,
            params.template,
            params.startTime,
            params.endTime
        );

        return esc;
    }

    /*───────────────────────────  PRIZE DISTRIBUTION  ────────────────────────*/

    function _getPrizeDistribution(
        PrizeTemplates.PrizeTemplate template,
        PrizeTemplates.PrizeDistribution[] memory customDistribution
    ) internal view returns (PrizeTemplates.PrizeDistribution[] memory) {
        if (template == PrizeTemplates.PrizeTemplate.CUSTOM) {
            require(customDistribution.length > 0, "Custom distribution required");

            uint256 totalPercentage = 0;
            for (uint256 i = 0; i < customDistribution.length; i++) {
                require(customDistribution[i].place > 0, "Invalid place");
                require(customDistribution[i].percentage > 0, "Invalid percentage");
                totalPercentage += customDistribution[i].percentage;
            }
            require(totalPercentage == 10000, "Distribution must total 100%");

            return customDistribution;
        } else {
            return prizeTemplates.getTemplate(template);
        }
    }

    /*───────────────────────────  VIEW FUNCTIONS  ────────────────────────────*/

    function getEscrowsCount() external view returns (uint256) {
        return escrows.length;
    }

    function getEscrow(uint256 index) external view returns (address) {
        require(index < escrows.length, "Index out of bounds");
        return escrows[index];
    }

    function getContestInfo(uint64 contestId) external view returns (
        address escrowAddress,
        bool exists
    ) {
        if (contestId >= lastId) {
            return (address(0), false);
        }

        address escrowAddr = escrows[contestId];
        return (escrowAddr, escrowAddr != address(0));
    }

    /*───────────────────────────  EMERGENCY FUNCTIONS  ───────────────────────*/

    struct EmergencyInfo {
        address escrowAddress;
        bool canEmergencyWithdraw;
        bool isStale;
        uint256 daysSinceEnd;
    }

    function setEmergencyStop(bool _stop) external onlyOwner {
        emergencyStop = _stop;
        if (_stop) {
            emit EmergencyStopActivated(msg.sender, block.timestamp);
        } else {
            emit EmergencyStopDeactivated(msg.sender, block.timestamp);
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getEscrowEmergencyInfo(uint64 contestId) external view returns (
        EmergencyInfo memory info
    ) {
        require(contestId < lastId, "Contest does not exist");

        address escrowAddress = escrows[contestId];
        IContestEscrow escrow = IContestEscrow(escrowAddress);

        uint256 endTime = escrow.endTime();

        // Безопасное вычисление daysSinceEnd
        uint256 daysSinceEnd = 0;
        if (block.timestamp > endTime) {
            daysSinceEnd = (block.timestamp - endTime) / 86400;
        }

        bool isStale = daysSinceEnd > 180; // 180 дней
        bool canEmergencyWithdraw = isStale || escrow.hasEmergencyRole(owner);

        return EmergencyInfo({
            escrowAddress: escrowAddress,
            canEmergencyWithdraw: canEmergencyWithdraw,
            isStale: isStale,
            daysSinceEnd: daysSinceEnd
        });
    }

    function emergencyWithdrawFromEscrow(uint64 contestId, string calldata reason) external onlyOwner {
        address escrowAddress = escrows[contestId];
        require(escrowAddress != address(0), "Contest not found");

        IContestEscrow escrow = IContestEscrow(escrowAddress);

        // Получаем информацию о конкурсе
        (,,,uint256 endTime,,bool isFinalized,bool isCancelled) = escrow.getContestInfo();

        // Добавляем временные ограничения
        if (!isCancelled && !isFinalized) {
            require(block.timestamp > endTime + 30 days, "Too early: need 30 days");
        }

        escrow.emergencyWithdraw(reason);

        emit EscrowEmergencyWithdrawal(contestId, escrowAddress, msg.sender, reason);
    }

    function withdrawRemainingFundsFromEscrow(uint64 contestId) external onlyOwner {
        address escrowAddress = escrows[contestId];
        require(escrowAddress != address(0), "Contest not found");

        IContestEscrow escrow = IContestEscrow(escrowAddress);

        // Эта функция имеет встроенные проверки на время и статус конкурса
        escrow.withdrawRemainingFunds();

        emit EscrowEmergencyWithdrawal(
            contestId, 
            escrowAddress, 
            msg.sender, 
            "Remaining funds withdrawn after contest completion"
        );
    }


    function batchEmergencyWithdraw(uint64[] calldata contestIds, string calldata reason)
    external
    onlyOwner
    whenNotPaused
    {
        uint256 successCount = 0;

        for (uint256 i = 0; i < contestIds.length; i++) {
            try this.getEscrowEmergencyInfo(contestIds[i]) returns (EmergencyInfo memory info) {
                if (info.canEmergencyWithdraw) {
                    try IContestEscrow(info.escrowAddress).emergencyWithdraw(reason) {
                        successCount++;
                    } catch {
                        emit BatchEmergencyFailure(contestIds[i], "Withdrawal failed");
                    }
                } else {
                    emit BatchEmergencyFailure(contestIds[i], "Not eligible for emergency withdrawal");
                }
            } catch {
                emit BatchEmergencyFailure(contestIds[i], "Contest info retrieval failed");
            }
        }

        emit BatchEmergencyCompleted(contestIds.length, successCount, reason);
    }

    function grantEmergencyRole(uint64 contestId, address emergencyAddress)
    external
    onlyOwner
    {
        require(contestId < lastId, "Contest does not exist");
        require(emergencyAddress != address(0), "Invalid emergency address");

        address escrowAddr = escrows[contestId];
        require(escrowAddr != address(0), "Escrow not found");

        // Используем низкоуровневый вызов для совместимости
        (bool success, ) = escrowAddr.call(
            abi.encodeWithSignature(
                "grantRole(bytes32,address)",
                keccak256("EMERGENCY_ROLE"),
                emergencyAddress
            )
        );

        if (success) {
            emit EmergencyRoleGranted(contestId, escrowAddr, emergencyAddress);
        } else {
            revert("Failed to grant emergency role");
        }
    }

    function revokeEmergencyRole(uint64 contestId, address emergencyAddress)
    external
    onlyOwner
    {
        require(contestId < lastId, "Contest does not exist");
        require(emergencyAddress != address(0), "Invalid emergency address");

        address escrowAddr = escrows[contestId];
        require(escrowAddr != address(0), "Escrow not found");

        // Используем низкоуровневый вызов для совместимости
        (bool success, ) = escrowAddr.call(
            abi.encodeWithSignature(
                "revokeRole(bytes32,address)",
                keccak256("EMERGENCY_ROLE"),
                emergencyAddress
            )
        );

        if (success) {
            emit EmergencyRoleRevoked(contestId, escrowAddr, emergencyAddress);
        } else {
            revert("Failed to revoke emergency role");
        }
    }

    function recoverFactoryETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to recover");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "ETH recovery failed");

        emit FactoryETHRecovered(balance);
    }

    function recoverFactoryTokens(IERC20 token) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens to recover");

        token.safeTransfer(owner, balance);
        emit FactoryTokenRecovered(address(token), balance);
    }

    /*───────────────────────────  RECEIVE  ───────────────────────────────────*/

    receive() external payable {
        // Принимаем ETH для рефандов и emergency операций
    }
}