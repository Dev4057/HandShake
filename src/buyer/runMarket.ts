/**
 * Competency 6 — Accountability (the clean interface).
 *
 * One call runs the manager's entire job: post the brief, negotiate over rounds,
 * hire the winner, take delivery, INDEPENDENTLY VERIFY it, and return the winner,
 * the verdict, and the full decision trail. Everything else hides behind this.
 *
 * Settlement on-chain (pay/slash + reputation) is wired in Phase 4; here we return
 * the verdict that will drive it.
 */
import type { JobSpec, Deliverable, Verdict, Reputation } from "../types.js";
import type { Seller } from "../sellers/seller.js";
import { runNegotiation, type NegotiationResult } from "./negotiate.js";
import { verify } from "./verify/index.js";

export interface MarketResult {
  job: JobSpec;
  negotiation: NegotiationResult;
  winnerId: string;
  deliverable: Deliverable;
  verdict: Verdict;
}

export type MarketPhase = "negotiating" | "delivering" | "verifying";

export async function runMarket(
  job: JobSpec,
  sellerPool: Seller[],
  reputations: Map<string, Reputation>,
  opts: {
    scriptedBuyer?: boolean;
    onRound?: (rl: import("./negotiate.js").RoundLog) => void;
    onPhase?: (phase: MarketPhase, detail?: string) => void;
    paceMs?: number;
  } = {},
): Promise<MarketResult> {
  // 0. bid/no-bid — only sellers who choose this job enter the market
  const sellers = sellerPool.filter((s) => s.bids(job));
  if (sellers.length === 0) throw new Error(`No sellers bid on job ${job.id}`);

  // 1-3. negotiate and pick a winner (rounds stream out via onRound)
  opts.onPhase?.("negotiating");
  const negotiation = await runNegotiation(job, sellers, reputations, {
    scriptedBuyer: opts.scriptedBuyer,
    onRound: opts.onRound,
    paceMs: opts.paceMs,
  });
  const winnerId = negotiation.winner.offer.sellerId;

  // pacing: deterministic delivery/verification are instant — hold each phase
  // long enough for viewers to actually see it happen
  const pace = () => (opts.paceMs ? new Promise((r) => setTimeout(r, opts.paceMs)) : Promise.resolve());

  // 7. delegate the work to the winner (the agent actually produces it)
  opts.onPhase?.("delivering", winnerId);
  const winner = sellers.find((s) => s.id === winnerId)!;
  const [deliverable] = await Promise.all([winner.deliver(job), pace()]);

  // 8. trust, but verify — the buyer's own check, independent of the seller's
  opts.onPhase?.("verifying", winnerId);
  await pace();
  const verdict = verify(job, deliverable);

  return { job, negotiation, winnerId, deliverable, verdict };
}
