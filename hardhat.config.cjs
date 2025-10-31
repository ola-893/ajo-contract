require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

// Define Hardhat tasks for deployment
task("deploy-ajo-system", "Deploy PatientAjo V2 System", async (taskArgs, hre) => {
  const deployAjoSystem = require("./scripts/deploy-hardhat.cjs");
  return deployAjoSystem();
});

task("show-balance", "Show account balance", async () => {
  const { ethers } = require("hardhat");
  const wallet = (await ethers.getSigners())[0];
  const balance = await wallet.getBalance();
  console.log(`Account ${wallet.address} has balance: ${ethers.formatEther(balance)} HBAR`);
  return balance;
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      viaIR: true,
    },
  },

  // Set default network
  defaultNetwork: "hedera_testnet",

  networks: {
    // Hedera Testnet using JSON-RPC
    hedera_testnet: {
      url: process.env.TESTNET_ENDPOINT || "https://testnet.hashio.io/api",
      chainId: 296,
       accounts: [
        process.env.TESTNET_OPERATOR_PRIVATE_KEY,
        process.env.PRIVATE_KEY_1,
        process.env.PRIVATE_KEY_2, 
        process.env.PRIVATE_KEY_3,
        process.env.PRIVATE_KEY_4,
        process.env.PRIVATE_KEY_5,
        process.env.PRIVATE_KEY_6,
        process.env.PRIVATE_KEY_7,
        process.env.PRIVATE_KEY_8,
        process.env.PRIVATE_KEY_9,
         process.env.PRIVATE_KEY_10,
         process.env.PRIVATE_KEY_11,
         process.env.PRIVATE_KEY_12,
         process.env.PRIVATE_KEY_13,
      ].filter(key => key), // Remove undefined keys
      gas: "auto",
      gasPrice: "auto",
      timeout: 120000,
      blockGasLimit: 15000000,
      confirmations: 1,
      timeoutBlocks: 25
    },
    
    // Hedera Mainnet using JSON-RPC
    hedera_mainnet: {
      url: "https://mainnet.hashio.io/api",
      chainId: 295,
      accounts: process.env.MAINNET_OPERATOR_PRIVATE_KEY ? [process.env.MAINNET_OPERATOR_PRIVATE_KEY] : [],
      gas: "auto",
      gasPrice: "auto", 
      timeout: 120000,
      blockGasLimit: 15000000,
      confirmations: 2,
      timeoutBlocks: 50
    },

    // Alternative Hedera RPC endpoints (backup)
    hedera_arkhia_testnet: {
      url: `https://pool.arkhia.io/hedera/testnet/json-rpc/v1/${process.env.ARKHIA_API_KEY}`,
      chainId: 296,
      accounts: process.env.TESTNET_OPERATOR_PRIVATE_KEY ? [process.env.TESTNET_OPERATOR_PRIVATE_KEY] : []
    },
    
    hedera_arkhia_mainnet: {
      url: `https://pool.arkhia.io/hedera/mainnet/json-rpc/v1/${process.env.ARKHIA_API_KEY}`,
      chainId: 295,
      accounts: process.env.MAINNET_OPERATOR_PRIVATE_KEY ? [process.env.MAINNET_OPERATOR_PRIVATE_KEY] : []
    },

    // Local development
    hedera_local: {
      url: "http://127.0.0.1:7546",
      chainId: 298,
      accounts: process.env.LOCAL_NODE_OPERATOR_PRIVATE_KEY ? [process.env.LOCAL_NODE_OPERATOR_PRIVATE_KEY] : []
    }
  },
  
  // Mocha test configuration  
  mocha: {
    timeout: 300000, // 5 minutes for Hedera transactions
    reporter: "spec",
    slow: 10000,
  },
  
  // Gas reporter configuration
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 0.000000001, // Hedera's ultra-low gas costs
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "HBAR",
  },
  
  // Contract size limits
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  
  // Path configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
  },
  
  // External contract dependencies
  external: {
    contracts: [
      {
        artifacts: "node_modules/@openzeppelin/contracts",
      },
    ],
  },
};