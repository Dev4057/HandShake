/**
 * Reputation store. For now it's an in-memory seed; in Phase 4 this is read from
 * (and written to) the on-chain reputation record. The buyer's scoring reads this
 * so proven sellers get an edge — Principle 10 (keeps a performance record).
 */
import type { Reputation } from "./types.js";

/** Seeded track records so the demo has interesting history from the start. */
export function seedReputations(): Map<string, Reputation> {
  const m = new Map<string, Reputation>();
  m.set("PixelPro", { sellerId: "PixelPro", jobs: 12, successes: 12, score: 9.2 });
  m.set("PremiumCo", { sellerId: "PremiumCo", jobs: 8, successes: 7, score: 8.0 });
  m.set("CheapBot", { sellerId: "CheapBot", jobs: 5, successes: 2, score: 4.0 });
  return m;
}
