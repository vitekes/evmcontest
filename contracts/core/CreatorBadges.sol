// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract CreatorBadges is ERC721, ReentrancyGuard, Ownable {
    using Strings for uint256;
    
    /*───────────────────────────  STORAGE  ───────────────────────────────────*/
    
    address public contestFactory;
    uint256 private _nextTokenId = 1;
    
    // Статистика создателей
    mapping(address => CreatorStats) public creatorStats;
    
    // Полученные бейджи для каждого создателя
    mapping(address => mapping(uint256 => bool)) public hasBadge;
    
    // Метаданные бейджей
    mapping(uint256 => BadgeInfo) public badgeInfo;
    
    /*───────────────────────────  STRUCTS & CONSTANTS  ──────────────────────*/
    
    struct CreatorStats {
        uint256 totalContests;
        uint256 totalPrizeVolume;
        uint256 firstContestTimestamp;
        uint256 lastContestTimestamp;
        bool isVerified;
    }
    
    struct BadgeInfo {
        bytes32 description;
        bytes32 imageUri;
        uint256 minContests;
        uint256 minVolume;
        bool isActive;
    }

    // Badge names stored as bytes32 constants to avoid storage usage
    bytes32 private constant NAME_FIRST_CONTEST = "First Contest Creator";
    bytes32 private constant NAME_CONTEST_VETERAN = "Contest Veteran";
    bytes32 private constant NAME_CONTEST_MASTER = "Contest Master";
    bytes32 private constant NAME_BIG_SPENDER = "Big Spender";
    bytes32 private constant NAME_WHALE = "Contest Whale";
    bytes32 private constant NAME_VERIFIED_CREATOR = "Verified Creator";
    bytes32 private constant NAME_EARLY_ADOPTER = "Early Adopter";
    
    // Типы бейджей
    uint256 public constant FIRST_CONTEST = 1;
    uint256 public constant CONTEST_VETERAN = 2;
    uint256 public constant CONTEST_MASTER = 3;
    uint256 public constant BIG_SPENDER = 4;
    uint256 public constant WHALE = 5;
    uint256 public constant VERIFIED_CREATOR = 6;
    uint256 public constant EARLY_ADOPTER = 7;
    
    /*───────────────────────────  EVENTS  ────────────────────────────────────*/
    
    event BadgeEarned(
        address indexed creator,
        uint256 indexed badgeId,
        uint256 tokenId,
        string badgeName
    );
    
    event CreatorStatsUpdated(
        address indexed creator,
        uint256 totalContests,
        uint256 totalVolume
    );
    
    /*───────────────────────────  CONSTRUCTOR  ───────────────────────────────*/
    
    constructor() ERC721("Contest Creator Badges", "CCB") Ownable(msg.sender) {
        _initializeBadges();
    }
    
    function setContestFactory(address _contestFactory) external onlyOwner {
        require(_contestFactory != address(0), "Invalid factory address");
        require(contestFactory == address(0), "Factory already set");
        contestFactory = _contestFactory;
    }
    
    /*───────────────────────────  MAIN FUNCTIONS  ────────────────────────────*/
    
    function recordContest(address creator, uint256 prizeAmount) external {
        require(msg.sender == contestFactory, "Only contest factory");
        require(creator != address(0), "Invalid creator");
        
        CreatorStats storage stats = creatorStats[creator];
        
        // Обновляем статистику
        stats.totalContests++;
        stats.totalPrizeVolume += prizeAmount;
        stats.lastContestTimestamp = block.timestamp;
        
        if (stats.firstContestTimestamp == 0) {
            stats.firstContestTimestamp = block.timestamp;
        }
        
        // Проверяем и выдаем новые бейджи
        _checkAndAwardBadges(creator);
        
        emit CreatorStatsUpdated(creator, stats.totalContests, stats.totalPrizeVolume);
    }
    
    function verifyCreator(address creator) external onlyOwner {
        require(creator != address(0), "Invalid creator");
        
        creatorStats[creator].isVerified = true;
        _awardBadge(creator, VERIFIED_CREATOR);
    }
    
    /*───────────────────────────  INTERNAL FUNCTIONS  ───────────────────────*/
    
    function _checkAndAwardBadges(address creator) internal {
        CreatorStats memory stats = creatorStats[creator];
        
        // Первый конкурс
        if (stats.totalContests == 1 && !hasBadge[creator][FIRST_CONTEST]) {
            _awardBadge(creator, FIRST_CONTEST);
        }
        
        // Ветеран (10+ конкурсов)
        if (stats.totalContests >= 10 && !hasBadge[creator][CONTEST_VETERAN]) {
            _awardBadge(creator, CONTEST_VETERAN);
        }
        
        // Мастер (50+ конкурсов)
        if (stats.totalContests >= 50 && !hasBadge[creator][CONTEST_MASTER]) {
            _awardBadge(creator, CONTEST_MASTER);
        }
        
        // Крупный спонсор ($10k+ объем)
        if (stats.totalPrizeVolume >= 10_000 ether && !hasBadge[creator][BIG_SPENDER]) {
            _awardBadge(creator, BIG_SPENDER);
        }
        
        // Кит ($100k+ объем)
        if (stats.totalPrizeVolume >= 100_000 ether && !hasBadge[creator][WHALE]) {
            _awardBadge(creator, WHALE);
        }
        
        // Ранний последователь (первые 100 создателей)
        if (_nextTokenId <= 100 && stats.totalContests == 1 && !hasBadge[creator][EARLY_ADOPTER]) {
            _awardBadge(creator, EARLY_ADOPTER);
        }
    }
    
    function _awardBadge(address creator, uint256 badgeId) internal nonReentrant {
        require(!hasBadge[creator][badgeId], "Badge already earned");
        require(badgeInfo[badgeId].isActive, "Badge not active");
        
        hasBadge[creator][badgeId] = true;
        
        // Минтим NFT
        uint256 tokenId = _nextTokenId++;
        _mint(creator, tokenId);
        
        emit BadgeEarned(creator, badgeId, tokenId, _badgeName(badgeId));
    }

    function _initializeBadges() internal {
        badgeInfo[FIRST_CONTEST] = BadgeInfo({
            description: hex"4372656174656420796f757220666972737420636f6e74657374212057656c63",
            imageUri: hex"697066733a2f2f516d4669727374436f6e746573744261646765000000000000",
            minContests: 1,
            minVolume: 0,
            isActive: true
        });
        
        badgeInfo[CONTEST_VETERAN] = BadgeInfo({
            description: hex"437265617465642031302b20636f6e74657374732e20596f7527726520676574",
            imageUri: hex"697066733a2f2f516d5665746572616e42616467650000000000000000000000",
            minContests: 10,
            minVolume: 0,
            isActive: true
        });
        
        badgeInfo[CONTEST_MASTER] = BadgeInfo({
            description: hex"437265617465642035302b20636f6e74657374732e205472756520636f6e7465",
            imageUri: hex"697066733a2f2f516d4d61737465724261646765000000000000000000000000",
            minContests: 50,
            minVolume: 0,
            isActive: true
        });
        
        badgeInfo[BIG_SPENDER] = BadgeInfo({
            description: hex"4469737472696275746564202431302c3030302b20696e20746f74616c207072",
            imageUri: hex"697066733a2f2f516d4269675370656e64657242616467650000000000000000",
            minContests: 0,
            minVolume: 10_000 ether,
            isActive: true
        });
        
        badgeInfo[WHALE] = BadgeInfo({
            description: hex"446973747269627574656420243130302c3030302b20696e20746f74616c2070",
            imageUri: hex"697066733a2f2f516d5768616c65426164676500000000000000000000000000",
            minContests: 0,
            minVolume: 100_000 ether,
            isActive: true
        });
        
        badgeInfo[VERIFIED_CREATOR] = BadgeInfo({
            description: hex"56657269666965642062792074686520706c6174666f726d2e20547275737465",
            imageUri: hex"697066733a2f2f516d5665726966696564426164676500000000000000000000",
            minContests: 0,
            minVolume: 0,
            isActive: true
        });
        
        badgeInfo[EARLY_ADOPTER] = BadgeInfo({
            description: hex"4f6e65206f66207468652066697273742031303020636f6e7465737420637265",
            imageUri: hex"697066733a2f2f516d4561726c7941646f707465724261646765000000000000",
            minContests: 1,
            minVolume: 0,
            isActive: true
        });
    }
    
    /*───────────────────────────  VIEW FUNCTIONS  ────────────────────────────*/
    
    function getCreatorStats(address creator) external view returns (
        CreatorStats memory stats,
        uint256[] memory earnedBadges,
        string[] memory badgeNames
    ) {
        stats = creatorStats[creator];
        
        // Собираем все полученные бейджи
        uint256[] memory tempBadges = new uint256[](7);
        string[] memory tempNames = new string[](7);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= 7; i++) {
            if (hasBadge[creator][i]) {
                tempBadges[count] = i;
                tempNames[count] = _badgeName(i);
                count++;
            }
        }
        
        // Создаем массивы нужного размера
        earnedBadges = new uint256[](count);
        badgeNames = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            earnedBadges[i] = tempBadges[i];
            badgeNames[i] = tempNames[i];
        }
    }

    function _badgeName(uint256 badgeId) internal pure returns (string memory) {
        if (badgeId == FIRST_CONTEST) return _bytes32ToString(NAME_FIRST_CONTEST);
        if (badgeId == CONTEST_VETERAN) return _bytes32ToString(NAME_CONTEST_VETERAN);
        if (badgeId == CONTEST_MASTER) return _bytes32ToString(NAME_CONTEST_MASTER);
        if (badgeId == BIG_SPENDER) return _bytes32ToString(NAME_BIG_SPENDER);
        if (badgeId == WHALE) return _bytes32ToString(NAME_WHALE);
        if (badgeId == VERIFIED_CREATOR) return _bytes32ToString(NAME_VERIFIED_CREATOR);
        if (badgeId == EARLY_ADOPTER) return _bytes32ToString(NAME_EARLY_ADOPTER);
        return "";
    }

    function _bytes32ToString(bytes32 data) internal pure returns (string memory) {
        uint256 len = 0;
        while (len < 32 && data[len] != 0) {
            len++;
        }
        bytes memory buffer = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            buffer[i] = data[i];
        }
        return string(buffer);
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            "eyJuYW1lIjoiQ29udGVzdCBDcmVhdG9yIEJhZGdlIiwiZGVzY3JpcHRpb24iOiJBY2hpZXZlbWVudCBiYWRnZSBmb3IgY29udGVzdCBjcmVhdG9ycyIsImltYWdlIjoiaXBmczovL1FtWW91ckJhZGdlSW1hZ2VIYXNoIn0="
        ));
    }
}