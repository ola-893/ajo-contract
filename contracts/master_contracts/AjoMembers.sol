// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../interfaces/AjoInterfaces.sol";

/**
 * @title AjoMembers
 * @notice Manages Ajo group membership with HTS integration
 * @dev Tracks member data, collateral, payments, and HTS association/freeze status
 * 
 * KEY CHANGE: HTSHelper removed - this contract doesn't need HTS inheritance
 * It only tracks HTS status, doesn't perform HTS operations
 * 
 * Key Features:
 * - Tracks HTS token association status per member
 * - Tracks freeze status for defaulters
 * - Comprehensive member activity tracking
 * - Paginated queries for frontend optimization
 * - Reputation and voting power management
 * - Guarantor assignment and tracking
 * 
 * OpenZeppelin v4.9.3 Compatible
 */
contract AjoMembers is IAjoMembers, Ownable, Initializable {
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
    
    // ✅ REMOVED: address public hederaTokenService; 
    // Not needed - contract doesn't perform HTS operations
    
    mapping(address => Member) private members;
    mapping(uint256 => address) public ajoQueuePositions;
    mapping(address => uint256) public lockedCollateralBalances;
    mapping(uint256 => address) public guarantorAssignments;
    address[] private activeAjoMembersList;
    
    address public ajoCore;
    address public ajoCollateral;
    address public ajoPayments;
    
    // ============ EVENTS ============
    
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    modifier onlyAuthorizedContracts() {
        require(
            msg.sender == ajoCore || 
            msg.sender == ajoCollateral || 
            msg.sender == ajoPayments,
            "Only authorized contracts"
        );
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER ============
    
    /**
     * @notice Initialize the members contract
     * @param _ajoCore Address of AjoCore contract
     * @param _usdc USDC token address (HTS or ERC20)
     * @param _whbar WHBAR token address (HTS or ERC20)
     */
    function initialize(
        address _ajoCore,
        address _usdc,
        address _whbar
    ) external override initializer {
        require(_ajoCore != address(0), "Invalid AjoCore address");
        require(_usdc != address(0), "Invalid USDC address");
        require(_whbar != address(0), "Invalid HBAR address");
        
        _transferOwnership(msg.sender);
        
        ajoCore = _ajoCore;
        USDC = IERC20(_usdc);
        HBAR = IERC20(_whbar);
        
        // ✅ REMOVED: hederaTokenService = HTSHelper.getHtsAddress();
        // Not needed - this contract doesn't perform HTS operations
    }
    
    /**
     * @notice Set AjoCore address - only during setup phase
     * @param _ajoCore New AjoCore address
     */
    function setAjoCore(address _ajoCore) external onlyOwner {
        require(_ajoCore != address(0), "Cannot set zero address");
        require(_ajoCore != ajoCore, "Already set to this address");
        
        address oldCore = ajoCore;
        ajoCore = _ajoCore;
        
        emit AjoCoreUpdated(oldCore, _ajoCore);
    }
    
    /**
     * @notice Set contract addresses for balance checking
     * @param _ajoCollateral AjoCollateral contract address
     * @param _ajoPayments AjoPayments contract address
     */
    function setContractAddresses(
        address _ajoCollateral, 
        address _ajoPayments
    ) external override onlyOwner {
        require(_ajoCollateral != address(0), "Invalid collateral address");
        require(_ajoPayments != address(0), "Invalid payments address");
        ajoCollateral = _ajoCollateral;
        ajoPayments = _ajoPayments;
    }
    
    /**
     * @notice Verify setup for AjoMembers
     * @return isValid Whether setup is valid
     * @return reason Reason if invalid
     */
    function verifySetup() external view returns (bool isValid, string memory reason) {
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
    
    // ============ HTS STATUS MANAGEMENT ============
    
    /**
     * @notice Update HTS association status for a member
     * @dev Called after successful token association by AjoCore/AjoCollateral
     * @param member Member address
     * @param isAssociated Whether tokens are associated
     */
    function updateHtsAssociationStatus(
        address member, 
        bool isAssociated
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        members[member].isHtsAssociated = isAssociated;
        
        if (isAssociated) {
            emit MemberHtsAssociated(member);
        }
    }
    
    /**
     * @notice Set member frozen status (after HTS freeze operation)
     * @dev Called by AjoCollateral or AjoPayments after freeze/unfreeze
     * @param member Member address
     * @param isFrozen Whether member should be frozen
     */
    function setMemberFrozen(
        address member, 
        bool isFrozen
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        members[member].isFrozen = isFrozen;
        
        if (isFrozen) {
            emit MemberHtsFrozen(member);
        } else {
            emit MemberHtsUnfrozen(member);
        }
    }
    
    /**
     * @notice Get HTS status for a member
     * @param member Member address
     * @return isAssociated Whether member has associated HTS tokens
     * @return isFrozen Whether member is frozen
     */
    function getMemberHtsStatus(
        address member
    ) external view override returns (bool isAssociated, bool isFrozen) {
        Member memory memberInfo = members[member];
        return (memberInfo.isHtsAssociated, memberInfo.isFrozen);
    }
    
    // ============ MEMBER MANAGEMENT FUNCTIONS ============
    
    /**
     * @notice Add a new member to the Ajo
     * @param member Member address
     * @param memberData Member data struct
     */
    function addMember(
        address member, 
        Member memory memberData
    ) external override onlyAjoCore {
        require(!members[member].isActive, "Member already exists");
        
        members[member] = memberData;
        ajoQueuePositions[memberData.queueNumber] = member;
        lockedCollateralBalances[member] = memberData.lockedCollateral;
        activeAjoMembersList.push(member);
        
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
    
    /**
     * @notice Remove a member from the Ajo
     * @param member Member address
     */
    function removeMember(address member) external override onlyAjoCore {
        require(members[member].isActive, "Member not found");
        
        members[member].isActive = false;
        lockedCollateralBalances[member] = 0;
        _removeFromActiveList(member);
        
        emit MemberRemoved(member);
    }
    
    /**
     * @notice Update member data
     * @param member Member address
     * @param memberData Updated member data
     */
    function updateMember(
        address member, 
        Member memory memberData
    ) external override onlyAjoCore {
        require(members[member].isActive, "Member not found");
        
        members[member] = memberData;
        lockedCollateralBalances[member] = memberData.lockedCollateral;
        
        emit MemberUpdated(member);
    }
    
    /**
     * @notice Update member's collateral amount
     * @param member Member address
     * @param newAmount New collateral amount
     */
    function updateCollateral(
        address member, 
        uint256 newAmount
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        lockedCollateralBalances[member] = newAmount;
        members[member].lockedCollateral = newAmount;
    }
    
    /**
     * @notice Update member's reputation score
     * @param member Member address
     * @param newReputation New reputation score
     */
    function updateReputation(
        address member, 
        uint256 newReputation
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        members[member].reputationScore = newReputation;
    }
    
    /**
     * @notice Add a payment to member's history
     * @param member Member address
     * @param payment Payment amount
     */
    function addPastPayment(
        address member, 
        uint256 payment
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        members[member].pastPayments.push(payment);
    }
    
    /**
     * @notice Update last payment cycle for member
     * @param member Member address
     * @param cycle Cycle number
     */
    function updateLastPaymentCycle(
        address member, 
        uint256 cycle
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        members[member].lastPaymentCycle = cycle;
    }
    
    /**
     * @notice Increment default count for member
     * @param member Member address
     */
    function incrementDefaultCount(
        address member
    ) external override onlyAjoCore {
        require(members[member].isActive, "Member not found");
        members[member].defaultCount++;
    }
    
    /**
     * @notice Update total amount paid by member
     * @param member Member address
     * @param amount Amount to add to total
     */
    function updateTotalPaid(
        address member, 
        uint256 amount
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        members[member].totalPaid += amount;
    }
    
    /**
     * @notice Mark that member has received payout
     * @param member Member address
     */
    function markPayoutReceived(
        address member
    ) external override onlyAuthorizedContracts {
        require(members[member].isActive, "Member not found");
        members[member].hasReceivedPayout = true;
    }
    
    // ============ VIEW FUNCTIONS - BASIC QUERIES ============
    
    /**
     * @notice Get member data
     * @param member Member address
     * @return Member data struct
     */
    function getMember(
        address member
    ) external view override returns (Member memory) {
        return members[member];
    }
    
    /**
     * @notice Get total number of active members
     * @return Number of active members
     */
    function getTotalActiveMembers() external view override returns (uint256) {
        return activeAjoMembersList.length;
    }
    
    /**
     * @notice Check if address is a member
     * @param member Member address
     * @return Whether address is an active member
     */
    function isMember(address member) external view override returns (bool) {
        return members[member].isActive;
    }
    
    /**
     * @notice Get list of all active members
     * @return Array of member addresses
     */
    function getActiveMembersList() 
        external 
        view 
        override 
        returns (address[] memory) 
    {
        return activeAjoMembersList;
    }
    
    /**
     * @notice Get member at specific queue position
     * @param queueNumber Queue position
     * @return Member address
     */
    function getQueuePosition(
        uint256 queueNumber
    ) external view override returns (address) {
        return ajoQueuePositions[queueNumber];
    }
    
    /**
     * @notice Get guarantor for a specific position
     * @param position Queue position
     * @return Guarantor address
     */
    function getGuarantorForPosition(
        uint256 position
    ) external view override returns (address) {
        return guarantorAssignments[position];
    }
    
    /**
     * @notice Get locked collateral for member
     * @param member Member address
     * @return Collateral amount
     */
    function getLockedCollateral(
        address member
    ) external view override returns (uint256) {
        return lockedCollateralBalances[member];
    }
    
    /**
     * @notice Get member at specific index
     * @param index Index in active members list
     * @return Member address
     */
    function getMemberAtIndex(
        uint256 index
    ) external view override returns (address) {
        require(index < activeAjoMembersList.length, "Index out of bounds");
        return activeAjoMembersList[index];
    }
    
    /**
     * @notice Get member at specific index (alternative name for compatibility)
     * @param index Index in active members list
     * @return Member address
     */
    function activeMembersList(
        uint256 index
    ) external view override returns (address) {
        require(index < activeAjoMembersList.length, "Index out of bounds");
        return activeAjoMembersList[index];
    }
    
    /**
     * @notice Get member at queue position (alternative name for compatibility)
     * @param position Queue position
     * @return Member address
     */
    function queuePositions(
        uint256 position
    ) external view override returns (address) {
        return ajoQueuePositions[position];
    }
    
    // ============ VIEW FUNCTIONS - DETAILED QUERIES ============
    
    /**
     * @notice Get detailed member information
     * @param member Member address
     * @return memberInfo Member data struct
     * @return pendingPenalty Pending penalty amount
     * @return effectiveVotingPower Voting power
     */
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
        pendingPenalty = 0;
        effectiveVotingPower = memberInfo.isActive ? 100 : 0;
    }
    
    /**
     * @notice Get queue information for member
     * @param member Member address
     * @return position Queue position
     * @return estimatedCyclesWait Estimated cycles until payout
     */
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
     * @notice Get contract statistics
     * @return totalMembers Total member count
     * @return activeMembers Active member count
     * @return totalCollateralUSDC Total USDC collateral
     * @return totalCollateralHBAR Total HBAR collateral
     * @return contractBalanceUSDC USDC balance across contracts
     * @return contractBalanceHBAR HBAR balance across contracts
     * @return currentQueuePosition Highest queue position
     * @return activeToken Active payment token
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
        activeMembers = activeAjoMembersList.length;
        totalMembers = activeMembers;
        
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
        
        currentQueuePosition = 0;
        for (uint256 i = 0; i < activeMembers; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            if (member.queueNumber > currentQueuePosition) {
                currentQueuePosition = member.queueNumber;
            }
        }
        
        activeToken = PaymentToken.USDC;
    }
    
    // ============ VIEW FUNCTIONS - FRONTEND OPTIMIZATION ============
    
    /**
     * @notice Get detailed information for all members
     * @dev CRITICAL for frontend member tables
     * @return Array of MemberDetails structs
     */
    function getAllMembersDetails() 
        external 
        view 
        override 
        returns (MemberDetails[] memory) 
    {
        uint256 memberCount = activeAjoMembersList.length;
        MemberDetails[] memory details = new MemberDetails[](memberCount);
        
        uint256 currentCycle = _getCurrentCycle();
        
        for (uint256 i = 0; i < memberCount; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            
            details[i] = MemberDetails({
                userAddress: memberAddr,
                hasReceivedPayout: member.hasReceivedPayout,
                queuePosition: member.queueNumber,
                hasPaidThisCycle: member.lastPaymentCycle >= currentCycle,
                collateralLocked: member.lockedCollateral,
                guarantorAddress: member.guarantor,
                guarantorQueuePosition: member.guarantor != address(0) 
                    ? members[member.guarantor].queueNumber 
                    : 0,
                totalPaid: member.totalPaid,
                defaultCount: member.defaultCount,
                reputationScore: member.reputationScore,
                isHtsAssociated: member.isHtsAssociated,
                isFrozen: member.isFrozen
            });
        }
        
        return details;
    }
    
    /**
     * @notice Get paginated member details for large member lists
     * @param offset Starting index
     * @param limit Maximum number of results
     * @return details Array of MemberDetails
     * @return hasMore Whether more results exist
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
        uint256 currentCycle = _getCurrentCycle();
        
        for (uint256 i = 0; i < resultCount; i++) {
            address memberAddr = activeAjoMembersList[offset + i];
            Member memory member = members[memberAddr];
            
            details[i] = MemberDetails({
                userAddress: memberAddr,
                hasReceivedPayout: member.hasReceivedPayout,
                queuePosition: member.queueNumber,
                hasPaidThisCycle: member.lastPaymentCycle >= currentCycle,
                collateralLocked: member.lockedCollateral,
                guarantorAddress: member.guarantor,
                guarantorQueuePosition: member.guarantor != address(0) 
                    ? members[member.guarantor].queueNumber 
                    : 0,
                totalPaid: member.totalPaid,
                defaultCount: member.defaultCount,
                reputationScore: member.reputationScore,
                isHtsAssociated: member.isHtsAssociated,
                isFrozen: member.isFrozen
            });
        }
        
        hasMore = end < memberCount;
    }
    
    /**
     * @notice Get comprehensive activity summary for a member
     * @param member Member address
     * @return activity MemberActivity struct
     */
    function getMemberActivity(
        address member
    ) external view override returns (MemberActivity memory activity) {
        Member memory memberInfo = members[member];
        
        if (!memberInfo.isActive) {
            return activity;
        }
        
        uint256 currentCycle = _getCurrentCycle();
        
        activity.cyclesParticipated = currentCycle >= memberInfo.joinedCycle 
            ? currentCycle - memberInfo.joinedCycle + 1 
            : 0;
        
        activity.paymentsCompleted = memberInfo.pastPayments.length;
        
        activity.paymentsMissed = activity.cyclesParticipated > activity.paymentsCompleted 
            ? activity.cyclesParticipated - activity.paymentsCompleted 
            : 0;
        
        activity.totalPaid = 0;
        for (uint256 i = 0; i < memberInfo.pastPayments.length; i++) {
            activity.totalPaid += memberInfo.pastPayments[i];
        }
        
        activity.totalReceived = memberInfo.totalPaid;
        
        if (activity.totalReceived >= activity.totalPaid) {
            activity.netPosition = activity.totalReceived - activity.totalPaid;
        } else {
            activity.netPosition = 0;
        }
        
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
        
        activity.lastActiveTimestamp = memberInfo.lastPaymentCycle > 0 
            ? block.timestamp 
            : 0;
    }
    
    /**
     * @notice Get members filtered by active status
     * @param isActive Status filter
     * @return Array of member addresses
     */
    function getMembersByStatus(
        bool isActive
    ) external view override returns (address[] memory) {
        if (isActive) {
            return activeAjoMembersList;
        }
        return new address[](0);
    }
    
    /**
     * @notice Get members who need to make payment this cycle
     * @return Array of member addresses
     */
    function getMembersNeedingPayment() 
        external 
        view 
        override 
        returns (address[] memory) 
    {
        uint256 currentCycle = _getCurrentCycle();
        uint256 count = 0;
        
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            if (member.isActive && member.lastPaymentCycle < currentCycle) {
                count++;
            }
        }
        
        address[] memory needingPayment = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            Member memory member = members[memberAddr];
            if (member.isActive && member.lastPaymentCycle < currentCycle) {
                needingPayment[index] = memberAddr;
                index++;
            }
        }
        
        return needingPayment;
    }
    
    /**
     * @notice Get members who have defaulted
     * @return Array of member addresses
     */
    function getMembersWithDefaults() 
        external 
        view 
        override 
        returns (address[] memory) 
    {
        uint256 count = 0;
        
        for (uint256 i = 0; i < activeAjoMembersList.length; i++) {
            address memberAddr = activeAjoMembersList[i];
            if (members[memberAddr].defaultCount > 0) {
                count++;
            }
        }
        
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
     * @notice Get top members by reputation score
     * @param limit Maximum number of results
     * @return members_ Array of member addresses
     * @return reputations Array of reputation scores
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
        
        address[] memory allMembers = new address[](memberCount);
        uint256[] memory allReputations = new uint256[](memberCount);
        
        for (uint256 i = 0; i < memberCount; i++) {
            address memberAddr = activeAjoMembersList[i];
            allMembers[i] = memberAddr;
            allReputations[i] = members[memberAddr].reputationScore;
        }
        
        for (uint256 i = 0; i < limit && i < memberCount; i++) {
            for (uint256 j = i + 1; j < memberCount; j++) {
                if (allReputations[j] > allReputations[i]) {
                    uint256 tempRep = allReputations[i];
                    allReputations[i] = allReputations[j];
                    allReputations[j] = tempRep;
                    
                    address tempAddr = allMembers[i];
                    allMembers[i] = allMembers[j];
                    allMembers[j] = tempAddr;
                }
            }
        }
        
        members_ = new address[](limit);
        reputations = new uint256[](limit);
        for (uint256 i = 0; i < limit; i++) {
            members_[i] = allMembers[i];
            reputations[i] = allReputations[i];
        }
    }
    
    // ============ INTERNAL HELPER FUNCTIONS ============
    
    /**
     * @dev Remove member from active list
     * @param member Member address to remove
     */
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
        
        try IAjoPayments(ajoPayments).getCurrentCycle() returns (uint256 cycle) {
            return cycle;
        } catch {
            return 1;
        }
    }
}