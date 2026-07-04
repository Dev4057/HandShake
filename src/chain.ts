/** Monad testnet connection details. Override via .env if these ever change. */
import "dotenv/config";
import process from "node:process";
import { ethers } from "ethers";

export const MONAD = {
  rpcUrl: process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  chainId: Number(process.env.MONAD_CHAIN_ID ?? 10143),
  explorer: process.env.MONAD_EXPLORER ?? "https://testnet.monadexplorer.com",
  currency: "MON",
};

/**
 * RPC failover — public testnet endpoints flake, so we probe candidates and use
 * the first one that answers. The choice is cached for the process lifetime.
 */
/**
 * Order matters (learned empirically):
 *  1. official node — the ONLY endpoint that correctly accepts sends from
 *     low-balance (<10 MON reserve) agent wallets;
 *  2. the user's keyed Ankr — fast, but its gateway rejects low-balance sends;
 *  3. public fallbacks (dRPC caps eth_call gas; public Ankr rate-limits).
 */
const RPC_CANDIDATES = [...new Set([
  "https://testnet-rpc.monad.xyz",
  MONAD.rpcUrl,
  "https://monad-testnet.drpc.org",
  "https://rpc.ankr.com/monad_testnet",
])];

function makeProvider(url: string): ethers.JsonRpcProvider {
  const req = new ethers.FetchRequest(url);
  req.timeout = 45_000; // the official node gets slow under load; still far below ethers' 300s default
  return new ethers.JsonRpcProvider(req, ethers.Network.from(MONAD.chainId), {
    staticNetwork: true, // skip network-detection round-trips
    batchMaxCount: 1,    // some public RPCs reject batched requests
  });
}

let cachedProvider: ethers.JsonRpcProvider | null = null;

/**
 * Drop the cached provider so the next getProvider() re-probes all endpoints.
 * Call after repeated call failures — an endpoint that answered the boot-time
 * probe can degrade later, and a cached-forever choice would never recover.
 */
export function resetProvider(): void {
  cachedProvider?.destroy();
  cachedProvider = null;
}

async function probe(url: string, timeoutMs: number): Promise<ethers.JsonRpcProvider> {
  const p = makeProvider(url);
  try {
    await Promise.race([
      p.getBlockNumber(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("probe timeout")), timeoutMs)),
    ]);
    return p;
  } catch (e) {
    p.destroy();
    throw e;
  }
}

/**
 * Probe ALL candidates in parallel and use whichever answers first — on a
 * congested testnet the "right" endpoint changes hour to hour, so racing
 * beats a fixed preference order. Rounds with backoff survive total outages.
 */
export async function getProvider(): Promise<ethers.JsonRpcProvider> {
  if (cachedProvider) return cachedProvider;
  const ROUNDS = 3;
  for (let round = 1; round <= ROUNDS; round++) {
    const attempts = RPC_CANDIDATES.map((url) => probe(url, 10_000).then((prov) => ({ prov, url })));
    try {
      const winner = await Promise.any(attempts);
      console.log(`Monad RPC → ${winner.url}`);
      cachedProvider = winner.prov;
      // late finishers still hold sockets — release them
      for (const a of attempts) {
        a.then(({ prov }) => { if (prov !== winner.prov) prov.destroy(); }).catch(() => {});
      }
      return winner.prov;
    } catch {
      /* every candidate failed this round */
    }
    if (round < ROUNDS) await new Promise((r) => setTimeout(r, 2_000 * round));
  }
  throw new Error("No Monad testnet RPC endpoint is reachable right now.");
}

/** Explorer link helpers so the UI/logs can show clickable proof. */
export const txUrl = (hash: string) => `${MONAD.explorer}/tx/${hash}`;
export const addrUrl = (addr: string) => `${MONAD.explorer}/address/${addr}`;
