// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KCY1 Token (KCY-MEME-1) - v18
 * @dev Complete rules:
 * 
 *      FEES:
 *      - Normal users: 0.08% total (0.03% burn + 0.05% owner)
 *      - Exempt Slot → Normal: 0.008% total (0.003% burn + 0.005% owner)
 *      - Exempt → Exempt: 0% (no fees)
 * 
 *      NORMAL USERS:
 *        ✓ Can trade (buy/sell) through Router
 *        ✗ CANNOT add/remove liquidity directly to Pair
 *        ✓ 0.08% fees on all transactions
 *        ✓ 1,000 token max per transaction
 *        ✓ 2 hour cooldown
 *        ✓ 20,000 token max wallet
 *      
 *      EXEMPT (4 slots) ↔ EXEMPT/Router/Factory:
 *        ✓ NO fees (0%)
 *        ✓ NO limits
 *        ✓ CAN add/remove liquidity
 * 
 *      SPECIAL: EXEMPT (4 slots) → NORMAL user:
 *        ✓ 0.008% fees (10x lower!)
 *        ✓ 100 token max (not 1000!)
 *        ✓ 24 hour cooldown (not 2 hours!)
 * 
 *      LOCKING:
 *        - Exempt 4 slots: CAN be locked forever
 *        - Router/Factory: NEVER locked, always updatable
 *        - Liquidity Pairs: CAN be locked forever
 * 
 * @author Production Version - v18
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

interface IPancakeFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
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
    // FEE STRUCTURE
    // ====================================
    
    // Normal users: 0.08% total
    uint256 public constant BURN_FEE = 30;     // 0.03% burn (30 basis points)
    uint256 public constant OWNER_FEE = 50;    // 0.05% to owner (50 basis points)
    
    // Exempt Slot → Normal: 0.008% total (10x lower)
    uint256 public constant EXEMPT_TO_NORMAL_BURN_FEE = 3;   // 0.003%
    uint256 public constant EXEMPT_TO_NORMAL_OWNER_FEE = 5;  // 0.005%
    
    uint256 public constant FEE_DENOMINATOR = 100000;  // 100,000 for precision
    
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
    
    // DEX addresses (NOT locked, can always be updated)
    address public pancakeswapRouter;
    address public pancakeswapFactory;
    
    // Lock mechanism (ONLY for 4 exempt slots, NOT for Router/Factory!)
    bool public exemptSlotsLocked;
    
    // ====================================
    // LIQUIDITY PAIR TRACKING
    // ====================================
    
    // Track liquidity pair addresses to block normal users from adding/removing liquidity
    mapping(address => bool) public isLiquidityPair;
    
    // Lock mechanism for liquidity pairs
    bool public liquidityPairsLocked;
    
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
    event ExemptSlotsUpdated(address[4] slots);
    event ExemptSlotsLocked();
    event DEXAddressesUpdated(address indexed router, address indexed factory);
    event EmergencyTokensRescued(address indexed token, uint256 amount);
    event BNBWithdrawn(uint256 amount);
    event InitialDistributionCompleted(uint256 totalDistributed);
    event DistributionSent(address indexed recipient, uint256 amount);
    event LiquidityPairUpdated(address indexed pair, bool status);
    event LiquidityPairsLocked();
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!isPaused(), "Contract is paused");
        _;
    }
    
    modifier whenSlotsNotLocked() {
        require(!exemptSlotsLocked, "Exempt slots are locked forever");
        _;
    }
    
    modifier whenPairsNotLocked() {
        require(!liquidityPairsLocked, "Liquidity pairs are locked forever");
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
     * @dev STEP 1: VIEW - Get pair address from Factory (READ ONLY - doesn't add it)
     * Call this first to see what the Pair address is
     * 
     * @param pairedToken The token to check pairing with KCY1 (e.g., WBNB, USDT, BUSD)
     * @return pairAddress The address of the pair (address(0) if doesn't exist yet)
     * 
     * Example:
     * getLiquidityPairAddress(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c) // Check KCY1/WBNB pair
     * Returns: 0xABC...123 (the Pair contract address)
     */
    function getLiquidityPairAddress(address pairedToken) external view returns (address pairAddress) {
        require(pairedToken != address(0), "Invalid token address");
        require(pairedToken != address(this), "Cannot pair with itself");
        pairAddress = IPancakeFactory(pancakeswapFactory).getPair(address(this), pairedToken);
    }
    
    /**
     * @dev STEP 2: MANUAL - Add liquidity pair address manually
     * After seeing the pair address from getLiquidityPairAddress(), add it here
     * Normal users will be blocked from sending tokens directly to these addresses
     * Can only be called before pairs are locked
     * 
     * @param pair The exact Pair contract address to add
     * @param status true to add, false to remove
     * 
     * Example:
     * setLiquidityPair(0xABC...123, true) // Add the pair address you got from step 1
     */
    function setLiquidityPair(address pair, bool status) external onlyOwner whenPairsNotLocked {
        require(pair != address(0), "Invalid pair address");
        isLiquidityPair[pair] = status;
        emit LiquidityPairUpdated(pair, status);
    }
    
    /**
     * @dev MANUAL BATCH: Add multiple pair addresses at once (if you have multiple pairs)
     * Can only be called before pairs are locked
     * 
     * @param pairs Array of Pair contract addresses
     * @param status true to add all, false to remove all
     * 
     * Example:
     * address[] memory pairAddresses = [0xABC...123, 0xDEF...456];
     * setLiquidityPairBatch(pairAddresses, true)
     */
    function setLiquidityPairBatch(address[] calldata pairs, bool status) external onlyOwner whenPairsNotLocked {
        for (uint256 i = 0; i < pairs.length; i++) {
            if (pairs[i] != address(0)) {
                isLiquidityPair[pairs[i]] = status;
                emit LiquidityPairUpdated(pairs[i], status);
            }
        }
    }
    
    /**
     * @dev Lock liquidity pair settings forever
     * After calling this, no more pairs can be added or removed
     * This is IRREVERSIBLE - use with caution!
     */
    function lockLiquidityPairsForever() external onlyOwner whenPairsNotLocked {
        liquidityPairsLocked = true;
        emit LiquidityPairsLocked();
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
     */
    function isExemptSlot(address account) public view returns (bool) {
        return account == exemptAddress1 ||
               account == exemptAddress2 ||
               account == exemptAddress3 ||
               account == exemptAddress4;
    }
    
    /**
     * @dev Update the 4 exempt slots
     * Can only be called before slots are locked
     * Router/Factory are updated separately via updateDEXAddresses()
     */
    function updateExemptSlots(address[4] memory slots) external onlyOwner whenSlotsNotLocked {
        exemptAddress1 = slots[0];
        exemptAddress2 = slots[1];
        exemptAddress3 = slots[2];
        exemptAddress4 = slots[3];
        
        emit ExemptSlotsUpdated(slots);
    }
    
    /**
     * @dev Lock the 4 exempt slots forever
     * After calling this, the 4 exempt slots can NEVER be changed again
     * Router/Factory remain updatable - they are NOT affected by this lock!
     * This is IRREVERSIBLE - use with caution!
     */
    function lockExemptSlotsForever() external onlyOwner whenSlotsNotLocked {
        exemptSlotsLocked = true;
        emit ExemptSlotsLocked();
    }
    
    /**
     * @dev Update DEX addresses (Router and Factory)
     * These can ALWAYS be updated - they are NEVER locked!
     * This allows flexibility if PancakeSwap upgrades their contracts
     * 
     * @param router New PancakeSwap Router address
     * @param factory New PancakeSwap Factory address
     */
    function updateDEXAddresses(address router, address factory) external onlyOwner {
        require(router != address(0), "Router cannot be zero address");
        require(factory != address(0), "Factory cannot be zero address");
        
        pancakeswapRouter = router;
        pancakeswapFactory = factory;
        
        emit DEXAddressesUpdated(router, factory);
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
     * NEW RULE: Normal users CANNOT send directly to Liquidity Pairs
     * - This blocks adding/removing liquidity for normal users
     * - Trading through Router is still allowed (Router sends to Pair, not user)
     * 
     * Logic flow:
     * 1. Block normal users from sending to Pair directly
     * 2. If BOTH exempt → No fees, no limits
     * 3. If Exempt Slot → Normal → 0.008% fees, 100 token max, 24h cooldown
     * 4. If any other case with normal → 0.08% fees, 1000 token max, 2h cooldown
     */
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        
        bool fromExempt = isExemptAddress(from);
        bool toExempt = isExemptAddress(to);
        bool fromExemptSlot = isExemptSlot(from);
        
        // ============================================
        // NEW: BLOCK NORMAL USERS FROM LIQUIDITY OPERATIONS
        // ============================================
        // Normal users CANNOT send directly to Pair contracts
        // This blocks adding liquidity, but allows trading through Router
        if (!fromExempt && isLiquidityPair[to]) {
            revert("Normal users cannot add liquidity directly");
        }
        
        // Normal users CANNOT receive directly from Pair contracts (during liquidity removal)
        // Exception: Router can facilitate (Router → User is ok)
        if (!toExempt && isLiquidityPair[from] && msg.sender != pancakeswapRouter) {
            revert("Normal users cannot remove liquidity directly");
        }
        
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
        } else if (isExemptSlotToNormal) {
            // EXEMPT SLOT → NORMAL: Apply 0.008% fees (0.003% burn + 0.005% owner)
            uint256 burnAmount = (amount * EXEMPT_TO_NORMAL_BURN_FEE) / FEE_DENOMINATOR;
            uint256 ownerAmount = (amount * EXEMPT_TO_NORMAL_OWNER_FEE) / FEE_DENOMINATOR;
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
        } else {
            // AT LEAST ONE NORMAL: Apply 0.08% fees (0.03% burn + 0.05% owner)
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
        address[4] memory slots,
        address router,
        address factory,
        bool slotsLocked
    ) {
        slots[0] = exemptAddress1;
        slots[1] = exemptAddress2;
        slots[2] = exemptAddress3;
        slots[3] = exemptAddress4;
        router = pancakeswapRouter;
        factory = pancakeswapFactory;
        slotsLocked = exemptSlotsLocked;
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