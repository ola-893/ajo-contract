#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up Local Demo Environment${NC}"
echo "================================================="

# Function to check if a process is running
check_process() {
    if pgrep -f "$1" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to kill hardhat node if running
kill_hardhat_node() {
    if check_process "hardhat node"; then
        echo -e "${YELLOW}⚠️  Existing Hardhat node found, stopping it...${NC}"
        pkill -f "hardhat node"
        sleep 2
    fi
}

# Step 1: Clean up any existing Hardhat processes
echo -e "${BLUE}📋 Step 1: Cleaning up existing processes...${NC}"
kill_hardhat_node

# Step 2: Verify Hardhat installation
echo -e "${BLUE}📋 Step 2: Verifying Hardhat installation...${NC}"
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js and npm first.${NC}"
    exit 1
fi

if [ ! -f "hardhat.config.js" ] && [ ! -f "hardhat.config.ts" ]; then
    echo -e "${RED}❌ Hardhat config not found. Make sure you're in the project root.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Hardhat environment ready${NC}"

# Step 3: Start Hardhat node in background
echo -e "${BLUE}📋 Step 3: Starting local Hardhat node...${NC}"
npx hardhat node > hardhat-node.log 2>&1 &
HARDHAT_PID=$!

# Wait for Hardhat node to start
echo -e "${YELLOW}⏳ Waiting for Hardhat node to start...${NC}"
sleep 5

# Check if Hardhat node is running
if ! kill -0 $HARDHAT_PID 2>/dev/null; then
    echo -e "${RED}❌ Failed to start Hardhat node. Check hardhat-node.log for errors.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Hardhat node started successfully (PID: $HARDHAT_PID)${NC}"

# Step 4: Verify local network connectivity
echo -e "${BLUE}📋 Step 4: Testing local network connection...${NC}"
if curl -s -X POST -H "Content-Type: application/json" \
   --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
   http://localhost:8545 > /dev/null; then
    echo -e "${GREEN}✅ Local Hardhat network is responding${NC}"
else
    echo -e "${RED}❌ Cannot connect to local Hardhat network${NC}"
    kill $HARDHAT_PID
    exit 1
fi

# Step 5: Create/update Hardhat config to force localhost
echo -e "${BLUE}📋 Step 5: Creating demo-specific Hardhat config...${NC}"

cat > hardhat.demo.config.js << 'EOF'
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000" // 10000 ETH
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 60000
    }
  },
  defaultNetwork: "localhost"
};
EOF

echo -e "${GREEN}✅ Demo config created${NC}"

# Step 6: Compile contracts
echo -e "${BLUE}📋 Step 6: Compiling contracts...${NC}"
if npx hardhat compile --config hardhat.demo.config.js; then
    echo -e "${GREEN}✅ Contracts compiled successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Compilation warnings/errors (continuing anyway)${NC}"
fi

# Step 7: Run the demo
echo -e "${BLUE}📋 Step 7: Running Ajo Demo...${NC}"
echo -e "${YELLOW}🚀 Starting demo script...${NC}"

# Set environment variables to force localhost
export HARDHAT_NETWORK=localhost
export NODE_ENV=development

# Run the demo with explicit network flag
if npx hardhat run scripts/demo.cjs --network localhost --config hardhat.demo.config.js; then
    echo -e "${GREEN}🎉 Demo completed successfully!${NC}"
    DEMO_SUCCESS=true
else
    echo -e "${RED}❌ Demo failed${NC}"
    DEMO_SUCCESS=false
fi

# Step 8: Cleanup
echo -e "${BLUE}📋 Step 8: Cleaning up...${NC}"

# Show logs if demo failed
if [ "$DEMO_SUCCESS" = false ]; then
    echo -e "${YELLOW}📋 Last 20 lines of Hardhat node log:${NC}"
    tail -n 20 hardhat-node.log
fi

# Kill the Hardhat node
if kill $HARDHAT_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Hardhat node stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Hardhat node may have already stopped${NC}"
fi

# Clean up log file
rm -f hardhat-node.log

# Remove demo config
rm -f hardhat.demo.config.js

echo -e "${BLUE}=================================================${NC}"
if [ "$DEMO_SUCCESS" = true ]; then
    echo -e "${GREEN}🎉 Demo Environment Setup Complete!${NC}"
    echo -e "${GREEN}The Ajo demo has run successfully on your local network.${NC}"
else
    echo -e "${RED}❌ Demo failed to run.${NC}"
    echo -e "${YELLOW}Troubleshooting tips:${NC}"
    echo -e "${YELLOW}1. Make sure all contracts are in contracts/ directory${NC}"
    echo -e "${YELLOW}2. Check that MockERC20 contract exists${NC}"
    echo -e "${YELLOW}3. Verify your main Ajo contract is properly structured${NC}"
    echo -e "${YELLOW}4. Run 'npx hardhat compile' to check for compilation errors${NC}"
fi
echo -e "${BLUE}=================================================${NC}"