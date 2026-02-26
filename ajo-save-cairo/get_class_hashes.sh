#!/bin/bash

echo "Computing class hashes for all contracts..."
echo ""

for contract in AjoCore AjoMembers AjoCollateral AjoPayments AjoGovernance AjoSchedule AjoFactory; do
    file="target/dev/ajo_save_${contract}.contract_class.json"
    if [ -f "$file" ]; then
        hash=$(starkli class-hash "$file" 2>/dev/null)
        echo "$contract: $hash"
    fi
done
