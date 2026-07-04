/**
 * The contract every seller agent implements — mock or real AI.
 * The negotiation loop only ever talks to this interface.
 */
import type { JobSpec, Offer, Deliverable } from "../types.js";

/**
 * What a seller is allowed to know about the market each round.
 * Deliberately limited (real markets have information asymmetry):
 * a seller sees the leader's price and its own rank — never rivals' floors.
 */
export interface MarketSignal {
  round: number;
  totalRounds: number;
  leaderId: string | null;   // who is currently winning (null in round 1)
  leaderPrice: number | null;
  yourRank: number | null;   // 1 = leading
  pushed: boolean;           // the buyer asked YOU to improve
  buyerMessage: string | null; // the buyer's words from last round
}

export interface Seller {
  readonly id: string;
  /** Bid/no-bid decision: does this seller enter the market for this job? */
  bids(job: JobSpec): boolean;
  makeOffer(job: JobSpec, signal: MarketSignal): Promise<Offer>;
  deliver(job: JobSpec): Promise<Deliverable>;
}
