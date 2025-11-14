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
    
    // Лимити
    uint256 public constant MAX_TRANSACTION = 1000 * 10**18; // 1000 токена на транзакция
    uint256 public constant MAX_WALLET = 20000 * 10**18;     // 20 000 токена в портфейл
    uint256 public constant COOLDOWN_PERIOD = 2 hours;
    
    // Пауза
    uint256 public pausedUntil;
    bool public isPaused;
    
    // ПРЕФЕРЕНЦИАЛНИ АДРЕСИ - Могат да се променят ДО LOCK
    address public exemptAddress1;
    address public exemptAddress2;
    address public exemptAddress3;
    address public exemptAddress4;
    address public exemptAddress5;
    
    // PancakeSwap адреси (може да се променят ДО LOCK)
    address public pancakeswapRouter;
    address public pancakeswapFactory;
    
    // 🔒 LOCK механизъм - след активиране НЕ МОЖЕ да се променят exempt адресите
    bool public exemptAddressesLocked;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => bool) public isBlacklisted;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TokensBurned(uint256 amount);
    event Paused(uint256 until);
    event Blacklisted(address indexed account, bool status);
    event ExemptAddressesUpdated(address[5] addresses, address router, address factory);
    event ExemptAddressesLocked();
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        if (isPaused) {
            require(block.timestamp >= pausedUntil, "Contract is paused");
            if (block.timestamp >= pausedUntil) {
                isPaused = false;
            }
        }
        _;
    }
    
    modifier whenNotLocked() {
        require(!exemptAddressesLocked, "Exempt addresses are locked forever");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        tradingEnabledTime = block.timestamp + 48 hours;
        totalSupply = 1_000_000 * 10**decimals;
        
        // Разпределение
        balanceOf[owner] = 600_000 * 10**decimals;
        balanceOf[address(this)] = 400_000 * 10**decimals;
        
        // Инициализация на PancakeSwap адреси (BSC Mainnet)
        pancakeswapRouter = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
        pancakeswapFactory = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
        
        // Exempt адресите са празни - ще ги зададеш след deploy
        exemptAddress1 = address(0);
        exemptAddress2 = address(0);
        exemptAddress3 = address(0);
        exemptAddress4 = address(0);
        exemptAddress5 = address(0);
        
        emit Transfer(address(0), owner, 600_000 * 10**decimals);
        emit Transfer(address(0), address(this), 400_000 * 10**decimals);
    }
    
    /**
     * @dev 🔓 ЗАДАВАНЕ НА EXEMPT АДРЕСИ - работи само ПРЕДИ lock
     * 
     * Параметри:
     * _addresses[5] - масив с 5 адреса (ако нямаш толкова, сложи address(0))
     * _router - PancakeSwap Router адрес
     * _factory - PancakeSwap Factory адрес
     * 
     * Пример за извикване:
     * setExemptAddresses(
     *   [0xАдрес1, 0xАдрес2, 0xАдрес3, address(0), address(0)],
     *   0x10ED43C718714eb63d5aA57B78B54704E256024E,  // Router
     *   0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73   // Factory
     * )
     */
    function setExemptAddresses(
        address[5] calldata _addresses,
        address _router,
        address _factory
    ) external onlyOwner whenNotLocked {
        // Задаване на преференциалните адреси
        exemptAddress1 = _addresses[0];
        exemptAddress2 = _addresses[1];
        exemptAddress3 = _addresses[2];
        exemptAddress4 = _addresses[3];
        exemptAddress5 = _addresses[4];
        
        // Задаване на DEX адреси
        pancakeswapRouter = _router;
        pancakeswapFactory = _factory;
        
        emit ExemptAddressesUpdated(_addresses, _router, _factory);
    }
    
    /**
     * @dev 🔒 LOCK НА EXEMPT АДРЕСИТЕ - НЕОБРАТИМО!
     * 
     * ВНИМАНИЕ: След извикване на тази функция:
     * - НЕ МОЖЕ да променяш exempt адресите НИКОГА ПОВЕЧЕ
     * - НЕ МОЖЕ да променяш PancakeSwap адресите
     * - Това е ПЕРМАНЕНТНО и НЕОБРАТИМО
     * 
     * Извикай само когато си 100% сигурен в адресите!
     */
    function lockExemptAddresses() external onlyOwner whenNotLocked {
        exemptAddressesLocked = true;
        emit ExemptAddressesLocked();
    }
    
    /**
     * @dev Проверка дали адресът е exempt (БЕЗ такси и лимити)
     */
    function isExemptAddress(address account) public view returns (bool) {
        return account == owner 
            || account == address(this)
            || account == pancakeswapRouter
            || account == pancakeswapFactory
            || account == exemptAddress1
            || account == exemptAddress2
            || account == exemptAddress3
            || account == exemptAddress4
            || account == exemptAddress5;
    }
    
    /**
     * @dev ПАУЗА - Блокира всички трансфери за 48 часа
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
        
        bool fromExempt = isExemptAddress(from);
        bool toExempt = isExemptAddress(to);
        
        // Проверка за trading lock (освен exempt адреси)
        if (!fromExempt && !toExempt) {
            require(block.timestamp >= tradingEnabledTime, "Trading locked for 48h");
        }
        
        // ЛИМИТИ - само за не-exempt адреси
        if (!fromExempt && !toExempt) {
            require(amount <= MAX_TRANSACTION, "Exceeds max transaction (1000 tokens)");
            
            require(
                balanceOf[to] + amount <= MAX_WALLET,
                "Recipient would exceed max wallet (20,000 tokens)"
            );
            
            if (lastTransactionTime[from] != 0) {
                require(
                    block.timestamp >= lastTransactionTime[from] + COOLDOWN_PERIOD,
                    "Must wait 2 hours between transactions"
                );
            }
            
            lastTransactionTime[from] = block.timestamp;
        }
        
        // Exempt адреси = БЕЗ такси
        if (fromExempt || toExempt) {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
            emit Transfer(from, to, amount);
            return true;
        }
        
        // Обикновени адреси = С такси
        uint256 burnAmount = (amount * BURN_FEE) / FEE_DENOMINATOR;
        uint256 ownerAmount = (amount * OWNER_FEE) / FEE_DENOMINATOR;
        uint256 transferAmount = amount - burnAmount - ownerAmount;
        
        balanceOf[from] -= amount;
        balanceOf[to] += transferAmount;
        balanceOf[owner] += ownerAmount;
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
     * @dev Получаване на всички exempt адреси (за проверка преди lock)
     */
    function getExemptAddresses() external view returns (
        address[5] memory addresses,
        address router,
        address factory,
        bool locked
    ) {
        addresses[0] = exemptAddress1;
        addresses[1] = exemptAddress2;
        addresses[2] = exemptAddress3;
        addresses[3] = exemptAddress4;
        addresses[4] = exemptAddress5;
        router = pancakeswapRouter;
        factory = pancakeswapFactory;
        locked = exemptAddressesLocked;
    }
    
    /**
     * @dev RESCUE - Изтегляне на чужди токени
     */
    function rescueTokens(address tokenAddress, uint256 amount) external onlyOwner {
        require(tokenAddress != address(this), "Cannot rescue own KCY1 tokens");
        (bool success, bytes memory data) = tokenAddress.call(
            abi.encodeWithSignature("transfer(address,uint256)", owner, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Rescue failed");
    }
    
    receive() external payable {}
    
    function withdrawBNB() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No BNB to withdraw");
        payable(owner).transfer(balance);
    }
}