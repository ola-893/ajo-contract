#!/bin/bash

# Quick script to update RPC endpoint

if [ -z "$1" ]; then
    echo "Usage: ./update_rpc.sh <YOUR_ALCHEMY_API_KEY>"
    echo ""
    echo "Example:"
    echo "  ./update_rpc.sh abc123def456"
    echo ""
    echo "Get your free API key from:"
    echo "  https://www.alchemy.com/"
    exit 1
fi

API_KEY=$1

cat > ../snfoundry.toml <<EOF
[sncast.deployer]
account = "deployer"
accounts-file = "/Users/ola/.starknet_accounts/starknet_open_zeppelin_accounts.json"
url = "https://starknet-sepolia.g.alchemy.com/v2/${API_KEY}"
EOF

echo "✅ RPC endpoint updated!"
echo ""
echo "Now run: ./scripts/full_deployment.sh"
