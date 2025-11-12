// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KCY1 Token - Защитен deflationary токен
 * @dev ERC20 с автоматично изгаряне, лимити и защити
 */
contract KCY1Token {
    string public constant name = "KCY1";
    string public constant symbol = "KCY1";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    address public immutable owner;
    uint256 public immutable tradingEnabledTime;
    
    // Такси в базисни точки (1 bp = 0.01%)
    uint256 public constant BURN_FEE = 300;  // 3% изгаряне
    uint256 public constant OWNER_FEE = 500; // 5% за собственик
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Лимити за транзакции
    uint256 public constant MAX_TRANSACTION = 1000 * 10**18; // 1000 токена
    uint256 public constant COOLDOWN_PERIOD = 2 hours;
    
    // Пауза
    uint256 public pausedUntil;
    bool public isPaused;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isExcludedFromFees;
    mapping(address => bool) public isExcludedFromLimits;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => bool) public isBlacklisted;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TokensBurned(uint256 amount);
    event Paused(uint256 until);
    event Blacklisted(address indexed account, bool status);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        if (isPaused) {
            require(block.timestamp >= pausedUntil, "Contract is paused");
            if (block.timestamp >= pausedUntil) {
                isPaused = false; // Автоматично отпаузва след 48ч
            }
        }
        _;
    }
    
    constructor() {
        owner = msg.sender;
        tradingEnabledTime = block.timestamp + 48 hours;
        totalSupply = 1_000_000 * 10**decimals;
        
        // Разпределение
        balanceOf[owner] = 600_000 * 10**decimals;
        balanceOf[address(this)] = 400_000 * 10**decimals;
        
        // Owner и contract без такси и лимити
        isExcludedFromFees[owner] = true;
        isExcludedFromFees[address(this)] = true;
        isExcludedFromLimits[owner] = true;
        isExcludedFromLimits[address(this)] = true;
        
        emit Transfer(address(0), owner, 600_000 * 10**decimals);
        emit Transfer(address(0), address(this), 400_000 * 10**decimals);
    }
    
    /**
     * @dev ПАУЗА - Блокира всички трансфери за 48 часа
     * ВАЖНО: След активиране НЕ МОЖЕ да се отмени предсрочно!
     */
    function pause() external onlyOwner {
        require(!isPaused, "Already paused");
        isPaused = true;
        pausedUntil = block.timestamp + 48 hours;
        emit Paused(pausedUntil);
    }
    
    /**
     * @dev Добавяне/премахване от blacklist
     */
    function setBlacklist(address account, bool status) external onlyOwner {
        require(account != owner, "Cannot blacklist owner");
        require(account != address(this), "Cannot blacklist contract");
        isBlacklisted[account] = status;
        emit Blacklisted(account, status);
    }
    
    /**
     * @dev Масово blacklist-ване (за бот атаки)
     */
    function setBlacklistBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != owner && accounts[i] != address(this)) {
                isBlacklisted[accounts[i]] = status;
                emit Blacklisted(accounts[i], status);
            }
        }
    }
    
    /**
     * @dev Стандартен ERC20 transfer
     */
    function transfer(address to, uint256 amount) public whenNotPaused returns (bool) {
        return _transfer(msg.sender, to, amount);
    }
    
    /**
     * @dev Стандартен ERC20 transferFrom
     */
    function transferFrom(address from, address to, uint256 amount) public whenNotPaused returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        return _transfer(from, to, amount);
    }
    
    /**
     * @dev Вътрешна логика за трансфер с всички проверки
     */
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(!isBlacklisted[from], "Sender is blacklisted");
        require(!isBlacklisted[to], "Recipient is blacklisted");
        
        // Проверка за trading lock (освен owner)
        if (from != owner && to != owner) {
            require(block.timestamp >= tradingEnabledTime, "Trading locked for 48h");
        }
        
        // ЛИМИТИ - Max transaction + Cooldown
        if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
            require(amount <= MAX_TRANSACTION, "Exceeds max transaction limit (1000 tokens)");
            
            // Cooldown проверка (2 часа между транзакции)
            if (lastTransactionTime[from] != 0) {
                require(
                    block.timestamp >= lastTransactionTime[from] + COOLDOWN_PERIOD,
                    "Must wait 2 hours between transactions"
                );
            }
            
            lastTransactionTime[from] = block.timestamp;
        }
        
        // Ако sender или receiver е без такси
        if (isExcludedFromFees[from] || isExcludedFromFees[to]) {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
            emit Transfer(from, to, amount);
            return true;
        }
        
        // Изчисляване на такси
        uint256 burnAmount = (amount * BURN_FEE) / FEE_DENOMINATOR;
        uint256 ownerAmount = (amount * OWNER_FEE) / FEE_DENOMINATOR;
        uint256 transferAmount = amount - burnAmount - ownerAmount;
        
        // Извършване на трансфера
        balanceOf[from] -= amount;
        balanceOf[to] += transferAmount;
        balanceOf[owner] += ownerAmount;
        
        // Изгаряне на токени
        totalSupply -= burnAmount;
        
        emit Transfer(from, to, transferAmount);
        emit Transfer(from, owner, ownerAmount);
        emit Transfer(from, address(0), burnAmount);
        emit TokensBurned(burnAmount);
        
        return true;
    }
    
    /**
     * @dev Стандартен ERC20 approve
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    /**
     * @dev Изтегляне на циркулационни токени
     */
    function withdrawCirculationTokens(uint256 amount) external onlyOwner {
        require(balanceOf[address(this)] >= amount, "Insufficient balance");
        balanceOf[address(this)] -= amount;
        balanceOf[owner] += amount;
        emit Transfer(address(this), owner, amount);
    }
    
    /**
     * @dev Ръчно изгаряне
     */
    function burn(uint256 amount) external onlyOwner {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
        emit TokensBurned(amount);
    }
    
    /**
     * @dev Добавяне/премахване от fee whitelist
     */
    function setFeeExclusion(address account, bool excluded) external onlyOwner {
        isExcludedFromFees[account] = excluded;
    }
    
    /**
     * @dev Добавяне/премахване от limits whitelist
     */
    function setLimitExclusion(address account, bool excluded) external onlyOwner {
        isExcludedFromLimits[account] = excluded;
    }
    
    /**
     * @dev Проверка дали търговията е активна
     */
    function isTradingEnabled() public view returns (bool) {
        return block.timestamp >= tradingEnabledTime;
    }
    
    /**
     * @dev Време до активиране на търговията
     */
    function timeUntilTradingEnabled() public view returns (uint256) {
        if (isTradingEnabled()) return 0;
        return tradingEnabledTime - block.timestamp;
    }
    
    /**
     * @dev Време до края на паузата
     */
    function timeUntilUnpaused() public view returns (uint256) {
        if (!isPaused) return 0;
        if (block.timestamp >= pausedUntil) return 0;
        return pausedUntil - block.timestamp;
    }
    
    /**
     * @dev Аварийно изтегляне на случайно изпратени токени
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot rescue own token");
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", owner, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Rescue failed");
    }
    
    /**
     * @dev Receive function - contract може да получава BNB
     */
    receive() external payable {}
    
    /**
     * @dev Изтегляне на BNB от contract
     */
    function withdrawBNB() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}