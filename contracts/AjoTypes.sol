// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title AjoTypes
 * @dev A central library for all shared enums and structs used across the Ajo protocol.
 * This prevents re-declaration and provides a single source of truth for data structures.
 */
library AjoTypes {
    enum PaymentToken { USDC, HBAR }

    struct Member {
        uint256 queueNumber;
        uint256 joinedCycle;
        uint256 totalPaid;
        uint256 requiredCollateral;
        uint256 lockedCollateral;
        uint256 lastPaymentCycle;
        uint256 defaultCount;
        bool hasReceivedPayout;
        bool isActive;
        address guarantor;
        PaymentToken preferredToken;
        uint256 reputationScore;
    }

    struct TokenConfig {
        uint256 monthlyPayment;
        bool isActive;
    }

    struct PayoutRecord {
        address recipient;
        uint256 amount;
        uint256 cycle;
        uint256 timestamp;
    }

    struct Proposal {
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 proposalEndTime;
        bool executed;
        bytes proposalData;
    }
}