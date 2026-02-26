#!/usr/bin/env node

/**
 * Starknet Integration Testing Scripts - Main Entry Point
 * 
 * Simple CLI interface for running Ajo contract testing demos on Starknet
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ASCII Art Banner
function printWelcomeBanner() {
  console.log('\x1b[35m\n' + '═'.repeat(88) + '\x1b[0m');
  console.log('\x1b[36m');
  console.log('   █████╗      ██╗ ██████╗     ████████╗███████╗███████╗████████╗██╗███████╗');
  console.log('  ██╔══██╗     ██║██╔═══██╗    ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝██║██╔════╝');
  console.log('  ███████║     ██║██║   ██║       ██║   █████╗  ███████╗   ██║   ██║███████╗');
  console.log('  ██╔══██║██   ██║██║   ██║       ██║   ██╔══╝  ╚════██║   ██║   ██║╚════██║');
  console.log('  ██║  ██║╚█████╔╝╚██████╔╝       ██║   ███████╗███████║   ██║   ██║███████║');
  console.log('  ╚═╝  ╚═╝ ╚════╝  ╚═════╝        ╚═╝   ╚══════╝╚══════╝   ╚═╝   ╚═╝╚══════╝');
  console.log('\x1b[0m');
  console.log('\x1b[33m           Starknet Integration Testing Scripts v1.0.0\x1b[0m');
  console.log('\x1b[2m           Testing Ajo Savings Contracts on Starknet Sepolia\x1b[0m');
  console.log('\x1b[35m' + '═'.repeat(88) + '\n\x1b[0m');
}

// Demo descriptions
const DEMOS = {
  'quick-test': {
    name: 'Quick Test',
    description: 'Fast smoke test of factory and basic operations',
    duration: '~2-3 minutes',
    file: 'demos/quick-test.js'
  },
  'full-cycle': {
    name: 'Full Lifecycle Demo',
    description: 'Complete Ajo lifecycle: create, join, payments, and governance',
    duration: '~8-10 minutes',
    file: 'demos/full-cycle.js'
  },
  'governance': {
    name: 'Governance Demo',
    description: 'Proposal creation, voting, and execution',
    duration: '~4-5 minutes',
    file: 'demos/governance-demo.js'
  },
  'advanced': {
    name: 'Advanced Features',
    description: 'Collateral management, defaults, and edge cases',
    duration: '~5-6 minutes',
    file: 'demos/advanced-features.js'
  }
};

/**
 * Run a demo script
 */
function runDemo(demoKey) {
  const demo = DEMOS[demoKey];
  
  if (!demo) {
    console.error('\x1b[31m\n❌ Unknown demo: ' + demoKey + '\n\x1b[0m');
    console.log('\x1b[33mAvailable demos:\x1b[0m');
    Object.entries(DEMOS).forEach(([key, d]) => {
      console.log('\x1b[36m  ' + key.padEnd(15) + '\x1b[0m - ' + d.description);
    });
    process.exit(1);
  }
  
  console.log('\x1b[36m\n🚀 Starting: ' + demo.name + '\x1b[0m');
  console.log('\x1b[2m   ' + demo.description + '\x1b[0m');
  console.log('\x1b[2m   Estimated duration: ' + demo.duration + '\n\x1b[0m');
  
  const demoPath = join(__dirname, demo.file);
  const child = spawn('node', [demoPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  child.on('exit', (code) => {
    if (code === 0) {
      console.log('\x1b[32m\n✅ Demo completed successfully!\n\x1b[0m');
    } else {
      console.error('\x1b[31m\n❌ Demo failed with exit code: ' + code + '\n\x1b[0m');
      process.exit(code);
    }
  });
}

/**
 * List all available demos
 */
function listDemos() {
  printWelcomeBanner();
  console.log('\x1b[36mAvailable Demos:\n\x1b[0m');
  
  Object.entries(DEMOS).forEach(([key, demo]) => {
    console.log('\x1b[33m  ' + key + '\x1b[0m');
    console.log('\x1b[2m    Name:        ' + demo.name + '\x1b[0m');
    console.log('\x1b[2m    Description: ' + demo.description + '\x1b[0m');
    console.log('\x1b[2m    Duration:    ' + demo.duration + '\x1b[0m');
    console.log();
  });
  
  console.log('\x1b[36mUsage:\x1b[0m');
  console.log('\x1b[2m  node index.js <demo-name>     # Run specific demo\x1b[0m');
  console.log('\x1b[2m  node index.js --list          # List all demos\x1b[0m');
  console.log('\x1b[2m  node index.js --help          # Show help\n\x1b[0m');
  
  console.log('\x1b[36mNPM Scripts:\x1b[0m');
  console.log('\x1b[2m  npm run demo:quick            # Run quick test\x1b[0m');
  console.log('\x1b[2m  npm run demo:full             # Run full cycle demo\x1b[0m');
  console.log('\x1b[2m  npm run demo:governance       # Run governance demo\x1b[0m');
  console.log('\x1b[2m  npm run demo:advanced         # Run advanced features\n\x1b[0m');
}

/**
 * Show help
 */
function showHelp() {
  printWelcomeBanner();
  console.log('\x1b[36mStarknet Ajo Integration Testing Scripts\n\x1b[0m');
  console.log('\x1b[33mUsage:\x1b[0m');
  console.log('  node index.js [options] [demo-name]\n');
  console.log('\x1b[33mOptions:\x1b[0m');
  console.log('  --list, -l     List all available demos');
  console.log('  --help, -h     Show this help message\n');
  console.log('\x1b[33mDemo Names:\x1b[0m');
  Object.keys(DEMOS).forEach(key => {
    console.log('  ' + key);
  });
  console.log();
}

/**
 * Check environment configuration
 */
function checkEnvironment() {
  const required = [
    'STARKNET_ACCOUNT_ADDRESS',
    'STARKNET_PRIVATE_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('\x1b[31m\n❌ Missing required environment variables:\n\x1b[0m');
    missing.forEach(key => {
      console.error('\x1b[33m  - ' + key + '\x1b[0m');
    });
    console.error('\x1b[2m\nPlease create a .env file based on .env.example\n\x1b[0m');
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
  listDemos();
  process.exit(0);
}

// Check environment before running demo
checkEnvironment();

// Run the specified demo
const demoName = args[0];
runDemo(demoName);
