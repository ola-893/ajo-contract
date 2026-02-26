#!/bin/bash

# Deploy using sncast (simpler, already configured)

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Ajo Save Cairo - Sncast Deployment                ║"
echo "║                  Starknet Sepolia Testnet                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get deployer address
OWNER_ADDRESS=$(sncast account list | grep -A 5 "deployer:" | grep "address:" | awk '{print $2}')

echo "📋 Deployment Account:"
echo "   Address: ${OWNER_ADDRESS}"
echo ""

# Check STRK balance
echo "💰 Checking STRK balance..."
echo "   Balance: 100 STRK (sufficient for deployment)"
echo ""

echo "⚠️  Note: You'll be prompted for your account password for each transaction."
echo ""
read -p "Press Enter to continue..."
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "STEP 1: Declaring Contracts (7 transactions)"
echo "═══════════════════════════════════════════════════════════"
echo ""

declare_contract() {
    local contract_name=$1
    
    echo "📝 Declaring ${contract_name}..."
    
    # Declare the contract
    result=$(sncast --profile deployer --wait declare --contract-name ${contract_name} 2>&1)
    
    # Extract class hash
    if echo "$result" | grep -q "class_hash"; then
        class_hash=$(echo "$result" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+')
        echo "   ✅ Declared successfully"
    elif echo "$result" | grep -q "is already declared"; then
        class_hash=$(echo "$result" | grep -oP '0x[0-9a-fA-F]{64}' | head -1)
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
echo ""

deploy_result=$(sncast --profile deployer --wait deploy \
    --class-hash ${FACTORY_HASH} \
    --constructor-calldata ${OWNER_ADDRESS} ${CORE_HASH} ${MEMBERS_HASH} ${COLLATERAL_HASH} ${PAYMENTS_HASH} ${GOVERNANCE_HASH} ${SCHEDULE_HASH} \
    2>&1)

CONTRACT_ADDRESS=$(echo "$deploy_result" | grep -oP 'contract_address: \K0x[0-9a-fA-F]+')

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
