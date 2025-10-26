// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../core/LockableContract.sol";
import "../interfaces/AjoInterfaces.sol";

contract AjoMembers is IAjoMembers, Ownable, Initializable, LockableContract {
    
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
        _transferOwnership(address(1));
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
        
        _transferOwnership(msg.sender);
        
        ajoCore = _ajoCore;
        USDC = IERC20(_usdc);
        HBAR = IERC20(_hbar);
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
     * @dev Set contract addresses for balance checking
     */
    function setContractAddresses(address _ajoCollateral, address _ajoPayments) external onlyOwner onlyDuringSetup {
        ajoCollateral = _ajoCollateral;
        ajoPayments = _ajoPayments;
    }
    
    /**
     * @dev Verify setup for AjoMembers
     */
    function verifySetup() external view override returns (bool isValid, string memory reason) {
        if (ajoCore == address(0)) {
            return (false, "AjoCore not set");
        }
        if (ajoCollateral == address(0)) {
            return (false, "AjoCollateral not set");
        }
        if (ajoPayments == address(0)) {
            return (false, "AjoPayments not set");
        }
        return (true, "Setup is valid");
    }
    
    // ============ VIEW FUNCTIONS - MEMBER INFORMATION (IAjoMembers) ============
    
    function getMember(address member) external view override returns (Member memory) {
        return members[member];
    }
    
    /**
     * @dev Get total active members count
     * FIXED: Counts only members with isActive = true
     */
    function getTotalActiveMembers() external view override returns (uint256) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            if (members[memberAddr].isActive) {
                count++;
            }
        }
        
        return count;
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
        
    
        estimatedCyclesWait = memberInfo.joinedCycle;
    }
    
    /**
     * @dev Get contract statistics
     * FIXED: Counts only ACTIVE members
     */
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
        // CRITICAL FIX: Count and sum only ACTIVE members
        totalCollateralUSDC = 0;
        totalCollateralHBAR = 0;
        activeMembers = 0;
        
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            
            // Only count if member is actually active
            if (member.isActive) {
                activeMembers++;
                
                if (member.preferredToken == PaymentToken.USDC) {
                    totalCollateralUSDC += member.lockedCollateral;
                } else {
                    totalCollateralHBAR += member.lockedCollateral;
                }
            }
        }
        
        totalMembers = activeMembers; // For simplicity
        
        // Get contract balances
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
        
        // Find highest queue position among ACTIVE members only
        currentQueuePosition = 0;
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            
            if (member.isActive && member.queueNumber > currentQueuePosition) {
                currentQueuePosition = member.queueNumber;
            }
        }
        
        activeToken = PaymentToken.USDC;
    }
    
    // ============ NEW FRONTEND VIEW FUNCTIONS ============
    
    /**
    * @dev Get all members details
    * FIXED: Initialize array first, then override with batch results
    */
    function getAllMembersDetails() external view override returns (MemberDetails[] memory) {
        // Count active members first
        uint256 activeCount = 0;
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            if (members[activeAjoMembersList[i]].isActive) {
                activeCount++;
            }
        }
        
        // Build array with only active members
        MemberDetails[] memory details = new MemberDetails[](activeCount);
        address[] memory activeAddresses = new address[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            if (members[memberAddr].isActive) {
                activeAddresses[index] = memberAddr;
                index++;
            }
        }
        
        // CRITICAL FIX: Initialize with default false values
        bool[] memory paymentStatuses = new bool[](activeCount);
        
        // Try to get actual payment statuses
        if (ajoPayments != address(0) && activeCount > 0) {
            try IAjoPayments(ajoPayments).batchCheckPaymentStatus(activeAddresses) returns (bool[] memory statuses) {
                // Verify we got the right number of results
                if (statuses.length == activeCount) {
                    paymentStatuses = statuses;
                }
                // If lengths don't match, keep the default false array
            } catch {
                // If call fails, keep the default false array
            }
        }
        
        // Build details array with payment statuses
        for (uint256 i = 0; i < activeCount; i++) {
            address memberAddr = activeAddresses[i];
            Member memory member = members[memberAddr];
            
            details[i] = MemberDetails({
                userAddress: memberAddr,
                hasReceivedPayout: member.hasReceivedPayout,
                queuePosition: member.queueNumber,
                hasPaidThisCycle: paymentStatuses[i],
                collateralLocked: member.lockedCollateral,
                guarantorAddress: member.guarantor,
                guarantorQueuePosition: member.guarantor != address(0) 
                    ? members[member.guarantor].queueNumber 
                    : 0,
                totalPaid: member.totalPaid,
                defaultCount: member.defaultCount,
                reputationScore: member.reputationScore
            });
        }
        
        return details;
    }
    
    /**
     * @dev Get paginated member details for large member lists
     * CRITICAL FIX: Uses AjoPayments.hasMemberPaidInCycle() for accuracy
     */
    function getMembersDetailsPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        override 
        returns (
            MemberDetails[] memory details,
            bool hasMore
        ) 
    {
        uint256 memberCount = activeAjoMembersList.length;
        
        if (offset >= memberCount) {
            return (new MemberDetails[](0), false);
        }
        
        uint256 end = offset + limit;
        if (end > memberCount) {
            end = memberCount;
        }
        
        uint256 resultCount = end - offset;
        details = new MemberDetails[](resultCount);
        
        for (uint256 i = 0; i < resultCount; i++) {
            address memberAddr = activeAjoMembersList[offset + i];
            Member memory member = members[memberAddr];
            
            // CRITICAL FIX: Query AjoPayments for payment status
            bool hasPaidThisCycle = false;
            if (ajoPayments != address(0)) {
                try IAjoPayments(ajoPayments).hasMemberPaidInCycle(memberAddr) returns (bool paid) {
                    hasPaidThisCycle = paid;
                } catch {
                    hasPaidThisCycle = false;
                }
            }
            
            details[i] = MemberDetails({
                userAddress: memberAddr,
                hasReceivedPayout: member.hasReceivedPayout,
                queuePosition: member.queueNumber,
                hasPaidThisCycle: hasPaidThisCycle,
                collateralLocked: member.lockedCollateral,
                guarantorAddress: member.guarantor,
                guarantorQueuePosition: member.guarantor != address(0) 
                    ? members[member.guarantor].queueNumber 
                    : 0,
                totalPaid: member.totalPaid,
                defaultCount: member.defaultCount,
                reputationScore: member.reputationScore
            });
        }
        
        hasMore = end < memberCount;
    }
    
    /**
     * @dev Get comprehensive activity summary for a member - for profile pages
     * @param member Address of the member
     * @return activity Complete activity summary
     */
    function getMemberActivity(address member) external view override returns (MemberActivity memory activity) {
        Member memory memberInfo = members[member];
        
        if (!memberInfo.isActive) {
            return activity; // Return empty struct
        }
        
        uint256 currentCycle = _getCurrentCycle();
        
        // Calculate cycles participated (from join to now)
        activity.cyclesParticipated = currentCycle >= memberInfo.joinedCycle 
            ? currentCycle - memberInfo.joinedCycle + 1 
            : 0;
        
        // Payments completed = length of past payments array
        activity.paymentsCompleted = memberInfo.pastPayments.length;
        
        // Payments missed = cycles participated - payments completed
        activity.paymentsMissed = activity.cyclesParticipated > activity.paymentsCompleted 
            ? activity.cyclesParticipated - activity.paymentsCompleted 
            : 0;
        
        // Total paid = sum of past payments
        activity.totalPaid = 0;
        for (uint256 i = 0; i < memberInfo.pastPayments.length; i++) {
            activity.totalPaid += memberInfo.pastPayments[i];
        }
        
        // Total received = memberInfo.totalPaid (this is actually total received from distributePayout)
        activity.totalReceived = memberInfo.totalPaid;
        
        // Net position = received - paid
        if (activity.totalReceived >= activity.totalPaid) {
            activity.netPosition = activity.totalReceived - activity.totalPaid;
        } else {
            activity.netPosition = 0; // Could make this int256 to show negative
        }
        
        // Consecutive payments = count from most recent backwards
        activity.consecutivePayments = 0;
        if (memberInfo.lastPaymentCycle > 0) {
            uint256 expectedCycle = currentCycle;
            for (uint256 i = 0; i < activity.paymentsCompleted; i++) {
                if (memberInfo.lastPaymentCycle >= expectedCycle - i) {
                    activity.consecutivePayments++;
                } else {
                    break;
                }
            }
        }
        
        // Last active timestamp (using last payment cycle as proxy)
        activity.lastActiveTimestamp = memberInfo.lastPaymentCycle > 0 
            ? block.timestamp 
            : 0; // Could be more accurate with actual timestamps
    }
    
    /**
     * @dev Get members filtered by active status
     * @param isActive Filter for active (true) or inactive (false) members
     * @return Array of member addresses
     */
    function getMembersByStatus(bool isActive) external view override returns (address[] memory) {
        if (isActive) {
            // Return filtered active members
            uint256 count = 0;
            for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
                if (members[activeAjoMembersList[i]].isActive) {
                    count++;
                }
            }
            
            address[] memory activeMembersOnly = new address[](count);
            uint256 index = 0;
            for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
                address memberAddr = activeAjoMembersList[i];
                if (members[memberAddr].isActive) {
                    activeMembersOnly[index] = memberAddr;
                    index++;
                }
            }
            return activeMembersOnly;
        }
        
        // For inactive members, would need to track separately
        // For now, return empty array
        return new address[](0);
    }
    
    /**
     * @dev Get members who need to make payment this cycle
     * CRITICAL FIX: Uses getCurrentCycleDashboard's unpaid members
     * @return Array of member addresses who haven't paid yet
     */
    function getMembersNeedingPayment() external view override returns (address[] memory) {
        if (ajoPayments == address(0)) {
            return new address[](0);
        }
        
        // Use the dashboard function - it's verified to be accurate
        try IAjoPayments(ajoPayments).getCurrentCycleDashboard() returns (
            CycleDashboard memory dashboard
        ) {
            return dashboard.membersUnpaid;
        } catch {
            // Fallback: return empty array
            return new address[](0);
        }
    }
    
    /**
     * @dev Get members who have defaulted (have default count > 0)
     * @return Array of member addresses with defaults
     */
    function getMembersWithDefaults() external view override returns (address[] memory) {
        uint256 count = 0;
        
        // First pass: count
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            if (members[memberAddr].defaultCount > 0) {
                count++;
            }
        }
        
        // Second pass: populate
        address[] memory defaulters = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            if (members[memberAddr].defaultCount > 0) {
                defaulters[index] = memberAddr;
                index++;
            }
        }
        
        return defaulters;
    }
    
   /**
    * @dev Get top members by reputation score - for leaderboards
    * @param limit Maximum number of members to return
    * @return members_ Array of member addresses
    * @return reputations Array of corresponding reputation scores
    */
    function getTopMembersByReputation(uint256 limit) 
        external 
        view 
        override 
        returns (
            address[] memory members_,
            uint256[] memory reputations
        ) 
    {
        uint256 memberCount = activeAjoMembersList.length;
        if (limit > memberCount) {
            limit = memberCount;
        }
        
        // Create temporary array of all members with reputation
        address[] memory allMembers = new address[](memberCount);
        uint256[] memory allReputations = new uint256[](memberCount);
        
        for (uint256 i = 0; i < memberCount; i++) {
            address memberAddr = activeAjoMembersList[i];
            allMembers[i] = memberAddr;
            allReputations[i] = members[memberAddr].reputationScore;
        }
        
        // Simple bubble sort for top N (good enough for small lists)
        // For production, consider implementing a more efficient sort
        for (uint256 i = 0; i < limit && i < memberCount; i++) {
            for (uint256 j = i + 1; j < memberCount; j++) {
                if (allReputations[j] > allReputations[i]) {
                    // Swap reputations
                    uint256 tempRep = allReputations[i];
                    allReputations[i] = allReputations[j];
                    allReputations[j] = tempRep;
                    
                    // Swap addresses
                    address tempAddr = allMembers[i];
                    allMembers[i] = allMembers[j];
                    allMembers[j] = tempAddr;
                }
            }
        }
        
        // Return top N
        members_ = new address[](limit);
        reputations = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            members_[i] = allMembers[i];
            reputations[i] = allReputations[i];
        }
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
    
    /**
     * @dev Get active members list - FILTERED VERSION
     * FIXED: Returns only members with isActive = true
     */
    function getActiveMembersList() external view returns (address[] memory) {
        // First pass: count active members
        uint256 activeCount = 0;
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            if (members[activeAjoMembersList[i]].isActive) {
                activeCount++;
            }
        }
        
        // Second pass: build filtered array
        address[] memory filteredList = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            if (members[memberAddr].isActive) {
                filteredList[index] = memberAddr;
                index++;
            }
        }
        
        return filteredList;
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
    
    // For interface compatibility - maps to getActiveMembersList()[index]
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
    
    function addPastPayment(address member, uint256 payment) external {
        members[member].pastPayments.push(payment);
    }
    
    function updateLastPaymentCycle(address member, uint256 cycle) external {
        members[member].lastPaymentCycle = cycle;
    }
    
    function incrementDefaultCount(address member) external onlyAjoCore {
        members[member].defaultCount++;
    }
    
    function updateTotalPaid(address member, uint256 amount) external {
        members[member].totalPaid += amount;
    }
    
    function markPayoutReceived(address member) external {
        members[member].hasReceivedPayout = true;
    }
    
    // ============ INTERNAL HELPER FUNCTIONS ============
    
    function _removeFromActiveList(address member) internal {
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            if (activeAjoMembersList[i] == member) {
                activeAjoMembersList[i] = activeAjoMembersList[activeAjoMembersList.length - 1];
                activeAjoMembersList.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Internal helper to get current cycle from AjoPayments contract
     * @return Current cycle number
     */
    function _getCurrentCycle() internal view returns (uint256) {
        if (ajoPayments == address(0)) {
            return 1;
        }
        
        // Call getCurrentCycle on AjoPayments
        try IAjoPayments(ajoPayments).getCurrentCycle() returns (uint256 cycle) {
            return cycle;
        } catch {
            return 1;
        }
    }
    
    // ============ EVENTS ============
    
    // Events are defined in the interface
}