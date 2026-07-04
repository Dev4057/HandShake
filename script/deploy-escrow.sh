#!/usr/bin/env bash
# Deploy HandshakeEscrow to Monad testnet and save the address to deployments.json.
# Redeploy anytime (e.g. fresh on demo day) — each run gives a new address, auto-saved.
#
# Run from a WSL terminal:  bash script/deploy-escrow.sh
# Needs: PRIVATE_KEY in .env, funded from https://faucet.monad.xyz
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  PRIVATE_KEY=$(grep -E '^PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r' | xargs)
  export PRIVATE_KEY
fi
[ -z "$PRIVATE_KEY" ] && { echo "PRIVATE_KEY not set (put it in .env)"; exit 1; }

RPC="${DEPLOY_RPC:-https://testnet-rpc.monad.xyz}"

echo "▶ deploying HandshakeEscrow..."
OUT=$(forge create contracts/HandshakeEscrow.sol:HandshakeEscrow --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --json)
ADDR=$(echo "$OUT" | grep -oP '"deployedTo":\s*"\K0x[0-9a-fA-F]{40}')
[ -z "$ADDR" ] && { echo "deploy failed:"; echo "$OUT"; exit 1; }

EXPLORER="https://testnet.monadexplorer.com/address/$ADDR"
echo "  ✅ HandshakeEscrow @ $ADDR"
echo "  🔗 $EXPLORER"

cat > deployments.json <<JSON
{
  "network": "monad-testnet",
  "chainId": 10143,
  "contract": "HandshakeEscrow",
  "address": "$ADDR",
  "explorer": "$EXPLORER"
}
JSON
echo "  📝 saved -> deployments.json (the app reads the address from here)"
