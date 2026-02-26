#!/bin/bash

# Deploy AjoFactory to Starknet Sepolia
# This script reads class hashes from declared_class_hashes.json and deploys the factory

set -e

echo "🚀 Deploying AjoFactory to Starknet Sepolia..."
echo ""

# Check if class hashes file exists
if [ ! -f "declared_class_hashes.json" ]; then
    echo "❌ Error: declared_class_hashes.json not found!"
    echo "   Please run ./scripts/declare_all.sh first"
    exit 1
fi

# Read class hashes from JSON
CORE_HASH=$(jq -r '.AjoCore' declared_class_hashes.json)
MEMBERS_HASH=$(jq -r '.AjoMembers' declared_class_hashes.json)
COLLATERAL_HASH=$(jq -r '.AjoCollateral' declared_class_hashes.json)
PAYMENTS_HASH=$(jq -r '.AjoPayments' declared_class_hashes.json)
GOVERNANCE_HASH=$(jq -r '.AjoGovernance' declared_class_hashes.json)
SCHEDULE_HASH=$(jq -r '.AjoSchedule' declared_class_hashes.json)
FACTORY_HASH=$(jq -r '.AjoFactory' declared_class_hashes.json)

# Get owner address (deployer account)
OWNER_ADDRESS=$(sncast account list | grep -A 5 "deployer:" | grep "address:" | awk '{print $2}')

echo "📋 Deployment Configuration:"
echo "   Owner: ${OWNER_ADDRESS}"
echo "   Factory Class Hash: ${FACTORY_HASH}"
echo ""
echo "   Module Class Hashes:"
echo "   - AjoCore: ${CORE_HASH}"
echo "   - AjoMembers: ${MEMBERS_HASH}"
echo "   - AjoCollateral: ${COLLATERAL_HASH}"
echo "   - AjoPayments: ${PAYMENTS_HASH}"
echo "   - AjoGovernance: ${GOVERNANCE_HASH}"
echo "   - AjoSchedule: ${SCHEDULE_HASH}"
echo ""

# Deploy the factory
echo "🔨 Deploying AjoFactory..."
result=$(sncast --profile deployer deploy \
    --class-hash ${FACTORY_HASH} \
    --constructor-calldata ${OWNER_ADDRESS} ${CORE_HASH} ${MEMBERS_HASH} ${COLLATERAL_HASH} ${PAYMENTS_HASH} ${GOVERNANCE_HASH} ${SCHEDULE_HASH} \
    2>&1)

# Extract contract address
CONTRACT_ADDRESS=$(echo "$result" | grep -oP 'contract_address: \K0x[0-9a-fA-F]+' || echo "$result" | grep -oP '0x[0-9a-fA-F]{64}' | head -1)

echo ""
echo "✅ AjoFactory deployed successfully!"
echo ""
echo "📍 Contract Address: ${CONTRACT_ADDRESS}"
echo ""
echo "🔗 View on Starkscan:"
echo "   https://sepolia.starkscan.co/contract/${CONTRACT_ADDRESS}"
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

echo "💾 Deployment info saved to: deployment_info.json"
