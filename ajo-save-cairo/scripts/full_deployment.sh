#!/bin/bash

# Complete deployment script for Ajo Save Cairo
# Declares all contracts and deploys the factory in one go

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Ajo Save Cairo - Full Deployment Script           ║"
echo "║                  Starknet Sepolia Testnet                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v sncast &> /dev/null; then
    echo "❌ sncast not found. Please install Starknet Foundry."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ jq not found. Installing jq..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        echo "Please install jq manually: https://stedolan.github.io/jq/download/"
        exit 1
    fi
fi

echo "✅ Prerequisites check passed"
echo ""

# Get account info
OWNER_ADDRESS=$(sncast account list | grep -A 5 "deployer:" | grep "address:" | awk '{print $2}')

if [ -z "$OWNER_ADDRESS" ]; then
    echo "❌ Deployer account not found. Please set up your account first."
    exit 1
fi

echo "📋 Deployment Account:"
echo "   Address: ${OWNER_ADDRESS}"
echo ""

# Step 1: Declare all contracts
echo "═══════════════════════════════════════════════════════════"
echo "STEP 1: Declaring Contracts"
echo "═══════════════════════════════════════════════════════════"
echo ""

declare_contract() {
    local contract_name=$1
    echo "📝 Declaring ${contract_name}..."
    
    result=$(sncast --profile deployer declare --contract-name ${contract_name} 2>&1 || true)
    
    if echo "$result" | grep -q "is already declared"; then
        class_hash=$(echo "$result" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+' | head -1)
        echo "   ℹ️  Already declared"
    elif echo "$result" | grep -q "class_hash:"; then
        class_hash=$(echo "$result" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+' | head -1)
        echo "   ✅ Declared successfully"
    else
        echo "   ❌ Failed to declare ${contract_name}"
        echo "$result"
        exit 1
    fi
    
    echo "   Class Hash: ${class_hash}"
    echo ""
    echo "$class_hash"
}

CORE_HASH=$(declare_contract "AjoCore")
MEMBERS_HASH=$(declare_contract "AjoMembers")
PAYMENTS_HASH=$(declare_contract "AjoPayments")
SCHEDULE_HASH=$(declare_contract "AjoSchedule")
COLLATERAL_HASH=$(declare_contract "AjoCollateral")
GOVERNANCE_HASH=$(declare_contract "AjoGovernance")
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

# Step 2: Deploy Factory
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
deploy_result=$(sncast --profile deployer deploy \
    --class-hash ${FACTORY_HASH} \
    --constructor-calldata ${OWNER_ADDRESS} ${CORE_HASH} ${MEMBERS_HASH} ${COLLATERAL_HASH} ${PAYMENTS_HASH} ${GOVERNANCE_HASH} ${SCHEDULE_HASH} \
    2>&1)

CONTRACT_ADDRESS=$(echo "$deploy_result" | grep -oP 'contract_address: \K0x[0-9a-fA-F]+' | head -1)

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

# Final summary
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
echo "Next steps:"
echo "  1. Verify the contract on Starkscan"
echo "  2. Test creating an Ajo instance"
echo "  3. Update your frontend with the factory address"
echo ""
