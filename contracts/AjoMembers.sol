// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AjoInterfaces.sol";
import "./LockableContract.sol";

contract AjoMembers is IAjoMembers,LockableContract {
    
    // ============ STATE VARIABLES ============
    
    mapping(address => Member) private members;
    mapping(uint256 => address) public ajoQueuePositions;
    mapping(address => uint256) public lockedCollateralBalances;
    mapping(uint256 => address) public guarantorAssignments;
    address[] private activeAjoMembersList;
    
    address public ajoCore;
    // Events specific to this contract
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(address _ajoCore) {
        ajoCore = _ajoCore;
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

    // ============ CORE MEMBER FUNCTIONS (IAjoMembers) ============
    
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
    
    // ============ VIEW FUNCTIONS - MEMBER INFORMATION (IAjoMembers) ============
    
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
        // For now, return 0 as placeholders - these should be calculated by AjoCore
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
        
        // Estimated cycles wait would depend on current payout position
        // This calculation should involve the payments contract
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
        activeMembers = activeAjoMembersList.length;
        totalMembers = activeMembers; // For simplicity, could track total including inactive
        
        // Other values would need to be calculated by querying other contracts
        totalCollateralUSDC = 0; // Placeholder
        totalCollateralHBAR = 0; // Placeholder
        contractBalanceUSDC = 0; // Placeholder
        contractBalanceHBAR = 0; // Placeholder
        currentQueuePosition = 0; // Placeholder
        activeToken = PaymentToken.USDC; // Placeholder
    }
    
    // ============ MEMBER MANAGEMENT FUNCTIONS ============
    
    function addMember(address member, Member memory memberData) external onlyAjoCore {
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
    
    function removeMember(address member) external onlyAjoCore {
        require(members[member].isActive, "Member not found");
        
        members[member].isActive = false;
        lockedCollateralBalances[member] = 0;
        _removeFromActiveList(member);
        
        emit MemberRemoved(member);
    }
    
    function updateMember(address member, Member memory memberData) external onlyAjoCore {
        require(members[member].isActive, "Member not found");
        
        members[member] = memberData;
        lockedCollateralBalances[member] = memberData.lockedCollateral;
        
        emit MemberUpdated(member);
    }
    
    // ============ ADDITIONAL VIEW FUNCTIONS ============
    
    function isMember(address member) external view returns (bool) {
        return members[member].isActive;
    }
    
    function getActiveMembersList() external view returns (address[] memory) {
        return activeAjoMembersList;
    }
    
    function getQueuePosition(uint256 queueNumber) external view returns (address) {
        return ajoQueuePositions[queueNumber];
    }
    
    function getGuarantorForPosition(uint256 position) external view returns (address) {
        return guarantorAssignments[position];
    }
    
    function getLockedCollateral(address member) external view returns (uint256) {
        return lockedCollateralBalances[member];
    }
    
    function getMemberAtIndex(uint256 index) external view returns (address) {
        require(index < activeAjoMembersList.length, "Index out of bounds");
        return activeAjoMembersList[index];
    }
    
    // For interface compatibility - maps to getactiveAjoMembersList()[index]
    function activeMembersList(uint256 index) external view returns (address) {
        require(index < activeAjoMembersList.length, "Index out of bounds");
        return activeAjoMembersList[index];
    }
    
    // For interface compatibility - maps to ajoQueuePositions
    function queuePositions(uint256 position) external view returns (address) {
        return ajoQueuePositions[position];
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    function updateCollateral(address member, uint256 newAmount) external onlyAjoCore {
        lockedCollateralBalances[member] = newAmount;
        members[member].lockedCollateral = newAmount;
    }
    
    function updateReputation(address member, uint256 newReputation) external onlyAjoCore {
        members[member].reputationScore = newReputation;
    }
    
    function addPastPayment(address member, uint256 payment) external onlyAjoCore {
        members[member].pastPayments.push(payment);
    }
    
    function updateLastPaymentCycle(address member, uint256 cycle) external onlyAjoCore {
        members[member].lastPaymentCycle = cycle;
    }
    
    function incrementDefaultCount(address member) external onlyAjoCore {
        members[member].defaultCount++;
    }
    
    function updateTotalPaid(address member, uint256 amount) external onlyAjoCore {
        members[member].totalPaid += amount;
    }
    
    function markPayoutReceived(address member) external onlyAjoCore {
        members[member].hasReceivedPayout = true;
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
    
    // ============ EVENTS ============
    
    //event MemberJoined(address indexed member, uint256 queueNumber, uint256 collateral, PaymentToken token);
    event MemberRemoved(address indexed member);
    event MemberUpdated(address indexed member);
    event GuarantorAssigned(address indexed member, address indexed guarantor, uint256 memberPosition, uint256 guarantorPosition);
}