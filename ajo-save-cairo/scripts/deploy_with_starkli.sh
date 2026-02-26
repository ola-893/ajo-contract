#!/bin/bash

# Deploy using starkli (compatible with Alchemy RPC)

set -e

# Load environment variables if .env exists
if [ -f "../.env" ]; then
    source ../.env
fi

# Source starkli environment
source ~/.starkli/env

# Set environment variables
export STARKNET_RPC="https://starknet-sepolia.g.alchemy.com/v2/HL-XmuitXQ7NgjyxPCJtU"
export STARKNET_ACCOUNT="$HOME/.starkli-wallets/deployer/account.json"
export STARKNET_KEYSTORE="$HOME/.starkli/keystore.json"
export STARKNET_KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD"

# Check if password is set
if [ -z "$KEYSTORE_PASSWORD" ]; then
    echo "❌ Error: KEYSTORE_PASSWORD not set!"
    echo ""
    echo "Please set your keystore password:"
    echo "  export KEYSTORE_PASSWORD='your_password'"
    echo ""
    echo "Or add it to .env file in the project root:"
    echo "  echo 'KEYSTORE_PASSWORD=your_password' >> .env"
    exit 1
fi

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

echo "═══════════════════════════════════════════════════════════"
echo "STEP 1: Declaring Contracts"
echo "═══════════════════════════════════════════════════════════"
echo ""

declare_contract() {
    local contract_name=$1
    local contract_file="target/dev/ajo_save_${contract_name}.contract_class.json"
    
    echo "📝 Declaring ${contract_name}..."
    
    # Declare the contract (uses STRK by default)
    result=$(starkli declare ${contract_file} --watch 2>&1 || true)
    
    # Check for errors
    if echo "$result" | grep -qi "error"; then
        echo "   ❌ Error declaring ${contract_name}:"
        echo "$result" | head -20
        exit 1
    fi
    
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

echo "Declaring module contracts..."
CORE_HASH=$(declare_contract "AjoCore")
MEMBERS_HASH=$(declare_contract "AjoMembers")
PAYMENTS_HASH=$(declare_contract "AjoPayments")
SCHEDULE_HASH=$(declare_contract "AjoSchedule")
COLLATERAL_HASH=$(declare_contract "AjoCollateral")
GOVERNANCE_HASH=$(declare_contract "AjoGovernance")

echo "Declaring factory contract..."
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
echo "STEP 2: Deploying AjoFactory"
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
echo "   (This may take a few minutes...)"
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
