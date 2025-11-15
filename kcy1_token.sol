// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KCY1 Token - VERSION 3.0 WITH AUTO-DISTRIBUTION
 * @dev Enhanced version with automatic initial distribution to preset addresses
 * @author Final Production Version with Distribution Feature
 */

// [Previous interfaces remain the same - IERC20 and ReentrancyGuard]
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

contract KCY1Token is IERC20, ReentrancyGuard {
    // Token metadata
    string public constant name = "KCY1";
    string public constant symbol = "KCY1";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    
    // Ownership and trading control
    address public immutable owner;
    uint256 public immutable tradingEnabledTime;
    
    // ====================================
    // AUTOMATIC DISTRIBUTION CONFIGURATION
    // ====================================
    // CHANGE THESE VALUES BEFORE DEPLOYMENT!
    
    // Marketing wallet - will receive 50,000 tokens
    address private constant MARKETING_WALLET = 0x1234567890123456789012345678901234567891; // CHANGE THIS!
    uint256 private constant MARKETING_ALLOCATION = 50_000 * 10**18;
    
    // Team wallet - will receive 30,000 tokens
    address private constant TEAM_WALLET = 0x1234567890123456789012345678901234567892; // CHANGE THIS!
    uint256 private constant TEAM_ALLOCATION = 30_000 * 10**18;
    
    // Development wallet - will receive 20,000 tokens
    address private constant DEV_WALLET = 0x1234567890123456789012345678901234567893; // CHANGE THIS!
    uint256 private constant DEV_ALLOCATION = 20_000 * 10**18;
    
    // Advisor wallet - will receive 10,000 tokens  
    address private constant ADVISOR_WALLET = 0x1234567890123456789012345678901234567894; // CHANGE THIS!
    uint256 private constant ADVISOR_ALLOCATION = 10_000 * 10**18;
    
    // Community wallet - will receive 15,000 tokens
    address private constant COMMUNITY_WALLET = 0x1234567890123456789012345678901234567895; // CHANGE THIS!
    uint256 private constant COMMUNITY_ALLOCATION = 15_000 * 10**18;
    
    // Total to distribute: 125,000 tokens (from contract's 400,000)
    uint256 private constant TOTAL_DISTRIBUTION = 125_000 * 10**18;
    
    // Distribution state
    bool public initialDistributionCompleted;
    
    // ====================================
    // Rest of contract variables
    // ====================================
    
    // Fee structure (in basis points, 1 bp = 0.01%)
    uint256 public constant BURN_FEE = 300;  // 3% burn
    uint256 public constant OWNER_FEE = 500; // 5% to owner
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Transaction limits
    uint256 public constant MAX_TRANSACTION = 1000 * 10**18;
    uint256 public constant MAX_WALLET = 20000 * 10**18;
    uint256 public constant COOLDOWN_PERIOD = 2 hours;
    uint256 public constant PAUSE_DURATION = 48 hours;
    
    // Pause mechanism
    uint256 public pausedUntil;
    
    // Exempt addresses
    address public exemptAddress1;
    address public exemptAddress2;
    address public exemptAddress3;
    address public exemptAddress4;
    address public exemptAddress5;
    
    // DEX addresses
    address public pancakeswapRouter;
    address public pancakeswapFactory;
    
    // Lock mechanism
    bool public exemptAddressesLocked;
    
    // Mappings
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => bool) public isBlacklisted;
    
    // Events
    event TokensBurned(uint256 amount);
    event Paused(uint256 until);
    event Blacklisted(address indexed account, bool status);
    event ExemptAddressesUpdated(address[5] addresses, address router, address factory);
    event ExemptAddressesLocked();
    event EmergencyTokensRescued(address indexed token, uint256 amount);
    event BNBWithdrawn(uint256 amount);
    event InitialDistributionCompleted(uint256 totalDistributed);
    event DistributionSent(address indexed recipient, uint256 amount);
    
    // Modifiers
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
        
        // Initial distribution: 60% to owner, 40% to contract
        balanceOf[owner] = 600_000 * 10**decimals;
        balanceOf[address(this)] = 400_000 * 10**decimals;
        
        // Initialize PancakeSwap addresses (BSC Mainnet)
        pancakeswapRouter = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
        pancakeswapFactory = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
        
        // Exempt addresses start empty
        exemptAddress1 = address(0);
        exemptAddress2 = address(0);
        exemptAddress3 = address(0);
        exemptAddress4 = address(0);
        exemptAddress5 = address(0);
        
        emit Transfer(address(0), owner, 600_000 * 10**decimals);
        emit Transfer(address(0), address(this), 400_000 * 10**decimals);
    }
    
    /**
     * @dev AUTOMATIC DISTRIBUTION FUNCTION
     * Distributes hardcoded amounts to preset wallets
     * Can only be called once by owner
     * Uses contract's balance (from the initial 400,000 tokens)
     */
    function distributeInitialAllocations() external onlyOwner {
        require(!initialDistributionCompleted, "Distribution already completed");
        require(balanceOf[address(this)] >= TOTAL_DISTRIBUTION, "Insufficient contract balance");
        
        // Mark as completed first to prevent reentrancy
        initialDistributionCompleted = true;
        
        // Distribute to Marketing Wallet
        if (MARKETING_WALLET != address(0) && MARKETING_ALLOCATION > 0) {
            balanceOf[address(this)] -= MARKETING_ALLOCATION;
            balanceOf[MARKETING_WALLET] += MARKETING_ALLOCATION;
            emit Transfer(address(this), MARKETING_WALLET, MARKETING_ALLOCATION);
            emit DistributionSent(MARKETING_WALLET, MARKETING_ALLOCATION);
        }
        
        // Distribute to Team Wallet
        if (TEAM_WALLET != address(0) && TEAM_ALLOCATION > 0) {
            balanceOf[address(this)] -= TEAM_ALLOCATION;
            balanceOf[TEAM_WALLET] += TEAM_ALLOCATION;
            emit Transfer(address(this), TEAM_WALLET, TEAM_ALLOCATION);
            emit DistributionSent(TEAM_WALLET, TEAM_ALLOCATION);
        }
        
        // Distribute to Development Wallet
        if (DEV_WALLET != address(0) && DEV_ALLOCATION > 0) {
            balanceOf[address(this)] -= DEV_ALLOCATION;
            balanceOf[DEV_WALLET] += DEV_ALLOCATION;
            emit Transfer(address(this), DEV_WALLET, DEV_ALLOCATION);
            emit DistributionSent(DEV_WALLET, DEV_ALLOCATION);
        }
        
        // Distribute to Advisor Wallet
        if (ADVISOR_WALLET != address(0) && ADVISOR_ALLOCATION > 0) {
            balanceOf[address(this)] -= ADVISOR_ALLOCATION;
            balanceOf[ADVISOR_WALLET] += ADVISOR_ALLOCATION;
            emit Transfer(address(this), ADVISOR_WALLET, ADVISOR_ALLOCATION);
            emit DistributionSent(ADVISOR_WALLET, ADVISOR_ALLOCATION);
        }
        
        // Distribute to Community Wallet
        if (COMMUNITY_WALLET != address(0) && COMMUNITY_ALLOCATION > 0) {
            balanceOf[address(this)] -= COMMUNITY_ALLOCATION;
            balanceOf[COMMUNITY_WALLET] += COMMUNITY_ALLOCATION;
            emit Transfer(address(this), COMMUNITY_WALLET, COMMUNITY_ALLOCATION);
            emit DistributionSent(COMMUNITY_WALLET, COMMUNITY_ALLOCATION);
        }
        
        emit InitialDistributionCompleted(TOTAL_DISTRIBUTION);
    }
    
    /**
     * @dev Set these wallets as exempt addresses after distribution
     * This function automatically sets the distribution wallets as exempt
     */
    function setDistributionWalletsAsExempt() external onlyOwner whenNotLocked {
        exemptAddress1 = MARKETING_WALLET;
        exemptAddress2 = TEAM_WALLET;
        exemptAddress3 = DEV_WALLET;
        exemptAddress4 = ADVISOR_WALLET;
        exemptAddress5 = COMMUNITY_WALLET;
        
        address[5] memory exempts = [exemptAddress1, exemptAddress2, exemptAddress3, exemptAddress4, exemptAddress5];
        emit ExemptAddressesUpdated(exempts, pancakeswapRouter, pancakeswapFactory);
    }
    
    /**
     * @dev Get distribution configuration (for verification before deployment)
     */
    function getDistributionConfig() external pure returns (
        address marketing,
        uint256 marketingAmount,
        address team,
        uint256 teamAmount,
        address dev,
        uint256 devAmount,
        address advisor,
        uint256 advisorAmount,
        address community,
        uint256 communityAmount,
        uint256 totalAmount
    ) {
        marketing = MARKETING_WALLET;
        marketingAmount = MARKETING_ALLOCATION;
        team = TEAM_WALLET;
        teamAmount = TEAM_ALLOCATION;
        dev = DEV_WALLET;
        devAmount = DEV_ALLOCATION;
        advisor = ADVISOR_WALLET;
        advisorAmount = ADVISOR_ALLOCATION;
        community = COMMUNITY_WALLET;
        communityAmount = COMMUNITY_ALLOCATION;
        totalAmount = TOTAL_DISTRIBUTION;
    }
    
    // ====================================
    // REST OF CONTRACT FUNCTIONS (unchanged)
    // ====================================
    
    function setExemptAddresses(
        address[5] calldata _addresses,
        address _router,
        address _factory
    ) external onlyOwner whenNotLocked {
        require(_router != address(0), "Invalid router address");
        require(_factory != address(0), "Invalid factory address");
        
        exemptAddress1 = _addresses[0];
        exemptAddress2 = _addresses[1];
        exemptAddress3 = _addresses[2];
        exemptAddress4 = _addresses[3];
        exemptAddress5 = _addresses[4];
        
        pancakeswapRouter = _router;
        pancakeswapFactory = _factory;
        
        emit ExemptAddressesUpdated(_addresses, _router, _factory);
    }
    
    function lockExemptAddresses() external onlyOwner whenNotLocked {
        require(pancakeswapRouter != address(0), "Router not set");
        require(pancakeswapFactory != address(0), "Factory not set");
        
        exemptAddressesLocked = true;
        emit ExemptAddressesLocked();
    }
    
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
    
    function isPaused() public view returns (bool) {
        return block.timestamp < pausedUntil;
    }
    
    function pause() external onlyOwner {
        require(pausedUntil <= block.timestamp, "Already paused");
        pausedUntil = block.timestamp + PAUSE_DURATION;
        emit Paused(pausedUntil);
    }
    
    function setBlacklist(address account, bool status) external onlyOwner {
        require(account != owner, "Cannot blacklist owner");
        require(account != address(this), "Cannot blacklist contract");
        require(account != address(0), "Cannot blacklist zero address");
        
        isBlacklisted[account] = status;
        emit Blacklisted(account, status);
    }
    
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
    
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return _transfer(msg.sender, to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= amount, "Insufficient allowance");
        
        unchecked {
            allowance[from][msg.sender] = currentAllowance - amount;
        }
        
        return _transfer(from, to, amount);
    }
    
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(!isBlacklisted[from], "Sender is blacklisted");
        require(!isBlacklisted[to], "Recipient is blacklisted");
        
        bool fromExempt = isExemptAddress(from);
        bool toExempt = isExemptAddress(to);
        
        if (!fromExempt && !toExempt) {
            require(block.timestamp >= tradingEnabledTime, "Trading locked for 48h");
        }
        
        if (!fromExempt && !toExempt) {
            require(amount <= MAX_TRANSACTION, "Exceeds max transaction (1000 tokens)");
            
            uint256 recipientBalance = balanceOf[to];
            require(
                recipientBalance + amount <= MAX_WALLET,
                "Recipient would exceed max wallet (20,000 tokens)"
            );
            
            uint256 lastTx = lastTransactionTime[from];
            if (lastTx != 0) {
                require(
                    block.timestamp >= lastTx + COOLDOWN_PERIOD,
                    "Must wait 2 hours between transactions"
                );
            }
        }
        
        if (fromExempt || toExempt) {
            unchecked {
                balanceOf[from] -= amount;
                balanceOf[to] += amount;
            }
            emit Transfer(from, to, amount);
        } else {
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
            
            lastTransactionTime[from] = block.timestamp;
        }
        
        return true;
    }
    
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        _approve(msg.sender, spender, allowance[msg.sender][spender] + addedValue);
        return true;
    }
    
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "Decreased allowance below zero");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }
        return true;
    }
    
    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");
        
        allowance[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }
    
    function withdrawCirculationTokens(uint256 amount) external onlyOwner {
        require(balanceOf[address(this)] >= amount, "Insufficient contract balance");
        
        unchecked {
            balanceOf[address(this)] -= amount;
            balanceOf[owner] += amount;
        }
        
        emit Transfer(address(this), owner, amount);
    }
    
    function burn(uint256 amount) external onlyOwner {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        unchecked {
            balanceOf[msg.sender] -= amount;
            totalSupply -= amount;
        }
        
        emit Transfer(msg.sender, address(0), amount);
        emit TokensBurned(amount);
    }
    
    function isTradingEnabled() public view returns (bool) {
        return block.timestamp >= tradingEnabledTime;
    }
    
    function timeUntilTradingEnabled() public view returns (uint256) {
        if (isTradingEnabled()) return 0;
        return tradingEnabledTime - block.timestamp;
    }
    
    function timeUntilUnpaused() public view returns (uint256) {
        if (!isPaused()) return 0;
        return pausedUntil - block.timestamp;
    }
    
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
    
    function rescueTokens(address tokenAddress, uint256 amount) external onlyOwner nonReentrant {
        require(tokenAddress != address(0), "Invalid token address");
        require(tokenAddress != address(this), "Cannot rescue own KCY1 tokens");
        
        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(owner, amount), "Rescue transfer failed");
        
        emit EmergencyTokensRescued(tokenAddress, amount);
    }
    
    receive() external payable {}
    
    function withdrawBNB() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No BNB to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "BNB transfer failed");
        
        emit BNBWithdrawn(balance);
    }
}