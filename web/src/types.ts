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

export interface MarketRun {
  job: {
    id: string;
    type: "landing" | "sql";
    task: string;
    budget: number;
    requirements: string[];
    priorities: { quality: number; speed: number; price: number };
  };
  winnerId: string;
  verdict: Verdict;
  deliverable: { jobId: string; sellerId: string; content: string };
  rounds: Round[];
  aiEnabled: boolean;
  reputations: Record<string, Reputation>;
}

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
}

/** One market session from the multi-market API. */
export interface MarketSession {
  id: string;
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
  bidders: string[];
  error?: string;
  winnerId: string | null;
  verdict: Verdict | null;
  deliverable: { jobId: string; sellerId: string; content: string } | null;
  rounds: Round[];
}
