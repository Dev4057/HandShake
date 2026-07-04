/**
 * Reputation store. The in-memory seed gives the demo interesting history from
 * the start; on top of it, real on-chain settlement outcomes are merged in so
 * the buyer's scoring reads LIVE reputation — the market genuinely has memory
 * (Principle 10: keeps a performance record).
 */
import type { Reputation } from "./types.js";
import type { OnChainRep } from "./chain/escrow.js";

/** Seeded track records so the demo has interesting history from the start. */
export function seedReputations(): Map<string, Reputation> {
  const m = new Map<string, Reputation>();
  m.set("PixelPro", { sellerId: "PixelPro", jobs: 12, successes: 12, score: 9.2 });
  m.set("PremiumCo", { sellerId: "PremiumCo", jobs: 8, successes: 7, score: 8.0 });
  m.set("CheapBot", { sellerId: "CheapBot", jobs: 5, successes: 2, score: 4.0 });
  return m;
}

/** Seed treated as the prior; chain outcomes are evidence layered on top. */
export function mergeChainRep(seed: Reputation | undefined, sellerId: string, chain: OnChainRep): Reputation {
  const seedJobs = seed?.jobs ?? 0;
  const jobs = seedJobs + chain.jobsWon;
  const successes = (seed?.successes ?? 0) + chain.jobsPassed;
  const score = jobs === 0 ? 0 : ((seed?.score ?? 0) * seedJobs + chain.avgScore * chain.jobsWon) / jobs;
  return { sellerId, jobs, successes, score: Math.round(score * 10) / 10 };
}

/**
 * Merge each seller's on-chain record into the live scoring map. Best-effort:
 * bounded by a timeout and silent on RPC failure — scoring falls back to the
 * seed, a dead RPC can never stall or break a market.
 */
export async function refreshReputationsFromChain(
  reps: Map<string, Reputation>,
  sellerIds: string[],
  timeoutMs = 6_000,
): Promise<void> {
  const work = (async () => {
    const { loadAgentWallets } = await import("./chain/wallets.js");
    const { reputationOf } = await import("./chain/escrow.js");
    const seeds = seedReputations();
    const wallets = await loadAgentWallets(sellerIds);
    await Promise.all(
      wallets.map(async (w) => {
        const chain = await reputationOf(w.wallet.address);
        if (chain.jobsWon === 0) return; // nothing recorded on-chain yet
        reps.set(w.sellerId, mergeChainRep(seeds.get(w.sellerId), w.sellerId, chain));
      }),
    );
  })();
  await Promise.race([work, new Promise<void>((r) => setTimeout(r, timeoutMs))]).catch(() => {});
}
