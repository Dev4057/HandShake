/**
 * Competency 3 — Negotiation (the bounded loop), now against real agents.
 *
 * Each round: every seller receives a MarketSignal (its rank, the leader's
 * price, whether it's being pushed, and the buyer's actual words from last
 * round), responds with an offer, and the buyer re-scores the field. The
 * buyer's voice is generated INSIDE the loop so sellers genuinely react to it.
 * Bounded rounds = no infinite loops (Principle 6).
 */
import type { JobSpec, Offer, Reputation } from "../types.js";
import type { Seller, MarketSignal } from "../sellers/seller.js";
import { scoreOffers, type ScoredOffer } from "./scoring.js";
import { currentLeader, toPush } from "./decision.js";
import { managerLine } from "./voice.js";

export interface RoundLog {
  round: number;
  scored: ScoredOffer[];
  leader: string;
  pushed: string[];
  managerLine: string; // the buyer's words this round (relayed to sellers next round)
}

export interface NegotiationResult {
  winner: ScoredOffer;
  rounds: RoundLog[];
}

export interface NegotiationOpts {
  totalRounds?: number;
  scriptedBuyer?: boolean; // true = buyer voice uses deterministic fallback (no AI)
}

export async function runNegotiation(
  job: JobSpec,
  sellers: Seller[],
  reputations: Map<string, Reputation>,
  opts: NegotiationOpts = {},
): Promise<NegotiationResult> {
  const totalRounds = opts.totalRounds ?? 3;
  const rounds: RoundLog[] = [];
  let prev: RoundLog | null = null;

  for (let r = 1; r <= totalRounds; r++) {
    const pushedIds = new Set(prev?.pushed ?? []);
    const ranks = new Map(prev?.scored.map((s, i) => [s.offer.sellerId, i + 1]));

    // all sellers respond concurrently to this round's market state
    const offers: Offer[] = await Promise.all(
      sellers.map((s) =>
        s.makeOffer(job, {
          round: r,
          totalRounds,
          leaderId: prev?.leader ?? null,
          leaderPrice: prev ? prev.scored[0].offer.price : null,
          yourRank: ranks.get(s.id) ?? null,
          pushed: pushedIds.has(s.id),
          buyerMessage: prev?.managerLine ?? null,
        } satisfies MarketSignal),
      ),
    );

    const scored = scoreOffers(offers, job.priorities, reputations);
    const leader = currentLeader(scored).offer.sellerId;
    const pushed = toPush(scored);

    const draft: RoundLog = { round: r, scored, leader, pushed, managerLine: "" };
    draft.managerLine = (await managerLine(job, draft, { scripted: opts.scriptedBuyer })).text;

    rounds.push(draft);
    prev = draft;
  }

  return { winner: rounds[rounds.length - 1].scored[0], rounds };
}
