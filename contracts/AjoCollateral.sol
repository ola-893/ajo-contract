// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AjoInterfaces.sol";

contract AjoCollateral is IAjoCollateral, Ownable, Initializable {
    
    // ============ CONSTANTS ============
    
    uint256 public constant COLLATERAL_FACTOR = 55; // 55% collateral factor
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
    
    // ADD THIS LINE:
    _transferOwnership(msg.sender);
    
    USDC = IERC20(_usdc);
    HBAR = IERC20(_hbar);
    ajoCore = _ajoCore;
    membersContract = IAjoMembers(_ajoMembers);
}

    
    // ============ COLLATERAL CALCULATION FUNCTIONS ============
    
    function calculateRequiredCollateral(
        uint256 position,
        uint256 monthlyPayment,
        uint256 totalParticipants
    ) external pure override returns (uint256) {
        // Last person has no debt after payout, no collateral needed
        if (position >= totalParticipants) {
            return 0;
        }
        
        // Calculate potential debt: Payout - (position * monthlyPayment)
        uint256 payout = totalParticipants * monthlyPayment;
        uint256 potentialDebt = payout - (position * monthlyPayment);
        
        // Apply V2 collateral factor (55% due to seizure of past payments)
        uint256 requiredCollateral = (potentialDebt * COLLATERAL_FACTOR) / 100;
        
        return requiredCollateral;
    }
    
    function calculateGuarantorPosition(
        uint256 memberPosition,
        uint256 totalParticipants
    ) external pure override returns (uint256) {
        uint256 guarantorOffset = totalParticipants / GUARANTOR_OFFSET_DIVISOR;
        uint256 guarantorPosition = ((memberPosition - 1 + guarantorOffset) % totalParticipants) + 1;
        return guarantorPosition;
    }
    
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
        
        // 1. Calculate collateral seizure
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
    
    function lockCollateral(address member, uint256 amount, PaymentToken token) external override onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        
        if (amount > 0) {
            tokenContract.transferFrom(member, address(this), amount);
            tokenBalances[token][member] += amount;
        }
        
        emit CollateralLocked(member, amount, token);
    }
    
    function unlockCollateral(address member, uint256 amount, PaymentToken token) external override onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        
        require(tokenBalances[token][member] >= amount, "Insufficient collateral balance");
        
        if (amount > 0) {
            tokenBalances[token][member] -= amount;
            tokenContract.transfer(member, amount);
        }
        
        emit CollateralUnlocked(member, amount, token);
    }
    
    function executeSeizure(address defaulter) external override onlyAjoCore {
        Member memory defaulterMember = membersContract.getMember(defaulter);
        address guarantorAddr = defaulterMember.guarantor;
        
        if (guarantorAddr == address(0)) return; // No guarantor assigned yet
        
        Member memory guarantorMember = membersContract.getMember(guarantorAddr);
        
        // 1. Seize defaulter's collateral
        uint256 defaulterCollateralUSDC = tokenBalances[PaymentToken.USDC][defaulter];
        uint256 defaulterCollateralHBAR = tokenBalances[PaymentToken.HBAR][defaulter];
        
        tokenBalances[PaymentToken.USDC][defaulter] = 0;
        tokenBalances[PaymentToken.HBAR][defaulter] = 0;
        
        // 2. Seize guarantor's collateral  
        uint256 guarantorCollateralUSDC = tokenBalances[PaymentToken.USDC][guarantorAddr];
        uint256 guarantorCollateralHBAR = tokenBalances[PaymentToken.HBAR][guarantorAddr];
        
        tokenBalances[PaymentToken.USDC][guarantorAddr] = 0;
        tokenBalances[PaymentToken.HBAR][guarantorAddr] = 0;
        
        // 3. Calculate seized payments
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
        
        // Platform keeps seized assets as compensation
        if (defaulterCollateralUSDC > 0) {
            emit CollateralLiquidated(defaulter, defaulterCollateralUSDC, PaymentToken.USDC);
        }
        if (defaulterCollateralHBAR > 0) {
            emit CollateralLiquidated(defaulter, defaulterCollateralHBAR, PaymentToken.HBAR);
        }
        if (guarantorCollateralUSDC > 0) {
            emit CollateralLiquidated(guarantorAddr, guarantorCollateralUSDC, PaymentToken.USDC);
        }
        if (guarantorCollateralHBAR > 0) {
            emit CollateralLiquidated(guarantorAddr, guarantorCollateralHBAR, PaymentToken.HBAR);
        }
        
        emit PaymentSeized(defaulter, defaulterPayments, "Defaulter past payments seized");
        emit PaymentSeized(guarantorAddr, guarantorPayments, "Guarantor past payments seized");
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getTokenBalance(address member, PaymentToken token) external view returns (uint256) {
        return tokenBalances[token][member];
    }
    
    function getTotalCollateral() external view override returns (uint256 totalUSDC, uint256 totalHBAR) {
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        for (uint256 i = 0; i < totalMembers; i++) {
            address member = membersContract.activeMembersList(i);
            totalUSDC += tokenBalances[PaymentToken.USDC][member];
            totalHBAR += tokenBalances[PaymentToken.HBAR][member];
        }
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    function emergencyWithdraw(PaymentToken token, address to, uint256 amount) external override onlyAjoCore {
        IERC20 tokenContract = token == PaymentToken.USDC ? USDC : HBAR;
        tokenContract.transfer(to, amount);
    }
}