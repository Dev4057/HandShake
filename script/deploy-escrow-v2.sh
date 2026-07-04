#!/usr/bin/env bash
# Deploy HandshakeEscrowV2 to Monad testnet and save the address to deployments.json.
# V2 adds: job deadlines (reclaim/cancel), pull payments, slash-to-treasury.
#
# Run from a WSL terminal:  TREASURY=0x... bash script/deploy-escrow-v2.sh
# Needs: PRIVATE_KEY in .env, funded from https://faucet.monad.xyz
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  PRIVATE_KEY=$(grep -E '^PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r' | xargs)
  export PRIVATE_KEY
fi
[ -z "$PRIVATE_KEY" ] && { echo "PRIVATE_KEY not set (put it in .env)"; exit 1; }
[ -z "$TREASURY" ] && { echo "TREASURY not set (address that receives slashed bonds)"; exit 1; }

RPC="${DEPLOY_RPC:-https://testnet-rpc.monad.xyz}"

echo "▶ deploying HandshakeEscrowV2 (treasury: $TREASURY)..."
OUT=$(forge create contracts/HandshakeEscrowV2.sol:HandshakeEscrowV2 --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --json --constructor-args "$TREASURY")
ADDR=$(echo "$OUT" | grep -oP '"deployedTo":\s*"\K0x[0-9a-fA-F]{40}')
[ -z "$ADDR" ] && { echo "deploy failed:"; echo "$OUT"; exit 1; }

EXPLORER="https://testnet.monadexplorer.com/address/$ADDR"
echo "  ✅ HandshakeEscrowV2 @ $ADDR"
echo "  🔗 $EXPLORER"

cat > deployments.json <<JSON
{
  "network": "monad-testnet",
  "chainId": 10143,
  "contract": "HandshakeEscrowV2",
  "address": "$ADDR",
  "treasury": "$TREASURY",
  "explorer": "$EXPLORER"
}
JSON
echo "  📝 saved -> deployments.json (the app reads the address from here)"
