#!/bin/bash

# Create a plaintext private key file for automated deployment
# This is more suitable for scripting than encrypted keystores

echo "This script will create a plaintext private key file for deployment."
echo "⚠️  WARNING: This file will contain your private key in plain text!"
echo ""
echo "You need your private key from your wallet (ArgentX/Braavos)."
echo ""
read -p "Enter your private key (starts with 0x): " PRIVATE_KEY

# Create the private key file
mkdir -p ~/.starkli-wallets/deployer
echo "$PRIVATE_KEY" > ~/.starkli-wallets/deployer/private_key.txt
chmod 600 ~/.starkli-wallets/deployer/private_key.txt

echo ""
echo "✅ Private key file created at: ~/.starkli-wallets/deployer/private_key.txt"
echo ""
echo "Now you can run the deployment without password prompts!"
echo ""
echo "Run: ./scripts/deploy_with_starkli_plaintext.sh"
