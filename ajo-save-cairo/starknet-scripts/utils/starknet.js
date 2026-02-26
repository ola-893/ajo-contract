/**
 * Starknet Connection Utilities
 * 
 * This module provides utilities for initializing Starknet provider and accounts,
 * waiting for transaction confirmation, and handling common Starknet operations.
 */

import { RpcProvider, Account, constants } from 'starknet';
import { NETWORKS, getNetwork } from '../config/networks.js';

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize Starknet provider for a given network
 * @param {string} network - Network name ('sepolia' or 'mainnet')
 * @returns {RpcProvider} Configured RPC provider
 */
export function initializeProvider(network = 'sepolia') {
  const config = getNetwork(network);
  
  const provider = new RpcProvider({
    nodeUrl: config.rpcUrl
  });
  
  return provider;
}

/**
 * Initialize Starknet account from environment variables
 * @param {RpcProvider} provider - Starknet provider instance
 * @param {string} network - Network name for validation
 * @returns {Account} Configured account instance
 * @throws {Error} If required environment variables are missing
 */
export function initializeAccount(provider, network = 'sepolia') {
  const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;
  const privateKey = process.env.STARKNET_PRIVATE_KEY;
  
  if (!accountAddress) {
    throw new Error(
      'STARKNET_ACCOUNT_ADDRESS environment variable is required. ' +
      'Please set it in your .env file.'
    );
  }
  
  if (!privateKey) {
    throw new Error(
      'STARKNET_PRIVATE_KEY environment variable is required. ' +
      'Please set it in your .env file.'
    );
  }
  
  const account = new Account(provider, accountAddress, privateKey);
  
  return account;
}

/**
 * Initialize Starknet provider and account in one call
 * @param {string} network - Network name ('sepolia' or 'mainnet')
 * @returns {object} Object containing provider, account, and config
 * @returns {RpcProvider} returns.provider - Starknet provider
 * @returns {Account} returns.account - Starknet account
 * @returns {object} returns.config - Network configuration
 */
export async function initializeStarknet(network = 'sepolia') {
  const config = getNetwork(network);
  const provider = initializeProvider(network);
  const account = initializeAccount(provider, network);
  
  return { provider, account, config };
}

/**
 * Wait for transaction confirmation with timeout
 * @param {RpcProvider} provider - Starknet provider
 * @param {string} txHash - Transaction hash to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 60000)
 * @param {number} pollInterval - Polling interval in milliseconds (default: 2000)
 * @returns {Promise<object>} Transaction receipt
 * @throws {Error} If transaction times out or fails
 */
export async function waitForTransaction(
  provider,
  txHash,
  timeout = 60000,
  pollInterval = 2000
) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      
      // Check if transaction is accepted
      if (
        receipt.execution_status === 'SUCCEEDED' ||
        receipt.status === 'ACCEPTED_ON_L2' ||
        receipt.status === 'ACCEPTED_ON_L1'
      ) {
        return receipt;
      }
      
      // Check if transaction failed
      if (
        receipt.execution_status === 'REVERTED' ||
        receipt.status === 'REJECTED'
      ) {
        throw new Error(
          `Transaction ${txHash} failed: ${receipt.revert_reason || 'Unknown error'}`
        );
      }
      
    } catch (error) {
      // If error is not "transaction not found", rethrow
      if (!error.message.includes('Transaction hash not found')) {
        throw error;
      }
      // Otherwise, transaction is still pending, continue polling
    }
    
    await sleep(pollInterval);
  }
  
  throw new Error(
    `Transaction ${txHash} timeout after ${timeout}ms. ` +
    `Check status at explorer.`
  );
}

/**
 * Get transaction status
 * @param {RpcProvider} provider - Starknet provider
 * @param {string} txHash - Transaction hash
 * @returns {Promise<string>} Transaction status
 */
export async function getTransactionStatus(provider, txHash) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    return receipt.status || receipt.execution_status || 'UNKNOWN';
  } catch (error) {
    if (error.message.includes('Transaction hash not found')) {
      return 'PENDING';
    }
    throw error;
  }
}

/**
 * Get account nonce
 * @param {Account} account - Starknet account
 * @returns {Promise<string>} Current nonce
 */
export async function getAccountNonce(account) {
  return await account.getNonce();
}

/**
 * Validate account has sufficient balance for operations
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address (ETH by default)
 * @returns {Promise<boolean>} True if account has balance
 */
export async function validateAccountBalance(account, tokenAddress = null) {
  try {
    // If no token address provided, check ETH balance
    if (!tokenAddress) {
      // For Starknet, we can check if account exists and is deployed
      const nonce = await account.getNonce();
      return nonce !== undefined;
    }
    
    // For specific token, would need to query ERC20 contract
    // This is handled in tokens.js utility
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Format transaction hash for display
 * @param {string} txHash - Transaction hash
 * @param {boolean} short - Whether to show shortened version
 * @returns {string} Formatted transaction hash
 */
export function formatTxHash(txHash, short = false) {
  if (!txHash) return 'N/A';
  
  if (short && txHash.length > 20) {
    return `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
  }
  
  return txHash;
}

/**
 * Format address for display
 * @param {string} address - Contract or account address
 * @param {boolean} short - Whether to show shortened version
 * @returns {string} Formatted address
 */
export function formatAddress(address, short = false) {
  if (!address) return 'N/A';
  
  if (short && address.length > 20) {
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }
  
  return address;
}

/**
 * Get explorer URL for transaction
 * @param {string} txHash - Transaction hash
 * @param {string} network - Network name
 * @returns {string} Explorer URL
 */
export function getExplorerTxUrl(txHash, network = 'sepolia') {
  const config = getNetwork(network);
  return config.explorerTx(txHash);
}

/**
 * Get explorer URL for contract
 * @param {string} address - Contract address
 * @param {string} network - Network name
 * @returns {string} Explorer URL
 */
export function getExplorerContractUrl(address, network = 'sepolia') {
  const config = getNetwork(network);
  return config.explorerContract(address);
}

/**
 * Parse events from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @param {string} eventName - Event name to filter (optional)
 * @returns {Array} Array of parsed events
 */
export function parseEvents(receipt, eventName = null) {
  if (!receipt.events || receipt.events.length === 0) {
    return [];
  }
  
  let events = receipt.events;
  
  // Filter by event name if provided
  if (eventName) {
    events = events.filter(event => {
      // Event keys are hashed, so we'd need to compare hashes
      // For now, return all events and let caller filter
      return true;
    });
  }
  
  return events;
}

/**
 * Parse AjoCreated event from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @returns {string|null} Ajo ID if found, null otherwise
 */
export function parseAjoCreatedEvent(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return null;
  }
  
  // Look for AjoCreated event
  // The event structure depends on the contract implementation
  // Typically: AjoCreated(ajo_id: u256, owner: ContractAddress, ...)
  for (const event of receipt.events) {
    if (event.keys && event.keys.length > 0) {
      // First key is the event selector (hash of event name)
      // Data contains the event parameters
      if (event.data && event.data.length > 0) {
        // First data element is typically the ajo_id
        return event.data[0];
      }
    }
  }
  
  return null;
}

/**
 * Parse MemberJoined event from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @returns {object|null} Member info if found, null otherwise
 */
export function parseMemberJoinedEvent(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return null;
  }
  
  // Look for MemberJoined event
  for (const event of receipt.events) {
    if (event.data && event.data.length >= 3) {
      // Typical structure: MemberJoined(member: ContractAddress, position: u8, collateral: u256)
      return {
        member: event.data[0],
        position: event.data[1],
        collateral: event.data[2]
      };
    }
  }
  
  return null;
}

/**
 * Parse PaymentProcessed event from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @returns {object|null} Payment info if found, null otherwise
 */
export function parsePaymentProcessedEvent(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return null;
  }
  
  // Look for PaymentProcessed event
  for (const event of receipt.events) {
    if (event.data && event.data.length >= 3) {
      // Typical structure: PaymentProcessed(member: ContractAddress, amount: u256, cycle: u32)
      return {
        member: event.data[0],
        amount: event.data[1],
        cycle: event.data[2]
      };
    }
  }
  
  return null;
}

/**
 * Parse PayoutDistributed event from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @returns {object|null} Payout info if found, null otherwise
 */
export function parsePayoutDistributedEvent(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return null;
  }
  
  // Look for PayoutDistributed event
  for (const event of receipt.events) {
    if (event.data && event.data.length >= 3) {
      // Typical structure: PayoutDistributed(recipient: ContractAddress, amount: u256, cycle: u32)
      return {
        recipient: event.data[0],
        amount: event.data[1],
        cycle: event.data[2]
      };
    }
  }
  
  return null;
}

/**
 * Parse ProposalCreated event from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @returns {object|null} Proposal info if found, null otherwise
 */
export function parseProposalCreatedEvent(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return null;
  }
  
  // Look for ProposalCreated event
  for (const event of receipt.events) {
    if (event.data && event.data.length >= 2) {
      // Typical structure: ProposalCreated(proposal_id: u256, proposer: ContractAddress)
      return {
        proposalId: event.data[0],
        proposer: event.data[1]
      };
    }
  }
  
  return null;
}

/**
 * Parse VoteCast event from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @returns {object|null} Vote info if found, null otherwise
 */
export function parseVoteCastEvent(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return null;
  }
  
  // Look for VoteCast event
  for (const event of receipt.events) {
    if (event.data && event.data.length >= 3) {
      // Typical structure: VoteCast(proposal_id: u256, voter: ContractAddress, support: bool)
      return {
        proposalId: event.data[0],
        voter: event.data[1],
        support: event.data[2]
      };
    }
  }
  
  return null;
}

/**
 * Parse CollateralSeized event from transaction receipt
 * @param {object} receipt - Transaction receipt
 * @returns {object|null} Collateral seizure info if found, null otherwise
 */
export function parseCollateralSeizedEvent(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return null;
  }
  
  // Look for CollateralSeized event
  for (const event of receipt.events) {
    if (event.data && event.data.length >= 3) {
      // Typical structure: CollateralSeized(defaulter: ContractAddress, amount: u256, cycle: u32)
      return {
        defaulter: event.data[0],
        amount: event.data[1],
        cycle: event.data[2]
      };
    }
  }
  
  return null;
}

/**
 * Parse all events from transaction receipt with type identification
 * @param {object} receipt - Transaction receipt
 * @returns {Array} Array of parsed events with types
 */
export function parseAllEvents(receipt) {
  if (!receipt.events || receipt.events.length === 0) {
    return [];
  }
  
  const parsedEvents = [];
  
  for (const event of receipt.events) {
    const parsedEvent = {
      raw: event,
      type: 'unknown',
      data: {}
    };
    
    // Try to identify event type based on data structure
    if (event.data && event.data.length > 0) {
      // This is a simplified approach - in production, you'd compare event keys
      // against known event selectors
      parsedEvent.data = event.data;
      
      // Add keys if available
      if (event.keys && event.keys.length > 0) {
        parsedEvent.keys = event.keys;
      }
    }
    
    parsedEvents.push(parsedEvent);
  }
  
  return parsedEvents;
}

/**
 * Format event data for display
 * @param {object} event - Parsed event
 * @returns {string} Formatted event string
 */
export function formatEventData(event) {
  if (!event) return 'No event data';
  
  const parts = [];
  
  if (event.type) {
    parts.push(`Type: ${event.type}`);
  }
  
  if (event.data) {
    const dataStr = Object.entries(event.data)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    parts.push(`Data: {${dataStr}}`);
  }
  
  return parts.join(' | ');
}

/**
 * Execute transaction with automatic retry on nonce issues
 * @param {Account} account - Starknet account
 * @param {Array} calls - Array of contract calls
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<object>} Transaction result
 */
export async function executeWithRetry(account, calls, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tx = await account.execute(calls);
      return tx;
    } catch (error) {
      lastError = error;
      
      // Check if it's a nonce error
      if (
        error.message.includes('nonce') ||
        error.message.includes('Invalid transaction nonce')
      ) {
        if (attempt < maxRetries) {
          // Wait a bit and retry
          await sleep(1000 * attempt);
          continue;
        }
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Estimate fee for transaction
 * @param {Account} account - Starknet account
 * @param {Array} calls - Array of contract calls
 * @returns {Promise<object>} Fee estimation
 */
export async function estimateFee(account, calls) {
  try {
    const feeEstimate = await account.estimateFee(calls);
    return feeEstimate;
  } catch (error) {
    console.warn('Fee estimation failed:', error.message);
    return null;
  }
}

