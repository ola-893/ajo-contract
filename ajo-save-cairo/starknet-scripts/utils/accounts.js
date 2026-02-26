/**
 * Account Management Utilities
 * 
 * This module provides utilities for loading test accounts, checking balances,
 * and managing account operations for Starknet integration testing.
 */

import { Account, Contract } from 'starknet';
import { retryRead } from './retry.js';
import { colors, formatUSDC, formatTokenAmount } from './formatting.js';

/**
 * Load test accounts from environment variables
 * @param {RpcProvider} provider - Starknet provider
 * @param {number} count - Number of accounts to load (default: 10)
 * @returns {Array<Account>} Array of Account instances
 */
export function loadTestAccounts(provider, count = 10) {
  const accounts = [];
  
  for (let i = 1; i <= count; i++) {
    const address = process.env[`TEST_ACCOUNT_${i}_ADDRESS`];
    const privateKey = process.env[`TEST_ACCOUNT_${i}_PRIVATE_KEY`];
    
    if (address && privateKey) {
      try {
        const account = new Account(provider, address, privateKey);
        accounts.push(account);
      } catch (error) {
        console.log(colors.yellow(
          `  ⚠️  Failed to load test account ${i}: ${error.message}`
        ));
      }
    }
  }
  
  if (accounts.length === 0) {
    console.log(colors.yellow(
      '\n  ⚠️  No test accounts loaded. Please set TEST_ACCOUNT_X_ADDRESS and ' +
      'TEST_ACCOUNT_X_PRIVATE_KEY in your .env file.\n'
    ));
  }
  
  return accounts;
}

/**
 * Load a single test account by index
 * @param {RpcProvider} provider - Starknet provider
 * @param {number} index - Account index (1-based)
 * @returns {Account|null} Account instance or null if not found
 */
export function loadTestAccount(provider, index) {
  const address = process.env[`TEST_ACCOUNT_${index}_ADDRESS`];
  const privateKey = process.env[`TEST_ACCOUNT_${index}_PRIVATE_KEY`];
  
  if (!address || !privateKey) {
    return null;
  }
  
  try {
    return new Account(provider, address, privateKey);
  } catch (error) {
    console.log(colors.yellow(
      `  ⚠️  Failed to load test account ${index}: ${error.message}`
    ));
    return null;
  }
}

/**
 * Check ERC20 token balance for an account
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - ERC20 token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @returns {Promise<bigint>} Token balance
 */
export async function checkTokenBalance(account, tokenAddress, tokenAbi) {
  return retryRead(async () => {
    const erc20 = new Contract(tokenAbi, tokenAddress, account.provider);
    const balance = await erc20.balanceOf(account.address);
    return balance;
  }, 'Check token balance');
}

/**
 * Check USDC balance for an account
 * @param {Account} account - Starknet account
 * @param {string} usdcAddress - USDC token contract address
 * @param {object} usdcAbi - USDC contract ABI
 * @returns {Promise<bigint>} USDC balance in micro USDC
 */
export async function checkUSDCBalance(account, usdcAddress, usdcAbi) {
  return checkTokenBalance(account, usdcAddress, usdcAbi);
}

/**
 * Check ETH balance for an account
 * @param {Account} account - Starknet account
 * @param {string} ethAddress - ETH token contract address
 * @param {object} ethAbi - ETH contract ABI
 * @returns {Promise<bigint>} ETH balance in wei
 */
export async function checkETHBalance(account, ethAddress, ethAbi) {
  return checkTokenBalance(account, ethAddress, ethAbi);
}

/**
 * Check multiple token balances for an account
 * @param {Account} account - Starknet account
 * @param {Array<object>} tokens - Array of token configs {address, abi, symbol, decimals}
 * @returns {Promise<object>} Object mapping token symbols to balances
 */
export async function checkMultipleBalances(account, tokens) {
  const balances = {};
  
  for (const token of tokens) {
    try {
      const balance = await checkTokenBalance(account, token.address, token.abi);
      balances[token.symbol] = {
        raw: balance,
        formatted: formatTokenAmount(balance, token.decimals)
      };
    } catch (error) {
      balances[token.symbol] = {
        raw: 0n,
        formatted: '0',
        error: error.message
      };
    }
  }
  
  return balances;
}

/**
 * Validate account has sufficient balance
 * @param {Account} account - Starknet account
 * @param {string} tokenAddress - Token contract address
 * @param {object} tokenAbi - Token contract ABI
 * @param {bigint} requiredAmount - Required amount
 * @returns {Promise<boolean>} True if account has sufficient balance
 */
export async function validateBalance(account, tokenAddress, tokenAbi, requiredAmount) {
  try {
    const balance = await checkTokenBalance(account, tokenAddress, tokenAbi);
    return balance >= requiredAmount;
  } catch (error) {
    console.log(colors.yellow(
      `  ⚠️  Failed to validate balance: ${error.message}`
    ));
    return false;
  }
}

/**
 * Get account nonce
 * @param {Account} account - Starknet account
 * @returns {Promise<string>} Current nonce
 */
export async function getAccountNonce(account) {
  return retryRead(async () => {
    return await account.getNonce();
  }, 'Get account nonce');
}

/**
 * Check if account is deployed
 * @param {Account} account - Starknet account
 * @returns {Promise<boolean>} True if account is deployed
 */
export async function isAccountDeployed(account) {
  try {
    await account.getNonce();
    return true;
  } catch (error) {
    if (error.message.includes('Contract not found')) {
      return false;
    }
    throw error;
  }
}

/**
 * Display account information
 * @param {Account} account - Starknet account
 * @param {string} name - Account name/label
 * @param {object} tokens - Token configs for balance display
 */
export async function displayAccountInfo(account, name = 'Account', tokens = []) {
  console.log(colors.cyan(`\n  ${name}`));
  console.log(colors.dim(`  Address: ${account.address}`));
  
  try {
    const nonce = await getAccountNonce(account);
    console.log(colors.dim(`  Nonce: ${nonce}`));
  } catch (error) {
    console.log(colors.yellow(`  Nonce: Unable to fetch`));
  }
  
  if (tokens.length > 0) {
    console.log(colors.dim(`  Balances:`));
    const balances = await checkMultipleBalances(account, tokens);
    
    for (const [symbol, balance] of Object.entries(balances)) {
      if (balance.error) {
        console.log(colors.yellow(`    ${symbol}: Error - ${balance.error}`));
      } else {
        console.log(colors.dim(`    ${symbol}: ${balance.formatted}`));
      }
    }
  }
}

/**
 * Display multiple accounts in a table format
 * @param {Array<Account>} accounts - Array of accounts
 * @param {Array<string>} names - Account names
 * @param {string} tokenAddress - Token address for balance check
 * @param {object} tokenAbi - Token ABI
 * @param {number} decimals - Token decimals
 */
export async function displayAccountsTable(
  accounts,
  names,
  tokenAddress,
  tokenAbi,
  decimals = 6
) {
  console.log(colors.dim('\n  ┌────┬─────────────┬──────────────────────────────────────────────────────────────────────┬──────────────┐'));
  console.log(colors.dim('  │ #  │ Name        │ Address                                                              │ Balance      │'));
  console.log(colors.dim('  ├────┼─────────────┼──────────────────────────────────────────────────────────────────────┼──────────────┤'));
  
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const name = names[i] || `Account ${i + 1}`;
    
    let balanceStr = 'N/A';
    try {
      const balance = await checkTokenBalance(account, tokenAddress, tokenAbi);
      balanceStr = formatTokenAmount(balance, decimals);
    } catch (error) {
      balanceStr = 'Error';
    }
    
    const num = (i + 1).toString().padStart(2);
    const nameStr = name.padEnd(11).slice(0, 11);
    const addrStr = account.address.slice(0, 68).padEnd(68);
    const balStr = balanceStr.padEnd(12);
    
    console.log(colors.dim(`  │ ${num} │ ${nameStr} │ ${addrStr} │ ${balStr} │`));
  }
  
  console.log(colors.dim('  └────┴─────────────┴──────────────────────────────────────────────────────────────────────┴──────────────┘\n'));
}

/**
 * Filter accounts by minimum balance
 * @param {Array<Account>} accounts - Array of accounts
 * @param {string} tokenAddress - Token address
 * @param {object} tokenAbi - Token ABI
 * @param {bigint} minBalance - Minimum required balance
 * @returns {Promise<Array<Account>>} Filtered accounts with sufficient balance
 */
export async function filterAccountsByBalance(
  accounts,
  tokenAddress,
  tokenAbi,
  minBalance
) {
  const validAccounts = [];
  
  for (const account of accounts) {
    try {
      const balance = await checkTokenBalance(account, tokenAddress, tokenAbi);
      if (balance >= minBalance) {
        validAccounts.push(account);
      }
    } catch (error) {
      // Skip accounts with errors
      continue;
    }
  }
  
  return validAccounts;
}

/**
 * Create account info object
 * @param {Account} account - Starknet account
 * @param {string} name - Account name
 * @param {number} index - Account index
 * @returns {object} Account info object
 */
export function createAccountInfo(account, name, index) {
  return {
    account,
    name,
    index,
    address: account.address
  };
}

/**
 * Load and prepare test accounts with names
 * @param {RpcProvider} provider - Starknet provider
 * @param {number} count - Number of accounts to load
 * @param {Array<string>} names - Optional custom names
 * @returns {Array<object>} Array of account info objects
 */
export function loadTestAccountsWithNames(provider, count = 10, names = null) {
  const defaultNames = [
    'Adunni', 'Babatunde', 'Chinwe', 'Damilola', 'Emeka',
    'Funmilayo', 'Gbenga', 'Halima', 'Ifeanyi', 'Joke'
  ];
  
  const accounts = loadTestAccounts(provider, count);
  const accountNames = names || defaultNames;
  
  return accounts.map((account, index) => 
    createAccountInfo(account, accountNames[index] || `Account ${index + 1}`, index + 1)
  );
}

/**
 * Validate all accounts have minimum balance
 * @param {Array<object>} accountInfos - Array of account info objects
 * @param {string} tokenAddress - Token address
 * @param {object} tokenAbi - Token ABI
 * @param {bigint} minBalance - Minimum required balance
 * @returns {Promise<object>} Validation results
 */
export async function validateAllAccounts(
  accountInfos,
  tokenAddress,
  tokenAbi,
  minBalance
) {
  const results = {
    valid: [],
    invalid: [],
    errors: []
  };
  
  for (const info of accountInfos) {
    try {
      const balance = await checkTokenBalance(info.account, tokenAddress, tokenAbi);
      
      if (balance >= minBalance) {
        results.valid.push({ ...info, balance });
      } else {
        results.invalid.push({ ...info, balance, reason: 'Insufficient balance' });
      }
    } catch (error) {
      results.errors.push({ ...info, error: error.message });
    }
  }
  
  return results;
}

/**
 * Print account validation summary
 * @param {object} validationResults - Results from validateAllAccounts
 * @param {number} decimals - Token decimals for formatting
 */
export function printValidationSummary(validationResults, decimals = 6) {
  const { valid, invalid, errors } = validationResults;
  const total = valid.length + invalid.length + errors.length;
  
  console.log(colors.cyan('\n  Account Validation Summary'));
  console.log(colors.dim('  ─────────────────────────'));
  console.log(colors.green(`  ✅ Valid: ${valid.length}/${total}`));
  
  if (invalid.length > 0) {
    console.log(colors.yellow(`  ⚠️  Insufficient balance: ${invalid.length}`));
    invalid.forEach(info => {
      console.log(colors.dim(
        `     ${info.name}: ${formatTokenAmount(info.balance, decimals)}`
      ));
    });
  }
  
  if (errors.length > 0) {
    console.log(colors.red(`  ❌ Errors: ${errors.length}`));
    errors.forEach(info => {
      console.log(colors.dim(`     ${info.name}: ${info.error}`));
    });
  }
  
  console.log('');
}
