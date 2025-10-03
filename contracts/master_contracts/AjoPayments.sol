// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../core/LockableContract.sol";
import  "../interfaces/AjoInterfaces.sol";

contract AjoPayments is IAjoPayments, ReentrancyGuard, Ownable, Initializable, LockableContract {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
    address public ajoCore;
    IAjoMembers public membersContract;
    IAjoCollateral public collateralContract;
    
    uint256 public constant DEFAULT_PENALTY_RATE = 500; // 5% monthly penalty
    uint256 public penaltyRate;
    
    uint256 public currentCycle;
    uint256 public nextPayoutPosition;
    PaymentToken public activePaymentToken;
    
    mapping(PaymentToken => TokenConfig) public tokenConfigs;
    mapping(uint256 => PayoutRecord) public payouts;
    mapping(address => uint256) public pendingPenalties;
    
    // Events specific to this contract
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    // ============ CONSTRUCTOR (for master copy) ============
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER (for proxy instances) ============
    function initialize(
        address _usdc, 
        address _hbar, 
        address _ajoCore, 
        address _membersContract,
        address _collateralContract
    ) external override initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_hbar != address(0), "Invalid HBAR address");
        require(_ajoCore != address(0), "Invalid AjoCore address");
        require(_membersContract != address(0), "Invalid members contract");
        require(_collateralContract != address(0), "Invalid collateral contract");
        
        _transferOwnership(msg.sender);
        
        USDC = IERC20(_usdc);
        HBAR = IERC20(_hbar);
        ajoCore = _ajoCore;
        membersContract = IAjoMembers(_membersContract);
        collateralContract = IAjoCollateral(_collateralContract);
        
        // Rest of initialization...
        penaltyRate = DEFAULT_PENALTY_RATE;
        currentCycle = 1;
        nextPayoutPosition = 1;
        activePaymentToken = PaymentToken.USDC;
        
        // Initialize token configurations
        tokenConfigs[PaymentToken.USDC] = TokenConfig({
            monthlyPayment: 50e6,
            isActive: true
        });
        
        tokenConfigs[PaymentToken.HBAR] = TokenConfig({
            monthlyPayment: 1000e8,
            isActive: true
        });
    }
    
     /**
     * @dev Set AjoCore address - only works during setup phase
     * @param _ajoCore Address of the AjoCore contract
     */
    function setAjoCore(address _ajoCore) external onlyOwner onlyDuringSetup {
        require(_ajoCore != address(0), "Cannot set zero address");
        require(_ajoCore != ajoCore, "Already set to this address");
        
        address oldCore = ajoCore;
        ajoCore = _ajoCore;
        
        emit AjoCoreUpdated(oldCore, _ajoCore);
    }
    
    /**
     * @dev Verify setup for AjoMembers
     */
    function verifySetup() external view override returns (bool isValid, string memory reason) {
        if (ajoCore == address(0)) {
            return (false, "AjoCore not set");
        }
        return (true, "Setup is valid");
    }
    
    // ============ CORE PAYMENT FUNCTIONS (IAjoPayments) ============
    
    function distributePayout() external override nonReentrant {
        require(msg.sender == ajoCore, "Only AjoCore");
        
        // Find next recipient
        address recipient = getNextRecipient();
        require(recipient != address(0), "No eligible recipient");
        
        Member memory recipientMember = membersContract.getMember(recipient);
        uint256 payoutAmount = calculatePayout();
        
        // Distribute payout
        _distributePayout(recipient, payoutAmount, recipientMember.preferredToken);
        
        nextPayoutPosition++;
    }
    
    function handleDefault(address defaulter) external override onlyAjoCore {
        Member memory member = membersContract.getMember(defaulter);
        
        require(member.isActive, "Member not found");
        if (member.lastPaymentCycle >= currentCycle) return; // Not in default
        
        uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
        TokenConfig memory config = tokenConfigs[member.preferredToken];
        uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
        
        // Add penalty
        pendingPenalties[defaulter] += penalty;
        
        emit MemberDefaulted(defaulter, currentCycle, penalty);
    }
    
    // ============ VIEW FUNCTIONS (IAjoPayments) ============
    
    function needsToPayThisCycle(address member) external view override returns (bool) {
        Member memory memberInfo = membersContract.getMember(member);
        return memberInfo.isActive && memberInfo.lastPaymentCycle < currentCycle;
    }
    
    function getTokenConfig(PaymentToken token) external view override returns (TokenConfig memory) {
        return tokenConfigs[token];
    }
    
    // ============ PAYMENT PROCESSING FUNCTIONS ============
    
    function processPayment(address member, uint256 amount, PaymentToken token) external onlyAjoCore nonReentrant {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        Member memory memberData = membersContract.getMember(member);
        
        require(memberData.isActive, "Member not active");
        require(memberData.lastPaymentCycle < currentCycle, "Payment already made");
        
        // Calculate total payment (including any penalties)
        uint256 totalPayment = amount + pendingPenalties[member];
        
        // Transfer payment
        tokenContract.transferFrom(member, address(this), totalPayment);
        
        // Clear penalties
        pendingPenalties[member] = 0;
        
        emit PaymentMade(member, totalPayment, currentCycle, token);
    }
    
    function _distributePayout(address recipient, uint256 amount, PaymentToken token) internal {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        
        tokenContract.transfer(recipient, amount);
        
        // Update payout record
        payouts[currentCycle] = PayoutRecord({
            recipient: recipient,
            amount: amount,
            cycle: currentCycle,
            timestamp: block.timestamp
        });
        
        emit PayoutDistributed(recipient, amount, currentCycle, token);
    }
    
    // ============ CALCULATION FUNCTIONS ============

    function calculatePayout() public view returns (uint256) {
        // Get the active token configuration
        TokenConfig memory config = tokenConfigs[activePaymentToken];
        
        // Get total number of active members
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        // Payout = total members × monthly contribution
        // This is the core ROSCA principle - fixed payout regardless of available funds
        uint256 payout = config.monthlyPayment * totalMembers;
        
        return payout;
    }
    
    function getNextRecipient() public view returns (address) {
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        if (nextPayoutPosition > totalMembers) return address(0);
        
        // Get the address at the current payout position
        address candidate = address(0);
        
        // Find member at queue position
        for (uint256 i = 0; i < totalMembers; i++) {
            address memberAddr = membersContract.activeMembersList(i);
            Member memory memberInfo = membersContract.getMember(memberAddr);
            
            if (memberInfo.queueNumber == nextPayoutPosition) {
                candidate = memberAddr;
                break;
            }
        }
        
        if (candidate == address(0)) return address(0);
        
        Member memory candidateMember = membersContract.getMember(candidate);
        
        // Check if candidate is eligible (paid this cycle and is active)
        if (!candidateMember.isActive || candidateMember.lastPaymentCycle < currentCycle) {
            return address(0);
        }
        
        return candidate;
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function updatePenaltyRate(uint256 newPenaltyRate) external onlyAjoCore {
        require(newPenaltyRate <= 2000, "Penalty rate too high"); // Max 20%
        penaltyRate = newPenaltyRate;
    }
    
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external onlyAjoCore {
        tokenConfigs[token].monthlyPayment = monthlyPayment;
        tokenConfigs[token].isActive = isActive;
    }
    
    function advanceCycle() external onlyAjoCore {
        currentCycle++;
        emit CycleAdvanced(currentCycle, block.timestamp);
    }
    
    function updateNextPayoutPosition(uint256 position) external onlyAjoCore {
        nextPayoutPosition = position;
    }
    
    // ============ BATCH PROCESSING ============
    
    function batchHandleDefaults(address[] calldata defaulters) external onlyAjoCore {
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            Member memory member = membersContract.getMember(defaulter);
            
            if (member.isActive && member.lastPaymentCycle < currentCycle) {
                uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
                TokenConfig memory config = tokenConfigs[member.preferredToken];
                uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
                
                pendingPenalties[defaulter] += penalty;
                
                emit MemberDefaulted(defaulter, currentCycle, penalty);
            }
        }
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getCurrentCycle() external view returns (uint256) {
        return currentCycle;
    }
    
    function getNextPayoutPosition() external view returns (uint256) {
        return nextPayoutPosition;
    }
    
    function getActivePaymentToken() external view returns (PaymentToken) {
        return activePaymentToken;
    }
    
    function getPayout(uint256 cycle) external view returns (PayoutRecord memory) {
        return payouts[cycle];
    }
    
    function getPendingPenalty(address member) external view returns (uint256) {
        return pendingPenalties[member];
    }
    
    function getPenaltyRate() external view returns (uint256) {
        return penaltyRate;
    }
    
    function getContractBalance(PaymentToken token) external view returns (uint256) {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        return tokenContract.balanceOf(address(this));
    }
    
    function getTotalPayouts() external view returns (uint256) {
        return currentCycle > 1 ? currentCycle - 1 : 0;
    }
    
    function isPayoutReady() external view returns (bool) {
        address nextRecipient = getNextRecipient();
        return nextRecipient != address(0) && calculatePayout() > 0;
    }

    // ============ EMERGENCY FUNCTIONS ============
    
    function emergencyWithdraw(PaymentToken token) external onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        uint256 balance = tokenContract.balanceOf(address(this));
        tokenContract.transfer(ajoCore, balance);
    }
    
    function pausePayments() external onlyAjoCore {
       //pausing payments is very sensitive, so implementation is omitted for brevity
       //people that have made previous payments won't be able to get their payouts
       //until payments are resumed
    }
    
    function resumePayments() external onlyAjoCore {
        // Implementation for resuming payments after emergency
    }
}