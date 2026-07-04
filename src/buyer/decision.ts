/**
 * Competency 2 — Decision-making.
 *
 * Pure code. Given the scored offers, decide who's winning and who to push for a
 * better deal next round. A good manager pressures everyone who isn't already the
 * best to sharpen their offer.
 */
import type { ScoredOffer } from "./scoring.js";

/** The current best offer (scoreOffers already returns them sorted best-first). */
export function currentLeader(scored: ScoredOffer[]): ScoredOffer {
  return scored[0];
}

/** Seller ids to push to improve next round: everyone except the current leader. */
export function toPush(scored: ScoredOffer[]): string[] {
  return scored.slice(1).map((s) => s.offer.sellerId);
}
