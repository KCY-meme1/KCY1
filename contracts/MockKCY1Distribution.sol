// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockKCY1Distribution - Test Contract for Distribution
 * @dev This contract allows testing distribution with custom addresses
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

contract MockKCY1Distribution is IERC20 {
    string public constant name = "Mock KCY1 Distribution Test";
    string public constant symbol = "MKCY1";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    
    address public immutable owner;
    
    // Allow setting custom distribution addresses for testing
    address public immutable DEVw_mv;
    address public immutable Mw_tng;
    address public immutable Tw_trz_hdn;
    address public immutable Aw_trzV;
    
    uint256 private constant Mrkt_alloc = 1_500_000 * 10**18;
    uint256 private constant T_alloc = 1_000_000 * 10**18;
    uint256 private constant Adv_alloc = 1_500_000 * 10**18;
    uint256 private constant Tot_dist = 4_000_000 * 10**18;
    
    bool public initialDistributionCompleted;
    
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    
    event InitialDistributionCompleted(uint256 totalDistributed);
    event DistributionSent(address indexed recipient, uint256 amount);
    
    // Constructor accepts custom addresses for testing
    constructor(
        address _devWallet,
        address _marketingWallet,
        address _teamWallet,
        address _advisorWallet
    ) {
        owner = msg.sender;
        totalSupply = 100_000_000 * 10**decimals;
        
        // Use provided addresses
        DEVw_mv = _devWallet;
        Mw_tng = _marketingWallet;
        Tw_trz_hdn = _teamWallet;
        Aw_trzV = _advisorWallet;
        
        // Initial distribution
        balanceOf[DEVw_mv] = 96_000_000 * 10**decimals;
        balanceOf[address(this)] = 4_000_000 * 10**decimals;
        
        emit Transfer(address(0), DEVw_mv, 96_000_000 * 10**decimals);
        emit Transfer(address(0), address(this), 4_000_000 * 10**decimals);
    }
    
    function distributeInitialAllocations() external {
        require(msg.sender == owner, "Not owner");
        require(!initialDistributionCompleted, "Dist completed");
        require(balanceOf[address(this)] >= Tot_dist, "Contract balance low");
        
        initialDistributionCompleted = true;
        
        // Marketing allocation
        if (Mw_tng != address(0) && Mw_tng != DEVw_mv && Mrkt_alloc > 0) {
            balanceOf[address(this)] -= Mrkt_alloc;
            balanceOf[Mw_tng] += Mrkt_alloc;
            emit Transfer(address(this), Mw_tng, Mrkt_alloc);
            emit DistributionSent(Mw_tng, Mrkt_alloc);
        }
        
        // Team allocation
        if (Tw_trz_hdn != address(0) && Tw_trz_hdn != DEVw_mv && T_alloc > 0) {
            balanceOf[address(this)] -= T_alloc;
            balanceOf[Tw_trz_hdn] += T_alloc;
            emit Transfer(address(this), Tw_trz_hdn, T_alloc);
            emit DistributionSent(Tw_trz_hdn, T_alloc);
        }
        
        // Advisor allocation
        if (Aw_trzV != address(0) && Aw_trzV != DEVw_mv && Adv_alloc > 0) {
            balanceOf[address(this)] -= Adv_alloc;
            balanceOf[Aw_trzV] += Adv_alloc;
            emit Transfer(address(this), Aw_trzV, Adv_alloc);
            emit DistributionSent(Aw_trzV, Adv_alloc);
        }
        
        emit InitialDistributionCompleted(Tot_dist);
    }
    
    function getDistributionAddresses() external view returns (
        address devWallet,
        address marketingWallet,
        address teamWallet,
        address advisorWallet
    ) {
        return (DEVw_mv, Mw_tng, Tw_trz_hdn, Aw_trzV);
    }
    
    // Minimal ERC20 implementation for testing
    function transfer(address to, uint256 amount) public override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Low balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Low allowance");
        require(balanceOf[from] >= amount, "Low balance");
        
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) public override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
}