import type { Agent, MarketRun, MarketSession, Settlement } from "./types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

export const runMarket = (jobType: "landing" | "sql") =>
  post<MarketRun>("/api/market/run", { jobType });

export const getAgents = () => get<{ agents: Agent[] }>("/api/agents");

export const registerAgent = (name: string, skills: string, role: "seller" | "buyer", wallet?: string) =>
  post<{ agent: Agent }>("/api/register", { name, skills, role, wallet });

export const openMarkets = () => post<{ sessions: MarketSession[] }>("/api/markets/open", {});
export const getMarkets = () => get<{ sessions: MarketSession[] }>("/api/markets");

export const settleSession = (s: MarketSession) =>
  post<Settlement>("/api/settle", {
    jobId: s.job.id,
    winnerId: s.winnerId,
    sellerIds: s.bidders,
    winnerPrice: s.rounds.at(-1)?.offers.find((o) => o.sellerId === s.winnerId)?.price ?? s.job.budget,
    budget: s.job.budget,
    pass: s.verdict?.pass ?? false,
    score: s.verdict?.score ?? 0,
    buyerId: s.buyer.id,
  });

export const getHealth = () => get<{ ok: boolean; aiEnabled: boolean }>("/api/health");

export const getChain = () => get<{ escrow: string | null; explorer: string | null }>("/api/chain");

export const startSettle = (run: MarketRun) =>
  post<Settlement>("/api/settle", {
    jobId: run.job.id,
    winnerId: run.winnerId,
    sellerIds: run.rounds[0]?.offers.map((o) => o.sellerId) ?? [],
    winnerPrice: run.rounds.at(-1)?.offers.find((o) => o.sellerId === run.winnerId)?.price ?? run.job.budget,
    budget: run.job.budget,
    pass: run.verdict.pass,
    score: run.verdict.score,
  });

export const getSettle = (id: string) => get<Settlement>(`/api/settle/${id}`);
