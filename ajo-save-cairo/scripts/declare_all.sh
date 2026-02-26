#!/bin/bash

# Declare all Ajo contracts to Starknet Sepolia
# This script declares each contract and saves the class hashes

set -e

echo "🚀 Starting contract declaration process..."
echo ""

# Output file for class hashes
OUTPUT_FILE="declared_class_hashes.json"
echo "{" > $OUTPUT_FILE

# Function to declare a contract and extract class hash
declare_contract() {
    local contract_name=$1
    local contract_file="target/dev/ajo_save_${contract_name}.contract_class.json"
    
    echo "📝 Declaring ${contract_name}..."
    
    # Declare the contract
    result=$(sncast --profile deployer declare --contract-name ${contract_name} 2>&1)
    
    # Check if already declared
    if echo "$result" | grep -q "is already declared"; then
        echo "   ℹ️  ${contract_name} already declared"
        class_hash=$(echo "$result" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+' || echo "$result" | grep -oP '0x[0-9a-fA-F]{64}' | head -1)
    else
        echo "   ✅ ${contract_name} declared successfully"
        class_hash=$(echo "$result" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+' || echo "$result" | grep -oP '0x[0-9a-fA-F]{64}' | head -1)
    fi
    
    echo "   Class Hash: ${class_hash}"
    echo "  \"${contract_name}\": \"${class_hash}\"," >> $OUTPUT_FILE
    echo ""
}

# Declare all contracts
declare_contract "AjoCore"
declare_contract "AjoMembers"
declare_contract "AjoPayments"
declare_contract "AjoSchedule"
declare_contract "AjoCollateral"
declare_contract "AjoGovernance"
declare_contract "AjoFactory"

# Clean up the last comma and close JSON
sed -i '' '$ s/,$//' $OUTPUT_FILE
echo "}" >> $OUTPUT_FILE

echo "✨ All contracts declared!"
echo ""
echo "📄 Class hashes saved to: ${OUTPUT_FILE}"
echo ""
cat $OUTPUT_FILE
