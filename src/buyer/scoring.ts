/**
 * Competency 1 — Judgement (the scoring function).
 *
 * Pure code, no AI. Turns each Offer into a single 0-100 score using the buyer's
 * priority weights + the seller's reputation. This is the manager's rubric:
 * consistent, explainable, tamper-proof.
 *
 * Each dimension is normalised ACROSS the current set of offers, so the cheapest
 * bid gets full marks on price, the fastest gets full marks on speed, etc.
 * "Quality" can't be measured before the work is done, so at bid time we use the
 * seller's track record (reputation) as its proxy.
 */
import type { Offer, Priorities, Reputation } from "../types.js";

export interface ScoredOffer {
  offer: Offer;
  score: number; // 0-100
  breakdown: { quality: number; price: number; speed: number }; // each 0-1, pre-weighting
}

/** Neutral track record for a seller we've never worked with (0-10 scale). */
const DEFAULT_REP_SCORE = 5;

/** Score every offer and return them sorted best-first. */
export function scoreOffers(
  offers: Offer[],
  priorities: Priorities,
  reputations: Map<string, Reputation>,
): ScoredOffer[] {
  if (offers.length === 0) return [];

  const prices = offers.map((o) => o.price);
  const delays = offers.map((o) => o.deliveryEst);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const minD = Math.min(...delays), maxD = Math.max(...delays);

  // normalise so lower (cheaper / faster) => closer to 1; identical values => 1
  const better = (v: number, min: number, max: number) => (max === min ? 1 : (max - v) / (max - min));
  const w = priorities;

  return offers
    .map((o): ScoredOffer => {
      const rep = reputations.get(o.sellerId);
      const quality = (rep ? rep.score : DEFAULT_REP_SCORE) / 10; // 0-1
      const price = better(o.price, minP, maxP);
      const speed = better(o.deliveryEst, minD, maxD);
      // weights sum to 100, so this lands in 0-100
      const score = quality * w.quality + price * w.price + speed * w.speed;
      return { offer: o, score: Math.round(score * 10) / 10, breakdown: { quality, price, speed } };
    })
    .sort((a, b) => b.score - a.score);
}
