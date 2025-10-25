// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/AjoInterfaces.sol";
import "../core/LockableContract.sol";

contract AjoCollateral is IAjoCollateral, Ownable, Initializable, LockableContract {
    
    // ============ CONSTANTS ============
    
    uint256 public constant COLLATERAL_FACTOR = 60; // 60% collateral factor
    uint256 public constant GUARANTOR_OFFSET_DIVISOR = 2; // Guarantor is participants/2 positions away
    
    // ============ STATE VARIABLES ============
    
    IERC20 public USDC;
    IERC20 public HBAR;
    address public ajoCore;
    IAjoMembers public membersContract;
    
    mapping(PaymentToken => mapping(address => uint256)) public tokenBalances;
    
    // ============ EVENTS ============
    
    event CollateralLocked(address indexed member, uint256 amount, PaymentToken token);
    event CollateralUnlocked(address indexed member, uint256 amount, PaymentToken token);
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    // ============ CONSTRUCTOR (for master copy) ============
    
    constructor() {
        // Disable initializers on the master copy
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER (for proxy instances) ============
    
    function initialize(
        address _usdc,
        address _hbar,
        address _ajoCore,
        address _ajoMembers
    ) external override initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_hbar != address(0), "Invalid HBAR address");
        require(_ajoCore != address(0), "Invalid AjoCore address");
        require(_ajoMembers != address(0), "Invalid AjoMembers address");
        
        _transferOwnership(msg.sender);
        
        USDC = IERC20(_usdc);
        HBAR = IERC20(_hbar);
        ajoCore = _ajoCore;
        membersContract = IAjoMembers(_ajoMembers);
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
     * @dev Verify setup for AjoCollateral
     */
    function verifySetup() external view override returns (bool isValid, string memory reason) {
        if (ajoCore == address(0)) {
            return (false, "AjoCore not set");
        }
        return (true, "Setup is valid");
    }

    // ============ COLLATERAL CALCULATION FUNCTIONS (IAjoCollateral) ============
    
    /**
     * @dev Calculate required collateral based on queue position
     * @param position Queue position (1-indexed)
     * @param monthlyPayment Monthly payment amount
     * @param totalParticipants Total number of participants
     * @return Required collateral amount
     * 
     * Formula: (Payout - Position * MonthlyPayment) * 60%
     * Rationale: 60% factor accounts for seizure of past payments (40% coverage)
     */
    function calculateRequiredCollateral(
        uint256 position,
        uint256 monthlyPayment,
        uint256 totalParticipants
    ) public view override returns (uint256) {
        // Last person has no debt after payout, no collateral needed
        if (position >= totalParticipants) {
            return 0;
        }
        
        // Calculate potential debt: Payout - (position * monthlyPayment)
        uint256 payout = totalParticipants * monthlyPayment;
        uint256 potentialDebt = payout - (position * monthlyPayment);
        
        // Apply collateral factor (60% due to seizure of past payments)
        uint256 requiredCollateral = (potentialDebt * COLLATERAL_FACTOR) / 100;
        
        return requiredCollateral;
    }
    
    /**
     * @dev Calculate guarantor position using circular offset
     * @param memberPosition Member's queue position
     * @param totalParticipants Total number of participants
     * @return Guarantor's queue position (0 if no guarantor for odd-numbered last position)
     * 
     * Logic: Guarantor is offset by totalParticipants/2 positions in circular queue
     */
    function calculateGuarantorPosition(
        uint256 memberPosition,
        uint256 totalParticipants
    ) public pure override returns (uint256) {
        uint256 guarantorOffset = totalParticipants / GUARANTOR_OFFSET_DIVISOR;
        uint256 guarantorPosition = ((memberPosition - 1 + guarantorOffset) % totalParticipants) + 1;
        
        // For odd numbers, the last person has no guarantor relationship
        // They don't guarantee anyone, and no one guarantees them
        if (totalParticipants % 2 == 1) {
            // If calculating for the last position, return 0 (no guarantor)
            if (memberPosition == totalParticipants) {
                return 0;
            }
            // If the calculated guarantor would be the last position, return 0 instead
            if (guarantorPosition == totalParticipants) {
                return 0;
            }
        }
        
        return guarantorPosition;
    }
    
    /**
     * @dev Calculate total seizable assets from defaulter and guarantor
     * @param defaulterAddress Address of the defaulting member
     * @return totalSeizable Total amount that can be seized
     * @return collateralSeized Amount seized from locked collateral
     * @return paymentsSeized Amount seized from past payments
     * 
     * Includes: Defaulter's collateral + guarantor's collateral + both past payments
     */
    function calculateSeizableAssets(address defaulterAddress) 
        external 
        view 
        override
        returns (
            uint256 totalSeizable, 
            uint256 collateralSeized, 
            uint256 paymentsSeized
        ) 
    {
        Member memory defaulter = membersContract.getMember(defaulterAddress);
        address guarantorAddr = defaulter.guarantor;
        
        if (guarantorAddr == address(0)) {
            return (0, 0, 0);
        }
        
        Member memory guarantor = membersContract.getMember(guarantorAddr);
        
        // 1. Calculate collateral seizure (both tokens, both parties)
        collateralSeized = tokenBalances[PaymentToken.USDC][defaulterAddress] + 
                          tokenBalances[PaymentToken.HBAR][defaulterAddress] +
                          tokenBalances[PaymentToken.USDC][guarantorAddr] + 
                          tokenBalances[PaymentToken.HBAR][guarantorAddr];
        
        // 2. Calculate past payments seizure
        paymentsSeized = 0;
        
        // Defaulter's past payments
        for (uint256 i = 0; i < defaulter.pastPayments.length; i++) {
            paymentsSeized += defaulter.pastPayments[i];
        }
        
        // Guarantor's past payments
        for (uint256 i = 0; i < guarantor.pastPayments.length; i++) {
            paymentsSeized += guarantor.pastPayments[i];
        }
        
        totalSeizable = collateralSeized + paymentsSeized;
    }
    
    // ============ COLLATERAL MANAGEMENT FUNCTIONS ============
    
    /**
     * @dev Lock collateral from member
     * @param member Address of the member
     * @param amount Amount to lock
     * @param token Token type (USDC or HBAR)
     */
    function lockCollateral(address member, uint256 amount, PaymentToken token) external override onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        
        if (amount > 0) {
            tokenContract.transferFrom(member, address(this), amount);
            tokenBalances[token][member] += amount;
        }
        
        emit CollateralLocked(member, amount, token);
    }
    
    /**
     * @dev Unlock and return collateral to member
     * @param member Address of the member
     * @param amount Amount to unlock
     * @param token Token type (USDC or HBAR)
     */
    function unlockCollateral(address member, uint256 amount, PaymentToken token) external override onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        
        require(tokenBalances[token][member] >= amount, "Insufficient collateral balance");
        
        if (amount > 0) {
            tokenBalances[token][member] -= amount;
            tokenContract.transfer(member, amount);
        }
        
        emit CollateralUnlocked(member, amount, token);
    }
    
    /**
    * @dev Execute seizure of defaulter and guarantor assets
    * @param defaulter Address of the defaulting member
    * 
    * Seizes:
    * 1. All locked collateral (both tokens, both parties)
    * 2. Transfers seized collateral to AjoPayments to fund future payouts
    * 3. All past payments (recorded but not physically moved - just accounting)
    * 4. Emits events for tracking
    */
    function executeSeizure(address defaulter) external override onlyAjoCore {
        Member memory defaulterMember = membersContract.getMember(defaulter);
        address guarantorAddr = defaulterMember.guarantor;
        
        if (guarantorAddr == address(0)) return; // No guarantor assigned yet
        
        Member memory guarantorMember = membersContract.getMember(guarantorAddr);
        
        // Determine which token is being used (both members use same token)
        PaymentToken activeToken = defaulterMember.preferredToken;
        IERC20 tokenContract = activeToken == PaymentToken.USDC ? USDC : HBAR;
        
        // 1. Seize defaulter's collateral
        uint256 defaulterCollateral = tokenBalances[activeToken][defaulter];
        tokenBalances[activeToken][defaulter] = 0;
        
        // 2. Seize guarantor's collateral  
        uint256 guarantorCollateral = tokenBalances[activeToken][guarantorAddr];
        tokenBalances[activeToken][guarantorAddr] = 0;
        
        // 3. Calculate total seized collateral
        uint256 totalSeizedCollateral = defaulterCollateral + guarantorCollateral;
        
        // 4. Transfer seized collateral to AjoPayments contract
        if (totalSeizedCollateral > 0) {
            address paymentsContract = address(IAjoCore(ajoCore).paymentsContractAddress());
            tokenContract.transfer(paymentsContract, totalSeizedCollateral);
        }
        
        // 5. Calculate seized payments (for accounting/events only - no transfer)
        uint256 defaulterPayments = 0;
        uint256 guarantorPayments = 0;
        
        // Sum defaulter's past payments
        for (uint256 i = 0; i < defaulterMember.pastPayments.length; i++) {
            defaulterPayments += defaulterMember.pastPayments[i];
        }
        
        // Sum guarantor's past payments  
        for (uint256 i = 0; i < guarantorMember.pastPayments.length; i++) {
            guarantorPayments += guarantorMember.pastPayments[i];
        }
        
        // 6. Emit liquidation events
        if (defaulterCollateral > 0) {
            emit CollateralLiquidated(defaulter, defaulterCollateral, activeToken);
        }
        if (guarantorCollateral > 0) {
            emit CollateralLiquidated(guarantorAddr, guarantorCollateral, activeToken);
        }
        
        // Emit payment seizure events (accounting only)
        emit PaymentSeized(defaulter, defaulterPayments, "Defaulter past payments seized");
        emit PaymentSeized(guarantorAddr, guarantorPayments, "Guarantor past payments seized");
        
        // Optional: Emit total seizure summary event
        emit CollateralSeized(defaulter, guarantorAddr, totalSeizedCollateral, activeToken);
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get token balance for a specific member
     * @param member Address of the member
     * @param token Token type to query
     * @return Balance amount
     */
    function getTokenBalance(address member, PaymentToken token) external view returns (uint256) {
        return tokenBalances[token][member];
    }
    
    /**
     * @dev Get total collateral locked in contract across all members
     * @return totalUSDC Total USDC locked
     * @return totalHBAR Total HBAR locked
     */
    function getTotalCollateral() external view override returns (uint256 totalUSDC, uint256 totalHBAR) {
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        for (uint256 i = 0; i < totalMembers; i++) {
            address member = membersContract.activeMembersList(i);
            totalUSDC += tokenBalances[PaymentToken.USDC][member];
            totalHBAR += tokenBalances[PaymentToken.HBAR][member];
        }
    }
    
    /**
     * @dev Generate collateral requirement demo for visualization
     * @param participants Number of participants to simulate
     * @param monthlyPayment Monthly payment amount
     * @return positions Array of position numbers [1, 2, 3, ..., n]
     * @return collaterals Array of required collateral for each position
     * 
     * Used by frontend to show collateral curve before joining
     */
    function getCollateralDemo(uint256 participants, uint256 monthlyPayment) 
        external 
        view 
        returns (uint256[] memory positions, uint256[] memory collaterals) 
    {
        positions = new uint256[](participants);
        collaterals = new uint256[](participants);
        
        for (uint256 i = 1; i <= participants; i++) {
            positions[i-1] = i;
            collaterals[i-1] = calculateRequiredCollateral(i, monthlyPayment, participants);
        }
    }
    
    /**
     * @dev Calculate initial reputation score based on collateral
     * @param collateral Amount of collateral locked
     * @param monthlyPayment Monthly payment amount
     * @return Initial reputation score (600-1000)
     * 
     * Logic:
     * - Base 600 reputation
     * - Bonus based on collateral/monthlyPayment ratio (max +400)
     * - Last position (no collateral) gets 800 reputation
     */
    function calculateInitialReputation(uint256 collateral, uint256 monthlyPayment) 
        external 
        pure 
        returns (uint256) 
    {
        if (collateral == 0) return 800; // High reputation for last position (no collateral needed)
        
        // Base reputation of 600, up to 1000 based on collateral vs monthly payment ratio
        uint256 ratio = (collateral * 100) / monthlyPayment; // How many months of payments is collateral worth
        uint256 bonus = ratio > 400 ? 400 : ratio; // Cap bonus at 400 points
        return 600 + bonus;
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @dev Emergency withdrawal function for admin recovery
     * @param token Token type to withdraw
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(PaymentToken token, address to, uint256 amount) external override onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        tokenContract.transfer(to, amount);
    }
}