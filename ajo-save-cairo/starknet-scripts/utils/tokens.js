/**
 * ERC20 Token Operations Utilities
 * 
 * This module provides utilities for ERC20 token operations including
 * approvals, transfers, balance checks, and allowance management.
 */

import { Contract } from 'starknet';
import { waitForTransaction } from './starknet.js';
import { retryTransaction, retryRead } from './retry.js';
import { colors, formatUSDC, formatTokenAmount } from './formatting.js';

/**
 * Approve token spending
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} spenderAddress - Spender contract address
 * @param {bigint|string} amount - Amount to approve
 * @param {boolean} verbose - Whether to log progress
 * @returns {Promise<object>} Transaction receipt
 */
export async function approveToken(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress,
  amount,
  verbose = true
) {
  return retryTransaction(async () => {
    if (verbose) {
      console.log(colors.dim(`    Approving token spending...`));
    }
    
    const erc20 = new Contract(tokenAbi, tokenAddress, account);
    
    // Prepare the approve call
    const call = erc20.populate('approve', [spenderAddress, amount]);
    
    // Execute transaction
    const tx = await account.execute(call);
    
    if (verbose) {
      console.log(colors.dim(`    Transaction: ${tx.transaction_hash}`));
    }
    
    // Wait for confirmation
    const receipt = await waitForTransaction(
      account.provider,
      tx.transaction_hash
    );
    
    if (verbose) {
      console.log(colors.green(`    ✅ Approval confirmed`));
    }
    
    return receipt;
  }, 'Token approval');
}

/**
 * Transfer tokens
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} recipientAddress - Recipient address
 * @param {bigint|string} amount - Amount to transfer
 * @param {boolean} verbose - Whether to log progress
 * @returns {Promise<object>} Transaction receipt
 */
export async function transferToken(
  account,
  tokenAddress,
  tokenAbi,
  recipientAddress,
  amount,
  verbose = true
) {
  return retryTransaction(async () => {
    if (verbose) {
      console.log(colors.dim(`    Transferring tokens...`));
    }
    
    const erc20 = new Contract(tokenAbi, tokenAddress, account);
    
    // Prepare the transfer call
    const call = erc20.populate('transfer', [recipientAddress, amount]);
    
    // Execute transaction
    const tx = await account.execute(call);
    
    if (verbose) {
      console.log(colors.dim(`    Transaction: ${tx.transaction_hash}`));
    }
    
    // Wait for confirmation
    const receipt = await waitForTransaction(
      account.provider,
      tx.transaction_hash
    );
    
    if (verbose) {
      console.log(colors.green(`    ✅ Transfer confirmed`));
    }
    
    return receipt;
  }, 'Token transfer');
}

/**
 * Check token allowance
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} spenderAddress - Spender contract address
 * @returns {Promise<bigint>} Current allowance
 */
export async function checkAllowance(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress
) {
  return retryRead(async () => {
    const erc20 = new Contract(tokenAbi, tokenAddress, account.provider);
    const allowance = await erc20.allowance(account.address, spenderAddress);
    return allowance;
  }, 'Check allowance');
}

/**
 * Get token balance
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @returns {Promise<bigint>} Token balance
 */
export async function getTokenBalance(account, tokenAddress, tokenAbi) {
  return retryRead(async () => {
    const erc20 = new Contract(tokenAbi, tokenAddress, account.provider);
    const balance = await erc20.balanceOf(account.address);
    return balance;
  }, 'Get token balance');
}

/**
 * Get token metadata (name, symbol, decimals)
 * @param {RpcProvider} provider - Starknet provider
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @returns {Promise<object>} Token metadata
 */
export async function getTokenMetadata(provider, tokenAddress, tokenAbi) {
  return retryRead(async () => {
    const erc20 = new Contract(tokenAbi, tokenAddress, provider);
    
    const [name, symbol, decimals] = await Promise.all([
      erc20.name().catch(() => 'Unknown'),
      erc20.symbol().catch(() => 'UNKNOWN'),
      erc20.decimals().catch(() => 18)
    ]);
    
    return {
      name,
      symbol,
      decimals: Number(decimals)
    };
  }, 'Get token metadata');
}

/**
 * Approve if allowance is insufficient
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} spenderAddress - Spender contract address
 * @param {bigint} requiredAmount - Required allowance amount
 * @param {boolean} verbose - Whether to log progress
 * @returns {Promise<boolean>} True if approval was needed and executed
 */
export async function ensureAllowance(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress,
  requiredAmount,
  verbose = true
) {
  const currentAllowance = await checkAllowance(
    account,
    tokenAddress,
    tokenAbi,
    spenderAddress
  );
  
  if (currentAllowance >= requiredAmount) {
    if (verbose) {
      console.log(colors.dim(`    ✓ Sufficient allowance already set`));
    }
    return false;
  }
  
  if (verbose) {
    console.log(colors.dim(`    Current allowance insufficient, approving...`));
  }
  
  await approveToken(
    account,
    tokenAddress,
    tokenAbi,
    spenderAddress,
    requiredAmount,
    verbose
  );
  
  return true;
}

/**
 * Approve maximum amount (uint256 max)
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} spenderAddress - Spender contract address
 * @param {boolean} verbose - Whether to log progress
 * @returns {Promise<object>} Transaction receipt
 */
export async function approveMax(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress,
  verbose = true
) {
  // Maximum uint256 value
  const maxAmount = (2n ** 256n) - 1n;
  
  return approveToken(
    account,
    tokenAddress,
    tokenAbi,
    spenderAddress,
    maxAmount,
    verbose
  );
}

/**
 * Batch approve multiple spenders
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {Array<object>} approvals - Array of {spender, amount} objects
 * @param {boolean} verbose - Whether to log progress
 * @returns {Promise<Array<object>>} Array of transaction receipts
 */
export async function batchApprove(
  account,
  tokenAddress,
  tokenAbi,
  approvals,
  verbose = true
) {
  const receipts = [];
  
  for (const { spender, amount } of approvals) {
    try {
      const receipt = await approveToken(
        account,
        tokenAddress,
        tokenAbi,
        spender,
        amount,
        verbose
      );
      receipts.push({ success: true, spender, receipt });
    } catch (error) {
      receipts.push({ success: false, spender, error: error.message });
      if (verbose) {
        console.log(colors.red(`    ❌ Approval failed for ${spender}`));
      }
    }
  }
  
  return receipts;
}

/**
 * Revoke token approval (set allowance to 0)
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} spenderAddress - Spender contract address
 * @param {boolean} verbose - Whether to log progress
 * @returns {Promise<object>} Transaction receipt
 */
export async function revokeApproval(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress,
  verbose = true
) {
  return approveToken(
    account,
    tokenAddress,
    tokenAbi,
    spenderAddress,
    0n,
    verbose
  );
}

/**
 * Check if account has sufficient balance
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {bigint} requiredAmount - Required amount
 * @returns {Promise<boolean>} True if balance is sufficient
 */
export async function hasSufficientBalance(
  account,
  tokenAddress,
  tokenAbi,
  requiredAmount
) {
  try {
    const balance = await getTokenBalance(account, tokenAddress, tokenAbi);
    return balance >= requiredAmount;
  } catch (error) {
    return false;
  }
}

/**
 * Display token balance for an account
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} label - Label for display
 * @param {number} decimals - Token decimals
 */
export async function displayTokenBalance(
  account,
  tokenAddress,
  tokenAbi,
  label = 'Balance',
  decimals = 6
) {
  try {
    const balance = await getTokenBalance(account, tokenAddress, tokenAbi);
    const formatted = formatTokenAmount(balance, decimals);
    console.log(colors.dim(`  ${label}: ${formatted}`));
  } catch (error) {
    console.log(colors.yellow(`  ${label}: Error - ${error.message}`));
  }
}

/**
 * Display token allowance
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} spenderAddress - Spender contract address
 * @param {string} label - Label for display
 * @param {number} decimals - Token decimals
 */
export async function displayAllowance(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress,
  label = 'Allowance',
  decimals = 6
) {
  try {
    const allowance = await checkAllowance(
      account,
      tokenAddress,
      tokenAbi,
      spenderAddress
    );
    const formatted = formatTokenAmount(allowance, decimals);
    console.log(colors.dim(`  ${label}: ${formatted}`));
  } catch (error) {
    console.log(colors.yellow(`  ${label}: Error - ${error.message}`));
  }
}

/**
 * Parse token amount from human-readable string
 * @param {string} amount - Amount string (e.g., "100.50")
 * @param {number} decimals - Token decimals
 * @returns {bigint} Amount in smallest unit
 */
export function parseTokenAmount(amount, decimals = 6) {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const amountStr = whole + paddedFraction;
  return BigInt(amountStr);
}

/**
 * Format token amount to human-readable string
 * @param {bigint|string|number} amount - Amount in smallest unit
 * @param {number} decimals - Token decimals
 * @param {number} displayDecimals - Number of decimals to display
 * @returns {string} Formatted amount
 */
export function formatAmount(amount, decimals = 6, displayDecimals = 2) {
  if (amount === null || amount === undefined) return '0';
  
  const divisor = Math.pow(10, decimals);
  const value = Number(amount) / divisor;
  
  return value.toFixed(displayDecimals);
}

/**
 * Get total supply of a token
 * @param {RpcProvider} provider - Starknet provider
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @returns {Promise<bigint>} Total supply
 */
export async function getTotalSupply(provider, tokenAddress, tokenAbi) {
  return retryRead(async () => {
    const erc20 = new Contract(tokenAbi, tokenAddress, provider);
    const totalSupply = await erc20.totalSupply();
    return totalSupply;
  }, 'Get total supply');
}

/**
 * Prepare token for operations (check balance and approve)
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {string} spenderAddress - Spender contract address
 * @param {bigint} requiredAmount - Required amount
 * @param {boolean} verbose - Whether to log progress
 * @returns {Promise<object>} Preparation result
 */
export async function prepareToken(
  account,
  tokenAddress,
  tokenAbi,
  spenderAddress,
  requiredAmount,
  verbose = true
) {
  const result = {
    hasBalance: false,
    hasAllowance: false,
    approvalNeeded: false,
    approved: false
  };
  
  // Check balance
  const balance = await getTokenBalance(account, tokenAddress, tokenAbi);
  result.hasBalance = balance >= requiredAmount;
  
  if (!result.hasBalance) {
    if (verbose) {
      console.log(colors.yellow(`    ⚠️  Insufficient balance`));
    }
    return result;
  }
  
  // Check allowance
  const allowance = await checkAllowance(
    account,
    tokenAddress,
    tokenAbi,
    spenderAddress
  );
  result.hasAllowance = allowance >= requiredAmount;
  
  if (!result.hasAllowance) {
    result.approvalNeeded = true;
    
    if (verbose) {
      console.log(colors.dim(`    Approving token...`));
    }
    
    try {
      await approveToken(
        account,
        tokenAddress,
        tokenAbi,
        spenderAddress,
        requiredAmount,
        verbose
      );
      result.approved = true;
    } catch (error) {
      if (verbose) {
        console.log(colors.red(`    ❌ Approval failed: ${error.message}`));
      }
      throw error;
    }
  }
  
  return result;
}
