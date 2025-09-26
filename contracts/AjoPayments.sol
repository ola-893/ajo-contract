// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./AjoInterfaces.sol";

contract AjoPayments is IAjoPayments, ReentrancyGuard, Ownable, Initializable {
    
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
        _transferOwnership(address(1)); // ADD THIS LINE
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
        
        // ADD THIS LINE:
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
    
    // ============ CORE PAYMENT FUNCTIONS ============
    
    function makePayment() external override nonReentrant {
        require(msg.sender == ajoCore, "Only AjoCore");
        // This function is called by AjoCore after validation
        // The actual payment processing is handled through processPayment
    }
    
    function processPayment(address member, uint256 amount, PaymentToken token) external override onlyAjoCore nonReentrant {
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
        
        // Update member's total paid and add to past payments
        membersContract.updateTotalPaid(member, totalPayment);
        membersContract.addPastPayment(member, totalPayment);
        
        emit PaymentMade(member, totalPayment, currentCycle, token);
        emit PaymentProcessed(member, amount, pendingPenalties[member], totalPayment);
    }
    
    function distributePayout() external override nonReentrant {
        require(msg.sender == ajoCore, "Only AjoCore");
        
        // Find next recipient
        address recipient = getNextRecipient();
        require(recipient != address(0), "No eligible recipient");
        
        Member memory recipientMember = membersContract.getMember(recipient);
        uint256 payoutAmount = calculatePayout();
        
        // Distribute payout
        _distributePayout(recipient, payoutAmount, recipientMember.preferredToken);
        
        // Mark recipient as having received payout
        membersContract.markPayoutReceived(recipient);
        
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
        
        // Increment default count
        membersContract.incrementDefaultCount(defaulter);
        
        emit MemberDefaulted(defaulter, currentCycle, penalty);
    }
    
    function batchHandleDefaults(address[] calldata defaulters) external override onlyAjoCore {
        for (uint256 i = 0; i < defaulters.length; i++) {
            address defaulter = defaulters[i];
            Member memory member = membersContract.getMember(defaulter);
            
            if (member.isActive && member.lastPaymentCycle < currentCycle) {
                uint256 cyclesMissed = currentCycle - member.lastPaymentCycle;
                TokenConfig memory config = tokenConfigs[member.preferredToken];
                uint256 penalty = (config.monthlyPayment * penaltyRate * cyclesMissed) / 10000;
                
                pendingPenalties[defaulter] += penalty;
                membersContract.incrementDefaultCount(defaulter);
                
                emit MemberDefaulted(defaulter, currentCycle, penalty);
            }
        }
    }
    
    function updateTokenConfig(
        PaymentToken token,
        uint256 monthlyPayment,
        bool isActive
    ) external override onlyAjoCore {
        tokenConfigs[token].monthlyPayment = monthlyPayment;
        tokenConfigs[token].isActive = isActive;
    }
    
    function advanceCycle() external override onlyAjoCore {
        currentCycle++;
        emit CycleAdvanced(currentCycle, block.timestamp);
    }
    
    function switchPaymentToken(PaymentToken newToken) external override onlyAjoCore {
        PaymentToken oldToken = activePaymentToken;
        activePaymentToken = newToken;
        
        emit TokenSwitched(oldToken, activePaymentToken);
    }
    
    function emergencyWithdraw(PaymentToken token) external override onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        uint256 balance = tokenContract.balanceOf(address(this));
        tokenContract.transfer(ajoCore, balance);
    }
    
    function updatePenaltyRate(uint256 newPenaltyRate) external override onlyAjoCore {
        require(newPenaltyRate <= 2000, "Penalty rate too high"); // Max 20%
        penaltyRate = newPenaltyRate;
    }
    
    function updateNextPayoutPosition(uint256 position) external override onlyAjoCore {
        nextPayoutPosition = position;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function needsToPayThisCycle(address member) external view override returns (bool) {
        Member memory memberInfo = membersContract.getMember(member);
        return memberInfo.isActive && memberInfo.lastPaymentCycle < currentCycle;
    }
    
    function getTokenConfig(PaymentToken token) external view override returns (TokenConfig memory) {
        return tokenConfigs[token];
    }
    
    function getCurrentCycle() external view override returns (uint256) {
        return currentCycle;
    }
    
    function getNextPayoutPosition() external view override returns (uint256) {
        return nextPayoutPosition;
    }
    
    function getActivePaymentToken() external view override returns (PaymentToken) {
        return activePaymentToken;
    }
    
    function getPendingPenalty(address member) external view override returns (uint256) {
        return pendingPenalties[member];
    }
    
    function getPenaltyRate() external view override returns (uint256) {
        return penaltyRate;
    }
    
    function getContractBalance(PaymentToken token) external view override returns (uint256) {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        return tokenContract.balanceOf(address(this));
    }
    
    function getTotalPayouts() external view override returns (uint256) {
        return currentCycle > 1 ? currentCycle - 1 : 0;
    }
    
    function isPayoutReady() external view override returns (bool) {
        address nextRecipient = getNextRecipient();
        return nextRecipient != address(0) && calculatePayout() > 0;
    }
    
    function getPayout(uint256 cycle) external view override returns (PayoutRecord memory) {
        return payouts[cycle];
    }
    
    function calculatePayout() public view override returns (uint256) {
        // Get the active token configuration
        TokenConfig memory config = tokenConfigs[activePaymentToken];
        
        // Get total number of active members
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        // Payout = total members × monthly contribution
        uint256 payout = config.monthlyPayment * totalMembers;
        
        return payout;
    }
    
    function getNextRecipient() public view override returns (address) {
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
    
    // ============ INTERNAL FUNCTIONS ============
    
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
}