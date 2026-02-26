/**
 * Test Configuration Constants
 * 
 * This file contains all test parameters and constants used across
 * the Starknet integration testing scripts.
 */

/**
 * Test Configuration Parameters
 */
export const TEST_CONFIG = {
  // Cycle timing (in seconds)
  CYCLE_DURATION: 30, // 30 seconds for testing (vs 30 days in production)
  
  // Payment amounts (in USDC base units - 6 decimals)
  MONTHLY_PAYMENT_USDC: "50000000", // $50 USDC (50 * 10^6)
  
  // Participant configuration
  TOTAL_PARTICIPANTS: 10,
  MIN_PARTICIPANTS: 3,
  MAX_PARTICIPANTS: 20,
  
  // Retry and timeout settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // milliseconds
  RETRY_BACKOFF_MULTIPLIER: 2,
  
  // Transaction settings
  TRANSACTION_TIMEOUT: 60000, // 60 seconds
  TRANSACTION_POLL_INTERVAL: 2000, // 2 seconds
  
  // Gas settings
  GAS_MULTIPLIER: 1.5,
  MAX_FEE_MULTIPLIER: 1.2,
  
  // Balance requirements (in USDC base units)
  MIN_USDC_BALANCE: "100000000", // $100 USDC minimum
  RECOMMENDED_USDC_BALANCE: "500000000", // $500 USDC recommended
  
  // Approval amounts (in USDC base units)
  APPROVAL_AMOUNT: "1000000000000", // $1M USDC (effectively unlimited for testing)
  
  // Delays between operations (milliseconds)
  DELAY_BETWEEN_JOINS: 1500,
  DELAY_BETWEEN_PAYMENTS: 1500,
  DELAY_BETWEEN_CYCLES: 2000,
  DELAY_AFTER_CREATION: 2000,
};

/**
 * Participant Names
 * Nigerian names for test participants
 */
export const PARTICIPANT_NAMES = [
  "Adunni",
  "Babatunde",
  "Chinwe",
  "Damilola",
  "Emeka",
  "Funmilayo",
  "Gbenga",
  "Halima",
  "Ifeanyi",
  "Joke",
  "Kunle",
  "Lola",
  "Musa",
  "Ngozi",
  "Oluwaseun",
  "Patience",
  "Rasheed",
  "Sade",
  "Tunde",
  "Yetunde"
];

/**
 * Token Decimals
 */
export const TOKEN_DECIMALS = {
  USDC: 6,
  STRK: 18,
  ETH: 18
};

/**
 * Contract Operation Timeouts (milliseconds)
 */
export const OPERATION_TIMEOUTS = {
  CREATE_AJO: 120000, // 2 minutes
  JOIN_AJO: 90000, // 1.5 minutes
  PROCESS_PAYMENT: 90000, // 1.5 minutes
  DISTRIBUTE_PAYOUT: 90000, // 1.5 minutes
  CREATE_PROPOSAL: 60000, // 1 minute
  VOTE: 60000, // 1 minute
  EXECUTE_PROPOSAL: 90000, // 1.5 minutes
  SEIZE_COLLATERAL: 90000, // 1.5 minutes
};

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  INSUFFICIENT_BALANCE: "Insufficient USDC balance for operation",
  TRANSACTION_FAILED: "Transaction failed after maximum retries",
  NETWORK_ERROR: "Network error - please check your connection",
  INVALID_ACCOUNT: "Invalid account configuration",
  CONTRACT_ERROR: "Contract execution error",
  TIMEOUT: "Operation timed out",
  APPROVAL_FAILED: "Token approval failed",
  JOIN_FAILED: "Failed to join Ajo",
  PAYMENT_FAILED: "Payment processing failed",
};

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  AJO_CREATED: "Ajo successfully created",
  PARTICIPANT_JOINED: "Participant successfully joined",
  PAYMENT_PROCESSED: "Payment successfully processed",
  PAYOUT_DISTRIBUTED: "Payout successfully distributed",
  PROPOSAL_CREATED: "Proposal successfully created",
  VOTE_SUBMITTED: "Vote successfully submitted",
  COLLATERAL_SEIZED: "Collateral successfully seized",
};

/**
 * Console Output Configuration
 */
export const OUTPUT_CONFIG = {
  BANNER_WIDTH: 88,
  TABLE_PADDING: 2,
  MAX_ADDRESS_DISPLAY: 10, // Show first 10 chars of address
  DECIMAL_PLACES: 2, // For USDC display
  SHOW_TIMESTAMPS: true,
  SHOW_TX_HASHES: true,
  SHOW_EXPLORER_LINKS: true,
};

/**
 * Governance Configuration
 */
export const GOVERNANCE_CONFIG = {
  VOTING_PERIOD: 60, // seconds for testing
  QUORUM_PERCENTAGE: 51, // 51% quorum
  PROPOSAL_THRESHOLD: 1, // 1 member can propose
  EXECUTION_DELAY: 10, // seconds
};

/**
 * Collateral Configuration
 */
export const COLLATERAL_CONFIG = {
  BASE_COLLATERAL_PERCENTAGE: 10, // 10% of total commitment
  GUARANTOR_MULTIPLIER: 2, // Guarantors need 2x collateral
  MAX_GUARANTORS: 3,
  COLLATERAL_BUFFER: 5, // 5% buffer for calculations
};

/**
 * Network-specific delays (milliseconds)
 * Starknet Sepolia can be slower than mainnet
 */
export const NETWORK_DELAYS = {
  sepolia: {
    BLOCK_TIME: 30000, // ~30 seconds
    CONFIRMATION_BLOCKS: 1,
    EXTRA_WAIT: 5000, // Extra 5s for safety
  },
  mainnet: {
    BLOCK_TIME: 30000, // ~30 seconds
    CONFIRMATION_BLOCKS: 1,
    EXTRA_WAIT: 2000, // Extra 2s for safety
  }
};

/**
 * RPC Configuration
 */
export const RPC_CONFIG = {
  MAX_RETRIES: 5,
  RETRY_DELAY: 1000,
  RATE_LIMIT_DELAY: 2000, // Delay when rate limited
  BATCH_SIZE: 10, // Max calls in batch
};

/**
 * Logging Configuration
 */
export const LOG_CONFIG = {
  VERBOSE: process.env.VERBOSE === 'true',
  DEBUG: process.env.DEBUG === 'true',
  SAVE_LOGS: process.env.SAVE_LOGS === 'true',
  LOG_FILE: 'starknet-test.log',
};

/**
 * Helper function to parse USDC amount from string
 * @param {string} amount - Amount in USDC (e.g., "50" for $50)
 * @returns {string} Amount in base units
 */
export function parseUSDC(amount) {
  return (parseFloat(amount) * Math.pow(10, TOKEN_DECIMALS.USDC)).toString();
}

/**
 * Helper function to format USDC amount for display
 * @param {string|bigint} amount - Amount in base units
 * @returns {string} Formatted amount (e.g., "50.00")
 */
export function formatUSDC(amount) {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const divisor = BigInt(Math.pow(10, TOKEN_DECIMALS.USDC));
  const dollars = Number(value) / Number(divisor);
  return dollars.toFixed(OUTPUT_CONFIG.DECIMAL_PLACES);
}

/**
 * Helper function to calculate required balance for participant
 * @param {number} cycles - Number of cycles to participate
 * @returns {string} Required balance in base units
 */
export function calculateRequiredBalance(cycles = 12) {
  const monthlyPayment = BigInt(TEST_CONFIG.MONTHLY_PAYMENT_USDC);
  const totalPayments = monthlyPayment * BigInt(cycles);
  const collateral = (totalPayments * BigInt(COLLATERAL_CONFIG.BASE_COLLATERAL_PERCENTAGE)) / 100n;
  const buffer = (totalPayments * BigInt(COLLATERAL_CONFIG.COLLATERAL_BUFFER)) / 100n;
  
  return (totalPayments + collateral + buffer).toString();
}

/**
 * Export all constants as default
 */
export default {
  TEST_CONFIG,
  PARTICIPANT_NAMES,
  TOKEN_DECIMALS,
  OPERATION_TIMEOUTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  OUTPUT_CONFIG,
  GOVERNANCE_CONFIG,
  COLLATERAL_CONFIG,
  NETWORK_DELAYS,
  RPC_CONFIG,
  LOG_CONFIG,
  parseUSDC,
  formatUSDC,
  calculateRequiredBalance,
};
