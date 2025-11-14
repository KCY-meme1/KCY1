// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 */
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

/**
 * @title KCY1 Token - Защитен deflationary токен
 * @dev ERC20 с автоматично изгаряне, лимити и защити
 * @author FIXED VERSION - Всички критични проблеми са коригирани
 */
contract KCY1Token is IERC20, ReentrancyGuard {
    string public constant name = "KCY1";
    string public constant symbol = "KCY1";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    
    address public immutable owner;
    uint256 public immutable tradingEnabledTime;
    
    // Такси в базисни точки (1 bp = 0.01%)
    uint256 public constant BURN_FEE = 300;  // 3% изгаряне
    uint256 public constant OWNER_FEE = 500; // 5% за собственик
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Лимити
    uint256 public constant MAX_TRANSACTION = 1000 * 10**18; // 1000 токена на транзакция
    uint256 public constant MAX_WALLET = 20000 * 10**18;     // 20,000 токена в портфейл
    uint256 public constant COOLDOWN_PERIOD = 2 hours;
    uint256 public constant PAUSE_DURATION = 48 hours;
    
    // Пауза
    uint256 public pausedUntil;
    
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
    
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => bool) public isBlacklisted;
    
    event TokensBurned(uint256 amount);
    event Paused(uint256 until);
    event Blacklisted(address indexed account, bool status);
    event ExemptAddressesUpdated(address[5] addresses, address router, address factory);
    event ExemptAddressesLocked();
    event EmergencyTokensRescued(address indexed token, uint256 amount);
    event BNBWithdrawn(uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!isPaused(), "Contract is paused");
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
        // Тези адреси могат да бъдат променени след deploy чрез setExemptAddresses
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
        require(_router != address(0), "Invalid router address");
        require(_factory != address(0), "Invalid factory address");
        
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
        require(pancakeswapRouter != address(0), "Router not set");
        require(pancakeswapFactory != address(0), "Factory not set");
        
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
     * @dev Проверка дали контрактът е в пауза
     */
    function isPaused() public view returns (bool) {
        return block.timestamp < pausedUntil;
    }
    
    /**
     * @dev ПАУЗА - Блокира всички трансфери за 48 часа
     */
    function pause() external onlyOwner {
        require(pausedUntil <= block.timestamp, "Already paused");
        pausedUntil = block.timestamp + PAUSE_DURATION;
        emit Paused(pausedUntil);
    }
    
    /**
     * @dev Добавяне/премахване от blacklist
     */
    function setBlacklist(address account, bool status) external onlyOwner {
        require(account != owner, "Cannot blacklist owner");
        require(account != address(this), "Cannot blacklist contract");
        require(account != address(0), "Cannot blacklist zero address");
        
        isBlacklisted[account] = status;
        emit Blacklisted(account, status);
    }
    
    /**
     * @dev Масово blacklist-ване (за бот атаки)
     */
    function setBlacklistBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] != owner && 
                accounts[i] != address(this) && 
                accounts[i] != address(0)) {
                isBlacklisted[accounts[i]] = status;
                emit Blacklisted(accounts[i], status);
            }
        }
    }
    
    /**
     * @dev Стандартен ERC20 transfer
     */
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return _transfer(msg.sender, to, amount);
    }
    
    /**
     * @dev Стандартен ERC20 transferFrom
     */
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        
        // Намаляване на allowance
        unchecked {
            allowance[from][msg.sender] = currentAllowance - amount;
        }
        
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
        
        // Кеширане на exempt статус за gas оптимизация
        bool fromExempt = isExemptAddress(from);
        bool toExempt = isExemptAddress(to);
        
        // Проверка за trading lock (освен exempt адреси)
        if (!fromExempt && !toExempt) {
            require(block.timestamp >= tradingEnabledTime, "Trading locked for 48h");
        }
        
        // ЛИМИТИ - само за не-exempt адреси
        if (!fromExempt && !toExempt) {
            // Проверка на max transaction
            require(amount <= MAX_TRANSACTION, "Exceeds max transaction (1000 tokens)");
            
            // Проверка на max wallet
            uint256 recipientBalance = balanceOf[to];
            require(
                recipientBalance + amount <= MAX_WALLET,
                "Recipient would exceed max wallet (20,000 tokens)"
            );
            
            // Cooldown проверка
            uint256 lastTx = lastTransactionTime[from];
            if (lastTx != 0) {
                require(
                    block.timestamp >= lastTx + COOLDOWN_PERIOD,
                    "Must wait 2 hours between transactions"
                );
            }
        }
        
        // Изпълнение на трансфера
        
        // Exempt адреси = БЕЗ такси
        if (fromExempt || toExempt) {
            unchecked {
                balanceOf[from] -= amount;
                balanceOf[to] += amount;
            }
            emit Transfer(from, to, amount);
        } else {
            // Обикновени адреси = С такси
            uint256 burnAmount = (amount * BURN_FEE) / FEE_DENOMINATOR;
            uint256 ownerAmount = (amount * OWNER_FEE) / FEE_DENOMINATOR;
            uint256 transferAmount = amount - burnAmount - ownerAmount;
            
            unchecked {
                balanceOf[from] -= amount;
                balanceOf[to] += transferAmount;
                balanceOf[owner] += ownerAmount;
                totalSupply -= burnAmount;
            }
            
            emit Transfer(from, to, transferAmount);
            emit Transfer(from, owner, ownerAmount);
            emit Transfer(from, address(0), burnAmount);
            emit TokensBurned(burnAmount);
            
            // ВАЖНО: Обновяване на cooldown САМО след успешен трансфер
            lastTransactionTime[from] = block.timestamp;
        }
        
        return true;
    }
    
    /**
     * @dev Стандартен ERC20 approve
     */
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    /**
     * @dev Увеличаване на allowance (по-безопасно от approve)
     */
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, allowance[msg.sender][spender] + addedValue);
        return true;
    }
    
    /**
     * @dev Намаляване на allowance (по-безопасно от approve)
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "Decreased allowance below zero");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }
        return true;
    }
    
    /**
     * @dev Вътрешна функция за approve
     */
    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");
        
        allowance[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }
    
    /**
     * @dev Изтегляне на циркулационни токени от контракта
     */
    function withdrawCirculationTokens(uint256 amount) external onlyOwner {
        require(balanceOf[address(this)] >= amount, "Insufficient contract balance");
        
        unchecked {
            balanceOf[address(this)] -= amount;
            balanceOf[owner] += amount;
        }
        
        emit Transfer(address(this), owner, amount);
    }
    
    /**
     * @dev Ръчно изгаряне на токени
     */
    function burn(uint256 amount) external onlyOwner {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        unchecked {
            balanceOf[msg.sender] -= amount;
            totalSupply -= amount;
        }
        
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
     * @dev Време до активиране на търговията (в секунди)
     */
    function timeUntilTradingEnabled() public view returns (uint256) {
        if (isTradingEnabled()) return 0;
        return tradingEnabledTime - block.timestamp;
    }
    
    /**
     * @dev Време до края на паузата (в секунди)
     */
    function timeUntilUnpaused() public view returns (uint256) {
        if (!isPaused()) return 0;
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
     * @dev RESCUE - Изтегляне на грешно изпратени токени (с ReentrancyGuard защита)
     */
    function rescueTokens(address tokenAddress, uint256 amount) external onlyOwner nonReentrant {
        require(tokenAddress != address(0), "Invalid token address");
        require(tokenAddress != address(this), "Cannot rescue own KCY1 tokens");
        
        // Използване на interface за по-безопасен transfer
        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(owner, amount), "Rescue transfer failed");
        
        emit EmergencyTokensRescued(tokenAddress, amount);
    }
    
    /**
     * @dev Приемане на BNB
     */
    receive() external payable {}
    
    /**
     * @dev Изтегляне на BNB от контракта
     */
    function withdrawBNB() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No BNB to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "BNB transfer failed");
        
        emit BNBWithdrawn(balance);
    }
}