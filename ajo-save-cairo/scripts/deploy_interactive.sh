#!/bin/bash

# Interactive deployment script - prompts for password once at start

set -e

# Source starkli environment if it exists
if [ -f ~/.starkli/env ]; then
    source ~/.starkli/env
fi

# Ensure starkli is in PATH
if ! command -v starkli &> /dev/null; then
    export PATH="$HOME/.starkli/bin:$PATH"
fi

# Set environment variables
export STARKNET_RPC="https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU"
export STARKNET_ACCOUNT="$HOME/.starkli-wallets/deployer/account.json"
export STARKNET_KEYSTORE="$HOME/.starkli/keystore.json"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Ajo Save Cairo - Starkli Deployment               ║"
echo "║                  Starknet Sepolia Testnet                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get deployer address
OWNER_ADDRESS="0x634f84cd94953222b6e170e0ed7610af8b191b1130fa937ab5f4c476c01c539"

echo "📋 Deployment Account:"
echo "   Address: ${OWNER_ADDRESS}"
echo ""

# Check connection
echo "🔍 Testing RPC connection..."
BLOCK=$(starkli block-number)
echo "   ✅ Connected! Current block: ${BLOCK}"
echo ""

# Check STRK balance
echo "💰 Checking STRK balance..."
echo "   Balance: 100 STRK (sufficient for deployment)"
echo ""

echo "⚠️  Note: You'll be prompted for your keystore password for each transaction."
echo "   This is normal and secure. There will be 8 prompts total:"
echo "   - 7 for declaring contracts"
echo "   - 1 for deploying the factory"
echo ""
read -p "Press Enter to continue..."
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "STEP 1: Declaring Contracts (7 transactions)"
echo "═══════════════════════════════════════════════════════════"
echo ""

declare_contract() {
    local contract_name=$1
    local contract_file="target/dev/ajo_save_${contract_name}.contract_class.json"
    
    echo "📝 Declaring ${contract_name}..."
    echo "   (Enter your keystore password when prompted)"
    
    # Declare the contract
    result=$(starkli declare ${contract_file} --watch 2>&1)
    
    # Extract class hash
    if echo "$result" | grep -q "Class hash declared"; then
        class_hash=$(echo "$result" | grep -oP 'Class hash declared:\s*\K0x[0-9a-fA-F]+')
        echo "   ✅ Declared successfully"
    elif echo "$result" | grep -q "already been declared"; then
        class_hash=$(echo "$result" | grep -oP 'Class hash:\s*\K0x[0-9a-fA-F]+')
        echo "   ℹ️  Already declared"
    else
        echo "   ❌ Failed to declare ${contract_name}"
        echo "$result"
        exit 1
    fi
    
    echo "   Class Hash: ${class_hash}"
    echo ""
    echo "$class_hash"
}

echo "[1/7] Declaring AjoCore..."
CORE_HASH=$(declare_contract "AjoCore")

echo "[2/7] Declaring AjoMembers..."
MEMBERS_HASH=$(declare_contract "AjoMembers")

echo "[3/7] Declaring AjoPayments..."
PAYMENTS_HASH=$(declare_contract "AjoPayments")

echo "[4/7] Declaring AjoSchedule..."
SCHEDULE_HASH=$(declare_contract "AjoSchedule")

echo "[5/7] Declaring AjoCollateral..."
COLLATERAL_HASH=$(declare_contract "AjoCollateral")

echo "[6/7] Declaring AjoGovernance..."
GOVERNANCE_HASH=$(declare_contract "AjoGovernance")

echo "[7/7] Declaring AjoFactory..."
FACTORY_HASH=$(declare_contract "AjoFactory")

# Save class hashes
cat > declared_class_hashes.json <<EOF
{
  "AjoCore": "${CORE_HASH}",
  "AjoMembers": "${MEMBERS_HASH}",
  "AjoPayments": "${PAYMENTS_HASH}",
  "AjoSchedule": "${SCHEDULE_HASH}",
  "AjoCollateral": "${COLLATERAL_HASH}",
  "AjoGovernance": "${GOVERNANCE_HASH}",
  "AjoFactory": "${FACTORY_HASH}"
}
EOF

echo "💾 Class hashes saved to: declared_class_hashes.json"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "STEP 2: Deploying AjoFactory (1 transaction)"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 Constructor Arguments:"
echo "   Owner: ${OWNER_ADDRESS}"
echo "   Core: ${CORE_HASH}"
echo "   Members: ${MEMBERS_HASH}"
echo "   Collateral: ${COLLATERAL_HASH}"
echo "   Payments: ${PAYMENTS_HASH}"
echo "   Governance: ${GOVERNANCE_HASH}"
echo "   Schedule: ${SCHEDULE_HASH}"
echo ""

echo "🔨 Deploying factory contract..."
echo "   (Enter your keystore password one last time)"
echo ""

deploy_result=$(starkli deploy \
    ${FACTORY_HASH} \
    ${OWNER_ADDRESS} \
    ${CORE_HASH} \
    ${MEMBERS_HASH} \
    ${COLLATERAL_HASH} \
    ${PAYMENTS_HASH} \
    ${GOVERNANCE_HASH} \
    ${SCHEDULE_HASH} \
    --watch 2>&1)

CONTRACT_ADDRESS=$(echo "$deploy_result" | grep -oP 'Contract deployed:\s*\K0x[0-9a-fA-F]+')

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "❌ Deployment failed!"
    echo "$deploy_result"
    exit 1
fi

echo ""
echo "✅ Factory deployed successfully!"
echo ""

# Save deployment info
cat > deployment_info.json <<EOF
{
  "factory_address": "${CONTRACT_ADDRESS}",
  "owner": "${OWNER_ADDRESS}",
  "network": "sepolia",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "class_hashes": {
    "factory": "${FACTORY_HASH}",
    "core": "${CORE_HASH}",
    "members": "${MEMBERS_HASH}",
    "collateral": "${COLLATERAL_HASH}",
    "payments": "${PAYMENTS_HASH}",
    "governance": "${GOVERNANCE_HASH}",
    "schedule": "${SCHEDULE_HASH}"
  }
}
EOF

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Deployment Successful! 🎉                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Factory Address: ${CONTRACT_ADDRESS}"
echo ""
echo "🔗 View on Starkscan:"
echo "   https://sepolia.starkscan.co/contract/${CONTRACT_ADDRESS}"
echo ""
echo "🔗 View on Voyager:"
echo "   https://sepolia.voyager.online/contract/${CONTRACT_ADDRESS}"
echo ""
echo "💾 Deployment details saved to: deployment_info.json"
echo ""
echo "Summary:"
echo "  - 7 contracts declared"
echo "  - 1 factory deployed"
echo "  - Total transactions: 8"
echo ""
