// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KCY1 Token
 * @dev ERC20 токен с такси, изгаряне и период на блокиране на търговията
 */
contract KCY1Token {
    string public constant name = "KCY1";
    string public constant symbol = "KCY1";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    
    address public immutable owner;
    uint256 public immutable deploymentTime;
    uint256 public constant TRADE_LOCK_PERIOD = 48 hours;
    
    // Chainlink BNB/USD Price Feed за BSC Mainnet
    // За тестване може да се използва mock адрес
    address public constant BNB_USD_PRICE_FEED = 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TokensBurned(address indexed from, uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier tradingEnabled() {
        require(
            block.timestamp >= deploymentTime + TRADE_LOCK_PERIOD || 
            msg.sender == owner,
            "Trading locked for 48h"
        );
        _;
    }
    
    constructor() payable {
        require(msg.value >= 0.015 ether, "Need ~100 USD in BNB"); // Приблизително при BNB ~$650
        
        owner = msg.sender;
        deploymentTime = block.timestamp;
        totalSupply = 1_000_000 * 10**decimals;
        
        // Разпределение
        balanceOf[owner] = 600_000 * 10**decimals;
        balanceOf[address(this)] = 400_000 * 10**decimals; // За циркулация
        
        emit Transfer(address(0), owner, 600_000 * 10**decimals);
        emit Transfer(address(0), address(this), 400_000 * 10**decimals);
    }
    
    /**
     * @dev Изчислява таксата в BNB ($0.08 USD)
     */
    function getFeeInBNB() public view returns (uint256) {
        // Хардкоднат fee за простота - 0.08 USD
        // При BNB = $650: 0.08/650 ≈ 0.000123 BNB
        // За production: интегрирайте Chainlink Price Feed
        return 0.000123 ether; // ~$0.08 при BNB=$650
    }
    
    /**
     * @dev Прехвърляне на токени с такса
     */
    function transfer(address to, uint256 amount) public payable tradingEnabled returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        // Проверка и обработка на таксата
        if (msg.sender != owner) {
            uint256 fee = getFeeInBNB();
            require(msg.value >= fee, "Insufficient fee");
            
            // Разпределяне на таксата
            uint256 burnAmount = (fee * 3) / 8; // 0.03 USD
            uint256 ownerAmount = fee - burnAmount; // 0.05 USD
            
            // Изгаряне на съответния процент от токените
            uint256 tokenBurnAmount = (amount * 3) / 100; // 3% от токените
            
            // Прехвърляне на таксите
            payable(address(0)).transfer(burnAmount); // Симулация на изгаряне
            payable(owner).transfer(ownerAmount);
            
            // Изгаряне на токени
            if (tokenBurnAmount > 0) {
                totalSupply -= tokenBurnAmount;
                emit TokensBurned(msg.sender, tokenBurnAmount);
            }
            
            // Връщане на излишък
            if (msg.value > fee) {
                payable(msg.sender).transfer(msg.value - fee);
            }
            
            // Прехвърляне на нетната сума
            balanceOf[msg.sender] -= amount;
            balanceOf[to] += (amount - tokenBurnAmount);
            
            emit Transfer(msg.sender, to, amount - tokenBurnAmount);
        } else {
            // Собственикът трансферира без такса
            balanceOf[msg.sender] -= amount;
            balanceOf[to] += amount;
            emit Transfer(msg.sender, to, amount);
        }
        
        return true;
    }
    
    /**
     * @dev Одобрение за харчене
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    /**
     * @dev Прехвърляне от одобрен адрес
     */
    function transferFrom(address from, address to, uint256 amount) public payable tradingEnabled returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        // Обработка на таксата
        if (from != owner) {
            uint256 fee = getFeeInBNB();
            require(msg.value >= fee, "Insufficient fee");
            
            uint256 burnAmount = (fee * 3) / 8;
            uint256 ownerAmount = fee - burnAmount;
            uint256 tokenBurnAmount = (amount * 3) / 100;
            
            payable(address(0)).transfer(burnAmount);
            payable(owner).transfer(ownerAmount);
            
            if (tokenBurnAmount > 0) {
                totalSupply -= tokenBurnAmount;
                emit TokensBurned(from, tokenBurnAmount);
            }
            
            if (msg.value > fee) {
                payable(msg.sender).transfer(msg.value - fee);
            }
            
            balanceOf[from] -= amount;
            balanceOf[to] += (amount - tokenBurnAmount);
            allowance[from][msg.sender] -= amount;
            
            emit Transfer(from, to, amount - tokenBurnAmount);
        } else {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
            allowance[from][msg.sender] -= amount;
            emit Transfer(from, to, amount);
        }
        
        return true;
    }
    
    /**
     * @dev Изтегляне на циркулационните токени от собственика
     */
    function withdrawCirculationTokens(uint256 amount) public onlyOwner {
        require(balanceOf[address(this)] >= amount, "Insufficient contract balance");
        balanceOf[address(this)] -= amount;
        balanceOf[owner] += amount;
        emit Transfer(address(this), owner, amount);
    }
    
    /**
     * @dev Ръчно изгаряне на токени от собственика
     */
    function burn(uint256 amount) public onlyOwner {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit TokensBurned(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }
    
    /**
     * @dev Проверка дали търговията е активна
     */
    function isTradingEnabled() public view returns (bool) {
        return block.timestamp >= deploymentTime + TRADE_LOCK_PERIOD;
    }
    
    /**
     * @dev Оставащо време до активиране на търговията
     */
    function timeUntilTradingEnabled() public view returns (uint256) {
        if (isTradingEnabled()) return 0;
        return (deploymentTime + TRADE_LOCK_PERIOD) - block.timestamp;
    }
}