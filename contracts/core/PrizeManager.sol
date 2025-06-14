// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IPrizeManager.sol";

contract PrizeManager is IPrizeManager, Ownable, ReentrancyGuard {
    
    /*───────────────────────────  STORAGE  ───────────────────────────────────*/
    
    mapping(uint256 => ContestPrizes) public contestPrizes;
    mapping(address => bool) public authorizedCreators; // Авторизованные создатели призов
    mapping(uint256 => address) public contestCreators; // Создатель каждого конкурса
    
    // Для связи с бэкендом
    mapping(bytes32 => bool) public processedEvents; // Обработанные события
    
    /*───────────────────────────  EVENTS  ────────────────────────────────────*/
    
    event PrizeAdded(
        uint256 indexed contestId, 
        uint256 indexed prizeIndex,
        PrizeType prizeType,
        uint256 monetaryValue,
        string metadata
    );
    
    event PrizeClaimed(
        uint256 indexed contestId,
        uint256 indexed prizeIndex, 
        address indexed winner,
        PrizeType prizeType
    );
    
    event SecretRevealed(
        uint256 indexed contestId,
        uint256 indexed prizeIndex,
        address indexed winner,
        string secret
    );
    
    event ContestMetadataUpdated(
        uint256 indexed contestId,
        string metadata
    );
    
    // Событие для бэкенда - создание промокода
    event PromocodeRequested(
        uint256 indexed contestId,
        uint256 indexed prizeIndex,
        address indexed winner,
        string prizeMetadata,
        bytes32 requestId
    );

    /*───────────────────────────  ERRORS  ───────────────────────────────────*/
    error NotAuthorized();
    error NotContestCreator();
    error ContestAlreadyExists();
    error InvalidPrizeIndex();
    error PrizeAlreadyClaimed();
    error PrizeExpired();
    error PrizeNotClaimed();
    error NoSecret();
    error InvalidSecret();
    error AlreadyProcessed();
    
    /*───────────────────────────  MODIFIERS  ─────────────────────────────────*/
    
    modifier onlyAuthorized() {
        if (!(authorizedCreators[msg.sender] || msg.sender == owner())) revert NotAuthorized();
        _;
    }

    modifier onlyContestCreator(uint256 contestId) {
        if (contestCreators[contestId] != msg.sender) revert NotContestCreator();
        _;
    }
    
    /*───────────────────────────  CONSTRUCTOR  ───────────────────────────────*/
    
    constructor() Ownable(msg.sender) {
        authorizedCreators[msg.sender] = true;
    }
    
    /*───────────────────────────  ADMIN FUNCTIONS  ───────────────────────────*/
    
    function setAuthorizedCreator(address creator, bool authorized) external onlyOwner {
        authorizedCreators[creator] = authorized;
    }
    
    /*───────────────────────────  CONTEST CREATION  ──────────────────────────*/
    
    function createContest(
        uint256 contestId,
        string calldata metadata
    ) external onlyAuthorized {
        if (contestCreators[contestId] != address(0)) revert ContestAlreadyExists();
        
        contestCreators[contestId] = msg.sender;
        contestPrizes[contestId].contestMetadata = metadata;
        
        emit ContestMetadataUpdated(contestId, metadata);
    }
    
    function addPrize(
        uint256 contestId,
        PrizeType prizeType,
        uint256 monetaryValue,
        string calldata metadata,
        bytes32 secretHash,
        uint256 expirationDate
    ) external override onlyContestCreator(contestId) {
        
        Prize memory newPrize = Prize({
            prizeType: prizeType,
            monetaryValue: monetaryValue,
            metadata: metadata,
            claimed: false,
            secretHash: secretHash,
            expirationDate: expirationDate
        });
        
        contestPrizes[contestId].prizes.push(newPrize);
        
        if (prizeType == PrizeType.MONETARY) {
            contestPrizes[contestId].totalMonetaryValue += monetaryValue;
        } else {
            contestPrizes[contestId].hasNonMonetaryPrizes = true;
        }
        
        uint256 prizeIndex = contestPrizes[contestId].prizes.length - 1;
        
        emit PrizeAdded(contestId, prizeIndex, prizeType, monetaryValue, metadata);
    }
    
    /*───────────────────────────  PRIZE CLAIMING  ────────────────────────────*/
    
    function claimPrize(
        uint256 contestId, 
        uint256 prizeIndex, 
        address winner
    ) external override onlyAuthorized nonReentrant {
        if (prizeIndex >= contestPrizes[contestId].prizes.length) revert InvalidPrizeIndex();
        
        Prize storage prize = contestPrizes[contestId].prizes[prizeIndex];
        if (prize.claimed) revert PrizeAlreadyClaimed();
        if (!(block.timestamp <= prize.expirationDate || prize.expirationDate == 0)) revert PrizeExpired();
        
        prize.claimed = true;
        
        // Для неденежных призов создаем запрос к бэкенду
        if (prize.prizeType != PrizeType.MONETARY) {
            bytes32 requestId = keccak256(abi.encodePacked(
                contestId, 
                prizeIndex, 
                winner, 
                block.timestamp
            ));
            
            emit PromocodeRequested(
                contestId,
                prizeIndex, 
                winner,
                prize.metadata,
                requestId
            );
        }
        
        emit PrizeClaimed(contestId, prizeIndex, winner, prize.prizeType);
    }
    
    function revealSecret(
        uint256 contestId,
        uint256 prizeIndex,
        string calldata secret
    ) external override {
        Prize storage prize = contestPrizes[contestId].prizes[prizeIndex];
        if (!prize.claimed) revert PrizeNotClaimed();
        if (prize.secretHash == bytes32(0)) revert NoSecret();
        if (keccak256(abi.encodePacked(secret)) != prize.secretHash) revert InvalidSecret();
        
        emit SecretRevealed(contestId, prizeIndex, msg.sender, secret);
    }
    
    /*───────────────────────────  BACKEND INTEGRATION  ───────────────────────*/
    
    // Функция для бэкенда - подтверждение создания промокода
    function confirmPromocodeCreated(
        bytes32 requestId,
        uint256 contestId,
        uint256 prizeIndex,
        string calldata promocode
    ) external onlyOwner {
        if (processedEvents[requestId]) revert AlreadyProcessed();
        processedEvents[requestId] = true;
        
        // Сохраняем хеш промокода для последующей верификации
        Prize storage prize = contestPrizes[contestId].prizes[prizeIndex];
        prize.secretHash = keccak256(abi.encodePacked(promocode));
    }
    
    /*───────────────────────────  VIEW FUNCTIONS  ────────────────────────────*/
    
    function getContestPrizes(uint256 contestId) external view override returns (ContestPrizes memory) {
        return contestPrizes[contestId];
    }
    
    function getPrize(uint256 contestId, uint256 prizeIndex) external view returns (Prize memory) {
        if (prizeIndex >= contestPrizes[contestId].prizes.length) revert InvalidPrizeIndex();
        return contestPrizes[contestId].prizes[prizeIndex];
    }
    
    function getPrizesCount(uint256 contestId) external view returns (uint256) {
        return contestPrizes[contestId].prizes.length;
    }

    /// @notice Возвращает часть призов постранично
    function getPrizesPaged(
        uint256 contestId,
        uint256 start,
        uint256 count
    ) external view returns (Prize[] memory prizes) {
        ContestPrizes storage cp = contestPrizes[contestId];
        uint256 total = cp.prizes.length;
        if (start >= total) {
            return new Prize[](0);
        }
        uint256 end = start + count;
        if (end > total) end = total;

        prizes = new Prize[](end - start);
        for (uint256 i = start; i < end; i++) {
            prizes[i - start] = cp.prizes[i];
        }
    }
    
    function getMonetaryPrizesTotal(uint256 contestId) external view returns (uint256) {
        return contestPrizes[contestId].totalMonetaryValue;
    }
}