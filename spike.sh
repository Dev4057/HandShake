#!/usr/bin/env bash
set -e
export PATH="$HOME/.foundry/bin:$PATH"
cd /mnt/c/Users/DevangGandhi/Dev/Monad
RPC=http://127.0.0.1:8545
KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

echo "▶ starting anvil (local test chain)..."
anvil --silent &
ANVIL=$!
trap "kill $ANVIL 2>/dev/null" EXIT
for i in $(seq 1 100); do cast block-number --rpc-url $RPC >/dev/null 2>&1 && break; done
echo "  anvil up"

echo "▶ deploying Hello.sol via forge create..."
OUT=$(forge create contracts/Hello.sol:Hello --rpc-url $RPC --private-key $KEY --broadcast --json --constructor-args gm_from_Handshake)
ADDR=$(echo "$OUT" | grep -oP '"deployedTo":\s*"\K0x[0-9a-fA-F]{40}')
echo "  deployed at $ADDR"

echo "▶ READ message:"
echo -n "  "; cast call $ADDR "message()(string)" --rpc-url $RPC

echo "▶ WRITE setMessage(...) + ping()"
cast send $ADDR "setMessage(string)" Handshake_is_live_on_Monad --private-key $KEY --rpc-url $RPC >/dev/null
cast send $ADDR "ping()" --private-key $KEY --rpc-url $RPC >/dev/null

echo "▶ READ back:"
echo -n "  message = "; cast call $ADDR "message()(string)" --rpc-url $RPC
echo -n "  pings   = "; cast call $ADDR "pings()(uint256)" --rpc-url $RPC

echo ""
echo "PIPELINE_OK: compile -> deploy -> write -> read"
