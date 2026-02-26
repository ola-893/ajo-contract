#!/bin/bash

# Test if keystore password is correct

source ../.env

if [ "$KEYSTORE_PASSWORD" = "your_password_here" ]; then
    echo "❌ You haven't set your password yet!"
    echo ""
    echo "Edit ../.env and replace 'your_password_here' with your actual keystore password"
    echo ""
    echo "The password you used when running:"
    echo "  starkli signer keystore from-key ~/.starkli/keystore.json"
    exit 1
fi

source ~/.starkli/env
export STARKNET_KEYSTORE="$HOME/.starkli/keystore.json"
export STARKNET_KEYSTORE_PASSWORD="$KEYSTORE_PASSWORD"

echo "Testing keystore password..."
result=$(starkli signer keystore inspect $HOME/.starkli/keystore.json 2>&1)

if echo "$result" | grep -q "Mac Mismatch"; then
    echo "❌ Password is incorrect!"
    echo ""
    echo "The password in .env doesn't match your keystore."
    echo "Please check and update ../.env with the correct password."
    exit 1
elif echo "$result" | grep -q "Public key:"; then
    echo "✅ Password is correct!"
    echo "$result"
    exit 0
else
    echo "⚠️  Unexpected result:"
    echo "$result"
    exit 1
fi
