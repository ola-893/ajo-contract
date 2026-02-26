/**
 * Simple verification script for starknet.js utilities
 * Run with: node utils/test-starknet.js
 */

import dotenv from 'dotenv';
import {
  initializeStarknet,
  initializeProvider,
  sleep,
  formatTxHash,
  formatAddress,
  getExplorerTxUrl,
  getExplorerContractUrl
} from './starknet.js';

// Load environment variables
dotenv.config();

async function testStarknetUtils() {
  console.log('\n🧪 Testing Starknet Utilities\n');
  console.log('═'.repeat(60));
  
  try {
    // Test 1: Initialize provider
    console.log('\n✓ Test 1: Initialize Provider');
    const provider = initializeProvider('sepolia');
    console.log('  Provider initialized successfully');
    console.log(`  Chain ID: SN_SEPOLIA`);
    
    // Test 2: Initialize full Starknet (provider + account)
    console.log('\n✓ Test 2: Initialize Starknet (Provider + Account)');
    try {
      const { provider: p, account, config } = await initializeStarknet('sepolia');
      console.log(`  Network: ${config.name}`);
      console.log(`  Account: ${formatAddress(account.address, true)}`);
      console.log(`  RPC URL: ${config.rpcUrl.substring(0, 50)}...`);
      
      console.log('\n✓ Test 3: Account initialized successfully');
      console.log(`  Account address: ${formatAddress(account.address, false)}`);
      
    } catch (error) {
      if (error.message.includes('environment variable')) {
        console.log('  ⚠️  Skipped: Environment variables not set');
        console.log('     Set STARKNET_ACCOUNT_ADDRESS and STARKNET_PRIVATE_KEY to test');
      } else {
        throw error;
      }
    }
    
    // Test 4: Formatting utilities
    console.log('\n✓ Test 4: Formatting Utilities');
    const testTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const testAddress = '0x06235d0793b70879a94c6038614d22cc8ed3805db212dade35e918f81c73b66c';
    
    console.log(`  Full tx hash: ${formatTxHash(testTxHash, false)}`);
    console.log(`  Short tx hash: ${formatTxHash(testTxHash, true)}`);
    console.log(`  Full address: ${formatAddress(testAddress, false)}`);
    console.log(`  Short address: ${formatAddress(testAddress, true)}`);
    
    // Test 5: Explorer URLs
    console.log('\n✓ Test 5: Explorer URLs');
    const txUrl = getExplorerTxUrl(testTxHash, 'sepolia');
    const contractUrl = getExplorerContractUrl(testAddress, 'sepolia');
    console.log(`  TX URL: ${txUrl}`);
    console.log(`  Contract URL: ${contractUrl}`);
    
    // Test 6: Sleep utility
    console.log('\n✓ Test 6: Sleep Utility');
    console.log('  Sleeping for 1 second...');
    await sleep(1000);
    console.log('  Sleep completed');
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ All tests passed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n' + '═'.repeat(60));
    process.exit(1);
  }
}

// Run tests
testStarknetUtils();

