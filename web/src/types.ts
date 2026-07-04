export interface Breakdown { quality: number; price: number; speed: number }

export interface RoundOffer {
  sellerId: string;
  price: number;
  deliveryEst: number;
  pitch: string;
  score: number;
  breakdown: Breakdown;
}

export interface Round {
  round: number;
  leader: string;
  pushed: string[];
  managerLine: string;
  offers: RoundOffer[];
}

export interface Verdict {
  jobId: string;
  sellerId: string;
  pass: boolean;
  score: number;
  notes: string;
}

export interface Reputation { sellerId: string; jobs: number; successes: number; score: number }

export type StepState = "pending" | "running" | "done" | "error";

export interface SettlementStep {
  key: string;
  label: string;
  state: StepState;
  txHash?: string;
  txUrl?: string;
  detail?: string;
}

export interface OnChainRep { jobsWon: number; jobsPassed: number; avgScore: number }

export interface Settlement {
  id: string;
  status: "running" | "done" | "error";
  escrow: string;
  escrowUrl: string;
  winnerId: string;
  winnerAddress?: string;
  winnerAddressUrl?: string;
  pass: boolean;
  steps: SettlementStep[];
  reputationBefore?: OnChainRep;
  reputationAfter?: OnChainRep;
  error?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: "seller" | "buyer";
  skills: string;
  wallet: string;
  reputation: Reputation;
  /** Account handle that registered this agent; house roster = "Handshake". */
  owner: string;
  /** Sellers: job types this agent bids on. */
  serviceTypes?: ("landing" | "sql" | "data")[];
}

/** One market session — marketplace and trading floor share this shape. */
export interface MarketSession {
  id: string;
  kind: "market" | "floor";
  reputations: Record<string, Reputation>;
  buyer: { id: string; name: string; scripted: boolean };
  job: {
    id: string;
    type: "landing" | "sql" | "data";
    task: string;
    budget: number;
    priorities: { quality: number; speed: number; price: number };
    requirements: string[];
  };
  status: "running" | "done" | "error";
  phase: "opening" | "negotiating" | "delivering" | "verifying" | "settled";
  phaseDetail: string | null;
  bidders: string[];
  error?: string;
  winnerId: string | null;
  verdict: Verdict | null;
  deliverable: { jobId: string; sellerId: string; content: string } | null;
  settlementId: string | null;
  /** Compact on-chain settlement state — pushed live to BOTH sides. */
  settlement: {
    status: "running" | "done" | "error";
    pass: boolean;
    txUrl: string | null;
    collected: boolean;
  } | null;
  rounds: Round[];
}
