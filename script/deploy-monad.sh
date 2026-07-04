#!/usr/bin/env bash
# Deploy Hello.sol to Monad testnet with Foundry.
#
# Prereqs:
#   1. A wallet funded with testnet MON from https://faucet.monad.xyz
#   2. Its private key in .env as  PRIVATE_KEY=0x....
#
# Run from a WSL terminal:
#   bash script/deploy-monad.sh
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."

# load PRIVATE_KEY from .env (strip quotes, CR from Windows line endings, whitespace)
if [ -f .env ]; then
  PRIVATE_KEY=$(grep -E '^PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r' | xargs)
  export PRIVATE_KEY
fi
[ -z "$PRIVATE_KEY" ] && { echo "PRIVATE_KEY not set (put it in .env)"; exit 1; }

RPC=https://testnet-rpc.monad.xyz

echo "▶ deploying Hello.sol to Monad testnet..."
OUT=$(forge create contracts/Hello.sol:Hello --rpc-url $RPC --private-key $PRIVATE_KEY --broadcast --json --constructor-args gm_from_Handshake)
ADDR=$(echo "$OUT" | grep -oP '"deployedTo":\s*"\K0x[0-9a-fA-F]{40}')
echo "  ✅ deployed at $ADDR"
echo "  🔗 https://testnet.monadexplorer.com/address/$ADDR"

echo "▶ READ / WRITE / READ ..."
echo -n "  message = "; cast call $ADDR "message()(string)" --rpc-url $RPC
cast send $ADDR "ping()" --private-key $PRIVATE_KEY --rpc-url $RPC >/dev/null
echo -n "  pings   = "; cast call $ADDR "pings()(uint256)" --rpc-url $RPC
echo ""
echo "🎉 Monad testnet deploy confirmed. Save this address: $ADDR"
