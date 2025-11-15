// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KCY1 Token (KCY-MEME-1) - FINAL CORRECTED VERSION
 * @dev Complete transaction rules:
 * 
 *      NORMAL USER transactions:
 *        ✓ 8% fees (3% burn + 5% owner)
 *        ✓ 1,000 token max per transaction
 *        ✓ 2 hour cooldown
 *        ✓ 20,000 token max wallet
 *      
 *      EXEMPT (4 slots) ↔ EXEMPT/Router/Factory:
 *        ✓ NO fees
 *        ✓ NO limits
 * 
 *      SPECIAL: EXEMPT (4 slots) → NORMAL user:
 *        ✓ 8% fees
 *        ✓ 100 token max (not 1000!)
 *        ✓ 24 hour cooldown (not 2 hours!)
 *        ✓ Normal wallet limit applies to recipient
 * 
 *      Examples:
 *        - Normal → Normal: 8% fees, 1000 max, 2h cooldown
 *        - Normal → Exempt: 8% fees, 1000 max, 2h cooldown
 *        - Normal → Router: 8% fees, 1000 max, 2h cooldown
 *        - Exempt slot → Normal: 8% fees, 100 max, 24h cooldown ⚠️
 *        - Exempt → Exempt: NO fees, NO limits
 *        - Exempt → Router: NO fees, NO limits
 *        - Router → Normal: 8% fees, 1000 max, no cooldown
 * 
 * @author Production Version - Final v3.0
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
    
    address private constant DEV_WALLET_mm_vis = 0x567c1c5e9026E04078F9b92DcF295A58355f60c7;
    address private constant MARKETING_WALLET_tng = 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A;
    uint256 private constant MARKETING_ALLOCATION = 150_000 * 10**18;
    address private constant TEAM_WALLET_trz_hdn = 0x6300811567bed7d69B5AC271060a7E298f99fddd;
    uint256 private constant TEAM_ALLOCATION = 200_000 * 10**18;
    address private constant ADVISOR_WALLET_trz_vis = 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87;
    uint256 private constant ADVISOR_ALLOCATION = 150_000 * 10**18;
    uint256 private constant TOTAL_DISTRIBUTION = 500_000 * 10**18;
    
    bool public initialDistributionCompleted;
    
    // ====================================
    // Fee and Limit Configuration
    // ====================================
    
    uint256 public constant BURN_FEE = 300;  // 3% burn
    uint256 public constant OWNER_FEE = 500; // 5% to owner
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Limits for NORMAL users
    uint256 public constant MAX_TRANSACTION = 1000 * 10**18;        // 1,000 tokens
    uint256 public constant MAX_WALLET = 20000 * 10**18;            // 20,000 tokens
    uint256 public constant COOLDOWN_PERIOD = 2 hours;              // 2 hour cooldown
    uint256 public constant PAUSE_DURATION = 48 hours;
    
    // SPECIAL: Exempt slot → Normal user limits
    uint256 public constant MAX_EXEMPT_TO_NORMAL = 100 * 10**18;    // 100 tokens max
    uint256 public constant EXEMPT_TO_NORMAL_COOLDOWN = 24 hours;   // 24 hour cooldown
    
    // Pause mechanism
    uint256 public pausedUntil;
    
    // Exempt addresses (4 slots ONLY - these have special rules)
    address public exemptAddress1;
    address public exemptAddress2;
    address public exemptAddress3;
    address public exemptAddress4;
    
    // DEX addresses (Router/Factory are facilitators, not "slot exempt")
    address public pancakeswapRouter;
    address public pancakeswapFactory;
    
    // Lock mechanism
    bool public exemptAddressesLocked;
    
    // Mappings
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    mapping(address => uint256) public lastTransactionTime;          // For normal users (2h cooldown)
    mapping(address => uint256) public lastExemptToNormalTime;       // For exempt slots (24h cooldown)
    mapping(address => bool) public isBlacklisted;
    
    // Events
    event TokensBurned(uint256 amount);
    event Paused(uint256 until);
    event Blacklisted(address indexed account, bool status);
    event ExemptAddressesUpdated(address[4] addresses, address router, address factory);
    event ExemptAddressesLocked();
    event EmergencyTokensRescued(address indexed token, uint256 amount);
    event BNBWithdrawn(uint256 amount);
    event InitialDistributionCompleted(uint256 totalDistributed);
    event DistributionSent(address indexed recipient, uint256 amount);
    
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
        
        balanceOf[DEV_WALLET_mm_vis] = 600_000 * 10**decimals;
        balanceOf[address(this)] = 400_000 * 10**decimals;
        
        pancakeswapRouter = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
        pancakeswapFactory = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
        
        exemptAddress1 = address(0);
        exemptAddress2 = address(0);
        exemptAddress3 = address(0);
        exemptAddress4 = address(0);
        
        emit Transfer(address(0), DEV_WALLET_mm_vis, 600_000 * 10**decimals);
        emit Transfer(address(0), address(this), 400_000 * 10**decimals);
    }
    
    function distributeInitialAllocations() external onlyOwner {
        require(!initialDistributionCompleted, "Distribution already completed");
        require(balanceOf[DEV_WALLET_mm_vis] >= TOTAL_DISTRIBUTION, "Insufficient DEV_WALLET balance");
        
        initialDistributionCompleted = true;
        
        if (MARKETING_WALLET_tng != address(0) && MARKETING_ALLOCATION > 0) {
            balanceOf[DEV_WALLET_mm_vis] -= MARKETING_ALLOCATION;
            balanceOf[MARKETING_WALLET_tng] += MARKETING_ALLOCATION;
            emit Transfer(DEV_WALLET_mm_vis, MARKETING_WALLET_tng, MARKETING_ALLOCATION);
            emit DistributionSent(MARKETING_WALLET_tng, MARKETING_ALLOCATION);
        }
        
        if (TEAM_WALLET_trz_hdn != address(0) && TEAM_ALLOCATION > 0) {
            balanceOf[DEV_WALLET_mm_vis] -= TEAM_ALLOCATION;
            balanceOf[TEAM_WALLET_trz_hdn] += TEAM_ALLOCATION;
            emit Transfer(DEV_WALLET_mm_vis, TEAM_WALLET_trz_hdn, TEAM_ALLOCATION);
            emit DistributionSent(TEAM_WALLET_trz_hdn, TEAM_ALLOCATION);
        }
        
        if (ADVISOR_WALLET_trz_vis != address(0) && ADVISOR_ALLOCATION > 0) {
            balanceOf[DEV_WALLET_mm_vis] -= ADVISOR_ALLOCATION;
            balanceOf[ADVISOR_WALLET_trz_vis] += ADVISOR_ALLOCATION;
            emit Transfer(DEV_WALLET_mm_vis, ADVISOR_WALLET_trz_vis, ADVISOR_ALLOCATION);
            emit DistributionSent(ADVISOR_WALLET_trz_vis, ADVISOR_ALLOCATION);
        }
        
        emit InitialDistributionCompleted(TOTAL_DISTRIBUTION);
    }
    
    /**
     * @dev Check if address is fully exempt (for fees and limits)
     */
    function isExemptAddress(address account) public view returns (bool) {
        return account == owner ||
               account == address(this) ||
               account == exemptAddress1 ||
               account == exemptAddress2 ||
               account == exemptAddress3 ||
               account == exemptAddress4 ||
               account == pancakeswapRouter ||
               account == pancakeswapFactory;
    }
    
    /**
     * @dev Check if address is one of the 4 exempt slots (not Router/Factory)
     * These slots have special 100 token / 24h cooldown rules when sending to normal users
     */
    function isExemptSlot(address account) public view returns (bool) {
        return account == exemptAddress1 ||
               account == exemptAddress2 ||
               account == exemptAddress3 ||
               account == exemptAddress4;
    }
    
    function updateExemptAddresses(
        address[4] memory addresses,
        address router,
        address factory
    ) external onlyOwner whenNotLocked {
        require(router != address(0), "Router cannot be zero address");
        require(factory != address(0), "Factory cannot be zero address");
        
        exemptAddress1 = addresses[0];
        exemptAddress2 = addresses[1];
        exemptAddress3 = addresses[2];
        exemptAddress4 = addresses[3];
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
    
    /**
     * @dev Main transfer logic with all rules
     * 
     * Logic flow:
     * 1. If BOTH exempt → No fees, no limits
     * 2. If Exempt Slot → Normal → 8% fees, 100 token max, 24h cooldown
     * 3. If any other case with normal → 8% fees, 1000 token max, 2h cooldown
     */
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        
        bool fromExempt = isExemptAddress(from);
        bool toExempt = isExemptAddress(to);
        bool fromExemptSlot = isExemptSlot(from);
        
        // Determine transaction type
        bool isNormalTransaction = !fromExempt || !toExempt;
        bool isExemptSlotToNormal = fromExemptSlot && !toExempt;
        
        // ============================================
        // PAUSE CHECK - Only for normal transactions
        // ============================================
        if (isNormalTransaction) {
            require(!isPaused(), "Contract is paused");
        }
        
        // ============================================
        // BLACKLIST CHECK - Only for normal addresses
        // ============================================
        if (!fromExempt) {
            require(!isBlacklisted[from], "Sender is blacklisted");
        }
        if (!toExempt) {
            require(!isBlacklisted[to], "Recipient is blacklisted");
        }
        
        // ============================================
        // TRADING LOCK CHECK - Only for normal users
        // ============================================
        if (!fromExempt) {
            require(block.timestamp >= tradingEnabledTime, "Trading locked for 48h");
        }
        
        // ============================================
        // SPECIAL CASE: Exempt Slot → Normal User
        // ============================================
        if (isExemptSlotToNormal) {
            // 100 token maximum (not 1000!)
            require(amount <= MAX_EXEMPT_TO_NORMAL, "Exempt slot to normal: max 100 tokens");
            
            // 24 hour cooldown (not 2 hours!)
            uint256 lastExemptTx = lastExemptToNormalTime[from];
            if (lastExemptTx != 0) {
                require(
                    block.timestamp >= lastExemptTx + EXEMPT_TO_NORMAL_COOLDOWN,
                    "Exempt slot to normal: wait 24 hours"
                );
            }
            
            // Wallet limit still applies to normal recipient
            uint256 recipientBalance = balanceOf[to];
            require(
                recipientBalance + amount <= MAX_WALLET,
                "Recipient would exceed max wallet (20,000 tokens)"
            );
        }
        // ============================================
        // NORMAL TRANSACTION LIMITS (not Exempt Slot → Normal)
        // ============================================
        else if (isNormalTransaction) {
            // 1,000 token maximum for normal transactions
            require(amount <= MAX_TRANSACTION, "Exceeds max transaction (1000 tokens)");
            
            // Wallet limit - only check for normal recipient
            if (!toExempt) {
                uint256 recipientBalance = balanceOf[to];
                require(
                    recipientBalance + amount <= MAX_WALLET,
                    "Recipient would exceed max wallet (20,000 tokens)"
                );
            }
            
            // 2 hour cooldown - only for normal sender
            if (!fromExempt) {
                uint256 lastTx = lastTransactionTime[from];
                if (lastTx != 0) {
                    require(
                        block.timestamp >= lastTx + COOLDOWN_PERIOD,
                        "Must wait 2 hours between transactions"
                    );
                }
            }
        }
        
        // ============================================
        // EXECUTE TRANSFER WITH OR WITHOUT FEES
        // ============================================
        
        if (fromExempt && toExempt) {
            // BOTH EXEMPT: No fees, no limits
            unchecked {
                balanceOf[from] -= amount;
                balanceOf[to] += amount;
            }
            emit Transfer(from, to, amount);
        } else {
            // AT LEAST ONE NORMAL (or Exempt Slot → Normal): Apply 8% fees
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
        }
        
        // ============================================
        // UPDATE COOLDOWN TIMERS
        // ============================================
        
        // Update normal user cooldown (2 hours)
        if (!fromExempt) {
            lastTransactionTime[from] = block.timestamp;
        }
        
        // Update exempt slot to normal cooldown (24 hours)
        if (isExemptSlotToNormal) {
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
        address[4] memory addresses,
        address router,
        address factory,
        bool locked
    ) {
        addresses[0] = exemptAddress1;
        addresses[1] = exemptAddress2;
        addresses[2] = exemptAddress3;
        addresses[3] = exemptAddress4;
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