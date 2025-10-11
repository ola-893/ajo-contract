// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/AjoInterfaces.sol";
import "../hedera/hedera-token-service/HederaTokenService.sol";
import "../hedera/HederaResponseCodes.sol";

/**
 * @title AjoCollateral
 * @notice Manages collateral for Ajo groups with HTS integration
 * @dev Inherits from HederaTokenService for proper HTS interaction
 * 
 * Key Changes:
 * - Inherits from HederaTokenService instead of using HTSHelper library
 * - Uses native HTS functions (freezeToken, unfreezeToken, transferToken)
 * - Proper response code handling with HederaResponseCodes
 * - Maintains freeze + transfer pattern (no wipe key needed)
 */
contract AjoCollateral is IAjoCollateral, Ownable, Initializable, ReentrancyGuard, HederaTokenService {
    
    // ============ CONSTANTS ============
    
    uint256 public constant COLLATERAL_FACTOR = 60; // 60% collateral factor
    uint256 public constant GUARANTOR_OFFSET_DIVISOR = 2; // Guarantor is participants/2 positions away
    
    // ============ STATE VARIABLES ============
    
    address public usdcToken; // HTS USDC token address
    address public hbarToken; // HTS WHBAR token address
    address public ajoCore;
    IAjoMembers public membersContract;
    
    // Track locked collateral per member per token
    mapping(PaymentToken => mapping(address => uint256)) public tokenBalances;
    
    // Track frozen status
    mapping(address => bool) public isFrozen;
    
    // ============ EVENTS ============
    
    event AccountFrozen(
        address indexed account,
        address indexed token,
        int64 responseCode
    );
    
    event AccountUnfrozen(
        address indexed account,
        address indexed token,
        int64 responseCode
    );
    
    event AjoCoreUpdated(address indexed oldCore, address indexed newCore);
    
    // ============ MODIFIERS ============
    
    modifier onlyAjoCore() {
        require(msg.sender == ajoCore, "Only AjoCore");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        _disableInitializers();
        _transferOwnership(address(1));
    }
    
    // ============ INITIALIZER ============
    
    /**
     * @notice Initialize the collateral contract
     * @param _usdc HTS USDC token address
     * @param _whbar HTS WHBAR token address
     * @param _ajoCore Address of AjoCore contract
     * @param _ajoMembers Address of AjoMembers contract
     * @param _hederaTokenService Address of HTS (0x167) - kept for interface compatibility but not used
     */
    function initialize(
        address _usdc,
        address _whbar,
        address _ajoCore,
        address _ajoMembers,
        address _hederaTokenService
    ) external override initializer {
        require(_usdc != address(0), "Invalid USDC address");
        require(_whbar != address(0), "Invalid HBAR address");
        require(_ajoCore != address(0), "Invalid AjoCore address");
        require(_ajoMembers != address(0), "Invalid AjoMembers address");
        
        _transferOwnership(msg.sender);
        
        usdcToken = _usdc;
        hbarToken = _whbar;
        ajoCore = _ajoCore;
        membersContract = IAjoMembers(_ajoMembers);
        
        // Note: _hederaTokenService parameter kept for interface compatibility
        // HederaTokenService is accessed via inherited contract at 0x167
    }
    
    function setAjoCore(address _ajoCore) external onlyOwner {
        require(_ajoCore != address(0), "Cannot set zero address");
        require(_ajoCore != ajoCore, "Already set to this address");
        
        address oldCore = ajoCore;
        ajoCore = _ajoCore;
        
        emit AjoCoreUpdated(oldCore, _ajoCore);
    }
    
    // ============ COLLATERAL CALCULATION FUNCTIONS ============
    
    /**
     * @notice Calculate required collateral based on queue position
     * @param position Queue position (1-indexed)
     * @param monthlyPayment Monthly payment amount
     * @param totalParticipants Total number of participants
     * @return Required collateral amount
     * 
     * Formula: (Payout - Position * MonthlyPayment) * 60%
     * Rationale: 60% factor accounts for guarantor system + past payment seizure
     */
    function calculateRequiredCollateral(
        uint256 position,
        uint256 monthlyPayment,
        uint256 totalParticipants
    ) public pure override returns (uint256) {
        // Last person has no debt after payout, no collateral needed
        if (position >= totalParticipants) {
            return 0;
        }
        
        // Calculate potential debt: Payout - (position * monthlyPayment)
        uint256 payout = totalParticipants * monthlyPayment;
        uint256 potentialDebt = payout - (position * monthlyPayment);
        
        // Apply collateral factor (60%)
        uint256 requiredCollateral = (potentialDebt * COLLATERAL_FACTOR) / 100;
        
        return requiredCollateral;
    }
    
    /**
     * @notice Calculate guarantor position using circular offset
     * @param memberPosition Member's queue position
     * @param totalParticipants Total number of participants
     * @return Guarantor's queue position (0 if no guarantor)
     */
    function calculateGuarantorPosition(
        uint256 memberPosition,
        uint256 totalParticipants
    ) public pure override returns (uint256) {
        uint256 guarantorOffset = totalParticipants / GUARANTOR_OFFSET_DIVISOR;
        uint256 guarantorPosition = ((memberPosition - 1 + guarantorOffset) % totalParticipants) + 1;
        
        // For odd numbers, the last person has no guarantor
        if (totalParticipants % 2 == 1) {
            if (memberPosition == totalParticipants) {
                return 0;
            }
            if (guarantorPosition == totalParticipants) {
                return 0;
            }
        }
        
        return guarantorPosition;
    }
    
    /**
     * @notice Calculate total seizable assets from defaulter and guarantor
     * @param defaulterAddress Address of the defaulting member
     * @return totalSeizable Total amount that can be seized
     * @return collateralSeized Amount seized from locked collateral
     * @return paymentsSeized Amount seized from past payments
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
        
        return (totalSeizable, collateralSeized, paymentsSeized);
    }
    
    /**
     * @notice Get total collateral locked in the contract
     * @return totalUSDC Total USDC collateral
     * @return totalHBAR Total HBAR collateral
     */
    function getTotalCollateral() external view override returns (uint256 totalUSDC, uint256 totalHBAR) {
        uint256 totalMembers = membersContract.getTotalActiveMembers();
        
        totalUSDC = 0;
        totalHBAR = 0;
        
        for (uint256 i = 0; i < totalMembers; i++) {
            address member = membersContract.getMemberAtIndex(i);
            totalUSDC += tokenBalances[PaymentToken.USDC][member];
            totalHBAR += tokenBalances[PaymentToken.HBAR][member];
        }
        
        return (totalUSDC, totalHBAR);
    }
    
    // ============ HTS COLLATERAL OPERATIONS ============
    
    /**
     * @notice Lock collateral using HTS transfer
     * @param member Address of the member
     * @param amount Amount to lock
     * @param token Token type (USDC or HBAR)
     * @return result HTS transfer result
     */
    function lockCollateralHts(
        address member,
        uint256 amount,
        PaymentToken token
    ) external override onlyAjoCore nonReentrant returns (HtsTransferResult memory result) {
        address tokenAddress = (token == PaymentToken.USDC) ? usdcToken : hbarToken;
        
        if (amount == 0) {
            return HtsTransferResult({
                responseCode: HederaResponseCodes.SUCCESS,
                success: true,
                errorMessage: ""
            });
        }
        
        require(amount <= uint256(uint64(type(int64).max)), "Amount too large for HTS");
        
        // Use inherited HederaTokenService function
        int256 responseCode = transferToken(tokenAddress, member, address(this), int64(uint64(amount)));
        
        bool success = (responseCode == HederaResponseCodes.SUCCESS);
        string memory errorMessage = success ? "" : _getHtsErrorMessage(int64(responseCode));
        
        result = HtsTransferResult({
            responseCode: int64(responseCode),
            success: success,
            errorMessage: errorMessage
        });
        
        require(result.success, result.errorMessage);
        
        // Update balance
        tokenBalances[token][member] += amount;
        
        emit CollateralLockedHts(member, amount, tokenAddress, int64(responseCode));
        
        return result;
    }
    
    /**
     * @notice Unlock collateral using HTS transfer
     * @param member Address of the member
     * @param amount Amount to unlock
     * @param token Token type (USDC or HBAR)
     * @return result HTS transfer result
     */
    function unlockCollateralHts(
        address member,
        uint256 amount,
        PaymentToken token
    ) external override onlyAjoCore nonReentrant returns (HtsTransferResult memory result) {
        require(tokenBalances[token][member] >= amount, "Insufficient collateral balance");
        
        address tokenAddress = (token == PaymentToken.USDC) ? usdcToken : hbarToken;
        
        if (amount == 0) {
            return HtsTransferResult({
                responseCode: HederaResponseCodes.SUCCESS,
                success: true,
                errorMessage: ""
            });
        }
        
        require(amount <= uint256(uint64(type(int64).max)), "Amount too large for HTS");
        
        // Update balance first
        tokenBalances[token][member] -= amount;
        
        // Use inherited HederaTokenService function
        int256 responseCode = transferToken(tokenAddress, address(this), member, int64(uint64(amount)));
        
        bool success = (responseCode == HederaResponseCodes.SUCCESS);
        string memory errorMessage = success ? "" : _getHtsErrorMessage(int64(responseCode));
        
        result = HtsTransferResult({
            responseCode: int64(responseCode),
            success: success,
            errorMessage: errorMessage
        });
        
        require(result.success, result.errorMessage);
        
        emit CollateralUnlockedHts(member, amount, tokenAddress, int64(responseCode));
        
        return result;
    }
    
    /**
     * @notice Seize collateral from defaulter and guarantor using HTS freeze + transfer
     * @param defaulter Address of the defaulting member
     * @return totalSeized Total amount seized
     * @return result HTS operation result
     * 
     * CRITICAL: Uses FREEZE + TRANSFER (not wipe)
     * 
     * Process:
     * 1. Freeze defaulter's account
     * 2. Transfer defaulter's collateral to contract
     * 3. Freeze guarantor's account
     * 4. Transfer guarantor's collateral to contract
     * 5. Update member states
     */
    function seizeCollateralHts(
        address defaulter
    ) external override onlyAjoCore nonReentrant returns (
        uint256 totalSeized,
        HtsTransferResult memory result
    ) {
        Member memory defaulterMember = membersContract.getMember(defaulter);
        address guarantorAddr = defaulterMember.guarantor;
        
        if (guarantorAddr == address(0)) {
            return (0, HtsTransferResult({
                responseCode: HederaResponseCodes.SUCCESS,
                success: true,
                errorMessage: "No guarantor assigned"
            }));
        }
        
        Member memory guarantorMember = membersContract.getMember(guarantorAddr);
        PaymentToken defaulterToken = defaulterMember.preferredToken;
        PaymentToken guarantorToken = guarantorMember.preferredToken;
        
        uint256 defaulterCollateral = tokenBalances[defaulterToken][defaulter];
        uint256 guarantorCollateral = tokenBalances[guarantorToken][guarantorAddr];
        
        // Step 1: Freeze defaulter's account
        address defaulterTokenAddress = (defaulterToken == PaymentToken.USDC) ? usdcToken : hbarToken;
        int64 freezeResponse1 = freezeToken(defaulterTokenAddress, defaulter);
        
        require(freezeResponse1 == HederaResponseCodes.SUCCESS, _getHtsErrorMessage(freezeResponse1));
        isFrozen[defaulter] = true;
        
        emit AccountFrozen(defaulter, defaulterTokenAddress, freezeResponse1);
        
        // Step 2: Transfer defaulter's collateral
        if (defaulterCollateral > 0) {
            require(defaulterCollateral <= uint256(uint64(type(int64).max)), "Amount too large for HTS");
            
            int256 transferResponse1 = transferToken(
                defaulterTokenAddress,
                defaulter,
                address(this),
                int64(uint64(defaulterCollateral))
            );
            
            require(transferResponse1 == HederaResponseCodes.SUCCESS, _getHtsErrorMessage(int64(transferResponse1)));
            tokenBalances[defaulterToken][defaulter] = 0;
            
            result.responseCode = int64(transferResponse1);
            result.success = true;
            result.errorMessage = "";
        }
        
        // Step 3: Freeze guarantor's account
        address guarantorTokenAddress = (guarantorToken == PaymentToken.USDC) ? usdcToken : hbarToken;
        int64 freezeResponse2 = freezeToken(guarantorTokenAddress, guarantorAddr);
        
        require(freezeResponse2 == HederaResponseCodes.SUCCESS, _getHtsErrorMessage(freezeResponse2));
        isFrozen[guarantorAddr] = true;
        
        emit AccountFrozen(guarantorAddr, guarantorTokenAddress, freezeResponse2);
        
        // Step 4: Transfer guarantor's collateral
        if (guarantorCollateral > 0) {
            require(guarantorCollateral <= uint256(uint64(type(int64).max)), "Amount too large for HTS");
            
            int256 transferResponse2 = transferToken(
                guarantorTokenAddress,
                guarantorAddr,
                address(this),
                int64(uint64(guarantorCollateral))
            );
            
            require(transferResponse2 == HederaResponseCodes.SUCCESS, _getHtsErrorMessage(int64(transferResponse2)));
            tokenBalances[guarantorToken][guarantorAddr] = 0;
            
            result.responseCode = int64(transferResponse2);
            result.success = true;
            result.errorMessage = "";
        }
        
        // Step 5: Calculate past payments seized (accounting only)
        uint256 defaulterPayments = 0;
        uint256 guarantorPayments = 0;
        
        for (uint256 i = 0; i < defaulterMember.pastPayments.length; i++) {
            defaulterPayments += defaulterMember.pastPayments[i];
        }
        
        for (uint256 i = 0; i < guarantorMember.pastPayments.length; i++) {
            guarantorPayments += guarantorMember.pastPayments[i];
        }
        
        totalSeized = defaulterCollateral + guarantorCollateral + defaulterPayments + guarantorPayments;
        
        emit CollateralSeizedHts(
            defaulter,
            defaulterCollateral + guarantorCollateral,
            defaulterPayments + guarantorPayments,
            guarantorCollateral,
            totalSeized
        );
        
        // Update member states to reflect frozen status
        membersContract.setMemberFrozen(defaulter, true);
        membersContract.setMemberFrozen(guarantorAddr, true);
        
        return (totalSeized, result);
    }
    
    /**
     * @notice Redistribute seized collateral to remaining members
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts for each recipient
     * @param token Token type to distribute
     * @return results Array of HTS transfer results
     */
    function redistributeSeizedCollateral(
        address[] memory recipients,
        uint256[] memory amounts,
        PaymentToken token
    ) external override onlyAjoCore nonReentrant returns (HtsTransferResult[] memory results) {
        require(recipients.length == amounts.length, "Array length mismatch");
        
        address tokenAddress = (token == PaymentToken.USDC) ? usdcToken : hbarToken;
        results = new HtsTransferResult[](recipients.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (amounts[i] > 0) {
                require(amounts[i] <= uint256(uint64(type(int64).max)), "Amount too large for HTS");
                
                int256 responseCode = transferToken(
                    tokenAddress,
                    address(this),
                    recipients[i],
                    int64(uint64(amounts[i]))
                );
                
                bool success = (responseCode == HederaResponseCodes.SUCCESS);
                
                results[i] = HtsTransferResult({
                    responseCode: int64(responseCode),
                    success: success,
                    errorMessage: success ? "" : _getHtsErrorMessage(int64(responseCode))
                });
                
                if (success) {
                    emit SeizedCollateralRedistributed(recipients[i], amounts[i], tokenAddress);
                }
            }
        }
        
        return results;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get token balance for a specific member and token
     * @param member Member address
     * @param token Token type
     * @return Balance amount
     */
    function getTokenBalance(address member, PaymentToken token) external view returns (uint256) {
        return tokenBalances[token][member];
    }
    
    /**
     * @notice Get collateral demonstration for participants
     * @param participants Number of participants
     * @param monthlyPayment Monthly payment amount
     * @return positions Array of positions
     * @return collaterals Array of required collaterals
     */
    function getCollateralDemo(uint256 participants, uint256 monthlyPayment) 
        external 
        pure 
        returns (uint256[] memory positions, uint256[] memory collaterals) 
    {
        positions = new uint256[](participants);
        collaterals = new uint256[](participants);
        
        for (uint256 i = 1; i <= participants; i++) {
            positions[i-1] = i;
            collaterals[i-1] = calculateRequiredCollateral(i, monthlyPayment, participants);
        }
        
        return (positions, collaterals);
    }
    
    /**
     * @notice Calculate initial reputation score based on collateral
     * @param collateral Collateral amount
     * @param monthlyPayment Monthly payment amount
     * @return Reputation score
     */
    function calculateInitialReputation(uint256 collateral, uint256 monthlyPayment) 
        external 
        pure 
        returns (uint256) 
    {
        if (collateral == 0) return 800; // High reputation for last position
        
        uint256 ratio = (collateral * 100) / monthlyPayment;
        uint256 bonus = ratio > 400 ? 400 : ratio;
        return 600 + bonus;
    }
    
    /**
     * @notice Check if an account is frozen
     * @param account Account address
     * @return Whether the account is frozen
     */
    function isAccountFrozen(address account) external view returns (bool) {
        return isFrozen[account];
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @notice Emergency withdraw tokens from contract
     * @param token Token type to withdraw
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        PaymentToken token,
        address to,
        uint256 amount
    ) external override onlyAjoCore {
        require(amount <= uint256(uint64(type(int64).max)), "Amount too large for HTS");
        
        address tokenAddress = (token == PaymentToken.USDC) ? usdcToken : hbarToken;
        
        int256 responseCode = transferToken(tokenAddress, address(this), to, int64(uint64(amount)));
        
        require(responseCode == HederaResponseCodes.SUCCESS, _getHtsErrorMessage(int64(responseCode)));
    }
    
    // ============ INTERNAL HELPER FUNCTIONS ============
    
    /**
     * @notice Convert HTS response code to human-readable error message
     * @param code HTS response code
     * @return errorMessage Descriptive error message
     */
    function _getHtsErrorMessage(int64 code) internal pure returns (string memory) {
        if (code == HederaResponseCodes.SUCCESS) return "Success";
        if (code == HederaResponseCodes.INVALID_SIGNATURE) return "Invalid signature";
        if (code == HederaResponseCodes.INVALID_ACCOUNT_ID) return "Invalid account ID";
        if (code == HederaResponseCodes.ACCOUNT_DELETED) return "Account deleted";
        if (code == HederaResponseCodes.INVALID_TOKEN_ID) return "Invalid token ID";
        if (code == HederaResponseCodes.TOKEN_WAS_DELETED) return "Token was deleted";
        if (code == HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT) return "Token already associated";
        if (code == HederaResponseCodes.ACCOUNT_FROZEN_FOR_TOKEN) return "Account frozen for this token";
        if (code == HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE) return "Insufficient token balance";
        if (code == HederaResponseCodes.TOKEN_NOT_ASSOCIATED_TO_ACCOUNT) return "Token not associated to account";
        if (code == HederaResponseCodes.TOKEN_IS_PAUSED) return "Token is paused";
        if (code == HederaResponseCodes.TOKENS_PER_ACCOUNT_LIMIT_EXCEEDED) return "Token association limit exceeded";
        
        return string(abi.encodePacked("Unknown HTS error: ", _int64ToString(code)));
    }
    
    /**
     * @notice Convert int64 to string
     * @param value Number to convert
     * @return String representation
     */
    function _int64ToString(int64 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        bool negative = value < 0;
        uint64 absValue = uint64(negative ? -value : value);
        
        uint256 length;
        uint64 temp = absValue;
        while (temp != 0) {
            length++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(negative ? length + 1 : length);
        uint256 index = buffer.length;
        
        while (absValue != 0) {
            index--;
            buffer[index] = bytes1(uint8(48 + absValue % 10));
            absValue /= 10;
        }
        
        if (negative) {
            buffer[0] = "-";
        }
        
        return string(buffer);
    }
}