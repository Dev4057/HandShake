/**
 * Handshake — the 4 shared data shapes.
 *
 * These are the ONLY things the parts of the app pass to each other.
 * Every handoff between buyer, sellers, verifier and contract is one of these.
 *
 *   JobSpec     flows DOWN   (buyer  -> sellers)   "here's what I want"
 *   Offer       flows UP     (seller -> buyer)     "here's my bid"
 *   Deliverable flows UP     (winner -> buyer)     "here's the work"
 *   Verdict     flows OUT    (buyer  -> contract)  "here's the ruling"
 */

/** The kinds of work a buyer can ask for. */
export type ServiceType = "landing" | "sql" | "data";

/**
 * 1. JobSpec — "here's what I want."
 * Made by:  Buyer Agent (when the buyer posts a job)
 * Read by:  every Seller Agent (to bid) + the contract (to lock budget)
 * It is the single source of truth the deliverable is verified against.
 */
export interface JobSpec {
  id: string;                 // unique job id, e.g. "job-1"
  type: ServiceType;          // "landing" | "sql" — decides how work is done + verified
  task: string;               // one-line human description of the job
  requirements: string[];     // the checklist the deliverable must satisfy
  budget: number;             // max the buyer will pay, in MON
  priorities: Priorities;     // how the buyer weighs offers (must sum to 100)

  /** Data jobs only: what data the buyer wants; sourcing is verified on-chain (M2). */
  dataContext?: {
    topic: string;          // e.g. "BTC/USD spot price"
    mustCite: boolean;      // deliverable must cite an on-chain purchase receipt
  };

  /** SQL jobs only: the schema + a plain-English description of the wanted result. */
  sqlContext?: {
    schema: string;           // CREATE TABLE ... statements seeded into a throwaway SQLite db
    seedRows: string;         // INSERT statements so the query has data to run against
    expectation: string;      // e.g. "top 3 customers by total spend, columns: name, total"
    solution: string;         // reference query the buyer runs as the answer key to grade against
  };
}

/** How the buyer weighs offers. All three should sum to 100. */
export interface Priorities {
  quality: number;            // how much the buyer cares about quality of work
  speed: number;              // how much it cares about delivery time
  price: number;              // how much it cares about a low price
}

/**
 * 2. Offer — "here's my bid."
 * Made by:  each Seller Agent, every negotiation round
 * Read by:  the Buyer Agent's scoring function
 * All sellers MUST speak this exact shape so the buyer can compare them side by side.
 */
export interface Offer {
  sellerId: string;           // ties the offer to a seller's reputation + wallet
  jobId: string;              // which job this bids on
  price: number;              // asking price in MON (<= JobSpec.budget)
  deliveryEst: number;        // estimated delivery, in hours (lower = faster)
  pitch: string;              // natural-language sell / differentiator
}

/**
 * 3. Deliverable — "here's the work."
 * Made by:  the winning Seller Agent
 * Read by:  the Buyer Agent's verifier
 * `content` is the actual product; jobId + sellerId route it to the right job/seller.
 */
export interface Deliverable {
  jobId: string;
  sellerId: string;
  content: string;            // landing -> HTML string; sql -> the SQL query text
}

/**
 * 4. Verdict — "here's the ruling."
 * Made by:  the Buyer Agent's verifier
 * Read by:  the contract (pay or refund? reward or slash?)
 * The single fact that drives the money and the reputation.
 */
export interface Verdict {
  jobId: string;
  sellerId: string;
  pass: boolean;              // true -> settle + reputation++, false -> refund + slash
  score: number;              // 0-10 quality score (feeds reputation + the demo UI)
  notes: string;              // short human-readable reason (shown in the feed)
}

/** On-chain reputation the buyer reads when scoring future offers. */
export interface Reputation {
  sellerId: string;
  jobs: number;               // total jobs won
  successes: number;          // jobs that passed verification
  score: number;              // rolling average quality (0-10)
}
