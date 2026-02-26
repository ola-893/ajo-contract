/**
 * Retry Logic and Error Handling Utilities
 * 
 * This module provides utilities for retrying operations with exponential backoff,
 * handling network errors, and providing graceful error recovery.
 */

import { colors } from './formatting.js';

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Async operation to retry
 * @param {string} operationName - Name of operation for logging
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 2000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 30000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @param {boolean} options.verbose - Whether to log retry attempts (default: true)
 * @returns {Promise<any>} Result of the operation
 * @throws {Error} If all retry attempts fail
 */
export async function retryWithBackoff(
  operation,
  operationName,
  options = {}
) {
  const {
    maxRetries = 3,
    baseDelay = 2000,
    maxDelay = 30000,
    shouldRetry = defaultShouldRetry,
    verbose = true
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (verbose && attempt > 1) {
        console.log(colors.dim(`  ⏳ Attempt ${attempt}/${maxRetries}: ${operationName}`));
      }
      
      const result = await operation();
      
      if (verbose && attempt > 1) {
        console.log(colors.green(`  ✅ ${operationName} succeeded on attempt ${attempt}`));
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        if (verbose) {
          console.log(colors.red(`  ❌ ${operationName} failed (non-retryable): ${error.message}`));
        }
        throw error;
      }
      
      // If this was the last attempt, throw
      if (attempt >= maxRetries) {
        if (verbose) {
          console.log(colors.red(`  ❌ ${operationName} failed after ${maxRetries} attempts`));
        }
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      
      if (verbose) {
        console.log(colors.yellow(`  ⚠️  ${operationName} failed: ${error.message.slice(0, 100)}`));
        console.log(colors.dim(`  🔄 Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`));
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Default function to determine if an error should be retried
 * @param {Error} error - Error to check
 * @returns {boolean} True if error should be retried
 */
function defaultShouldRetry(error) {
  const message = error.message.toLowerCase();
  
  // Network-related errors that should be retried
  const retryableErrors = [
    'network',
    'timeout',
    'econnreset',
    'econnrefused',
    'etimedout',
    'socket hang up',
    '502',
    '503',
    '504',
    'rate limit',
    'too many requests',
    'nonce',
    'invalid transaction nonce',
    'transaction hash not found'
  ];
  
  return retryableErrors.some(pattern => message.includes(pattern));
}

/**
 * Retry a transaction with automatic nonce handling
 * @param {Function} txOperation - Transaction operation to retry
 * @param {string} operationName - Name of operation for logging
 * @param {object} options - Retry options
 * @returns {Promise<any>} Transaction result
 */
export async function retryTransaction(txOperation, operationName, options = {}) {
  return retryWithBackoff(
    txOperation,
    operationName,
    {
      maxRetries: 5,
      baseDelay: 3000,
      shouldRetry: (error) => {
        const message = error.message.toLowerCase();
        return (
          message.includes('nonce') ||
          message.includes('network') ||
          message.includes('timeout') ||
          message.includes('502') ||
          message.includes('503')
        );
      },
      ...options
    }
  );
}

/**
 * Retry a read operation (view function)
 * @param {Function} readOperation - Read operation to retry
 * @param {string} operationName - Name of operation for logging
 * @param {object} options - Retry options
 * @returns {Promise<any>} Read result
 */
export async function retryRead(readOperation, operationName, options = {}) {
  return retryWithBackoff(
    readOperation,
    operationName,
    {
      maxRetries: 3,
      baseDelay: 1000,
      verbose: false, // Less verbose for read operations
      ...options
    }
  );
}

/**
 * Execute multiple operations with retry logic
 * @param {Array<Function>} operations - Array of async operations
 * @param {Array<string>} operationNames - Names of operations
 * @param {object} options - Retry options
 * @returns {Promise<Array>} Array of results
 */
export async function retryBatch(operations, operationNames, options = {}) {
  const results = [];
  
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    const name = operationNames[i] || `Operation ${i + 1}`;
    
    try {
      const result = await retryWithBackoff(operation, name, options);
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error });
    }
  }
  
  return results;
}

/**
 * Wrap an operation with timeout
 * @param {Function} operation - Async operation
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error message
 * @returns {Promise<any>} Operation result
 * @throws {Error} If operation times out
 */
export async function withTimeout(operation, timeoutMs, operationName = 'Operation') {
  return Promise.race([
    operation(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Retry with timeout
 * @param {Function} operation - Async operation
 * @param {string} operationName - Name of operation
 * @param {object} options - Options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {number} options.maxRetries - Maximum retries
 * @returns {Promise<any>} Operation result
 */
export async function retryWithTimeout(operation, operationName, options = {}) {
  const { timeout = 60000, ...retryOptions } = options;
  
  return retryWithBackoff(
    () => withTimeout(operation, timeout, operationName),
    operationName,
    retryOptions
  );
}

/**
 * Handle errors gracefully with custom error messages
 * @param {Error} error - Error to handle
 * @param {string} context - Context where error occurred
 * @returns {object} Formatted error information
 */
export function handleError(error, context = '') {
  const errorInfo = {
    message: error.message,
    context,
    type: 'unknown',
    retryable: false,
    suggestions: []
  };
  
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes('network') || message.includes('econnreset')) {
    errorInfo.type = 'network';
    errorInfo.retryable = true;
    errorInfo.suggestions = [
      'Check your internet connection',
      'Verify RPC endpoint is accessible',
      'Try again in a few moments'
    ];
  }
  
  // Timeout errors
  else if (message.includes('timeout')) {
    errorInfo.type = 'timeout';
    errorInfo.retryable = true;
    errorInfo.suggestions = [
      'Network may be congested',
      'Try increasing timeout value',
      'Retry the operation'
    ];
  }
  
  // Nonce errors
  else if (message.includes('nonce')) {
    errorInfo.type = 'nonce';
    errorInfo.retryable = true;
    errorInfo.suggestions = [
      'Wait a moment and retry',
      'Nonce will be automatically updated'
    ];
  }
  
  // Insufficient balance
  else if (message.includes('balance') || message.includes('insufficient')) {
    errorInfo.type = 'balance';
    errorInfo.retryable = false;
    errorInfo.suggestions = [
      'Check account balance',
      'Fund account with required tokens',
      'Verify token allowances'
    ];
  }
  
  // Contract errors
  else if (message.includes('revert') || message.includes('execution failed')) {
    errorInfo.type = 'contract';
    errorInfo.retryable = false;
    errorInfo.suggestions = [
      'Check contract state and requirements',
      'Verify function parameters',
      'Review contract logic'
    ];
  }
  
  // Rate limiting
  else if (message.includes('rate limit') || message.includes('too many requests')) {
    errorInfo.type = 'rate_limit';
    errorInfo.retryable = true;
    errorInfo.suggestions = [
      'Wait before retrying',
      'Use a different RPC endpoint',
      'Reduce request frequency'
    ];
  }
  
  return errorInfo;
}

/**
 * Print formatted error information
 * @param {Error} error - Error to print
 * @param {string} context - Context where error occurred
 */
export function printError(error, context = '') {
  const errorInfo = handleError(error, context);
  
  console.log(colors.red(`\n  ❌ Error: ${errorInfo.message}`));
  
  if (context) {
    console.log(colors.dim(`  Context: ${context}`));
  }
  
  console.log(colors.dim(`  Type: ${errorInfo.type}`));
  console.log(colors.dim(`  Retryable: ${errorInfo.retryable ? 'Yes' : 'No'}`));
  
  if (errorInfo.suggestions.length > 0) {
    console.log(colors.yellow('\n  Suggestions:'));
    errorInfo.suggestions.forEach(suggestion => {
      console.log(colors.dim(`    • ${suggestion}`));
    });
  }
  
  console.log('');
}

/**
 * Create a retry wrapper for a function
 * @param {Function} fn - Function to wrap
 * @param {string} name - Function name
 * @param {object} options - Retry options
 * @returns {Function} Wrapped function with retry logic
 */
export function withRetry(fn, name, options = {}) {
  return async (...args) => {
    return retryWithBackoff(
      () => fn(...args),
      name,
      options
    );
  };
}

/**
 * Execute operations in parallel with retry
 * @param {Array<Function>} operations - Array of async operations
 * @param {object} options - Options
 * @param {number} options.concurrency - Maximum concurrent operations
 * @param {object} options.retryOptions - Retry options for each operation
 * @returns {Promise<Array>} Array of results
 */
export async function parallelRetry(operations, options = {}) {
  const { concurrency = 5, retryOptions = {} } = options;
  
  const results = [];
  const executing = [];
  
  for (const [index, operation] of operations.entries()) {
    const promise = retryWithBackoff(
      operation,
      `Operation ${index + 1}`,
      { ...retryOptions, verbose: false }
    ).then(
      result => ({ success: true, result, index }),
      error => ({ success: false, error, index })
    );
    
    results.push(promise);
    
    if (concurrency <= operations.length) {
      const e = promise.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
}
