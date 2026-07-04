/**
 * Market sessions — the marketplace core.
 *
 * A MarketSession = one buyer + one job + its negotiation + its verdict.
 * Three buyers post three jobs into ONE shared seller pool; each seller makes
 * its own bid/no-bid call per job. Sessions run concurrently; every state
 * change is pushed to the UI live over SSE (see market/events.ts).
 *
 * The Trading Floor runs the SAME engine: a single-buyer session with
 * kind:"floor", excluded from the marketplace listing.
 */
import { randomUUID } from "node:crypto";
import type { JobSpec, Reputation } from "../types.js";
import type { Seller } from "../sellers/seller.js";
import { SellerAgent } from "../sellers/sellerAgent.js";
import { DataScoutAgent } from "../sellers/dataScout.js";
import { verifyReceipt } from "../chain/oracle.js";
import { runMarket, type MarketResult } from "../buyer/runMarket.js";
import { aiJudgeLanding } from "../buyer/verify/landing.js";
import { LANDING_JOB, SQL_JOB, DATA_JOB } from "../fixtures.js";
import { seedReputations, refreshReputationsFromChain, mergeChainRep } from "../reputation.js";
import { listRegisteredSellerConfigs } from "./sellerRegistry.js";
import { bus, emitMarketsChanged } from "./events.js";
import type { OnChainRep } from "../chain/escrow.js";

// ---- buyers ----------------------------------------------------------------

export interface BuyerConfig {
  id: string;
  name: string;
  scripted: boolean; // false = full AI negotiation voice
  wallet: "master" | "own"; // own = distinct auto-funded wallet on-chain
  job: JobSpec;
}

export const BUYERS: BuyerConfig[] = [
  { id: "buyer-arya",   name: "Arya Labs",      scripted: false, wallet: "master", job: LANDING_JOB },
  { id: "buyer-nimbus", name: "Nimbus Data",    scripted: true,  wallet: "own",    job: SQL_JOB },
  { id: "buyer-atlas",  name: "Atlas Research", scripted: true,  wallet: "own",    job: DATA_JOB },
];

// ---- the shared seller pool --------------------------------------------------

export function makeSellerPool(): Seller[] {
  return [
    new SellerAgent({
      id: "PixelPro", skills: "Landing pages, responsive frontend",
      personality: "Confident specialist. Defends a premium price via speed and a spotless track record; concedes slowly.",
      serviceTypes: ["landing"],
      startPrice: 480, floorPrice: 400, startDelivery: 1, bestDelivery: 1, concession: 0.5,
    }),
    new SellerAgent({
      id: "CheapBot", skills: "Budget builds, quick turnarounds",
      personality: "Aggressive discounter. Wins on price alone — undercuts fast and loudly.",
      serviceTypes: ["landing", "sql"],
      startPrice: 300, floorPrice: 260, startDelivery: 4, bestDelivery: 3, concession: 0.5,
    }),
    new SellerAgent({
      id: "PremiumCo", skills: "Premium design, long support",
      personality: "Premium anchor. Rarely cuts price; adds value instead and questions cheap rivals' quality.",
      serviceTypes: ["landing", "sql"],
      startPrice: 510, floorPrice: 470, startDelivery: 2, bestDelivery: 1.5, concession: 0.4,
    }),
    new SellerAgent({
      id: "QueryForge", skills: "SQL, analytics pipelines",
      personality: "Methodical database specialist. Prices fairly, emphasizes correctness.",
      serviceTypes: ["sql"], scripted: true,
      startPrice: 220, floorPrice: 180, startDelivery: 2, bestDelivery: 1.5, concession: 0.45,
    }),
    new DataScoutAgent({
      id: "DataScout", skills: "Live market data, paid API sourcing",
      personality: "Data specialist. Justifies price by the licensed sources it pays for; transparent about costs.",
      serviceTypes: ["data"],
      startPrice: 150, floorPrice: 90, startDelivery: 1, bestDelivery: 0.5, concession: 0.4,
    }),
    new SellerAgent({
      id: "InfoSnap", skills: "Generic web scraping",
      personality: "Undercuts on price but vague about data sources.",
      serviceTypes: ["data"], scripted: true,
      startPrice: 80, floorPrice: 60, startDelivery: 3, bestDelivery: 2.5, concession: 0.3,
    }),
    // user-registered agents join the live pool with their own strategies
    ...listRegisteredSellerConfigs().map((cfg) => new SellerAgent(cfg)),
  ];
}

// ---- sessions ----------------------------------------------------------------

export interface MarketSession {
  id: string;
  kind: "market" | "floor";
  buyer: BuyerConfig;
  status: "running" | "done" | "error";
  startedAt: number;
  result?: MarketResult;
  error?: string;
  bidders: string[]; // sellers that chose to enter
  /** Live progress — rounds appear here as they complete, before result exists. */
  liveRounds: import("../buyer/negotiate.js").RoundLog[];
  phase: "opening" | "negotiating" | "delivering" | "verifying" | "settled";
  phaseDetail?: string; // e.g. which seller is delivering
  /** Set once an on-chain settlement has been started — blocks double-settles. */
  settlementId?: string;
}

const sessions = new Map<string, MarketSession>();
const reputations: Map<string, Reputation> = seedReputations();

// A settled market writes reputation on-chain; absorb it into the scoring map
// immediately so the NEXT negotiation prices it in — the market has memory.
bus.on("settled", ({ sellerId, rep }: { sellerId: string; rep: OnChainRep }) => {
  if (rep.jobsWon === 0) return;
  reputations.set(sellerId, mergeChainRep(seedReputations().get(sellerId), sellerId, rep));
  emitMarketsChanged();
});

/** Buyer-side on-chain provenance check for delivered data reports. */
async function checkProvenance(result: MarketResult) {
  const v = result.verdict;
  const receiptMatch = result.deliverable.content.match(/Receipt:\s*(0x[0-9a-fA-F]{64})/);
  if (!receiptMatch) {
    return { ...v, pass: false, score: Math.min(v.score, 3), notes: `${v.notes} No on-chain purchase receipt cited — provenance unproven.` };
  }
  try {
    const check = await verifyReceipt(receiptMatch[1]);
    if (!check.ok) {
      return { ...v, pass: false, score: 1, notes: `${v.notes} Cited receipt INVALID: ${check.reason}.` };
    }
    const reported = result.deliverable.content.match(/Price:\s*\$([\d,]+(?:\.\d+)?)/);
    const reportedCents = reported ? Math.round(parseFloat(reported[1].replace(/,/g, "")) * 100) : NaN;
    if (Number.isFinite(reportedCents) && check.valueCents !== undefined && reportedCents !== check.valueCents) {
      return { ...v, pass: false, score: 1, notes: `${v.notes} FABRICATION: report says ${reportedCents}¢ but oracle receipt says ${check.valueCents}¢.` };
    }
    return { ...v, notes: `${v.notes} On-chain provenance verified — seller paid the oracle and the value matches.` };
  } catch {
    return { ...v, notes: `${v.notes} (Provenance check unavailable — RPC unreachable.)` };
  }
}

export const getSession = (id: string) => sessions.get(id);
export const listSessions = (kind?: MarketSession["kind"]) =>
  [...sessions.values()]
    .filter((s) => !kind || s.kind === kind)
    .sort((a, b) => b.startedAt - a.startedAt);
export const getReputations = () => reputations;

/** Launch one session: create it, run the market engine, stream every change. */
function startSession(buyer: BuyerConfig, pool: Seller[], kind: MarketSession["kind"]): MarketSession {
  const session: MarketSession = {
    id: randomUUID(),
    kind,
    buyer,
    status: "running",
    startedAt: Date.now(),
    bidders: pool.filter((s) => s.bids(buyer.job)).map((s) => s.id),
    liveRounds: [],
    phase: "opening",
  };
  sessions.set(session.id, session);

  runMarket(buyer.job, pool, reputations, {
    scriptedBuyer: buyer.scripted,
    // ALWAYS pace rounds and phases — negotiations are theatre as much as
    // computation, and an instant (deterministic-fallback) market is unwatchable
    paceMs: 3_000,
    onRound: (rl) => {
      session.liveRounds.push(rl);
      emitMarketsChanged();
    },
    onPhase: (phase, detail) => {
      session.phase = phase;
      session.phaseDetail = detail;
      emitMarketsChanged();
    },
  })
    .then(async (result) => {
      // landing pages: upgrade the deterministic verdict with the AI judge when AI is on
      if (buyer.job.type === "landing") {
        result.verdict = await aiJudgeLanding(buyer.job, result.deliverable);
      }
      // data jobs: buyer independently verifies PROVENANCE on-chain —
      // did the seller really purchase this data, and does the value match?
      if (buyer.job.type === "data" && result.verdict.pass) {
        result.verdict = await checkProvenance(result);
      }
      session.result = result;
      session.status = "done";
      session.phase = "settled";
      emitMarketsChanged();
    })
    .catch((e) => {
      session.status = "error";
      session.error = (e as Error).message;
      emitMarketsChanged();
    });

  return session;
}

/**
 * Open one market per buyer; all negotiate concurrently.
 * Same seller ROSTER for every market (that's the shared marketplace), but a
 * fresh instance set per session — sellers hold per-negotiation price state,
 * and concurrent markets must not interleave it.
 */
export function openAllMarkets(): MarketSession[] {
  // best-effort, non-blocking: pull real on-chain reputation into scoring
  void refreshReputationsFromChain(reputations, makeSellerPool().map((s) => s.id)).then(emitMarketsChanged);
  const batch = BUYERS.map((buyer) => startSession(buyer, makeSellerPool(), "market"));
  emitMarketsChanged();
  return batch;
}

/** Buyer desk: open ONE buyer's market (the same engine, one session). */
export function openMarketFor(buyerId: string): MarketSession | null {
  const buyer = BUYERS.find((b) => b.id === buyerId);
  if (!buyer) return null;
  void refreshReputationsFromChain(reputations, makeSellerPool().map((s) => s.id)).then(emitMarketsChanged);
  const session = startSession(buyer, makeSellerPool(), "market");
  emitMarketsChanged();
  return session;
}

/** Trading Floor: one live single-buyer market on the same engine. */
export function openFloorMarket(jobType: "landing" | "sql"): MarketSession {
  const job = jobType === "sql" ? SQL_JOB : LANDING_JOB;
  const buyer: BuyerConfig = { id: "buyer-floor", name: "Floor Desk", scripted: false, wallet: "master", job };
  void refreshReputationsFromChain(reputations, makeSellerPool().map((s) => s.id)).then(emitMarketsChanged);
  const session = startSession(buyer, makeSellerPool(), "floor");
  emitMarketsChanged();
  return session;
}
