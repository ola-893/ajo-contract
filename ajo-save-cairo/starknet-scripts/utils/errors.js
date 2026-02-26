/**
 * Error Handling Utilities
 * 
 * Comprehensive error handling with detailed messages and recovery suggestions
 */

import chalk from 'chalk';

/**
 * Error types and their recovery suggestions
 */
export const ERROR_TYPES = {
  NETWORK: {
    name: 'Network Error',
    suggestions: [
      'Check your internet connection',
      'Verify RPC endpoint is accessible',
      'Try using a different RPC provider',
      'Wait a few moments and retry'
    ]
  },
  TRANSACTION: {
    name: 'Transaction Error',
    suggestions: [
      'Check account has sufficient STRK for gas',
      'Verify transaction parameters are correct',
      'Ensure nonce is not stale',
      'Try increasing gas limit'
    ]
  },
  CONTRACT: {
    name: 'Contract Error',
    suggestions: [
      'Verify contract address is correct',
      'Check contract is deployed on the network',
      'Ensure ABI matches contract version',
      'Verify function parameters are valid'
    ]
  },
  BALANCE: {
    name: 'Insufficient Balance',
    suggestions: [
      'Fund account with STRK for gas fees',
      'Fund account with USDC for operations',
      'Use Starknet Sepolia faucet: https://faucet.goerli.starknet.io/',
      'Check token balance with: starkli balance <address>'
    ]
  },
  APPROVAL: {
    name: 'Token Approval Error',
    suggestions: [
      'Approve token spending before operations',
      'Check allowance is sufficient',
      'Verify spender address is correct',
      'Try approving a larger amount'
    ]
  },
  TIMEOUT: {
    name: 'Operation Timeout',
    suggestions: [
      'Network may be congested, try again later',
      'Increase timeout duration',
      'Check transaction status on explorer',
      'Verify RPC endpoint is responsive'
    ]
  },
  CONFIGURATION: {
    name: 'Configuration Error',
    suggestions: [
      'Check .env file exists and is properly formatted',
      'Verify all required environment variables are set',
      'Ensure private keys are valid',
      'Check contract addresses are correct'
    ]
  },
  ACCOUNT: {
    name: 'Account Error',
    suggestions: [
      'Verify account address is valid',
      'Check private key is correct',
      'Ensure account is deployed on network',
      'Try using a different account'
    ]
  }
};

/**
 * Parse error and determine type
 */
export function parseError(error) {
  const message = error.message || error.toString();
  
  // Network errors
  if (
    message.includes('network') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('fetch failed')
  ) {
    return { type: ERROR_TYPES.NETWORK, originalError: error };
  }
  
  // Transaction errors
  if (
    message.includes('transaction') ||
    message.includes('nonce') ||
    message.includes('gas') ||
    message.includes('REJECTED') ||
    message.includes('REVERTED')
  ) {
    return { type: ERROR_TYPES.TRANSACTION, originalError: error };
  }
  
  // Contract errors
  if (
    message.includes('contract') ||
    message.includes('ABI') ||
    message.includes('function') ||
    message.includes('not found')
  ) {
    return { type: ERROR_TYPES.CONTRACT, originalError: error };
  }
  
  // Balance errors
  if (
    message.includes('insufficient') ||
    message.includes('balance') ||
    message.includes('funds')
  ) {
    return { type: ERROR_TYPES.BALANCE, originalError: error };
  }
  
  // Approval errors
  if (
    message.includes('allowance') ||
    message.includes('approve') ||
    message.includes('ERC20')
  ) {
    return { type: ERROR_TYPES.APPROVAL, originalError: error };
  }
  
  // Timeout errors
  if (
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return { type: ERROR_TYPES.TIMEOUT, originalError: error };
  }
  
  // Configuration errors
  if (
    message.includes('environment') ||
    message.includes('config') ||
    message.includes('missing')
  ) {
    return { type: ERROR_TYPES.CONFIGURATION, originalError: error };
  }
  
  // Account errors
  if (
    message.includes('account') ||
    message.includes('private key') ||
    message.includes('address')
  ) {
    return { type: ERROR_TYPES.ACCOUNT, originalError: error };
  }
  
  // Unknown error
  return { type: null, originalError: error };
}

/**
 * Format error message with suggestions
 */
export function formatError(error, context = '') {
  const parsed = parseError(error);
  const message = error.message || error.toString();
  
  console.error(chalk.red('\n' + '═'.repeat(88)));
  console.error(chalk.red('║') + chalk.bold.red(' ERROR ').padEnd(87) + chalk.red('║'));
  console.error(chalk.red('═'.repeat(88)));
  
  if (context) {
    console.error(chalk.yellow(`\n📍 Context: ${context}`));
  }
  
  if (parsed.type) {
    console.error(chalk.red(`\n❌ ${parsed.type.name}`));
  } else {
    console.error(chalk.red('\n❌ Unknown Error'));
  }
  
  console.error(chalk.dim(`\n💬 Message:`));
  console.error(chalk.white(`   ${message.slice(0, 200)}${message.length > 200 ? '...' : ''}`));
  
  if (parsed.type && parsed.type.suggestions.length > 0) {
    console.error(chalk.cyan(`\n💡 Suggestions:`));
    parsed.type.suggestions.forEach((suggestion, index) => {
      console.error(chalk.dim(`   ${index + 1}. ${suggestion}`));
    });
  }
  
  if (process.env.DEBUG) {
    console.error(chalk.dim(`\n🔍 Stack Trace:`));
    console.error(chalk.dim(error.stack));
  } else {
    console.error(chalk.dim(`\n💡 Run with DEBUG=true for full stack trace`));
  }
  
  console.error(chalk.red('\n' + '═'.repeat(88) + '\n'));
}

/**
 * Handle transaction failure
 */
export function handleTransactionFailure(txHash, error, context = '') {
  console.error(chalk.red('\n' + '═'.repeat(88)));
  console.error(chalk.red('║') + chalk.bold.red(' TRANSACTION FAILED ').padEnd(87) + chalk.red('║'));
  console.error(chalk.red('═'.repeat(88)));
  
  if (context) {
    console.error(chalk.yellow(`\n📍 Context: ${context}`));
  }
  
  console.error(chalk.red(`\n❌ Transaction Hash: ${txHash}`));
  console.error(chalk.dim(`   Explorer: https://sepolia.voyager.online/tx/${txHash}`));
  
  const message = error.message || error.toString();
  console.error(chalk.dim(`\n💬 Error: ${message.slice(0, 200)}`));
  
  console.error(chalk.cyan(`\n💡 Next Steps:`));
  console.error(chalk.dim('   1. Check transaction status on Voyager explorer'));
  console.error(chalk.dim('   2. Verify account has sufficient STRK for gas'));
  console.error(chalk.dim('   3. Check contract state and parameters'));
  console.error(chalk.dim('   4. Retry operation if transaction was rejected'));
  
  console.error(chalk.red('\n' + '═'.repeat(88) + '\n'));
}

/**
 * Handle network error with retry suggestion
 */
export function handleNetworkError(error, attempt, maxAttempts) {
  const message = error.message || error.toString();
  
  console.error(chalk.yellow('\n⚠️  Network Error'));
  console.error(chalk.dim(`   ${message.slice(0, 150)}`));
  
  if (attempt < maxAttempts) {
    const delay = Math.pow(2, attempt) * 1000;
    console.error(chalk.cyan(`   🔄 Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${maxAttempts})`));
  } else {
    console.error(chalk.red(`   ❌ Max retries (${maxAttempts}) reached`));
    console.error(chalk.dim('   💡 Check network connection and RPC endpoint'));
  }
}

/**
 * Validate environment configuration
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  
  // Required variables
  const required = {
    'STARKNET_ACCOUNT_ADDRESS': 'Main account address for operations',
    'STARKNET_PRIVATE_KEY': 'Private key for main account'
  };
  
  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      errors.push({ key, description, severity: 'error' });
    }
  }
  
  // Optional but recommended
  const recommended = {
    'STARKNET_RPC': 'Custom RPC endpoint (defaults to public endpoint)',
    'TEST_ACCOUNT_1_ADDRESS': 'Test account for multi-participant demos',
    'TEST_ACCOUNT_1_PRIVATE_KEY': 'Private key for test account'
  };
  
  for (const [key, description] of Object.entries(recommended)) {
    if (!process.env[key]) {
      warnings.push({ key, description, severity: 'warning' });
    }
  }
  
  if (errors.length > 0) {
    console.error(chalk.red('\n❌ Missing Required Configuration:\n'));
    errors.forEach(({ key, description }) => {
      console.error(chalk.red(`   • ${key}`));
      console.error(chalk.dim(`     ${description}`));
    });
    console.error(chalk.dim('\n💡 Create a .env file based on .env.example\n'));
    return false;
  }
  
  if (warnings.length > 0) {
    console.warn(chalk.yellow('\n⚠️  Optional Configuration Missing:\n'));
    warnings.forEach(({ key, description }) => {
      console.warn(chalk.yellow(`   • ${key}`));
      console.warn(chalk.dim(`     ${description}`));
    });
    console.warn(chalk.dim('\n💡 Some features may have limited functionality\n'));
  }
  
  return true;
}

/**
 * Wrap async operation with error handling
 */
export async function withErrorHandling(operation, context, options = {}) {
  const { silent = false, throwOnError = true } = options;
  
  try {
    return await operation();
  } catch (error) {
    if (!silent) {
      formatError(error, context);
    }
    
    if (throwOnError) {
      throw error;
    }
    
    return null;
  }
}

/**
 * Create user-friendly error message
 */
export class UserFriendlyError extends Error {
  constructor(message, suggestions = [], originalError = null) {
    super(message);
    this.name = 'UserFriendlyError';
    this.suggestions = suggestions;
    this.originalError = originalError;
  }
  
  display() {
    console.error(chalk.red('\n❌ ' + this.message));
    
    if (this.suggestions.length > 0) {
      console.error(chalk.cyan('\n💡 Suggestions:'));
      this.suggestions.forEach((suggestion, index) => {
        console.error(chalk.dim(`   ${index + 1}. ${suggestion}`));
      });
    }
    
    if (this.originalError && process.env.DEBUG) {
      console.error(chalk.dim('\n🔍 Original Error:'));
      console.error(chalk.dim(this.originalError.stack));
    }
    
    console.error();
  }
}

export default {
  ERROR_TYPES,
  parseError,
  formatError,
  handleTransactionFailure,
  handleNetworkError,
  validateEnvironment,
  withErrorHandling,
  UserFriendlyError
};
