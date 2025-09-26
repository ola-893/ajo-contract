// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./AjoInterfaces.sol";

contract AjoMembers is IAjoMembers, Ownable, Initializable {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
    
    mapping(address => Member) private members;
    mapping(uint256 => address) public ajoQueuePositions;
    mapping(address => uint256) public lockedCollateralBalances;
    mapping(uint256 => address) public guarantorAssignments;
    address[] private activeAjoMembersList;
    
    address public ajoCore;
    address public ajoCollateral;
    address public ajoPayments;
    
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
        address _ajoCore,
        address _usdc,
        address _hbar
    ) external override initializer {
        require(_ajoCore != address(0), "Invalid AjoCore address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_hbar != address(0), "Invalid HBAR address");
        
        // ADD THIS LINE:
        _transferOwnership(msg.sender);
        
        ajoCore = _ajoCore;
        USDC = IERC20(_usdc);
        HBAR = IERC20(_hbar);
    }
    
    // ============ CONTRACT SETUP ============
    
    function setContractAddresses(
        address _ajoCollateral, 
        address _ajoPayments
    ) external override onlyOwner {
        ajoCollateral = _ajoCollateral;
        ajoPayments = _ajoPayments;
    }

    // ============ CORE MEMBER FUNCTIONS ============
    
    function joinAjo(PaymentToken tokenChoice) external override {
        require(msg.sender == ajoCore, "Only AjoCore can add members");
        // This function is called by AjoCore after it has prepared the member data
        // The actual member addition is handled through addMember function
    }
    
    function exitAjo() external override {
        require(msg.sender == ajoCore, "Only AjoCore can remove members");
        // This function is called by AjoCore
        // The actual member removal is handled through removeMember function
    }
    
    // ============ VIEW FUNCTIONS - MEMBER INFORMATION ============
    
    function getMember(address member) external view override returns (Member memory) {
        return members[member];
    }
    
    function getTotalActiveMembers() external view override returns (uint256) {
        return activeAjoMembersList.length;
    }
    
    function getMemberInfo(address member) 
        external 
        view 
        override
        returns (
            Member memory memberInfo, 
            uint256 pendingPenalty,
            uint256 effectiveVotingPower
        ) 
    {
        memberInfo = members[member];
        // pendingPenalty and effectiveVotingPower would be calculated by other contracts
        pendingPenalty = 0;
        effectiveVotingPower = 0;
    }
    
    function getQueueInfo(address member) 
        external 
        view 
        override
        returns (
            uint256 position, 
            uint256 estimatedCyclesWait
        ) 
    {
        Member memory memberInfo = members[member];
        position = memberInfo.queueNumber;
        estimatedCyclesWait = 0; // Placeholder - should be calculated by AjoCore
    }
    
    function getContractStats() 
        external 
        view 
        override
        returns (
            uint256 totalMembers,
            uint256 activeMembers,
            uint256 totalCollateralUSDC,
            uint256 totalCollateralHBAR,
            uint256 contractBalanceUSDC,
            uint256 contractBalanceHBAR,
            uint256 currentQueuePosition,
            PaymentToken activeToken
        ) 
    {
        // Real member counts
        activeMembers = activeAjoMembersList.length;
        totalMembers = activeMembers;
        
        // Calculate real collateral balances by checking individual member balances
        totalCollateralUSDC = 0;
        totalCollateralHBAR = 0;
        
        for (uint256 i = 0; i < activeMembers; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            
            if (member.preferredToken == PaymentToken.USDC) {
                totalCollateralUSDC += member.lockedCollateral;
            } else {
                totalCollateralHBAR += member.lockedCollateral;
            }
        }
        
        // Get real contract balances using the token contracts
        if (address(USDC) != address(0)) {
            if (ajoCollateral != address(0)) {
                contractBalanceUSDC += USDC.balanceOf(ajoCollateral);
            }
            if (ajoPayments != address(0)) {
                contractBalanceUSDC += USDC.balanceOf(ajoPayments);
            }
            if (ajoCore != address(0)) {
                contractBalanceUSDC += USDC.balanceOf(ajoCore);
            }
        }
        
        if (address(HBAR) != address(0)) {
            if (ajoCollateral != address(0)) {
                contractBalanceHBAR += HBAR.balanceOf(ajoCollateral);
            }
            if (ajoPayments != address(0)) {
                contractBalanceHBAR += HBAR.balanceOf(ajoPayments);
            }
            if (ajoCore != address(0)) {
                contractBalanceHBAR += HBAR.balanceOf(ajoCore);
            }
        }
        
        // Calculate real current queue position
        currentQueuePosition = 0;
        for (uint256 i = 0; i < activeMembers; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            if (member.queueNumber > currentQueuePosition) {
                currentQueuePosition = member.queueNumber;
            }
        }
        
        // Default to USDC
        activeToken = PaymentToken.USDC;
    }
    
    // ============ MEMBER MANAGEMENT FUNCTIONS ============
    
    function addMember(address member, Member memory memberData) external override onlyAjoCore {
        require(!members[member].isActive, "Member already exists");
        
        members[member] = memberData;
        ajoQueuePositions[memberData.queueNumber] = member;
        lockedCollateralBalances[member] = memberData.lockedCollateral;
        activeAjoMembersList.push(member);
        
        // Set up guarantor relationship
        if (memberData.guarantor != address(0)) {
            members[memberData.guarantor].guaranteePosition = memberData.queueNumber;
            guarantorAssignments[memberData.queueNumber] = memberData.guarantor;
            emit GuarantorAssigned(
                member, 
                memberData.guarantor, 
                memberData.queueNumber, 
                members[memberData.guarantor].queueNumber
            );
        }
        
        emit MemberJoined(
            member, 
            memberData.queueNumber, 
            memberData.lockedCollateral, 
            memberData.preferredToken
        );
    }
    
    function removeMember(address member) external override onlyAjoCore {
        require(members[member].isActive, "Member not found");
        
        members[member].isActive = false;
        lockedCollateralBalances[member] = 0;
        _removeFromActiveList(member);
        
        emit MemberRemoved(member);
    }
    
    function updateMember(address member, Member memory memberData) external override onlyAjoCore {
        require(members[member].isActive, "Member not found");
        
        members[member] = memberData;
        lockedCollateralBalances[member] = memberData.lockedCollateral;
        
        emit MemberUpdated(member);
    }
    
    // ============ ADDITIONAL MEMBER MANAGEMENT FUNCTIONS ============
    
    function updateCollateral(address member, uint256 newAmount) external override onlyAjoCore {
        lockedCollateralBalances[member] = newAmount;
        members[member].lockedCollateral = newAmount;
    }
    
    function addPastPayment(address member, uint256 payment) external override onlyAjoCore {
        members[member].pastPayments.push(payment);
    }
    
    function updateLastPaymentCycle(address member, uint256 cycle) external override onlyAjoCore {
        members[member].lastPaymentCycle = cycle;
    }
    
    function incrementDefaultCount(address member) external override onlyAjoCore {
        members[member].defaultCount++;
    }
    
    function updateTotalPaid(address member, uint256 amount) external override onlyAjoCore {
        members[member].totalPaid += amount;
    }
    
    function markPayoutReceived(address member) external override onlyAjoCore {
        members[member].hasReceivedPayout = true;
    }
    
    function updateReputation(address member, uint256 newReputation) external override onlyAjoCore {
        members[member].reputationScore = newReputation;
    }
    
    // ============ ADDITIONAL VIEW FUNCTIONS ============
    
    function isMember(address member) external view override returns (bool) {
        return members[member].isActive;
    }
    
    function getActiveMembersList() external view override returns (address[] memory) {
        return activeAjoMembersList;
    }
    
    function getQueuePosition(uint256 queueNumber) external view override returns (address) {
        return ajoQueuePositions[queueNumber];
    }
    
    function getGuarantorForPosition(uint256 position) external view override returns (address) {
        return guarantorAssignments[position];
    }
    
    function getLockedCollateral(address member) external view override returns (uint256) {
        return lockedCollateralBalances[member];
    }
    
    function getMemberAtIndex(uint256 index) external view override returns (address) {
        require(index < activeAjoMembersList.length, "Index out of bounds");
        return activeAjoMembersList[index];
    }
    
    // For interface compatibility
    function activeMembersList(uint256 index) external view override returns (address) {
        require(index < activeAjoMembersList.length, "Index out of bounds");
        return activeAjoMembersList[index];
    }
    
    // For interface compatibility
    function queuePositions(uint256 position) external view override returns (address) {
        return ajoQueuePositions[position];
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _removeFromActiveList(address member) internal {
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            if (activeAjoMembersList[i] == member) {
                activeAjoMembersList[i] = activeAjoMembersList[activeAjoMembersList.length - 1];
                activeAjoMembersList.pop();
                break;
            }
        }
    }
}