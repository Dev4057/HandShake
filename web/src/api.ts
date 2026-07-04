import type { Agent, MarketSession, Settlement } from "./types";

/** Same-origin "/api" by default (Vite proxies it in dev); override for a hosted backend. */
const BASE: string = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("Backend unreachable — is `npm run server` running?");
  }
  if (!r.ok) {
    let detail = `${r.status}`;
    try {
      const body = (await r.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch { /* non-JSON error body */ }
    throw new ApiError(detail, r.status);
  }
  return r.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown) =>
  req<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const getAgents = () => req<{ agents: Agent[] }>("/api/agents");

export const assignAgent = (id: string, owner: string) =>
  post<{ agent: Agent }>(`/api/agents/${encodeURIComponent(id)}/assign`, { owner });

export interface SellerStrategy {
  serviceTypes: ("landing" | "sql" | "data")[];
  startPrice: number;
  floorPrice: number;
  deliveryHours: number;
  personality?: string;
}

export const registerAgent = (p: {
  name: string;
  skills: string;
  role: "seller" | "buyer";
  owner: string;
  wallet?: string;
  strategy?: SellerStrategy;
}) => post<{ agent: Agent; joinsPool: boolean }>("/api/register", p);

export const openMarkets = () => post<{ sessions: MarketSession[] }>("/api/markets/open", {});
export const openMarketFor = (buyerId: string) =>
  post<{ session: MarketSession }>("/api/markets/open-one", { buyerId });
export const getMarkets = () => req<{ sessions: MarketSession[] }>("/api/markets");

export interface BuyerAgent {
  id: string;
  name: string;
  scripted: boolean;
  wallet: string | null;
  owner: string;
  job: MarketSession["job"];
}
export const getBuyers = () => req<{ buyers: BuyerAgent[] }>("/api/buyers");

/** Settlement is derived server-side from the session — the client only names it. */
export const settleSession = (sessionId: string) => post<Settlement>("/api/settle", { sessionId });
export const getSettle = (id: string) => req<Settlement>(`/api/settle/${id}`);

export const getHealth = () => req<{ ok: boolean; aiEnabled: boolean }>("/api/health");
export const getChain = () => req<{ escrow: string | null; explorer: string | null }>("/api/chain");

export const eventsUrl = () => `${BASE}/api/events`;
