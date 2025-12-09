// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Addresses.sol";

/**
 * @version v37
 */
// KCY1 Token (KCY-meme-1)
/**
 * @dev Адресите се взимат от Addresses.sol - ЕДИН ФАЙЛ ЗА ВСИЧКО!
 * 
 *      FEES: 0.08% total (0.03% burn + 0.05% owner)
 *      - Applied when at least one party is normal user
 *      - SAME fee for ALL cases (normal and Exempt Slot → Normal)
 * 
 *      NORMAL USERS:
 *        ✓ Can trade (buy/sell) through Router
 *        ✗ CANNOT add/remove liquidity directly to Pair
 *        ✓ 0.08% fees on all transactions
 *        ✓ 2,000 token max per transaction
 *        ✓ 2 hour cooldown
 *        ✓ 4,000 token max wallet
 *      
 *      EXEMPT (4 slots) ↔ EXEMPT/Router/Factory:
 *        ✓ NO fees (0%)
 *        ✓ NO limits
 *        ✓ CAN add/remove liquidity
 * 
 *      SPECIAL: EXEMPT (4 slots) → NORMAL user:
 *        ✓ 0.08% fees (SAME as normal!)
 *        ✓ 100 token max (not 1000!)
 *        ✓ 24 hour cooldown (not 2 hours!)
 * 
 *      LOCKING:
 *        - Exempt 4 slots: CAN be locked forever
 *        - Router/Factory: NEVER locked, always updatable
 *        - Liquidity Pairs: CAN be locked forever
 * 
 *      DEPLOYMENT:
 *        - Total Supply: 100,000,000 tokens
 *        - DEV Wallet: 96,000,000 tokens (for liquidity + reserve)
 *        - Contract: 4,000,000 tokens (for distribution)
 *        - After distribution:
 *          • Marketing: 1,500,000
 *          • Team: 1,000,000
 *          • Advisor: 1,500,000
 *        - Hardhat (chainid 31337): Deployer gets tokens
 *        - BSC Testnet (chainid 97): Testnet wallets
 *        - BSC Mainnet (chainid 56): Real wallets
 * 
 *      EXEMPT SLOTS:
 *        - Automatically set to distribution addresses
 *        - eAddr1 = DEV wallet
 *        - eAddr2 = Marketing wallet
 *        - eAddr3 = Team wallet
 *        - eAddr4 = Advisor wallet
 * 
 *      ADDRESSES (hardcoded in constructor):
 *        See config/addresses.js for reference
 *        - Testnet: 0xCBfA..., 0x67eD..., 0xD1a7..., etc.
 *        - Mainnet: 0x567c..., 0x58ec..., 0x6300..., 0x8d95...
 * 
 * @author VMK
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
    string public constant name = "KCY-meme-1";
    string public constant symbol = "KCY1";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    
    address public immutable owner;
    uint256 public immutable tradingEnabledTime;
    bool public immutable isTestnet;
    
    address private immutable DEVw_mv;
    address private immutable Mw_tng;
    address private immutable Tw_trz_hdn;
    address private immutable Aw_trzV;
    
    uint256 private constant Mrkt_alloc = 1_500_000 * 10**18;
    uint256 private constant T_alloc = 1_000_000 * 10**18;
    uint256 private constant Adv_alloc = 1_500_000 * 10**18;
    uint256 private constant Tot_dist = 4_000_000 * 10**18;
    
    bool public initialDistributionCompleted;
    
    uint256 public constant BURN_FEE = 30;
    uint256 public constant OWNER_FEE = 50;
    uint256 public constant FEE_DENOMINATOR = 100000;
    
    uint256 public constant MAX_TRANSACTION = 2000 * 10**18;
    uint256 public constant MAX_WALLET = 4000 * 10**18;
    uint256 public constant COOLDOWN_PERIOD = 2 hours;
    uint256 public constant PAUSE_DURATION = 48 hours;
    
    uint256 public constant MAX_EXEMPT_TO_NORMAL = 100 * 10**18;
    uint256 public constant EXEMPT_TO_NORMAL_COOLDOWN = 24 hours;
    
    uint256 public pausedUntil;
    
    address public eAddr1;
    address public eAddr2;
    address public eAddr3;
    address public eAddr4;
    
    address public pncswpRouter;
    address public pncswpFactory;
    
    bool public exemptSlotsLocked;
    
    mapping(address => bool) public isLiquidityPair;
    bool public liquidityPairsLocked;
    
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    mapping(address => uint256) public lastTransactionTime;
    mapping(address => uint256) public lastExemptToNormalTime;
    mapping(address => bool) public isBlacklisted;
    
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
        require(!isPaused(), "Paused");
        _;
    }
    
    modifier whenSlotsNotLocked() {
        require(!exemptSlotsLocked, "Slots locked");
        _;
    }
    
    modifier whenPairsNotLocked() {
        require(!liquidityPairsLocked, "Pairs locked");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        tradingEnabledTime = block.timestamp + 48 hours;
        totalSupply = 100_000_000 * 10**decimals;
        
        // Detect network: Hardhat (31337) or BSC Testnet (97)
        isTestnet = block.chainid == 97 || block.chainid == 31337;
        
        // ===================================================
        // DISTRIBUTION ADDRESSES - From Addresses.sol
        // Generated from config/addresses.js
        // ===================================================
        DEVw_mv = block.chainid == 31337 ? msg.sender : 
                  (block.chainid == 97 ? Addresses.TESTNET_DEV : Addresses.MAINNET_DEV);
        
        Mw_tng = block.chainid == 31337 ? msg.sender :
                 (block.chainid == 97 ? Addresses.TESTNET_MARKETING : Addresses.MAINNET_MARKETING);
        
        Tw_trz_hdn = block.chainid == 31337 ? msg.sender :
                     (block.chainid == 97 ? Addresses.TESTNET_TEAM : Addresses.MAINNET_TEAM);
        
        Aw_trzV = block.chainid == 31337 ? msg.sender :
                  (block.chainid == 97 ? Addresses.TESTNET_ADVISOR : Addresses.MAINNET_ADVISOR);
        
        // ===================================================
        // DEX ADDRESSES - From Addresses.sol
        // ===================================================
        pncswpRouter = block.chainid == 97 ? Addresses.TESTNET_ROUTER : Addresses.MAINNET_ROUTER;
        pncswpFactory = block.chainid == 97 ? Addresses.TESTNET_FACTORY : Addresses.MAINNET_FACTORY;
        
        // ===================================================
        // EXEMPT SLOTS - Same as distribution addresses
        // From Addresses.sol
        // ===================================================
        if (block.chainid == 31337) {
            eAddr1 = msg.sender;  // DEV
            eAddr2 = msg.sender;  // Marketing
            eAddr3 = msg.sender;  // Team
            eAddr4 = msg.sender;  // Advisor
        } else if (block.chainid == 97) {
            eAddr1 = Addresses.TESTNET_DEV;
            eAddr2 = Addresses.TESTNET_MARKETING;
            eAddr3 = Addresses.TESTNET_TEAM;
            eAddr4 = Addresses.TESTNET_ADVISOR;
        } else {
            eAddr1 = Addresses.MAINNET_DEV;
            eAddr2 = Addresses.MAINNET_MARKETING;
            eAddr3 = Addresses.MAINNET_TEAM;
            eAddr4 = Addresses.MAINNET_ADVISOR;
        }
        
        balanceOf[DEVw_mv] = 96_000_000 * 10**decimals;
        balanceOf[address(this)] = 4_000_000 * 10**decimals;
        
        emit Transfer(address(0), DEVw_mv, 96_000_000 * 10**decimals);
        emit Transfer(address(0), address(this), 4_000_000 * 10**decimals);
    }
    
    function distributeInitialAllocations() external onlyOwner {
        require(!initialDistributionCompleted, "Dist completed");
        require(balanceOf[address(this)] >= Tot_dist, "Contract balance low");
        
        initialDistributionCompleted = true;
        
        if (Mw_tng != address(0) && Mw_tng != DEVw_mv && Mrkt_alloc > 0) {
            balanceOf[address(this)] -= Mrkt_alloc;
            balanceOf[Mw_tng] += Mrkt_alloc;
            emit Transfer(address(this), Mw_tng, Mrkt_alloc);
            emit DistributionSent(Mw_tng, Mrkt_alloc);
        }
        
        if (Tw_trz_hdn != address(0) && Tw_trz_hdn != DEVw_mv && T_alloc > 0) {
            balanceOf[address(this)] -= T_alloc;
            balanceOf[Tw_trz_hdn] += T_alloc;
            emit Transfer(address(this), Tw_trz_hdn, T_alloc);
            emit DistributionSent(Tw_trz_hdn, T_alloc);
        }
        
        if (Aw_trzV != address(0) && Aw_trzV != DEVw_mv && Adv_alloc > 0) {
            balanceOf[address(this)] -= Adv_alloc;
            balanceOf[Aw_trzV] += Adv_alloc;
            emit Transfer(address(this), Aw_trzV, Adv_alloc);
            emit DistributionSent(Aw_trzV, Adv_alloc);
        }
        
        emit InitialDistributionCompleted(Tot_dist);
    }
    
    function getLiquidityPairAddress(address pairedToken) external view returns (address pairAddress) {
        require(pairedToken != address(0), "Invalid token");
        require(pairedToken != address(this), "Cannot pair self");
        pairAddress = IPancakeFactory(pncswpFactory).getPair(address(this), pairedToken);
    }
    
    function setLiquidityPair(address pair, bool status) external onlyOwner whenPairsNotLocked {
        require(pair != address(0), "Invalid pair");
        isLiquidityPair[pair] = status;
        emit LiquidityPairUpdated(pair, status);
    }
    
    function setLiquidityPairBatch(address[] calldata pairs, bool status) external onlyOwner whenPairsNotLocked {
        for (uint256 i = 0; i < pairs.length; i++) {
            if (pairs[i] != address(0)) {
                isLiquidityPair[pairs[i]] = status;
                emit LiquidityPairUpdated(pairs[i], status);
            }
        }
    }
    
    function lockLiquidityPairsForever() external onlyOwner whenPairsNotLocked {
        liquidityPairsLocked = true;
        emit LiquidityPairsLocked();
    }
    
    function isExemptAddress(address account) public view returns (bool) {
        return account == owner ||
               account == address(this) ||
               account == eAddr1 ||
               account == eAddr2 ||
               account == eAddr3 ||
               account == eAddr4 ||
               account == pncswpRouter ||
               account == pncswpFactory;
    }
    
    function isExemptSlot(address account) public view returns (bool) {
        // Special case for Hardhat tests (chainid 31337):
        // Owner is set to all exempt slots during initialization for simplified testing,
        // but should not trigger "exempt slot to normal" restrictions
        // This allows owner to perform setup operations without the 100 token limit and 24h cooldown
        if (block.chainid == 31337 && account == owner) {
            return false;
        }
        
        return account == eAddr1 ||
               account == eAddr2 ||
               account == eAddr3 ||
               account == eAddr4;
    }
    
    function updateExemptSlots(address[4] memory slots) external onlyOwner whenSlotsNotLocked {
        eAddr1 = slots[0];
        eAddr2 = slots[1];
        eAddr3 = slots[2];
        eAddr4 = slots[3];
        
        emit ExemptSlotsUpdated(slots);
    }
    
    function lockExemptSlotsForever() external onlyOwner whenSlotsNotLocked {
        exemptSlotsLocked = true;
        emit ExemptSlotsLocked();
    }
    
    function updateDEXAddresses(address router, address factory) external onlyOwner {
        require(router != address(0), "Router zero");
        require(factory != address(0), "Factory zero");
        
        pncswpRouter = router;
        pncswpFactory = factory;
        
        emit DEXAddressesUpdated(router, factory);
    }
    
    function isPaused() public view returns (bool) {
        return block.timestamp < pausedUntil;
    }
    
    function pause() external onlyOwner {
        require(pausedUntil <= block.timestamp, "Paused");
        pausedUntil = block.timestamp + PAUSE_DURATION;
        emit Paused(pausedUntil);
    }
    
    function setBlacklist(address account, bool status) external onlyOwner {
        require(account != owner, "No owner");
        require(account != address(this), "No contract");
        require(account != address(0), "No zero");
        
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
        require(currentAllowance >= amount, "Low allowance");
        
        unchecked {
            allowance[from][msg.sender] = currentAllowance - amount;
        }
        
        return _transfer(from, to, amount);
    }
    
    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(from != address(0), "From zero");
        require(to != address(0), "To zero");
        require(balanceOf[from] >= amount, "Low balance");
        
        bool fromExempt = isExemptAddress(from);
        bool toExempt = isExemptAddress(to);
        bool fromExemptSlot = isExemptSlot(from);
        bool isRouterOrFactory = (from == pncswpRouter || from == pncswpFactory);
        
        if (!fromExempt && isLiquidityPair[to]) {
            revert("Normal users cannot add liquidity directly");
        }
        
        if (!toExempt && isLiquidityPair[from] && msg.sender != pncswpRouter) {
            revert("Normal users cannot remove liquidity directly");
        }
        
        bool isNormalTransaction = !fromExempt || !toExempt;
        bool isExemptSlotToNormal = fromExemptSlot && !toExempt;
        
        if (isNormalTransaction) {
            require(!isPaused(), "Paused");
        }
        
        if (!fromExempt) {
            require(!isBlacklisted[from], "Blacklisted");
        }
        if (!toExempt) {
            require(!isBlacklisted[to], "Blacklisted");
        }
        
        if (!fromExempt) {
            require(block.timestamp >= tradingEnabledTime, "Locked 48h");
        }
        
        if (isExemptSlotToNormal) {
            require(amount <= MAX_EXEMPT_TO_NORMAL, "Max 100");
            
            uint256 lastExemptTx = lastExemptToNormalTime[from];
            if (lastExemptTx != 0) {
                require(
                    block.timestamp >= lastExemptTx + EXEMPT_TO_NORMAL_COOLDOWN,
                    "Wait 24h"
                );
            }
            
            uint256 recipientBalance = balanceOf[to];
            // Use same calculation as actual transfer: amount - burnFee - ownerFee
            require(
                recipientBalance + (amount - (amount * BURN_FEE / FEE_DENOMINATOR) - (amount * OWNER_FEE / FEE_DENOMINATOR)) <= MAX_WALLET,
                "Max wallet 4k"
            );
        }
        else if (isNormalTransaction) {
            require(amount <= MAX_TRANSACTION, "Max 2000");
            
            if (!toExempt) {
                uint256 recipientBalance = balanceOf[to];
                // Use same calculation as actual transfer: amount - burnFee - ownerFee
                require(
                    recipientBalance + (amount - (amount * BURN_FEE / FEE_DENOMINATOR) - (amount * OWNER_FEE / FEE_DENOMINATOR)) <= MAX_WALLET,
                    "Max wallet 4k"
                );
                
                // 2h Cooldown check for recipient ONLY when sender is Router/Factory
                // Exempt Slots have their own 24h cooldown check
                if (isRouterOrFactory) {
                    uint256 lastRx = lastTransactionTime[to];
                    if (lastRx != 0) {
                        require(
                            block.timestamp >= lastRx + COOLDOWN_PERIOD,
                            "Wait 2h"
                        );
                    }
                }
            }
            
            if (!fromExempt) {
                uint256 lastTx = lastTransactionTime[from];
                if (lastTx != 0) {
                    require(
                        block.timestamp >= lastTx + COOLDOWN_PERIOD,
                        "Wait 2h"
                    );
                }
            }
        }
        
        if (fromExempt && toExempt) {
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
        }
        
        if (!fromExempt) {
            lastTransactionTime[from] = block.timestamp;
        }
        
        // Update recipient's lastTransactionTime only for Router/Factory transactions
        if (!toExempt && isNormalTransaction && isRouterOrFactory) {
            lastTransactionTime[to] = block.timestamp;
        }
        
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
        require(currentAllowance >= subtractedValue, "Low allowance");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }
        return true;
    }
    
    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "From zero");
        require(spender != address(0), "To zero");
        
        allowance[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }
    
    function withdrawCirculationTokens(uint256 amount) external onlyOwner {
        require(balanceOf[address(this)] >= amount, "Low balance");
        
        unchecked {
            balanceOf[address(this)] -= amount;
            balanceOf[owner] += amount;
        }
        
        emit Transfer(address(this), owner, amount);
    }
    
    function burn(uint256 amount) external onlyOwner {
        require(balanceOf[msg.sender] >= amount, "Low balance");
        
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
        slots[0] = eAddr1;
        slots[1] = eAddr2;
        slots[2] = eAddr3;
        slots[3] = eAddr4;
        router = pncswpRouter;
        factory = pncswpFactory;
        slotsLocked = exemptSlotsLocked;
    }
    
    function getDistributionAddresses() external view returns (
        address devWallet,
        address marketingWallet,
        address teamWallet,
        address advisorWallet
    ) {
        return (DEVw_mv, Mw_tng, Tw_trz_hdn, Aw_trzV);
    }
    
    function rescueTokens(address tokenAddress, uint256 amount) external onlyOwner nonReentrant {
        require(tokenAddress != address(0), "Invalid token");
        require(tokenAddress != address(this), "No rescue KCY1");
        
        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(owner, amount), "Rescue failed");
        
        emit EmergencyTokensRescued(tokenAddress, amount);
    }
    
    receive() external payable {}
    
    function withdrawBNB() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No BNB");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "BNB failed");
        
        emit BNBWithdrawn(balance);
    }
}