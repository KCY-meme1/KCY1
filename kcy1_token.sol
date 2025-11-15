// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KCY1 Token - VERSION 3.2 WITH EXEMPT PRIVILEGES
 * @dev Enhanced version with:
 *      - Automatic initial distribution
 *      - Exempt-to-normal transfer restrictions (100 tokens, 24h cooldown)
 *      - Pause and Blacklist do NOT apply to exempt addresses
 * @author Production Version with Full Exempt Privileges
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
    
    // Marketing wallet - will receive 150,000 tokens
    address private constant MARKETING_WALLET = 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A;
    uint256 private constant MARKETING_ALLOCATION = 150_000 * 10**18;
    
    // Team wallet - will receive 200,000 tokens
    address private constant TEAM_WALLET = 0x6300811567bed7d69B5AC271060a7E298f99fddd;
    uint256 private constant TEAM_ALLOCATION = 200_000 * 10**18;
    
    // Advisor wallet - will receive 150,000 tokens  
    address private constant ADVISOR_WALLET = 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87;
    uint256 private constant ADVISOR_ALLOCATION = 150_000 * 10**18;
    
    // Development wallet - will remain with 100,000 tokens
    address private constant DEV_WALLET = 0x567c1c5e9026E04078F9b92DcF295A58355f60c7;
    uint256 private constant DEV_ALLOCATION = 100_000 * 10**18;
    
    // Community wallet - will receive 15,000 tokens
    address private constant COMMUNITY_WALLET = 0x1234567890123456789012345678901234567895;
    uint256 private constant COMMUNITY_ALLOCATION = 0_000 * 10**18;
    
    uint256 private constant TOTAL_DISTRIBUTION = 600_000 * 10**18;
    
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
    
    // NEW: Exempt to Normal address restrictions
    uint256 public constant MAX_EXEMPT_TO_NORMAL = 100 * 10**18;  // 100 tokens max
    uint256 public constant EXEMPT_TO_NORMAL_COOLDOWN = 24 hours;  // 24 hour cooldown
    
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
    mapping(address => uint256) public lastExemptToNormalTime;  // NEW: Track exempt->normal transfers
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
    
    function isExemptAddress(address account) public view returns (bool) {
        return account == owner ||
               account == address(this) ||
               account == exemptAddress1 ||
               account == exemptAddress2 ||
               account == exemptAddress3 ||
               account == exemptAddress4 ||
               account == exemptAddress5 ||
               account == pancakeswapRouter ||
               account == pancakeswapFactory;
    }
    
    function updateExemptAddresses(
        address[5] memory addresses,
        address router,
        address factory
    ) external onlyOwner whenNotLocked {
        require(router != address(0), "Router cannot be zero address");
        require(factory != address(0), "Factory cannot be zero address");
        
        exemptAddress1 = addresses[0];
        exemptAddress2 = addresses[1];
        exemptAddress3 = addresses[2];
        exemptAddress4 = addresses[3];
        exemptAddress5 = addresses[4];
        pancakeswapRouter = router;
        pancakeswapFactory = factory;
        
        emit ExemptAddressesUpdated(addresses, router, factory);
    }
    
    function lockExemptAddressesForever() external onlyOwner whenNotLocked {
        exemptAddressesLocked = true;
        emit ExemptAddressesLocked();
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
    
    function transfer(address to, uint256 amount) public override returns (bool) {
        return _transfer(msg.sender, to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
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
        
        bool fromExempt = isExemptAddress(from);
        bool toExempt = isExemptAddress(to);
        
        // Pause check - only for non-exempt addresses
        if (!fromExempt && !toExempt) {
            require(!isPaused(), "Contract is paused");
        }
        
        // Blacklist check - only for non-exempt addresses
        if (!fromExempt) {
            require(!isBlacklisted[from], "Sender is blacklisted");
        }
        if (!toExempt) {
            require(!isBlacklisted[to], "Recipient is blacklisted");
        }
        
        // NEW: Check exempt to normal restrictions
        if (fromExempt && !toExempt) {
            // Exempt address sending to normal address
            require(amount <= MAX_EXEMPT_TO_NORMAL, "Exempt to normal: exceeds 100 token limit");
            
            uint256 lastExemptTx = lastExemptToNormalTime[from];
            if (lastExemptTx != 0) {
                require(
                    block.timestamp >= lastExemptTx + EXEMPT_TO_NORMAL_COOLDOWN,
                    "Exempt to normal: must wait 24 hours between transfers"
                );
            }
        }
        
        // Original trading lock check (only for normal to normal)
        if (!fromExempt && !toExempt) {
            require(block.timestamp >= tradingEnabledTime, "Trading locked for 48h");
        }
        
        // Original limits check (only for normal to normal)
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
        
        // Execute transfer with or without fees
        if (fromExempt || toExempt) {
            // No fees for exempt transfers
            unchecked {
                balanceOf[from] -= amount;
                balanceOf[to] += amount;
            }
            emit Transfer(from, to, amount);
        } else {
            // Apply fees for normal to normal transfers
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
        
        // NEW: Update exempt to normal cooldown timer
        if (fromExempt && !toExempt) {
            lastExemptToNormalTime[from] = block.timestamp;
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
