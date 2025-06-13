// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NetworkFeeManager is ReentrancyGuard {
    address public owner;
    address public treasury;
    address public contestFactory;
    bool public isFactorySet; // флаг установки фабрики
    
    // Комиссии по chainId (в базисных пунктах: 500 = 5%)
    mapping(uint256 => uint256) public networkFees;
    mapping(uint256 => string) public networkNames;
    
    // Система банов создателей
    mapping(address => bool) public bannedCreators;
    mapping(address => uint256) public banTimestamp;
    
    // Отслеживание комиссий по конкурсам
    mapping(uint256 => ContestFee) public contestFees;
    
    // Неиспользованные комиссии (доступны для вывода)
    mapping(address => uint256) public availableETHFees;
    mapping(address => mapping(address => uint256)) public availableTokenFees;
    
    struct ContestFee {
        address creator;
        address token;
        uint256 feeAmount;
        uint256 createdAt;
        bool isRefunded;
        bool isWithdrawn;
    }
    
    /*───────────────────────────  EVENTS  ────────────────────────────────────*/
    
    event NetworkFeeUpdated(uint256 indexed chainId, uint256 oldFee, uint256 newFee);
    event CreatorBanned(address indexed creator, string reason);
    event CreatorUnbanned(address indexed creator);
    event FeeCollected(uint256 indexed contestId, address indexed creator, address token, uint256 amount);
    event FeeWithdrawn(address indexed token, uint256 amount, address indexed to);
    event FeeRefunded(uint256 indexed contestId, address indexed creator, address token, uint256 amount);
    event ContestFactorySet(address indexed oldFactory, address indexed newFactory);
    
    /*───────────────────────────  MODIFIERS  ─────────────────────────────────*/
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyFactory() {
        require(isFactorySet, "Factory not set");
        require(msg.sender == contestFactory, "Only contest factory");
        _;
    }
    
    /*───────────────────────────  CONSTRUCTOR  ───────────────────────────────*/
    
    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        owner = msg.sender;
        treasury = _treasury;
        _initializeNetworkFees();
    }
    
    /*───────────────────────────  ADMIN FUNCTIONS  ───────────────────────────*/
    
    function setContestFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory address");
        require(!isFactorySet, "Factory already set");
        
        address oldFactory = contestFactory;
        contestFactory = _factory;
        isFactorySet = true;
        
        emit ContestFactorySet(oldFactory, _factory);
    }
    
    function setNetworkFee(uint256 chainId, uint256 feeInBasisPoints) external onlyOwner {
        require(feeInBasisPoints <= 2000, "Fee too high"); // Максимум 20%
        
        uint256 oldFee = networkFees[chainId];
        networkFees[chainId] = feeInBasisPoints;
        
        emit NetworkFeeUpdated(chainId, oldFee, feeInBasisPoints);
    }
    
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }
    
    /*───────────────────────────  BAN SYSTEM  ────────────────────────────────*/
    
    function banCreator(address creator, string calldata reason) external onlyOwner {
        require(creator != address(0), "Invalid creator");
        require(!bannedCreators[creator], "Already banned");
        
        bannedCreators[creator] = true;
        banTimestamp[creator] = block.timestamp;
        
        emit CreatorBanned(creator, reason);
    }
    
    function unbanCreator(address creator) external onlyOwner {
        require(bannedCreators[creator], "Not banned");
        
        bannedCreators[creator] = false;
        
        emit CreatorUnbanned(creator);
    }
    
    /*───────────────────────────  FEE COLLECTION  ────────────────────────────*/
    
    function collectFee(
        uint256 contestId,
        address creator,
        address token,
        uint256 prizeAmount
    ) external payable onlyFactory nonReentrant returns (uint256 feeAmount) {
        
        feeAmount = calculateFee(block.chainid, prizeAmount);
        require(feeAmount > 0, "No fee required");
        
        // Защита от дублирования комиссий
        require(contestFees[contestId].creator == address(0), "Fee already collected for this contest");
        
        // Сохраняем информацию о комиссии
        contestFees[contestId] = ContestFee({
            creator: creator,
            token: token,
            feeAmount: feeAmount,
            createdAt: block.timestamp,
            isRefunded: false,
            isWithdrawn: false
        });
        
        if (token == address(0)) {
            // ETH комиссия
            require(msg.value >= feeAmount, "Insufficient ETH fee");
            availableETHFees[address(0)] += feeAmount;
            
            // ✅ ИСПРАВЛЕНО: Безопасный возврат излишка с call()
            if (msg.value > feeAmount) {
                uint256 excess = msg.value - feeAmount;
                (bool success, ) = payable(msg.sender).call{value: excess}("");
                require(success, "Excess refund failed");
            }
        } else {
            // ERC20 комиссия - токены уже переведены в этот контракт
            require(msg.value == 0, "No ETH needed for token fee");
            availableTokenFees[address(0)][token] += feeAmount;
        }
        
        emit FeeCollected(contestId, creator, token, feeAmount);
    }
    
    /*───────────────────────────  FEE WITHDRAWAL  ────────────────────────────*/
    
    function withdrawFees(address token, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Invalid amount");
        
        if (token == address(0)) {
            require(availableETHFees[address(0)] >= amount, "Insufficient ETH fees");
            require(address(this).balance >= amount, "Insufficient contract balance");
            
            availableETHFees[address(0)] -= amount;
            
            (bool success, ) = payable(treasury).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            require(availableTokenFees[address(0)][token] >= amount, "Insufficient token fees");
            
            IERC20 tokenContract = IERC20(token);
            require(tokenContract.balanceOf(address(this)) >= amount, "Insufficient contract balance");
            
            availableTokenFees[address(0)][token] -= amount;
            tokenContract.transfer(treasury, amount);
        }
        
        emit FeeWithdrawn(token, amount, treasury);
    }
    
    /*───────────────────────────  BANNED CREATOR LOGIC  ──────────────────────*/
    
    function withdrawBannedCreatorFees(uint256 contestId) external onlyOwner nonReentrant {
        ContestFee storage fee = contestFees[contestId];
        require(fee.creator != address(0), "Contest not found");
        require(bannedCreators[fee.creator], "Creator not banned");
        require(!fee.isWithdrawn, "Already withdrawn");
        require(!fee.isRefunded, "Already refunded");
        
        fee.isWithdrawn = true;
        
        if (fee.token == address(0)) {
            require(address(this).balance >= fee.feeAmount, "Insufficient balance");
            (bool success, ) = payable(treasury).call{value: fee.feeAmount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20 tokenContract = IERC20(fee.token);
            tokenContract.transfer(treasury, fee.feeAmount);
        }
        
        emit FeeWithdrawn(fee.token, fee.feeAmount, treasury);
    }
    
    function refundUnusedFee(uint256 contestId) external onlyOwner nonReentrant {
        ContestFee storage fee = contestFees[contestId];
        require(fee.creator != address(0), "Contest not found");
        require(!bannedCreators[fee.creator], "Creator is banned");
        require(!fee.isWithdrawn, "Already withdrawn");
        require(!fee.isRefunded, "Already refunded");
        
        require(
            block.timestamp > fee.createdAt + 90 days, 
            "Too early for refund"
        );
        
        fee.isRefunded = true;
        
        if (fee.token == address(0)) {
            require(address(this).balance >= fee.feeAmount, "Insufficient balance");
            (bool success, ) = payable(fee.creator).call{value: fee.feeAmount}("");
            require(success, "ETH refund failed");
        } else {
            IERC20 tokenContract = IERC20(fee.token);
            tokenContract.transfer(fee.creator, fee.feeAmount);
        }
        
        emit FeeRefunded(contestId, fee.creator, fee.token, fee.feeAmount);
    }
    
    /*───────────────────────────  VIEW FUNCTIONS  ────────────────────────────*/
    
    function calculateFee(uint256 chainId, uint256 prizeAmount) public view returns (uint256) {
        uint256 feePercentage = networkFees[chainId];
        if (feePercentage == 0) return 0;
        
        // ✅ ИСПРАВЛЕНО: Безопасная защита от overflow
        require(prizeAmount <= type(uint256).max / feePercentage, "Prize amount too large");
        return (prizeAmount * feePercentage) / 10_000;
    }
    
    function getNetworkInfo(uint256 chainId) external view returns (
        uint256 feePercentage,
        string memory networkName,
        bool isSupported
    ) {
        return (
            networkFees[chainId],
            networkNames[chainId],
            networkFees[chainId] > 0
        );
    }
    
    // ✅ ИСПРАВЛЕНО: Завершена функция isCreatorBanned
    function isCreatorBanned(address creator) external view returns (bool) {
        return bannedCreators[creator];
    }
    
    function getAvailableETHFees() external view returns (uint256) {
        return availableETHFees[address(0)];
    }
    
    function getAvailableTokenFees(address token) external view returns (uint256) {
        return availableTokenFees[address(0)][token];
    }
    
    /*───────────────────────────  INTERNAL FUNCTIONS  ────────────────────────*/
    
    function _initializeNetworkFees() internal {
        // Ethereum Mainnet
        networkFees[1] = 300; // 3%
        networkNames[1] = "Ethereum Mainnet";
        
        // Polygon
        networkFees[137] = 250; // 2.5%
        networkNames[137] = "Polygon";
        
        // BSC
        networkFees[56] = 250; // 2.5%
        networkNames[56] = "Binance Smart Chain";
        
        // Arbitrum
        networkFees[42161] = 200; // 2%
        networkNames[42161] = "Arbitrum One";
        
        // Optimism
        networkFees[10] = 200; // 2%
        networkNames[10] = "Optimism";
        
        // Sepolia (тестовая)
        networkFees[11155111] = 100; // 1%
        networkNames[11155111] = "Sepolia Testnet";
    }

    function getSupportedNetworks() external view returns (
        uint256[] memory chainIds,
        string[] memory names,
        uint256[] memory fees
    ) {
        // Возвращаем только основные сети для демонстрации
        chainIds = new uint256[](6);
        names = new string[](6);
        fees = new uint256[](6);
        
        chainIds[0] = 1; names[0] = networkNames[1]; fees[0] = networkFees[1];
        chainIds[1] = 137; names[1] = networkNames[137]; fees[1] = networkFees[137];
        chainIds[2] = 56; names[2] = networkNames[56]; fees[2] = networkFees[56];
        chainIds[3] = 42161; names[3] = networkNames[42161]; fees[3] = networkFees[42161];
        chainIds[4] = 10; names[4] = networkNames[10]; fees[4] = networkFees[10];
        chainIds[5] = 11155111; names[5] = networkNames[11155111]; fees[5] = networkFees[11155111];
    }
}