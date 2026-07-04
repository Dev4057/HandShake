#!/usr/bin/env bash
# Deploy DataOracle to Monad testnet. Fee = 0.001 MON, seed value = BTC/USD in cents.
# Run from WSL:  bash script/deploy-oracle.sh
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  PRIVATE_KEY=$(grep -E '^PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r' | xargs)
  export PRIVATE_KEY
fi
[ -z "$PRIVATE_KEY" ] && { echo "PRIVATE_KEY not set (put it in .env)"; exit 1; }

RPC=$(grep -E '^MONAD_RPC_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r' | xargs)
RPC="${RPC:-https://testnet-rpc.monad.xyz}"

FEE_WEI=1000000000000000      # 0.001 MON
SEED_VALUE_CENTS=9742000      # $97,420.00

echo "▶ deploying DataOracle (fee 0.001 MON)..."
OUT=$(forge create contracts/DataOracle.sol:DataOracle --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --json --constructor-args $FEE_WEI $SEED_VALUE_CENTS)
ADDR=$(echo "$OUT" | grep -oP '"deployedTo":\s*"\K0x[0-9a-fA-F]{40}')
[ -z "$ADDR" ] && { echo "deploy failed:"; echo "$OUT"; exit 1; }

echo "  ✅ DataOracle @ $ADDR"
echo "  🔗 https://testnet.monadexplorer.com/address/$ADDR"

cat > deployments.oracle.json <<JSON
{
  "network": "monad-testnet",
  "contract": "DataOracle",
  "address": "$ADDR",
  "feeWei": "$FEE_WEI",
  "explorer": "https://testnet.monadexplorer.com/address/$ADDR"
}
JSON
echo "  📝 saved -> deployments.oracle.json"
