/**
 * Quick test script to verify utility functions
 */

import { colors, printBanner, printTable, formatUSDC, printSuccess, printError } from './formatting.js';
import { retryWithBackoff } from './retry.js';

console.log('\n' + colors.cyan('Testing Utility Functions'));
console.log(colors.dim('═'.repeat(50)) + '\n');

// Test 1: Colors
console.log(colors.green('✅ Green text works'));
console.log(colors.red('❌ Red text works'));
console.log(colors.yellow('⚠️  Yellow text works'));
console.log(colors.cyan('ℹ️  Cyan text works'));
console.log(colors.dim('Dim text works'));
console.log(colors.bright('Bright text works'));

// Test 2: Banner
printBanner('TEST BANNER');

// Test 3: Table
console.log(colors.cyan('Testing table formatting:\n'));
printTable(
  ['Name', 'Address', 'Balance'],
  [
    ['Alice', '0x1234...5678', '100.00 USDC'],
    ['Bob', '0xabcd...ef01', '250.50 USDC'],
    ['Charlie', '0x9876...5432', '75.25 USDC']
  ]
);

// Test 4: Format USDC
console.log(colors.cyan('\nTesting USDC formatting:'));
console.log(colors.dim(`  1000000 micro USDC = ${formatUSDC(1000000)} USDC`));
console.log(colors.dim(`  50000000 micro USDC = ${formatUSDC(50000000)} USDC`));

// Test 5: Success/Error messages
printSuccess('This is a success message');
printError('This is an error message');

// Test 6: Retry logic
console.log(colors.cyan('\nTesting retry logic:'));

let attemptCount = 0;
const testOperation = async () => {
  attemptCount++;
  if (attemptCount < 3) {
    throw new Error('Network timeout');
  }
  return 'Success!';
};

try {
  const result = await retryWithBackoff(
    testOperation,
    'Test operation',
    { maxRetries: 5, baseDelay: 100, verbose: true }
  );
  console.log(colors.green(`\n✅ Retry test passed: ${result}\n`));
} catch (error) {
  console.log(colors.red(`\n❌ Retry test failed: ${error.message}\n`));
}

console.log(colors.bright('\n✅ All utility tests completed!\n'));
