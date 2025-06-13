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
    
    /*───────────────────────────  MODIFIERS  ─────────────────────────────────*/
    
    modifier onlyAuthorized() {
        require(authorizedCreators[msg.sender] || msg.sender == owner(), "Not authorized"); // ✅ ИСПРАВЛЕНО: добавили ()
        _;
    }
    
    modifier onlyContestCreator(uint256 contestId) {
        require(contestCreators[contestId] == msg.sender, "Not contest creator");
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
        require(contestCreators[contestId] == address(0), "Contest already exists");
        
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
        require(prizeIndex < contestPrizes[contestId].prizes.length, "Invalid prize index");
        
        Prize storage prize = contestPrizes[contestId].prizes[prizeIndex];
        require(!prize.claimed, "Prize already claimed");
        require(block.timestamp <= prize.expirationDate || prize.expirationDate == 0, "Prize expired");
        
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
        require(prize.claimed, "Prize not claimed yet");
        require(prize.secretHash != bytes32(0), "No secret for this prize");
        require(keccak256(abi.encodePacked(secret)) == prize.secretHash, "Invalid secret");
        
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
        require(!processedEvents[requestId], "Already processed");
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
        require(prizeIndex < contestPrizes[contestId].prizes.length, "Invalid prize index");
        return contestPrizes[contestId].prizes[prizeIndex];
    }
    
    function getPrizesCount(uint256 contestId) external view returns (uint256) {
        return contestPrizes[contestId].prizes.length;
    }
    
    function getMonetaryPrizesTotal(uint256 contestId) external view returns (uint256) {
        return contestPrizes[contestId].totalMonetaryValue;
    }
}